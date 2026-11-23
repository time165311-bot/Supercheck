import crypto from 'crypto';
import type express from 'express';
import { adminAuth, ROOT_DIR } from '../lib/firebaseServer';

const SESSION_SECRET =
  process.env.APP_API_SECRET ||
  process.env.GEMINI_API_KEY ||
  crypto.createHash('sha256').update(`${ROOT_DIR}:anesthesia-care-session`).digest('hex');

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createApiSessionToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = {
    sub: 'anesthesia-care-client',
    iat: Date.now(),
    exp: expiresAt,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

export function verifyApiSessionToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return false;
  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    const a = Buffer.from(providedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof payload?.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) return;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  });
  return out;
}

export async function requireApiAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 1. Machine-to-machine HIS / FHIR API key check
  const configuredApiKey = (process.env.FHIR_API_KEY || '').trim();
  const providedApiKey = String(req.headers['x-api-key'] || '').trim();
  if (configuredApiKey && providedApiKey && providedApiKey === configuredApiKey) {
    return next();
  }

  // 2. Bearer token check (HMAC session token or Firebase ID token)
  const authHeader = String(req.headers.authorization || '');
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim();
  if (bearerToken) {
    if (verifyApiSessionToken(bearerToken)) {
      return next();
    }
    if (adminAuth) {
      try {
        await adminAuth.verifyIdToken(bearerToken);
        return next();
      } catch {
        // Fall through to cookie check / 401
      }
    }
  }

  // 3. Same-origin HttpOnly session cookie check
  const cookies = parseCookies(req.headers.cookie);
  if (verifyApiSessionToken(cookies.ac_session)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'UNAUTHORIZED',
    message: 'ต้องยืนยันตัวตนก่อนใช้งาน API (Authentication required)',
  });
}
