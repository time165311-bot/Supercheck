import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, signInWithGooglePopup, signOutFirebase } from '../services/firebase';
import { clearCachedApiSessionToken } from '../services/aiService';
import { STORAGE_KEYS, setStored } from '../services/storage';
import type { User } from '../types';

const BOOTSTRAPPED_ADMIN_EMAIL = 'time165311@gmail.com';

export interface AdminPasscodeActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  retryAfterSec?: number;
}

export interface UseAuthResult {
  firebaseUser: FirebaseAuthUser | null;
  authReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdminUnlocked: boolean;
  hasAdminAccess: boolean;
  superAdminToken: string | null;
  adminPasscodeConfigured: boolean | null;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  fetchAdminPasscodeStatus: () => Promise<boolean | null>;
  setupMasterPasscode: (passcode: string) => Promise<AdminPasscodeActionResult>;
  verifyMasterPasscode: (passcode: string) => Promise<AdminPasscodeActionResult>;
  changeMasterPasscode: (
    newPasscode: string,
    currentPasscode?: string
  ) => Promise<AdminPasscodeActionResult>;
  lockSuperAdmin: () => void;
}

export function useAuth(
  onUserSynced?: (user: User) => void
): UseAuthResult {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Strictly in-memory Super Admin passcode unlock state (ZERO localStorage/sessionStorage persistence)
  const [isSuperAdminUnlocked, setIsSuperAdminUnlocked] = useState<boolean>(false);
  const [superAdminToken, setSuperAdminToken] = useState<string | null>(null);
  const [superAdminExpiresAt, setSuperAdminExpiresAt] = useState<number | null>(null);
  const [adminPasscodeConfigured, setAdminPasscodeConfigured] = useState<boolean | null>(null);

  // Clean up any legacy leftover storage keys if any existed in older builds
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('super_admin_token');
        sessionStorage.removeItem('super_admin_token');
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Auto-lock in memory once server-issued expiry passes
  useEffect(() => {
    if (!isSuperAdminUnlocked || !superAdminExpiresAt) return;
    const msLeft = superAdminExpiresAt - Date.now();
    if (msLeft <= 0) {
      setIsSuperAdminUnlocked(false);
      setSuperAdminToken(null);
      setSuperAdminExpiresAt(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsSuperAdminUnlocked(false);
      setSuperAdminToken(null);
      setSuperAdminExpiresAt(null);
    }, msLeft);
    return () => window.clearTimeout(timer);
  }, [isSuperAdminUnlocked, superAdminExpiresAt]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        clearCachedApiSessionToken();
        setFirebaseUser(fbUser);

        if (fbUser) {
          const emailLower = (fbUser.email || '').toLowerCase().trim();
          let resolvedAdmin = emailLower === BOOTSTRAPPED_ADMIN_EMAIL && Boolean(fbUser.emailVerified);

          if (!resolvedAdmin) {
            try {
              const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid));
              if (adminSnap.exists()) {
                resolvedAdmin = true;
              }
            } catch {
              // Ignore admin lookup failure if offline or unpermitted
            }
          }

          setIsAdmin(resolvedAdmin);

          // Personal operator profile stays device-local first; fallback to Google displayName only if unset
          const savedDisplayName =
            typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
          const savedPosition =
            typeof window !== 'undefined' ? localStorage.getItem('user_display_position') : null;
          const nowIso = new Date().toISOString();

          const cleanUser: User = {
            id: fbUser.uid,
            uid: fbUser.uid,
            email: fbUser.email || undefined,
            username: (fbUser.email || fbUser.uid).split('@')[0],
            name: savedDisplayName || fbUser.displayName || fbUser.email || 'สาธิต',
            role: resolvedAdmin ? 'admin' : 'user',
            position: savedPosition || (resolvedAdmin ? 'หัวหน้าพยาบาลวิสัญญี' : 'พยาบาลวิสัญญี'),
            avatar: fbUser.photoURL || undefined,
            active: true,
            must: false,
            created: fbUser.metadata?.creationTime || nowIso,
            last: nowIso,
          };

          setStored(STORAGE_KEYS.SESSION, cleanUser);
          onUserSynced?.(cleanUser);
        } else {
          setIsAdmin(false);
        }

        setAuthReady(true);
      },
      (err) => {
        console.warn('Auth state listener warning:', err);
        setAuthReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchAdminPasscodeStatus = useCallback(async (): Promise<boolean | null> => {
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      if (res.ok && typeof data?.configured === 'boolean') {
        setAdminPasscodeConfigured(data.configured);
        return data.configured;
      }
    } catch {
      // Ignore transient network errors
    }
    return null;
  }, []);

  const setupMasterPasscode = useCallback(async (passcode: string): Promise<AdminPasscodeActionResult> => {
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.token) {
        return {
          ok: false,
          error: data?.error || 'SETUP_FAILED',
          message: data?.message || 'ตั้งรหัสผ่าน Master 6 หลักไม่สำเร็จ',
        };
      }
      setAdminPasscodeConfigured(true);
      setSuperAdminToken(data.token);
      setSuperAdminExpiresAt(typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + 3600_000);
      setIsSuperAdminUnlocked(true);
      return { ok: true, message: data.message };
    } catch (err: any) {
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        message: err?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
      };
    }
  }, []);

  const verifyMasterPasscode = useCallback(async (passcode: string): Promise<AdminPasscodeActionResult> => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.token) {
        return {
          ok: false,
          error: data?.error || 'VERIFY_FAILED',
          retryAfterSec: typeof data?.retryAfterSec === 'number' ? data.retryAfterSec : undefined,
          message: data?.message || 'รหัสผ่าน 6 หลักไม่ถูกต้อง',
        };
      }
      setAdminPasscodeConfigured(true);
      setSuperAdminToken(data.token);
      setSuperAdminExpiresAt(typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + 3600_000);
      setIsSuperAdminUnlocked(true);
      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        message: err?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
      };
    }
  }, []);

  const changeMasterPasscode = useCallback(
    async (newPasscode: string, currentPasscode?: string): Promise<AdminPasscodeActionResult> => {
      try {
        let bearer = superAdminToken;
        if (!bearer && firebaseUser) {
          bearer = await firebaseUser.getIdToken();
        }
        if (!bearer) {
          return {
            ok: false,
            error: 'UNAUTHORIZED',
            message: 'กรุณาปลดล็อกสิทธิ์ผู้ดูแลระบบก่อนเปลี่ยนรหัส',
          };
        }

        const res = await fetch('/api/admin/change-passcode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({
            newPasscode: newPasscode.trim(),
            ...(currentPasscode ? { currentPasscode: currentPasscode.trim() } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          return {
            ok: false,
            error: data?.error || 'CHANGE_FAILED',
            message: data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ',
          };
        }
        if (data.token) {
          setSuperAdminToken(data.token);
          setSuperAdminExpiresAt(
            typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + 3600_000
          );
          setIsSuperAdminUnlocked(true);
        }
        return { ok: true, message: data.message };
      } catch (err: any) {
        return {
          ok: false,
          error: 'NETWORK_ERROR',
          message: err?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        };
      }
    },
    [superAdminToken, firebaseUser]
  );

  const lockSuperAdmin = useCallback(() => {
    setIsSuperAdminUnlocked(false);
    setSuperAdminToken(null);
    setSuperAdminExpiresAt(null);
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const fbUser = await signInWithGooglePopup();
      clearCachedApiSessionToken();
      const emailLower = (fbUser.email || '').toLowerCase().trim();
      const resolvedAdmin = emailLower === BOOTSTRAPPED_ADMIN_EMAIL && Boolean(fbUser.emailVerified);
      const nowIso = new Date().toISOString();
      const savedDisplayName =
        typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
      const savedPosition =
        typeof window !== 'undefined' ? localStorage.getItem('user_display_position') : null;

      const cleanUser: User = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email || undefined,
        username: (fbUser.email || fbUser.uid).split('@')[0],
        name: savedDisplayName || fbUser.displayName || fbUser.email || 'เจ้าหน้าที่วิสัญญี',
        role: resolvedAdmin ? 'admin' : 'user',
        position: savedPosition || (resolvedAdmin ? 'หัวหน้าพยาบาลวิสัญญี' : 'พยาบาลวิสัญญี'),
        avatar: fbUser.photoURL || undefined,
        active: true,
        must: false,
        created: fbUser.metadata?.creationTime || nowIso,
        last: nowIso,
      };
      setStored(STORAGE_KEYS.SESSION, cleanUser);
      onUserSynced?.(cleanUser);
      return cleanUser;
    } catch (err: any) {
      const msg = err?.code === 'auth/popup-closed-by-user'
        ? 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว'
        : err?.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง';
      setAuthError(msg);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [onUserSynced]);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOutFirebase();
      clearCachedApiSessionToken();
      lockSuperAdmin();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'ออกจากระบบไม่สำเร็จ');
    } finally {
      setAuthLoading(false);
    }
  }, [lockSuperAdmin]);

  return {
    firebaseUser,
    authReady,
    isAuthenticated: Boolean(firebaseUser),
    isAdmin,
    isSuperAdminUnlocked,
    hasAdminAccess: isAdmin || isSuperAdminUnlocked,
    superAdminToken,
    adminPasscodeConfigured,
    authLoading,
    authError,
    signInWithGoogle,
    signOut,
    fetchAdminPasscodeStatus,
    setupMasterPasscode,
    verifyMasterPasscode,
    changeMasterPasscode,
    lockSuperAdmin,
  };
}
