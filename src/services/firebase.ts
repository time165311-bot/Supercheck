import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import config from '../../firebase-applet-config.json';
import { User, AuditLogEntry, InspectionHistoryRecord } from '../types';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore targeting the provisioned database ID
export const db = getFirestore(app);

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
  const isOffline = errMsg.includes('offline') || errMsg.includes('Failed to get document because the client is offline');
  const errInfo: FirestoreErrorInfo = {
    error: isOffline ? 'Firestore is currently offline' : errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Firestore Log: ', JSON.stringify(errInfo));
  if (!isOffline) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Real-time listener for Inspection Records
export async function subscribeInspectionHistory(callback: (records: InspectionHistoryRecord[]) => void) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'inspection_records';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const records: InspectionHistoryRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as InspectionHistoryRecord);
        });
        callback(records);
      },
      (err) => {
        if (err.message.includes('offline')) {
          console.warn('Firestore subscription notice: client is offline');
          return;
        }
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// Save inspection record to Firebase Firestore
export async function saveInspectionToFirebase(record: InspectionHistoryRecord) {
  if (authReadyPromise) await authReadyPromise;
  const path = `inspection_records/${record.id}`;
  try {
    const docRef = doc(db, 'inspection_records', record.id);
    await setDoc(docRef, record, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Delete inspection record from Firebase Firestore
export async function deleteInspectionFromFirebase(id: string): Promise<boolean> {
  if (authReadyPromise) await authReadyPromise;
  const path = `inspection_records/${id}`;
  try {
    const docRef = doc(db, 'inspection_records', id);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// Fetch all inspection records from Firebase
export async function fetchInspectionsFromFirebase(): Promise<InspectionHistoryRecord[]> {
  if (authReadyPromise) await authReadyPromise;
  const path = 'inspection_records';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    const records: InspectionHistoryRecord[] = [];
    snap.forEach((d) => {
      records.push(d.data() as InspectionHistoryRecord);
    });
    return records;
  } catch (e: any) {
    if (e?.message?.includes('offline')) return [];
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

// Real-time listener for Audit Logs
export async function subscribeAuditLogs(callback: (logs: AuditLogEntry[]) => void) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'audit_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          logs.push(docSnap.data() as AuditLogEntry);
        });
        callback(logs);
      },
      (err) => {
        if (err.message.includes('offline')) {
          console.warn('Firestore subscription notice: client is offline');
          return;
        }
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// Add audit log to Firebase
export async function addAuditLogToFirebase(log: AuditLogEntry) {
  if (authReadyPromise) await authReadyPromise;
  const path = `audit_logs/${log.id}`;
  try {
    const docRef = doc(db, 'audit_logs', log.id);
    await setDoc(docRef, log);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Delete single audit log from Firebase
export async function deleteAuditLogInFirebase(id: string) {
  if (authReadyPromise) await authReadyPromise;
  const path = `audit_logs/${id}`;
  try {
    const docRef = doc(db, 'audit_logs', id);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// Clear all audit logs from Firebase
export async function clearAllAuditLogsInFirebase() {
  if (authReadyPromise) await authReadyPromise;
  const path = 'audit_logs';
  try {
    const snap = await getDocs(collection(db, path));
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
    return false;
  }
}

// Sync users collection to Firebase
export async function syncUsersToFirebase(users: User[]) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'users';
  try {
    const batch = writeBatch(db);
    users.forEach((user) => {
      const docRef = doc(db, 'users', user.id);
      batch.set(docRef, user, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Fetch users from Firebase
export async function fetchUsersFromFirebase(): Promise<User[]> {
  if (authReadyPromise) await authReadyPromise;
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const users: User[] = [];
    snap.forEach((d) => {
      users.push(d.data() as User);
    });
    return users;
  } catch (e: any) {
    if (e?.message?.includes('offline')) return [];
    handleFirestoreError(e, OperationType.LIST, path);
    return [];
  }
}

// Save app settings to Firebase
export async function saveSettingsToFirebase(settings: {
  sheetUrl?: string;
  theme?: string;
  updatedAt?: string;
}) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/config';
  try {
    const docRef = doc(db, 'settings', 'config');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Load app settings from Firebase
export async function loadSettingsFromFirebase(): Promise<{ sheetUrl?: string; theme?: string } | null> {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/config';
  try {
    const docRef = doc(db, 'settings', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as { sheetUrl?: string; theme?: string };
    }
    return null;
  } catch (e: any) {
    if (e?.message?.includes('offline')) return null;
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

// Sync Global Checks to Firebase
export async function saveGlobalChecksToFirebase(data: Record<string, any>) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/global_checks';
  try {
    const docRef = doc(db, 'settings', 'global_checks');
    await setDoc(docRef, { data, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Load Global Checks from Firebase
export async function loadGlobalChecksFromFirebase(): Promise<Record<string, any> | null> {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/global_checks';
  try {
    const docRef = doc(db, 'settings', 'global_checks');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().data;
    }
    return null;
  } catch (e: any) {
    if (e?.message?.includes('offline')) return null;
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}

// Sync Last Submitted to Firebase
export async function saveLastSubmittedToFirebase(data: Record<string, string>) {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/last_submitted';
  try {
    const docRef = doc(db, 'settings', 'last_submitted');
    await setDoc(docRef, { data, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
    return false;
  }
}

// Load Last Submitted from Firebase
export async function loadLastSubmittedFromFirebase(): Promise<Record<string, string> | null> {
  if (authReadyPromise) await authReadyPromise;
  const path = 'settings/last_submitted';
  try {
    const docRef = doc(db, 'settings', 'last_submitted');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().data;
    }
    return null;
  } catch (e: any) {
    if (e?.message?.includes('offline')) return null;
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
}
