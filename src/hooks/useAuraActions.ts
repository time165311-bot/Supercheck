import { Dispatch, SetStateAction, useCallback, useRef } from 'react';
import {
  AuraDataSnapshot,
  CheckItemState,
  DrugItem,
  EquipmentItem,
  InspectionHistoryRecord,
  ListConfig,
  User,
  WardChannel,
} from '../types';
import {
  auth,
  clearAllEquipmentInFirebase,
  clearChannelDrugsInFirebase,
  clearChannelEquipmentInFirebase,
  saveChannelBatchDrugsToFirebase,
  saveChannelBatchEquipmentToFirebase,
  saveChannelDataToFirebase,
  saveChannelDrugItemToFirebase,
  saveChannelEquipmentItemToFirebase,
  saveEquipmentItemToFirebase,
  saveInspectionToFirebase,
  saveRestockRequisitionToFirebase,
} from '../services/firebase';
import {
  getChannelChecksKey,
  getChannelListsKey,
  getChannelWeekDatesKey,
  setStored,
  STORAGE_KEYS,
} from '../services/storage';
import { getChannelStorageKeys } from '../utils/helpers';
import { getLocalClearedFlags, persistClearedFlags } from './useChannelSync';
import { clearChannelCategory } from '../services/aiEngine';
import { logAuditEvent } from '../services/auditLogger';
import { sendInspectionToGas } from '../services/api';
import { matchMedicalItemName, parseExpDateObj, getRealTargetCheckValue } from '../utils/itemUtils';
import { getWednesdaysInfoForMonth, getWednesdaysIsoDates } from '../utils/wednesdayUtils';

export interface UseAuraActionsParams {
  activeChannelId: string;
  activeChannel?: WardChannel;
  currentView: string;
  currentUser: User | null;
  apiUrl: string;
  drugs: DrugItem[];
  setDrugs: Dispatch<SetStateAction<DrugItem[]>>;
  equipment: Record<string, EquipmentItem[]>;
  setEquipment: Dispatch<SetStateAction<Record<string, EquipmentItem[]>>>;
  lists: Record<'bag' | 'cart', ListConfig>;
  setLists: (
    newLists:
      | Record<'bag' | 'cart', ListConfig>
      | ((prev: Record<'bag' | 'cart', ListConfig>) => Record<'bag' | 'cart', ListConfig>)
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
    async (arg: { categories: ('bag' | 'cart')[]; weeks: number[] }) => {
      const categories: ('bag' | 'cart')[] =
        arg.categories.length > 0 ? arg.categories : ['bag', 'cart'];
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

      const itemsForSnapshot = primaryCat === 'bag' ? formattedBagItems : formattedCartItems;
      const catTitle =
        primaryCat === 'bag'
          ? 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency'
          : 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
      const newRecord: InspectionHistoryRecord = {
        id: `${primaryCat}_wk${primaryWeek}_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: primaryCat,
        title: `${catTitle} (สัปดาห์ที่ ${primaryWeek})`,
        who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
        rows: itemsForSnapshot.map((it) => ({
          ...it,
          val: getRealTargetCheckValue(it as any),
          res: 'ใช้งานได้',
          weekVals: it.weekVals || {},
        })),
        weekDates: finalWeekDates,
      };

      setHistoryRecords((prev) => [newRecord, ...prev].slice(0, 50));
      saveInspectionToFirebase(newRecord).catch((e) => console.warn('Firebase history save error:', e));

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
      setPendingClearCategory(targetCategory);
    },
    [setPendingClearCategory]
  );

  const executeAuraClearInventory = useCallback(
    async (targetCategory: string) => {
      const q = targetCategory.toLowerCase();
      const channelId = activeChannelId || 'channel_master';
      const isMaster = channelId === 'channel_master';
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
      } else if (q.includes('รถ') || q.includes('cart')) {
        const { clearedCount } = clearChannelCategory(channelId, 'cart');
        reRenderData();
        if (isMaster) {
          await clearAllEquipmentInFirebase('cart').catch(() => {});
          await persistClearedFlags({ cartCleared: true }, channelId);
        }
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
        if (isMaster) {
          await clearAllEquipmentInFirebase('bag').catch(() => {});
          await persistClearedFlags({ bagCleared: true }, channelId);
        }
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
    [activeChannelId, currentUser, reRenderData, setDrugs, setEquipment, setPendingClearCategory]
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
        },
      };
    },
    [activeChannelId, drugs, emergencyWeekDates, equipment, globalChecks, lists]
  );

  const restoreAuraSnapshot = useCallback(
    async (snapshot: AuraDataSnapshot): Promise<boolean> => {
      try {
        const targetChannel = snapshot.channelId || activeChannelId || 'channel_master';
        const isMaster = targetChannel === 'channel_master';
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
      await executeAuraClearInventory(targetCategory);
      return snapshot;
    },
    [createAuraSnapshot, executeAuraClearInventory]
  );

  const executeDeleteAllEquipment = useCallback(async (): Promise<{
    success: boolean;
    deletedCount: number;
    syncedToCloud: boolean;
    error?: string;
    snapshot: AuraDataSnapshot;
  }> => {
    const channelId = activeChannelId || 'channel_master';
    const isMaster = channelId === 'channel_master';
    const chKeys = getChannelStorageKeys(channelId);
    const deletedCount = Object.values(equipmentRef.current || {}).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.filter((it) => it && it.name).length : 0),
      0
    );
    const snapshot = createAuraSnapshot(`ก่อนลบครุภัณฑ์ทั้งหมด (${deletedCount} รายการ)`);

    // 1. Clear UI State & LocalStorage immediately to 0 items
    equipmentRef.current = {};
    setEquipment({});
    setStored(chKeys.EQ, {});
    if (isMaster) {
      setStored(STORAGE_KEYS.EQ, {});
    }

    let syncedToCloud = false;
    let cloudError: string | undefined;

    // 2. Delete all channel equipment documents from Firestore (writeBatch) & persist cleared flag
    if (auth.currentUser) {
      try {
        syncedToCloud = await clearChannelEquipmentInFirebase(channelId, 'room');
        await persistClearedFlags({ equipmentCleared: true }, channelId);
      } catch (err: any) {
        cloudError = err?.message || 'ไม่สามารถลบข้อมูลใน Firestore ได้ (ตรวจสอบสิทธิ์ Admin)';
        syncedToCloud = false;
      }
    } else {
      await persistClearedFlags({ equipmentCleared: true }, channelId).catch(() => {});
      cloudError = 'ยังไม่ได้เข้าสู่ระบบบัญชี Google จึงล้างข้อมูลเฉพาะในเครื่อง';
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    reRenderData();
    setPendingClearCategory(null);

    logAuditEvent({
      action: 'CLEAR_EQUIPMENT',
      targetCollection: 'equipment',
      targetId: channelId,
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
  }, [activeChannelId, createAuraSnapshot, currentUser, reRenderData, setEquipment, setPendingClearCategory]);

  const handleAuraUpdateItem = useCallback(
    async (arg: {
      targetType: 'drug' | 'bag' | 'cart' | 'room';
      itemId: string;
      roomId?: string;
      newExp?: string;
      lotNumber?: string;
      newQty?: string | number;
      newStatus?: 'ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ';
      note?: string;
    }): Promise<{ success: boolean; updatedName: string }> => {
      const channelId = activeChannelId || 'channel_master';
      const isMaster = channelId === 'channel_master';
      const chKeys = getChannelStorageKeys(channelId);
      const lotTag = arg.lotNumber && arg.lotNumber.trim() ? `Lot: ${arg.lotNumber.trim()}` : '';
      const extraNote = [lotTag, arg.note?.trim()].filter(Boolean).join(' | ');
      const normalizedStatus = arg.newStatus ? normalizeCheckResultStatus(arg.newStatus) : undefined;

      if (arg.targetType === 'drug') {
        let updatedName = '';
        let updatedDrugItem: DrugItem | null = null;
        const nextDrugs = drugs.map((d) => {
          if (d.id !== arg.itemId) return d;
          updatedName = d.name;
          const nextQtyNum =
            arg.newQty !== undefined && arg.newQty !== '' && !isNaN(Number(arg.newQty))
              ? Number(arg.newQty)
              : undefined;
          const mergedNote = extraNote
            ? d.note && !d.note.includes(extraNote)
              ? `${d.note} (${extraNote})`
              : extraNote
            : d.note;
          updatedDrugItem = {
            ...d,
            ...(arg.newExp ? { expDate: arg.newExp, exp: arg.newExp } : {}),
            ...(nextQtyNum !== undefined ? { remaining: nextQtyNum, totalQty: nextQtyNum } : {}),
            note: (mergedNote || '').slice(0, 950),
          };
          return updatedDrugItem;
        });

        if (!updatedDrugItem) return { success: false, updatedName: '' };
        setDrugs(nextDrugs);
        setStored(chKeys.DRUGS, nextDrugs);
        if (isMaster) setStored(STORAGE_KEYS.DRUGS, nextDrugs);
        await saveChannelDrugItemToFirebase(channelId, updatedDrugItem).catch(() => {});
        logAuditEvent({
          action: 'UPDATE_DRUG_STOCK',
          targetCollection: 'drugs',
          targetId: arg.itemId,
          details: {
            name: updatedName,
            channelId,
            newExp: arg.newExp,
            lotNumber: arg.lotNumber,
            newQty: arg.newQty,
            source: 'AuraAssistant',
          },
          currentUser,
        });
        return { success: true, updatedName };
      }

      if (arg.targetType === 'bag' || arg.targetType === 'cart') {
        const cat = arg.targetType;
        const currentList = lists[cat];
        if (!currentList?.groups) return { success: false, updatedName: '' };

        let updatedName = '';
        let matchedItemKey = '';
        let updatedEquipItem: EquipmentItem | null = null;
        const nextGroups: Record<string, EquipmentItem[]> = {};

        Object.entries(currentList.groups).forEach(([gName, gItems]) => {
          nextGroups[gName] = (gItems || []).map((it, idx) => {
            const itemKey = it.id || `${cat}_${gName}_${idx}`;
            if (itemKey === arg.itemId || it.id === arg.itemId) {
              updatedName = it.name;
              matchedItemKey = itemKey;
              const mergedNote = extraNote
                ? it.note && !it.note.includes(extraNote)
                  ? `${it.note} (${extraNote})`
                  : extraNote
                : it.note;
              updatedEquipItem = {
                ...it,
                id: it.id || itemKey,
                type: cat,
                ...(arg.newExp ? { exp: arg.newExp } : {}),
                ...(arg.newQty !== undefined && String(arg.newQty).trim() !== ''
                  ? { qty: String(arg.newQty), unitText: String(arg.newQty) }
                  : {}),
                ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
              };
              return updatedEquipItem;
            }
            return it;
          });
        });

        if (!updatedEquipItem) return { success: false, updatedName: '' };

        const updatedLists = { ...lists, [cat]: { ...currentList, groups: nextGroups } };
        setLists(updatedLists);
        setStored(getChannelListsKey(activeChannelId), updatedLists);
        if (activeChannelId === 'channel_master') {
          setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
          await saveEquipmentItemToFirebase(updatedEquipItem).catch(() => {});
        }

        let nextGlobal = globalChecks;
        if (arg.newExp || normalizedStatus || extraNote) {
          const catChecks = { ...(globalChecks[cat] || {}) };
          const existingCheck = catChecks[matchedItemKey] || { result: '', weekVals: {} };
          catChecks[matchedItemKey] = {
            ...existingCheck,
            ...(normalizedStatus ? { result: normalizedStatus } : {}),
            ...(arg.newExp ? { exp: arg.newExp } : {}),
            ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
          };
          nextGlobal = { ...globalChecks, [cat]: catChecks };
          setGlobalChecks(nextGlobal);
          setStored(getChannelChecksKey(activeChannelId), nextGlobal);
        }

        const channelPayload = { lists: updatedLists, globalChecks: nextGlobal, emergencyWeekDates };
        setStored(`anesthesia_db_${activeChannelId}`, channelPayload);
        await saveChannelDataToFirebase(activeChannelId, channelPayload).catch(() => {});
        reRenderData();

        logAuditEvent({
          action: 'EDIT_EQUIPMENT',
          targetCollection: cat,
          targetId: matchedItemKey,
          details: {
            name: updatedName,
            newExp: arg.newExp,
            lotNumber: arg.lotNumber,
            newQty: arg.newQty,
            newStatus: normalizedStatus,
          },
          currentUser,
        });

        return { success: true, updatedName };
      }

      if (arg.targetType === 'room') {
        const targetRoomId =
          arg.roomId ||
          Object.keys(equipment).find((rId) =>
            (equipment[rId] || []).some((it) => it.id === arg.itemId)
          );
        if (!targetRoomId || !equipment[targetRoomId]) return { success: false, updatedName: '' };

        let updatedName = '';
        let updatedRoomItem: EquipmentItem | null = null;
        const nextRoomItems = (equipment[targetRoomId] || []).map((it) => {
          if (it.id !== arg.itemId) return it;
          updatedName = it.name;
          const mergedNote = extraNote
            ? it.note && !it.note.includes(extraNote)
              ? `${it.note} (${extraNote})`
              : extraNote
            : it.note;
          updatedRoomItem = {
            ...it,
            roomId: targetRoomId,
            type: it.type || 'room',
            ...(arg.newExp ? { exp: arg.newExp } : {}),
            ...(arg.newQty !== undefined && String(arg.newQty).trim() !== ''
              ? { qty: String(arg.newQty), unitText: String(arg.newQty) }
              : {}),
            ...(mergedNote ? { note: mergedNote.slice(0, 950) } : {}),
          };
          return updatedRoomItem;
        });

        if (!updatedRoomItem) return { success: false, updatedName: '' };

        const nextEq = { ...equipment, [targetRoomId]: nextRoomItems };
        setEquipment(nextEq);
        setStored(chKeys.EQ, nextEq);
        if (isMaster) setStored(STORAGE_KEYS.EQ, nextEq);
        await saveChannelEquipmentItemToFirebase(channelId, updatedRoomItem).catch(() => {});

        if (normalizedStatus || arg.newExp || extraNote) {
          const roomChecks = { ...(globalChecks[targetRoomId] || {}) };
          const existingCheck = roomChecks[arg.itemId] || { result: '', weekVals: {} };
          roomChecks[arg.itemId] = {
            ...existingCheck,
            ...(normalizedStatus ? { result: normalizedStatus } : {}),
            ...(arg.newExp ? { exp: arg.newExp } : {}),
            ...(extraNote ? { note: extraNote.slice(0, 950) } : {}),
          };
          const nextGlobal = { ...globalChecks, [targetRoomId]: roomChecks };
          setGlobalChecks(nextGlobal);
          setStored(getChannelChecksKey(activeChannelId), nextGlobal);
          await saveChannelDataToFirebase(activeChannelId, {
            lists,
            globalChecks: nextGlobal,
            emergencyWeekDates,
          }).catch(() => {});
        }

        logAuditEvent({
          action: 'EDIT_EQUIPMENT',
          targetCollection: 'equipment',
          targetId: arg.itemId,
          details: {
            roomId: targetRoomId,
            name: updatedName,
            newExp: arg.newExp,
            lotNumber: arg.lotNumber,
            newQty: arg.newQty,
            newStatus: normalizedStatus,
          },
          currentUser,
        });

        return { success: true, updatedName };
      }

      return { success: false, updatedName: '' };
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
      setEquipment,
      setGlobalChecks,
      setLists,
    ]
  );

  // ⚡ Complete Smart Auto-Fill & Expiry + Min-Stock Verification Engine
  const handleAutoFillChecks = useCallback(
    async (arg: {
      items: any[];
      targetCategory?: 'bag' | 'cart' | 'drug';
      week?: number;
      onlyDiffs?: boolean;
      syncSheets?: boolean;
    }) => {
      const targetCat = arg.targetCategory || (currentView === 'cart_check' ? 'cart' : 'bag');
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
      const actualCat: 'bag' | 'cart' = targetCat === 'cart' ? 'cart' : 'bag';
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
        actualCat === 'bag' ? 'ตรวจเช็กกระเป๋าฉุกเฉิน (Auto-Fill)' : 'ตรวจเช็กรถฉุกเฉิน (Auto-Fill)';
      const newRecord: InspectionHistoryRecord = {
        id: `${actualCat}_autofill_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: actualCat,
        title: `${catTitle} สัปดาห์ที่ ${week}`,
        who: currentUser?.name || 'น้องออร่า (Aura Auto-Fill)',
        rows: (actualCat === 'bag' ? formattedBagItems : formattedCartItems).map((it: any) => ({
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
      saveInspectionToFirebase(newRecord).catch((e) => console.warn('Firebase save error:', e));

      if (arg.syncSheets !== false && apiUrl && apiUrl.trim()) {
        try {
          const uniqueSheet = `${actualCat === 'bag' ? 'กระเป๋า' : 'รถ'}_สัปดาห์${week}_${now.toISOString().split('T')[0]}`;
          await sendInspectionToGas(apiUrl, {
            type: actualCat,
            sheet: actualCat === 'bag' ? 'กระเป๋า' : 'รถ',
            sheetName: uniqueSheet,
            title: catTitle,
            location: activeChannel?.name || 'ห้องผ่าตัด OR',
            date: now.toISOString().split('T')[0],
            who: currentUser?.name || 'น้องออร่า (Aura Auto-Fill)',
            user: currentUser?.username || 'aura',
            rows: (actualCat === 'bag' ? formattedBagItems : formattedCartItems).map((it: any, idx) => ({
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
        channelId: activeChannelId || 'channel_master',
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
          channelId: activeChannelId || 'channel_master',
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
      const channelId = activeChannelId || 'channel_master';
      const isMaster = channelId === 'channel_master';
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
      const channelId = activeChannelId || 'channel_master';
      const isMaster = channelId === 'channel_master';
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
    handleAutoFillChecks,
    handleRestockRequest,
    handleAttachEquipmentPhotos,
    handleBulkImportEquipment,
  };
}
