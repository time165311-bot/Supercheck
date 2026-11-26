import { Dispatch, SetStateAction, useCallback, useRef } from 'react';
import {
  AuraDataSnapshot,
  CheckItemState,
  DrugItem,
  EquipmentItem,
  InspectionHistoryRecord,
  ListConfig,
  User,
  WardAiMemoryItem,
  WardChannel,
} from '../types';
import {
  clearChannelDrugsInFirebase,
  clearChannelEquipmentInFirebase,
  deleteChannelDrugItemInFirebase,
  deleteChannelEquipmentItemInFirebase,
  saveBatchWardUpdatesToFirebase,
  saveChannelBatchDrugsToFirebase,
  saveChannelBatchEquipmentToFirebase,
  saveChannelDataToFirebase,
  saveChannelDrugItemToFirebase,
  saveChannelEquipmentItemToFirebase,
  saveInspectionToFirebase,
  saveRestockRequisitionToFirebase,
  saveWardAiMemoryToFirebase,
} from '../services/firebase';
import {
  addDeletedItemIds,
  getChannelChecksKey,
  getChannelDbKey,
  getChannelListsKey,
  getChannelWeekDatesKey,
  getDeletedItemIds,
  makeItemTombstoneTokens,
  removeDeletedItemIds,
  setStored,
  STORAGE_KEYS,
} from '../services/storage';
import { getChannelStorageKeys } from '../utils/helpers';
import { getLocalClearedFlags, persistClearedFlags } from './useChannelSync';
import { clearChannelCategory } from '../services/aiEngine';
import { archiveDeletedItemToTrash, logAuditEvent } from '../services/auditLogger';
import { sendInspectionToGas } from '../services/api';
import { matchMedicalItemName, parseExpDateObj, getRealTargetCheckValue, sortItemsNaturally } from '../utils/itemUtils';
import { normalizeExpDateToIso } from '../utils/dateUtils';
import { getWednesdaysInfoForMonth, getWednesdaysIsoDates } from '../utils/wednesdayUtils';
import { isDefaultWard, resolveWardId } from '../utils/wardUtils';

export interface UseAuraActionsParams {
  activeChannelId: string;
  activeChannel?: WardChannel;
  currentView: string;
  currentUser: User | null;
  apiUrl: string;
  canDelete?: boolean;
  canEditStructure?: boolean;
  canExportSheets?: boolean;
  drugs: DrugItem[];
  setDrugs: Dispatch<SetStateAction<DrugItem[]>>;
  equipment: Record<string, EquipmentItem[]>;
  setEquipment: Dispatch<SetStateAction<Record<string, EquipmentItem[]>>>;
  lists: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>;
  setLists: (
    newLists:
      | Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>
      | ((prev: Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>) => Record<'bag' | 'cart' | 'ambulance' | string, ListConfig>)
  ) => void;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  setGlobalChecks: (
    newChecks:
      | Record<string, Record<string, CheckItemState>>
      | ((
          prev: Record<string, Record<string, CheckItemState>>
        ) => Record<string, Record<string, CheckItemState>>)
  ) => void;
  emergencyWeekDates: Record<string, Record<number, string>>;
  setEmergencyWeekDates: (
    newDates:
      | Record<string, Record<number, string>>
      | ((prev: Record<string, Record<number, string>>) => Record<string, Record<number, string>>)
  ) => void;
  formattedBagItems: any[];
  formattedCartItems: any[];
  formattedAmbulanceItems?: any[];
  setHistoryRecords: Dispatch<SetStateAction<InspectionHistoryRecord[]>>;
  setPendingClearCategory: Dispatch<SetStateAction<string | null>>;
  reRenderData: () => void;
}

export type NormalizedCheckResult = 'ปกติ' | 'ผิดปกติ';

export function normalizeCheckResultStatus(
  status?: string | null
): NormalizedCheckResult {
  const s = String(status || '').trim();
  if (s.includes('ผิด') || s.includes('ไม่') || s.includes('ชำรุด')) {
    return 'ผิดปกติ';
  }
  return 'ปกติ';
}

export interface BulkEquipmentImportRow {
  seq?: string;
  orderNumber: string;
  asset_number?: string;
  assetCode?: string;
  sap_code?: string;
  sapCode?: string;
  name: string;
  brand_model?: string;
  brandModel?: string;
  source_budget?: string;
  source?: string;
  acquired_date?: string;
  date?: string;
  quantity?: string | number;
  qty?: string | number;
  price?: string | number;
  location_official?: string;
  location?: string;
  handwritten_note?: string;
  is_marked_x?: boolean;
  status?: string;
  note?: string;
  isMarked?: boolean;
}

function matchRoomKeyword(text: string): string | null {
  const loc = text.toLowerCase();
  if (!loc.trim()) return null;
  if (/\bor\s*1\b|ห้องผ่าตัด\s*1\b/.test(loc)) return 'or1';
  if (/\bor\s*2\b|ห้องผ่าตัด\s*2\b/.test(loc)) return 'or2';
  if (/\bor\s*3\b|ห้องผ่าตัด\s*3\b/.test(loc)) return 'or3';
  if (/minor\s*1|ห้องเล็ก\s*1|\bmn\s*1\b/.test(loc)) return 'mn1';
  if (/minor\s*2|ห้องเล็ก\s*2|\bmn\s*2\b/.test(loc)) return 'mn2';
  if (/minor\s*3|ห้องเล็ก\s*3|\bmn\s*3\b/.test(loc)) return 'mn3';
  if (/pacu|พักฟื้น/.test(loc)) return 'pacu';
  if (/iv\s*fluid|ห้องเตรียม|เตรียมยา/.test(loc)) return 'prep';
  if (/sterile|ปราศจากเชื้อ|ห้องนึ่ง/.test(loc)) return 'ster';
  if (/จัดเครื่องมือ|\btool\b/.test(loc)) return 'tool';
  if (/จ่ายกลาง|supply|\bsup\b/.test(loc)) return 'sup';
  if (/เก็บของ|สำรอง|คลังเก็บ|\bstore\b|เราเก็บไว้|เราเบิกชื่อ/.test(loc)) return 'store';
  if (/ผ้า|linen/.test(loc)) return 'linen';
  if (/รับส่ง|recv|เวรเปล/.test(loc)) return 'recv';
  if (/nurse|station|เคาน์เตอร์/.test(loc)) return 'nurse';
  return null;
}

export function resolveRoomIdFromLocation(location?: string, status?: string, note?: string): string {
  // Prioritize handwritten note (e.g., OR1, OR2, ห้องพักฟื้น) if it explicitly specifies current room
  const fromNote = matchRoomKeyword(String(note || ''));
  if (fromNote) return fromNote;
  const fromLoc = matchRoomKeyword(String(location || ''));
  if (fromLoc) return fromLoc;
  const st = String(status || '').toLowerCase();
  if (st.includes('ส่งคืน')) return 'sup';
  if (st.includes('เก็บสำรอง')) return 'store';
  return 'anes';
}

export function useAuraActions(params: UseAuraActionsParams) {
  const {
    activeChannelId,
    activeChannel,
    currentView,
    currentUser,
    apiUrl,
    canDelete = true,
    canEditStructure = true,
    drugs,
    setDrugs,
    equipment,
    setEquipment,
    lists,
    setLists,
    globalChecks,
    setGlobalChecks,
    emergencyWeekDates,
    setEmergencyWeekDates,
    formattedBagItems,
    formattedCartItems,
    formattedAmbulanceItems = [],
    setHistoryRecords,
    setPendingClearCategory,
    reRenderData,
  } = params;

  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;
  const globalChecksRef = useRef(globalChecks);
  globalChecksRef.current = globalChecks;

  // Aura Smart Bulk Auto-Check Engine (100% Pass with true sub-item quantities & auto-calculated Wednesdays)
  const handleAuraBulkAutoCheck = useCallback(
    async (arg: { categories: ('bag' | 'cart' | 'ambulance')[]; weeks: number[] }) => {
      const categories: ('bag' | 'cart' | 'ambulance')[] =
        arg.categories.length > 0 ? arg.categories : ['bag', 'cart', 'ambulance'];
      const wedIsoMap = getWednesdaysIsoDates(new Date());
      const wedInfo = getWednesdaysInfoForMonth(new Date());
      const weeks = arg.weeks.length > 0 ? arg.weeks : wedInfo.weeks;

      const nextWeekDates = { ...emergencyWeekDates };
      categories.forEach((cat) => {
        const catDates = { ...(nextWeekDates[cat] || {}) };
        weeks.forEach((wk) => {
          if (wedIsoMap[wk]) {
            catDates[wk] = wedIsoMap[wk];
          }
        });
        nextWeekDates[cat] = catDates;
      });

      setEmergencyWeekDates(nextWeekDates);
      setStored(getChannelWeekDatesKey(activeChannelId), nextWeekDates);

      let totalItemsChecked = 0;
      const nextGlobal = { ...globalChecks };

      categories.forEach((cat) => {
        const currentCatChecks = { ...(nextGlobal[cat] || {}) };
        const groups = lists[cat]?.groups || {};

        Object.entries(groups).forEach(([groupName, groupItems]) => {
          (groupItems as EquipmentItem[]).forEach((item, idx) => {
            const itemKey = item.id || `${cat}_${groupName}_${idx}`;
            const existing = currentCatChecks[itemKey] || { result: '', weekVals: {} };
            const nextWeekVals = { ...(existing.weekVals || {}) };

            const realTargetVal = getRealTargetCheckValue(item);

            weeks.forEach((wk) => {
              nextWeekVals[wk] = realTargetVal;
            });

            currentCatChecks[itemKey] = {
              ...existing,
              result: 'ปกติ',
              weekVals: nextWeekVals,
            };
            totalItemsChecked++;
          });
        });

        nextGlobal[cat] = currentCatChecks;
      });

      setGlobalChecks(nextGlobal);
      setStored(getChannelChecksKey(activeChannelId), nextGlobal);

      const now = new Date();
      const primaryCat = categories[0];
      const primaryWeek = weeks[0] || 1;
      const finalWeekDates = nextWeekDates[primaryCat] || {};

      const itemsForSnapshot =
        primaryCat === 'bag'
          ? formattedBagItems
          : primaryCat === 'ambulance'
          ? formattedAmbulanceItems
          : formattedCartItems;
      const catTitle =
        primaryCat === 'bag'
          ? 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency'
          : primaryCat === 'ambulance'
          ? 'แบบฟอร์มตรวจสอบความพร้อม รถพยาบาลฉุกเฉิน'
          : 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
      const newRecord: InspectionHistoryRecord = {
        id: `${primaryCat}_wk${primaryWeek}_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: primaryCat,
        title: `${catTitle} (สัปดาห์ที่ ${primaryWeek})`,
        who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
        rows: itemsForSnapshot.map((it: any) => ({
          ...it,
          val: getRealTargetCheckValue(it as any),
          res: 'ใช้งานได้',
          weekVals: it.weekVals || {},
        })),
        weekDates: finalWeekDates,
      };

      setHistoryRecords((prev) => [newRecord, ...prev].slice(0, 50));
      saveInspectionToFirebase(newRecord, resolveWardId(activeChannelId)).catch((e) =>
        console.warn('Firebase history save error:', e)
      );

      void logAuditEvent({
        action: 'AURA_ACTION',
        targetCollection: primaryCat,
        targetId: resolveWardId(activeChannelId),
        itemName: `ตรวจเช็กอัตโนมัติ ${catTitle}`,
        category: primaryCat,
        newValue: `ปกติทั้งหมด ${totalItemsChecked} รายการ (สัปดาห์ ${weeks.join(', ')})`,
        details: {
          categories,
          weeks,
          totalItemsChecked,
          channelId: resolveWardId(activeChannelId),
          source: 'AuraAssistant',
        },
        currentUser,
      });

      return {
        success: true,
        categories,
        weeks,
        datesFormatted: wedInfo.dates,
        totalItemsChecked,
        primaryCategory: primaryCat,
        primaryWeek,
      };
    },
    [
      activeChannelId,
      currentUser,
      emergencyWeekDates,
      formattedAmbulanceItems,
      formattedBagItems,
      formattedCartItems,
      globalChecks,
      lists,
      setEmergencyWeekDates,
      setGlobalChecks,
      setHistoryRecords,
    ]
  );

  const handleAuraClearInventory = useCallback(
    async (targetCategory: string) => {
      if (!canDelete) return;
      setPendingClearCategory(targetCategory);
    },
    [canDelete, setPendingClearCategory]
  );

  const executeAuraClearInventory = useCallback(
    async (targetCategory: string) => {
      if (!canDelete) {
        setPendingClearCategory(null);
        return;
      }
      const q = targetCategory.toLowerCase();
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);

      if (q.includes('ยา') || q.includes('drug')) {
        setDrugs([]);
        setStored(chKeys.DRUGS, []);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, []);
        await clearChannelDrugsInFirebase(channelId).catch(() => {});
        await persistClearedFlags({ drugsCleared: true }, channelId);
        logAuditEvent({
          action: 'CLEAR_DRUGS',
          targetCollection: 'medicine',
          targetId: channelId,
          details: { category: 'drugs', channelId, note: 'ล้างข้อมูลคลังยาและสารน้ำทั้งหมด (ยืนยันโดยผู้ใช้)' },
          currentUser,
        });
      } else if (q.includes('ครุภัณฑ์') || q.includes('equipment') || q.includes('ครุ')) {
        equipmentRef.current = {};
        setEquipment({});
        setStored(chKeys.EQ, {});
        if (isMaster) setStored(STORAGE_KEYS.EQ, {});
        await clearChannelEquipmentInFirebase(channelId, 'room').catch(() => {});
        await persistClearedFlags({ equipmentCleared: true }, channelId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
        }
        reRenderData();
        logAuditEvent({
          action: 'CLEAR_EQUIPMENT',
          targetCollection: 'equipment',
          targetId: channelId,
          details: { category: 'equipment', channelId, note: 'ล้างข้อมูลครุภัณฑ์ทุกห้อง (ยืนยันโดยผู้ใช้)' },
          currentUser,
        });
      } else if (q.includes('พยาบาล') || q.includes('ambulance') || q.includes('รถพยาบาล')) {
        const { clearedCount } = clearChannelCategory(channelId, 'ambulance');
        const nextLists = {
          ...lists,
          ambulance: {
            ...(lists.ambulance || { title: 'รถพยาบาลฉุกเฉิน', sheet: 'รถ Ambulance', groups: {} }),
            groups: {},
          },
        };
        setLists(nextLists);
        setStored(getChannelListsKey(channelId), nextLists);
        if (isMaster) {
          setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
        }
        await clearChannelEquipmentInFirebase(channelId, 'ambulance').catch(() => {});
        await persistClearedFlags({ ambulanceCleared: true }, channelId);
        reRenderData();
        logAuditEvent({
          action: 'CLEAR_AMBULANCE',
          targetCollection: 'ambulance',
          targetId: channelId,
          details: { clearedCount, note: 'ล้างข้อมูลรถพยาบาลฉุกเฉิน (ยืนยันโดยผู้ใช้)' },
          currentUser,
        });
      } else if (q.includes('รถ') || q.includes('cart')) {
        const { clearedCount } = clearChannelCategory(channelId, 'cart');
        reRenderData();
        await clearChannelEquipmentInFirebase(channelId, 'cart').catch(() => {});
        await persistClearedFlags({ cartCleared: true }, channelId);
        logAuditEvent({
          action: 'CLEAR_CART',
          targetCollection: 'cart',
          targetId: channelId,
          details: { clearedCount, note: 'ล้างข้อมูลรถฉุกเฉิน (ยืนยันโดยผู้ใช้)' },
          currentUser,
        });
      } else if (q.includes('เป๋า') || q.includes('กระเป๋า') || q.includes('bag')) {
        const { clearedCount } = clearChannelCategory(channelId, 'bag');
        reRenderData();
        await clearChannelEquipmentInFirebase(channelId, 'bag').catch(() => {});
        await persistClearedFlags({ bagCleared: true }, channelId);
        logAuditEvent({
          action: 'CLEAR_BAG',
          targetCollection: 'bag',
          targetId: channelId,
          details: { clearedCount, note: 'ล้างข้อมูลกระเป๋าฉุกเฉิน (ยืนยันโดยผู้ใช้)' },
          currentUser,
        });
      }
      setPendingClearCategory(null);
    },
    [activeChannelId, canDelete, currentUser, lists, reRenderData, setDrugs, setEquipment, setLists, setPendingClearCategory]
  );

  const createAuraSnapshot = useCallback(
    (label: string): AuraDataSnapshot => {
      const currentFlags = getLocalClearedFlags(activeChannelId);
      return {
        id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label,
        createdAt: new Date().toISOString(),
        channelId: activeChannelId,
        drugs: JSON.parse(JSON.stringify(drugs)),
        equipment: JSON.parse(JSON.stringify(equipment)),
        lists: JSON.parse(JSON.stringify(lists)),
        globalChecks: JSON.parse(JSON.stringify(globalChecks)),
        emergencyWeekDates: JSON.parse(JSON.stringify(emergencyWeekDates)),
        clearedFlags: {
          drugsCleared: currentFlags.drugsCleared,
          equipmentCleared: currentFlags.equipmentCleared,
          bagCleared: currentFlags.bagCleared,
          cartCleared: currentFlags.cartCleared,
          ambulanceCleared: currentFlags.ambulanceCleared,
        },
      };
    },
    [activeChannelId, drugs, emergencyWeekDates, equipment, globalChecks, lists]
  );

  const restoreAuraSnapshot = useCallback(
    async (snapshot: AuraDataSnapshot): Promise<boolean> => {
      try {
        const targetChannel = resolveWardId(snapshot.channelId || activeChannelId);
        const isMaster = isDefaultWard(targetChannel);
        const chKeys = getChannelStorageKeys(targetChannel);

        if (snapshot.clearedFlags) {
          await persistClearedFlags(snapshot.clearedFlags, targetChannel);
        }

        if (snapshot.drugs && JSON.stringify(snapshot.drugs) !== JSON.stringify(drugs)) {
          setDrugs(snapshot.drugs);
          setStored(chKeys.DRUGS, snapshot.drugs);
          if (isMaster) setStored(STORAGE_KEYS.DRUGS, snapshot.drugs);
          if (snapshot.drugs.length === 0) {
            await clearChannelDrugsInFirebase(targetChannel).catch(() => {});
          } else {
            await saveChannelBatchDrugsToFirebase(targetChannel, snapshot.drugs).catch(() => {});
          }
        }

        if (snapshot.equipment && JSON.stringify(snapshot.equipment) !== JSON.stringify(equipment)) {
          setEquipment(snapshot.equipment);
          setStored(chKeys.EQ, snapshot.equipment);
          if (isMaster) setStored(STORAGE_KEYS.EQ, snapshot.equipment);
          const restoredRoomItems = Object.entries(snapshot.equipment).flatMap(([rId, items]) =>
            (items || []).map((it) => ({ ...it, roomId: it.roomId || rId, type: it.type || 'room' }))
          );
          if (restoredRoomItems.length === 0) {
            await clearChannelEquipmentInFirebase(targetChannel, 'room').catch(() => {});
          } else {
            await Promise.all(
              restoredRoomItems
                .slice(0, 100)
                .map((it) => saveChannelEquipmentItemToFirebase(targetChannel, it).catch(() => null))
            );
          }
        }

        const listsChanged = snapshot.lists && JSON.stringify(snapshot.lists) !== JSON.stringify(lists);
        const checksChanged =
          snapshot.globalChecks && JSON.stringify(snapshot.globalChecks) !== JSON.stringify(globalChecks);
        const datesChanged =
          snapshot.emergencyWeekDates &&
          JSON.stringify(snapshot.emergencyWeekDates) !== JSON.stringify(emergencyWeekDates);

        if (listsChanged && snapshot.lists) {
          setLists(snapshot.lists);
          setStored(getChannelListsKey(targetChannel), snapshot.lists);
          if (isMaster) {
            setStored(STORAGE_KEYS.CUSTOM_LISTS, snapshot.lists);
          }
        }
        if (checksChanged && snapshot.globalChecks) {
          setGlobalChecks(snapshot.globalChecks);
          setStored(getChannelChecksKey(targetChannel), snapshot.globalChecks);
        }
        if (datesChanged && snapshot.emergencyWeekDates) {
          setEmergencyWeekDates(snapshot.emergencyWeekDates);
          setStored(getChannelWeekDatesKey(targetChannel), snapshot.emergencyWeekDates);
        }

        if (listsChanged || checksChanged || datesChanged) {
          const nextChannelPayload = {
            lists: snapshot.lists || lists,
            globalChecks: snapshot.globalChecks || globalChecks,
            emergencyWeekDates: snapshot.emergencyWeekDates || emergencyWeekDates,
          };
          setStored(`anesthesia_db_${targetChannel}`, nextChannelPayload);
          await saveChannelDataToFirebase(targetChannel, nextChannelPayload).catch(() => {});
          reRenderData();
        }

        logAuditEvent({
          action: 'AURA_UNDO_RESTORE',
          targetCollection: 'system',
          targetId: snapshot.id,
          details: { label: snapshot.label, channelId: targetChannel },
          currentUser,
        });

        return true;
      } catch (err) {
        console.error('Aura Undo restore error:', err);
        return false;
      }
    },
    [
      activeChannelId,
      currentUser,
      drugs,
      emergencyWeekDates,
      equipment,
      globalChecks,
      lists,
      reRenderData,
      setDrugs,
      setEmergencyWeekDates,
      setEquipment,
      setGlobalChecks,
      setLists,
    ]
  );

  const handleAuraDirectClear = useCallback(
    async (targetCategory: string): Promise<AuraDataSnapshot> => {
      const snapshot = createAuraSnapshot(`ก่อนล้างข้อมูล ${targetCategory}`);
      if (!canDelete) {
        return snapshot;
      }
      await executeAuraClearInventory(targetCategory);
      return snapshot;
    },
    [canDelete, createAuraSnapshot, executeAuraClearInventory]
  );

  const executeDeleteAllEquipment = useCallback(async (): Promise<{
    success: boolean;
    deletedCount: number;
    syncedToCloud: boolean;
    error?: string;
    snapshot: AuraDataSnapshot;
  }> => {
    const channelId = resolveWardId(activeChannelId);
    const isMaster = isDefaultWard(channelId);
    const chKeys = getChannelStorageKeys(channelId);
    const deletedCount = Object.values(equipmentRef.current || {}).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.filter((it) => it && it.name).length : 0),
      0
    );
    const snapshot = createAuraSnapshot(`ก่อนลบครุภัณฑ์ทั้งหมด (${deletedCount} รายการ)`);

    if (!canDelete) {
      return {
        success: false,
        deletedCount: 0,
        syncedToCloud: false,
        error: 'ผู้ดูแลระบบล็อกสิทธิ์การลบรายการสำหรับเจ้าหน้าที่ไว้',
        snapshot,
      };
    }

    // 1. Clear UI State & LocalStorage immediately to 0 items
    equipmentRef.current = {};
    setEquipment({});
    setStored(chKeys.EQ, {});
    if (isMaster) {
      setStored(STORAGE_KEYS.EQ, {});
    }

    let syncedToCloud = false;
    let cloudError: string | undefined;

    // 2. Delete all ward equipment documents from Firestore (writeBatch) & persist cleared flag
    try {
      syncedToCloud = await clearChannelEquipmentInFirebase(channelId, 'room');
      await persistClearedFlags({ equipmentCleared: true }, channelId);
    } catch (err: any) {
      cloudError = err?.message || 'ไม่สามารถลบข้อมูลใน Firestore ได้';
      syncedToCloud = false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    reRenderData();
    setPendingClearCategory(null);

    void logAuditEvent({
      action: 'AURA_ACTION',
      targetCollection: 'equipment',
      targetId: channelId,
      itemName: `ครุภัณฑ์ทั้งหมด (${deletedCount} รายการ)`,
      category: 'ครุภัณฑ์ห้องผ่าตัด',
      oldValue: `${deletedCount} รายการ`,
      newValue: 'ล้างข้อมูลทั้งหมดแล้ว',
      details: {
        category: 'equipment',
        channelId,
        deletedCount,
        syncedToCloud,
        note: `ลบรายการครุภัณฑ์ทั้งหมด ${deletedCount} รายการผ่านน้องออร่า (ยืนยันโดยผู้ใช้)`,
      },
      currentUser,
    });

    return {
      success: true,
      deletedCount,
      syncedToCloud,
      error: cloudError,
      snapshot,
    };
  }, [activeChannelId, canDelete, createAuraSnapshot, currentUser, reRenderData, setEquipment, setPendingClearCategory]);

  const handleAuraUpdateItem = useCallback(
    async (arg: {
      targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
      itemId: string;
      roomId?: string;
      newExp?: string;
      subItemLabel?: string;
      lotNumber?: string;
      newQty?: string | number;
      newStatus?: 'ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ' | 'ชำรุด' | 'ส่งคืน' | 'เก็บสำรอง';
      newName?: string;
      moveToRoomOrGroup?: string;
      note?: string;
    }): Promise<{ success: boolean; updatedName: string; dbSaved?: boolean; error?: string }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);
      const lotTag = arg.lotNumber && arg.lotNumber.trim() ? `Lot: ${arg.lotNumber.trim()}` : '';
      const extraNote = [lotTag, arg.note?.trim()].filter(Boolean).join(' | ');
      const normalizedStatus = arg.newStatus ? normalizeCheckResultStatus(arg.newStatus) : undefined;
      const cleanNewName =
        canEditStructure && arg.newName && arg.newName.trim() ? arg.newName.trim() : undefined;
      const safeMoveTo = canEditStructure ? arg.moveToRoomOrGroup : undefined;
      const safeNewQty = canEditStructure ? arg.newQty : undefined;

      const normalizedExp = (() => {
        if (arg.newExp === undefined) return undefined;
        const raw = String(arg.newExp).trim();
        if (!raw) return undefined;
        if (raw === '-' || /no\s*exp|ไม่มี/i.test(raw)) return '-';
        return normalizeExpDateToIso(raw) || raw;
      })();

      if (arg.targetType === 'drug') {
        let updatedName = '';
        let prevSummary = '';
        let nextSummary = '';
        let updatedDrugItem: DrugItem | null = null;
        const nextDrugs = drugs.map((d) => {
          if (d.id !== arg.itemId) return d;
          updatedName = cleanNewName || d.name;
          prevSummary = `คงเหลือ ${d.remaining}, EXP ${d.expDate || d.exp || '-'}`;
          const nextQtyNum =
            safeNewQty !== undefined && safeNewQty !== '' && !isNaN(Number(safeNewQty))
              ? Number(safeNewQty)
              : undefined;
          const mergedNote = extraNote
            ? d.note && !d.note.includes(extraNote)
              ? `${d.note} (${extraNote})`
              : extraNote
            : d.note;

          let nextLots = d.lots;
          if (normalizedExp && Array.isArray(d.lots) && d.lots.length > 0) {
            const targetLot = arg.lotNumber?.trim().toLowerCase();
            let lotUpdated = false;
            nextLots = d.lots.map((lot, idx) => {
              const matchesLot = targetLot
                ? String(lot.lotNumber || '').trim().toLowerCase() === targetLot
                : idx === 0;
              if (matchesLot && !lotUpdated) {
                lotUpdated = true;
                return { ...lot, expiryDate: normalizedExp };
              }
              return lot;
            });
          }

          updatedDrugItem = {
            ...d,
            ...(cleanNewName ? { name: cleanNewName } : {}),
            ...(normalizedExp ? { expDate: normalizedExp, exp: normalizedExp } : {}),
            ...(nextLots ? { lots: nextLots, batches: nextLots } : {}),
            ...(nextQtyNum !== undefined ? { remaining: nextQtyNum, totalQty: nextQtyNum } : {}),
            ...(safeMoveTo ? { location: safeMoveTo.trim() } : {}),
            note: (mergedNote || '').slice(0, 950),
          };
          nextSummary = `คงเหลือ ${updatedDrugItem.remaining}, EXP ${updatedDrugItem.expDate || '-'}`;
          return updatedDrugItem;
        });

        if (!updatedDrugItem) return { success: false, updatedName: '', dbSaved: false };
        setDrugs(nextDrugs);
        setStored(chKeys.DRUGS, nextDrugs);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, nextDrugs);
        const dbSaved = await saveChannelDrugItemToFirebase(channelId, updatedDrugItem).catch(() => false);
        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: 'drugs',
          targetId: arg.itemId,
          itemName: updatedName,
          category: 'คลังยา & สารน้ำ',
          oldValue: prevSummary,
          newValue: nextSummary,
          details: {
            name: updatedName,
            channelId,
            newExp: normalizedExp,
            lotNumber: arg.lotNumber,
            newQty: safeNewQty,
            dbSaved,
            source: 'AuraAssistant',
          },
          currentUser,
        });
        return {
          success: true,
          updatedName,
          dbSaved: Boolean(dbSaved),
          ...(dbSaved ? {} : { error: 'ไม่สามารถบันทึกข้อมูลลง Firestore ได้ในขณะนี้' }),
        };
      }

      if (arg.targetType === 'bag' || arg.targetType === 'cart' || arg.targetType === 'ambulance') {
        const cat = arg.targetType;
        const currentList = lists[cat];
        if (!currentList?.groups) return { success: false, updatedName: '', dbSaved: false };

        let updatedName = '';
        let prevSummary = '';
        let nextSummary = '';
        let matchedItemKey = '';
        let updatedEquipItem: EquipmentItem | null = null;
        let sourceGroup = '';
        let resolvedNextExp = normalizedExp;
        const nextGroups: Record<string, EquipmentItem[]> = {};

        Object.entries(currentList.groups).forEach(([gName, gItems]) => {
          const remainingInGroup: EquipmentItem[] = [];
          (gItems || []).forEach((it, idx) => {
            const itemKey = it.id || `${cat}_${gName}_${idx}`;
            if (itemKey === arg.itemId || it.id === arg.itemId) {
              updatedName = cleanNewName || it.name;
              matchedItemKey = itemKey;
              sourceGroup = gName;
              prevSummary = `จำนวน ${it.unitText || it.qty || '-'}, EXP ${it.exp || '-'}`;
              const mergedNote = extraNote
                ? it.note && !it.note.includes(extraNote)
                  ? `${it.note} (${extraNote})`
                  : extraNote
                : it.note;
              const targetGroup = safeMoveTo?.trim() || gName;

              let updatedSubExps = it.subExps;
              if (normalizedExp && Array.isArray(it.subExps) && it.subExps.length > 0) {
                const subQuery = (arg.subItemLabel || '').trim().toLowerCase();
                if (subQuery) {
                  const normalizeSubTok = (v: string) =>
                    v
                      .toLowerCase()
                      .replace(/ทรีเวย์|three[\s_-]*way|3[\s_-]*way/g, 'tway')
                      .replace(/t[\s_-]*way/g, 'tway')
                      .replace(/[^a-z0-9ก-๙]+/g, '');
                  const normSubQuery = normalizeSubTok(subQuery);
                  let matchedAnySub = false;
                  updatedSubExps = it.subExps.map((se) => {
                    const lbl = String(se.label || '').trim().toLowerCase();
                    const normLbl = normalizeSubTok(lbl);
                    if (
                      lbl &&
                      (lbl === subQuery ||
                        lbl.includes(subQuery) ||
                        subQuery.includes(lbl) ||
                        (normLbl && normSubQuery && (normLbl === normSubQuery || normLbl.includes(normSubQuery) || normSubQuery.includes(normLbl))))
                    ) {
                      matchedAnySub = true;
                      return { ...se, exp: normalizedExp, hasNoExp: normalizedExp === '-' };
                    }
                    return se;
                  });
                  if (matchedAnySub) {
                    resolvedNextExp = updatedSubExps
                      .map((se) => `${se.label || 'ชิ้น'}: ${se.exp || '-'}`)
                      .join(', ');
                  }
                } else if (it.subExps.length === 1) {
                  updatedSubExps = it.subExps.map((se) => ({
                    ...se,
                    exp: normalizedExp,
                    hasNoExp: normalizedExp === '-',
                  }));
                  resolvedNextExp = normalizedExp;
                }
              }

              updatedEquipItem = {
                ...it,
                id: it.id || itemKey,
                type: cat,
                category: targetGroup,
                location: targetGroup,
                ...(cleanNewName ? { name: cleanNewName } : {}),
                ...(resolvedNextExp ? { exp: resolvedNextExp } : {}),
                ...(updatedSubExps ? { subExps: updatedSubExps } : {}),
                ...(safeNewQty !== undefined && String(safeNewQty).trim() !== ''
                  ? { qty: String(safeNewQty), unitText: String(safeNewQty) }
                  : {}),
                ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
              };
              nextSummary = `จำนวน ${updatedEquipItem.unitText || updatedEquipItem.qty || '-'}, EXP ${updatedEquipItem.exp || '-'}`;
              if (targetGroup === gName) {
                remainingInGroup.push(updatedEquipItem);
              }
            } else {
              remainingInGroup.push(it);
            }
          });
          nextGroups[gName] = remainingInGroup;
        });

        if (!updatedEquipItem) return { success: false, updatedName: '', dbSaved: false };
        const destGroup = safeMoveTo?.trim();
        if (destGroup && destGroup !== sourceGroup) {
          nextGroups[destGroup] = sortItemsNaturally([...(nextGroups[destGroup] || []), updatedEquipItem]);
        }

        const updatedLists = { ...lists, [cat]: { ...currentList, groups: nextGroups } };
        setLists(updatedLists);
        setStored(getChannelListsKey(channelId), updatedLists);
        if (isMaster) {
          setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
        }
        const docSaved = await saveChannelEquipmentItemToFirebase(channelId, updatedEquipItem).catch(() => null);

        let nextGlobal = globalChecks;
        if (resolvedNextExp || normalizedStatus || extraNote) {
          const catChecks = { ...(globalChecks[cat] || {}) };
          const existingCheck = catChecks[matchedItemKey] || { result: '', weekVals: {} };
          catChecks[matchedItemKey] = {
            ...existingCheck,
            ...(normalizedStatus ? { result: normalizedStatus } : {}),
            ...(resolvedNextExp ? { exp: resolvedNextExp } : {}),
            ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
          };
          nextGlobal = { ...globalChecks, [cat]: catChecks };
          setGlobalChecks(nextGlobal);
          setStored(getChannelChecksKey(channelId), nextGlobal);
        }

        const channelPayload = {
          lists: updatedLists,
          globalChecks: nextGlobal,
          emergencyWeekDates,
          deletedItemIds: getDeletedItemIds(channelId),
        };
        setStored(getChannelDbKey(channelId), channelPayload);
        const channelSaved = await saveChannelDataToFirebase(channelId, channelPayload).catch(() => false);
        const dbSaved = Boolean(docSaved) && Boolean(channelSaved);
        reRenderData();

        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: cat,
          targetId: matchedItemKey,
          itemName: updatedName,
          category: cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน',
          oldValue: prevSummary,
          newValue: normalizedStatus ? `${nextSummary}, สถานะ ${normalizedStatus}` : nextSummary,
          details: {
            name: updatedName,
            newExp: resolvedNextExp,
            subItemLabel: arg.subItemLabel,
            lotNumber: arg.lotNumber,
            newQty: safeNewQty,
            newStatus: normalizedStatus,
            moveToRoomOrGroup: destGroup,
            dbSaved,
            source: 'AuraAssistant',
          },
          currentUser,
        });

        return {
          success: true,
          updatedName,
          dbSaved,
          ...(dbSaved ? {} : { error: 'ไม่สามารถบันทึกข้อมูลลง Firestore ได้ในขณะนี้' }),
        };
      }

      if (arg.targetType === 'room') {
        const targetRoomId =
          arg.roomId ||
          Object.keys(equipment).find((rId) =>
            (equipment[rId] || []).some((it, idx) => it.id === arg.itemId || `${rId}_${idx}` === arg.itemId)
          );
        if (!targetRoomId || !equipment[targetRoomId]) return { success: false, updatedName: '', dbSaved: false };

        let updatedName = '';
        let prevSummary = '';
        let nextSummary = '';
        let updatedRoomItem: EquipmentItem | null = null;
        let matchedKey = arg.itemId;
        const resolvedDestRoom =
          safeMoveTo?.trim()
            ? resolveRoomIdFromLocation(safeMoveTo, arg.newStatus, arg.note)
            : targetRoomId;

        const nextEq: Record<string, EquipmentItem[]> = { ...equipment };
        const remainingSource: EquipmentItem[] = [];
        (equipment[targetRoomId] || []).forEach((it, idx) => {
          const fbKey = `${targetRoomId}_${idx}`;
          if (it.id === arg.itemId || fbKey === arg.itemId) {
            matchedKey = it.id || fbKey;
            updatedName = cleanNewName || it.name;
            prevSummary = `ห้อง ${targetRoomId.toUpperCase()}, สถานะ ${it.status || 'ปกติ'}, EXP ${it.exp || '-'}`;
            const mergedNote = extraNote
              ? it.note && !it.note.includes(extraNote)
                ? `${it.note} (${extraNote})`
                : extraNote
              : it.note;
            updatedRoomItem = {
              ...it,
              id: it.id || fbKey,
              roomId: resolvedDestRoom,
              location: safeMoveTo?.trim() || it.location || resolvedDestRoom.toUpperCase(),
              type: it.type || 'room',
              ...(cleanNewName ? { name: cleanNewName } : {}),
              ...(arg.newStatus ? { status: arg.newStatus } : {}),
              ...(normalizedExp ? { exp: normalizedExp } : {}),
              ...(safeNewQty !== undefined && String(safeNewQty).trim() !== ''
                ? { qty: String(safeNewQty), unitText: String(safeNewQty) }
                : {}),
              ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
            };
            nextSummary = `ห้อง ${resolvedDestRoom.toUpperCase()}, สถานะ ${updatedRoomItem.status || 'ปกติ'}, EXP ${updatedRoomItem.exp || '-'}`;
            if (resolvedDestRoom === targetRoomId) {
              remainingSource.push(updatedRoomItem);
            }
          } else {
            remainingSource.push(it);
          }
        });

        if (!updatedRoomItem) return { success: false, updatedName: '', dbSaved: false };

        nextEq[targetRoomId] = remainingSource;
        if (resolvedDestRoom !== targetRoomId) {
          nextEq[resolvedDestRoom] = [...(nextEq[resolvedDestRoom] || []), updatedRoomItem];
        }

        equipmentRef.current = nextEq;
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);
        const docSaved = await saveChannelEquipmentItemToFirebase(channelId, updatedRoomItem).catch(() => null);

        let channelSaved = true;
        if (normalizedStatus || normalizedExp || extraNote) {
          const destChecks = { ...(globalChecks[resolvedDestRoom] || {}) };
          const existingCheck =
            (globalChecks[targetRoomId] || {})[matchedKey] ||
            destChecks[matchedKey] || { result: '', weekVals: {} };
          destChecks[matchedKey] = {
            ...existingCheck,
            ...(normalizedStatus ? { result: normalizedStatus } : {}),
            ...(normalizedExp ? { exp: normalizedExp } : {}),
            ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
          };
          const nextGlobal = { ...globalChecks, [resolvedDestRoom]: destChecks };
          setGlobalChecks(nextGlobal);
          setStored(getChannelChecksKey(channelId), nextGlobal);
          channelSaved = await saveChannelDataToFirebase(channelId, {
            lists,
            globalChecks: nextGlobal,
            emergencyWeekDates,
            deletedItemIds: getDeletedItemIds(channelId),
          }).catch(() => false);
        }

        const dbSaved = Boolean(docSaved) && Boolean(channelSaved);

        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: 'equipment',
          targetId: matchedKey,
          itemName: updatedName,
          category: `ครุภัณฑ์ (${resolvedDestRoom.toUpperCase()})`,
          oldValue: prevSummary,
          newValue: nextSummary,
          details: {
            roomId: resolvedDestRoom,
            name: updatedName,
            newExp: normalizedExp,
            lotNumber: arg.lotNumber,
            newQty: safeNewQty,
            newStatus: normalizedStatus,
            moveToRoomOrGroup: resolvedDestRoom !== targetRoomId ? resolvedDestRoom : undefined,
            dbSaved,
            source: 'AuraAssistant',
          },
          currentUser,
        });

        return {
          success: true,
          updatedName,
          dbSaved,
          ...(dbSaved ? {} : { error: 'ไม่สามารถบันทึกข้อมูลลง Firestore ได้ในขณะนี้' }),
        };
      }

      return { success: false, updatedName: '', dbSaved: false };
    },
    [
      activeChannelId,
      canEditStructure,
      currentUser,
      drugs,
      emergencyWeekDates,
      equipment,
      globalChecks,
      lists,
      reRenderData,
      setDrugs,
      setEquipment,
      setGlobalChecks,
      setLists,
    ]
  );

  // ⚡ Atomic Multi-Item Batch Update across drugs, bag/cart/ambulance, and OR equipment
  const handleAuraBatchUpdateItems = useCallback(
    async (
      items: Array<{
        targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
        itemId: string;
        itemName?: string;
        locationLabel?: string;
        roomId?: string;
        newExp?: string;
        subItemLabel?: string;
        lotNumber?: string;
        newQty?: string | number;
        newStatus?: 'ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ' | 'ชำรุด' | 'ส่งคืน' | 'เก็บสำรอง';
        newName?: string;
        moveToRoomOrGroup?: string;
        note?: string;
      }>
    ): Promise<{
      success: boolean;
      dbSaved: boolean;
      error?: string;
      updatedResults: Array<{
        targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
        itemId: string;
        updatedName: string;
        locationLabel: string;
        newExp?: string;
        subItemLabel?: string;
        changesSummary: string[];
      }>;
      failedItems: Array<{ name: string; reason: string }>;
      snapshot: AuraDataSnapshot;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);
      const snapshot = createAuraSnapshot(`ก่อนแก้ไขแบบกลุ่ม (${items.length} รายการ)`);

      if (!items || items.length === 0) {
        return {
          success: false,
          dbSaved: false,
          updatedResults: [],
          failedItems: [],
          snapshot,
          error: 'ไม่มีรายการสำหรับอัปเดต',
        };
      }

      let nextDrugs = [...drugs];
      const nextEq: Record<string, EquipmentItem[]> = {};
      Object.entries(equipmentRef.current || {}).forEach(([rId, arr]) => {
        nextEq[rId] = [...(arr || [])];
      });
      const nextLists: Record<string, ListConfig> = { ...lists };
      const nextGlobal: Record<string, Record<string, CheckItemState>> = { ...globalChecks };

      let drugsChanged = false;
      let eqChanged = false;
      let listsChanged = false;
      let checksChanged = false;

      const drugsToSaveMap = new Map<string, DrugItem>();
      const equipmentToSaveMap = new Map<string, EquipmentItem>();

      const updatedResults: Array<{
        targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
        itemId: string;
        updatedName: string;
        locationLabel: string;
        newExp?: string;
        subItemLabel?: string;
        changesSummary: string[];
      }> = [];
      const failedItems: Array<{ name: string; reason: string }> = [];

      for (const arg of items) {
        const lotTag = arg.lotNumber && arg.lotNumber.trim() ? `Lot: ${arg.lotNumber.trim()}` : '';
        const extraNote = [lotTag, arg.note?.trim()].filter(Boolean).join(' | ');
        const normalizedStatus = arg.newStatus ? normalizeCheckResultStatus(arg.newStatus) : undefined;
        const cleanNewName =
          canEditStructure && arg.newName && arg.newName.trim() ? arg.newName.trim() : undefined;
        const safeMoveTo = canEditStructure ? arg.moveToRoomOrGroup : undefined;
        const safeNewQty = canEditStructure ? arg.newQty : undefined;

        const normalizedExp = (() => {
          if (arg.newExp === undefined) return undefined;
          const raw = String(arg.newExp).trim();
          if (!raw) return undefined;
          if (raw === '-' || /no\s*exp|ไม่มี/i.test(raw)) return '-';
          return normalizeExpDateToIso(raw) || raw;
        })();

        const changesSummary: string[] = [];
        if (arg.subItemLabel) changesSummary.push(`ชิ้นย่อย: ${arg.subItemLabel}`);
        if (cleanNewName) changesSummary.push(`ชื่อใหม่: ${cleanNewName}`);
        if (safeNewQty !== undefined && String(safeNewQty).trim() !== '') {
          changesSummary.push(`จำนวน: ${safeNewQty}`);
        }

        if (arg.targetType === 'drug') {
          const idx = nextDrugs.findIndex((d) => d.id === arg.itemId);
          if (idx === -1) {
            failedItems.push({
              name: arg.itemName || arg.itemId,
              reason: 'ไม่พบรายการยาในคลังยาปัจจุบัน',
            });
            continue;
          }
          const d = nextDrugs[idx];
          const updatedName = cleanNewName || d.name;
          const nextQtyNum =
            safeNewQty !== undefined && safeNewQty !== '' && !isNaN(Number(safeNewQty))
              ? Number(safeNewQty)
              : undefined;
          const mergedNote = extraNote
            ? d.note && !d.note.includes(extraNote)
              ? `${d.note} (${extraNote})`
              : extraNote
            : d.note;

          let nextLots = d.lots;
          if (normalizedExp && Array.isArray(d.lots) && d.lots.length > 0) {
            const targetLot = arg.lotNumber?.trim().toLowerCase();
            let lotUpdated = false;
            nextLots = d.lots.map((lot, lIdx) => {
              const matchesLot = targetLot
                ? String(lot.lotNumber || '').trim().toLowerCase() === targetLot
                : lIdx === 0;
              if (matchesLot && !lotUpdated) {
                lotUpdated = true;
                return { ...lot, expiryDate: normalizedExp };
              }
              return lot;
            });
          }

          const updatedDrugItem: DrugItem = {
            ...d,
            ...(cleanNewName ? { name: cleanNewName } : {}),
            ...(normalizedExp ? { expDate: normalizedExp, exp: normalizedExp } : {}),
            ...(nextLots ? { lots: nextLots, batches: nextLots } : {}),
            ...(nextQtyNum !== undefined ? { remaining: nextQtyNum, totalQty: nextQtyNum } : {}),
            ...(safeMoveTo ? { location: safeMoveTo.trim() } : {}),
            note: (mergedNote || '').slice(0, 950),
          };
          nextDrugs[idx] = updatedDrugItem;
          drugsToSaveMap.set(updatedDrugItem.id, updatedDrugItem);
          drugsChanged = true;

          if (normalizedExp) changesSummary.push(`EXP: ${normalizedExp}`);
          if (arg.lotNumber) changesSummary.push(`Lot: ${arg.lotNumber}`);
          if (normalizedStatus) changesSummary.push(`สถานะ: ${normalizedStatus}`);
          if (arg.note) changesSummary.push(`หมายเหตุ: ${arg.note}`);

          updatedResults.push({
            targetType: 'drug',
            itemId: updatedDrugItem.id,
            updatedName,
            locationLabel: arg.locationLabel || 'คลังยา & สารน้ำ',
            newExp: normalizedExp,
            subItemLabel: arg.subItemLabel,
            changesSummary,
          });
          continue;
        }

        if (arg.targetType === 'bag' || arg.targetType === 'cart' || arg.targetType === 'ambulance') {
          const cat = arg.targetType;
          const currentList = nextLists[cat];
          if (!currentList?.groups) {
            failedItems.push({
              name: arg.itemName || arg.itemId,
              reason: `ไม่พบรายการในหมวด ${cat}`,
            });
            continue;
          }

          let updatedName = '';
          let matchedItemKey = '';
          let updatedEquipItem: EquipmentItem | null = null;
          let sourceGroup = '';
          let resolvedNextExp = normalizedExp;
          const nextGroups: Record<string, EquipmentItem[]> = {};

          Object.entries(currentList.groups).forEach(([gName, gItems]) => {
            const remainingInGroup: EquipmentItem[] = [];
            (gItems || []).forEach((it, idx) => {
              const itemKey = it.id || `${cat}_${gName}_${idx}`;
              if (!updatedEquipItem && (itemKey === arg.itemId || it.id === arg.itemId)) {
                updatedName = cleanNewName || it.name;
                matchedItemKey = itemKey;
                sourceGroup = gName;
                const mergedNote = extraNote
                  ? it.note && !it.note.includes(extraNote)
                    ? `${it.note} (${extraNote})`
                    : extraNote
                  : it.note;
                const targetGroup = safeMoveTo?.trim() || gName;

                let updatedSubExps = it.subExps;
                if (normalizedExp && Array.isArray(it.subExps) && it.subExps.length > 0) {
                  const subQuery = (arg.subItemLabel || '').trim().toLowerCase();
                  if (subQuery) {
                    const normalizeSubTok = (v: string) =>
                      v
                        .toLowerCase()
                        .replace(/ทรีเวย์|three[\s_-]*way|3[\s_-]*way/g, 'tway')
                        .replace(/t[\s_-]*way/g, 'tway')
                        .replace(/[^a-z0-9ก-๙]+/g, '');
                    const normSubQuery = normalizeSubTok(subQuery);
                    let matchedAnySub = false;
                    updatedSubExps = it.subExps.map((se) => {
                      const lbl = String(se.label || '').trim().toLowerCase();
                      const normLbl = normalizeSubTok(lbl);
                      if (
                        lbl &&
                        (lbl === subQuery ||
                          lbl.includes(subQuery) ||
                          subQuery.includes(lbl) ||
                          (normLbl && normSubQuery && (normLbl === normSubQuery || normLbl.includes(normSubQuery) || normSubQuery.includes(normLbl))))
                      ) {
                        matchedAnySub = true;
                        return { ...se, exp: normalizedExp, hasNoExp: normalizedExp === '-' };
                      }
                      return se;
                    });
                    if (matchedAnySub) {
                      resolvedNextExp = updatedSubExps
                        .map((se) => `${se.label || 'ชิ้น'}: ${se.exp || '-'}`)
                        .join(', ');
                    }
                  } else if (it.subExps.length === 1) {
                    updatedSubExps = it.subExps.map((se) => ({
                      ...se,
                      exp: normalizedExp,
                      hasNoExp: normalizedExp === '-',
                    }));
                    resolvedNextExp = normalizedExp;
                  }
                }

                updatedEquipItem = {
                  ...it,
                  id: it.id || itemKey,
                  type: cat,
                  category: targetGroup,
                  location: targetGroup,
                  ...(cleanNewName ? { name: cleanNewName } : {}),
                  ...(resolvedNextExp ? { exp: resolvedNextExp } : {}),
                  ...(updatedSubExps ? { subExps: updatedSubExps } : {}),
                  ...(safeNewQty !== undefined && String(safeNewQty).trim() !== ''
                    ? { qty: String(safeNewQty), unitText: String(safeNewQty) }
                    : {}),
                  ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
                };
                if (targetGroup === gName) {
                  remainingInGroup.push(updatedEquipItem);
                }
              } else {
                remainingInGroup.push(it);
              }
            });
            nextGroups[gName] = remainingInGroup;
          });

          if (!updatedEquipItem) {
            failedItems.push({
              name: arg.itemName || arg.itemId,
              reason: 'ไม่พบรายการที่ตรงกันในหมวดหมู่เป้าหมาย',
            });
            continue;
          }

          const destGroup = safeMoveTo?.trim();
          if (destGroup && destGroup !== sourceGroup) {
            nextGroups[destGroup] = sortItemsNaturally([...(nextGroups[destGroup] || []), updatedEquipItem]);
          }

          nextLists[cat] = { ...currentList, groups: nextGroups };
          listsChanged = true;
          equipmentToSaveMap.set((updatedEquipItem as EquipmentItem).id || matchedItemKey, updatedEquipItem);

          if (resolvedNextExp || normalizedStatus || extraNote) {
            const catChecks = { ...(nextGlobal[cat] || {}) };
            const existingCheck = catChecks[matchedItemKey] || { result: '', weekVals: {} };
            catChecks[matchedItemKey] = {
              ...existingCheck,
              ...(normalizedStatus ? { result: normalizedStatus } : {}),
              ...(resolvedNextExp ? { exp: resolvedNextExp } : {}),
              ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
            };
            nextGlobal[cat] = catChecks;
            checksChanged = true;
          }

          if (normalizedExp) changesSummary.push(`EXP: ${normalizedExp}`);
          if (arg.lotNumber) changesSummary.push(`Lot: ${arg.lotNumber}`);
          if (normalizedStatus) changesSummary.push(`สถานะ: ${normalizedStatus}`);
          if (destGroup) changesSummary.push(`ย้ายไป: ${destGroup}`);
          if (arg.note) changesSummary.push(`หมายเหตุ: ${arg.note}`);

          const fallbackCatLabel =
            cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน';
          updatedResults.push({
            targetType: cat,
            itemId: matchedItemKey,
            updatedName,
            locationLabel: arg.locationLabel || fallbackCatLabel,
            newExp: normalizedExp,
            subItemLabel: arg.subItemLabel,
            changesSummary,
          });
          continue;
        }

        if (arg.targetType === 'room') {
          const targetRoomId =
            arg.roomId ||
            Object.keys(nextEq).find((rId) =>
              (nextEq[rId] || []).some((it, idx) => it.id === arg.itemId || `${rId}_${idx}` === arg.itemId)
            );
          if (!targetRoomId || !nextEq[targetRoomId]) {
            failedItems.push({
              name: arg.itemName || arg.itemId,
              reason: 'ไม่พบครุภัณฑ์ในห้องผ่าตัดที่ระบุ',
            });
            continue;
          }

          let updatedName = '';
          let updatedRoomItem: EquipmentItem | null = null;
          let matchedKey = arg.itemId;
          const resolvedDestRoom =
            safeMoveTo?.trim()
              ? resolveRoomIdFromLocation(safeMoveTo, arg.newStatus, arg.note)
              : targetRoomId;

          const remainingSource: EquipmentItem[] = [];
          (nextEq[targetRoomId] || []).forEach((it, idx) => {
            const fbKey = `${targetRoomId}_${idx}`;
            if (!updatedRoomItem && (it.id === arg.itemId || fbKey === arg.itemId)) {
              matchedKey = it.id || fbKey;
              updatedName = cleanNewName || it.name;
              const mergedNote = extraNote
                ? it.note && !it.note.includes(extraNote)
                  ? `${it.note} (${extraNote})`
                  : extraNote
                : it.note;
              updatedRoomItem = {
                ...it,
                id: it.id || fbKey,
                roomId: resolvedDestRoom,
                location: safeMoveTo?.trim() || it.location || resolvedDestRoom.toUpperCase(),
                type: it.type || 'room',
                ...(cleanNewName ? { name: cleanNewName } : {}),
                ...(arg.newStatus ? { status: arg.newStatus } : {}),
                ...(normalizedExp ? { exp: normalizedExp } : {}),
                ...(safeNewQty !== undefined && String(safeNewQty).trim() !== ''
                  ? { qty: String(safeNewQty), unitText: String(safeNewQty) }
                  : {}),
                ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
              };
              if (resolvedDestRoom === targetRoomId) {
                remainingSource.push(updatedRoomItem);
              }
            } else {
              remainingSource.push(it);
            }
          });

          if (!updatedRoomItem) {
            failedItems.push({
              name: arg.itemName || arg.itemId,
              reason: 'ไม่พบครุภัณฑ์ที่ระบุ',
            });
            continue;
          }

          nextEq[targetRoomId] = remainingSource;
          if (resolvedDestRoom !== targetRoomId) {
            nextEq[resolvedDestRoom] = [...(nextEq[resolvedDestRoom] || []), updatedRoomItem];
          }
          eqChanged = true;
          equipmentToSaveMap.set((updatedRoomItem as EquipmentItem).id || matchedKey, updatedRoomItem);

          if (normalizedStatus || normalizedExp || extraNote) {
            const destChecks = { ...(nextGlobal[resolvedDestRoom] || {}) };
            const existingCheck =
              (nextGlobal[targetRoomId] || {})[matchedKey] ||
              destChecks[matchedKey] || { result: '', weekVals: {} };
            destChecks[matchedKey] = {
              ...existingCheck,
              ...(normalizedStatus ? { result: normalizedStatus } : {}),
              ...(normalizedExp ? { exp: normalizedExp } : {}),
              ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
            };
            nextGlobal[resolvedDestRoom] = destChecks;
            checksChanged = true;
          }

          if (normalizedExp) changesSummary.push(`EXP: ${normalizedExp}`);
          if (arg.lotNumber) changesSummary.push(`Lot: ${arg.lotNumber}`);
          if (normalizedStatus) changesSummary.push(`สถานะ: ${normalizedStatus}`);
          if (resolvedDestRoom !== targetRoomId) changesSummary.push(`ย้ายห้อง: ${resolvedDestRoom.toUpperCase()}`);
          if (arg.note) changesSummary.push(`หมายเหตุ: ${arg.note}`);

          updatedResults.push({
            targetType: 'room',
            itemId: matchedKey,
            updatedName,
            locationLabel: arg.locationLabel || `ห้อง ${resolvedDestRoom.toUpperCase()}`,
            newExp: normalizedExp,
            subItemLabel: arg.subItemLabel,
            changesSummary,
          });
        }
      }

      if (updatedResults.length === 0) {
        return {
          success: false,
          dbSaved: false,
          updatedResults: [],
          failedItems,
          snapshot,
          error: 'ไม่พบรายการที่ตรงกันสำหรับการอัปเดต',
        };
      }

      // 1. Update local React state & localStorage in a single clean pass
      if (drugsChanged) {
        setDrugs(nextDrugs);
        setStored(chKeys.DRUGS, nextDrugs);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, nextDrugs);
      }
      if (eqChanged) {
        equipmentRef.current = nextEq;
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);
      }
      if (listsChanged) {
        setLists(nextLists);
        setStored(getChannelListsKey(channelId), nextLists);
        if (isMaster) setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
      }
      if (checksChanged) {
        setGlobalChecks(nextGlobal);
        setStored(getChannelChecksKey(channelId), nextGlobal);
      }

      const wardPatch =
        listsChanged || checksChanged
          ? {
              lists: nextLists,
              globalChecks: nextGlobal,
              emergencyWeekDates,
              deletedItemIds: getDeletedItemIds(channelId),
            }
          : undefined;
      if (wardPatch) {
        setStored(getChannelDbKey(channelId), wardPatch);
      }

      // 2. Commit all modified docs + ward workspace atomically in a single Firestore writeBatch
      const batchCommitRes = await saveBatchWardUpdatesToFirebase(channelId, {
        drugsToSave: Array.from(drugsToSaveMap.values()),
        equipmentToSave: Array.from(equipmentToSaveMap.values()),
        wardPatch,
      });

      reRenderData();

      // 3. Log audit trail entry for the batch operation
      void logAuditEvent({
        action: 'AURA_ACTION',
        targetCollection: updatedResults.length === 1 ? updatedResults[0].targetType : 'batch',
        targetId: updatedResults.length === 1 ? updatedResults[0].itemId : channelId,
        itemName:
          updatedResults.length === 1
            ? updatedResults[0].updatedName
            : `อัปเดตพร้อมกัน ${updatedResults.length} รายการ`,
        category:
          updatedResults.length === 1 ? updatedResults[0].locationLabel : 'อัปเดตแบบกลุ่ม (Aura Batch)',
        newValue: updatedResults
          .map((u) => `${u.updatedName} (${u.changesSummary.join(', ') || 'อัปเดตแล้ว'})`)
          .join(' | ')
          .slice(0, 1900),
        details: {
          channelId,
          count: updatedResults.length,
          items: updatedResults,
          dbSaved: batchCommitRes.ok,
          source: 'AuraAssistant_Batch',
        },
        currentUser,
      });

      return {
        success: true,
        dbSaved: batchCommitRes.ok,
        error: batchCommitRes.error,
        updatedResults,
        failedItems,
        snapshot,
      };
    },
    [
      activeChannelId,
      canEditStructure,
      createAuraSnapshot,
      currentUser,
      drugs,
      emergencyWeekDates,
      globalChecks,
      lists,
      reRenderData,
      setDrugs,
      setEquipment,
      setGlobalChecks,
      setLists,
    ]
  );

  // 🧠 Save Ward AI Memory / Custom Glossary permanently to wards/{wardId}/ai_memory
  const handleAuraSaveWardMemory = useCallback(
    async (entry: {
      triggerPhrase: string;
      meaning: string;
      category?: string;
      ruleType?: string;
    }): Promise<{
      success: boolean;
      dbSaved: boolean;
      memoryItem?: WardAiMemoryItem;
      error?: string;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const saveRes = await saveWardAiMemoryToFirebase(channelId, {
        ...entry,
        createdBy: currentUser?.name || currentUser?.username || 'พยาบาลวิสัญญี',
      });
      if (saveRes.ok && saveRes.item) {
        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: 'ai_memory',
          targetId: saveRes.item.id,
          itemName: `${saveRes.item.triggerPhrase} → ${saveRes.item.meaning}`,
          category: 'ความจำ AI ประจำวอร์ด',
          newValue: `"${saveRes.item.triggerPhrase}" หมายถึง "${saveRes.item.meaning}"`,
          details: {
            channelId,
            memoryId: saveRes.item.id,
            category: saveRes.item.category,
            ruleType: saveRes.item.ruleType,
            dbSaved: true,
            source: 'AuraAssistant_Memory',
          },
          currentUser,
        });
        return {
          success: true,
          dbSaved: true,
          memoryItem: saveRes.item,
        };
      }
      return {
        success: false,
        dbSaved: false,
        error: saveRes.error || 'ไม่สามารถบันทึกความจำวอร์ดลง Firestore ได้',
      };
    },
    [activeChannelId, currentUser]
  );

  // 🎯 Targeted Specific Item Deletion across all 5 categories with Tombstones + Undo Snapshot
  const handleAuraDeleteSpecificItems = useCallback(
    async (
      targets: Array<{
        targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
        itemId: string;
        roomId?: string;
        name?: string;
        groupName?: string;
      }>
    ): Promise<{
      success: boolean;
      deletedCount: number;
      deletedLabels: string[];
      snapshot: AuraDataSnapshot;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);
      const snapshot = createAuraSnapshot(`ก่อนลบ ${targets.length} รายการเจาะจง`);

      if (!canDelete) {
        return { success: false, deletedCount: 0, deletedLabels: [], snapshot };
      }

      const deletedLabels: string[] = [];
      const newTombstones: string[] = [];
      const firebaseDeletes: Array<Promise<any>> = [];
      const trashArchives: Array<{
        targetType: 'drug' | 'bag' | 'cart' | 'ambulance' | 'room';
        category: string;
        groupOrRoomId: string;
        itemName: string;
        payload: Record<string, any>;
        tokens: string[];
      }> = [];

      let nextDrugs = [...drugs];
      let drugsChanged = false;
      const nextEq: Record<string, EquipmentItem[]> = {};
      Object.entries(equipmentRef.current || {}).forEach(([rId, arr]) => {
        nextEq[rId] = [...(arr || [])];
      });
      let eqChanged = false;
      const nextLists = { ...lists };
      let listsChanged = false;
      const nextGlobal = { ...globalChecks };
      let checksChanged = false;

      for (const target of targets) {
        if (target.targetType === 'drug') {
          const found = nextDrugs.find((d) => d.id === target.itemId);
          if (found) {
            nextDrugs = nextDrugs.filter((d) => d.id !== target.itemId);
            drugsChanged = true;
            deletedLabels.push(`${found.name} (คลังยา)`);
            const tokens = makeItemTombstoneTokens('drug', found as any, found.id);
            newTombstones.push(...tokens);
            trashArchives.push({
              targetType: 'drug',
              category: 'คลังยา & สารน้ำ',
              groupOrRoomId: found.category || 'monthly',
              itemName: found.name,
              payload: { ...found },
              tokens,
            });
            firebaseDeletes.push(deleteChannelDrugItemInFirebase(channelId, found.id).catch(() => false));
          }
          continue;
        }

        if (target.targetType === 'bag' || target.targetType === 'cart' || target.targetType === 'ambulance') {
          const cat = target.targetType;
          const cfg = nextLists[cat];
          if (!cfg?.groups) continue;
          const updatedGroups: Record<string, EquipmentItem[]> = {};
          let matchedInCat: EquipmentItem | null = null;
          let matchedKey = '';
          let matchedGroup = '';

          Object.entries(cfg.groups).forEach(([gName, items]) => {
            updatedGroups[gName] = (items || []).filter((it, idx) => {
              const fbKey = `${cat}_${gName}_${idx}`;
              const compKey = `${cat}_${it.category || gName}_${it.name}`;
              const isMatch =
                (target.itemId && (it.id === target.itemId || fbKey === target.itemId || compKey === target.itemId)) ||
                (target.name && it.name.trim().toLowerCase() === target.name.trim().toLowerCase() && (!target.groupName || gName === target.groupName));
              if (isMatch && !matchedInCat) {
                matchedInCat = it;
                matchedGroup = gName;
                matchedKey = it.id || fbKey;
                return false;
              }
              return true;
            });
          });

          if (matchedInCat) {
            listsChanged = true;
            nextLists[cat] = { ...cfg, groups: updatedGroups };
            const catLabel = cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน';
            const removedObj = matchedInCat as EquipmentItem;
            deletedLabels.push(`${removedObj.name} (${catLabel})`);
            const tokens = makeItemTombstoneTokens(
              cat,
              { ...removedObj, category: removedObj.category || matchedGroup },
              matchedKey
            );
            newTombstones.push(...tokens);
            trashArchives.push({
              targetType: cat,
              category: catLabel,
              groupOrRoomId: matchedGroup,
              itemName: removedObj.name,
              payload: {
                ...removedObj,
                id: removedObj.id || matchedKey,
                category: removedObj.category || matchedGroup,
              },
              tokens,
            });
            if (nextGlobal[cat]?.[matchedKey]) {
              const catChecks = { ...nextGlobal[cat] };
              delete catChecks[matchedKey];
              nextGlobal[cat] = catChecks;
              checksChanged = true;
            }
            firebaseDeletes.push(deleteChannelEquipmentItemInFirebase(channelId, matchedKey).catch(() => false));
          }
          continue;
        }

        if (target.targetType === 'room') {
          const searchRooms = target.roomId && nextEq[target.roomId] ? [target.roomId] : Object.keys(nextEq);
          for (const rId of searchRooms) {
            const roomItems = nextEq[rId] || [];
            const matchIdx = roomItems.findIndex((it, idx) => {
              const fbKey = `${rId}_${idx}`;
              return (
                (target.itemId && (it.id === target.itemId || fbKey === target.itemId)) ||
                (target.name && it.name.trim().toLowerCase() === target.name.trim().toLowerCase())
              );
            });
            if (matchIdx !== -1) {
              const removed = roomItems[matchIdx];
              const resolvedKey = removed.id || `${rId}_${matchIdx}`;
              nextEq[rId] = roomItems.filter((_, idx) => idx !== matchIdx);
              eqChanged = true;
              deletedLabels.push(`${removed.name} (${rId.toUpperCase()})`);
              const tokens = makeItemTombstoneTokens(rId, { ...removed, category: rId }, resolvedKey);
              newTombstones.push(...tokens);
              trashArchives.push({
                targetType: 'room',
                category: `ครุภัณฑ์ (${rId.toUpperCase()})`,
                groupOrRoomId: rId,
                itemName: removed.name,
                payload: { ...removed, id: removed.id || resolvedKey, roomId: rId, type: 'room' },
                tokens,
              });
              if (nextGlobal[rId]?.[resolvedKey]) {
                const rChecks = { ...nextGlobal[rId] };
                delete rChecks[resolvedKey];
                nextGlobal[rId] = rChecks;
                checksChanged = true;
              }
              firebaseDeletes.push(deleteChannelEquipmentItemInFirebase(channelId, resolvedKey).catch(() => false));
              break;
            }
          }
        }
      }

      if (deletedLabels.length === 0) {
        return { success: false, deletedCount: 0, deletedLabels: [], snapshot };
      }

      const persistedTombstones = addDeletedItemIds(channelId, newTombstones);

      if (drugsChanged) {
        setDrugs(nextDrugs);
        setStored(chKeys.DRUGS, nextDrugs);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, nextDrugs);
      }
      if (eqChanged) {
        equipmentRef.current = nextEq;
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);
      }
      if (listsChanged) {
        setLists(nextLists);
        setStored(getChannelListsKey(channelId), nextLists);
        if (isMaster) setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
      }
      if (checksChanged) {
        setGlobalChecks(nextGlobal);
        setStored(getChannelChecksKey(channelId), nextGlobal);
      }

      const channelPayload = {
        lists: nextLists,
        globalChecks: nextGlobal,
        emergencyWeekDates,
        deletedItemIds: persistedTombstones,
      };
      setStored(getChannelDbKey(channelId), channelPayload);
      await saveChannelDataToFirebase(channelId, channelPayload).catch(() => {});
      await Promise.all(firebaseDeletes);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId, data: channelPayload } }));
        window.dispatchEvent(new Event('storage'));
      }
      reRenderData();

      for (const arc of trashArchives) {
        const trashId = await archiveDeletedItemToTrash({
          wardId: channelId,
          targetType: arc.targetType,
          category: arc.category,
          groupOrRoomId: arc.groupOrRoomId,
          itemName: arc.itemName,
          payload: arc.payload,
          tombstoneTokens: arc.tokens,
          currentUser,
        });
        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: arc.targetType,
          targetId: arc.payload.id || channelId,
          itemName: arc.itemName,
          category: arc.category,
          oldValue: arc.itemName,
          newValue: 'ถูกลบผ่าน Aura AI',
          trashId: trashId || undefined,
          restorablePayload: arc.payload,
          details: {
            channelId,
            deletedCount: deletedLabels.length,
            source: 'AuraAssistant',
          },
          currentUser,
        });
      }

      return {
        success: true,
        deletedCount: deletedLabels.length,
        deletedLabels,
        snapshot,
      };
    },
    [
      activeChannelId,
      canDelete,
      createAuraSnapshot,
      currentUser,
      drugs,
      emergencyWeekDates,
      globalChecks,
      lists,
      reRenderData,
      setDrugs,
      setEquipment,
      setGlobalChecks,
      setLists,
    ]
  );

  // ➕ Universal Add New Item across all 5 categories
  const handleAuraAddNewItem = useCallback(
    async (arg: {
      category: 'equipment' | 'drug' | 'bag' | 'cart' | 'ambulance';
      name: string;
      groupOrRoom?: string;
      qty?: string;
      unit?: string;
      expDate?: string;
      spec?: string;
      status?: string;
      note?: string;
    }): Promise<{
      success: boolean;
      addedLabel: string;
      categoryLabel: string;
      snapshot: AuraDataSnapshot;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);
      const cleanName = String(arg.name || '').trim();
      const snapshot = createAuraSnapshot(`ก่อนเพิ่ม ${cleanName}`);
      if (!canEditStructure) {
        return {
          success: false,
          addedLabel: '',
          categoryLabel: 'ผู้ดูแลระบบล็อกสิทธิ์การเพิ่มรายการสำหรับเจ้าหน้าที่ไว้',
          snapshot,
        };
      }
      if (!cleanName) {
        return { success: false, addedLabel: '', categoryLabel: '', snapshot };
      }

      if (arg.category === 'drug') {
        const qtyNum = Math.max(1, parseInt(String(arg.qty || '1').replace(/\D/g, ''), 10) || 1);
        const groupText = String(arg.groupOrRoom || '').toLowerCase();
        const drugCategory: 'monthly' | 'quarterly' | 'adhoc' =
          groupText.includes('3') || groupText.includes('quarter') || groupText.includes('ไตรมาส')
            ? 'quarterly'
            : groupText.includes('ครั้งคราว') || groupText.includes('adhoc')
            ? 'adhoc'
            : 'monthly';
        const todayStr = new Date().toISOString().split('T')[0];
        const newDrug: DrugItem = {
          id: `drug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          unit: String(arg.unit || 'หลอด').trim() || 'หลอด',
          totalQty: qtyNum,
          remaining: qtyNum,
          receivedDate: todayStr,
          receivedQty: qtyNum,
          minStock: Math.max(1, Math.min(5, Math.floor(qtyNum / 2) || 1)),
          batchRequest: '1',
          expDate: String(arg.expDate || '-').trim() || '-',
          exp: String(arg.expDate || '-').trim() || '-',
          spec: String(arg.spec || '').trim(),
          note: String(arg.note || arg.groupOrRoom || '').trim(),
          category: drugCategory,
          channelId,
        };
        removeDeletedItemIds(channelId, makeItemTombstoneTokens('drug', newDrug as any, newDrug.id));
        const nextDrugs = [...drugs, newDrug];
        setDrugs(nextDrugs);
        setStored(chKeys.DRUGS, nextDrugs);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, nextDrugs);
        await persistClearedFlags({ drugsCleared: false }, channelId).catch(() => {});
        await saveChannelDrugItemToFirebase(channelId, newDrug).catch(() => {});
        await saveChannelDataToFirebase(channelId, {
          lists,
          globalChecks,
          emergencyWeekDates,
          deletedItemIds: getDeletedItemIds(channelId),
        }).catch(() => {});
        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: 'drugs',
          targetId: newDrug.id,
          itemName: cleanName,
          category: 'คลังยา & สารน้ำ',
          newValue: `เพิ่มยา ${qtyNum} ${newDrug.unit} (EXP ${newDrug.expDate})`,
          details: { channelId, source: 'AuraAssistant' },
          currentUser,
        });
        return { success: true, addedLabel: cleanName, categoryLabel: 'คลังยา & สารน้ำ', snapshot };
      }

      if (arg.category === 'bag' || arg.category === 'cart' || arg.category === 'ambulance') {
        const cat = arg.category;
        const currentList = lists[cat] || {
          title: cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน',
          sheet: cat === 'bag' ? 'กระเป๋า Emergency' : cat === 'ambulance' ? 'รถ Ambulance' : 'รถ Emergency',
          groups: {},
        };
        const groupName = String(arg.groupOrRoom || Object.keys(currentList.groups || {})[0] || 'ทั่วไป').trim();
        const newItem: EquipmentItem = {
          id: `${cat}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          qty: String(arg.qty || '1').trim() || '1',
          unitText: String(arg.qty || '1').trim() || '1',
          exp: String(arg.expDate || '-').trim() || '-',
          spec: String(arg.spec || '').trim(),
          note: String(arg.note || '').trim(),
          category: groupName,
          location: groupName,
          type: cat,
        };
        removeDeletedItemIds(channelId, makeItemTombstoneTokens(cat, newItem, newItem.id));
        const nextGroups = { ...(currentList.groups || {}) };
        nextGroups[groupName] = sortItemsNaturally([...(nextGroups[groupName] || []), newItem]);
        const nextLists = { ...lists, [cat]: { ...currentList, groups: nextGroups } };
        setLists(nextLists);
        setStored(getChannelListsKey(channelId), nextLists);
        if (isMaster) setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
        await persistClearedFlags(
          cat === 'bag' ? { bagCleared: false } : cat === 'ambulance' ? { ambulanceCleared: false } : { cartCleared: false },
          channelId
        ).catch(() => {});
        await saveChannelEquipmentItemToFirebase(channelId, newItem).catch(() => {});
        const payload = {
          lists: nextLists,
          globalChecks,
          emergencyWeekDates,
          deletedItemIds: getDeletedItemIds(channelId),
        };
        setStored(getChannelDbKey(channelId), payload);
        await saveChannelDataToFirebase(channelId, payload).catch(() => {});
        reRenderData();
        const catLabel = cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน';
        void logAuditEvent({
          action: 'AURA_ACTION',
          targetCollection: cat,
          targetId: newItem.id || channelId,
          itemName: cleanName,
          category: `${catLabel} · ${groupName}`,
          newValue: `จำนวน ${newItem.qty}, EXP ${newItem.exp || '-'}`,
          details: { channelId, groupName, source: 'AuraAssistant' },
          currentUser,
        });
        return { success: true, addedLabel: `${cleanName} (${groupName})`, categoryLabel: catLabel, snapshot };
      }

      // Equipment room item
      const roomId = arg.groupOrRoom ? resolveRoomIdFromLocation(arg.groupOrRoom, arg.status, arg.note) : 'anes';
      const existingRoomItems = equipmentRef.current?.[roomId] || [];
      const newEqItem: EquipmentItem = {
        id: `eq_${roomId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        no: String(existingRoomItems.length + 1),
        name: cleanName,
        qty: String(arg.qty || '1').trim() || '1',
        spec: String(arg.spec || '').trim(),
        location: String(arg.groupOrRoom || roomId.toUpperCase()).trim(),
        roomId,
        type: 'room',
        status: String(arg.status || 'ปกติ').trim(),
        note: String(arg.note || '').trim(),
        exp: String(arg.expDate || '-').trim() || '-',
      };
      removeDeletedItemIds(channelId, makeItemTombstoneTokens(roomId, { ...newEqItem, category: roomId }, newEqItem.id));
      const nextEq = { ...(equipmentRef.current || {}), [roomId]: [...existingRoomItems, newEqItem] };
      equipmentRef.current = nextEq;
      setEquipment(nextEq);
      setStored(chKeys.EQ, nextEq);
      if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);
      await persistClearedFlags({ equipmentCleared: false }, channelId).catch(() => {});
      await saveChannelEquipmentItemToFirebase(channelId, newEqItem).catch(() => {});
      await saveChannelDataToFirebase(channelId, {
        lists,
        globalChecks,
        emergencyWeekDates,
        deletedItemIds: getDeletedItemIds(channelId),
      }).catch(() => {});
      reRenderData();
      void logAuditEvent({
        action: 'AURA_ACTION',
        targetCollection: 'equipment',
        targetId: newEqItem.id || channelId,
        itemName: cleanName,
        category: `ครุภัณฑ์ (${roomId.toUpperCase()})`,
        newValue: `จำนวน ${newEqItem.qty}, สถานะ ${newEqItem.status}`,
        details: { channelId, roomId, source: 'AuraAssistant' },
        currentUser,
      });
      return { success: true, addedLabel: `${cleanName} (${roomId.toUpperCase()})`, categoryLabel: 'ครุภัณฑ์ห้องผ่าตัด', snapshot };
    },
    [
      activeChannelId,
      canEditStructure,
      createAuraSnapshot,
      currentUser,
      drugs,
      emergencyWeekDates,
      globalChecks,
      lists,
      reRenderData,
      setDrugs,
      setEquipment,
      setLists,
    ]
  );

  // ⚡ Complete Smart Auto-Fill & Expiry + Min-Stock Verification Engine
  const handleAutoFillChecks = useCallback(
    async (arg: {
      items: any[];
      targetCategory?: 'bag' | 'cart' | 'ambulance' | 'drug';
      week?: number;
      onlyDiffs?: boolean;
      syncSheets?: boolean;
    }) => {
      const targetCat =
        arg.targetCategory ||
        (currentView === 'cart_check'
          ? 'cart'
          : currentView === 'ambulance_check'
          ? 'ambulance'
          : 'bag');
      const week = arg.week || 1;
      const onlyDiffs = arg.onlyDiffs ?? false;
      const items = arg.items || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let updatedCount = 0;
      let normalCount = 0;
      let abnormalCount = 0;
      let expiredCount = 0;
      let lowStockCount = 0;

      const nextGlobal = { ...globalChecks };
      const actualCat: 'bag' | 'cart' | 'ambulance' =
        targetCat === 'cart' ? 'cart' : targetCat === 'ambulance' ? 'ambulance' : 'bag';
      const currentCatChecks = { ...(nextGlobal[actualCat] || {}) };
      const groups = (lists as any)[actualCat]?.groups || {};

      const existingListMap: Array<{ key: string; item: EquipmentItem }> = [];
      Object.entries(groups).forEach(([groupName, groupItems]) => {
        ((groupItems || []) as EquipmentItem[]).forEach((it, idx) => {
          existingListMap.push({
            key: it.id || `${actualCat}_${groupName}_${idx}`,
            item: it,
          });
        });
      });

      const abnormalNotes: string[] = [];

      items.forEach((parsed) => {
        const pName = (parsed.name || parsed.itemName || '').trim();
        if (!pName) return;

        const expCandidate = parsed.exp || parsed.expDate || parsed.expiryDate || '';
        let isExpired = parsed.status === 'EXPIRED' || parsed.status === 'expired';
        if (expCandidate && expCandidate !== '-') {
          const expObj = parseExpDateObj(String(expCandidate));
          if (expObj && expObj.getTime() < today.getTime()) {
            isExpired = true;
          }
        }

        const expectedNum = parseFloat(String(parsed.expected ?? parsed.minStock ?? ''));
        const actualNum = parseFloat(String(parsed.actual ?? parsed.quantity ?? parsed.remaining ?? ''));
        const isLowQty =
          !isNaN(expectedNum) && !isNaN(actualNum) && expectedNum > 0 && actualNum < expectedNum;

        const statusRaw = String(parsed.status || '').trim();
        const isDefect =
          isExpired ||
          isLowQty ||
          statusRaw === 'INCOMPLETE' ||
          statusRaw === 'EXPIRED' ||
          statusRaw === 'damaged' ||
          statusRaw === 'low' ||
          statusRaw.includes('ผิด') ||
          statusRaw.includes('ไม่ปกติ') ||
          Boolean(parsed.issue && String(parsed.issue).trim() !== '');

        if (isExpired) expiredCount++;
        if (isLowQty) lowStockCount++;

        if (isDefect) {
          abnormalCount++;
          const reasons: string[] = [];
          if (isExpired) reasons.push(`หมดอายุ (${expCandidate || '-'})`);
          if (isLowQty) reasons.push(`ไม่ครบ (${actualNum}/${expectedNum})`);
          if (parsed.issue && String(parsed.issue).trim()) reasons.push(String(parsed.issue).trim());
          abnormalNotes.push(`${pName}: ${reasons.join(', ') || 'ผิดปกติ'}`);
        } else {
          normalCount++;
        }

        if (onlyDiffs && !isDefect) {
          return;
        }

        const match = existingListMap.find((e) =>
          matchMedicalItemName(pName.toLowerCase(), e.item.name || '', e.item.spec || '')
        );

        if (match) {
          const existing = currentCatChecks[match.key] || { result: '', weekVals: {} };
          const nextWeekVals = { ...(existing.weekVals || {}) };
          const valToSet = isDefect
            ? String(parsed.actual ?? parsed.quantity ?? '0')
            : getRealTargetCheckValue(match.item);

          nextWeekVals[week] = valToSet;
          const noteText =
            parsed.issue ||
            (isExpired ? `หมดอายุ: ${expCandidate}` : isLowQty ? `จำนวนไม่ครบ (${actualNum}/${expectedNum})` : '') ||
            (expCandidate && expCandidate !== '-' ? `EXP: ${expCandidate}` : existing.note);

          currentCatChecks[match.key] = {
            ...existing,
            result: isDefect ? 'ผิดปกติ' : 'ปกติ',
            weekVals: nextWeekVals,
            note: noteText,
            exp: expCandidate && expCandidate !== '-' ? expCandidate : existing.exp,
          };
          updatedCount++;
        }
      });

      // Also scan global drugs inventory for expiry & minStock alerts for comprehensive Aura summary
      let drugExpiredOrNear = 0;
      let drugLowStock = 0;
      (drugs || []).forEach((d) => {
        const dExp = d.expDate || d.exp;
        if (dExp && dExp !== '-') {
          const dObj = parseExpDateObj(dExp);
          if (dObj && dObj.getTime() < today.getTime()) {
            drugExpiredOrNear++;
          }
        }
        const rem = Number(d.remaining ?? d.totalQty ?? 0);
        const min = Number(d.minStock ?? 0);
        if (min > 0 && rem <= min) {
          drugLowStock++;
        }
      });

      nextGlobal[actualCat] = currentCatChecks;
      setGlobalChecks(nextGlobal);
      setStored(getChannelChecksKey(activeChannelId), nextGlobal);

      const now = new Date();
      const catTitle =
        actualCat === 'bag'
          ? 'ตรวจเช็กกระเป๋าฉุกเฉิน (Auto-Fill)'
          : actualCat === 'ambulance'
          ? 'ตรวจเช็กรถพยาบาลฉุกเฉิน (Auto-Fill)'
          : 'ตรวจเช็กรถฉุกเฉิน (Auto-Fill)';
      const targetItemsList =
        actualCat === 'bag'
          ? formattedBagItems
          : actualCat === 'ambulance'
          ? formattedAmbulanceItems
          : formattedCartItems;
      const newRecord: InspectionHistoryRecord = {
        id: `${actualCat}_autofill_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: actualCat,
        title: `${catTitle} สัปดาห์ที่ ${week}`,
        who: currentUser?.name || 'น้องออร่า (Aura Auto-Fill)',
        rows: targetItemsList.map((it: any) => ({
          ...it,
          val:
            currentCatChecks[it.itemKey || it.id || '']?.weekVals?.[week] ||
            getRealTargetCheckValue(it as any),
          res: currentCatChecks[it.itemKey || it.id || '']?.result || 'ปกติ',
          weekVals: currentCatChecks[it.itemKey || it.id || '']?.weekVals || {},
        })),
        weekDates: emergencyWeekDates[actualCat] || {},
      };

      setHistoryRecords((prev) => [newRecord, ...prev].slice(0, 50));
      saveInspectionToFirebase(newRecord, resolveWardId(activeChannelId)).catch((e) =>
        console.warn('Firebase save error:', e)
      );

      if (arg.syncSheets !== false && apiUrl && apiUrl.trim()) {
        try {
          const sheetPrefix =
            actualCat === 'bag' ? 'กระเป๋า' : actualCat === 'ambulance' ? 'รถพยาบาล' : 'รถ';
          const uniqueSheet = `${sheetPrefix}_สัปดาห์${week}_${now.toISOString().split('T')[0]}`;
          await sendInspectionToGas(apiUrl, {
            type: actualCat,
            sheet: sheetPrefix,
            sheetName: uniqueSheet,
            title: catTitle,
            location: activeChannel?.name || 'ห้องผ่าตัด OR',
            date: now.toISOString().split('T')[0],
            who: currentUser?.name || 'น้องออร่า (Aura Auto-Fill)',
            user: currentUser?.username || 'aura',
            rows: targetItemsList.map((it: any, idx: number) => ({
              no: String(idx + 1),
              name: it.name,
              val: currentCatChecks[it.itemKey || it.id || '']?.weekVals?.[week] || it.unitText || '1',
              res: currentCatChecks[it.itemKey || it.id || '']?.result || 'ปกติ',
              exp: currentCatChecks[it.itemKey || it.id || '']?.exp || it.exp || '-',
              note: currentCatChecks[it.itemKey || it.id || '']?.note || '-',
            })),
          });
        } catch (gasErr) {
          console.warn('Google Sheets sync warning:', gasErr);
        }
      }

      logAuditEvent({
        action: 'เช็คของ',
        targetCollection: targetCat,
        targetId: 'aura_autofill',
        details: {
          message: `Aura Auto-Fill อัปเดต ${updatedCount} รายการ (ปกติ ${normalCount} / ผิดปกติ ${abnormalCount})`,
          updatedCount,
          normalCount,
          abnormalCount,
          onlyDiffs,
        },
        currentUser,
      });

      const summaryLines = [
        `✅ บันทึกข้อมูลตารางลงระบบและ Cloud เรียบร้อยแล้วค่ะ (อัปเดต ${updatedCount} จุด)`,
        `• รายการปกติ: ${normalCount} รายการ`,
        `• รายการผิดปกติ/ต้องแก้ไข: ${abnormalCount} รายการ${expiredCount > 0 || lowStockCount > 0 ? ` (หมดอายุ ${expiredCount}, จำนวนต่ำกว่าเกณฑ์ ${lowStockCount})` : ''}`,
      ];
      if (abnormalNotes.length > 0) {
        summaryLines.push(`⚠️ จุดที่พบปัญหา:\n  - ${abnormalNotes.slice(0, 6).join('\n  - ')}`);
      }
      if (drugExpiredOrNear > 0 || drugLowStock > 0) {
        summaryLines.push(
          `💊 หมายเหตุคลังยารวม: พบยาหมดอายุ ${drugExpiredOrNear} รายการ, ต่ำกว่า Min Stock ${drugLowStock} รายการ`
        );
      }

      return {
        updatedCount,
        normalCount,
        abnormalCount,
        expiredCount,
        lowStockCount,
        targetCat,
        week,
        summaryText: summaryLines.join('\n'),
      };
    },
    [
      activeChannel?.name,
      activeChannelId,
      apiUrl,
      currentUser,
      currentView,
      drugs,
      emergencyWeekDates,
      formattedAmbulanceItems,
      formattedBagItems,
      formattedCartItems,
      globalChecks,
      lists,
      setGlobalChecks,
      setHistoryRecords,
    ]
  );

  const handleRestockRequest = useCallback(
    async (arg: { items: any[]; targetCategory?: string; notes?: string }) => {
      const items = arg.items || [];
      if (items.length === 0) return { success: false, count: 0 };

      const now = new Date();
      const restockRecord = {
        id: `REQ-${Date.now()}`,
        createdAt: now.toISOString(),
        dateFormatted: now.toLocaleString('th-TH'),
        requester: currentUser?.name || 'พยาบาลวิสัญญีประจำวอร์ด',
        category: arg.targetCategory || 'emergency',
        notes: arg.notes || 'ขอเบิกด่วนผ่านระบบ น้องออร่า Auto-Restock',
        items: items.map((it, idx) => ({
          no: idx + 1,
          name: it.name || it.itemName,
          neededQty: it.expected ? Math.max(1, (parseInt(it.expected) || 1) - (parseInt(it.actual) || 0)) : 1,
          unit: 'ชิ้น/หลอด',
          reason: it.issue || (it.status === 'EXPIRED' ? 'ยาหมดอายุ' : 'ของขาด/ชำรุด'),
        })),
      };

      await saveRestockRequisitionToFirebase({
        id: restockRecord.id,
        channelId: resolveWardId(activeChannelId),
        targetCategory: restockRecord.category,
        requestedBy: restockRecord.requester,
        status: 'pending',
        notes: restockRecord.notes,
        items: restockRecord.items,
        createdAt: restockRecord.createdAt,
      }).catch(() => {});

      if (apiUrl && apiUrl.trim()) {
        try {
          await sendInspectionToGas(apiUrl, {
            type: 'restock',
            sheet: 'ใบเบิกยาและเวชภัณฑ์',
            sheetName: `เบิกด่วน_${now.toISOString().split('T')[0]}`,
            title: `ใบขอเบิกเวชภัณฑ์ฉุกเฉิน (${restockRecord.id})`,
            location: activeChannel?.name || 'ห้องผ่าตัด OR',
            date: now.toISOString().split('T')[0],
            who: currentUser?.name || 'น้องออร่า (One-Click Restock)',
            user: currentUser?.username || 'nurse',
            rows: restockRecord.items.map((it) => ({
              no: String(it.no),
              name: it.name,
              qty: String(it.neededQty),
              unit: it.unit,
              reason: it.reason,
            })),
          });
        } catch (err) {
          console.warn('GAS restock send error:', err);
        }
      }

      logAuditEvent({
        action: 'เบิกยา',
        targetCollection: 'restock',
        targetId: restockRecord.id,
        details: {
          message: `สร้างใบขอเบิกเวชภัณฑ์ ${items.length} รายการผ่าน One-Click Restock`,
          requisitionId: restockRecord.id,
          itemCount: items.length,
          channelId: resolveWardId(activeChannelId),
        },
        currentUser,
      });

      return { success: true, count: items.length, requisitionId: restockRecord.id };
    },
    [activeChannel?.name, activeChannelId, apiUrl, currentUser]
  );

  const handleAttachEquipmentPhotos = useCallback(
    async (arg: {
      mappings: Array<{
        imageIndex: number;
        equipmentId: string;
        detectedNumber?: string;
        equipmentName?: string;
      }>;
      attachments: Array<{ index: number; dataUrl: string; fileName?: string }>;
    }): Promise<{
      updatedItems: Array<{
        roomId: string;
        equipmentId: string;
        equipmentName: string;
        detectedNumber: string;
        imageIndex: number;
      }>;
      failedItems: Array<{
        imageIndex: number;
        detectedNumber?: string;
        equipmentName?: string;
        reason: string;
      }>;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);

      const attByIndex = new Map<number, { index: number; dataUrl: string; fileName?: string }>();
      (arg.attachments || []).forEach((att) => {
        attByIndex.set(Number(att.index), att);
      });

      const nextEq: Record<string, EquipmentItem[]> = {};
      Object.entries(equipmentRef.current || {}).forEach(([roomId, items]) => {
        nextEq[roomId] = [...(items || [])];
      });

      const updatedItems: Array<{
        roomId: string;
        equipmentId: string;
        equipmentName: string;
        detectedNumber: string;
        imageIndex: number;
      }> = [];
      const failedItems: Array<{
        imageIndex: number;
        detectedNumber?: string;
        equipmentName?: string;
        reason: string;
      }> = [];
      const itemsToSync = new Map<string, EquipmentItem>();

      for (const mapping of arg.mappings || []) {
        const idxNum = Number(mapping.imageIndex);
        const att = attByIndex.get(idxNum) || (arg.attachments || [])[idxNum];
        if (!att || !att.dataUrl) {
          failedItems.push({
            imageIndex: idxNum,
            detectedNumber: mapping.detectedNumber,
            equipmentName: mapping.equipmentName,
            reason: 'ไม่พบข้อมูลไฟล์รูปภาพที่จับคู่',
          });
          continue;
        }

        const targetEqId = String(mapping.equipmentId || '').trim();
        const targetNum = String((mapping as any).orderNumber || mapping.detectedNumber || '').trim();
        const targetName = String(mapping.equipmentName || '').trim().toLowerCase();
        const targetNumInt = parseInt(targetNum, 10);

        let foundRoomId = '';
        let foundIndex = -1;

        // Pass 1: Match by exact equipmentId or fallback `${roomId}_${idx}`
        if (targetEqId) {
          for (const [roomId, roomList] of Object.entries(nextEq)) {
            const idx = roomList.findIndex(
              (it, i) => String(it.id || '') === targetEqId || `${roomId}_${i}` === targetEqId
            );
            if (idx !== -1) {
              foundRoomId = roomId;
              foundIndex = idx;
              break;
            }
          }
        }

        // Pass 2: Fallback match by equipment sequence orderNumber / no / code / sap (with numeric tolerance)
        if (foundIndex === -1 && targetNum) {
          for (const [roomId, roomList] of Object.entries(nextEq)) {
            const idx = roomList.findIndex((it) => {
              const itNo = String(it.no ?? '').trim();
              const itOrder = String(it.orderNumber ?? '').trim();
              const itCode = String(it.code || it.assetCode || '').trim();
              const itSap = String(it.sap || it.sapCode || '').trim();
              if (
                itOrder === targetNum ||
                itNo === targetNum ||
                itCode === targetNum ||
                itSap === targetNum
              ) {
                return true;
              }
              if (!Number.isNaN(targetNumInt) && targetNumInt > 0) {
                const itNoInt = parseInt(itNo, 10);
                const itOrderInt = parseInt(itOrder, 10);
                if (itNoInt === targetNumInt || itOrderInt === targetNumInt) {
                  return true;
                }
              }
              return false;
            });
            if (idx !== -1) {
              foundRoomId = roomId;
              foundIndex = idx;
              break;
            }
          }
        }

        // Pass 3: Fallback match by exact equipment name
        if (foundIndex === -1 && targetName) {
          for (const [roomId, roomList] of Object.entries(nextEq)) {
            const idx = roomList.findIndex(
              (it) => String(it.name || '').trim().toLowerCase() === targetName
            );
            if (idx !== -1) {
              foundRoomId = roomId;
              foundIndex = idx;
              break;
            }
          }
        }

        if (foundIndex === -1 || !foundRoomId) {
          failedItems.push({
            imageIndex: idxNum,
            detectedNumber: mapping.detectedNumber,
            equipmentName: mapping.equipmentName,
            reason: `ไม่พบครุภัณฑ์รหัส/เลขที่ ${targetNum || targetEqId || '-'} ในระบบ`,
          });
          continue;
        }

        const existingItem = nextEq[foundRoomId][foundIndex];
        const resolvedId = existingItem.id || `${foundRoomId}_${foundIndex}`;
        const updatedItem: EquipmentItem = {
          ...existingItem,
          id: resolvedId,
          roomId: foundRoomId,
          type: existingItem.type || 'room',
          img: att.dataUrl,
        };

        nextEq[foundRoomId][foundIndex] = updatedItem;
        itemsToSync.set(`${foundRoomId}:${resolvedId}`, updatedItem);
        updatedItems.push({
          roomId: foundRoomId,
          equipmentId: resolvedId,
          equipmentName: existingItem.name || mapping.equipmentName || resolvedId,
          detectedNumber: targetNum || String(existingItem.no || existingItem.code || '-'),
          imageIndex: idxNum,
        });
      }

      if (itemsToSync.size > 0) {
        equipmentRef.current = nextEq;
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);

        await Promise.all(
          Array.from(itemsToSync.values()).map((item) =>
            saveChannelEquipmentItemToFirebase(channelId, item).catch((err) =>
              console.warn('Firebase equipment photo sync warning:', err)
            )
          )
        );

        logAuditEvent({
          action: 'ATTACH_EQUIPMENT_PHOTOS',
          targetCollection: 'equipment',
          targetId: channelId,
          details: {
            channelId,
            count: updatedItems.length,
            items: updatedItems.map((u) => `${u.detectedNumber}: ${u.equipmentName} (${u.roomId})`),
            source: 'AuraAssistant',
          },
          currentUser,
        });
      }

      return { updatedItems, failedItems };
    },
    [activeChannelId, currentUser, equipment, setEquipment]
  );

  const handleBulkImportEquipment = useCallback(
    async (
      rawItems: BulkEquipmentImportRow[]
    ): Promise<{
      importedCount: number;
      minOrder: string;
      maxOrder: string;
      markedItems: BulkEquipmentImportRow[];
      roomCounts: Record<string, number>;
    }> => {
      const channelId = resolveWardId(activeChannelId);
      const isMaster = isDefaultWard(channelId);
      const chKeys = getChannelStorageKeys(channelId);

      const validRows = (rawItems || []).filter(
        (it) => it && typeof it === 'object' && String(it.name || '').trim().length > 0
      );

      // Sort 100% by numeric orderNumber without dropping any row
      const sortedRows = [...validRows].sort((a, b) => {
        const na = parseInt(String(a.orderNumber || '').replace(/\D/g, ''), 10);
        const nb = parseInt(String(b.orderNumber || '').replace(/\D/g, ''), 10);
        return (isNaN(na) ? 999999 : na) - (isNaN(nb) ? 999999 : nb);
      });

      const nextEq: Record<string, EquipmentItem[]> = {};
      Object.entries(equipmentRef.current || {}).forEach(([rId, list]) => {
        nextEq[rId] = [...(list || [])];
      });

      const nextGlobal = { ...(globalChecksRef.current || {}) };
      const usedIds = new Set<string>();
      const importedEquipmentList: EquipmentItem[] = [];
      const markedItems: BulkEquipmentImportRow[] = [];
      const roomCounts: Record<string, number> = {};

      sortedRows.forEach((row, idx) => {
        const orderStr = String(row.seq ?? row.orderNumber ?? '').trim() || String(idx + 1);
        const numericOrder = parseInt(orderStr.replace(/\D/g, ''), 10);
        const baseId = !isNaN(numericOrder)
          ? `eq_reg_${String(numericOrder).padStart(4, '0')}`
          : `eq_reg_row_${idx + 1}`;
        let itemId = baseId;
        let dupSuffix = 1;
        while (usedIds.has(itemId)) {
          itemId = `${baseId}_d${dupSuffix++}`;
        }
        usedIds.add(itemId);

        const assetCodeVal = String(row.asset_number ?? row.assetCode ?? '').trim().slice(0, 150);
        const sapCodeVal = String(row.sap_code ?? row.sapCode ?? '').trim().slice(0, 150);
        const brandModelVal = String(row.brand_model ?? row.brandModel ?? '').trim().slice(0, 1000);
        const sourceVal = String(row.source_budget ?? row.source ?? '').trim().slice(0, 150);
        const acquiredDateVal = String(row.acquired_date ?? row.date ?? '').trim().slice(0, 100);
        const qtyVal = String(row.quantity ?? row.qty ?? '1').trim().slice(0, 50) || '1';
        const noteStr = String(row.handwritten_note ?? row.note ?? '').trim().slice(0, 950);
        const rawLocationOfficial = String(row.location_official ?? row.location ?? '').trim();

        const roomId = resolveRoomIdFromLocation(rawLocationOfficial, row.status, noteStr);
        const cleanPrice =
          row.price !== undefined && row.price !== null
            ? String(row.price).replace(/,/g, '').trim().slice(0, 50)
            : '';
        const rawStatusStr = String(row.status || 'ปกติ').trim() || 'ปกติ';
        const locationStr = (rawLocationOfficial || roomId.toUpperCase()).slice(0, 200);
        const locWithoutWorkingRoom = locationStr.replace(/ห้องทำงาน/g, '');
        let statusStr = rawStatusStr;
        if (/ส่งคืน/.test(`${rawStatusStr} ${noteStr} ${locationStr}`)) {
          statusStr = 'ส่งคืน';
        } else if (
          /ชำรุด/.test(`${rawStatusStr} ${noteStr} ${locationStr}`) ||
          /ไม่ทำงาน/.test(`${rawStatusStr} ${noteStr} ${locWithoutWorkingRoom}`)
        ) {
          statusStr = 'ชำรุด';
        } else if (/เก็บสำรอง|เราเก็บไว้|เราเบิกชื่อ/.test(`${rawStatusStr} ${noteStr} ${locationStr}`)) {
          statusStr = 'เก็บสำรอง';
        } else if (/ให้ยืม/.test(`${rawStatusStr} ${noteStr} ${locationStr}`)) {
          statusStr = 'ให้ยืม';
        }
        const isMarked = Boolean(row.is_marked_x ?? row.isMarked ?? Boolean(noteStr));

        const newItem: EquipmentItem = {
          id: itemId,
          no: orderStr,
          orderNumber: orderStr,
          code: assetCodeVal,
          assetCode: assetCodeVal,
          sap: sapCodeVal,
          sapCode: sapCodeVal,
          name: String(row.name || '').trim().slice(0, 300),
          spec: brandModelVal,
          brandModel: brandModelVal.slice(0, 500),
          source: sourceVal,
          date: acquiredDateVal,
          qty: qtyVal,
          price: cleanPrice,
          location: locationStr,
          roomId,
          type: 'room',
          status: statusStr,
          note: noteStr,
          isMarked,
        };

        // Remove any previous copy of itemId from all rooms before inserting cleanly
        Object.keys(nextEq).forEach((rKey) => {
          nextEq[rKey] = (nextEq[rKey] || []).filter((existing) => existing.id !== itemId);
        });
        if (!nextEq[roomId]) nextEq[roomId] = [];
        nextEq[roomId].push(newItem);

        // Update globalChecks status
        const isDefective =
          statusStr.includes('ชำรุด') ||
          statusStr.includes('ไม่ทำงาน') ||
          statusStr.includes('ผิด');
        const isReturned = statusStr.includes('ส่งคืน');
        const roomChecks = { ...(nextGlobal[roomId] || {}) };
        roomChecks[itemId] = {
          ...(roomChecks[itemId] || { weekVals: {} }),
          result: isDefective ? 'ผิดปกติ' : isReturned ? '' : 'ปกติ',
          note: noteStr || (isReturned ? 'ส่งคืน' : ''),
        };
        nextGlobal[roomId] = roomChecks;

        importedEquipmentList.push(newItem);
        roomCounts[roomId] = (roomCounts[roomId] || 0) + 1;

        if (isMarked) {
          markedItems.push({
            ...row,
            orderNumber: orderStr,
            location: locationStr,
            status: statusStr,
            note: noteStr,
            isMarked: true,
          });
        }
      });

      // Keep every room list cleanly sorted by numeric orderNumber
      Object.keys(nextEq).forEach((rKey) => {
        nextEq[rKey] = [...nextEq[rKey]].sort((a, b) => {
          const na = parseInt(String(a.orderNumber || a.no || '').replace(/\D/g, ''), 10);
          const nb = parseInt(String(b.orderNumber || b.no || '').replace(/\D/g, ''), 10);
          return (isNaN(na) ? 999999 : na) - (isNaN(nb) ? 999999 : nb);
        });
      });

      if (importedEquipmentList.length > 0) {
        equipmentRef.current = nextEq;
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);

        globalChecksRef.current = nextGlobal;
        setGlobalChecks(nextGlobal);
        setStored(getChannelChecksKey(channelId), nextGlobal);

        await persistClearedFlags({ equipmentCleared: false }, channelId).catch(() => {});
        await saveChannelBatchEquipmentToFirebase(channelId, importedEquipmentList).catch((err) =>
          console.warn('Firebase bulk equipment import error:', err)
        );
        await saveChannelDataToFirebase(channelId, {
          lists,
          globalChecks: nextGlobal,
          emergencyWeekDates,
        }).catch(() => {});

        logAuditEvent({
          action: 'ADD_EQUIPMENT',
          targetCollection: 'equipment',
          targetId: channelId,
          details: {
            channelId,
            importedCount: importedEquipmentList.length,
            markedCount: markedItems.length,
            firstOrder: sortedRows[0]?.orderNumber || '',
            lastOrder: sortedRows[sortedRows.length - 1]?.orderNumber || '',
            source: 'AuraAssistant_BulkImport',
          },
          currentUser,
        });
      }

      const firstOrder = sortedRows[0]?.orderNumber ? String(sortedRows[0].orderNumber).trim() : '1';
      const lastOrder =
        sortedRows[sortedRows.length - 1]?.orderNumber
          ? String(sortedRows[sortedRows.length - 1].orderNumber).trim()
          : String(sortedRows.length);

      return {
        importedCount: importedEquipmentList.length,
        minOrder: firstOrder,
        maxOrder: lastOrder,
        markedItems,
        roomCounts,
      };
    },
    [
      activeChannelId,
      currentUser,
      emergencyWeekDates,
      equipment,
      globalChecks,
      lists,
      setEquipment,
      setGlobalChecks,
    ]
  );

  return {
    handleAuraBulkAutoCheck,
    handleAuraClearInventory,
    executeAuraClearInventory,
    executeDeleteAllEquipment,
    createAuraSnapshot,
    restoreAuraSnapshot,
    handleAuraDirectClear,
    handleAuraUpdateItem,
    handleAuraBatchUpdateItems,
    handleAuraSaveWardMemory,
    handleAuraDeleteSpecificItems,
    handleAuraAddNewItem,
    handleAutoFillChecks,
    handleRestockRequest,
    handleAttachEquipmentPhotos,
    handleBulkImportEquipment,
  };
}
