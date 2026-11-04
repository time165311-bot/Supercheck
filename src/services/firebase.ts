import { initializeApp, getApps } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
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
import firebaseConfig from '../../firebase-applet-config.json';
import { User, AuditLogEntry, InspectionHistoryRecord, EquipmentItem, DrugItem } from '../types';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with inMemoryPersistence to avoid securetoken token refresh network errors
export const auth = getAuth(app);
try {
  setPersistence(auth, inMemoryPersistence).catch(() => {});
} catch (e) {
  // Ignore
}

// Initialize Firestore targeting the provisioned database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Export a promise that resolves when auth is ready (no-op as anonymous auth is not enabled)
export const authReadyPromise: Promise<void> = Promise.resolve();

// Standardized Firestore Error Handling as per system skills
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
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrAuth = 
    errMsg.includes('offline') || 
    errMsg.includes('Failed to get document because the client is offline') ||
    errMsg.includes('Could not reach Cloud Firestore backend') ||
    errMsg.includes('securetoken.googleapis.com') ||
    errMsg.includes('token-service-api') ||
    errMsg.includes('Fetching auth token failed');

  const errInfo: FirestoreErrorInfo = {
    error: isOfflineOrAuth ? 'Firestore is currently in offline mode' : errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Firestore Log: ', JSON.stringify(errInfo));
  if (!isOfflineOrAuth) {
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
  const id = item.id || `eq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const path = `equipment/${id}`;
  try {
    const cleanPayload = sanitizeForFirestore({ ...item, id });
    await setDoc(doc(db, 'equipment', id), cleanPayload, { merge: true });
    return { ...item, id };
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return null;
  }
}

export async function deleteEquipmentItemInFirebase(id: string) {
  const path = `equipment/${id}`;
  try {
    await deleteDoc(doc(db, 'equipment', id));
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
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
  const path = `drugs/${item.id}`;
  try {
    const cleanPayload = sanitizeForFirestore(item);
    await setDoc(doc(db, 'drugs', item.id), cleanPayload, { merge: true });
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
  const path = `users/${user.id}`;
  try {
    const cleanPayload = sanitizeForFirestore(user);
    await setDoc(doc(db, 'users', user.id), cleanPayload, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
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
