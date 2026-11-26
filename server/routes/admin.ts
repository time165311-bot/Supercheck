import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { adminAuth, ROOT_DIR } from '../lib/firebaseServer';

export interface WardPermissionLocksServer {
  lockStaffDeleteItems: boolean;
  lockStaffEditStructure: boolean;
  lockGoogleSheetsExport: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface AdminStateStore {
  passcodeSalt?: string;
  passcodeHash?: string;
  updatedAt?: string;
  wardLocks: Record<string, WardPermissionLocksServer>;
}

const DEFAULT_LOCKS: Omit<WardPermissionLocksServer, 'updatedAt' | 'updatedBy'> = {
  lockStaffDeleteItems: true,
  lockStaffEditStructure: false,
  lockGoogleSheetsExport: false,
};

const DATA_DIR = path.resolve(ROOT_DIR, '.data');
const STATE_FILE = path.join(DATA_DIR, 'admin-state.json');

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');
const ADMIN_TOKEN_SECRET =
  process.env.APP_API_SECRET ||
  process.env.GEMINI_API_KEY ||
  EPHEMERAL_SECRET;

const ADMIN_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours in memory only
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;
const BOOTSTRAPPED_OWNER_EMAIL = 'time165311@gmail.com';
const WARD_ID_RE = /^[a-zA-Z0-9_-]{2,48}$/;
const SIX_DIGITS_RE = /^\d{6}$/;

const failedAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function readAdminState(): AdminStateStore {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { wardLocks: {} };
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      passcodeSalt: typeof parsed?.passcodeSalt === 'string' ? parsed.passcodeSalt : undefined,
      passcodeHash: typeof parsed?.passcodeHash === 'string' ? parsed.passcodeHash : undefined,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : undefined,
      wardLocks: parsed?.wardLocks && typeof parsed.wardLocks === 'object' ? parsed.wardLocks : {},
    };
  } catch (err) {
    console.warn('[AdminRoute] Failed to read admin-state.json:', err);
    return { wardLocks: {} };
  }
}

function writeAdminState(state: AdminStateStore): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STATE_FILE);
}

function hashPasscode(passcode: string, salt?: string): { salt: string; hash: string } {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, effectiveSalt, 64).toString('hex');
  return { salt: effectiveSalt, hash: derived };
}

function timingSafeHexEquals(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getPasscodeConfigStatus(state: AdminStateStore): {
  configured: boolean;
  source: 'stored' | 'env' | 'unconfigured';
} {
  if (state.passcodeHash && state.passcodeSalt) {
    return { configured: true, source: 'stored' };
  }
  const envCode = (process.env.ADMIN_MASTER_PASSCODE || '').trim();
  if (SIX_DIGITS_RE.test(envCode)) {
    return { configured: true, source: 'env' };
  }
  return { configured: false, source: 'unconfigured' };
}

function verifyPasscodeAgainstState(passcode: string, state: AdminStateStore): boolean {
  if (!SIX_DIGITS_RE.test(passcode)) return false;

  if (state.passcodeHash && state.passcodeSalt) {
    const { hash } = hashPasscode(passcode, state.passcodeSalt);
    return timingSafeHexEquals(hash, state.passcodeHash);
  }

  const envCode = (process.env.ADMIN_MASTER_PASSCODE || '').trim();
  if (SIX_DIGITS_RE.test(envCode)) {
    const providedDigest = crypto.createHash('sha256').update(passcode).digest('hex');
    const envDigest = crypto.createHash('sha256').update(envCode).digest('hex');
    return timingSafeHexEquals(providedDigest, envDigest);
  }

  return false;
}

function createSuperAdminToken(): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + ADMIN_TOKEN_TTL_MS;
  const payload = {
    purpose: 'super_admin',
    jti: crypto.randomBytes(12).toString('hex'),
    iat: now,
    exp: expiresAt,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadB64).digest('base64url');
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

function verifySuperAdminToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return false;
  try {
    const expectedSig = crypto
      .createHmac('sha256', ADMIN_TOKEN_SECRET)
      .update(payloadB64)
      .digest('base64url');
    const a = Buffer.from(providedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return (
      payload?.purpose === 'super_admin' &&
      typeof payload?.exp === 'number' &&
      payload.exp > Date.now()
    );
  } catch {
    return false;
  }
}

async function requireSuperAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.method === 'OPTIONS') return next();

  const authHeader = String(req.headers.authorization || '');
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim();

  if (bearerToken) {
    if (verifySuperAdminToken(bearerToken)) {
      return next();
    }
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(bearerToken);
        if (
          decoded?.email_verified === true &&
          String(decoded?.email || '').toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL
        ) {
          return next();
        }
      } catch {
        // Fall through to 401
      }
    }
  }

  return res.status(401).json({
    success: false,
    error: 'SUPER_ADMIN_UNAUTHORIZED',
    message: 'ต้องปลดล็อกสิทธิ์ผู้ดูแลระบบก่อนดำเนินการ',
  });
}

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ip);
  if (!entry) return { blocked: false, retryAfterSec: 0 };
  if (now > entry.resetAt) {
    failedAttemptsByIp.delete(ip);
    return { blocked: false, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordFailedAttempt(ip: string): { blocked: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const prev = failedAttemptsByIp.get(ip);
  const entry =
    prev && now <= prev.resetAt
      ? { count: prev.count + 1, resetAt: prev.resetAt }
      : { count: 1, resetAt: now + LOCKOUT_WINDOW_MS };
  failedAttemptsByIp.set(ip, entry);
  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - entry.count);
  return {
    blocked: entry.count >= MAX_FAILED_ATTEMPTS,
    remaining,
    retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function createAdminRouter(): express.Router {
  const router = express.Router();

  // Check whether 6-digit Master Admin Passcode has been configured
  router.get('/status', (_req, res) => {
    const state = readAdminState();
    const status = getPasscodeConfigStatus(state);
    res.json({
      success: true,
      configured: status.configured,
      source: status.source,
    });
  });

  // One-time initial setup when unconfigured
  router.post('/setup', (req, res) => {
    const state = readAdminState();
    const status = getPasscodeConfigStatus(state);
    if (status.configured) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_CONFIGURED',
        message: 'รหัสผ่าน Master ถูกตั้งค่าไว้แล้ว กรุณาปลดล็อกเพื่อเปลี่ยนรหัส',
      });
    }

    const passcode = String(req.body?.passcode || '').trim();
    if (!SIX_DIGITS_RE.test(passcode)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PASSCODE_FORMAT',
        message: 'กรุณากรอกรหัสผ่านตัวเลข 6 หลักเท่านั้น',
      });
    }

    const { salt, hash } = hashPasscode(passcode);
    const nextState: AdminStateStore = {
      ...state,
      passcodeSalt: salt,
      passcodeHash: hash,
      updatedAt: new Date().toISOString(),
    };
    writeAdminState(nextState);

    const { token, expiresAt } = createSuperAdminToken();
    return res.status(201).json({
      success: true,
      token,
      expiresAt,
      message: 'ตั้งรหัสผ่านผู้ดูแลระบบ 6 หลักสำเร็จ',
    });
  });

  // Verify 6-digit Master Passcode (rate-limited, timing-safe)
  router.post('/verify', (req, res) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip);
    if (rl.blocked) {
      return res.status(429).json({
        success: false,
        error: 'TOO_MANY_ATTEMPTS',
        retryAfterSec: rl.retryAfterSec,
        message: `ลองผิดเกินกำหนด กรุณารอ ${rl.retryAfterSec} วินาทีแล้วลองใหม่`,
      });
    }

    const state = readAdminState();
    const status = getPasscodeConfigStatus(state);
    if (!status.configured) {
      return res.status(400).json({
        success: false,
        error: 'NOT_CONFIGURED',
        message: 'ยังไม่ได้ตั้งค่ารหัสผ่านผู้ดูแลระบบ 6 หลัก',
      });
    }

    const passcode = String(req.body?.passcode || '').trim();
    if (!SIX_DIGITS_RE.test(passcode)) {
      const fail = recordFailedAttempt(ip);
      return res.status(400).json({
        success: false,
        error: 'INVALID_PASSCODE_FORMAT',
        remainingAttempts: fail.remaining,
        message: 'รหัสผ่านต้องเป็นตัวเลข 6 หลัก',
      });
    }

    if (!verifyPasscodeAgainstState(passcode, state)) {
      const fail = recordFailedAttempt(ip);
      return res.status(fail.blocked ? 429 : 401).json({
        success: false,
        error: fail.blocked ? 'TOO_MANY_ATTEMPTS' : 'INVALID_PASSCODE',
        remainingAttempts: fail.remaining,
        retryAfterSec: fail.blocked ? fail.retryAfterSec : undefined,
        message: fail.blocked
          ? `กรอกรหัสผิดครบ 5 ครั้ง กรุณารอ ${fail.retryAfterSec} วินาที`
          : `รหัสผ่าน 6 หลักไม่ถูกต้อง (เหลือโอกาส ${fail.remaining} ครั้ง)`,
      });
    }

    failedAttemptsByIp.delete(ip);
    const { token, expiresAt } = createSuperAdminToken();
    return res.json({
      success: true,
      token,
      expiresAt,
    });
  });

  // Change 6-digit Master Passcode (requires active Super Admin token or verified Owner Google token)
  router.post('/change-passcode', requireSuperAdmin, (req, res) => {
    const state = readAdminState();
    const newPasscode = String(req.body?.newPasscode || '').trim();
    const currentPasscode =
      typeof req.body?.currentPasscode === 'string' ? req.body.currentPasscode.trim() : '';

    if (!SIX_DIGITS_RE.test(newPasscode)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PASSCODE_FORMAT',
        message: 'รหัสผ่านใหม่ต้องเป็นตัวเลข 6 หลัก',
      });
    }

    if (currentPasscode && getPasscodeConfigStatus(state).configured) {
      if (!verifyPasscodeAgainstState(currentPasscode, state)) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_CURRENT_PASSCODE',
          message: 'รหัสผ่านเดิมไม่ถูกต้อง',
        });
      }
    }

    const { salt, hash } = hashPasscode(newPasscode);
    const nextState: AdminStateStore = {
      ...state,
      passcodeSalt: salt,
      passcodeHash: hash,
      updatedAt: new Date().toISOString(),
    };
    writeAdminState(nextState);

    const { token, expiresAt } = createSuperAdminToken();
    return res.json({
      success: true,
      token,
      expiresAt,
      message: 'เปลี่ยนรหัสผ่าน Master 6 หลักสำเร็จ',
    });
  });

  // Read ward permission locks (server mirror so non-Google devices stay consistent)
  router.get('/locks/:wardId', (req, res) => {
    const wardId = String(req.params.wardId || '').trim().toUpperCase();
    if (!WARD_ID_RE.test(wardId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WARD_ID',
        message: 'รหัสห้องวอร์ดไม่ถูกต้อง',
      });
    }

    const state = readAdminState();
    const existing = state.wardLocks?.[wardId];
    return res.json({
      success: true,
      wardId,
      locks: existing || {
        ...DEFAULT_LOCKS,
        updatedAt: '',
        updatedBy: 'system_default',
      },
    });
  });

  // Update ward permission locks (Super Admin / Owner only)
  router.put('/locks/:wardId', requireSuperAdmin, (req, res) => {
    const wardId = String(req.params.wardId || '').trim().toUpperCase();
    if (!WARD_ID_RE.test(wardId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WARD_ID',
        message: 'รหัสห้องวอร์ดไม่ถูกต้อง',
      });
    }

    const state = readAdminState();
    const prev = state.wardLocks?.[wardId] || {
      ...DEFAULT_LOCKS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    const nextLocks: WardPermissionLocksServer = {
      lockStaffDeleteItems:
        typeof req.body?.lockStaffDeleteItems === 'boolean'
          ? req.body.lockStaffDeleteItems
          : prev.lockStaffDeleteItems,
      lockStaffEditStructure:
        typeof req.body?.lockStaffEditStructure === 'boolean'
          ? req.body.lockStaffEditStructure
          : prev.lockStaffEditStructure,
      lockGoogleSheetsExport:
        typeof req.body?.lockGoogleSheetsExport === 'boolean'
          ? req.body.lockGoogleSheetsExport
          : prev.lockGoogleSheetsExport,
      updatedAt: new Date().toISOString(),
      updatedBy: String(req.body?.updatedBy || 'Admin').slice(0, 120),
    };

    const nextState: AdminStateStore = {
      ...state,
      wardLocks: {
        ...(state.wardLocks || {}),
        [wardId]: nextLocks,
      },
    };
    writeAdminState(nextState);

    return res.json({
      success: true,
      wardId,
      locks: nextLocks,
    });
  });

  return router;
}
