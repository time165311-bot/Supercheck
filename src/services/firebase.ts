import { initializeApp, getApps } from 'firebase/app';
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

// Initialize Firestore targeting the provisioned database ID
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

// Validate connection on boot
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'config'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is connecting offline or initial setup pending.');
    }
  }
})();

// Real-time listener for Inspection Records
export function subscribeInspectionHistory(callback: (records: InspectionHistoryRecord[]) => void) {
  try {
    const q = query(collection(db, 'inspection_records'), orderBy('timestamp', 'desc'), limit(50));
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
        console.warn('Firestore subscription fallback:', err.message);
      }
    );
  } catch (e) {
    console.warn('Failed to start Firestore subscription:', e);
    return () => {};
  }
}

// Save inspection record to Firebase Firestore
export async function saveInspectionToFirebase(record: InspectionHistoryRecord) {
  try {
    const docRef = doc(db, 'inspection_records', record.id);
    await setDoc(docRef, record, { merge: true });
    return true;
  } catch (e) {
    console.error('Error saving inspection to Firebase:', e);
    return false;
  }
}

// Delete inspection record from Firebase Firestore
export async function deleteInspectionFromFirebase(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'inspection_records', id);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.error('Error deleting inspection from Firebase:', e);
    return false;
  }
}

// Fetch all inspection records from Firebase
export async function fetchInspectionsFromFirebase(): Promise<InspectionHistoryRecord[]> {
  try {
    const q = query(collection(db, 'inspection_records'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    const records: InspectionHistoryRecord[] = [];
    snap.forEach((d) => {
      records.push(d.data() as InspectionHistoryRecord);
    });
    return records;
  } catch (e) {
    console.warn('Could not fetch from Firebase:', e);
    return [];
  }
}

// Real-time listener for Audit Logs
export function subscribeAuditLogs(callback: (logs: AuditLogEntry[]) => void) {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
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
        console.warn('Firestore audit logs subscription error:', err.message);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// Add audit log to Firebase
export async function addAuditLogToFirebase(log: AuditLogEntry) {
  try {
    const docRef = doc(db, 'audit_logs', log.id);
    await setDoc(docRef, log);
    return true;
  } catch (e) {
    console.error('Error saving audit log to Firebase:', e);
    return false;
  }
}

// Delete single audit log from Firebase
export async function deleteAuditLogInFirebase(id: string) {
  try {
    const docRef = doc(db, 'audit_logs', id);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.warn('Error deleting audit log in Firebase:', e);
    return false;
  }
}

// Clear all audit logs from Firebase
export async function clearAllAuditLogsInFirebase() {
  try {
    const snap = await getDocs(collection(db, 'audit_logs'));
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (e) {
    console.warn('Error clearing audit logs in Firebase:', e);
    return false;
  }
}

// Sync users collection to Firebase
export async function syncUsersToFirebase(users: User[]) {
  try {
    const batch = writeBatch(db);
    users.forEach((user) => {
      const docRef = doc(db, 'users', user.id);
      batch.set(docRef, user, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error('Error syncing users to Firebase:', e);
    return false;
  }
}

// Fetch users from Firebase
export async function fetchUsersFromFirebase(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    snap.forEach((d) => {
      users.push(d.data() as User);
    });
    return users;
  } catch (e) {
    console.warn('Could not fetch users from Firebase:', e);
    return [];
  }
}

// Save app settings to Firebase
export async function saveSettingsToFirebase(settings: {
  sheetUrl?: string;
  theme?: string;
  updatedAt?: string;
}) {
  try {
    const docRef = doc(db, 'settings', 'config');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.error('Error saving settings to Firebase:', e);
    return false;
  }
}

// Load app settings from Firebase
export async function loadSettingsFromFirebase(): Promise<{ sheetUrl?: string; theme?: string } | null> {
  try {
    const docRef = doc(db, 'settings', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as { sheetUrl?: string; theme?: string };
    }
    return null;
  } catch (e) {
    console.warn('Could not load settings from Firebase:', e);
    return null;
  }
}
