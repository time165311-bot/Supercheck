import { useEffect, useState } from 'react';
import {
  auth,
  clearChannelDrugsInFirebase,
  fetchChannelDataFromFirebase,
  fetchChannelDrugsFromFirebase,
  fetchChannelEquipmentFromFirebase,
  InventoryStateFlags,
  loadInventoryFlagsFromFirebase,
  loadSettingsFromFirebase,
  saveChannelBatchDrugsToFirebase,
  saveChannelBatchEquipmentToFirebase,
  saveInventoryFlagsToFirebase,
  subscribeInspectionHistory,
} from '../services/firebase';
import {
  filterDrugsByTombstones,
  filterEquipmentMapByTombstones,
  filterListsMapByTombstones,
  getChannelListsKey,
  getDeletedItemIds,
  getInitialEquipment,
  getInitialLists,
  getStored,
  setDeletedItemIds,
  setStored,
  STORAGE_KEYS,
} from '../services/storage';
import { getChannelStorageKeys } from '../utils/helpers';
import { DEFAULT_LISTS, ROOMS } from '../constants/initialData';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import {
  buildResolvedListsMap,
  isValidInventoryItem,
  normalizeEquipmentMap,
  normalizeEquipmentRoomId,
} from '../utils/inventoryStats';
import {
  DrugItem,
  EquipmentItem,
  InspectionHistoryRecord,
  ListConfig,
} from '../types';

const CLEARED_FLAGS_STORAGE_KEY = 'anesthesia_cleared_flags';

export function getChannelFlagsStorageKey(channelId?: string): string {
  if (!channelId || channelId === 'channel_master') return CLEARED_FLAGS_STORAGE_KEY;
  return `${CLEARED_FLAGS_STORAGE_KEY}_${channelId}`;
}

export function getLocalClearedFlags(channelId?: string): InventoryStateFlags {
  try {
    const raw = localStorage.getItem(getChannelFlagsStorageKey(channelId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function persistClearedFlags(
  patch: Partial<InventoryStateFlags>,
  channelId?: string
) {
  const isMaster = !channelId || channelId === 'channel_master';
  const storageKey = getChannelFlagsStorageKey(channelId);
  const merged: InventoryStateFlags = {
    ...getLocalClearedFlags(channelId),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {
    // Ignore storage quota errors
  }
  if (isMaster) {
    await saveInventoryFlagsToFirebase(merged).catch(() => {});
  }
  return merged;
}

export interface UseChannelSyncParams {
  activeChannelId: string;
  authReady?: boolean;
  isAuthenticated?: boolean;
  setSheetUrl: (url: string) => void;
  setApiUrl: (url: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setDrugs: (drugs: DrugItem[]) => void;
  setEquipment: (eq: Record<string, EquipmentItem[]>) => void;
  setLists: (
    lists:
      | Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
      | ((
          prev: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
        ) => Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>)
  ) => void;
  setHistoryRecords: React.Dispatch<React.SetStateAction<InspectionHistoryRecord[]>>;
}

export function useChannelSync(params: UseChannelSyncParams) {
  const {
    activeChannelId,
    authReady = true,
    isAuthenticated = Boolean(auth.currentUser),
    setSheetUrl,
    setApiUrl,
    setTheme,
    setDrugs,
    setEquipment,
    setLists,
    setHistoryRecords,
  } = params;

  const [isLoadingData, setIsLoadingData] = useState(true);

  // Sync Firebase Settings & Inspection History only when authenticated
  useEffect(() => {
    if (!authReady || !isAuthenticated || !auth.currentUser) {
      return;
    }

    let unsubHistory: (() => void) | undefined;
    let active = true;

    const bootCloud = async () => {
      try {
        const fbSettings = await loadSettingsFromFirebase();
        if (!active) return;
        if (fbSettings) {
          if (fbSettings.sheetUrl) setSheetUrl(fbSettings.sheetUrl);
          if (fbSettings.apiUrl) setApiUrl(fbSettings.apiUrl);
          if (fbSettings.theme) setTheme(fbSettings.theme);
        }
        unsubHistory = await subscribeInspectionHistory((records) => {
          if (active) setHistoryRecords(records);
        });
      } catch (err) {
        console.warn('Cloud sync warning (continuing locally):', err);
      }
    };

    bootCloud();
    return () => {
      active = false;
      try {
        unsubHistory?.();
      } catch {
        // Ignore cleanup error
      }
    };
  }, [authReady, isAuthenticated]);

  // Channel-Isolated Inventory Loading (Firestore Offline Cache + LocalStorage fallback)
  useEffect(() => {
    let cancelled = false;
    const channelId = activeChannelId || 'channel_master';
    const isMaster = channelId === 'channel_master';
    const chKeys = getChannelStorageKeys(channelId);

    const groupEquipmentByRoom = (items: EquipmentItem[]): Record<string, EquipmentItem[]> => {
      const roomEq: Record<string, EquipmentItem[]> = {};
      items.forEach((item) => {
        if ((item.type === 'room' || (!item.type && item.roomId)) && item.roomId && isValidInventoryItem(item)) {
          const normalizedRoomId = normalizeEquipmentRoomId(item.roomId, ROOMS) || item.roomId;
          if (!roomEq[normalizedRoomId]) roomEq[normalizedRoomId] = [];
          roomEq[normalizedRoomId].push(
            item.roomId === normalizedRoomId ? item : { ...item, roomId: normalizedRoomId }
          );
        }
      });
      return roomEq;
    };

    const loadChannelInventory = async () => {
      setIsLoadingData(true);
      const canUseCloud = Boolean(authReady && isAuthenticated && auth.currentUser);
      try {
        const localFlags = getLocalClearedFlags(channelId);
        const remoteFlags =
          canUseCloud && isMaster
            ? await loadInventoryFlagsFromFirebase().catch(() => null)
            : null;
        const flags: InventoryStateFlags = {
          ...localFlags,
          ...(remoteFlags || {}),
        };
        try {
          localStorage.setItem(getChannelFlagsStorageKey(channelId), JSON.stringify(flags));
        } catch {}

        if (cancelled) return;

        const remoteChannelDoc = canUseCloud
          ? await fetchChannelDataFromFirebase(channelId).catch(() => null)
          : null;
        if (cancelled) return;
        const mergedTombstones = setDeletedItemIds(channelId, [
          ...getDeletedItemIds(channelId),
          ...(Array.isArray(remoteChannelDoc?.deletedItemIds) ? remoteChannelDoc.deletedItemIds : []),
        ]);
        const tombstoneSet = new Set(mergedTombstones);

        // 1. Channel-Isolated Equipment Loading
        const fbEquipment = canUseCloud
          ? await fetchChannelEquipmentFromFirebase(channelId)
          : [];
        if (cancelled) return;

        const fbRoomItems = fbEquipment.filter((i) => i.type === 'room' || (!i.type && i.roomId));
        const localChEq = getStored<Record<string, EquipmentItem[]> | null>(chKeys.EQ, null);
        const legacyMasterEq = isMaster
          ? getStored<Record<string, EquipmentItem[]> | null>(STORAGE_KEYS.EQ, null)
          : null;
        const localEqRaw = localChEq || legacyMasterEq;
        const hasLocalEq = Boolean(
          localEqRaw && Object.values(localEqRaw).some((arr) => Array.isArray(arr) && arr.length > 0)
        );

        if (flags.equipmentCleared) {
          setEquipment({});
          setStored(chKeys.EQ, {});
          if (isMaster) setStored(STORAGE_KEYS.EQ, {});
        } else if (fbRoomItems.length > 0) {
          const grouped = normalizeEquipmentMap(
            filterEquipmentMapByTombstones(groupEquipmentByRoom(fbRoomItems), tombstoneSet),
            ROOMS
          );
          setEquipment(grouped);
          setStored(chKeys.EQ, grouped);
          if (isMaster) setStored(STORAGE_KEYS.EQ, grouped);
        } else if (hasLocalEq && localEqRaw) {
          const filteredLocalEq = normalizeEquipmentMap(
            filterEquipmentMapByTombstones(localEqRaw, tombstoneSet),
            ROOMS
          );
          setEquipment(filteredLocalEq);
          setStored(chKeys.EQ, filteredLocalEq);
          if (canUseCloud) {
            const toSync: EquipmentItem[] = [];
            Object.entries(filteredLocalEq).forEach(([rId, arr]) => {
              (arr || []).forEach((it, idx) => {
                toSync.push({
                  ...it,
                  id: it.id || `eq_${rId}_${idx}`,
                  roomId: it.roomId || rId,
                  type: it.type || 'room',
                });
              });
            });
            if (toSync.length > 0) {
              void saveChannelBatchEquipmentToFirebase(channelId, toSync).catch(() => {});
            }
          }
        } else if (isMaster) {
          const seededEq = normalizeEquipmentMap(
            filterEquipmentMapByTombstones(getInitialEquipment(), tombstoneSet),
            ROOMS
          );
          setEquipment(seededEq);
          setStored(chKeys.EQ, seededEq);
          if (canUseCloud) {
            const toSync: EquipmentItem[] = [];
            Object.entries(seededEq).forEach(([rId, arr]) => {
              (arr || []).forEach((it, idx) => {
                toSync.push({
                  ...it,
                  id: it.id || `eq_${rId}_${idx}`,
                  roomId: it.roomId || rId,
                  type: it.type || 'room',
                });
              });
            });
            if (toSync.length > 0) {
              void saveChannelBatchEquipmentToFirebase(channelId, toSync).catch(() => {});
            }
          }
        } else {
          setEquipment({});
          setStored(chKeys.EQ, {});
        }

        // Safe Emergency Bag / Cart / Ambulance hydration (merges partial Firestore items without overwriting full lists)
        const fbBagItems = fbEquipment.filter((i) => i.type === 'bag');
        const fbCartItems = fbEquipment.filter((i) => i.type === 'cart');
        const fbAmbulanceItems = fbEquipment.filter((i) => i.type === 'ambulance');
        const localChannelLists =
          getStored<Record<'bag' | 'cart' | 'ambulance' | string, ListConfig> | null>(
            getChannelListsKey(channelId),
            null
          ) ||
          (isMaster
            ? getStored<Record<'bag' | 'cart' | 'ambulance' | string, ListConfig> | null>(
                STORAGE_KEYS.CUSTOM_LISTS,
                null
              )
            : null);

        if (isMaster || remoteChannelDoc?.lists || fbBagItems.length > 0 || fbCartItems.length > 0 || fbAmbulanceItems.length > 0 || flags.bagCleared || flags.cartCleared || flags.ambulanceCleared) {
          const resolvedLists = buildResolvedListsMap({
            isMaster,
            flags,
            remoteLists: remoteChannelDoc?.lists || null,
            localLists: localChannelLists,
            defaultLists: DEFAULT_LISTS as Record<string, ListConfig>,
            fbEquipment: [...fbBagItems, ...fbCartItems, ...fbAmbulanceItems],
            tombstoneSet,
          });
          setLists(resolvedLists);
          setStored(getChannelListsKey(channelId), resolvedLists);
          if (isMaster) {
            setStored(STORAGE_KEYS.CUSTOM_LISTS, resolvedLists);
          }
        }

        // 2. Channel-Isolated Drugs Loading
        const normalizeDrugsList = (arr: DrugItem[]): DrugItem[] => {
          const seenDrugIds = new Set<string>();
          return (arr || [])
            .filter((d) => {
              if (!isValidInventoryItem(d)) return false;
              if (d.id) {
                if (seenDrugIds.has(d.id)) return false;
                seenDrugIds.add(d.id);
              }
              return true;
            })
            .map((d) => ({
              ...d,
              category:
                d.category === 'monthly' || d.category === 'quarterly' || d.category === 'adhoc'
                  ? d.category
                  : 'monthly',
            }));
        };

        if (flags.drugsCleared) {
          setDrugs([]);
          setStored(chKeys.DRUGS, []);
          if (isMaster) setStored(STORAGE_KEYS.DRUGS, []);
          if (canUseCloud) {
            await clearChannelDrugsInFirebase(channelId).catch(() => {});
          }
        } else {
          const fbDrugs = canUseCloud
            ? await fetchChannelDrugsFromFirebase(channelId)
            : [];
          if (cancelled) return;
          if (fbDrugs && fbDrugs.length > 0) {
            const filteredFbDrugs = normalizeDrugsList(filterDrugsByTombstones(fbDrugs, tombstoneSet));
            setDrugs(filteredFbDrugs);
            setStored(chKeys.DRUGS, filteredFbDrugs);
            if (isMaster) setStored(STORAGE_KEYS.DRUGS, filteredFbDrugs);
          } else {
            const localChDrugs = getStored<DrugItem[] | null>(chKeys.DRUGS, null);
            const legacyMasterDrugs = isMaster ? getStored<DrugItem[] | null>(STORAGE_KEYS.DRUGS, null) : null;
            const rawResolvedDrugs = Array.isArray(localChDrugs)
              ? localChDrugs
              : Array.isArray(legacyMasterDrugs) && legacyMasterDrugs.length > 0
              ? legacyMasterDrugs
              : isMaster
              ? INITIAL_DRUGS_DATA
              : [];
            const resolvedDrugs = normalizeDrugsList(filterDrugsByTombstones(rawResolvedDrugs, tombstoneSet));
            setDrugs(resolvedDrugs);
            setStored(chKeys.DRUGS, resolvedDrugs);
            if (canUseCloud && resolvedDrugs.length > 0) {
              void saveChannelBatchDrugsToFirebase(channelId, resolvedDrugs).catch(() => {});
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Channel data fallback active:', err);
        const flags = getLocalClearedFlags(channelId);
        const tombstoneSet = new Set(getDeletedItemIds(channelId));
        const localEq = flags.equipmentCleared
          ? {}
          : normalizeEquipmentMap(
              filterEquipmentMapByTombstones(
                getStored<Record<string, EquipmentItem[]> | null>(chKeys.EQ, null) ||
                  (isMaster ? getStored<Record<string, EquipmentItem[]> | null>(STORAGE_KEYS.EQ, null) || getInitialEquipment() : {}),
                tombstoneSet
              ),
              ROOMS
            );
        setEquipment(localEq);

        const localDrugs = flags.drugsCleared
          ? []
          : filterDrugsByTombstones(
              getStored<DrugItem[] | null>(chKeys.DRUGS, null) ||
                (isMaster ? getStored<DrugItem[] | null>(STORAGE_KEYS.DRUGS, null) || INITIAL_DRUGS_DATA : []),
              tombstoneSet
            );
        setDrugs(localDrugs);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    };

    loadChannelInventory();
    return () => {
      cancelled = true;
    };
  }, [activeChannelId, authReady, isAuthenticated]);

  return {
    isLoadingData,
  };
}
