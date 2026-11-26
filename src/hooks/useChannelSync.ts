import { useEffect, useRef, useState } from 'react';
import {
  InventoryStateFlags,
  fetchChannelDataFromFirebase,
  ensureWardWorkspaceInitialized,
  loadInventoryFlagsFromFirebase,
  loadSettingsFromFirebase,
  saveChannelBatchDrugsToFirebase,
  saveChannelBatchEquipmentToFirebase,
  saveInventoryFlagsToFirebase,
  subscribeWardDrugs,
  subscribeWardEquipment,
  subscribeWardInspectionHistory,
} from '../services/firebase';
import {
  filterDrugsByTombstones,
  filterEquipmentMapByTombstones,
  getDeletedItemIds,
  getInitialEquipment,
  getStored,
  setDeletedItemIds,
  setStored,
  STORAGE_KEYS,
} from '../services/storage';
import { getChannelStorageKeys } from '../utils/helpers';
import { ROOMS } from '../constants/initialData';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import {
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
import { DEFAULT_WARD_ID, isDefaultWard, resolveWardId } from '../utils/wardUtils';

const CLEARED_FLAGS_STORAGE_KEY = 'anesthesia_cleared_flags';

export function getChannelFlagsStorageKey(channelId?: string): string {
  const resolved = resolveWardId(channelId);
  if (resolved === DEFAULT_WARD_ID) return CLEARED_FLAGS_STORAGE_KEY;
  return `${CLEARED_FLAGS_STORAGE_KEY}_${resolved}`;
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
  const resolved = resolveWardId(channelId);
  const storageKey = getChannelFlagsStorageKey(resolved);
  const merged: InventoryStateFlags = {
    ...getLocalClearedFlags(resolved),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {
    // Ignore storage quota errors
  }
  await saveInventoryFlagsToFirebase(merged, resolved).catch(() => {});
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
  setLists?: (
    lists:
      | Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
      | ((
          prev: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
        ) => Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>)
  ) => void;
  setHistoryRecords: React.Dispatch<React.SetStateAction<InspectionHistoryRecord[]>>;
}

function groupEquipmentByRoom(items: EquipmentItem[]): Record<string, EquipmentItem[]> {
  const roomEq: Record<string, EquipmentItem[]> = {};
  (items || []).forEach((item) => {
    if ((item.type === 'room' || (!item.type && item.roomId)) && item.roomId && isValidInventoryItem(item)) {
      const normalizedRoomId = normalizeEquipmentRoomId(item.roomId, ROOMS) || item.roomId;
      if (!roomEq[normalizedRoomId]) roomEq[normalizedRoomId] = [];
      roomEq[normalizedRoomId].push(
        item.roomId === normalizedRoomId ? item : { ...item, roomId: normalizedRoomId }
      );
    }
  });
  return roomEq;
}

function normalizeDrugsList(arr: DrugItem[]): DrugItem[] {
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
}

/**
 * 100% Real-Time Shared Ward Inventory Sync (`wards/{wardId}/...`).
 * Automatically connects Desktop (including Incognito) and Mobile without requiring Google Login.
 */
export function useChannelSync(params: UseChannelSyncParams) {
  const {
    activeChannelId,
    setSheetUrl,
    setApiUrl,
    setTheme,
    setDrugs,
    setEquipment,
    setHistoryRecords,
  } = params;

  const [isLoadingData, setIsLoadingData] = useState(true);
  const seededEqOnceRef = useRef<Set<string>>(new Set());
  const seededDrugsOnceRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const wardId = resolveWardId(activeChannelId);
    const isMaster = isDefaultWard(wardId);
    const chKeys = getChannelStorageKeys(wardId);

    let unsubEquipment: (() => void) | undefined;
    let unsubDrugs: (() => void) | undefined;
    let unsubHistory: (() => void) | undefined;

    const startRealtimeWardSync = async () => {
      setIsLoadingData(true);

      // 1. Instant local cache hydration for zero-flicker paint
      const localFlags = getLocalClearedFlags(wardId);
      const localTombstoneSet = new Set(getDeletedItemIds(wardId));
      const cachedEq = localFlags.equipmentCleared
        ? {}
        : normalizeEquipmentMap(
            filterEquipmentMapByTombstones(
              getStored<Record<string, EquipmentItem[]> | null>(chKeys.EQ, null) ||
                (isMaster ? getStored<Record<string, EquipmentItem[]> | null>(STORAGE_KEYS.EQ, null) || {} : {}),
              localTombstoneSet
            ),
            ROOMS
          );
      setEquipment(cachedEq);

      const cachedDrugs = localFlags.drugsCleared
        ? []
        : normalizeDrugsList(
            filterDrugsByTombstones(
              getStored<DrugItem[] | null>(chKeys.DRUGS, null) ||
                (isMaster ? getStored<DrugItem[] | null>(STORAGE_KEYS.DRUGS, null) || [] : []),
              localTombstoneSet
            )
          );
      setDrugs(cachedDrugs);

      try {
        // 2. Ensure `wards/{wardId}` exists and load authoritative ward metadata/flags
        await ensureWardWorkspaceInitialized(wardId).catch(() => null);
        if (cancelled) return;

        const [fbSettings, remoteWardDoc, remoteFlags] = await Promise.all([
          loadSettingsFromFirebase(wardId).catch(() => null),
          fetchChannelDataFromFirebase(wardId).catch(() => null),
          loadInventoryFlagsFromFirebase(wardId).catch(() => null),
        ]);
        if (cancelled) return;

        if (fbSettings) {
          if (fbSettings.sheetUrl) setSheetUrl(fbSettings.sheetUrl);
          if (fbSettings.apiUrl) setApiUrl(fbSettings.apiUrl);
          if (fbSettings.theme) setTheme(fbSettings.theme);
        }

        const mergedFlags: InventoryStateFlags = {
          ...localFlags,
          ...(remoteFlags || {}),
        };
        try {
          localStorage.setItem(getChannelFlagsStorageKey(wardId), JSON.stringify(mergedFlags));
        } catch {}

        if (Array.isArray(remoteWardDoc?.deletedItemIds)) {
          setDeletedItemIds(wardId, remoteWardDoc.deletedItemIds);
        }

        // 3. Real-time Inspection History subscription
        unsubHistory = subscribeWardInspectionHistory(wardId, (records) => {
          if (!cancelled) {
            setHistoryRecords(records);
          }
        });

        // 4. Real-time Room Equipment subscription
        unsubEquipment = subscribeWardEquipment(wardId, (fbItems) => {
          if (cancelled) return;
          const latestFlags = getLocalClearedFlags(wardId);
          const tombstoneSet = new Set(getDeletedItemIds(wardId));
          const fbRoomItems = fbItems.filter((i) => i.type === 'room' || (!i.type && i.roomId));

          if (latestFlags.equipmentCleared) {
            setEquipment({});
            setStored(chKeys.EQ, {});
            if (isMaster) setStored(STORAGE_KEYS.EQ, {});
            setIsLoadingData(false);
            return;
          }

          if (fbRoomItems.length > 0) {
            const grouped = normalizeEquipmentMap(
              filterEquipmentMapByTombstones(groupEquipmentByRoom(fbRoomItems), tombstoneSet),
              ROOMS
            );
            setEquipment(grouped);
            setStored(chKeys.EQ, grouped);
            if (isMaster) setStored(STORAGE_KEYS.EQ, grouped);
            setIsLoadingData(false);
            return;
          }

          // Only seed ANES-MASTER once if it has never been seeded or cleared on Cloud
          const alreadySeededOrCleared = Boolean(
            mergedFlags.equipmentSeeded ||
              mergedFlags.equipmentCleared ||
              latestFlags.equipmentSeeded ||
              latestFlags.equipmentCleared ||
              seededEqOnceRef.current.has(wardId)
          );

          if (isMaster && !alreadySeededOrCleared) {
            seededEqOnceRef.current.add(wardId);
            const seededEq = normalizeEquipmentMap(
              filterEquipmentMapByTombstones(getInitialEquipment(), tombstoneSet),
              ROOMS
            );
            setEquipment(seededEq);
            setStored(chKeys.EQ, seededEq);
            setStored(STORAGE_KEYS.EQ, seededEq);

            const toSync: EquipmentItem[] = [];
            Object.entries(seededEq).forEach(([rId, arr]) => {
              (arr || []).forEach((it, idx) => {
                toSync.push({
                  ...it,
                  id: it.id || `eq_${rId}_${idx}`,
                  roomId: it.roomId || rId,
                  wardId,
                  type: it.type || 'room',
                });
              });
            });
            if (toSync.length > 0) {
              void saveChannelBatchEquipmentToFirebase(wardId, toSync).catch(() => {});
            }
            void persistClearedFlags({ equipmentSeeded: true }, wardId);
          } else {
            setEquipment({});
            setStored(chKeys.EQ, {});
            if (isMaster) setStored(STORAGE_KEYS.EQ, {});
          }
          setIsLoadingData(false);
        });

        // 5. Real-time Drugs subscription
        unsubDrugs = subscribeWardDrugs(wardId, (fbDrugs) => {
          if (cancelled) return;
          const latestFlags = getLocalClearedFlags(wardId);
          const tombstoneSet = new Set(getDeletedItemIds(wardId));

          if (latestFlags.drugsCleared) {
            setDrugs([]);
            setStored(chKeys.DRUGS, []);
            if (isMaster) setStored(STORAGE_KEYS.DRUGS, []);
            return;
          }

          if (fbDrugs && fbDrugs.length > 0) {
            const filtered = normalizeDrugsList(filterDrugsByTombstones(fbDrugs, tombstoneSet));
            setDrugs(filtered);
            setStored(chKeys.DRUGS, filtered);
            if (isMaster) setStored(STORAGE_KEYS.DRUGS, filtered);
            return;
          }

          const alreadySeededOrCleared = Boolean(
            mergedFlags.drugsSeeded ||
              mergedFlags.drugsCleared ||
              latestFlags.drugsSeeded ||
              latestFlags.drugsCleared ||
              seededDrugsOnceRef.current.has(wardId)
          );

          if (isMaster && !alreadySeededOrCleared) {
            seededDrugsOnceRef.current.add(wardId);
            const seededDrugs = normalizeDrugsList(
              filterDrugsByTombstones(INITIAL_DRUGS_DATA, tombstoneSet)
            ).map((d) => ({ ...d, wardId }));
            setDrugs(seededDrugs);
            setStored(chKeys.DRUGS, seededDrugs);
            setStored(STORAGE_KEYS.DRUGS, seededDrugs);
            if (seededDrugs.length > 0) {
              void saveChannelBatchDrugsToFirebase(wardId, seededDrugs).catch(() => {});
            }
            void persistClearedFlags({ drugsSeeded: true }, wardId);
          } else {
            setDrugs([]);
            setStored(chKeys.DRUGS, []);
            if (isMaster) setStored(STORAGE_KEYS.DRUGS, []);
          }
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('Ward realtime sync fallback active:', err);
          setIsLoadingData(false);
        }
      }
    };

    void startRealtimeWardSync();

    return () => {
      cancelled = true;
      try {
        unsubEquipment?.();
        unsubDrugs?.();
        unsubHistory?.();
      } catch {
        // Ignore listener cleanup errors
      }
    };
  }, [activeChannelId]);

  return {
    isLoadingData,
  };
}
