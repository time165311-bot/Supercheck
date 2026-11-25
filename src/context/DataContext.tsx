
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, WardChannel, CheckItemState, ListConfig, EquipmentItem, InspectionHistoryRecord } from '../types';
import {
  auth,
  authReadyPromise,
  saveUserToFirebase,
  saveChannelsToFirebase,
  fetchChannelsFromFirebase,
  saveChannelDataToFirebase,
  fetchChannelDataFromFirebase,
  deleteChannelInFirebase,
} from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
  getDeletedItemIds,
  setDeletedItemIds,
  filterListsMapByTombstones,
} from '../services/storage';
import { DEFAULT_LISTS } from '../constants/initialData';
import { sanitizeItemName, sortItemsNaturally } from '../utils/itemUtils';
import { buildResolvedListsMap } from '../utils/inventoryStats';

const CHANNELS_INITIALIZED_KEY = 'anesthesia_channels_initialized';
const CHANNELS_PENDING_SYNC_KEY = 'anesthesia_channels_pending_sync';
const DELETED_CHANNELS_STORAGE_KEY = 'anesthesia_deleted_channel_ids';

function readLocalChannelClearedFlags(channelId: string): {
  bagCleared?: boolean;
  cartCleared?: boolean;
  ambulanceCleared?: boolean;
} {
  if (typeof window === 'undefined') return {};
  try {
    const key =
      !channelId || channelId === 'channel_master'
        ? 'anesthesia_cleared_flags'
        : `anesthesia_cleared_flags_${channelId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Helper to deep clone and sanitize lists for a channel (retains items & subItems, but completely strips any check results)
export function sanitizeListsForChannel(sourceLists: Record<'bag' | 'cart' | string, ListConfig>): Record<'bag' | 'cart' | string, ListConfig> {
  const cloned: Record<'bag' | 'cart' | string, ListConfig> = JSON.parse(JSON.stringify(sourceLists));
  (['bag', 'cart', 'ambulance'] as const).forEach((catKey) => {
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
];

export interface ChannelData {
  lists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  emergencyWeekDates: Record<string, Record<number, string>>;
  deletedItemIds?: string[];
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
  batchAddItems: (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => void;
  addBatchItemsToChannel: (channelId: string, items: any[], type?: 'bag' | 'cart' | 'ambulance' | string) => void;
  batchUpdateItemQuantities: (channelId: string, updates: Array<{ itemName: string; newQty: string }>, targetType?: 'bag' | 'cart' | 'ambulance' | string) => void;
  setItems: (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => void;
  reRenderData: () => void;

  // Isolated Data
  channelData: ChannelData;
  updateChannelData: (
    newData: Partial<ChannelData> | ((prev: ChannelData) => Partial<ChannelData>)
  ) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const persistChannelList = (list: WardChannel[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(list));
  localStorage.setItem('anesthesia_channels', JSON.stringify(list));
  localStorage.setItem(CHANNELS_INITIALIZED_KEY, 'true');
};

const getDeletedChannelIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_CHANNELS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveDeletedChannelIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_CHANNELS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
};

const ensureMasterChannelOnly = (list: WardChannel[]): WardChannel[] => {
  const valid = Array.isArray(list) ? list.filter((c) => c && c.id && c.name) : [];
  const hasMaster = valid.some((c) => c.id === 'channel_master');
  if (hasMaster) return valid;
  return [DEFAULT_CHANNELS[0], ...valid];
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userName, setUserNameState] = useState<string>('สาธิต');
  const [userPosition, setUserPositionState] = useState<string>('พยาบาลวิสัญญี');
  const [userProfile, setUserProfileState] = useState<User | null>(null);

  // Channel Management States - Seed ONLY channel_master once, never resurrect deleted non-master channels
  const [channels, setChannels] = useState<WardChannel[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CHANNELS;
    const isInitialized = localStorage.getItem(CHANNELS_INITIALIZED_KEY) === 'true';
    const rawPrimary = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    const rawLegacy = localStorage.getItem('anesthesia_channels');
    const deletedIds = new Set(getDeletedChannelIds());

    let stored: WardChannel[] | null = null;
    try {
      if (rawPrimary) stored = JSON.parse(rawPrimary);
      else if (rawLegacy) stored = JSON.parse(rawLegacy);
    } catch {
      stored = null;
    }

    if (Array.isArray(stored) && stored.length > 0) {
      const filtered = stored.filter((c) => c && (c.id === 'channel_master' || !deletedIds.has(c.id)));
      const normalized = ensureMasterChannelOnly(filtered);
      persistChannelList(normalized);
      return normalized;
    }

    if (isInitialized) {
      persistChannelList(DEFAULT_CHANNELS);
      return DEFAULT_CHANNELS;
    }

    persistChannelList(DEFAULT_CHANNELS);
    return DEFAULT_CHANNELS;
  });

  const [activeChannelId, setActiveChannelIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'channel_master';
    const saved =
      localStorage.getItem(STORAGE_KEYS.ACTIVE_CHANNEL_ID) ||
      localStorage.getItem('anesthesia_active_channel_id') ||
      localStorage.getItem('active_channel_id');
    return saved && saved.trim() ? saved.trim() : 'channel_master';
  });

  // Auth-aware Firebase Channel Sync (waits for Firebase Auth so it never fails unauthenticated or overwrites local deletions)
  useEffect(() => {
    let cancelled = false;

    const syncChannelsWithCloud = async () => {
      if (cancelled || !auth.currentUser) return;
      try {
        const hasPendingSync =
          typeof window !== 'undefined' &&
          localStorage.getItem(CHANNELS_PENDING_SYNC_KEY) === 'true';
        const deletedIds = getDeletedChannelIds();

        if (hasPendingSync) {
          // Local channel additions/deletions happened before auth finished or offline — push authoritative local list to cloud
          let localList = channels;
          try {
            const raw = localStorage.getItem(STORAGE_KEYS.CHANNELS);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) localList = ensureMasterChannelOnly(parsed);
            }
          } catch {}
          const ok = await saveChannelsToFirebase(localList);
          for (const delId of deletedIds) {
            if (delId && delId !== 'channel_master') {
              await deleteChannelInFirebase(delId).catch(() => {});
            }
          }
          if (ok && !cancelled && typeof window !== 'undefined') {
            localStorage.removeItem(CHANNELS_PENDING_SYNC_KEY);
          }
          return;
        }

        const remoteChannels = await fetchChannelsFromFirebase();
        if (cancelled) return;

        if (!remoteChannels || remoteChannels.length === 0) {
          // Cloud has no channels document yet — initialize cleanly with local list (or Master only)
          await saveChannelsToFirebase(ensureMasterChannelOnly(channels)).catch(() => {});
          return;
        }

        const deletedSet = new Set(deletedIds);
        const filteredRemote = remoteChannels.filter(
          (c) => c && c.id && (c.id === 'channel_master' || !deletedSet.has(c.id))
        );
        const normalized = ensureMasterChannelOnly(filteredRemote);

        // If we filtered out locally-deleted channels from stale remote list, push the clean list back to Firestore
        if (filteredRemote.length !== remoteChannels.length) {
          await saveChannelsToFirebase(normalized).catch(() => {});
          for (const delId of deletedIds) {
            if (delId && delId !== 'channel_master') {
              await deleteChannelInFirebase(delId).catch(() => {});
            }
          }
        }

        if (cancelled) return;
        setChannels(normalized);
        persistChannelList(normalized);
        setActiveChannelIdState((currId) => {
          if (normalized.some((c) => c.id === currId)) return currId;
          const fallback = normalized[0]?.id || 'channel_master';
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_CHANNEL_ID, fallback);
            localStorage.setItem('anesthesia_active_channel_id', fallback);
            localStorage.setItem('active_channel_id', fallback);
          }
          return fallback;
        });
      } catch {
        // Keep local channels on offline/error
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !cancelled) {
        void syncChannelsWithCloud();
      }
    });

    if (auth.currentUser) {
      void syncChannelsWithCloud();
    }

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Channel Data - Guaranteed initial population from getInitialLists() with true isolation
  const [channelData, setChannelData] = useState<ChannelData>(() => {
    const initialActiveId =
      (typeof window !== 'undefined' &&
        (localStorage.getItem(STORAGE_KEYS.ACTIVE_CHANNEL_ID) ||
          localStorage.getItem('anesthesia_active_channel_id') ||
          localStorage.getItem('active_channel_id'))) ||
      'channel_master';
    const key = getChannelDbKey(initialActiveId);
    const localTombstones = getDeletedItemIds(initialActiveId);
    const isMaster = initialActiveId === 'channel_master';
    const localFlags = readLocalChannelClearedFlags(initialActiveId);
    const stored = getStored<ChannelData | null>(key, null);
    if (stored && stored.lists && (stored.lists.bag || stored.lists.cart || stored.lists.ambulance)) {
      const mergedTombstones = Array.from(new Set([...localTombstones, ...(stored.deletedItemIds || [])]));
      if (mergedTombstones.length > localTombstones.length) {
        setDeletedItemIds(initialActiveId, mergedTombstones);
      }
      const tombstoneSet = new Set(mergedTombstones);
      const resolvedLists = buildResolvedListsMap({
        isMaster,
        flags: localFlags,
        remoteLists: stored.lists,
        localLists: getStored<Record<string, ListConfig> | null>(getChannelListsKey(initialActiveId), null),
        defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
        tombstoneSet,
      });
      return {
        ...stored,
        lists: resolvedLists,
        deletedItemIds: mergedTombstones,
      };
    }

    const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
    const initialLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
    const cleanLists = filterListsMapByTombstones(
      sanitizeListsForChannel({ ...initialLists, ambulance: initialLists.ambulance || DEFAULT_LISTS.ambulance }),
      localTombstones
    );

    const baseData: ChannelData = {
      lists: cleanLists,
      globalChecks: isMaster ? (masterData?.globalChecks || getStored(STORAGE_KEYS.GLOBAL_CHECKS, {})) : {},
      emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || getStored(STORAGE_KEYS.EMER_WEEK_DATES, {})) : {},
      deletedItemIds: localTombstones,
    };

    setStored(getChannelDbKey('channel_master'), isMaster ? baseData : (masterData || { lists: cleanLists, globalChecks: {}, emergencyWeekDates: {}, deletedItemIds: [] }));
    setStored(key, baseData);
    setStored(getChannelListsKey(initialActiveId), cleanLists);
    setStored(getChannelChecksKey(initialActiveId), baseData.globalChecks);
    setStored(getChannelWeekDatesKey(initialActiveId), baseData.emergencyWeekDates);
    return baseData;
  });

  // One-time legacy cleanup for default non-master channels ('channel_opd', 'channel_ipd1')
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

  // Load channel data when channel switches with deep clone isolation
  useEffect(() => {
    const key = getChannelDbKey(activeChannelId);
    const isMaster = !activeChannelId || activeChannelId === 'channel_master';
    const localFlags = readLocalChannelClearedFlags(activeChannelId);
    const localTombstones = getDeletedItemIds(activeChannelId);
    const stored = getStored<ChannelData | null>(key, null);

    if (stored && stored.lists && (stored.lists.bag || stored.lists.cart || stored.lists.ambulance)) {
      const mergedTombstones = Array.from(new Set([...localTombstones, ...(stored.deletedItemIds || [])]));
      if (mergedTombstones.length > localTombstones.length) {
        setDeletedItemIds(activeChannelId, mergedTombstones);
      }
      const resolvedLists = buildResolvedListsMap({
        isMaster,
        flags: localFlags,
        remoteLists: stored.lists,
        localLists: getStored<Record<string, ListConfig> | null>(getChannelListsKey(activeChannelId), null),
        defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
        tombstoneSet: new Set(mergedTombstones),
      });
      setChannelData({
        ...stored,
        lists: resolvedLists,
        deletedItemIds: mergedTombstones,
      });
      return;
    }

    // Check Firebase for saved channel data before falling back to cloning Master
    let cancelled = false;
    fetchChannelDataFromFirebase(activeChannelId).then((remote) => {
      if (cancelled) return;
      if (remote && remote.lists) {
        const mergedTombstones = setDeletedItemIds(activeChannelId, [
          ...getDeletedItemIds(activeChannelId),
          ...(Array.isArray(remote.deletedItemIds) ? remote.deletedItemIds : []),
        ]);
        const resolvedRemoteLists = buildResolvedListsMap({
          isMaster,
          flags: localFlags,
          remoteLists: remote.lists,
          localLists: getStored<Record<string, ListConfig> | null>(getChannelListsKey(activeChannelId), null),
          defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
          tombstoneSet: new Set(mergedTombstones),
        });
        const remoteData: ChannelData = {
          lists: resolvedRemoteLists,
          globalChecks: remote.globalChecks || {},
          emergencyWeekDates: remote.emergencyWeekDates || {},
          deletedItemIds: mergedTombstones,
        };
        setChannelData(remoteData);
        setStored(key, remoteData);
        setStored(getChannelListsKey(activeChannelId), remoteData.lists);
        setStored(getChannelChecksKey(activeChannelId), remoteData.globalChecks);
        setStored(getChannelWeekDatesKey(activeChannelId), remoteData.emergencyWeekDates);
        return;
      }

      const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
      const sourceLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
      const cleanLists = filterListsMapByTombstones(
        sanitizeListsForChannel({ ...sourceLists, ambulance: sourceLists.ambulance || DEFAULT_LISTS.ambulance }),
        localTombstones
      );

      const newData: ChannelData = {
        lists: cleanLists,
        globalChecks: isMaster ? (masterData?.globalChecks || {}) : {},
        emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || {}) : {},
        deletedItemIds: localTombstones,
      };
      setChannelData(newData);
      setStored(key, newData);
      setStored(getChannelListsKey(activeChannelId), cleanLists);
      setStored(getChannelChecksKey(activeChannelId), newData.globalChecks);
      setStored(getChannelWeekDatesKey(activeChannelId), newData.emergencyWeekDates);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [activeChannelId]);

  const updateChannelData = (
    newData: Partial<ChannelData> | ((prev: ChannelData) => Partial<ChannelData>)
  ) => {
    setChannelData((prev) => {
      const patch = typeof newData === 'function' ? newData(prev) : newData;
      const updated = { ...prev, ...patch };
      if (patch.deletedItemIds !== undefined) {
        updated.deletedItemIds = setDeletedItemIds(activeChannelId, patch.deletedItemIds || []);
      }
      setStored(getChannelDbKey(activeChannelId), updated);
      if (patch.lists) {
        setStored(getChannelListsKey(activeChannelId), patch.lists);
      }
      if (patch.globalChecks) {
        setStored(getChannelChecksKey(activeChannelId), patch.globalChecks);
      }
      if (patch.emergencyWeekDates) {
        setStored(getChannelWeekDatesKey(activeChannelId), patch.emergencyWeekDates);
      }
      saveChannelDataToFirebase(activeChannelId, updated).catch(() => {});
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
    if (!id) return;
    setActiveChannelIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHANNEL_ID, id);
      localStorage.setItem('anesthesia_active_channel_id', id);
      localStorage.setItem('active_channel_id', id);

      const key = getChannelDbKey(id);
      const localTombstones = getDeletedItemIds(id);
      let targetData = getStored<ChannelData | null>(key, null);
      if (!targetData || !targetData.lists || (!targetData.lists.bag && !targetData.lists.cart && !targetData.lists.ambulance)) {
        const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
        const sourceLists = (masterData && masterData.lists) ? masterData.lists : getInitialLists();
        const cleanLists = filterListsMapByTombstones(
          sanitizeListsForChannel({ ...sourceLists, ambulance: sourceLists.ambulance || DEFAULT_LISTS.ambulance }),
          localTombstones
        );
        const isMaster = id === 'channel_master';
        targetData = {
          lists: cleanLists,
          globalChecks: isMaster ? (masterData?.globalChecks || {}) : {},
          emergencyWeekDates: isMaster ? (masterData?.emergencyWeekDates || {}) : {},
          deletedItemIds: localTombstones,
        };
        setStored(key, targetData);
        setStored(getChannelListsKey(id), cleanLists);
        setStored(getChannelChecksKey(id), targetData.globalChecks);
        setStored(getChannelWeekDatesKey(id), targetData.emergencyWeekDates);
      } else {
        const mergedTombstones = Array.from(new Set([...localTombstones, ...(targetData.deletedItemIds || [])]));
        targetData = {
          ...targetData,
          lists: buildResolvedListsMap({
            isMaster: id === 'channel_master',
            flags: readLocalChannelClearedFlags(id),
            remoteLists: targetData.lists,
            localLists: getStored<Record<string, ListConfig> | null>(getChannelListsKey(id), null),
            defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
            tombstoneSet: new Set(mergedTombstones),
          }),
        };
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
    persistChannelList(nextChannels);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHANNELS_PENDING_SYNC_KEY, 'true');
    }
    authReadyPromise.then((user) => {
      if (user) {
        saveChannelsToFirebase(nextChannels)
          .then((ok) => {
            if (ok && typeof window !== 'undefined') localStorage.removeItem(CHANNELS_PENDING_SYNC_KEY);
          })
          .catch(() => {});
      }
    });

    const masterData = getStored<ChannelData | null>(getChannelDbKey('channel_master'), null);
    const sourceLists = (masterData && masterData.lists) ? masterData.lists : (channelData.lists || getInitialLists());

    const cleanLists = duplicateFromMaster
      ? sanitizeListsForChannel(sourceLists)
      : {
          bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
          cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
          ambulance: { title: 'รถพยาบาลฉุกเฉิน', sheet: 'รถ Ambulance', groups: {} },
        };

    const newChannelData: ChannelData = {
      lists: cleanLists,
      globalChecks: {},
      emergencyWeekDates: {},
      deletedItemIds: [],
    };

    setStored(getChannelDbKey(newId), newChannelData);
    setStored(getChannelListsKey(newId), cleanLists);
    setStored(getChannelChecksKey(newId), {});
    setStored(getChannelWeekDatesKey(newId), {});
    saveChannelDataToFirebase(newId, newChannelData).catch(() => {});

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
    if (!target || target.isDefault || id === 'channel_master') {
      return;
    }
    const nextChannels = ensureMasterChannelOnly(channels.filter((c) => c.id !== id));
    setChannels(nextChannels);
    persistChannelList(nextChannels);

    // Record permanent deletion locally so stale remote caches cannot resurrect this channel
    const updatedDeleted = [...getDeletedChannelIds(), id];
    saveDeletedChannelIds(updatedDeleted);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHANNELS_PENDING_SYNC_KEY, 'true');
      localStorage.removeItem(getChannelDbKey(id));
      localStorage.removeItem(getChannelListsKey(id));
      localStorage.removeItem(getChannelChecksKey(id));
      localStorage.removeItem(getChannelWeekDatesKey(id));
    }

    authReadyPromise.then(async (user) => {
      if (!user) return;
      const savedList = await saveChannelsToFirebase(nextChannels).catch(() => false);
      await deleteChannelInFirebase(id).catch(() => false);
      if (savedList && typeof window !== 'undefined') {
        localStorage.removeItem(CHANNELS_PENDING_SYNC_KEY);
      }
    });

    if (activeChannelId === id) {
      setActiveChannelId('channel_master');
    }
  };

  const renameChannel = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const nextChannels = channels.map((c) => (c.id === id ? { ...c, name: newName.trim() } : c));
    setChannels(nextChannels);
    persistChannelList(nextChannels);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHANNELS_PENDING_SYNC_KEY, 'true');
    }
    authReadyPromise.then((user) => {
      if (user) {
        saveChannelsToFirebase(nextChannels)
          .then((ok) => {
            if (ok && typeof window !== 'undefined') localStorage.removeItem(CHANNELS_PENDING_SYNC_KEY);
          })
          .catch(() => {});
      }
    });
  };

  const addBatchItemsToChannel = (channelId: string, newItems: any[], targetType: 'bag' | 'cart' | 'ambulance' | string = 'bag') => {
    const targetChannelId = channelId || activeChannelId || 'channel_master';
    const key = getChannelDbKey(targetChannelId);

    setChannelData((prev) => {
      const currentChannelData = targetChannelId === activeChannelId ? prev : (getStored<ChannelData | null>(key, null) || prev);
      const currentList = currentChannelData.lists?.[targetType] || {
        title: targetType === 'bag' ? 'กระเป๋าฉุกเฉิน' : targetType === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน',
        sheet: targetType === 'bag' ? 'กระเป๋า Emergency' : targetType === 'ambulance' ? 'รถ Ambulance' : 'รถ Emergency',
        groups: {},
      };

      const updatedGroups: Record<string, EquipmentItem[]> = { ...(currentList.groups || {}) };
      const defaultGroupName = 'อุปกรณ์และเวชภัณฑ์ฉุกเฉิน';

      const existingIds = new Set<string>();
      Object.values(updatedGroups).forEach((arr) => {
        (arr || []).forEach((ex) => {
          if (ex?.id) existingIds.add(ex.id);
        });
      });

      newItems.forEach((item, index) => {
        const groupName = item.groupName || item.category || item.group || defaultGroupName;
        if (!updatedGroups[groupName]) {
          updatedGroups[groupName] = [];
        }

        let resolvedId =
          item.id && !existingIds.has(item.id)
            ? String(item.id)
            : `${targetType}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
        while (existingIds.has(resolvedId)) {
          resolvedId = `${targetType}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
        }
        existingIds.add(resolvedId);

        const formattedItem: EquipmentItem = {
          id: resolvedId,
          name: sanitizeItemName(item.name || `รายการที่ ${index + 1}`),
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

      // Natural Sort within each group
      Object.keys(updatedGroups).forEach(groupName => {
        updatedGroups[groupName] = sortItemsNaturally(updatedGroups[groupName]);
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

  const batchUpdateItemQuantities = (
    channelId: string,
    updates: Array<{ itemName: string; newQty: string }>,
    targetType: 'bag' | 'cart' | 'ambulance' | string = 'bag'
  ) => {
    const targetChannelId = channelId || activeChannelId || 'channel_master';
    const key = getChannelDbKey(targetChannelId);

    setChannelData((prev) => {
      const currentChannelData = targetChannelId === activeChannelId ? prev : (getStored<ChannelData | null>(key, null) || prev);
      const currentList = currentChannelData.lists?.[targetType];
      if (!currentList || !currentList.groups) return prev;

      const updatedGroups: Record<string, EquipmentItem[]> = {};

      Object.entries(currentList.groups).forEach(([groupName, items]) => {
        updatedGroups[groupName] = items.map((it) => {
          const matchingUpdate = updates.find(
            (u) =>
              u.itemName.toLowerCase().trim() === it.name.toLowerCase().trim() ||
              it.name.toLowerCase().includes(u.itemName.toLowerCase().trim()) ||
              u.itemName.toLowerCase().includes(it.name.toLowerCase().trim())
          );
          if (matchingUpdate) {
            return {
              ...it,
              qty: matchingUpdate.newQty,
              unitText: matchingUpdate.newQty,
            };
          }
          return it;
        });
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

      setStored(key, nextChannelData);
      setStored(getChannelListsKey(targetChannelId), updatedLists);
      if (targetChannelId === 'channel_master') {
        setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: targetChannelId, data: nextChannelData } }));
        window.dispatchEvent(new CustomEvent('items_updated', { detail: { type: targetType, count: updates.length } }));
        window.dispatchEvent(new Event('storage'));
      }

      return targetChannelId === activeChannelId ? nextChannelData : prev;
    });
  };

  const batchAddItems = (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => {
    addBatchItemsToChannel(activeChannelId, items, type);
  };

  const setItems = (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => {
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
        batchUpdateItemQuantities,
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
        return { id: 'usr_admin', username: 'admin', name: n, role: 'admin', position: p, active: true, must: false, created: '', last: '', avatar: a };
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
      batchUpdateItemQuantities: () => {},
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
          ambulance: { title: 'รถพยาบาลฉุกเฉิน', sheet: 'รถ Ambulance', groups: {} },
        },
        globalChecks: {},
        emergencyWeekDates: {},
        deletedItemIds: [],
      },
      updateChannelData: () => {},
    };
  }
  return context;
};

export default DataContext;

