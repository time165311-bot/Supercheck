import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '../..');

export let serverDb: ReturnType<typeof initializeFirestore> | null = null;
export let adminDb: ReturnType<typeof getAdminFirestore> | null = null;
export let adminAuth: ReturnType<typeof getAdminAuth> | null = null;
export let serverDatabaseId = '(default)';

try {
  const fbConfigPath = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
  let fbConfig: any = null;

  if (fs.existsSync(fbConfigPath)) {
    fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
  } else if (process.env.FIREBASE_PROJECT_ID) {
    fbConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
      apiKey: process.env.FIREBASE_API_KEY || '',
    };
  }

  if (fbConfig?.projectId) {
    serverDatabaseId = fbConfig.firestoreDatabaseId || '(default)';

    try {
      const adminApp = getAdminApps().length === 0
        ? initializeAdminApp({ projectId: fbConfig.projectId })
        : getAdminApp();
      adminDb = getAdminFirestore(adminApp, serverDatabaseId);
      adminAuth = getAdminAuth(adminApp);
      console.log(`[Server] Initialized Firebase Admin SDK for DB: ${serverDatabaseId}`);
    } catch (adminErr) {
      console.warn('[Server] Firebase Admin init warning:', adminErr);
    }

    if (fbConfig.apiKey) {
      const fbApp = getApps().length === 0 ? initializeApp(fbConfig, 'server-sync') : getApps()[0];
      serverDb = initializeFirestore(
        fbApp,
        { experimentalForceLongPolling: true },
        serverDatabaseId
      );
      console.log(`[Server] Connected Firestore DB: ${serverDatabaseId}`);
    }
  }
} catch (fbInitErr) {
  console.warn('[Server] Firestore initialization warning (JSON fallback active):', fbInitErr);
}

/**
 * Server-side Gemini API key (never reads VITE_ client-prefixed variables).
 */
export function getServerGeminiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function createServerGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

/**
 * Runs an async task with a clean AbortController timeout (replaces deprecated req/res.setTimeout).
 */
export async function withAbortTimeout<T>(
  timeoutMs: number,
  task: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`AI request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Runs a single model attempt with its own timeout linked to a parent AbortSignal.
 * Ensures a slow primary model attempt can time out and fall back cleanly while the parent budget remains active.
 */
export async function withChildAbortTimeout<T>(
  parentSignal: AbortSignal,
  attemptTimeoutMs: number,
  task: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (parentSignal.aborted) {
    throw new Error('AI request timed out');
  }

  const child = new AbortController();
  const onParentAbort = () => {
    child.abort(parentSignal.reason || new Error('Parent AI request aborted'));
  };
  parentSignal.addEventListener('abort', onParentAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Model attempt timed out after ${attemptTimeoutMs}ms`);
      child.abort(err);
      reject(err);
    }, attemptTimeoutMs);
  });

  try {
    return await Promise.race([task(child.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Normalizes Buddhist Era (พ.ศ. >= 2400) and ambiguous expiry strings to standard CE YYYY-MM-DD.
 */
export function normalizeServerExpDateToIso(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '-' || /^no\s*exp$/i.test(trimmed) || trimmed.includes('ไม่มี')) {
    return trimmed === '-' ? '-' : '';
  }

  const normalizeYear = (y: number): number => {
    if (y >= 2400) return y - 543;
    if (y >= 65 && y < 100) return 2500 + y - 543;
    if (y < 100) return 2000 + y;
    return y;
  };

  // YYYY-MM-DD (handles พ.ศ. e.g. 2570-08-01 -> 2027-08-01)
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = normalizeYear(parseInt(isoMatch[1], 10));
    const m = Math.min(12, Math.max(1, parseInt(isoMatch[2], 10)));
    const d = Math.min(31, Math.max(1, parseInt(isoMatch[3], 10)));
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD/MM/YY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const d = Math.min(31, Math.max(1, parseInt(dmyMatch[1], 10)));
    const m = Math.min(12, Math.max(1, parseInt(dmyMatch[2], 10)));
    const y = normalizeYear(parseInt(dmyMatch[3], 10));
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // MM/YYYY or MM/YY -> YYYY-MM-01
  const myMatch = trimmed.match(/^(?:exp\.?\s*)?(\d{1,2})[-/.](\d{2,4})$/i);
  if (myMatch) {
    const m = Math.min(12, Math.max(1, parseInt(myMatch[1], 10)));
    const y = normalizeYear(parseInt(myMatch[2], 10));
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }

  // YYYY-MM or YYYY/MM -> YYYY-MM-01
  const ymMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ymMatch) {
    const y = normalizeYear(parseInt(ymMatch[1], 10));
    const m = Math.min(12, Math.max(1, parseInt(ymMatch[2], 10)));
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }

  // English Month names e.g. "EXP AUG 2027" or "JAN 27"
  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const textMonthMatch = trimmed.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/-]*(\d{2,4})/);
  if (textMonthMatch) {
    const m = monthNames[textMonthMatch[1]];
    const y = normalizeYear(parseInt(textMonthMatch[2], 10));
    if (m) return `${y}-${String(m).padStart(2, '0')}-01`;
  }

  return trimmed;
}
