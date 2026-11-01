import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

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

  // Gemini AI Chat Assistant endpoint with real-time equipment status context
  app.post('/api/ai/chat', async (req, res) => {
    const { message, context } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        isQuotaExceeded: false,
        error: 'NO_API_KEY',
        message: 'No Gemini API key configured',
      });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `คุณคือ 'น้องออร่า (AURA)' ผู้ช่วยวิสัญญีอัจฉริยะที่ขับเคลื่อนด้วย Gemini 1.5
- มีความฉลาด ตอบคำถามได้หลากหลาย ครอบคลุม เป็นธรรมชาติ สุภาพ และมีมิตรไมตรีสไตล์ผู้ช่วยวิสัญญีแพทย์/วิสัญญีพยาบาล
- เมื่อผู้ใช้พูดคุยเรื่องทั่วไป คุยเล่น ทักทาย มุกตลก บ่นหิว/เหนื่อย ให้โต้ตอบอย่างเป็นธรรมชาติ ไม่สวมบทบาทแข็งกระด้าง (เช่น พิมพ์ว่า 'หิวข้าว' -> ให้ชวนคุยเรื่องหาอะไรทาน แนะนำอาหาร หรือคุยเล่นอย่างเป็นกันเอง ห้ามวกกลับมาพูดเรื่องรายงานความพร้อมอุปกรณ์เด็ดขาด)
- รอบรู้ลึกซึ้งทางด้านวิสัญญีวิทยา: ยาวิสัญญี (Propofol, Rocuronium, Succinylcholine, Fentanyl, Morphine, Sugammadex, Adrenaline, Atropine, Ephedrine, Norepinephrine, Ketamine, Midazolam ฯลฯ), ขนาดยาตามน้ำหนัก (Dosage calculations ทั้งเด็กและผู้ใหญ่), ข้อห้ามใช้ (Contraindications), แนวทางการกู้ชีพฉุกเฉิน (CPR / ACLS / PALS), การจัดการทางเดินหายใจ (Airway management & Difficult airway DAS algorithm), และภาวะแทรกซ้อนทางวิสัญญี (Malignant Hyperthermia, LAST ฯลฯ)
- ข้อมูลความพร้อมครุภัณฑ์ (readinessData): ให้ถือเป็น 'คลังความรู้ส่วนตัว' ที่คุณรับรู้ไว้ และจะดึงมาตอบ 'เฉพาะเมื่อผู้ใช้เอ่ยถามเกี่ยวกับอุปกรณ์, ห้องผ่าตัด, หรือความพร้อมของงานวิสัญญี' เท่านั้น

โครงสร้างข้อมูล readinessData (ข้อมูลสถานะครุภัณฑ์วิสัญญีเรียลไทม์ปัจจุบัน):
- ความพร้อมโดยรวม (completionPct): ${context?.completionPct ?? 98}%
- ตรวจเช็กแล้ว (grandChecked): ${context?.grandChecked ?? 0} จากทั้งหมด (grandTotal): ${context?.grandTotal ?? 0} รายการ
- อุปกรณ์ปกติพร้อมใช้ (grandNormal): ${context?.grandNormal ?? 0} รายการ
- อุปกรณ์ที่พบข้อบกพร่อง/ชำรุด (grandDefective): ${context?.grandDefective ?? 0} รายการ
- รายการชำรุดสะสม (defectiveItems): ${JSON.stringify(context?.defectiveItems ?? [])}
- รายการรอตรวจเช็ก (pendingCount): ${context?.pendingCount ?? 0} รายการ`;

      let response;
      try {
        response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: message || 'สวัสดีครับ',
          config: {
            systemInstruction: systemInstruction,
          },
        });
      } catch (e1: any) {
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: message || 'สวัสดีครับ',
            config: {
              systemInstruction: systemInstruction,
            },
          });
        } catch (e2: any) {
          console.warn('[Gemini API] Free tier quota or rate limit reached. Returning fallback response.');
          return res.json({
            success: false,
            isQuotaExceeded: true,
            error: 'QUOTA_EXCEEDED',
            message: 'Quota limit exceeded on Gemini API',
          });
        }
      }

      const replyText = response.text || '';
      return res.json({ success: true, text: replyText });
    } catch (error: any) {
      console.warn('[Gemini API] Unexpected request error:', error?.message || 'Error communicating with API');
      return res.json({
        success: false,
        isQuotaExceeded: true,
        error: 'API_ERROR',
        message: 'Error communicating with Gemini API',
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
