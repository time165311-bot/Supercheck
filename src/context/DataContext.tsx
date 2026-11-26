import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  User,
  WardChannel,
  CheckItemState,
  ListConfig,
  EquipmentItem,
  WardPermissionLocks,
  TrashItemRecord,
} from '../types';
import {
  auth,
  saveUserToFirebase,
  saveWardWorkspacePatchToFirebase,
  fetchChannelDataFromFirebase,
  deleteChannelInFirebase,
  ensureWardWorkspaceInitialized,
  subscribeWardWorkspace,
  DEFAULT_WARD_PERMISSION_LOCKS,
  subscribeWardAdminLocks,
  saveWardAdminLocksToFirebase,
  subscribeWardTrash,
} from '../services/firebase';
import { logAuditEvent } from '../services/auditLogger';
import {
  STORAGE_KEYS,
  getStored,
  setStored,
  getChannelDbKey,
  getChannelListsKey,
  getChannelChecksKey,
  getChannelWeekDatesKey,
  getInitialLists,
  getDeletedItemIds,
  setDeletedItemIds,
  filterListsMapByTombstones,
} from '../services/storage';
import { DEFAULT_LISTS } from '../constants/initialData';
import { sanitizeItemName, sortItemsNaturally } from '../utils/itemUtils';
import { buildResolvedListsMap } from '../utils/inventoryStats';
import {
  DEFAULT_WARD_ID,
  KNOWN_WARDS_STORAGE_KEY,
  generatePinSalt,
  getActiveWardIdFromStorage,
  hashPinWithSalt,
  isDefaultWard,
  isValidFourDigitPin,
  isValidWardCodeInput,
  isWardSessionUnlocked,
  resolveWardId,
  saveActiveWardIdToStorage,
  setWardSessionUnlocked,
  verifyPinHash,
} from '../utils/wardUtils';

// Helper to deep clone and sanitize lists for a ward (retains items & subItems, strips check results)
export function sanitizeListsForChannel(
  sourceLists: Record<'bag' | 'cart' | string, ListConfig>
): Record<'bag' | 'cart' | string, ListConfig> {
  const cloned: Record<'bag' | 'cart' | string, ListConfig> = JSON.parse(
    JSON.stringify(sourceLists || {})
  );
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
  {
    id: DEFAULT_WARD_ID,
    name: 'ห้องวอร์ดกลาง (ANES-MASTER)',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export interface ChannelData {
  lists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  emergencyWeekDates: Record<string, Record<number, string>>;
  deletedItemIds?: string[];
  bagCleared?: boolean;
  cartCleared?: boolean;
  ambulanceCleared?: boolean;
  equipmentCleared?: boolean;
  drugsCleared?: boolean;
  equipmentSeeded?: boolean;
  drugsSeeded?: boolean;
  pinEnabled?: boolean;
  pinHash?: string;
  pinSalt?: string;
}

export interface PinProtectionState {
  pinEnabled: boolean;
  isSessionUnlocked: boolean;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockSession: () => void;
  enableOrChangePin: (
    newPin: string,
    currentPin?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  disablePin: (currentPin: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface DataContextType {
  userName: string;
  setUserName: (name: string) => void;
  userPosition: string;
  setUserPosition: (pos: string) => void;
  userProfile: User | null;
  setUserProfile: (user: User | null) => void;
  saveUserProfile: (name: string, position: string, avatar?: string) => Promise<User>;

  // Shared Ward Workspace Management
  channels: WardChannel[];
  activeChannelId: string;
  activeChannel: WardChannel;
  wardSyncReady: boolean;
  setActiveChannelId: (id: string) => void;
  switchWard: (
    wardCode: string,
    options?: { name?: string; duplicateFromMaster?: boolean }
  ) => Promise<{ ok: boolean; wardId: string; error?: string }>;
  addChannel: (
    name: string,
    duplicateFromMaster?: boolean,
    customCode?: string
  ) => WardChannel;
  removeChannel: (id: string) => void;
  renameChannel: (id: string, newName: string) => void;
  batchAddItems: (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => void;
  addBatchItemsToChannel: (
    channelId: string,
    items: any[],
    type?: 'bag' | 'cart' | 'ambulance' | string
  ) => void;
  batchUpdateItemQuantities: (
    channelId: string,
    updates: Array<{ itemName: string; newQty: string }>,
    targetType?: 'bag' | 'cart' | 'ambulance' | string
  ) => void;
  setItems: (type: 'bag' | 'cart' | 'ambulance' | string, items: any[]) => void;
  reRenderData: () => void;

  // Real-time Shared Ward Data & PIN Guard
  channelData: ChannelData;
  updateChannelData: (
    newData: Partial<ChannelData> | ((prev: ChannelData) => Partial<ChannelData>)
  ) => void;
  applySyncedLists: (
    nextLists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
  ) => void;
  pinConfig: PinProtectionState;

  // Owner / Super Admin Permission Locks & Restorable Trash
  wardPermissionLocks: WardPermissionLocks;
  updatePermissionLocks: (
    patch: Partial<WardPermissionLocks>,
    options?: { superAdminToken?: string | null; operatorName?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  trashItems: TrashItemRecord[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const persistKnownWards = (list: WardChannel[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KNOWN_WARDS_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(list));
  } catch {
    // Ignore storage quota issues
  }
};

const ensureMasterWardIncluded = (list: WardChannel[]): WardChannel[] => {
  const seen = new Set<string>();
  const normalized: WardChannel[] = [];
  for (const ch of list || []) {
    if (!ch || !ch.id || !ch.name) continue;
    const resolvedId = resolveWardId(ch.id);
    if (seen.has(resolvedId)) continue;
    seen.add(resolvedId);
    normalized.push({
      ...ch,
      id: resolvedId,
      isDefault: resolvedId === DEFAULT_WARD_ID,
    });
  }
  if (!seen.has(DEFAULT_WARD_ID)) {
    return [DEFAULT_CHANNELS[0], ...normalized];
  }
  return normalized;
};

function readLocalChannelClearedFlags(wardId: string): {
  bagCleared?: boolean;
  cartCleared?: boolean;
  ambulanceCleared?: boolean;
  equipmentCleared?: boolean;
  drugsCleared?: boolean;
} {
  if (typeof window === 'undefined') return {};
  try {
    const resolved = resolveWardId(wardId);
    const key =
      resolved === DEFAULT_WARD_ID
        ? 'anesthesia_cleared_flags'
        : `anesthesia_cleared_flags_${resolved}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buildEmptyListsSkeleton(): Record<'bag' | 'cart' | 'ambulance' | string, ListConfig> {
  return {
    bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
    cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
    ambulance: { title: 'รถพยาบาลฉุกเฉิน', sheet: 'รถ Ambulance', groups: {} },
  };
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Device-local personal operator profile (never synced across devices)
  const [userName, setUserNameState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'สาธิต';
    return (
      localStorage.getItem('user_display_name') ||
      localStorage.getItem('user_name_default') ||
      'สาธิต'
    );
  });
  const [userPosition, setUserPositionState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'พยาบาลวิสัญญี';
    return (
      localStorage.getItem('user_display_position') ||
      localStorage.getItem('user_position_default') ||
      'พยาบาลวิสัญญี'
    );
  });
  const [userProfile, setUserProfileState] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  // Known ward codes stored locally on this device (always includes ANES-MASTER)
  const [channels, setChannels] = useState<WardChannel[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CHANNELS;
    try {
      const raw =
        localStorage.getItem(KNOWN_WARDS_STORAGE_KEY) ||
        localStorage.getItem(STORAGE_KEYS.CHANNELS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = ensureMasterWardIncluded(parsed);
          persistKnownWards(normalized);
          return normalized;
        }
      }
    } catch {
      // fallback to default
    }
    persistKnownWards(DEFAULT_CHANNELS);
    return DEFAULT_CHANNELS;
  });

  // Auto-connect to ANES-MASTER (or user's last chosen Ward Code) with zero login required
  const [activeChannelId, setActiveChannelIdState] = useState<string>(() => {
    const resolved = getActiveWardIdFromStorage();
    saveActiveWardIdToStorage(resolved);
    return resolved;
  });
  const [wardSyncReady, setWardSyncReady] = useState<boolean>(false);

  const [channelData, setChannelData] = useState<ChannelData>(() => {
    const initialWardId = getActiveWardIdFromStorage();
    const isMaster = isDefaultWard(initialWardId);
    const key = getChannelDbKey(initialWardId);
    const localTombstones = getDeletedItemIds(initialWardId);
    const localFlags = readLocalChannelClearedFlags(initialWardId);
    const stored = getStored<ChannelData | null>(key, null);

    if (stored && stored.lists && (stored.lists.bag || stored.lists.cart || stored.lists.ambulance)) {
      const mergedTombstones = Array.from(
        new Set([...localTombstones, ...(stored.deletedItemIds || [])])
      );
      if (mergedTombstones.length > localTombstones.length) {
        setDeletedItemIds(initialWardId, mergedTombstones);
      }
      const resolvedLists = buildResolvedListsMap({
        isMaster,
        flags: {
          bagCleared: localFlags.bagCleared ?? stored.bagCleared,
          cartCleared: localFlags.cartCleared ?? stored.cartCleared,
          ambulanceCleared: localFlags.ambulanceCleared ?? stored.ambulanceCleared,
        },
        remoteLists: stored.lists,
        localLists: getStored<Record<string, ListConfig> | null>(
          getChannelListsKey(initialWardId),
          null
        ),
        defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
        tombstoneSet: new Set(mergedTombstones),
      });
      return {
        ...stored,
        lists: resolvedLists,
        globalChecks: stored.globalChecks || {},
        emergencyWeekDates: stored.emergencyWeekDates || {},
        deletedItemIds: mergedTombstones,
      };
    }

    const baseLists = isMaster
      ? filterListsMapByTombstones(
          sanitizeListsForChannel(getInitialLists()),
          localTombstones
        )
      : buildEmptyListsSkeleton();

    return {
      lists: baseLists,
      globalChecks: {},
      emergencyWeekDates: {},
      deletedItemIds: localTombstones,
    };
  });

  const [isSessionUnlocked, setIsSessionUnlocked] = useState<boolean>(() =>
    isWardSessionUnlocked(getActiveWardIdFromStorage(), channelData.pinHash)
  );
  const seededDefaultOnceRef = useRef<Set<string>>(new Set());

  // Sync session unlock state whenever wardId or pinHash changes
  useEffect(() => {
    if (!channelData.pinEnabled || !channelData.pinHash) {
      setIsSessionUnlocked(true);
    } else {
      setIsSessionUnlocked(isWardSessionUnlocked(activeChannelId, channelData.pinHash));
    }
  }, [activeChannelId, channelData.pinEnabled, channelData.pinHash]);

  // 100% Real-Time Firestore Listener on `wards/{wardId}` (Desktop, Mobile & Incognito)
  useEffect(() => {
    const wardId = resolveWardId(activeChannelId);
    const isMaster = isDefaultWard(wardId);
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    setWardSyncReady(false);

    const startWardSync = async () => {
      try {
        await ensureWardWorkspaceInitialized(wardId);
      } catch {
        // Offline or network transient; still attach listener for cache + reconnect
      }
      if (cancelled) return;

      unsubscribe = subscribeWardWorkspace(wardId, (remoteDoc, meta) => {
        if (cancelled) return;
        setWardSyncReady(true);

        if (!remoteDoc) return;

        // Keep ward display name synced in local known-wards list
        if (typeof remoteDoc.name === 'string' && remoteDoc.name.trim()) {
          setChannels((prev) => {
            const exists = prev.some((c) => c.id === wardId);
            const next = exists
              ? prev.map((c) =>
                  c.id === wardId ? { ...c, name: remoteDoc.name.trim() } : c
                )
              : ensureMasterWardIncluded([
                  ...prev,
                  {
                    id: wardId,
                    name: remoteDoc.name.trim(),
                    isDefault: isMaster,
                    createdAt: new Date().toISOString(),
                  },
                ]);
            persistKnownWards(next);
            return next;
          });
        }

        const remoteTombstones = Array.isArray(remoteDoc.deletedItemIds)
          ? remoteDoc.deletedItemIds
          : [];
        const resolvedTombstones = meta.hasPendingWrites
          ? Array.from(new Set([...getDeletedItemIds(wardId), ...remoteTombstones]))
          : setDeletedItemIds(wardId, remoteTombstones);
        if (meta.hasPendingWrites) {
          setDeletedItemIds(wardId, resolvedTombstones);
        }
        const tombstoneSet = new Set(resolvedTombstones);

        const bagCleared = Boolean(remoteDoc.bagCleared);
        const cartCleared = Boolean(remoteDoc.cartCleared);
        const ambulanceCleared = Boolean(remoteDoc.ambulanceCleared);
        const equipmentCleared = Boolean(remoteDoc.equipmentCleared);
        const drugsCleared = Boolean(remoteDoc.drugsCleared);

        // Mirror cleared flags into device local cache so offline reload stays accurate
        try {
          const flagsKey =
            wardId === DEFAULT_WARD_ID
              ? 'anesthesia_cleared_flags'
              : `anesthesia_cleared_flags_${wardId}`;
          localStorage.setItem(
            flagsKey,
            JSON.stringify({
              bagCleared,
              cartCleared,
              ambulanceCleared,
              equipmentCleared,
              drugsCleared,
              equipmentSeeded: Boolean(remoteDoc.equipmentSeeded),
              drugsSeeded: Boolean(remoteDoc.drugsSeeded),
              updatedAt: remoteDoc.updatedAt || new Date().toISOString(),
            })
          );
        } catch {
          // Ignore quota errors
        }

        const remoteListsRaw =
          remoteDoc.lists && typeof remoteDoc.lists === 'object' ? remoteDoc.lists : {};
        const remoteHasAnyLists =
          Boolean(remoteListsRaw.bag?.groups && Object.keys(remoteListsRaw.bag.groups).length > 0) ||
          Boolean(remoteListsRaw.cart?.groups && Object.keys(remoteListsRaw.cart.groups).length > 0) ||
          Boolean(
            remoteListsRaw.ambulance?.groups &&
              Object.keys(remoteListsRaw.ambulance.groups).length > 0
          );

        let nextLists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>;
        if (remoteHasAnyLists || bagCleared || cartCleared) {
          nextLists = {
            bag: {
              title: remoteListsRaw.bag?.title || DEFAULT_LISTS.bag.title,
              sheet: remoteListsRaw.bag?.sheet || DEFAULT_LISTS.bag.sheet,
              groups: bagCleared ? {} : remoteListsRaw.bag?.groups || {},
            },
            cart: {
              title: remoteListsRaw.cart?.title || DEFAULT_LISTS.cart.title,
              sheet: remoteListsRaw.cart?.sheet || DEFAULT_LISTS.cart.sheet,
              groups: cartCleared ? {} : remoteListsRaw.cart?.groups || {},
            },
            ambulance: {
              title: remoteListsRaw.ambulance?.title || DEFAULT_LISTS.ambulance.title,
              sheet: remoteListsRaw.ambulance?.sheet || DEFAULT_LISTS.ambulance.sheet,
              groups: ambulanceCleared ? {} : remoteListsRaw.ambulance?.groups || {},
            },
          };
          nextLists = filterListsMapByTombstones(nextLists, tombstoneSet);
        } else if (isMaster) {
          // Brand-new ANES-MASTER with empty lists & not cleared -> seed canonical defaults once
          nextLists = filterListsMapByTombstones(
            sanitizeListsForChannel(DEFAULT_LISTS as Record<string, ListConfig>),
            tombstoneSet
          );
          if (!meta.fromCache && !seededDefaultOnceRef.current.has(wardId)) {
            seededDefaultOnceRef.current.add(wardId);
            void saveWardWorkspacePatchToFirebase(wardId, { lists: nextLists }).catch(() => {});
          }
        } else {
          nextLists = buildEmptyListsSkeleton();
        }

        const nextGlobalChecks =
          remoteDoc.globalChecks && typeof remoteDoc.globalChecks === 'object'
            ? (remoteDoc.globalChecks as Record<string, Record<string, CheckItemState>>)
            : {};
        const nextWeekDates =
          remoteDoc.emergencyWeekDates && typeof remoteDoc.emergencyWeekDates === 'object'
            ? (remoteDoc.emergencyWeekDates as Record<string, Record<number, string>>)
            : {};

        const nextData: ChannelData = {
          lists: nextLists,
          globalChecks: nextGlobalChecks,
          emergencyWeekDates: nextWeekDates,
          deletedItemIds: resolvedTombstones,
          bagCleared,
          cartCleared,
          ambulanceCleared,
          equipmentCleared,
          drugsCleared,
          equipmentSeeded: Boolean(remoteDoc.equipmentSeeded),
          drugsSeeded: Boolean(remoteDoc.drugsSeeded),
          pinEnabled: Boolean(remoteDoc.pinEnabled),
          pinHash: typeof remoteDoc.pinHash === 'string' ? remoteDoc.pinHash : undefined,
          pinSalt: typeof remoteDoc.pinSalt === 'string' ? remoteDoc.pinSalt : undefined,
        };

        setChannelData(nextData);
        setStored(getChannelDbKey(wardId), nextData);
        setStored(getChannelListsKey(wardId), nextLists);
        setStored(getChannelChecksKey(wardId), nextGlobalChecks);
        setStored(getChannelWeekDatesKey(wardId), nextWeekDates);
        if (isMaster) {
          setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
          setStored(STORAGE_KEYS.GLOBAL_CHECKS, nextGlobalChecks);
          setStored(STORAGE_KEYS.EMER_WEEK_DATES, nextWeekDates);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('channel_data_updated', {
              detail: { channelId: wardId, data: nextData, fromRemote: true },
            })
          );
        }
      });
    };

    void startWardSync();

    return () => {
      cancelled = true;
      try {
        unsubscribe?.();
      } catch {
        // Ignore cleanup failure
      }
    };
  }, [activeChannelId]);

  // Write only the changed patch fields back to `wards/{wardId}` (prevents overwriting other clients' edits)
  const updateChannelData = useCallback(
    (newData: Partial<ChannelData> | ((prev: ChannelData) => Partial<ChannelData>)) => {
      const wardId = resolveWardId(activeChannelId);
      setChannelData((prev) => {
        const patch = typeof newData === 'function' ? newData(prev) : newData;
        const updated: ChannelData = { ...prev, ...patch };
        const remotePatch: Record<string, any> = {};

        if (patch.lists !== undefined) remotePatch.lists = patch.lists;
        if (patch.globalChecks !== undefined) remotePatch.globalChecks = patch.globalChecks;
        if (patch.emergencyWeekDates !== undefined) {
          remotePatch.emergencyWeekDates = patch.emergencyWeekDates;
        }
        if (patch.deletedItemIds !== undefined) {
          const cleanIds = setDeletedItemIds(wardId, patch.deletedItemIds || []);
          updated.deletedItemIds = cleanIds;
          remotePatch.deletedItemIds = cleanIds;
        }
        if (patch.bagCleared !== undefined) remotePatch.bagCleared = patch.bagCleared;
        if (patch.cartCleared !== undefined) remotePatch.cartCleared = patch.cartCleared;
        if (patch.ambulanceCleared !== undefined) {
          remotePatch.ambulanceCleared = patch.ambulanceCleared;
        }
        if (patch.equipmentCleared !== undefined) {
          remotePatch.equipmentCleared = patch.equipmentCleared;
        }
        if (patch.drugsCleared !== undefined) remotePatch.drugsCleared = patch.drugsCleared;
        if (patch.equipmentSeeded !== undefined) {
          remotePatch.equipmentSeeded = patch.equipmentSeeded;
        }
        if (patch.drugsSeeded !== undefined) remotePatch.drugsSeeded = patch.drugsSeeded;

        setStored(getChannelDbKey(wardId), updated);
        if (patch.lists) {
          setStored(getChannelListsKey(wardId), patch.lists);
          if (isDefaultWard(wardId)) setStored(STORAGE_KEYS.CUSTOM_LISTS, patch.lists);
        }
        if (patch.globalChecks) {
          setStored(getChannelChecksKey(wardId), patch.globalChecks);
          if (isDefaultWard(wardId)) setStored(STORAGE_KEYS.GLOBAL_CHECKS, patch.globalChecks);
        }
        if (patch.emergencyWeekDates) {
          setStored(getChannelWeekDatesKey(wardId), patch.emergencyWeekDates);
          if (isDefaultWard(wardId)) {
            setStored(STORAGE_KEYS.EMER_WEEK_DATES, patch.emergencyWeekDates);
          }
        }

        if (Object.keys(remotePatch).length > 0) {
          void saveWardWorkspacePatchToFirebase(wardId, remotePatch).catch(() => {});
        }
        return updated;
      });
    },
    [activeChannelId]
  );

  // Hydrates React state + local cache from real-time overlay without echoing back to Firestore
  const applySyncedLists = useCallback(
    (nextLists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>) => {
      const wardId = resolveWardId(activeChannelId);
      setChannelData((prev) => {
        const updated = { ...prev, lists: nextLists };
        setStored(getChannelDbKey(wardId), updated);
        setStored(getChannelListsKey(wardId), nextLists);
        if (isDefaultWard(wardId)) {
          setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
        }
        return updated;
      });
    },
    [activeChannelId]
  );

  const activeChannel = React.useMemo(() => {
    const resolved = resolveWardId(activeChannelId);
    const found = channels.find((c) => resolveWardId(c.id) === resolved);
    if (found) return found;
    return {
      id: resolved,
      name: resolved === DEFAULT_WARD_ID ? DEFAULT_CHANNELS[0].name : `ห้องวอร์ด ${resolved}`,
      isDefault: resolved === DEFAULT_WARD_ID,
      createdAt: new Date().toISOString(),
    };
  }, [channels, activeChannelId]);

  const setActiveChannelId = useCallback((id: string) => {
    const resolved = saveActiveWardIdToStorage(id);
    setActiveChannelIdState(resolved);

    setChannels((prev) => {
      if (prev.some((c) => resolveWardId(c.id) === resolved)) return prev;
      const next = ensureMasterWardIncluded([
        ...prev,
        {
          id: resolved,
          name: resolved === DEFAULT_WARD_ID ? DEFAULT_CHANNELS[0].name : `ห้องวอร์ด ${resolved}`,
          isDefault: resolved === DEFAULT_WARD_ID,
          createdAt: new Date().toISOString(),
        },
      ]);
      persistKnownWards(next);
      return next;
    });

    if (typeof window !== 'undefined') {
      const key = getChannelDbKey(resolved);
      const localTombstones = getDeletedItemIds(resolved);
      const stored = getStored<ChannelData | null>(key, null);
      if (stored && stored.lists) {
        setChannelData({
          ...stored,
          lists: filterListsMapByTombstones(stored.lists, localTombstones),
          globalChecks: stored.globalChecks || {},
          emergencyWeekDates: stored.emergencyWeekDates || {},
          deletedItemIds: localTombstones,
        });
      }
      window.dispatchEvent(new Event('storage'));
    }
  }, []);

  const switchWard = useCallback(
    async (
      wardCode: string,
      options?: { name?: string; duplicateFromMaster?: boolean }
    ): Promise<{ ok: boolean; wardId: string; error?: string }> => {
      const rawTrimmed = String(wardCode || '').trim();
      if (!rawTrimmed) {
        return { ok: false, wardId: activeChannelId, error: 'กรุณาระบุรหัสห้องวอร์ด' };
      }
      if (!isValidWardCodeInput(rawTrimmed)) {
        return {
          ok: false,
          wardId: activeChannelId,
          error: 'รหัสห้องวอร์ดต้องมี 2–48 ตัวอักษร (ใช้ A-Z, 0-9, _ หรือ - เท่านั้น)',
        };
      }

      const targetWardId = resolveWardId(rawTrimmed);
      const existingRemote = await fetchChannelDataFromFirebase(targetWardId).catch(() => null);

      let displayName =
        options?.name?.trim() ||
        existingRemote?.name ||
        (targetWardId === DEFAULT_WARD_ID ? DEFAULT_CHANNELS[0].name : `ห้องวอร์ด ${targetWardId}`);

      if (!existingRemote) {
        const masterData = getStored<ChannelData | null>(getChannelDbKey(DEFAULT_WARD_ID), null);
        const sourceLists = masterData?.lists || channelData.lists || getInitialLists();
        const seedLists =
          options?.duplicateFromMaster !== false
            ? sanitizeListsForChannel(sourceLists)
            : buildEmptyListsSkeleton();
        await ensureWardWorkspaceInitialized(targetWardId, {
          name: displayName,
          lists: seedLists,
          globalChecks: {},
          emergencyWeekDates: {},
          deletedItemIds: [],
        });
      }

      setChannels((prev) => {
        const hasWard = prev.some((c) => resolveWardId(c.id) === targetWardId);
        const next = hasWard
          ? prev.map((c) => (resolveWardId(c.id) === targetWardId ? { ...c, name: displayName } : c))
          : ensureMasterWardIncluded([
              ...prev,
              {
                id: targetWardId,
                name: displayName,
                isDefault: targetWardId === DEFAULT_WARD_ID,
                createdAt: new Date().toISOString(),
              },
            ]);
        persistKnownWards(next);
        return next;
      });

      setActiveChannelId(targetWardId);
      return { ok: true, wardId: targetWardId };
    },
    [activeChannelId, channelData.lists, setActiveChannelId]
  );

  const addChannel = (
    name: string,
    duplicateFromMaster: boolean = true,
    customCode?: string
  ): WardChannel => {
    const cleanName = name.trim() || 'ห้องวอร์ดใหม่';
    const rawCode =
      customCode && isValidWardCodeInput(customCode)
        ? resolveWardId(customCode)
        : `WARD-${Date.now().toString(36).toUpperCase()}`;

    const newChan: WardChannel = {
      id: rawCode,
      name: cleanName,
      isDefault: rawCode === DEFAULT_WARD_ID,
      createdAt: new Date().toISOString(),
    };

    const nextChannels = ensureMasterWardIncluded([...channels, newChan]);
    setChannels(nextChannels);
    persistKnownWards(nextChannels);

    const masterData = getStored<ChannelData | null>(getChannelDbKey(DEFAULT_WARD_ID), null);
    const sourceLists = masterData?.lists || channelData.lists || getInitialLists();
    const cleanLists = duplicateFromMaster
      ? sanitizeListsForChannel(sourceLists)
      : buildEmptyListsSkeleton();

    const newChannelData: ChannelData = {
      lists: cleanLists,
      globalChecks: {},
      emergencyWeekDates: {},
      deletedItemIds: [],
    };

    setStored(getChannelDbKey(rawCode), newChannelData);
    setStored(getChannelListsKey(rawCode), cleanLists);
    setStored(getChannelChecksKey(rawCode), {});
    setStored(getChannelWeekDatesKey(rawCode), {});

    void ensureWardWorkspaceInitialized(rawCode, {
      name: cleanName,
      lists: cleanLists,
      globalChecks: {},
      emergencyWeekDates: {},
      deletedItemIds: [],
    }).catch(() => {});

    setActiveChannelId(rawCode);
    setChannelData(newChannelData);

    return newChan;
  };

  const removeChannel = (id: string) => {
    const resolved = resolveWardId(id);
    if (isDefaultWard(resolved)) return;

    const nextChannels = ensureMasterWardIncluded(
      channels.filter((c) => resolveWardId(c.id) !== resolved)
    );
    setChannels(nextChannels);
    persistKnownWards(nextChannels);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(getChannelDbKey(resolved));
      localStorage.removeItem(getChannelListsKey(resolved));
      localStorage.removeItem(getChannelChecksKey(resolved));
      localStorage.removeItem(getChannelWeekDatesKey(resolved));
    }

    void deleteChannelInFirebase(resolved).catch(() => false);

    if (resolveWardId(activeChannelId) === resolved) {
      setActiveChannelId(DEFAULT_WARD_ID);
    }
  };

  const renameChannel = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const resolved = resolveWardId(id);
    const nextChannels = channels.map((c) =>
      resolveWardId(c.id) === resolved ? { ...c, name: trimmed } : c
    );
    setChannels(nextChannels);
    persistKnownWards(nextChannels);
    void saveWardWorkspacePatchToFirebase(resolved, { name: trimmed }).catch(() => {});
  };

  const addBatchItemsToChannel = (
    channelId: string,
    newItems: any[],
    targetType: 'bag' | 'cart' | 'ambulance' | string = 'bag'
  ) => {
    const targetWardId = resolveWardId(channelId || activeChannelId);
    const key = getChannelDbKey(targetWardId);

    setChannelData((prev) => {
      const currentData =
        targetWardId === resolveWardId(activeChannelId)
          ? prev
          : getStored<ChannelData | null>(key, null) || prev;
      const currentList = currentData.lists?.[targetType] || {
        title:
          targetType === 'bag'
            ? 'กระเป๋าฉุกเฉิน'
            : targetType === 'ambulance'
            ? 'รถพยาบาลฉุกเฉิน'
            : 'รถฉุกเฉิน',
        sheet:
          targetType === 'bag'
            ? 'กระเป๋า Emergency'
            : targetType === 'ambulance'
            ? 'รถ Ambulance'
            : 'รถ Emergency',
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
          subItems:
            Array.isArray(item.subItems) && item.subItems.length > 0 ? item.subItems : undefined,
          subItemQuantities:
            Array.isArray(item.subItemQuantities) && item.subItemQuantities.length > 0
              ? item.subItemQuantities
              : Array.isArray(item.subItems) && item.subItems.length > 0
              ? item.subItems.map(() => 1)
              : undefined,
          checkType:
            Array.isArray(item.subItems) && item.subItems.length > 1 ? 'sub_items' : 'single',
        };

        updatedGroups[groupName].push(formattedItem);
      });

      Object.keys(updatedGroups).forEach((groupName) => {
        updatedGroups[groupName] = sortItemsNaturally(updatedGroups[groupName]);
      });

      const updatedLists = {
        ...currentData.lists,
        [targetType]: {
          ...currentList,
          groups: updatedGroups,
        },
      };

      const nextChannelData: ChannelData = {
        ...currentData,
        lists: updatedLists,
      };

      setStored(key, nextChannelData);
      setStored(getChannelListsKey(targetWardId), updatedLists);
      if (isDefaultWard(targetWardId)) {
        setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      }

      // Sync updated lists immediately to shared Firestore ward workspace
      void saveWardWorkspacePatchToFirebase(targetWardId, {
        lists: updatedLists,
        ...(targetType === 'bag' ? { bagCleared: false } : {}),
        ...(targetType === 'cart' ? { cartCleared: false } : {}),
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('channel_data_updated', {
            detail: { channelId: targetWardId, data: nextChannelData },
          })
        );
        window.dispatchEvent(
          new CustomEvent('items_updated', {
            detail: { type: targetType, count: newItems.length },
          })
        );
      }

      return targetWardId === resolveWardId(activeChannelId) ? nextChannelData : prev;
    });
  };

  const batchUpdateItemQuantities = (
    channelId: string,
    updates: Array<{ itemName: string; newQty: string }>,
    targetType: 'bag' | 'cart' | 'ambulance' | string = 'bag'
  ) => {
    const targetWardId = resolveWardId(channelId || activeChannelId);
    const key = getChannelDbKey(targetWardId);

    setChannelData((prev) => {
      const currentData =
        targetWardId === resolveWardId(activeChannelId)
          ? prev
          : getStored<ChannelData | null>(key, null) || prev;
      const currentList = currentData.lists?.[targetType];
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
        ...currentData.lists,
        [targetType]: {
          ...currentList,
          groups: updatedGroups,
        },
      };

      const nextChannelData: ChannelData = {
        ...currentData,
        lists: updatedLists,
      };

      setStored(key, nextChannelData);
      setStored(getChannelListsKey(targetWardId), updatedLists);
      if (isDefaultWard(targetWardId)) {
        setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      }

      void saveWardWorkspacePatchToFirebase(targetWardId, { lists: updatedLists }).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('channel_data_updated', {
            detail: { channelId: targetWardId, data: nextChannelData },
          })
        );
        window.dispatchEvent(
          new CustomEvent('items_updated', {
            detail: { type: targetType, count: updates.length },
          })
        );
      }

      return targetWardId === resolveWardId(activeChannelId) ? nextChannelData : prev;
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
      window.dispatchEvent(
        new CustomEvent('channel_data_updated', { detail: { channelId: activeChannelId } })
      );
    }
  };

  // Optional 4-digit Edit Protection PIN controls
  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!channelData.pinEnabled || !channelData.pinHash) {
        setIsSessionUnlocked(true);
        return true;
      }
      const ok = await verifyPinHash(pin, channelData.pinSalt, channelData.pinHash);
      if (ok) {
        setWardSessionUnlocked(activeChannelId, channelData.pinHash);
        setIsSessionUnlocked(true);
      }
      return ok;
    },
    [activeChannelId, channelData.pinEnabled, channelData.pinHash, channelData.pinSalt]
  );

  const lockSession = useCallback(() => {
    setWardSessionUnlocked(activeChannelId, null);
    if (channelData.pinEnabled) {
      setIsSessionUnlocked(false);
    }
  }, [activeChannelId, channelData.pinEnabled]);

  const enableOrChangePin = useCallback(
    async (
      newPin: string,
      currentPin?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isValidFourDigitPin(newPin)) {
        return { ok: false, error: 'กรุณาระบุรหัส PIN เป็นตัวเลข 4 หลักเท่านั้น' };
      }
      if (channelData.pinEnabled && channelData.pinHash) {
        const verified = await verifyPinHash(
          currentPin || '',
          channelData.pinSalt,
          channelData.pinHash
        );
        if (!verified) {
          return { ok: false, error: 'รหัส PIN ปัจจุบันไม่ถูกต้อง' };
        }
      }
      const salt = generatePinSalt();
      const digest = await hashPinWithSalt(newPin, salt);
      const wardId = resolveWardId(activeChannelId);

      const saved = await saveWardWorkspacePatchToFirebase(wardId, {
        pinEnabled: true,
        pinHash: digest,
        pinSalt: salt,
      }).catch(() => false);

      if (!saved) {
        return { ok: false, error: 'ไม่สามารถบันทึกรหัส PIN บน Cloud ได้ กรุณาลองใหม่' };
      }

      setWardSessionUnlocked(wardId, digest);
      setIsSessionUnlocked(true);
      setChannelData((prev) => ({
        ...prev,
        pinEnabled: true,
        pinHash: digest,
        pinSalt: salt,
      }));
      return { ok: true };
    },
    [activeChannelId, channelData.pinEnabled, channelData.pinHash, channelData.pinSalt]
  );

  const disablePin = useCallback(
    async (currentPin: string): Promise<{ ok: boolean; error?: string }> => {
      if (channelData.pinEnabled && channelData.pinHash) {
        const verified = await verifyPinHash(
          currentPin,
          channelData.pinSalt,
          channelData.pinHash
        );
        if (!verified) {
          return { ok: false, error: 'รหัส PIN ไม่ถูกต้อง ไม่สามารถปิดการล็อกได้' };
        }
      }
      const wardId = resolveWardId(activeChannelId);
      const saved = await saveWardWorkspacePatchToFirebase(wardId, {
        pinEnabled: false,
        pinHash: '',
        pinSalt: '',
      }).catch(() => false);

      if (!saved) {
        return { ok: false, error: 'ไม่สามารถยกเลิกรหัส PIN บน Cloud ได้ กรุณาลองใหม่' };
      }

      setWardSessionUnlocked(wardId, null);
      setIsSessionUnlocked(true);
      setChannelData((prev) => ({
        ...prev,
        pinEnabled: false,
        pinHash: '',
        pinSalt: '',
      }));
      return { ok: true };
    },
    [activeChannelId, channelData.pinEnabled, channelData.pinHash, channelData.pinSalt]
  );

  const pinConfig: PinProtectionState = {
    pinEnabled: Boolean(channelData.pinEnabled && channelData.pinHash),
    isSessionUnlocked: !channelData.pinEnabled || !channelData.pinHash || isSessionUnlocked,
    unlockWithPin,
    lockSession,
    enableOrChangePin,
    disablePin,
  };

  // Ward Permission Locks (dual-synced via Firestore admin_config/locks & /api/admin/locks/:wardId)
  const [wardPermissionLocks, setWardPermissionLocks] = useState<WardPermissionLocks>(
    DEFAULT_WARD_PERMISSION_LOCKS
  );
  const [trashItems, setTrashItems] = useState<TrashItemRecord[]>([]);
  const firestoreLocksRef = useRef<WardPermissionLocks | null>(null);
  const serverLocksRef = useRef<WardPermissionLocks | null>(null);

  const reconcileWardLocks = useCallback(() => {
    const fsLocks = firestoreLocksRef.current;
    const srvLocks = serverLocksRef.current;
    if (fsLocks && srvLocks) {
      const fsTs = Date.parse(fsLocks.updatedAt || '') || 0;
      const srvTs = Date.parse(srvLocks.updatedAt || '') || 0;
      setWardPermissionLocks(srvTs > fsTs ? srvLocks : fsLocks);
    } else if (fsLocks) {
      setWardPermissionLocks(fsLocks);
    } else if (srvLocks) {
      setWardPermissionLocks(srvLocks);
    } else {
      setWardPermissionLocks(DEFAULT_WARD_PERMISSION_LOCKS);
    }
  }, []);

  useEffect(() => {
    const wardId = resolveWardId(activeChannelId);
    firestoreLocksRef.current = null;
    serverLocksRef.current = null;

    let active = true;
    const unsubLocks = subscribeWardAdminLocks(wardId, (locks) => {
      if (!active) return;
      firestoreLocksRef.current = locks;
      reconcileWardLocks();
    });

    fetch(`/api/admin/locks/${encodeURIComponent(wardId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.locks) return;
        serverLocksRef.current = {
          lockStaffDeleteItems: Boolean(data.locks.lockStaffDeleteItems),
          lockStaffEditStructure: Boolean(data.locks.lockStaffEditStructure),
          lockGoogleSheetsExport: Boolean(data.locks.lockGoogleSheetsExport),
          updatedAt: data.locks.updatedAt || '',
          updatedBy: data.locks.updatedBy || '',
        };
        reconcileWardLocks();
      })
      .catch(() => {});

    const unsubTrash = subscribeWardTrash(wardId, (items) => {
      if (!active) return;
      setTrashItems(items);
    });

    return () => {
      active = false;
      unsubLocks();
      unsubTrash();
    };
  }, [activeChannelId, reconcileWardLocks]);

  const updatePermissionLocks = useCallback(
    async (
      patch: Partial<WardPermissionLocks>,
      options?: { superAdminToken?: string | null; operatorName?: string }
    ): Promise<{ ok: boolean; error?: string }> => {
      const wardId = resolveWardId(activeChannelId);
      const actorName = options?.operatorName || userName || 'Admin';
      const prevLocks = { ...wardPermissionLocks };
      const nextLocks: WardPermissionLocks = {
        lockStaffDeleteItems:
          typeof patch.lockStaffDeleteItems === 'boolean'
            ? patch.lockStaffDeleteItems
            : prevLocks.lockStaffDeleteItems,
        lockStaffEditStructure:
          typeof patch.lockStaffEditStructure === 'boolean'
            ? patch.lockStaffEditStructure
            : prevLocks.lockStaffEditStructure,
        lockGoogleSheetsExport:
          typeof patch.lockGoogleSheetsExport === 'boolean'
            ? patch.lockGoogleSheetsExport
            : prevLocks.lockGoogleSheetsExport,
        updatedAt: new Date().toISOString(),
        updatedBy: actorName,
      };

      setWardPermissionLocks(nextLocks);
      serverLocksRef.current = nextLocks;

      let serverSaved = false;
      try {
        let bearer = options?.superAdminToken || null;
        if (!bearer && auth.currentUser) {
          bearer = await auth.currentUser.getIdToken();
        }
        if (bearer) {
          const res = await fetch(`/api/admin/locks/${encodeURIComponent(wardId)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${bearer}`,
            },
            body: JSON.stringify({ ...nextLocks, updatedBy: actorName }),
          });
          serverSaved = res.ok;
        }
      } catch {
        serverSaved = false;
      }

      let firestoreSaved = false;
      if (auth.currentUser) {
        const fsRes = await saveWardAdminLocksToFirebase(wardId, nextLocks);
        firestoreSaved = fsRes.ok;
        if (fsRes.ok) {
          firestoreLocksRef.current = nextLocks;
        }
      }

      if (!serverSaved && !firestoreSaved) {
        setWardPermissionLocks(prevLocks);
        return {
          ok: false,
          error: 'ไม่สามารถบันทึกการตั้งค่าสิทธิ์ได้ กรุณาปลดล็อกสิทธิ์ Admin แล้วลองใหม่',
        };
      }

      void logAuditEvent({
        action: 'PERMISSION_CHANGE',
        targetCollection: `wards/${wardId}/admin_config`,
        targetId: 'locks',
        wardId,
        operatorName: actorName,
        itemName: `สิทธิ์การเข้าถึงห้องวอร์ด ${wardId}`,
        category: 'สิทธิ์ระบบ',
        oldValue: `ลบ:${prevLocks.lockStaffDeleteItems ? 'ล็อก' : 'เปิด'}, โครงสร้าง:${
          prevLocks.lockStaffEditStructure ? 'ล็อก' : 'เปิด'
        }, Sheets:${prevLocks.lockGoogleSheetsExport ? 'ล็อก' : 'เปิด'}`,
        newValue: `ลบ:${nextLocks.lockStaffDeleteItems ? 'ล็อก' : 'เปิด'}, โครงสร้าง:${
          nextLocks.lockStaffEditStructure ? 'ล็อก' : 'เปิด'
        }, Sheets:${nextLocks.lockGoogleSheetsExport ? 'ล็อก' : 'เปิด'}`,
        details: {
          channelId: wardId,
          oldValue: prevLocks,
          newValue: nextLocks,
        },
        currentUser: userProfile,
      });

      return { ok: true };
    },
    [activeChannelId, userName, userProfile, wardPermissionLocks]
  );

  // Device-local Personal Operator Profile handlers
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
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
      } catch {}
    }
  };

  const saveUserProfile = async (
    name: string,
    position: string,
    avatar?: string
  ): Promise<User> => {
    const trimmedName = name.trim() || 'สาธิต';
    const trimmedPos = position.trim() || 'พยาบาลวิสัญญี';

    localStorage.setItem('user_display_name', trimmedName);
    localStorage.setItem('user_display_position', trimmedPos);
    localStorage.setItem('user_name_default', trimmedName);
    localStorage.setItem('user_position_default', trimmedPos);

    const updatedUser: User = {
      ...(userProfile || {
        id: 'local_operator',
        username: 'staff',
        role: 'user',
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
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedUser));
    } catch {}

    try {
      await saveUserToFirebase(updatedUser);
    } catch {
      // Optional cloud user save skipped when operating without Google Login
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
        wardSyncReady,
        setActiveChannelId,
        switchWard,
        addChannel,
        removeChannel,
        renameChannel,
        batchAddItems,
        addBatchItemsToChannel,
        batchUpdateItemQuantities,
        setItems,
        reRenderData,
        channelData,
        updateChannelData,
        applySyncedLists,
        pinConfig,
        wardPermissionLocks,
        updatePermissionLocks,
        trashItems,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    const fallbackName =
      typeof window !== 'undefined' ? localStorage.getItem('user_display_name') || 'สาธิต' : 'สาธิต';
    const fallbackPos =
      typeof window !== 'undefined'
        ? localStorage.getItem('user_display_position') || 'พยาบาลวิสัญญี'
        : 'พยาบาลวิสัญญี';
    return {
      userName: fallbackName,
      setUserName: (n) => {
        if (typeof window !== 'undefined') localStorage.setItem('user_display_name', n);
      },
      userPosition: fallbackPos,
      setUserPosition: (p) => {
        if (typeof window !== 'undefined') localStorage.setItem('user_display_position', p);
      },
      userProfile: null,
      setUserProfile: () => {},
      saveUserProfile: async (n, p, a) => ({
        id: 'local_operator',
        username: 'staff',
        name: n,
        role: 'user',
        position: p,
        active: true,
        must: false,
        created: '',
        last: '',
        avatar: a,
      }),
      channels: DEFAULT_CHANNELS,
      activeChannelId: DEFAULT_WARD_ID,
      activeChannel: DEFAULT_CHANNELS[0],
      wardSyncReady: false,
      setActiveChannelId: () => {},
      switchWard: async (code) => ({ ok: true, wardId: resolveWardId(code) }),
      addChannel: (n) => ({
        id: `WARD-${Date.now().toString(36).toUpperCase()}`,
        name: n,
        isDefault: false,
        createdAt: '',
      }),
      removeChannel: () => {},
      renameChannel: () => {},
      batchAddItems: () => {},
      addBatchItemsToChannel: () => {},
      batchUpdateItemQuantities: () => {},
      setItems: () => {},
      reRenderData: () => {},
      channelData: {
        lists: buildEmptyListsSkeleton(),
        globalChecks: {},
        emergencyWeekDates: {},
        deletedItemIds: [],
      },
      updateChannelData: () => {},
      applySyncedLists: () => {},
      pinConfig: {
        pinEnabled: false,
        isSessionUnlocked: true,
        unlockWithPin: async () => true,
        lockSession: () => {},
        enableOrChangePin: async () => ({ ok: true }),
        disablePin: async () => ({ ok: true }),
      },
      wardPermissionLocks: DEFAULT_WARD_PERMISSION_LOCKS,
      updatePermissionLocks: async () => ({ ok: true }),
      trashItems: [],
    };
  }
  return context;
};

export default DataContext;
