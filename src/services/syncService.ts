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
 * Legacy Server Sync retired in favor of Firebase Firestore as Single Source of Truth
 */
export async function fetchServerSync(): Promise<AppSyncData | null> {
  return null;
}

export async function pushServerSync(_partialData: Partial<AppSyncData>): Promise<boolean> {
  return true;
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
