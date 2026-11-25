import { CheckItemState, DrugItem, EquipmentItem, ListConfig, RoomDef } from '../types';
import { ROOMS } from '../constants/initialData';
import { isItemTombstoned, filterListsMapByTombstones } from '../services/storage';
import { sanitizeItemName } from './itemUtils';

/**
 * Validates that an inventory item (Equipment, Drug, or Checklist item) is a genuine
 * named record rather than an empty row or raw unlabelled timestamp placeholder.
 *
 * IMPORTANT: Only checks `item.name` (and not `item.id`), because valid user-added
 * or edited items created in 2026+ carry timestamp IDs like `eq_1793154890123`.
 */
export function isValidInventoryItem(
  item: { id?: string; name?: string } | null | undefined
): boolean {
  if (!item) return false;
  const cleanName = String(item.name || '').trim();
  if (!cleanName) return false;
  if (/^[\s\-_]+$/.test(cleanName)) return false;
  if (/^eq[\s_-]*17\d{6,}$/i.test(cleanName)) return false;
  if (/^eq[\s_-]*\d{8,}$/i.test(cleanName)) return false;
  return true;
}

/**
 * Normalizes a raw roomId / room name to a canonical active RoomDef['id'] from ROOMS.
 * Returns null if the room does not map to any active room when strict=true, or falls back to raw string.
 */
export function normalizeEquipmentRoomId(
  rawRoomId?: string,
  rooms: RoomDef[] = ROOMS
): string {
  const raw = String(rawRoomId || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();

  const exactMatch = rooms.find((r) => r.m && r.id.toLowerCase() === lower);
  if (exactMatch) return exactMatch.id;

  const nameMatch = rooms.find(
    (r) =>
      r.m &&
      ((r.n && r.n.trim().toLowerCase() === lower) ||
        r.l.replace(/\|/g, ' ').trim().toLowerCase() === lower)
  );
  if (nameMatch) return nameMatch.id;

  const compact = lower.replace(/[\s_-]+/g, '');
  const compactMatch = rooms.find(
    (r) =>
      r.m &&
      (r.id.toLowerCase() === compact ||
        (r.n && r.n.replace(/[\s_-]+/g, '').toLowerCase() === compact))
  );
  if (compactMatch) return compactMatch.id;

  return raw;
}

/**
 * Normalizes and filters an equipment map so room keys match active ROOMS IDs cleanly
 * and every item passes `isValidInventoryItem`.
 */
export function normalizeEquipmentMap(
  equipment: Record<string, EquipmentItem[]> | null | undefined,
  rooms: RoomDef[] = ROOMS
): Record<string, EquipmentItem[]> {
  if (!equipment || typeof equipment !== 'object') return {};
  const normalized: Record<string, EquipmentItem[]> = {};
  const globalSeenIds = new Set<string>();

  Object.entries(equipment).forEach(([rawKey, items]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const roomId = normalizeEquipmentRoomId(rawKey, rooms) || rawKey;
    const validItems = items.filter((it) => isValidInventoryItem(it));
    if (validItems.length === 0) return;

    validItems.forEach((it) => {
      if (it.id) {
        if (globalSeenIds.has(it.id)) return;
        globalSeenIds.add(it.id);
      }
      if (!normalized[roomId]) normalized[roomId] = [];
      normalized[roomId].push(it.roomId === roomId ? it : { ...it, roomId });
    });
  });

  return normalized;
}

/**
 * Counts valid drugs across all categories (monthly, quarterly, adhoc).
 */
export function getDrugsTotalCount(drugs: DrugItem[] | null | undefined): number {
  if (!Array.isArray(drugs)) return 0;
  return drugs.filter((d) => isValidInventoryItem(d)).length;
}

/**
 * Counts valid equipment items across active interactive rooms (matching FloorMap).
 */
export function getEquipmentTotalCount(
  equipment: Record<string, EquipmentItem[]> | null | undefined,
  rooms: RoomDef[] = ROOMS
): number {
  if (!equipment || typeof equipment !== 'object') return 0;
  const activeRoomIds = new Set(rooms.filter((r) => Boolean(r.m)).map((r) => r.id));
  let total = 0;

  // Count canonical active rooms first (matches FloorMap interactiveRooms)
  activeRoomIds.forEach((roomId) => {
    const items = equipment[roomId];
    if (Array.isArray(items)) {
      total += items.filter((it) => isValidInventoryItem(it)).length;
    }
  });

  // Also include any valid items whose roomId wasn't in activeRoomIds so dashboard never diverges
  Object.entries(equipment).forEach(([roomId, items]) => {
    if (activeRoomIds.has(roomId) || !Array.isArray(items)) return;
    const mappedId = normalizeEquipmentRoomId(roomId, rooms);
    if (activeRoomIds.has(mappedId)) {
      total += items.filter((it) => isValidInventoryItem(it)).length;
    }
  });

  return total;
}

/**
 * Counts valid items in a ListConfig (bag, cart, ambulance), matching EmergencyChecklistView.
 */
export function getListCategoryCount(listConfig: ListConfig | null | undefined): number {
  if (!listConfig || !listConfig.groups || typeof listConfig.groups !== 'object') return 0;
  let total = 0;
  Object.values(listConfig.groups).forEach((arr) => {
    if (Array.isArray(arr)) {
      total += arr.filter((it) => isValidInventoryItem(it)).length;
    }
  });
  return total;
}

export interface OverallInventoryStats {
  grandTotal: number;
  grandChecked: number;
  grandNormal: number;
  grandDefective: number;
  completionPct: number;
  drugsCount: number;
  equipmentCount: number;
  bagCount: number;
  ambulanceCount: number;
  cartCount: number;
}

/**
 * Single source of truth for Dashboard category counts AND daily readiness statistics.
 */
export function calculateOverallInventoryStats(params: {
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<string, ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  rooms?: RoomDef[];
}): OverallInventoryStats {
  const { drugs = [], equipment = {}, lists = {}, globalChecks = {}, rooms = ROOMS } = params;

  let grandTotal = 0;
  let grandChecked = 0;
  let grandNormal = 0;
  let grandDefective = 0;

  let drugsCount = 0;
  let equipmentCount = 0;
  let bagCount = 0;
  let ambulanceCount = 0;
  let cartCount = 0;

  // 1. Drugs & Fluids
  drugs.forEach((d) => {
    if (!isValidInventoryItem(d)) return;
    drugsCount++;
    grandTotal++;
    if (Number(d.remaining) <= 0) {
      grandChecked++;
      grandDefective++;
    } else {
      grandChecked++;
      grandNormal++;
    }
  });

  // 2. Room Equipment (aligned with FloorMap active rooms)
  const activeRoomMap = new Map<string, RoomDef>();
  rooms.forEach((r) => {
    if (r.m) activeRoomMap.set(r.id, r);
  });
  const seenEqIds = new Set<string>();

  Object.entries(equipment).forEach(([rawRoomId, items]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const resolvedRoomId = activeRoomMap.has(rawRoomId)
      ? rawRoomId
      : normalizeEquipmentRoomId(rawRoomId, rooms);
    const roomObj = activeRoomMap.get(resolvedRoomId);
    if (!roomObj) return;

    const roomName = roomObj.n || resolvedRoomId;
    const roomChecks = globalChecks[resolvedRoomId] || globalChecks[rawRoomId] || {};

    items.forEach((item, idx) => {
      if (!isValidInventoryItem(item)) return;
      if (item.id) {
        if (seenEqIds.has(item.id)) return;
        seenEqIds.add(item.id);
      }
      equipmentCount++;
      grandTotal++;
      const itemKey = item.id || `${resolvedRoomId}_${idx}`;
      const altKey = `${roomName}|${item.name}|${item.code || ''}`;
      const state = roomChecks[itemKey] || roomChecks[altKey];
      if (state?.result === 'ปกติ') {
        grandChecked++;
        grandNormal++;
      } else if (state?.result === 'ผิดปกติ') {
        grandChecked++;
        grandDefective++;
      }
    });
  });

  // 3. Emergency Lists (Bag & Cart — matching the 4 active Dashboard categories)
  (['bag', 'cart'] as const).forEach((catKey) => {
    const config = lists?.[catKey];
    const catChecks = globalChecks?.[catKey] || {};
    if (!config || !config.groups) return;
    const seenListIds = new Set<string>();

    Object.entries(config.groups).forEach(([gName, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((item, idx) => {
        if (!isValidInventoryItem(item)) return;
        const itemKey = item.id || `${catKey}_${gName}_${idx}`;
        if (item.id) {
          if (seenListIds.has(item.id)) return;
          seenListIds.add(item.id);
        }
        if (catKey === 'bag') bagCount++;
        else cartCount++;
        grandTotal++;

        const altKey = `${catKey}_${idx}`;
        const state = catChecks[itemKey] || catChecks[altKey];
        if (state?.result === 'ปกติ') {
          grandChecked++;
          grandNormal++;
        } else if (state?.result === 'ผิดปกติ') {
          grandChecked++;
          grandDefective++;
        }
      });
    });
  });

  const completionPct = grandTotal > 0 ? Math.round((grandNormal / grandTotal) * 100) : 0;

  return {
    grandTotal,
    grandChecked,
    grandNormal,
    grandDefective,
    completionPct,
    drugsCount,
    equipmentCount,
    bagCount,
    ambulanceCount,
    cartCount,
  };
}

function countGroupItems(groups?: Record<string, EquipmentItem[]>): number {
  if (!groups || typeof groups !== 'object') return 0;
  let count = 0;
  Object.values(groups).forEach((arr) => {
    if (Array.isArray(arr)) {
      count += arr.filter((it) => isValidInventoryItem(it)).length;
    }
  });
  return count;
}

function getNormalizedItemSignature(name?: string): string {
  return sanitizeItemName(String(name || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

function doesItemMatch(a: EquipmentItem, b: EquipmentItem): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (a.code && b.code && a.code.trim().toLowerCase() === b.code.trim().toLowerCase()) return true;
  const sigA = getNormalizedItemSignature(a.name);
  const sigB = getNormalizedItemSignature(b.name);
  if (sigA && sigB && sigA === sigB) return true;
  return false;
}

/**
 * Safely merges remote channel groups, local cached groups, default master groups,
 * and individual Firestore `equipment` documents (`type: 'bag' | 'cart' | 'ambulance'`).
 *
 * Prevents partial edits/additions in Firestore's `equipment` collection from wiping out
 * the full checklist, while strictly honoring `isCleared` flags and `tombstoneSet`.
 */
export function mergeEmergencyListGroups(params: {
  catKey: 'bag' | 'cart' | 'ambulance' | string;
  isMaster: boolean;
  isCleared?: boolean;
  remoteGroups?: Record<string, EquipmentItem[]>;
  localGroups?: Record<string, EquipmentItem[]>;
  defaultGroups?: Record<string, EquipmentItem[]>;
  fbOverlayItems?: EquipmentItem[];
  tombstoneSet: Set<string>;
}): Record<string, EquipmentItem[]> {
  const {
    catKey,
    isMaster,
    isCleared = false,
    remoteGroups,
    localGroups,
    defaultGroups,
    fbOverlayItems = [],
    tombstoneSet,
  } = params;

  if (isCleared) {
    return {};
  }

  const cloneCleanGroups = (
    src?: Record<string, EquipmentItem[]>
  ): Record<string, EquipmentItem[]> => {
    const out: Record<string, EquipmentItem[]> = {};
    if (!src || typeof src !== 'object') return out;
    const seenIds = new Set<string>();
    Object.entries(src).forEach(([gName, arr]) => {
      if (!Array.isArray(arr)) return;
      const filtered = arr.filter((it, idx) => {
        if (!isValidInventoryItem(it)) return false;
        const fbKey = it.id || `${catKey}_${gName}_${idx}`;
        if (isItemTombstoned(catKey, { ...it, category: it.category || gName }, tombstoneSet, fbKey)) {
          return false;
        }
        if (it.id) {
          if (seenIds.has(it.id)) return false;
          seenIds.add(it.id);
        }
        return true;
      });
      if (filtered.length > 0) {
        out[gName] = filtered.map((it) => ({ ...it }));
      }
    });
    return out;
  };

  const cleanRemote = cloneCleanGroups(remoteGroups);
  const cleanLocal = cloneCleanGroups(localGroups);
  const cleanDefault = isMaster ? cloneCleanGroups(defaultGroups) : {};

  const remoteCount = countGroupItems(cleanRemote);
  const localCount = countGroupItems(cleanLocal);

  // Pick richest non-corrupted base between remote and local
  let merged: Record<string, EquipmentItem[]>;
  if (remoteCount > 0 && localCount > remoteCount) {
    // Local has a fuller list (e.g. remote was truncated by an earlier partial sync bug)
    merged = cleanLocal;
    // Overlay any remote items that match or are missing in local
    Object.entries(cleanRemote).forEach(([rGroup, rArr]) => {
      rArr.forEach((rItem) => {
        let updated = false;
        Object.keys(merged).forEach((g) => {
          merged[g] = merged[g].map((existing) => {
            if (!updated && doesItemMatch(existing, rItem)) {
              updated = true;
              return rItem;
            }
            return existing;
          });
        });
        if (!updated) {
          if (!merged[rGroup]) merged[rGroup] = [];
          merged[rGroup].push(rItem);
        }
      });
    });
  } else if (remoteCount > 0) {
    merged = cleanRemote;
  } else if (localCount > 0) {
    merged = cleanLocal;
  } else {
    merged = cleanDefault;
  }

  // Ensure any non-tombstoned default master items accidentally lost to earlier partial overwrites are preserved
  if (isMaster && Object.keys(cleanDefault).length > 0) {
    const existingFlat: EquipmentItem[] = [];
    Object.values(merged).forEach((arr) => existingFlat.push(...arr));

    Object.entries(cleanDefault).forEach(([defGroup, defItems]) => {
      defItems.forEach((defItem) => {
        const alreadyPresent = existingFlat.some((ex) => doesItemMatch(ex, defItem));
        if (!alreadyPresent) {
          if (!merged[defGroup]) merged[defGroup] = [];
          merged[defGroup].push({ ...defItem });
          existingFlat.push(defItem);
        }
      });
    });
  }

  // Apply individual Firestore equipment overlay items (added/edited items) without dropping existing ones
  if (Array.isArray(fbOverlayItems) && fbOverlayItems.length > 0) {
    fbOverlayItems.forEach((fbItem, idx) => {
      if (!isValidInventoryItem(fbItem)) return;
      const targetGroup = String(fbItem.category || fbItem.location || 'ทั่วไป').trim() || 'ทั่วไป';
      const fbKey = fbItem.id || `${catKey}_${targetGroup}_${idx}`;
      if (isItemTombstoned(catKey, { ...fbItem, category: targetGroup }, tombstoneSet, fbKey)) {
        return;
      }

      let foundInGroup: string | null = null;
      let matchedExisting: EquipmentItem | null = null;
      Object.entries(merged).forEach(([gName, arr]) => {
        if (matchedExisting) return;
        const hit = arr.find((ex) => doesItemMatch(ex, fbItem));
        if (hit) {
          foundInGroup = gName;
          matchedExisting = hit;
        }
      });

      if (matchedExisting && foundInGroup) {
        const combinedItem: EquipmentItem = {
          ...(matchedExisting as EquipmentItem),
          ...fbItem,
          type: catKey,
          category: targetGroup,
        };
        if (foundInGroup === targetGroup) {
          merged[foundInGroup] = merged[foundInGroup].map((ex) =>
            ex === matchedExisting ? combinedItem : ex
          );
        } else {
          merged[foundInGroup] = merged[foundInGroup].filter((ex) => ex !== matchedExisting);
          if (merged[foundInGroup].length === 0) delete merged[foundInGroup];
          if (!merged[targetGroup]) merged[targetGroup] = [];
          merged[targetGroup].push(combinedItem);
        }
        // Strip any other stale duplicate sharing combinedItem.id across other groups/slots
        if (combinedItem.id) {
          Object.keys(merged).forEach((g) => {
            merged[g] = merged[g].filter(
              (ex) => ex === combinedItem || ex.id !== combinedItem.id
            );
            if (merged[g].length === 0) delete merged[g];
          });
        }
      } else {
        if (fbItem.id) {
          Object.keys(merged).forEach((g) => {
            merged[g] = merged[g].filter((ex) => ex.id !== fbItem.id);
            if (merged[g].length === 0) delete merged[g];
          });
        }
        if (!merged[targetGroup]) merged[targetGroup] = [];
        merged[targetGroup].push({ ...fbItem, type: catKey, category: targetGroup });
      }
    });
  }

  // Final category-wide ID deduplication guard so no two items can ever share the same id
  const finalSeenIds = new Set<string>();
  const dedupedMerged: Record<string, EquipmentItem[]> = {};
  Object.entries(merged).forEach(([gName, arr]) => {
    if (!Array.isArray(arr)) return;
    const cleanArr: EquipmentItem[] = [];
    arr.forEach((it) => {
      if (!isValidInventoryItem(it)) return;
      if (it.id) {
        if (finalSeenIds.has(it.id)) return;
        finalSeenIds.add(it.id);
      }
      cleanArr.push(it);
    });
    if (cleanArr.length > 0) {
      dedupedMerged[gName] = cleanArr;
    }
  });

  return dedupedMerged;
}

/**
 * Repairs/hydrates a full lists map (`bag`, `cart`, `ambulance`) safely.
 */
export function buildResolvedListsMap(params: {
  isMaster: boolean;
  flags?: { bagCleared?: boolean; cartCleared?: boolean; ambulanceCleared?: boolean };
  remoteLists?: Record<string, ListConfig> | null;
  localLists?: Record<string, ListConfig> | null;
  defaultLists: Record<string, ListConfig>;
  fbEquipment?: EquipmentItem[];
  tombstoneSet: Set<string>;
}): Record<string, ListConfig> {
  const {
    isMaster,
    flags = {},
    remoteLists,
    localLists,
    defaultLists,
    fbEquipment = [],
    tombstoneSet,
  } = params;

  const fbByType = (t: string) => fbEquipment.filter((i) => i && i.type === t);

  const bagGroups = mergeEmergencyListGroups({
    catKey: 'bag',
    isMaster,
    isCleared: Boolean(flags.bagCleared),
    remoteGroups: remoteLists?.bag?.groups,
    localGroups: localLists?.bag?.groups,
    defaultGroups: defaultLists.bag?.groups,
    fbOverlayItems: fbByType('bag'),
    tombstoneSet,
  });

  const cartGroups = mergeEmergencyListGroups({
    catKey: 'cart',
    isMaster,
    isCleared: Boolean(flags.cartCleared),
    remoteGroups: remoteLists?.cart?.groups,
    localGroups: localLists?.cart?.groups,
    defaultGroups: defaultLists.cart?.groups,
    fbOverlayItems: fbByType('cart'),
    tombstoneSet,
  });

  const ambulanceGroups = mergeEmergencyListGroups({
    catKey: 'ambulance',
    isMaster,
    isCleared: Boolean(flags.ambulanceCleared),
    remoteGroups: remoteLists?.ambulance?.groups,
    localGroups: localLists?.ambulance?.groups,
    defaultGroups: defaultLists.ambulance?.groups,
    fbOverlayItems: fbByType('ambulance'),
    tombstoneSet,
  });

  const rawMap: Record<string, ListConfig> = {
    bag: {
      title: remoteLists?.bag?.title || localLists?.bag?.title || defaultLists.bag?.title || 'กระเป๋าฉุกเฉิน',
      sheet: remoteLists?.bag?.sheet || localLists?.bag?.sheet || defaultLists.bag?.sheet || 'กระเป๋า Emergency',
      groups: bagGroups,
    },
    cart: {
      title: remoteLists?.cart?.title || localLists?.cart?.title || defaultLists.cart?.title || 'รถฉุกเฉิน',
      sheet: remoteLists?.cart?.sheet || localLists?.cart?.sheet || defaultLists.cart?.sheet || 'รถ Emergency',
      groups: cartGroups,
    },
    ambulance: {
      title: remoteLists?.ambulance?.title || localLists?.ambulance?.title || defaultLists.ambulance?.title || 'รถพยาบาลฉุกเฉิน',
      sheet: remoteLists?.ambulance?.sheet || localLists?.ambulance?.sheet || defaultLists.ambulance?.sheet || 'รถ Ambulance',
      groups: ambulanceGroups,
    },
  };

  return filterListsMapByTombstones(rawMap, tombstoneSet);
}
