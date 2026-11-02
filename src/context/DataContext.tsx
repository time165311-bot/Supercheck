import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { saveUserToFirebase } from '../services/firebase';

interface DataContextType {
  userName: string;
  setUserName: (name: string) => void;
  userPosition: string;
  setUserPosition: (pos: string) => void;
  userProfile: User | null;
  setUserProfile: (user: User | null) => void;
  saveUserProfile: (name: string, position: string, avatar?: string) => Promise<User>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userName, setUserNameState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_display_name') || localStorage.getItem('user_name_default') || 'สาธิต';
    }
    return 'สาธิต';
  });

  const [userPosition, setUserPositionState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_display_position') || localStorage.getItem('user_position_default') || 'พยาบาลวิสัญญี';
    }
    return 'พยาบาลวิสัญญี';
  });

  const [userProfile, setUserProfileState] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('anesthesia_session');
        if (raw) return JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }
    return {
      id: 'usr_admin',
      username: 'admin',
      name: 'สาธิต',
      role: 'admin',
      position: 'วิสัญญีแพทย์',
      active: true,
      salt: '',
      hash: '',
      must: false,
      created: new Date().toISOString(),
      last: new Date().toISOString(),
    };
  });

  const setUserName = (name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_display_name', trimmed);
      localStorage.setItem('user_name_default', trimmed);
    }
    setUserProfileState((prev) => (prev ? { ...prev, name: trimmed } : null));
    window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: { name: trimmed } }));
  };

  const setUserPosition = (pos: string) => {
    const trimmed = pos.trim();
    setUserPositionState(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_display_position', trimmed);
      localStorage.setItem('user_position_default', trimmed);
    }
    setUserProfileState((prev) => (prev ? { ...prev, position: trimmed } : null));
  };

  const setUserProfile = (user: User | null) => {
    setUserProfileState(user);
    if (user) {
      if (user.name) {
        setUserNameState(user.name);
        localStorage.setItem('user_display_name', user.name);
      }
      if (user.position) {
        setUserPositionState(user.position);
        localStorage.setItem('user_display_position', user.position);
      }
      try {
        localStorage.setItem('anesthesia_session', JSON.stringify(user));
      } catch (e) {}
    }
  };

  const saveUserProfile = async (name: string, position: string, avatar?: string): Promise<User> => {
    const trimmedName = name.trim() || 'สาธิต';
    const trimmedPos = position.trim() || 'พยาบาลวิสัญญี';

    localStorage.setItem('user_display_name', trimmedName);
    localStorage.setItem('user_display_position', trimmedPos);
    localStorage.setItem('user_name_default', trimmedName);
    localStorage.setItem('user_position_default', trimmedPos);

    const updatedUser: User = {
      ...(userProfile || {
        id: 'usr_admin',
        username: 'admin',
        role: 'admin',
        active: true,
        salt: '',
        hash: '',
        must: false,
        created: new Date().toISOString(),
        last: new Date().toISOString(),
      }),
      name: trimmedName,
      position: trimmedPos,
      avatar: avatar !== undefined ? avatar : userProfile?.avatar || '',
    };

    setUserNameState(trimmedName);
    setUserPositionState(trimmedPos);
    setUserProfileState(updatedUser);

    try {
      localStorage.setItem('anesthesia_session', JSON.stringify(updatedUser));
    } catch (e) {}

    try {
      await saveUserToFirebase(updatedUser);
    } catch (err) {
      console.warn('Firebase user sync skipped or offline:', err);
    }

    window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: updatedUser }));
    window.dispatchEvent(new CustomEvent('user_avatar_ring_updated'));
    window.dispatchEvent(new Event('storage'));

    return updatedUser;
  };

  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      const detail = e.detail;
      if (detail && detail.name) {
        setUserNameState(detail.name);
      }
      if (detail && detail.position) {
        setUserPositionState(detail.position);
      }
      if (detail && detail.id) {
        setUserProfileState((prev) => ({ ...(prev || {}), ...detail }));
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('user_profile_updated', handleProfileUpdated);
  }, []);

  return (
    <DataContext.Provider
      value={{
        userName,
        setUserName,
        userPosition,
        setUserPosition,
        userProfile,
        setUserProfile,
        saveUserProfile,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    // Return safe fallback if not wrapped in provider
    const fallbackName = typeof window !== 'undefined' ? (localStorage.getItem('user_display_name') || 'สาธิต') : 'สาธิต';
    const fallbackPos = typeof window !== 'undefined' ? (localStorage.getItem('user_display_position') || 'พยาบาลวิสัญญี') : 'พยาบาลวิสัญญี';
    return {
      userName: fallbackName,
      setUserName: (n) => {
        if (typeof window !== 'undefined') localStorage.setItem('user_display_name', n);
        window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: { name: n } }));
      },
      userPosition: fallbackPos,
      setUserPosition: (p) => {
        if (typeof window !== 'undefined') localStorage.setItem('user_display_position', p);
      },
      userProfile: null,
      setUserProfile: () => {},
      saveUserProfile: async (n, p, a) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('user_display_name', n);
          localStorage.setItem('user_display_position', p);
        }
        return { id: 'usr_admin', username: 'admin', name: n, role: 'admin', position: p, active: true, salt: '', hash: '', must: false, created: '', last: '', avatar: a };
      },
    };
  }
  return context;
};

export default DataContext;
