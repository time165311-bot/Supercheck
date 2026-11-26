import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  User,
  HaAuditLogEntry,
  InspectionHistoryRecord,
  EquipmentItem,
  DrugItem,
  WardChannel,
  WardPermissionLocks,
  TrashItemRecord,
  WardAiMemoryItem,
} from '../types';
import {
  DEFAULT_WARD_ID,
  getActiveWardIdFromStorage,
  resolveWardId,
} from '../utils/wardUtils';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with browserLocalPersistence (optional / admin sign-in; never required for Shared Ward sync)
export const auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch {
  // Ignore persistence fallback errors in restricted iframes
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGooglePopup(): Promise<FirebaseAuthUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

// Initialize Firestore targeting the provisioned database ID with multi-tab IndexedDB offline persistence
// Using experimentalForceLongPolling to resolve restricted iframe proxy connectivity
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const storage = getStorage(app);

export interface CloudConnectivityResult {
  ok: boolean;
  status: 'online' | 'needs_auth' | 'offline' | 'error';
  msg: string;
  latencyMs?: number;
}

/**
 * Tests real connectivity to Cloud Firestore for the active Shared Ward Workspace.
 * Works seamlessly across Desktop, Mobile, and Incognito without requiring Google sign-in.
 */
export async function testCloudConnectivity(
  wardId?: string
): Promise<CloudConnectivityResult> {
  const start = Date.now();
  const resolvedWard = resolveWardId(wardId || getActiveWardIdFromStorage());

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      status: 'offline',
      msg: 'อุปกรณ์ไม่ได้เชื่อมต่ออินเทอร์เน็ต (Offline)',
    };
  }

  try {
    await getDocFromServer(doc(db, 'wards', resolvedWard));
    return {
      ok: true,
      status: 'online',
      msg: `เชื่อมต่อห้องวอร์ดกลาง ${resolvedWard} บน Firebase Cloud สำเร็จ (Real-time)`,
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    const errMsg = String(error?.message || error || '');
    if (
      errMsg.includes('offline') ||
      errMsg.includes('Could not reach Cloud Firestore') ||
      errMsg.includes('Failed to get document')
    ) {
      return {
        ok: false,
        status: 'offline',
        msg: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Firestore ได้ในขณะนี้ (Offline)',
      };
    }
    if (
      errMsg.includes('permission') ||
      errMsg.includes('Missing or insufficient permissions')
    ) {
      return {
        ok: false,
        status: 'error',
        msg: `สิทธิ์การเข้าถึงห้องวอร์ด ${resolvedWard} ถูกปฏิเสธ กรุณาตรวจสอบรหัสห้องวอร์ด`,
      };
    }
    return {
      ok: false,
      status: 'error',
      msg: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${errMsg}`,
    };
  }
}

/**
 * Validates connection to Firestore on boot using getDocFromServer as required.
 */
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'wards', DEFAULT_WARD_ID));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('offline') || errMsg.includes("Backend didn't respond")) {
      console.warn('Firestore is starting in offline mode. Connectivity issues detected.');
    }
  }
}
void testFirestoreConnection();

// Auth readiness promise resolving on initial Firebase Auth state resolution
export const authReadyPromise: Promise<FirebaseAuthUser | null> = new Promise((resolve) => {
  const unsub = onAuthStateChanged(
    auth,
    (user) => {
      unsub();
      resolve(user);
    },
    () => {
      resolve(null);
    }
  );
});

// Standardized Firestore Error Handling as per Firebase integration guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: Array<{
      providerId?: string | null;
      displayName?: string | null;
      email?: string | null;
      photoUrl?: string | null;
    }>;
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline =
    errMsg.includes('offline') ||
    errMsg.includes('Failed to get document because the client is offline') ||
    errMsg.includes('Could not reach Cloud Firestore backend') ||
    errMsg.includes('securetoken.googleapis.com') ||
    errMsg.includes('token-service-api') ||
    errMsg.includes('Fetching auth token failed');

  const errInfo: FirestoreErrorInfo = {
    error: isOffline ? 'Firestore is currently in offline mode' : errMsg,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo: (auth.currentUser?.providerData || []).map((provider) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })),
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (!isOffline) {
    throw new Error(JSON.stringify(errInfo));
  }
}

/**
 * Recursively removes all `undefined` values and functions from an object or array,
 * preventing Firestore fatal errors such as:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (typeof data === 'number' && Number.isNaN(data)) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined && typeof item !== 'function')
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data;
    }
    const cleanObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined && typeof val !== 'function') {
        cleanObj[key] = sanitizeForFirestore(val);
      }
    }
    return cleanObj as T;
  }
  return data;
}

const EQUIPMENT_ALLOWED_KEYS = new Set([
  'id', 'name', 'code', 'sap', 'spec', 'source', 'date', 'qty', 'tax', 'price',
  'location', 'img', 'no', 'exp', 'note', 'type', 'category', 'groupName', 'roomId',
  'barcode', 'serialNumber', 'subExps', 'subItemQuantities', 'checkType',
  'subItems', 'unitText', 'initialQtyText', 'channelId', 'wardId',
  'orderNumber', 'assetCode', 'sapCode', 'brandModel', 'status', 'isMarked', 'updatedAt',
]);

const DRUG_ALLOWED_KEYS = new Set([
  'id', 'category', 'name', 'remaining', 'totalQty', 'receivedDate',
  'receivedQty', 'minStock', 'batchRequest', 'unit', 'expDate', 'exp',
  'lotNumber', 'lots', 'batches', 'tmtCode', 'hospitalDrugCode',
  'spec', 'note', 'img', 'barcode', 'channelId', 'wardId', 'updatedAt',
]);

const USER_ALLOWED_KEYS = new Set([
  'id', 'uid', 'email', 'username', 'name', 'role', 'position', 'signature',
  'active', 'must', 'created', 'last', 'avatar', 'ringColor',
]);

const WARD_ALLOWED_KEYS = new Set([
  'id', 'name', 'lists', 'globalChecks', 'emergencyWeekDates',
  'deletedItemIds', 'drugsCleared', 'equipmentCleared',
  'bagCleared', 'cartCleared', 'ambulanceCleared',
  'equipmentSeeded', 'drugsSeeded', 'migratedFromLegacy',
  'pinEnabled', 'pinHash', 'pinSalt', 'sheetUrl', 'apiUrl', 'updatedAt',
]);

function normalizeFirestoreDocId(rawId: string, prefix: string): string {
  const safe = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return safe || `${prefix}_${Date.now()}`;
}

function isValidFirestoreDocId(id?: string): boolean {
  return Boolean(id && /^[a-zA-Z0-9_-]{1,128}$/.test(id));
}

export function sanitizeEquipmentForFirestore(
  item: EquipmentItem,
  fallbackId?: string,
  wardIdOverride?: string
): Record<string, any> {
  const resolvedWard = resolveWardId(wardIdOverride || (item as any).wardId || (item as any).channelId);
  const safeId = normalizeFirestoreDocId(
    item.id || fallbackId || `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    'eq'
  );
  const out: Record<string, any> = {
    id: safeId,
    wardId: resolvedWard,
    name: String(item.name || 'รายการครุภัณฑ์').trim().slice(0, 300) || 'รายการครุภัณฑ์',
    updatedAt: new Date().toISOString(),
  };
  for (const key of EQUIPMENT_ALLOWED_KEYS) {
    if (key === 'id' || key === 'name' || key === 'wardId' || key === 'updatedAt') continue;
    const val = (item as any)[key];
    if (val === undefined || typeof val === 'function') continue;
    if (key === 'price' && val !== null) {
      out.price = String(val).slice(0, 50);
    } else if (key === 'isMarked') {
      out.isMarked = Boolean(val);
    } else if ((key === 'subItems' || key === 'subItemQuantities' || key === 'subExps') && Array.isArray(val)) {
      out[key] = val.slice(0, 100);
    } else if (key === 'img' && typeof val === 'string') {
      if (val.length <= 490000) out.img = val;
    } else if (val !== null && typeof val === 'number') {
      out[key] = String(val);
    } else {
      out[key] = val;
    }
  }
  return sanitizeForFirestore(out);
}

export function sanitizeDrugForFirestore(
  item: DrugItem,
  wardIdOverride?: string
): Record<string, any> {
  const resolvedWard = resolveWardId(wardIdOverride || (item as any).wardId || item.channelId);
  const safeId = normalizeFirestoreDocId(item.id || `drug_${Date.now()}`, 'drug');
  const cat =
    item.category === 'monthly' || item.category === 'quarterly' || item.category === 'adhoc'
      ? item.category
      : 'monthly';
  const out: Record<string, any> = {
    id: safeId,
    wardId: resolvedWard,
    name: String(item.name || 'รายการยา').trim().slice(0, 300) || 'รายการยา',
    category: cat,
    updatedAt: new Date().toISOString(),
  };
  for (const key of DRUG_ALLOWED_KEYS) {
    if (key === 'id' || key === 'name' || key === 'category' || key === 'wardId' || key === 'updatedAt') continue;
    const val = (item as any)[key];
    if (val === undefined || typeof val === 'function') continue;
    if ((key === 'remaining' || key === 'totalQty' || key === 'receivedQty' || key === 'minStock') && val !== null) {
      const n = Number(val);
      if (Number.isFinite(n)) out[key] = n;
    } else if ((key === 'lots' || key === 'batches') && Array.isArray(val)) {
      out[key] = val.slice(0, 100);
    } else if (key === 'img' && typeof val === 'string') {
      if (val.length <= 490000) out.img = val;
    } else {
      out[key] = val;
    }
  }
  return sanitizeForFirestore(out);
}

function sanitizeWardPatch(wardId: string, patch: Record<string, any>): Record<string, any> {
  const resolved = resolveWardId(wardId);
  const out: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  for (const [key, val] of Object.entries(patch || {})) {
    if (!WARD_ALLOWED_KEYS.has(key) || val === undefined || typeof val === 'function') continue;
    if (key === 'id') {
      out.id = resolved;
    } else if (key === 'deletedItemIds' && Array.isArray(val)) {
      out.deletedItemIds = val.slice(-500);
    } else if (key === 'name' && typeof val === 'string') {
      out.name = val.trim().slice(0, 150);
    } else {
      out[key] = val;
    }
  }
  return sanitizeForFirestore(out);
}

const wardInitInFlight = new Map<string, Promise<any | null>>();

/**
 * Ensures `wards/{wardId}` document exists before subcollection reads/writes (`wardExists` Master Gate).
 * When `ANES-MASTER` is brand new and an authenticated user is migrating from legacy collections,
 * performs a safe one-time migration so existing hospital data carries forward seamlessly.
 */
export async function ensureWardWorkspaceInitialized(
  wardId?: string,
  seedPayload?: Record<string, any>
): Promise<any | null> {
  const resolved = resolveWardId(wardId);
  if (wardInitInFlight.has(resolved)) {
    return wardInitInFlight.get(resolved)!;
  }

  const task = (async () => {
    const wardRef = doc(db, 'wards', resolved);
    try {
      let existingSnap;
      try {
        existingSnap = await getDocFromServer(wardRef);
      } catch {
        existingSnap = await getDoc(wardRef);
      }

      if (existingSnap.exists()) {
        return { id: resolved, ...existingSnap.data() };
      }

      // First-time setup for this ward workspace
      let initialWorkspace: Record<string, any> = {
        id: resolved,
        name:
          resolved === DEFAULT_WARD_ID
            ? 'ห้องวอร์ดกลาง (ANES-MASTER)'
            : seedPayload?.name || `ห้องวอร์ด ${resolved}`,
        lists: seedPayload?.lists || {},
        globalChecks: seedPayload?.globalChecks || {},
        emergencyWeekDates: seedPayload?.emergencyWeekDates || {},
        deletedItemIds: Array.isArray(seedPayload?.deletedItemIds)
          ? seedPayload.deletedItemIds.slice(-500)
          : [],
        updatedAt: new Date().toISOString(),
      };

      // Optional one-time legacy migration into ANES-MASTER when an authenticated user upgrades
      if (resolved === DEFAULT_WARD_ID && auth.currentUser) {
        try {
          const [legacyMasterSnap, legacyFlagsSnap, legacyEqSnap, legacyDrugsSnap, legacyHistorySnap] =
            await Promise.all([
              getDoc(doc(db, 'channels', 'channel_master')).catch(() => null),
              getDoc(doc(db, 'settings', 'app_state')).catch(() => null),
              getDocs(collection(db, 'equipment')).catch(() => null),
              getDocs(collection(db, 'drugs')).catch(() => null),
              getDocs(collection(db, 'inspection_records')).catch(() => null),
            ]);

          const legacyMaster = legacyMasterSnap?.exists() ? legacyMasterSnap.data() : null;
          const legacyFlags = legacyFlagsSnap?.exists() ? legacyFlagsSnap.data() : null;

          if (legacyMaster) {
            if (legacyMaster.lists && Object.keys(legacyMaster.lists).length > 0) {
              initialWorkspace.lists = legacyMaster.lists;
            }
            if (legacyMaster.globalChecks) {
              initialWorkspace.globalChecks = legacyMaster.globalChecks;
            }
            if (legacyMaster.emergencyWeekDates) {
              initialWorkspace.emergencyWeekDates = legacyMaster.emergencyWeekDates;
            }
            if (Array.isArray(legacyMaster.deletedItemIds)) {
              initialWorkspace.deletedItemIds = legacyMaster.deletedItemIds.slice(-500);
            }
          }
          if (legacyFlags) {
            if (typeof legacyFlags.drugsCleared === 'boolean') initialWorkspace.drugsCleared = legacyFlags.drugsCleared;
            if (typeof legacyFlags.equipmentCleared === 'boolean') initialWorkspace.equipmentCleared = legacyFlags.equipmentCleared;
            if (typeof legacyFlags.bagCleared === 'boolean') initialWorkspace.bagCleared = legacyFlags.bagCleared;
            if (typeof legacyFlags.cartCleared === 'boolean') initialWorkspace.cartCleared = legacyFlags.cartCleared;
          }

          const hasLegacyEq = Boolean(legacyEqSnap && !legacyEqSnap.empty);
          const hasLegacyDrugs = Boolean(legacyDrugsSnap && !legacyDrugsSnap.empty);
          const hasLegacyHistory = Boolean(legacyHistorySnap && !legacyHistorySnap.empty);

          if (legacyMaster || hasLegacyEq || hasLegacyDrugs || hasLegacyHistory) {
            initialWorkspace.migratedFromLegacy = true;
            if (hasLegacyEq) initialWorkspace.equipmentSeeded = true;
            if (hasLegacyDrugs) initialWorkspace.drugsSeeded = true;
          }

          const cleanInit = sanitizeWardPatch(resolved, { ...initialWorkspace, id: resolved });
          await setDoc(wardRef, cleanInit, { merge: true });

          if (hasLegacyEq && legacyEqSnap) {
            const docs = legacyEqSnap.docs;
            for (let i = 0; i < docs.length; i += 400) {
              const batch = writeBatch(db);
              docs.slice(i, i + 400).forEach((d) => {
                const payload = sanitizeEquipmentForFirestore(
                  { ...(d.data() as EquipmentItem), id: d.id },
                  d.id,
                  resolved
                );
                batch.set(doc(db, 'wards', resolved, 'equipment', payload.id), payload, { merge: true });
              });
              await batch.commit();
            }
          }

          if (hasLegacyDrugs && legacyDrugsSnap) {
            const docs = legacyDrugsSnap.docs;
            for (let i = 0; i < docs.length; i += 400) {
              const batch = writeBatch(db);
              docs.slice(i, i + 400).forEach((d) => {
                const payload = sanitizeDrugForFirestore(
                  { ...(d.data() as DrugItem), id: d.id },
                  resolved
                );
                batch.set(doc(db, 'wards', resolved, 'drugs', payload.id), payload, { merge: true });
              });
              await batch.commit();
            }
          }

          if (hasLegacyHistory && legacyHistorySnap) {
            const docs = legacyHistorySnap.docs.slice(0, 100);
            for (let i = 0; i < docs.length; i += 400) {
              const batch = writeBatch(db);
              docs.slice(i, i + 400).forEach((d) => {
                const rec = d.data() || {};
                const recId = normalizeFirestoreDocId(d.id, 'rec');
                batch.set(
                  doc(db, 'wards', resolved, 'inspection_records', recId),
                  sanitizeForFirestore({ ...rec, id: recId, wardId: resolved }),
                  { merge: true }
                );
              });
              await batch.commit();
            }
          }

          return cleanInit;
        } catch {
          // Proceed with clean ward initialization if legacy read is unavailable
        }
      }

      const cleanInit = sanitizeWardPatch(resolved, { ...initialWorkspace, id: resolved });
      await setDoc(wardRef, cleanInit, { merge: true });
      return cleanInit;
    } catch (err) {
      console.warn(`[firebase] ensureWardWorkspaceInitialized(${resolved}) warning:`, err);
      return null;
    } finally {
      wardInitInFlight.delete(resolved);
    }
  })();

  wardInitInFlight.set(resolved, task);
  return task;
}

/**
 * Updates fields on `wards/{wardId}` cleanly using updateDoc (replaces whole top-level map fields
 * like `lists` or `globalChecks` so deleted groups/keys never linger), falling back to setDoc if missing.
 */
export async function saveWardWorkspacePatchToFirebase(
  wardId: string,
  patch: Record<string, any>
): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}`;
  const wardRef = doc(db, 'wards', resolved);
  try {
    const patchKeys = sanitizeWardPatch(resolved, patch);
    delete patchKeys.id; // id is immutable on update
    if (Object.keys(patchKeys).length === 0) return true;

    try {
      await updateDoc(wardRef, patchKeys);
    } catch (err: any) {
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (code === 'not-found' || msg.includes('No document to update')) {
        const fullCreate = sanitizeWardPatch(resolved, { id: resolved, ...patch });
        await setDoc(wardRef, fullCreate, { merge: true });
      } else {
        throw err;
      }
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export function subscribeWardWorkspace(
  wardId: string,
  callback: (data: Record<string, any> | null, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void
): () => void {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}`;
  try {
    return onSnapshot(
      doc(db, 'wards', resolved),
      (snap) => {
        callback(
          snap.exists() ? ({ id: resolved, ...snap.data() } as Record<string, any>) : null,
          { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites }
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch {
    return () => {};
  }
}

export function subscribeWardEquipment(
  wardId: string,
  callback: (items: EquipmentItem[]) => void
): () => void {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/equipment`;
  try {
    const q = query(collection(db, 'wards', resolved, 'equipment'), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snap) => {
        const items: EquipmentItem[] = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id } as EquipmentItem));
        callback(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch {
    return () => {};
  }
}

export function subscribeWardDrugs(
  wardId: string,
  callback: (drugs: DrugItem[]) => void
): () => void {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/drugs`;
  try {
    const q = query(collection(db, 'wards', resolved, 'drugs'), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snap) => {
        const items: DrugItem[] = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id } as DrugItem));
        callback(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch {
    return () => {};
  }
}

export function subscribeWardInspectionHistory(
  wardId: string,
  callback: (records: InspectionHistoryRecord[]) => void
): () => void {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/inspection_records`;
  try {
    const q = query(
      collection(db, 'wards', resolved, 'inspection_records'),
      where('wardId', '==', resolved)
    );
    return onSnapshot(
      q,
      (snap) => {
        const records: InspectionHistoryRecord[] = [];
        snap.forEach((docSnap) => records.push({ ...docSnap.data(), id: docSnap.id } as InspectionHistoryRecord));
        records.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        callback(records.slice(0, 50));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch {
    return () => {};
  }
}

// --- SHARED WARD EQUIPMENT & DRUG HELPERS (Channel-compatible aliases -> wards/{wardId}/...) ---

export async function fetchChannelEquipmentFromFirebase(wardId: string): Promise<EquipmentItem[]> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/equipment`;
  try {
    const q = query(collection(db, 'wards', resolved, 'equipment'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    const items: EquipmentItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as EquipmentItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveChannelEquipmentItemToFirebase(wardId: string, item: EquipmentItem) {
  const resolved = resolveWardId(wardId);
  await ensureWardWorkspaceInitialized(resolved);
  const cleanPayload = sanitizeEquipmentForFirestore(item, undefined, resolved);
  const id = cleanPayload.id;
  const path = `wards/${resolved}/equipment/${id}`;
  try {
    await setDoc(doc(db, 'wards', resolved, 'equipment', id), cleanPayload, { merge: true });
    return { ...item, id };
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return null;
  }
}

export async function saveChannelBatchEquipmentToFirebase(
  wardId: string,
  items: EquipmentItem[]
): Promise<boolean> {
  if (!items || items.length === 0) return true;
  const resolved = resolveWardId(wardId);
  await ensureWardWorkspaceInitialized(resolved);
  const path = `wards/${resolved}/equipment`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item, idx) => {
        const fallbackId = `eq_${Date.now()}_${i + idx}`;
        const cleanPayload = sanitizeEquipmentForFirestore(item, fallbackId, resolved);
        const ref = doc(db, 'wards', resolved, 'equipment', cleanPayload.id);
        batch.set(ref, cleanPayload, { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function deleteChannelEquipmentItemInFirebase(wardId: string, id: string) {
  if (!isValidFirestoreDocId(id)) {
    return false;
  }
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/equipment/${id}`;
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'equipment', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteChannelEquipmentItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

export async function clearChannelEquipmentInFirebase(
  wardId: string,
  filterType: 'room' | 'bag' | 'cart' | 'ambulance' | 'all' = 'all'
): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/equipment`;
  try {
    const q = query(collection(db, 'wards', resolved, 'equipment'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    const docsToDelete = snap.docs.filter((d) => {
      if (filterType === 'all') return true;
      const data = d.data() || {};
      const t = String(data.type || 'room').toLowerCase();
      if (filterType === 'room') {
        return t !== 'bag' && t !== 'cart' && t !== 'ambulance';
      }
      return t === filterType;
    });
    for (let i = 0; i < docsToDelete.length; i += 400) {
      const batch = writeBatch(db);
      docsToDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

export async function fetchChannelDrugsFromFirebase(wardId: string): Promise<DrugItem[]> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/drugs`;
  try {
    const q = query(collection(db, 'wards', resolved, 'drugs'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    const items: DrugItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as DrugItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveChannelDrugItemToFirebase(wardId: string, item: DrugItem): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  await ensureWardWorkspaceInitialized(resolved);
  const cleanPayload = sanitizeDrugForFirestore(item, resolved);
  const path = `wards/${resolved}/drugs/${cleanPayload.id}`;
  try {
    await setDoc(doc(db, 'wards', resolved, 'drugs', cleanPayload.id), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function saveChannelBatchDrugsToFirebase(wardId: string, items: DrugItem[]): Promise<boolean> {
  if (!items || items.length === 0) return true;
  const resolved = resolveWardId(wardId);
  await ensureWardWorkspaceInitialized(resolved);
  const path = `wards/${resolved}/drugs`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item) => {
        const cleanPayload = sanitizeDrugForFirestore(item, resolved);
        const ref = doc(db, 'wards', resolved, 'drugs', cleanPayload.id);
        batch.set(ref, cleanPayload, { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Atomically saves multiple updated drugs, equipment/checklist items, and ward workspace patch
 * (lists / globalChecks) in a single Firestore writeBatch commit (chunked at 400 ops max per batch).
 */
export async function saveBatchWardUpdatesToFirebase(
  wardId: string,
  payload: {
    drugsToSave?: DrugItem[];
    equipmentToSave?: EquipmentItem[];
    wardPatch?: Record<string, any>;
  }
): Promise<{ ok: boolean; error?: string }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}`;
  try {
    const initialized = await ensureWardWorkspaceInitialized(resolved);
    if (!initialized) {
      return { ok: false, error: 'ไม่สามารถเตรียมพื้นที่เก็บข้อมูลห้องวอร์ดบน Firestore ได้' };
    }

    const drugsToSave = payload.drugsToSave || [];
    const equipmentToSave = payload.equipmentToSave || [];
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    drugsToSave.forEach((d) => {
      const cleanDrug = sanitizeDrugForFirestore(d, resolved);
      ops.push((batch) => {
        batch.set(doc(db, 'wards', resolved, 'drugs', cleanDrug.id), cleanDrug, { merge: true });
      });
    });

    equipmentToSave.forEach((eq, idx) => {
      const fallbackId = `eq_${Date.now()}_${idx}`;
      const cleanEq = sanitizeEquipmentForFirestore(eq, fallbackId, resolved);
      ops.push((batch) => {
        batch.set(doc(db, 'wards', resolved, 'equipment', cleanEq.id), cleanEq, { merge: true });
      });
    });

    if (payload.wardPatch && Object.keys(payload.wardPatch).length > 0) {
      const patchKeys = sanitizeWardPatch(resolved, payload.wardPatch);
      delete patchKeys.id;
      if (Object.keys(patchKeys).length > 0) {
        ops.push((batch) => {
          batch.update(doc(db, 'wards', resolved), patchKeys);
        });
      }
    }

    if (ops.length === 0) return { ok: true };

    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((applyOp) => applyOp(batch));
      await batch.commit();
    }

    return { ok: true };
  } catch (e: any) {
    console.warn(`[firebase] saveBatchWardUpdatesToFirebase(${path}) failed:`, e);
    return { ok: false, error: e?.message || 'เกิดข้อผิดพลาดในการบันทึกแบบกลุ่มลง Firestore' };
  }
}

export async function deleteChannelDrugItemInFirebase(wardId: string, id: string): Promise<boolean> {
  if (!isValidFirestoreDocId(id)) return false;
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/drugs/${id}`;
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'drugs', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteChannelDrugItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

export async function clearChannelDrugsInFirebase(wardId: string): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}/drugs`;
  try {
    const q = query(collection(db, 'wards', resolved, 'drugs'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// Default ward wrappers for backward compatibility
export async function fetchEquipmentFromFirebase(wardId?: string): Promise<EquipmentItem[]> {
  return fetchChannelEquipmentFromFirebase(resolveWardId(wardId));
}
export async function saveEquipmentItemToFirebase(item: EquipmentItem, wardId?: string) {
  return saveChannelEquipmentItemToFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), item);
}
export async function deleteEquipmentItemInFirebase(id: string, wardId?: string) {
  return deleteChannelEquipmentItemInFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), id);
}
export async function clearAllEquipmentInFirebase(
  filterType: 'room' | 'bag' | 'cart' | 'ambulance' | 'all' = 'all',
  wardId?: string
): Promise<boolean> {
  return clearChannelEquipmentInFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), filterType);
}
export async function fetchDrugsFromFirebase(wardId?: string): Promise<DrugItem[]> {
  return fetchChannelDrugsFromFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()));
}
export async function saveDrugItemToFirebase(item: DrugItem, wardId?: string) {
  return saveChannelDrugItemToFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), item);
}
export async function saveBatchDrugsToFirebase(items: DrugItem[], wardId?: string): Promise<boolean> {
  return saveChannelBatchDrugsToFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), items);
}
export async function deleteDrugItemInFirebase(id: string, wardId?: string): Promise<boolean> {
  return deleteChannelDrugItemInFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()), id);
}
export async function clearAllDrugsInFirebase(wardId?: string): Promise<boolean> {
  return clearChannelDrugsInFirebase(resolveWardId(wardId || getActiveWardIdFromStorage()));
}

export async function saveRestockRequisitionToFirebase(reqPayload: {
  id: string;
  channelId?: string;
  wardId?: string;
  targetCategory?: string;
  requestedBy?: string;
  status?: string;
  notes?: string;
  items: any[];
  createdAt: string;
}): Promise<boolean> {
  const resolved = resolveWardId(reqPayload.wardId || reqPayload.channelId || getActiveWardIdFromStorage());
  await ensureWardWorkspaceInitialized(resolved);
  const reqId = normalizeFirestoreDocId(reqPayload.id || `req_${Date.now()}`, 'req');
  const path = `wards/${resolved}/restock_requisitions/${reqId}`;
  try {
    const cleanPayload = sanitizeForFirestore({
      ...reqPayload,
      id: reqId,
      wardId: resolved,
      channelId: resolved,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'wards', resolved, 'restock_requisitions', reqId), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// --- INSPECTION RECORD HELPERS ---

export async function saveInspectionToFirebase(
  record: InspectionHistoryRecord,
  wardId?: string
) {
  const resolved = resolveWardId(wardId || (record as any).wardId || (record as any).channelId || getActiveWardIdFromStorage());
  await ensureWardWorkspaceInitialized(resolved);
  const recId = normalizeFirestoreDocId(record.id || `rec_${Date.now()}`, 'rec');
  const path = `wards/${resolved}/inspection_records/${recId}`;
  try {
    const cleanPayload = sanitizeForFirestore({
      ...record,
      id: recId,
      wardId: resolved,
      channelId: resolved,
    });
    await setDoc(doc(db, 'wards', resolved, 'inspection_records', recId), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function subscribeInspectionHistory(
  callback: (records: InspectionHistoryRecord[]) => void,
  wardId?: string
) {
  return subscribeWardInspectionHistory(resolveWardId(wardId || getActiveWardIdFromStorage()), callback);
}

export async function deleteInspectionFromFirebase(id: string, wardId?: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(id)) return false;
  const path = `wards/${resolved}/inspection_records/${id}`;
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'inspection_records', id));
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

export async function deleteBatchInspectionsFromFirebase(ids: string[], wardId?: string): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}/inspection_records`;
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      ids.slice(i, i + 400).forEach((id) => {
        if (id && isValidFirestoreDocId(id)) {
          batch.delete(doc(db, 'wards', resolved, 'inspection_records', id));
        }
      });
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// --- USER HELPERS (Authenticated Personal Profile Only; never required for Shared Ward sync) ---

export async function fetchUsersFromFirebase(): Promise<User[]> {
  if (!auth.currentUser) return [];
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const users: User[] = [];
    snap.forEach((d) => users.push(d.data() as User));
    return users;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveUserToFirebase(user: User) {
  // Only persist personal user profile doc when signed into Firebase Auth; local device operator profile stays in localStorage
  const fbUid = auth.currentUser?.uid;
  if (!fbUid) {
    return true;
  }
  const targetId = normalizeFirestoreDocId(fbUid, 'usr');
  const path = `users/${targetId}`;
  try {
    const rawUser: Record<string, any> = {
      id: targetId,
      uid: fbUid,
      name: String(user.name || 'สาธิต').trim().slice(0, 150) || 'สาธิต',
    };
    for (const key of USER_ALLOWED_KEYS) {
      if (key === 'id' || key === 'name' || key === 'uid') continue;
      const val = (user as any)[key];
      if (val === undefined || typeof val === 'function') continue;
      if ((key === 'avatar' || key === 'signature') && typeof val === 'string' && val.length > 490000) {
        continue;
      }
      rawUser[key] = val;
    }
    const cleanPayload = sanitizeForFirestore(rawUser);
    await setDoc(doc(db, 'users', targetId), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    console.warn(`[firebase] saveUserToFirebase(${path}) skipped:`, e);
    return false;
  }
}

export interface InventoryStateFlags {
  drugsCleared?: boolean;
  equipmentCleared?: boolean;
  bagCleared?: boolean;
  cartCleared?: boolean;
  ambulanceCleared?: boolean;
  equipmentSeeded?: boolean;
  drugsSeeded?: boolean;
  channelsInitialized?: boolean;
  updatedAt?: string;
}

export async function saveInventoryFlagsToFirebase(
  flags: InventoryStateFlags,
  wardId?: string
): Promise<boolean> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  return saveWardWorkspacePatchToFirebase(resolved, flags);
}

export async function loadInventoryFlagsFromFirebase(
  wardId?: string
): Promise<InventoryStateFlags | null> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    const snap = await getDoc(doc(db, 'wards', resolved));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    return {
      drugsCleared: data.drugsCleared,
      equipmentCleared: data.equipmentCleared,
      bagCleared: data.bagCleared,
      cartCleared: data.cartCleared,
      ambulanceCleared: data.ambulanceCleared,
      equipmentSeeded: data.equipmentSeeded,
      drugsSeeded: data.drugsSeeded,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function saveChannelsToFirebase(channels: WardChannel[]): Promise<boolean> {
  if (!auth.currentUser) return true;
  const path = 'settings/channels';
  try {
    const cleanPayload = sanitizeForFirestore({
      channels,
      channelsInitialized: true,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'settings', 'channels'), cleanPayload);
    return true;
  } catch {
    return false;
  }
}

export async function fetchChannelsFromFirebase(): Promise<WardChannel[] | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', 'channels'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return Array.isArray(data?.channels) ? (data.channels as WardChannel[]) : null;
  } catch {
    return null;
  }
}

export async function saveChannelDataToFirebase(wardId: string, data: any): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  const patch: Record<string, any> = {};
  if (data && typeof data === 'object') {
    if (data.name !== undefined) patch.name = data.name;
    if (data.lists !== undefined) patch.lists = data.lists;
    if (data.globalChecks !== undefined) patch.globalChecks = data.globalChecks;
    if (data.emergencyWeekDates !== undefined) patch.emergencyWeekDates = data.emergencyWeekDates;
    if (Array.isArray(data.deletedItemIds)) patch.deletedItemIds = data.deletedItemIds.slice(-500);
    if (typeof data.drugsCleared === 'boolean') patch.drugsCleared = data.drugsCleared;
    if (typeof data.equipmentCleared === 'boolean') patch.equipmentCleared = data.equipmentCleared;
    if (typeof data.bagCleared === 'boolean') patch.bagCleared = data.bagCleared;
    if (typeof data.cartCleared === 'boolean') patch.cartCleared = data.cartCleared;
    if (typeof data.ambulanceCleared === 'boolean') patch.ambulanceCleared = data.ambulanceCleared;
    if (typeof data.pinEnabled === 'boolean') patch.pinEnabled = data.pinEnabled;
    if (data.pinHash !== undefined) patch.pinHash = data.pinHash;
    if (data.pinSalt !== undefined) patch.pinSalt = data.pinSalt;
    if (data.sheetUrl !== undefined) patch.sheetUrl = data.sheetUrl;
    if (data.apiUrl !== undefined) patch.apiUrl = data.apiUrl;
  }
  return saveWardWorkspacePatchToFirebase(resolved, patch);
}

export async function fetchChannelDataFromFirebase(wardId: string): Promise<any | null> {
  const resolved = resolveWardId(wardId);
  const path = `wards/${resolved}`;
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'wards', resolved));
    } catch {
      snap = await getDoc(doc(db, 'wards', resolved));
    }
    return snap.exists() ? { id: resolved, ...snap.data() } : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

export async function deleteChannelInFirebase(wardId: string): Promise<boolean> {
  const resolved = resolveWardId(wardId);
  if (!resolved || resolved === DEFAULT_WARD_ID) return false;
  const path = `wards/${resolved}`;
  try {
    const subcollections = [
      'equipment',
      'drugs',
      'inspection_records',
      'restock_requisitions',
      'audit_logs',
      'admin_config',
      'trash',
      'ai_memory',
    ];
    for (const sub of subcollections) {
      try {
        const subSnap = await getDocs(
          query(collection(db, 'wards', resolved, sub), where('wardId', '==', resolved))
        );
        if (!subSnap.empty) {
          for (let i = 0; i < subSnap.docs.length; i += 400) {
            const batch = writeBatch(db);
            subSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch {
        // Continue cleanup
      }
    }
    if (auth.currentUser) {
      await deleteDoc(doc(db, 'wards', resolved)).catch(() => {});
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// --- SETTINGS HELPERS (Shared per ward + legacy admin config fallback) ---

export async function saveSettingsToFirebase(settings: any, wardId?: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  await saveWardWorkspacePatchToFirebase(resolved, {
    ...(settings?.sheetUrl !== undefined ? { sheetUrl: settings.sheetUrl } : {}),
    ...(settings?.apiUrl !== undefined ? { apiUrl: settings.apiUrl } : {}),
  });
  if (auth.currentUser) {
    try {
      const cleanPayload = sanitizeForFirestore({ ...settings, updatedAt: new Date().toISOString() });
      await setDoc(doc(db, 'settings', 'config'), cleanPayload, { merge: true });
    } catch {
      // Non-admin users write to ward doc only
    }
  }
  return true;
}

export async function loadSettingsFromFirebase(wardId?: string): Promise<any> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    const wardSnap = await getDoc(doc(db, 'wards', resolved));
    if (wardSnap.exists()) {
      const d = wardSnap.data() || {};
      if (d.sheetUrl || d.apiUrl) {
        return { sheetUrl: d.sheetUrl || '', apiUrl: d.apiUrl || '' };
      }
    }
    if (auth.currentUser) {
      const snap = await getDoc(doc(db, 'settings', 'config'));
      return snap.exists() ? snap.data() : null;
    }
    return null;
  } catch {
    return null;
  }
}

// --- HA / JCI AUDIT TRAIL LOGGING (APPEND-ONLY under wards/{wardId}/audit_logs) ---

export async function recordHaAuditLog(
  entry: HaAuditLogEntry,
  wardId?: string
): Promise<string> {
  const resolved = resolveWardId(wardId || (entry.details?.channelId as string) || getActiveWardIdFromStorage());
  await ensureWardWorkspaceInitialized(resolved);
  const id = normalizeFirestoreDocId(
    entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    'audit'
  );
  const path = `wards/${resolved}/audit_logs/${id}`;
  const record: HaAuditLogEntry & { wardId: string } = {
    ...entry,
    id,
    wardId: resolved,
    timestamp: entry.timestamp || new Date().toISOString(),
    ipAddress: entry.ipAddress || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
  };

  try {
    const cleanPayload = sanitizeForFirestore(record);
    await setDoc(doc(db, 'wards', resolved, 'audit_logs', id), cleanPayload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ha_audit_log_added', { detail: record }));
    }
    return id;
  } catch (e) {
    console.warn(`[firebase] recordHaAuditLog(${path}) skipped:`, e);
    return id;
  }
}

export async function fetchHaAuditLogs(
  limitCount = 100,
  wardId?: string
): Promise<HaAuditLogEntry[]> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}/audit_logs`;
  try {
    const q = query(collection(db, 'wards', resolved, 'audit_logs'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    const logs: HaAuditLogEntry[] = [];
    snap.forEach((d) => logs.push({ ...d.data(), id: d.id } as HaAuditLogEntry));
    logs.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    return logs.slice(0, limitCount);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export function subscribeHaAuditLogs(
  callback: (logs: HaAuditLogEntry[]) => void,
  limitCount = 100,
  wardId?: string
) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}/audit_logs`;
  try {
    const q = query(collection(db, 'wards', resolved, 'audit_logs'), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: HaAuditLogEntry[] = [];
        snapshot.forEach((d) => logs.push({ ...d.data(), id: d.id } as HaAuditLogEntry));
        logs.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        callback(logs.slice(0, limitCount));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch {
    return () => {};
  }
}

export async function markAuditLogRestoredInFirebase(
  wardId: string,
  logId: string,
  restoredBy: string
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(logId)) return { ok: false };
  try {
    await updateDoc(doc(db, 'wards', resolved, 'audit_logs', logId), {
      restoredAt: new Date().toISOString(),
      restoredBy: String(restoredBy || 'Admin').slice(0, 150),
    });
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.code || e?.message || '');
    return {
      ok: false,
      permissionDenied: msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED'),
    };
  }
}

export async function deleteAuditLogInFirebase(
  wardId: string,
  logId: string
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(logId)) return { ok: false };
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'audit_logs', logId));
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.code || e?.message || '');
    return {
      ok: false,
      permissionDenied: msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED'),
    };
  }
}

// --- WARD ADMIN PERMISSION LOCKS & TRASH RESTORE HELPERS ---

export const DEFAULT_WARD_PERMISSION_LOCKS: WardPermissionLocks = {
  lockStaffDeleteItems: true,
  lockStaffEditStructure: false,
  lockGoogleSheetsExport: false,
};

export function subscribeWardAdminLocks(
  wardId: string,
  callback: (locks: WardPermissionLocks | null) => void
): () => void {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    return onSnapshot(
      doc(db, 'wards', resolved, 'admin_config', 'locks'),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const d = snap.data() || {};
        callback({
          lockStaffDeleteItems:
            typeof d.lockStaffDeleteItems === 'boolean'
              ? d.lockStaffDeleteItems
              : DEFAULT_WARD_PERMISSION_LOCKS.lockStaffDeleteItems,
          lockStaffEditStructure:
            typeof d.lockStaffEditStructure === 'boolean'
              ? d.lockStaffEditStructure
              : DEFAULT_WARD_PERMISSION_LOCKS.lockStaffEditStructure,
          lockGoogleSheetsExport:
            typeof d.lockGoogleSheetsExport === 'boolean'
              ? d.lockGoogleSheetsExport
              : DEFAULT_WARD_PERMISSION_LOCKS.lockGoogleSheetsExport,
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
          updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
        });
      },
      () => {
        callback(null);
      }
    );
  } catch {
    return () => {};
  }
}

export async function saveWardAdminLocksToFirebase(
  wardId: string,
  locks: WardPermissionLocks
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  await ensureWardWorkspaceInitialized(resolved);
  try {
    const cleanPayload = sanitizeForFirestore({
      id: 'locks',
      wardId: resolved,
      lockStaffDeleteItems: Boolean(locks.lockStaffDeleteItems),
      lockStaffEditStructure: Boolean(locks.lockStaffEditStructure),
      lockGoogleSheetsExport: Boolean(locks.lockGoogleSheetsExport),
      updatedAt: locks.updatedAt || new Date().toISOString(),
      updatedBy: String(locks.updatedBy || 'Admin').slice(0, 150),
    });
    await setDoc(doc(db, 'wards', resolved, 'admin_config', 'locks'), cleanPayload, { merge: true });
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.code || e?.message || '');
    return {
      ok: false,
      permissionDenied: msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED'),
    };
  }
}

export async function saveTrashItemToFirebase(
  record: TrashItemRecord,
  wardId?: string
): Promise<boolean> {
  const resolved = resolveWardId(wardId || record.wardId || getActiveWardIdFromStorage());
  await ensureWardWorkspaceInitialized(resolved);
  const trashId = normalizeFirestoreDocId(record.id, 'trash');
  const path = `wards/${resolved}/trash/${trashId}`;
  try {
    const cleanPayload = sanitizeForFirestore({
      ...record,
      id: trashId,
      wardId: resolved,
      itemName: String(record.itemName || 'Deleted Item').slice(0, 300),
      deletedBy: String(record.deletedBy || 'สาธิต').slice(0, 150),
      deletedAt: record.deletedAt || new Date().toISOString(),
      tombstoneTokens: Array.isArray(record.tombstoneTokens)
        ? record.tombstoneTokens.slice(0, 20)
        : [],
    });
    await setDoc(doc(db, 'wards', resolved, 'trash', trashId), cleanPayload);
    return true;
  } catch (e) {
    console.warn(`[firebase] saveTrashItemToFirebase(${path}) skipped:`, e);
    return false;
  }
}

export function subscribeWardTrash(
  wardId: string,
  callback: (items: TrashItemRecord[]) => void
): () => void {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}/trash`;
  try {
    const q = query(collection(db, 'wards', resolved, 'trash'), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snap) => {
        const list: TrashItemRecord[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as TrashItemRecord));
        list.sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')));
        callback(list.slice(0, 200));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
  } catch {
    return () => {};
  }
}

export async function markTrashRestoredInFirebase(
  wardId: string,
  trashId: string,
  restoredBy: string
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(trashId)) return { ok: false };
  try {
    await updateDoc(doc(db, 'wards', resolved, 'trash', trashId), {
      restoredAt: new Date().toISOString(),
      restoredBy: String(restoredBy || 'Admin').slice(0, 150),
    });
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.code || e?.message || '');
    return {
      ok: false,
      permissionDenied: msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED'),
    };
  }
}

export async function deleteTrashItemInFirebase(
  wardId: string,
  trashId: string
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(trashId)) return { ok: false };
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'trash', trashId));
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.code || e?.message || '');
    return {
      ok: false,
      permissionDenied: msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED'),
    };
  }
}

// --- WARD AI MEMORY / CUSTOM GLOSSARY (wards/{wardId}/ai_memory) ---

function computeMemoryPhraseHash(phrase: string): string {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `mem_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export async function saveWardAiMemoryToFirebase(
  wardId: string,
  entry: {
    id?: string;
    triggerPhrase: string;
    meaning: string;
    category?: string;
    ruleType?: string;
    createdBy?: string;
  }
): Promise<{ ok: boolean; item?: WardAiMemoryItem; error?: string }> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const triggerPhrase = String(entry.triggerPhrase || '').trim().slice(0, 200);
  const meaning = String(entry.meaning || '').trim().slice(0, 500);
  if (!triggerPhrase || !meaning) {
    return { ok: false, error: 'กรุณาระบุคำศัพท์และความหมายให้ครบถ้วน' };
  }

  const memId = normalizeFirestoreDocId(
    entry.id || computeMemoryPhraseHash(triggerPhrase),
    'mem'
  );
  const nowIso = new Date().toISOString();
  const cleanPayload: WardAiMemoryItem = {
    id: memId,
    wardId: resolved,
    triggerPhrase,
    meaning,
    ...(entry.category ? { category: String(entry.category).trim().slice(0, 100) } : {}),
    ...(entry.ruleType ? { ruleType: String(entry.ruleType).trim().slice(0, 50) } : {}),
    ...(entry.createdBy ? { createdBy: String(entry.createdBy).trim().slice(0, 150) } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const initialized = await ensureWardWorkspaceInitialized(resolved);
    if (!initialized) {
      return { ok: false, error: 'ไม่สามารถเตรียมพื้นที่เก็บข้อมูลห้องวอร์ดบน Firestore ได้' };
    }
    const sanitized = sanitizeForFirestore(cleanPayload);
    await setDoc(doc(db, 'wards', resolved, 'ai_memory', memId), sanitized, { merge: true });
    return { ok: true, item: cleanPayload };
  } catch (e: any) {
    console.warn(`[firebase] saveWardAiMemoryToFirebase(wards/${resolved}/ai_memory/${memId}) skipped:`, e);
    return { ok: false, error: e?.message || 'ไม่สามารถบันทึกความจำวอร์ดลง Firestore ได้' };
  }
}

export async function fetchWardAiMemoryFromFirebase(wardId: string): Promise<WardAiMemoryItem[]> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    const q = query(collection(db, 'wards', resolved, 'ai_memory'), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    const items: WardAiMemoryItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as WardAiMemoryItem));
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return items;
  } catch {
    return [];
  }
}

export function subscribeWardAiMemory(
  wardId: string,
  callback: (items: WardAiMemoryItem[]) => void
): () => void {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const path = `wards/${resolved}/ai_memory`;
  try {
    const q = query(collection(db, 'wards', resolved, 'ai_memory'), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snap) => {
        const items: WardAiMemoryItem[] = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id } as WardAiMemoryItem));
        items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        callback(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
  } catch {
    return () => {};
  }
}

export async function deleteWardAiMemoryInFirebase(
  wardId: string,
  memoryId: string
): Promise<boolean> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  if (!isValidFirestoreDocId(memoryId)) return false;
  try {
    await deleteDoc(doc(db, 'wards', resolved, 'ai_memory', memoryId));
    return true;
  } catch {
    return false;
  }
}

// --- CLOUD STORAGE & FIRESTORE BYTE USAGE SCANNERS ---

export interface FirebaseStorageUsageResult {
  usedBytes: number;
  fileCount: number;
  mode?: 'bucket' | 'inline';
  bucketAvailable?: boolean;
  error?: string;
}

export async function fetchFirebaseStorageUsage(): Promise<FirebaseStorageUsageResult> {
  return {
    usedBytes: 0,
    fileCount: 0,
    mode: 'inline',
    bucketAvailable: false,
  };
}

export interface FirestoreUsageClientResult {
  usedBytes: number;
  docCount: number;
  embeddedMediaBytes: number;
  embeddedMediaCount: number;
  error?: string;
}

/**
 * Measures real UTF-8 byte size and embedded media across the active Shared Ward Workspace
 * (works without Google sign-in!) plus any legacy collections if signed in.
 */
export async function measureFirestoreUsageClient(
  extraWardIds: string[] = []
): Promise<FirestoreUsageClientResult> {
  const encoder = new TextEncoder();
  const calcDocBytes = (docPath: string, data: Record<string, any>) => {
    const jsonBytes = encoder.encode(JSON.stringify(data || {})).length;
    const pathBytes = encoder.encode(docPath).length;
    return jsonBytes + pathBytes + 32;
  };
  const countMediaInDoc = (data: Record<string, any>): { count: number; bytes: number } => {
    let count = 0;
    let bytes = 0;
    for (const field of ['img', 'avatar', 'signature']) {
      const val = data?.[field];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (
          trimmed.startsWith('data:image/') ||
          trimmed.startsWith('http://') ||
          trimmed.startsWith('https://')
        ) {
          count += 1;
          bytes += encoder.encode(trimmed).length;
        }
      }
    }
    return { count, bytes };
  };

  let usedBytes = 0;
  let docCount = 0;
  let embeddedMediaBytes = 0;
  let embeddedMediaCount = 0;
  const wardIds = new Set<string>([
    DEFAULT_WARD_ID,
    getActiveWardIdFromStorage(),
    ...extraWardIds.map((w) => resolveWardId(w)),
  ]);

  try {
    const subCollections = [
      'drugs',
      'equipment',
      'inspection_records',
      'restock_requisitions',
      'audit_logs',
      'admin_config',
      'trash',
      'ai_memory',
    ];
    for (const wardId of wardIds) {
      try {
        const wardSnap = await getDoc(doc(db, 'wards', wardId));
        if (wardSnap.exists()) {
          docCount += 1;
          const data = wardSnap.data() || {};
          usedBytes += calcDocBytes(wardSnap.ref.path, data);
          const media = countMediaInDoc(data);
          embeddedMediaCount += media.count;
          embeddedMediaBytes += media.bytes;
        }
      } catch {
        // Ignore missing ward doc
      }

      await Promise.all(
        subCollections.map(async (subName) => {
          try {
            const subSnap = await getDocs(
              query(collection(db, 'wards', wardId, subName), where('wardId', '==', wardId))
            );
            subSnap.forEach((docSnap) => {
              docCount += 1;
              const data = docSnap.data() || {};
              usedBytes += calcDocBytes(docSnap.ref.path, data);
              const media = countMediaInDoc(data);
              embeddedMediaCount += media.count;
              embeddedMediaBytes += media.bytes;
            });
          } catch {
            // Skip inaccessible subcollection
          }
        })
      );
    }

    return { usedBytes, docCount, embeddedMediaBytes, embeddedMediaCount };
  } catch (err: any) {
    return {
      usedBytes: 0,
      docCount: 0,
      embeddedMediaBytes: 0,
      embeddedMediaCount: 0,
      error: err?.message || 'ไม่สามารถคำนวณขนาดข้อมูล Firestore ได้',
    };
  }
}
