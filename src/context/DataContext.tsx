
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, WardChannel, CheckItemState, ListConfig, EquipmentItem, InspectionHistoryRecord } from '../types';
import { saveUserToFirebase } from '../services/firebase';
import {
  STORAGE_KEYS,
  getStored,
  setStored,
  getChannelDbKey,
  getChannelListsKey,
  getChannelChecksKey,
  getChannelWeekDatesKey,
  getStoredString,
  getInitialLists,
} from '../services/storage';

// Helper to deep clone and sanitize lists for a channel (retains items & subItems, but completely strips any check results)
export function sanitizeListsForChannel(sourceLists: Record<'bag' | 'cart', ListConfig>): Record<'bag' | 'cart', ListConfig> {
  const cloned: Record<'bag' | 'cart', ListConfig> = JSON.parse(JSON.stringify(sourceLists));
  (['bag', 'cart'] as const).forEach((catKey) => {
    const cat = cloned[catKey];
    if (cat && cat.groups) {
      Object.keys(cat.groups).forEach((groupName) => {
        cat.groups[groupName] = cat.groups[groupName].map((item: any) => {
          const {
            res,
            result,
            val,
            weekVals,
            weeklyStatus,
            checkState,
            status,
            checked,
            ...cleanItem
          } = item;
          return cleanItem;
        });
      });
    }
  });
  return cloned;
}

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
  batchAddItems: (type: 'bag' | 'cart', items: any[]) => void;
  addBatchItemsToChannel: (channelId: string, items: any[], type?: 'bag' | 'cart') => void;
  setItems: (type: 'bag' | 'cart', items: any[]) => void;
  reRenderData: () => void;

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

  // Channel Management States - Always ensure default channels exist
  const [channels, setChannels] = useState<WardChannel[]>(() => {
    const stored = getStored<WardChannel[]>(STORAGE_KEYS.CHANNELS, DEFAULT_CHANNELS);
    const existingIds = new Set(stored.map((c) => c.id));
    const merged = [...stored];
    let hasNew = false;
    DEFAULT_CHANNELS.forEach((def) => {
      if (!existingIds.has(def.id)) {
        merged.push(def);
        hasNew = true;
      }
    });
    if (hasNew && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(merged));
      localStorage.setItem('anesthesia_channels', JSON.stringify(merged));
    }
    return merged;
  });

  const [activeChannelId, setActiveChannelIdState] = useState<string>(() => {
    return getStoredString(STORAGE_KEYS.ACTIVE_CHANNEL_ID, getStoredString('anesthesia_active_channel_id', 'channel_master'));
  });

  // Channel Data - Guaranteed initial population from getInitialLists() with true isolation
  const [channelData, setChannelData] = useState<ChannelData>(() => {
    const initialActiveId = getStoredString(STORAGE_KEYS.ACTIVE_CHANNEL_ID, getStoredString('anesthesia_active_channel_id', 'channel_master'));
    const key = getChannelDbKey(initialActiveId);
    const stored = getStored<ChannelData | null>(key, null);
    if (stored && stored.lists && stored.lists.bag?.groups && Object.keys(stored.lists.bag.groups).length > 0) {
      return stored;
    }

    const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
    const initialLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
    const cleanLists = sanitizeListsForChannel(initialLists);

    const isMaster = initialActiveId === 'channel_master';
    const baseData: ChannelData = {
      lists: cleanLists,
      // Master keeps checks, but any other ward channel starts with 0 checked items ({})
      globalChecks: isMaster ? (masterData?.globalChecks || getStored(STORAGE_KEYS.GLOBAL_CHECKS, {})) : {},
      emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || getStored(STORAGE_KEYS.EMER_WEEK_DATES, {})) : {},
    };

    setStored(getChannelDbKey('channel_master'), isMaster ? baseData : (masterData || { lists: cleanLists, globalChecks: {}, emergencyWeekDates: {} }));
    setStored(key, baseData);
    setStored(getChannelListsKey(initialActiveId), cleanLists);
    setStored(getChannelChecksKey(initialActiveId), baseData.globalChecks);
    setStored(getChannelWeekDatesKey(initialActiveId), baseData.emergencyWeekDates);
    return baseData;
  });

  // One-time legacy cleanup for default non-master channels ('channel_opd', 'channel_ipd1')
  // Ensures any previously copied checks from Master are purged so readiness is 0/XX (0%)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const migrationKey = 'anesthesia_channel_isolation_v5';
    if (localStorage.getItem(migrationKey) !== 'true') {
      ['channel_opd', 'channel_ipd1'].forEach((chId) => {
        const key = getChannelDbKey(chId);
        const existing = getStored<ChannelData | null>(key, null);
        if (existing) {
          existing.globalChecks = {};
          existing.emergencyWeekDates = {};
          if (existing.lists) {
            existing.lists = sanitizeListsForChannel(existing.lists);
          }
          setStored(key, existing);
          setStored(getChannelChecksKey(chId), {});
          setStored(getChannelWeekDatesKey(chId), {});
        }
      });
      localStorage.setItem(migrationKey, 'true');
    }
  }, []);

  // Load channel data when channel switches with deep clone isolation & zero-check guarantee
  useEffect(() => {
    const key = getChannelDbKey(activeChannelId);
    const stored = getStored<ChannelData | null>(key, null);
    
    if (stored && stored.lists && stored.lists.bag?.groups && Object.keys(stored.lists.bag.groups).length > 0) {
      setChannelData(stored);
    } else {
      let masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
      const sourceLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
      const cleanLists = sanitizeListsForChannel(sourceLists);

      const isMaster = activeChannelId === 'channel_master';
      const newData: ChannelData = {
        lists: cleanLists,
        globalChecks: isMaster ? (masterData?.globalChecks || {}) : {},
        emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || {}) : {},
      };
      setChannelData(newData);
      setStored(key, newData);
      setStored(getChannelListsKey(activeChannelId), cleanLists);
      setStored(getChannelChecksKey(activeChannelId), newData.globalChecks);
      setStored(getChannelWeekDatesKey(activeChannelId), newData.emergencyWeekDates);
    }
  }, [activeChannelId]);

  const updateChannelData = (newData: Partial<ChannelData>) => {
    setChannelData((prev) => {
      const updated = { ...prev, ...newData };
      setStored(getChannelDbKey(activeChannelId), updated);
      if (newData.lists) {
        setStored(getChannelListsKey(activeChannelId), newData.lists);
      }
      if (newData.globalChecks) {
        setStored(getChannelChecksKey(activeChannelId), newData.globalChecks);
      }
      if (newData.emergencyWeekDates) {
        setStored(getChannelWeekDatesKey(activeChannelId), newData.emergencyWeekDates);
      }
      return updated;
    });
  };

  const activeChannel = React.useMemo(() => {
    const found = channels.find((c) => c.id === activeChannelId);
    if (found) return found;
    const def = DEFAULT_CHANNELS.find((c) => c.id === activeChannelId);
    if (def) return def;
    return channels[0] || DEFAULT_CHANNELS[0];
  }, [channels, activeChannelId]);

  const setActiveChannelId = (id: string) => {
    setActiveChannelIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHANNEL_ID, id);
      localStorage.setItem('anesthesia_active_channel_id', id);
      localStorage.setItem('active_channel_id', id);

      const key = getChannelDbKey(id);
      let targetData = getStored<ChannelData | null>(key, null);
      if (!targetData || !targetData.lists || !targetData.lists.bag?.groups) {
        const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
        const sourceLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
        const cleanLists = sanitizeListsForChannel(sourceLists);
        const isMaster = id === 'channel_master';
        targetData = {
          lists: cleanLists,
          globalChecks: isMaster ? (masterData?.globalChecks || {}) : {},
          emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || {}) : {},
        };
        setStored(key, targetData);
        setStored(getChannelListsKey(id), cleanLists);
        setStored(getChannelChecksKey(id), targetData.globalChecks);
        setStored(getChannelWeekDatesKey(id), targetData.emergencyWeekDates);
      }
      setChannelData(targetData);

      window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: id, data: targetData } }));
      window.dispatchEvent(new Event('storage'));
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(nextChannels));
      localStorage.setItem('anesthesia_channels', JSON.stringify(nextChannels));
    }

    // 1. Deep Clone Equipment Items Only: Clean all check properties (res, weekVals, etc.)
    const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
    const sourceLists = (masterData && masterData.lists) ? masterData.lists : (channelData.lists || getInitialLists());
    
    const cleanLists = duplicateFromMaster
      ? sanitizeListsForChannel(sourceLists)
      : {
          bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
          cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
        };

    // 2. EXPUNGE / RESET Check State 100% (Starts at 0 / XX (0%) readiness with zero checked items)
    const newChannelData: ChannelData = {
      lists: cleanLists,
      globalChecks: {}, // 100% Empty
      emergencyWeekDates: {}, // 100% Empty
    };

    setStored(getChannelDbKey(newId), newChannelData);
    setStored(getChannelListsKey(newId), cleanLists);
    setStored(getChannelChecksKey(newId), {});
    setStored(getChannelWeekDatesKey(newId), {});

    // 3. Switch to the newly created channel immediately
    setActiveChannelId(newId);
    setChannelData(newChannelData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: newId, data: newChannelData } }));
      window.dispatchEvent(new Event('storage'));
    }

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

  const addBatchItemsToChannel = (channelId: string, newItems: any[], targetType: 'bag' | 'cart' = 'bag') => {
    const targetChannelId = channelId || activeChannelId || 'channel_master';
    const key = getChannelDbKey(targetChannelId);

    setChannelData((prev) => {
      const currentChannelData = targetChannelId === activeChannelId ? prev : (getStored<ChannelData | null>(key, null) || prev);
      const currentList = currentChannelData.lists?.[targetType] || {
        title: targetType === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน',
        sheet: targetType === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency',
        groups: {},
      };

      const updatedGroups: Record<string, EquipmentItem[]> = { ...(currentList.groups || {}) };
      const defaultGroupName = 'อุปกรณ์และเวชภัณฑ์ฉุกเฉิน';

      newItems.forEach((item, index) => {
        const groupName = item.groupName || item.category || item.group || defaultGroupName;
        if (!updatedGroups[groupName]) {
          updatedGroups[groupName] = [];
        }

        const formattedItem: EquipmentItem = {
          id: item.id || `${targetType}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
          name: item.name || `รายการที่ ${index + 1}`,
          qty: String(item.unitText || item.qty || '1'),
          unitText: String(item.unitText || item.qty || '1'),
          groupName,
          location: item.location || groupName,
          category: groupName,
          exp: item.exp || item.expDate || '-',
          code: item.code || `OCR-${Math.floor(1000 + Math.random() * 9000)}`,
          spec: item.spec || 'มาตรฐานทางการแพทย์',
          subItems: Array.isArray(item.subItems) && item.subItems.length > 0 ? item.subItems : undefined,
          subItemQuantities: Array.isArray(item.subItemQuantities) && item.subItemQuantities.length > 0
            ? item.subItemQuantities
            : (Array.isArray(item.subItems) && item.subItems.length > 0 ? item.subItems.map(() => 1) : undefined),
          checkType: Array.isArray(item.subItems) && item.subItems.length > 1 ? 'sub_items' : 'single',
        };

        updatedGroups[groupName].push(formattedItem);
      });

      const updatedLists = {
        ...currentChannelData.lists,
        [targetType]: {
          ...currentList,
          groups: updatedGroups,
        },
      };

      const nextChannelData: ChannelData = {
        ...currentChannelData,
        lists: updatedLists,
      };

      // Persist immediately to localStorage
      setStored(key, nextChannelData);
      setStored(getChannelListsKey(targetChannelId), updatedLists);
      if (targetChannelId === 'channel_master') {
        setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      }

      // Dispatch global events for instant reactive UI updates without page reload
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: targetChannelId, data: nextChannelData } }));
        window.dispatchEvent(new CustomEvent('items_updated', { detail: { type: targetType, count: newItems.length } }));
        window.dispatchEvent(new Event('storage'));
      }

      return targetChannelId === activeChannelId ? nextChannelData : prev;
    });
  };

  const batchAddItems = (type: 'bag' | 'cart', items: any[]) => {
    addBatchItemsToChannel(activeChannelId, items, type);
  };

  const setItems = (type: 'bag' | 'cart', items: any[]) => {
    addBatchItemsToChannel(activeChannelId, items, type);
  };

  const reRenderData = () => {
    const key = getChannelDbKey(activeChannelId);
    const stored = getStored<ChannelData | null>(key, null);
    if (stored) {
      setChannelData({ ...stored });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: activeChannelId } }));
      window.dispatchEvent(new Event('storage'));
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
        batchAddItems,
        addBatchItemsToChannel,
        setItems,
        reRenderData,
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
      batchAddItems: (type, items) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('items_updated', { detail: { type, count: items.length } }));
        }
      },
      addBatchItemsToChannel: (channelId, items, type = 'bag') => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('items_updated', { detail: { type, count: items.length } }));
        }
      },
      setItems: (type, items) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('items_updated', { detail: { type, count: items.length } }));
        }
      },
      reRenderData: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('channel_data_updated'));
          window.dispatchEvent(new Event('storage'));
        }
      },
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

