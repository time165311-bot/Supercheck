import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
let DATA_DIR = path.resolve(__dirname, 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const testFile = path.join(DATA_DIR, '.write_test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
} catch (err) {
  console.warn('[Server] Cannot write to ./data, using /tmp/anesthesia_data fallback:', err);
  DATA_DIR = path.resolve('/tmp', 'anesthesia_data');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('[Server] Failed to create fallback tmp data dir:', e);
  }
}
const STATE_FILE = path.join(DATA_DIR, 'app_state.json');

// Initial default state if file doesn't exist
function readServerState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading app_state.json:', e);
  }
  return {};
}

function writeServerState(data: any) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing app_state.json:', e);
    return false;
  }
}

async function startServer() {
  const app = express();

  // Allow larger payload for equipment data, avatars, and configs
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS headers for seamless cross-device API calls if accessed via different host headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoints for Cloud Run / load balancers
  app.get(['/health', '/healthz', '/api/health'], (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'anesthesia-care-sync',
      timestamp: new Date().toISOString(),
    });
  });

  // Weather proxy to bypass client-side CORS issues with robust fallback
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
    } catch (error) {
      const err = error as any;
      console.warn('Weather proxy warning (using default weather):', err?.message || err);
      return res.json(fallbackData);
    }
  });

  // Cross-device sync endpoints
  app.get('/api/sync', (_req, res) => {
    const state = readServerState();
    res.json({
      success: true,
      data: state,
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/sync', (req, res) => {
    const incomingData = req.body || {};
    const currentState = readServerState();

    // Merge incoming data with current state (shallow merge of known keys, preserving sub-properties)
    const updatedState = {
      ...currentState,
      ...incomingData,
      lastSyncedAt: new Date().toISOString(),
    };

    const saved = writeServerState(updatedState);
    if (saved) {
      res.json({
        success: true,
        data: updatedState,
        message: 'State synchronized successfully across devices',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to write state file on server',
      });
    }
  });

  // Vite middleware in dev or static files in production
  const distDir = path.resolve(__dirname, 'dist');
  const isExplicitDev = (process.env.npm_lifecycle_event === 'dev' || process.argv.includes('--dev')) &&
                        process.env.NODE_ENV !== 'production';

  if (isExplicitDev) {
    console.log('[Server] Dev mode: Starting Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static bundle
    const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
    if (hasDist) {
      console.log('[Server] Production mode: Serving static files from', distDir);
      app.use(express.static(distDir, { maxAge: '1h' }));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.warn('[Server] Warning: dist directory not found at startup. Serving 200 OK recovery page.');
      app.get('*', (_req, res) => {
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
      });
    }
  }

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
