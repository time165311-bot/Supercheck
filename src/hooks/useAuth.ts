import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, signInWithGooglePopup, signOutFirebase } from '../services/firebase';
import { clearCachedApiSessionToken } from '../services/aiService';
import { STORAGE_KEYS, setStored } from '../services/storage';
import type { User } from '../types';

const BOOTSTRAPPED_ADMIN_EMAIL = 'time165311@gmail.com';

export interface UseAuthResult {
  firebaseUser: FirebaseAuthUser | null;
  authReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

export function useAuth(
  onUserSynced?: (user: User) => void
): UseAuthResult {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'ออกจากระบบไม่สำเร็จ');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return {
    firebaseUser,
    authReady,
    isAuthenticated: Boolean(firebaseUser),
    isAdmin,
    authLoading,
    authError,
    signInWithGoogle,
    signOut,
  };
}
