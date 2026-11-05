
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, WardChannel, CheckItemState, ListConfig, EquipmentItem, InspectionHistoryRecord } from '../types';
import { saveUserToFirebase } from '../services/firebase';
import { STORAGE_KEYS, getStored, setStored, getChannelDbKey } from '../services/storage';

// Placeholder for now, will need to be imported or refactored
export const DEFAULT_CHANNELS: WardChannel[] = [
  { id: 'channel_master', name: 'คลินิกวิสัญญี (Master)', isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'channel_opd', name: 'วอร์ด OPD', isDefault: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'channel_ipd1', name: 'วอร์ด IPD 1', isDefault: false, createdAt: '2026-01-01T00:00:00.000Z' },
];

export interface ChannelData {
  lists: Record<'bag' | 'cart', ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  emergencyWeekDates: Record<string, Record<number, string>>;
}

export interface DataContextType {
  userName: string;
  setUserName: (name: string) => void;
  userPosition: string;
  setUserPosition: (pos: string) => void;
  userProfile: User | null;
  setUserProfile: (user: User | null) => void;
  saveUserProfile: (name: string, position: string, avatar?: string) => Promise<User>;

  // Multi-Channel / Multi-Ward Management
  channels: WardChannel[];
  activeChannelId: string;
  activeChannel: WardChannel;
  setActiveChannelId: (id: string) => void;
  addChannel: (name: string, duplicateFromMaster?: boolean) => WardChannel;
  removeChannel: (id: string) => void;
  renameChannel: (id: string, newName: string) => void;

  // Isolated Data
  channelData: ChannelData;
  updateChannelData: (newData: Partial<ChannelData>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ... (User state management remains same)
  // [Cut down to essential]
  const [userName, setUserNameState] = useState<string>('สาธิต');
  const [userPosition, setUserPositionState] = useState<string>('พยาบาลวิสัญญี');
  const [userProfile, setUserProfileState] = useState<User | null>(null);

  // Channel Management States
  const [channels, setChannels] = useState<WardChannel[]>(DEFAULT_CHANNELS);
  const [activeChannelId, setActiveChannelIdState] = useState<string>('channel_master');

  const [channelData, setChannelData] = useState<ChannelData>({
    lists: {
      bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
      cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
    },
    globalChecks: {},
    emergencyWeekDates: {}
  });

  // Load channel data when channel switches
  useEffect(() => {
    const key = getChannelDbKey(activeChannelId);
    const stored = getStored<ChannelData | null>(key, null);
    
    if (stored) {
      setChannelData(stored);
    } else {
      // Auto-Clone Logic: If channel data is missing, clone Master Data
      const masterData = getStored<ChannelData>(getChannelDbKey('channel_master'), {
        lists: {
          bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
          cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
        },
        globalChecks: {},
        emergencyWeekDates: {}
      });
      
      const newData = { ...masterData };
      setChannelData(newData);
      setStored(key, newData);
    }
  }, [activeChannelId]);

  const updateChannelData = (newData: Partial<ChannelData>) => {
    const updated = { ...channelData, ...newData };
    setChannelData(updated);
    setStored(getChannelDbKey(activeChannelId), updated);
  };

  const activeChannel = React.useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || channels[0] || DEFAULT_CHANNELS[0];
  }, [channels, activeChannelId]);

  const setActiveChannelId = (id: string) => {
    setActiveChannelIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('anesthesia_active_channel_id', id);
    }
  };

  const addChannel = (name: string, duplicateFromMaster: boolean = true): WardChannel => {
    const newId = `channel_${Date.now()}`;
    const newChan: WardChannel = {
      id: newId,
      name: name.trim(),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    const nextChannels = [...channels, newChan];
    setChannels(nextChannels);

    // Clone logic:
    if (duplicateFromMaster) {
      const masterData = getStored(getChannelDbKey('channel_master'), channelData);
      setStored(getChannelDbKey(newId), masterData);
    }

    setActiveChannelId(newId);
    return newChan;
  };

  const removeChannel = (id: string) => {
    const target = channels.find((c) => c.id === id);
    if (!target || target.isDefault) {
      alert('ไม่สามารถลบ Channel หลัก (Master) ได้');
      return;
    }
    const nextChannels = channels.filter((c) => c.id !== id);
    setChannels(nextChannels);
    if (typeof window !== 'undefined') {
      localStorage.setItem('anesthesia_channels', JSON.stringify(nextChannels));
      localStorage.removeItem(getChannelDbKey(id));
    }
    if (activeChannelId === id) {
      setActiveChannelId('channel_master');
    }
  };

  const renameChannel = (id: string, newName: string) => {
    const nextChannels = channels.map((c) => (c.id === id ? { ...c, name: newName.trim() } : c));
    setChannels(nextChannels);
    if (typeof window !== 'undefined') {
      localStorage.setItem('anesthesia_channels', JSON.stringify(nextChannels));
    }
  };

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
        channels,
        activeChannelId,
        activeChannel,
        setActiveChannelId,
        addChannel,
        removeChannel,
        renameChannel,
        channelData,
        updateChannelData
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
      channels: DEFAULT_CHANNELS,
      activeChannelId: 'channel_master',
      activeChannel: DEFAULT_CHANNELS[0],
      setActiveChannelId: () => {},
      addChannel: (n) => ({ id: `channel_${Date.now()}`, name: n, isDefault: false, createdAt: '' }),
      removeChannel: () => {},
      renameChannel: () => {},
      channelData: {
        lists: {
          bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
          cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
        },
        globalChecks: {},
        emergencyWeekDates: {},
      },
      updateChannelData: () => {},
    };
  }
  return context;
};

export default DataContext;

