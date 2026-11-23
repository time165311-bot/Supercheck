import { authorizedFetch } from './aiService';

export interface PendingAttachmentItem {
  id?: string;
  index?: number;
  base64: string;
  mimeType: string;
  fileName?: string;
  dataUrl?: string;
}

export interface AuraPendingPhotoUploadMetadata {
  sessionId: string;
  timestamp: number;
  query: string;
  totalImages: number;
  completedBatches: number;
  totalBatches: number;
  completedCount: number;
  collectedMappings: any[];
  itemsMeta: Array<{
    index: number;
    fileName?: string;
    completed: boolean;
  }>;
}

export interface AuraPendingPhotoFullSession extends AuraPendingPhotoUploadMetadata {
  attachments: PendingAttachmentItem[];
}

export const AURA_PENDING_STORAGE_KEY = 'aura_pending_photo_upload';
const DB_NAME = 'anesthesia_aura_upload_db';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

function openUploadDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingPhotoSession(
  metadata: AuraPendingPhotoUploadMetadata,
  attachments: PendingAttachmentItem[]
): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AURA_PENDING_STORAGE_KEY, JSON.stringify(metadata));
    }

    const db = await openUploadDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: 'current_pending_upload',
        ...metadata,
        attachments,
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[aiVision] Error saving pending upload session:', err);
  }
}

export function getPendingPhotoMetadata(): AuraPendingPhotoUploadMetadata | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(AURA_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.totalImages || !parsed.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getFullPendingPhotoSession(): Promise<AuraPendingPhotoFullSession | null> {
  const meta = getPendingPhotoMetadata();
  if (!meta) return null;

  try {
    const db = await openUploadDb();
    return await new Promise<AuraPendingPhotoFullSession | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_pending_upload');
      req.onsuccess = () => {
        if (req.result && req.result.attachments) {
          resolve(req.result as AuraPendingPhotoFullSession);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[aiVision] Failed to read pending session from IndexedDB:', err);
    return null;
  }
}

export async function clearPendingPhotoSession(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AURA_PENDING_STORAGE_KEY);
    }
    const db = await openUploadDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete('current_pending_upload');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[aiVision] Error clearing pending session:', err);
  }
}

export async function executePhotoMatchBatchWithRetry(
  batchItems: PendingAttachmentItem[],
  startIndex: number,
  query: string,
  compactAppContext: any,
  requestContext: any,
  channelName: string,
  signal?: AbortSignal
): Promise<{
  success: boolean;
  mappings: any[];
  error?: string;
}> {
  const timeoutMs = Math.max(15000, batchItems.length * 15000);
  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastError = '';

  while (attempt <= MAX_RETRIES) {
    if (signal?.aborted) {
      return { success: false, mappings: [], error: 'Canceled by user' };
    }

    attempt++;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort('TIMEOUT'), timeoutMs);

    try {
      const response = await authorizedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          channelName: channelName || 'คลินิกวิสัญญี (Master)',
          liveContext: requestContext,
          context: requestContext,
          appContext: compactAppContext,
          attachments: batchItems.map((att, relIdx) => ({
            index: startIndex + relIdx,
            base64: att.base64,
            mimeType: att.mimeType,
            fileName: att.fileName,
          })),
        }),
      });

      clearTimeout(timeoutTimer);

      if (response.ok) {
        const data = await response.json();
        const mappings = Array.isArray(data.action?.mappings)
          ? data.action.mappings
          : [];
        return { success: true, mappings };
      } else {
        lastError = `Server returned status ${response.status}`;
        console.warn(`[executePhotoMatchBatch] Attempt ${attempt} failed with status ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout = err?.name === 'AbortError' || String(err).includes('TIMEOUT');
      lastError = isTimeout ? 'Timeout 15 วินาทีต่อรูป' : (err?.message || 'Network error');
      console.warn(`[executePhotoMatchBatch] Attempt ${attempt} failed: ${lastError}`);
    }

    if (attempt <= MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  const fallbackMappings = batchItems.map((_, relIdx) => ({
    imageIndex: startIndex + relIdx,
    unmatched: true,
    reason: `การประมวลผลหมดเวลาหรือไม่สำเร็จ (${lastError})`,
  }));

  return {
    success: false,
    mappings: fallbackMappings,
    error: lastError,
  };
}
