import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname);

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

function resolvePort(): number {
  const portArgIdx = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portArgIdx >= 0 && process.argv[portArgIdx + 1]) {
    const parsedArg = parseInt(process.argv[portArgIdx + 1], 10);
    if (!Number.isNaN(parsedArg) && parsedArg > 0) return parsedArg;
  }
  const portEqArg = process.argv.find((arg) => arg.startsWith('--port='));
  if (portEqArg) {
    const parsedEq = parseInt(portEqArg.split('=')[1] || '', 10);
    if (!Number.isNaN(parsedEq) && parsedEq > 0) return parsedEq;
  }
  const envPort = parseInt(process.env.PORT || '3000', 10);
  return !Number.isNaN(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolvePort();

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get(['/health', '/healthz', '/api/health'], (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'anesthesia-care-sync',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/weather', async (req, res) => {
    const { latitude, longitude } = req.query;
    const currentHour = new Date().getHours();
    const isDay = currentHour >= 6 && currentHour < 18 ? 1 : 0;

    const fallbackData = {
      current: {
        temperature_2m: 31.5,
        relative_humidity_2m: 65,
        weather_code: 0,
        is_day: isDay,
      },
      fallback: true,
    };

    if (!latitude || !longitude) {
      return res.json(fallbackData);
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,is_day`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.json(fallbackData);
      }
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.warn('Weather proxy warning (using default weather):', error?.message || error);
      return res.json(fallbackData);
    }
  });

  let apiRouter: express.Router | null = null;
  let frontendHandler: express.RequestHandler | null = null;
  let bootstrapError: Error | null = null;

  const bootstrapPromise = (async () => {
    try {
      const [
        { createApiSessionToken, requireApiAuth, SESSION_TTL_MS },
        { createFhirRouter },
        { createAiVisionRouter },
        { createAiChatRouter },
        { createSystemRouter },
        { createAdminRouter },
      ] = await Promise.all([
        import('./server/middleware/auth'),
        import('./server/routes/fhir'),
        import('./server/routes/aiVision'),
        import('./server/routes/aiChat'),
        import('./server/routes/system'),
        import('./server/routes/admin'),
      ]);

      const router = express.Router();
      router.get('/api/auth/session', (_req, res) => {
        const { token, expiresAt } = createApiSessionToken();
        res.cookie('ac_session', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: SESSION_TTL_MS,
        });
        res.status(200).json({ token, expiresAt });
      });

      router.use('/api/admin', createAdminRouter());
      router.use(['/api/ai', '/api/fhir', '/api/system'], requireApiAuth);
      router.use('/api/fhir', createFhirRouter());
      router.use('/api/ai', createAiVisionRouter());
      router.use('/api/ai', createAiChatRouter());
      router.use('/api/system', createSystemRouter());
      apiRouter = router;

      const distDir = path.resolve(ROOT_DIR, 'dist');
      const isExplicitDev =
        (process.env.npm_lifecycle_event === 'dev' ||
          process.argv.includes('--dev') ||
          process.env.NODE_ENV === 'development') &&
        process.env.NODE_ENV !== 'production' &&
        process.env.npm_lifecycle_event !== 'start';

      if (isExplicitDev) {
        console.log('[Server] Dev mode: Starting Vite middleware');
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        frontendHandler = vite.middlewares;
      } else {
        const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
        if (hasDist) {
          console.log('[Server] Production mode: Serving static files from', distDir);
          const prodRouter = express.Router();
          prodRouter.use(express.static(distDir, { maxAge: '1h' }));
          prodRouter.get('*', (_req, res) => {
            res.sendFile(path.join(distDir, 'index.html'));
          });
          frontendHandler = prodRouter;
        } else {
          console.warn('[Server] Warning: dist directory not found at startup. Serving 200 OK recovery page.');
          frontendHandler = (_req, res) => {
            res.status(200).send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="2">
  <title>Anesthesia Care</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
  <h2>กำลังเริ่มการทำงาน Anesthesia Care...</h2>
  <p>ระบบกำลังเตรียมข้อมูล หน้าจอจะรีเฟรชอัตโนมัติในสักครู่</p>
</body>
</html>`);
          };
        }
      }
      console.log('[Server] API routes and frontend middleware ready.');
    } catch (err: any) {
      bootstrapError = err instanceof Error ? err : new Error(String(err));
      console.error('[Server] Bootstrap error:', bootstrapError);
    }
  })();

  app.use(async (req, res, next) => {
    if (!apiRouter || !frontendHandler) {
      await bootstrapPromise;
    }
    if (bootstrapError) {
      return next(bootstrapError);
    }
    if (apiRouter && req.path.startsWith('/api')) {
      return apiRouter(req, res, (err?: any) => {
        if (err) return next(err);
        if (frontendHandler) return frontendHandler(req, res, next);
        return next();
      });
    }
    if (frontendHandler) {
      return frontendHandler(req, res, next);
    }
    return next();
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Anesthesia Care Server] running at http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = () => {
    console.log('[Server] Shutdown signal received, closing HTTP server...');
    server.close(() => {
      console.log('[Server] HTTP server closed gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
