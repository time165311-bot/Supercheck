import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'app_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data dir:', err);
  }
}

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

function writeServerState(data: Record<string, any>) {
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

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'anesthesia-care-sync',
      timestamp: new Date().toISOString(),
    });
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
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Anesthesia Care Server] running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
