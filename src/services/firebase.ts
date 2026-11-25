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
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, AuditLogEntry, HaAuditLogEntry, InspectionHistoryRecord, EquipmentItem, DrugItem, WardChannel } from '../types';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with browserLocalPersistence (with safe fallback)
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
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);

export interface CloudConnectivityResult {
  ok: boolean;
  status: 'online' | 'needs_auth' | 'offline' | 'error';
  msg: string;
  latencyMs?: number;
}

/**
 * Tests real connectivity to Firebase Auth + Cloud Firestore.
 * Uses settings/app_state (readable by all verified users per firestore.rules).
 */
export async function testCloudConnectivity(): Promise<CloudConnectivityResult> {
  const start = Date.now();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      status: 'offline',
      msg: 'อุปกรณ์ไม่ได้เชื่อมต่ออินเทอร์เน็ต (Offline)',
    };
  }

  if (!auth.currentUser) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return {
          ok: false,
          status: 'needs_auth',
          msg: 'เซิร์ฟเวอร์คลาวด์พร้อมใช้งาน — กรุณากด "เข้าสู่ระบบด้วย Google" เพื่อเปิดซิงค์ข้อมูล Firebase',
          latencyMs: Date.now() - start,
        };
      }
    } catch {
      // fall through
    }
    return {
      ok: false,
      status: 'needs_auth',
      msg: 'กรุณากด "เข้าสู่ระบบด้วย Google" เพื่อเชื่อมต่อบัญชีกับ Firebase Cloud',
    };
  }

  try {
    await auth.currentUser.getIdToken(true);
    await getDocFromServer(doc(db, 'settings', 'app_state'));
    return {
      ok: true,
      status: 'online',
      msg: 'เชื่อมต่อฐานข้อมูล Firebase Firestore สำเร็จ (Online)',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    const errMsg = String(error?.message || error || '');
    if (errMsg.includes('offline') || errMsg.includes('Could not reach Cloud Firestore') || errMsg.includes('Failed to get document')) {
      return {
        ok: false,
        status: 'offline',
        msg: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Firestore ได้ในขณะนี้ (Offline)',
      };
    }
    if (errMsg.includes('permission') || errMsg.includes('Missing or insufficient permissions')) {
      return {
        ok: false,
        status: 'needs_auth',
        msg: 'สิทธิ์การเข้าถึง Firebase หมดอายุ กรุณากดออกจากระบบแล้วเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง',
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
 * Validates connection to Firestore on boot (only when signed in so rules never reject unauthenticated checks)
 */
async function testFirestoreConnection() {
  try {
    if (!auth.currentUser) return;
    await getDocFromServer(doc(db, 'settings', 'app_state'));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('offline') || errMsg.includes("Backend didn't respond")) {
      console.warn('Firestore is starting in offline mode. Connectivity issues detected.');
    }
  }
}
void testFirestoreConnection();

// Real auth readiness promise resolving on initial Firebase Auth state resolution
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
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnauth =
    errMsg.includes('offline') ||
    errMsg.includes('Failed to get document because the client is offline') ||
    errMsg.includes('Could not reach Cloud Firestore backend') ||
    errMsg.includes('securetoken.googleapis.com') ||
    errMsg.includes('token-service-api') ||
    errMsg.includes('Fetching auth token failed') ||
    (!auth.currentUser && (errMsg.includes('Missing or insufficient permissions') || errMsg.includes('permission-denied')));

  const errInfo: FirestoreErrorInfo = {
    error: isOfflineOrUnauth
      ? errMsg.includes('permission')
        ? 'Firestore permission denied (unauthenticated)'
        : 'Firestore is currently in offline mode'
      : errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
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

  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  if (!isOfflineOrUnauth) {
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
  'subItems', 'unitText', 'initialQtyText', 'channelId',
  'orderNumber', 'assetCode', 'sapCode', 'brandModel', 'status', 'isMarked',
]);

const DRUG_ALLOWED_KEYS = new Set([
  'id', 'category', 'name', 'remaining', 'totalQty', 'receivedDate',
  'receivedQty', 'minStock', 'batchRequest', 'unit', 'expDate', 'exp',
  'lotNumber', 'lots', 'batches', 'tmtCode', 'hospitalDrugCode',
  'spec', 'note', 'img', 'barcode', 'channelId', 'updatedAt',
]);

const USER_ALLOWED_KEYS = new Set([
  'id', 'uid', 'email', 'username', 'name', 'role', 'position', 'signature',
  'active', 'must', 'created', 'last', 'avatar', 'ringColor',
]);

function normalizeFirestoreDocId(rawId: string, prefix: string): string {
  const safe = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return safe || `${prefix}_${Date.now()}`;
}

export function sanitizeEquipmentForFirestore(
  item: EquipmentItem,
  fallbackId?: string,
  channelIdOverride?: string
): Record<string, any> {
  const safeId = normalizeFirestoreDocId(item.id || fallbackId || `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 'eq');
  const out: Record<string, any> = {
    id: safeId,
    name: String(item.name || 'รายการครุภัณฑ์').trim().slice(0, 300) || 'รายการครุภัณฑ์',
  };
  for (const key of EQUIPMENT_ALLOWED_KEYS) {
    if (key === 'id' || key === 'name') continue;
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
  if (channelIdOverride && channelIdOverride !== 'channel_master') {
    out.channelId = channelIdOverride;
  }
  return sanitizeForFirestore(out);
}

export function sanitizeDrugForFirestore(
  item: DrugItem,
  channelIdOverride?: string
): Record<string, any> {
  const safeId = normalizeFirestoreDocId(item.id || `drug_${Date.now()}`, 'drug');
  const cat = item.category === 'monthly' || item.category === 'quarterly' || item.category === 'adhoc'
    ? item.category
    : 'monthly';
  const out: Record<string, any> = {
    id: safeId,
    name: String(item.name || 'รายการยา').trim().slice(0, 300) || 'รายการยา',
    category: cat,
  };
  for (const key of DRUG_ALLOWED_KEYS) {
    if (key === 'id' || key === 'name' || key === 'category') continue;
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
  if (channelIdOverride && channelIdOverride !== 'channel_master') {
    out.channelId = channelIdOverride;
  }
  return sanitizeForFirestore(out);
}

// --- EQUIPMENT HELPERS ---

export async function fetchEquipmentFromFirebase(): Promise<EquipmentItem[]> {
  const path = 'equipment';
  try {
    const snap = await getDocs(collection(db, path));
    const items: EquipmentItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as EquipmentItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveEquipmentItemToFirebase(item: EquipmentItem) {
  const cleanPayload = sanitizeEquipmentForFirestore(item);
  const id = cleanPayload.id;
  const path = `equipment/${id}`;
  try {
    await setDoc(doc(db, 'equipment', id), cleanPayload, { merge: true });
    return { ...item, id };
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return null;
  }
}

function isValidFirestoreDocId(id?: string): boolean {
  return Boolean(id && /^[a-zA-Z0-9_-]{1,128}$/.test(id));
}

export async function deleteEquipmentItemInFirebase(id: string) {
  if (!isValidFirestoreDocId(id)) {
    return false;
  }
  const path = `equipment/${id}`;
  try {
    await deleteDoc(doc(db, 'equipment', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteEquipmentItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

// --- DRUG HELPERS ---

export async function fetchDrugsFromFirebase(): Promise<DrugItem[]> {
  const path = 'drugs';
  try {
    const snap = await getDocs(collection(db, path));
    const items: DrugItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as DrugItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveDrugItemToFirebase(item: DrugItem) {
  const cleanPayload = sanitizeDrugForFirestore(item);
  const path = `drugs/${cleanPayload.id}`;
  try {
    await setDoc(doc(db, 'drugs', cleanPayload.id), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function saveBatchDrugsToFirebase(items: DrugItem[]): Promise<boolean> {
  if (!items || items.length === 0) return true;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item) => {
        const cleanPayload = sanitizeDrugForFirestore(item);
        const ref = doc(db, 'drugs', cleanPayload.id);
        batch.set(ref, cleanPayload, { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'drugs');
    return false;
  }
}

export async function deleteDrugItemInFirebase(id: string): Promise<boolean> {
  if (!isValidFirestoreDocId(id)) return false;
  const path = `drugs/${id}`;
  try {
    await deleteDoc(doc(db, 'drugs', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteDrugItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

// --- CHANNEL-ISOLATED EQUIPMENT & DRUG HELPERS ---

const isMasterChannel = (channelId?: string): boolean => !channelId || channelId === 'channel_master';

export async function fetchChannelEquipmentFromFirebase(channelId: string): Promise<EquipmentItem[]> {
  if (isMasterChannel(channelId)) {
    return fetchEquipmentFromFirebase();
  }
  const path = `channels/${channelId}/equipment`;
  try {
    const snap = await getDocs(collection(db, 'channels', channelId, 'equipment'));
    const items: EquipmentItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as EquipmentItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveChannelEquipmentItemToFirebase(channelId: string, item: EquipmentItem) {
  if (isMasterChannel(channelId)) {
    return saveEquipmentItemToFirebase(item);
  }
  const cleanPayload = sanitizeEquipmentForFirestore(item, undefined, channelId);
  const id = cleanPayload.id;
  const path = `channels/${channelId}/equipment/${id}`;
  try {
    await setDoc(doc(db, 'channels', channelId, 'equipment', id), cleanPayload, { merge: true });
    return { ...item, id };
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return null;
  }
}

export async function saveChannelBatchEquipmentToFirebase(
  channelId: string,
  items: EquipmentItem[]
): Promise<boolean> {
  if (!items || items.length === 0) return true;
  const master = isMasterChannel(channelId);
  const path = master ? 'equipment' : `channels/${channelId}/equipment`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item, idx) => {
        const fallbackId = `eq_${Date.now()}_${i + idx}`;
        const cleanPayload = sanitizeEquipmentForFirestore(
          item,
          fallbackId,
          master ? undefined : channelId
        );
        const ref = master
          ? doc(db, 'equipment', cleanPayload.id)
          : doc(db, 'channels', channelId, 'equipment', cleanPayload.id);
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

export async function deleteChannelEquipmentItemInFirebase(channelId: string, id: string) {
  if (isMasterChannel(channelId)) {
    return deleteEquipmentItemInFirebase(id);
  }
  if (!isValidFirestoreDocId(id)) {
    return false;
  }
  const path = `channels/${channelId}/equipment/${id}`;
  try {
    await deleteDoc(doc(db, 'channels', channelId, 'equipment', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteChannelEquipmentItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

export async function deleteChannelDrugItemInFirebase(channelId: string, id: string): Promise<boolean> {
  if (isMasterChannel(channelId)) {
    return deleteDrugItemInFirebase(id);
  }
  if (!isValidFirestoreDocId(id)) {
    return false;
  }
  const path = `channels/${channelId}/drugs/${id}`;
  try {
    await deleteDoc(doc(db, 'channels', channelId, 'drugs', id));
    return true;
  } catch (e) {
    console.warn(`[firebase] deleteChannelDrugItemInFirebase(${path}) skipped:`, e);
    return false;
  }
}

export async function clearChannelEquipmentInFirebase(
  channelId: string,
  filterType: 'room' | 'bag' | 'cart' | 'ambulance' | 'all' = 'all'
): Promise<boolean> {
  if (isMasterChannel(channelId)) {
    return clearAllEquipmentInFirebase(filterType);
  }
  const path = `channels/${channelId}/equipment`;
  try {
    const snap = await getDocs(collection(db, 'channels', channelId, 'equipment'));
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

export async function fetchChannelDrugsFromFirebase(channelId: string): Promise<DrugItem[]> {
  if (isMasterChannel(channelId)) {
    return fetchDrugsFromFirebase();
  }
  const path = `channels/${channelId}/drugs`;
  try {
    const snap = await getDocs(collection(db, 'channels', channelId, 'drugs'));
    const items: DrugItem[] = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id } as DrugItem));
    return items;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export async function saveChannelDrugItemToFirebase(channelId: string, item: DrugItem): Promise<boolean> {
  if (isMasterChannel(channelId)) {
    return saveDrugItemToFirebase(item);
  }
  const cleanPayload = sanitizeDrugForFirestore(item, channelId);
  const path = `channels/${channelId}/drugs/${cleanPayload.id}`;
  try {
    await setDoc(doc(db, 'channels', channelId, 'drugs', cleanPayload.id), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function saveChannelBatchDrugsToFirebase(channelId: string, items: DrugItem[]): Promise<boolean> {
  if (isMasterChannel(channelId)) {
    return saveBatchDrugsToFirebase(items);
  }
  if (!items || items.length === 0) return true;
  const path = `channels/${channelId}/drugs`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item) => {
        const cleanPayload = sanitizeDrugForFirestore(item, channelId);
        const ref = doc(db, 'channels', channelId, 'drugs', cleanPayload.id);
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

export async function clearChannelDrugsInFirebase(channelId: string): Promise<boolean> {
  if (isMasterChannel(channelId)) {
    return clearAllDrugsInFirebase();
  }
  const path = `channels/${channelId}/drugs`;
  try {
    const snap = await getDocs(collection(db, 'channels', channelId, 'drugs'));
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

export async function saveRestockRequisitionToFirebase(reqPayload: {
  id: string;
  channelId?: string;
  targetCategory?: string;
  requestedBy?: string;
  status?: string;
  notes?: string;
  items: any[];
  createdAt: string;
}): Promise<boolean> {
  const channelId = reqPayload.channelId;
  const path = isMasterChannel(channelId)
    ? `restock_requisitions/${reqPayload.id}`
    : `channels/${channelId}/restock_requisitions/${reqPayload.id}`;
  try {
    const cleanPayload = sanitizeForFirestore({
      ...reqPayload,
      channelId: channelId || 'channel_master',
      updatedAt: new Date().toISOString(),
    });
    const ref = isMasterChannel(channelId)
      ? doc(db, 'restock_requisitions', reqPayload.id)
      : doc(db, 'channels', channelId!, 'restock_requisitions', reqPayload.id);
    await setDoc(ref, cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// --- INSPECTION RECORD HELPERS ---

export async function saveInspectionToFirebase(record: InspectionHistoryRecord) {
  const path = `inspection_records/${record.id}`;
  try {
    const cleanPayload = sanitizeForFirestore(record);
    await setDoc(doc(db, 'inspection_records', record.id), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function subscribeInspectionHistory(callback: (records: InspectionHistoryRecord[]) => void) {
  const path = 'inspection_records';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const records: InspectionHistoryRecord[] = [];
      snapshot.forEach((docSnap) => records.push(docSnap.data() as InspectionHistoryRecord));
      callback(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  } catch (e) {
    return () => {};
  }
}

export async function deleteInspectionFromFirebase(id: string) {
  const path = `inspection_records/${id}`;
  try {
    await deleteDoc(doc(db, 'inspection_records', id));
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

export async function deleteBatchInspectionsFromFirebase(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  const path = 'inspection_records';
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      ids.slice(i, i + 400).forEach((id) => {
        if (id) batch.delete(doc(db, 'inspection_records', id));
      });
      await batch.commit();
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// --- USER HELPERS ---

export async function fetchUsersFromFirebase(): Promise<User[]> {
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
  const fbUid = auth.currentUser?.uid;
  const isLocalFallbackId = !user.id || user.id === 'usr_staff_default' || user.id === 'usr_admin';
  const targetId = normalizeFirestoreDocId(
    isLocalFallbackId && fbUid ? fbUid : user.id || fbUid || 'usr_staff_default',
    'usr'
  );
  const path = `users/${targetId}`;
  try {
    const rawUser: Record<string, any> = {
      id: targetId,
      name: String(user.name || 'เจ้าหน้าที่วิสัญญี').trim().slice(0, 150) || 'เจ้าหน้าที่วิสัญญี',
    };
    for (const key of USER_ALLOWED_KEYS) {
      if (key === 'id' || key === 'name') continue;
      const val = (user as any)[key];
      if (val === undefined || typeof val === 'function') continue;
      if ((key === 'avatar' || key === 'signature') && typeof val === 'string' && val.length > 490000) {
        continue;
      }
      rawUser[key] = val;
    }
    if (fbUid) {
      rawUser.uid = fbUid;
    }
    const cleanPayload = sanitizeForFirestore(rawUser);
    await setDoc(doc(db, 'users', targetId), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function clearAllEquipmentInFirebase(filterType: 'room' | 'bag' | 'cart' | 'ambulance' | 'all' = 'all'): Promise<boolean> {
  const path = 'equipment';
  try {
    const snap = await getDocs(collection(db, path));
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

export async function clearAllDrugsInFirebase(): Promise<boolean> {
  const path = 'drugs';
  try {
    const snap = await getDocs(collection(db, path));
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

export interface InventoryStateFlags {
  drugsCleared?: boolean;
  equipmentCleared?: boolean;
  bagCleared?: boolean;
  cartCleared?: boolean;
  ambulanceCleared?: boolean;
  channelsInitialized?: boolean;
  updatedAt?: string;
}

export async function saveInventoryFlagsToFirebase(flags: InventoryStateFlags): Promise<boolean> {
  const path = 'settings/app_state';
  try {
    const cleanPayload = sanitizeForFirestore({ ...flags, updatedAt: new Date().toISOString() });
    await setDoc(doc(db, 'settings', 'app_state'), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function loadInventoryFlagsFromFirebase(): Promise<InventoryStateFlags | null> {
  const path = 'settings/app_state';
  try {
    const snap = await getDoc(doc(db, 'settings', 'app_state'));
    return snap.exists() ? (snap.data() as InventoryStateFlags) : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

export async function saveChannelsToFirebase(channels: WardChannel[]): Promise<boolean> {
  const path = 'settings/channels';
  try {
    const cleanPayload = sanitizeForFirestore({
      channels,
      channelsInitialized: true,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'settings', 'channels'), cleanPayload);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function fetchChannelsFromFirebase(): Promise<WardChannel[] | null> {
  const path = 'settings/channels';
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'settings', 'channels'));
    } catch {
      snap = await getDoc(doc(db, 'settings', 'channels'));
    }
    if (!snap.exists()) return null;
    const data = snap.data();
    return Array.isArray(data?.channels) ? (data.channels as WardChannel[]) : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

export async function saveChannelDataToFirebase(channelId: string, data: any): Promise<boolean> {
  const path = `channels/${channelId}`;
  try {
    const cleanPayload = sanitizeForFirestore({
      id: channelId,
      lists: data.lists || {},
      globalChecks: data.globalChecks || {},
      emergencyWeekDates: data.emergencyWeekDates || {},
      ...(Array.isArray(data.deletedItemIds) ? { deletedItemIds: data.deletedItemIds.slice(-500) } : {}),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'channels', channelId), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function fetchChannelDataFromFirebase(channelId: string): Promise<any | null> {
  const path = `channels/${channelId}`;
  try {
    const snap = await getDoc(doc(db, 'channels', channelId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

export async function deleteChannelInFirebase(channelId: string): Promise<boolean> {
  if (!channelId || channelId === 'channel_master') return false;
  const path = `channels/${channelId}`;
  try {
    // Clean up channel subcollections first (best-effort)
    const subcollections = ['equipment', 'drugs', 'inspection_records', 'restock_requisitions'];
    for (const sub of subcollections) {
      try {
        const subSnap = await getDocs(collection(db, 'channels', channelId, sub));
        if (!subSnap.empty) {
          for (let i = 0; i < subSnap.docs.length; i += 400) {
            const batch = writeBatch(db);
            subSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch {
        // Continue deleting main channel doc even if subcollection cleanup is skipped
      }
    }
    await deleteDoc(doc(db, 'channels', channelId));
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// --- SETTINGS HELPERS ---

export async function saveSettingsToFirebase(settings: any) {
  const path = 'settings/config';
  try {
    const cleanPayload = sanitizeForFirestore({ ...settings, updatedAt: new Date().toISOString() });
    await setDoc(doc(db, 'settings', 'config'), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

export async function loadSettingsFromFirebase(): Promise<any> {
  const path = 'settings/config';
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

// --- HA / JCI AUDIT TRAIL LOGGING (APPEND-ONLY) ---

export async function recordHaAuditLog(entry: HaAuditLogEntry): Promise<string> {
  const id = entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `audit_logs/${id}`;
  const record: HaAuditLogEntry = {
    ...entry,
    id,
    timestamp: entry.timestamp || new Date().toISOString(),
    ipAddress: entry.ipAddress || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
  };

  try {
    const cleanPayload = sanitizeForFirestore(record);
    await setDoc(doc(db, 'audit_logs', id), cleanPayload);
    
    // Also broadcast custom window event for instant reactive UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ha_audit_log_added', { detail: record }));
    }
    return id;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return id;
  }
}

export async function fetchHaAuditLogs(limitCount = 100): Promise<HaAuditLogEntry[]> {
  const path = 'audit_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const logs: HaAuditLogEntry[] = [];
    snap.forEach((d) => logs.push({ ...d.data(), id: d.id } as HaAuditLogEntry));
    return logs;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

export function subscribeHaAuditLogs(callback: (logs: HaAuditLogEntry[]) => void, limitCount = 100) {
  const path = 'audit_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const logs: HaAuditLogEntry[] = [];
      snapshot.forEach((d) => logs.push({ ...d.data(), id: d.id } as HaAuditLogEntry));
      callback(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  } catch (e) {
    return () => {};
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

/**
 * Media & images are stored compressed directly inside Firestore documents (inline mode).
 * Returning inline status immediately avoids unnecessary Cloud Storage bucket REST requests and retry timeouts.
 */
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
 * Measures real UTF-8 byte size and embedded media across all accessible Firestore collections and subcollections.
 */
export async function measureFirestoreUsageClient(
  extraChannelIds: string[] = []
): Promise<FirestoreUsageClientResult> {
  if (!auth.currentUser) {
    return {
      usedBytes: 0,
      docCount: 0,
      embeddedMediaBytes: 0,
      embeddedMediaCount: 0,
      error: 'กรุณาเข้าสู่ระบบบัญชี Google เพื่อวัดขนาดฐานข้อมูล Firestore ล่าสุด',
    };
  }

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
        if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
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
  const channelIds = new Set<string>(['channel_master', ...extraChannelIds.filter(Boolean)]);

  try {
    const publicCollections = [
      'drugs',
      'equipment',
      'channels',
      'inspection_records',
      'restock_requisitions',
    ];

    if (auth.currentUser.email === 'time165311@gmail.com') {
      publicCollections.push('users', 'admins', 'audit_logs');
    }

    await Promise.all(
      publicCollections.map(async (colName) => {
        try {
          const snap = await getDocs(collection(db, colName));
          snap.forEach((docSnap) => {
            docCount += 1;
            const data = docSnap.data() || {};
            usedBytes += calcDocBytes(docSnap.ref.path, data);
            const media = countMediaInDoc(data);
            embeddedMediaCount += media.count;
            embeddedMediaBytes += media.bytes;
            if (colName === 'channels') {
              channelIds.add(docSnap.id);
            }
          });
        } catch {
          // Skip inaccessible collection
        }
      })
    );

    await Promise.all(
      ['app_state', 'channels', 'config'].map(async (docId) => {
        try {
          const snap = await getDoc(doc(db, 'settings', docId));
          if (snap.exists()) {
            const data = snap.data() || {};
            docCount += 1;
            usedBytes += calcDocBytes(snap.ref.path, data);
            const media = countMediaInDoc(data);
            embeddedMediaCount += media.count;
            embeddedMediaBytes += media.bytes;
            if (docId === 'channels' && Array.isArray(data.channels)) {
              data.channels.forEach((ch: any) => {
                if (ch?.id) channelIds.add(String(ch.id));
              });
            }
          }
        } catch {
          // Skip missing/inaccessible settings doc
        }
      })
    );

    const subCollections = ['drugs', 'equipment', 'inspection_records', 'restock_requisitions'];
    for (const channelId of channelIds) {
      await Promise.all(
        subCollections.map(async (subName) => {
          try {
            const subSnap = await getDocs(collection(db, 'channels', channelId, subName));
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
