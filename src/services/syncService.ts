import QRCode from 'qrcode';
import { STORAGE_KEYS, getStored, setStored, getStoredString, setStoredString } from './storage';
import { User, EquipmentItem, ListConfig, ThemeMode, AuditLogEntry, DrugItem, InspectionHistoryRecord } from '../types';

export interface AppSyncData {
  apiUrl?: string;
  sheetUrl?: string;
  dmLink?: string;
  theme?: ThemeMode;
  users?: User[];
  equipment?: Record<string, EquipmentItem[]>;
  lists?: Record<'bag' | 'cart', ListConfig>;
  drugs?: DrugItem[];
  globalChecks?: Record<string, Record<string, { result: 'ปกติ' | 'ผิดปกติ' | ''; note?: string }>>;
  lastSubmitted?: Record<string, string>;
  inspectionHistory?: InspectionHistoryRecord[];
  auditLogs?: AuditLogEntry[];
  inspectorName?: string;
  lastSyncedAt?: string;
}

/**
 * Fetch synchronization data from backend server
 */
export async function fetchServerSync(): Promise<AppSyncData | null> {
  try {
    const res = await fetch('/api/sync', {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('Sync server returned HTTP status:', res.status);
      return null;
    }
    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data as AppSyncData;
    }
  } catch (err) {
    console.warn('Could not connect to /api/sync (offline or fallback mode):', err);
  }
  return null;
}

/**
 * Push local synchronization data to backend server
 */
export async function pushServerSync(partialData: Partial<AppSyncData>): Promise<boolean> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(partialData),
    });
    if (res.ok) {
      const json = await res.json();
      return json && json.success;
    }
  } catch (err) {
    console.warn('Failed to push sync to /api/sync:', err);
  }
  return false;
}

/**
 * Parse compact sync payload from current URL query string (?sync=...)
 * Allows instant 1-tap or QR code synchronization on mobile
 */
export function checkUrlSyncPayload(): Partial<AppSyncData> | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const syncParam = params.get('sync');
    if (!syncParam) return null;

    let decoded = '';
    try {
      decoded = decodeURIComponent(atob(syncParam));
    } catch {
      decoded = atob(syncParam);
    }

    const payload = JSON.parse(decoded);
    if (payload && (payload.apiUrl || payload.sheetUrl)) {
      // Remove query param cleanly without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('sync');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      return payload;
    }
  } catch (e) {
    console.warn('Failed to parse URL sync payload:', e);
  }
  return null;
}

/**
 * Create shareable sync link with encoded settings
 */
export function createShareableSyncUrl(apiUrl: string, sheetUrl: string): string {
  const payload = {
    apiUrl: apiUrl.trim(),
    sheetUrl: sheetUrl.trim(),
    t: Date.now(),
  };
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  const url = new URL(window.location.href);
  url.searchParams.set('sync', encoded);
  return url.toString();
}

/**
 * Generate a QR Code as Data URL for phone camera scanning
 */
export async function generateQrCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}
