export const DEFAULT_WARD_ID = 'ANES-MASTER';
export const WARD_STORAGE_KEY = 'anesthesia_ward_id';
export const KNOWN_WARDS_STORAGE_KEY = 'anesthesia_ward_codes';
export const WARD_PIN_UNLOCK_PREFIX = 'anesthesia_ward_pin_unlock_';

/**
 * Normalizes any raw ward code or legacy channel ID into a strict Firestore-safe ward ID.
 * Maps empty or legacy 'channel_master' directly to 'ANES-MASTER'.
 */
export function sanitizeWardCode(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'channel_master' || trimmed.toUpperCase() === 'MASTER') {
    return DEFAULT_WARD_ID;
  }
  const normalized = trimmed
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 48);

  if (normalized.length < 2) {
    return DEFAULT_WARD_ID;
  }
  return normalized;
}

export function resolveWardId(raw?: string | null): string {
  return sanitizeWardCode(raw);
}

export function isValidWardCodeInput(raw?: string | null): boolean {
  const trimmed = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{2,48}$/.test(trimmed);
}

export function isDefaultWard(wardId?: string | null): boolean {
  return resolveWardId(wardId) === DEFAULT_WARD_ID;
}

export function getActiveWardIdFromStorage(): string {
  if (typeof window === 'undefined') return DEFAULT_WARD_ID;
  try {
    const saved =
      localStorage.getItem(WARD_STORAGE_KEY) ||
      localStorage.getItem('anesthesia_active_channel_id') ||
      localStorage.getItem('active_channel_id');
    return resolveWardId(saved);
  } catch {
    return DEFAULT_WARD_ID;
  }
}

export function saveActiveWardIdToStorage(wardId: string): string {
  const resolved = resolveWardId(wardId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WARD_STORAGE_KEY, resolved);
      localStorage.setItem('anesthesia_active_channel_id', resolved);
      localStorage.setItem('active_channel_id', resolved);
    } catch {
      // Ignore storage quota issues
    }
  }
  return resolved;
}

// --- 4-Digit Edit Protection PIN Hashing (SHA-256 via Web Crypto) ---

export function isValidFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(String(pin || '').trim());
}

export function generatePinSalt(): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic mixing when subtle crypto is unavailable in insecure HTTP contexts
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const cleanPin = String(pin || '').trim();
  const cleanSalt = String(salt || '').trim();
  return sha256Hex(`ac_ward_pin_v1:${cleanSalt}:${cleanPin}`);
}

export async function verifyPinHash(
  pin: string,
  salt: string | undefined,
  expectedHash: string | undefined
): Promise<boolean> {
  if (!expectedHash || !salt || !isValidFourDigitPin(pin)) return false;
  const computed = await hashPinWithSalt(pin, salt);
  return computed === expectedHash;
}

export function isWardSessionUnlocked(wardId: string, expectedPinHash?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!expectedPinHash) return true;
  try {
    return sessionStorage.getItem(`${WARD_PIN_UNLOCK_PREFIX}${resolveWardId(wardId)}`) === expectedPinHash;
  } catch {
    return false;
  }
}

export function setWardSessionUnlocked(wardId: string, pinHash: string | null): void {
  if (typeof window === 'undefined') return;
  const key = `${WARD_PIN_UNLOCK_PREFIX}${resolveWardId(wardId)}`;
  try {
    if (pinHash) {
      sessionStorage.setItem(key, pinHash);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}
