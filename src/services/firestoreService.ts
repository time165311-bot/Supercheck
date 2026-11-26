import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, ensureWardWorkspaceInitialized, sanitizeForFirestore } from './firebase';
import {
  DrugItem,
  DrugLotBatch,
  EquipmentItem,
  RestockRequisition,
  RestockRequisitionItem,
  RestockRequisitionStatus,
  User,
} from '../types';
import { getBangkokTodayIso, normalizeExpDateToIso } from '../utils/dateUtils';
import { findFuzzyDrugOrItemMatches, recomputeDrugFromLots } from '../utils/itemUtils';
import { getActiveWardIdFromStorage, resolveWardId } from '../utils/wardUtils';

function getDrugsCollectionPath(wardId?: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  return collection(db, 'wards', resolved, 'drugs');
}

function getDrugDocRef(wardId: string | undefined, drugId: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  return doc(db, 'wards', resolved, 'drugs', drugId);
}

function getRequisitionsCollectionRef(wardId?: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  return collection(db, 'wards', resolved, 'restock_requisitions');
}

function getRequisitionDocRef(wardId: string | undefined, reqId: string) {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  return doc(db, 'wards', resolved, 'restock_requisitions', reqId);
}

/**
 * Checks whether a user has privilege to approve/reject stock requisitions.
 * Allowed: Admin, Head Anesthesia Nurse (หัวหน้า), Pharmacist (เภสัช), Anesthesiologist (วิสัญญีแพทย์).
 */
export function canApproveRequisition(user?: User | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const pos = (user.position || user.name || '').toLowerCase();
  return (
    pos.includes('หัวหน้า') ||
    pos.includes('เภสัช') ||
    pos.includes('วิสัญญีแพทย์') ||
    pos.includes('pharmacist') ||
    pos.includes('head') ||
    pos.includes('admin')
  );
}

/**
 * Granular single-item equipment field/patch update under wards/{wardId}/equipment/{itemId}.
 */
export async function saveChannelEquipmentPatch(
  wardId: string,
  itemId: string,
  patch: Partial<EquipmentItem>
): Promise<boolean> {
  try {
    const resolved = resolveWardId(wardId);
    await ensureWardWorkspaceInitialized(resolved);
    const ref = doc(db, 'wards', resolved, 'equipment', itemId);
    const payload = sanitizeForFirestore({
      ...patch,
      id: itemId,
      wardId: resolved,
      channelId: resolved,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[firestoreService] saveChannelEquipmentPatch failed:', err);
    return false;
  }
}

/**
 * Granular single-drug update under wards/{wardId}/drugs/{drugId}.
 */
export async function saveDrugPatch(
  wardId: string | undefined,
  drugId: string,
  patch: Partial<DrugItem>
): Promise<boolean> {
  try {
    const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
    await ensureWardWorkspaceInitialized(resolved);
    const ref = getDrugDocRef(resolved, drugId);
    const payload = sanitizeForFirestore({
      ...patch,
      id: drugId,
      wardId: resolved,
      channelId: resolved,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[firestoreService] saveDrugPatch failed:', err);
    return false;
  }
}

/**
 * Merges remote ward data cleanly without discarding valid local lists/checks.
 */
export function mergeRemoteChannelData<T extends Record<string, any>>(
  localData: T,
  remoteData: Partial<T> | null | undefined
): T {
  if (!remoteData || typeof remoteData !== 'object') return localData;
  return {
    ...localData,
    ...remoteData,
    lists: {
      ...(localData.lists || {}),
      ...(remoteData.lists || {}),
    },
    globalChecks: {
      ...(localData.globalChecks || {}),
      ...(remoteData.globalChecks || {}),
    },
    emergencyWeekDates: {
      ...(localData.emergencyWeekDates || {}),
      ...(remoteData.emergencyWeekDates || {}),
    },
  };
}

// --- RESTOCK REQUISITION WORKFLOW (draft -> pending -> approved -> received | rejected) ---

export async function fetchRestockRequisitions(wardId?: string): Promise<RestockRequisition[]> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    const q = query(getRequisitionsCollectionRef(resolved), where('wardId', '==', resolved));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as RestockRequisition))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export function subscribeRestockRequisitions(
  wardId: string | undefined,
  callback: (items: RestockRequisition[]) => void
): () => void {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  try {
    const q = query(getRequisitionsCollectionRef(resolved), where('wardId', '==', resolved));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as RestockRequisition))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(list);
      },
      (err) => {
        console.warn('[firestoreService] Requisitions listener fallback:', err?.message || err);
      }
    );
  } catch {
    return () => {};
  }
}

export async function saveRestockRequisitionWorkflow(
  req: RestockRequisition
): Promise<boolean> {
  try {
    const resolved = resolveWardId((req as any).wardId || req.channelId || getActiveWardIdFromStorage());
    await ensureWardWorkspaceInitialized(resolved);
    const ref = getRequisitionDocRef(resolved, req.id);
    const clean = sanitizeForFirestore({
      ...req,
      wardId: resolved,
      channelId: resolved,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, clean, { merge: true });
    return true;
  } catch (err) {
    console.warn('[firestoreService] saveRestockRequisitionWorkflow failed:', err);
    return false;
  }
}

const ALLOWED_TRANSITIONS: Record<RestockRequisitionStatus, RestockRequisitionStatus[]> = {
  draft: ['pending', 'rejected'],
  pending: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: [],
  rejected: ['draft', 'pending'],
};

export async function transitionRestockRequisitionStatus(params: {
  channelId?: string;
  reqId: string;
  nextStatus: RestockRequisitionStatus;
  actor: User | null;
  rejectedReason?: string;
  itemsPatch?: RestockRequisitionItem[];
}): Promise<{ ok: boolean; error?: string }> {
  const { channelId, reqId, nextStatus, actor, rejectedReason, itemsPatch } = params;
  const resolved = resolveWardId(channelId || getActiveWardIdFromStorage());

  if ((nextStatus === 'approved' || nextStatus === 'rejected') && !canApproveRequisition(actor)) {
    return {
      ok: false,
      error: 'เฉพาะผู้ดูแลระบบ หัวหน้าพยาบาลวิสัญญี หรือเภสัชกรเท่านั้นที่สามารถอนุมัติ/ปฏิเสธใบเบิกได้',
    };
  }

  try {
    await ensureWardWorkspaceInitialized(resolved);
    const reqRef = getRequisitionDocRef(resolved, reqId);
    const nowIso = new Date().toISOString();

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(reqRef);
      if (!snap.exists()) {
        throw new Error('ไม่พบเอกสารใบเบิกในระบบ');
      }
      const current = snap.data() as RestockRequisition;
      const currentStatus = current.status || 'draft';

      if (currentStatus === 'received') {
        throw new Error('ใบเบิกนี้ถูกรับเข้าคลังแล้ว ไม่สามารถแก้ไขสถานะย้อนหลังได้');
      }

      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        throw new Error(`ไม่สามารถเปลี่ยนสถานะจาก ${currentStatus} เป็น ${nextStatus} ได้`);
      }

      const updatePayload: Record<string, any> = {
        status: nextStatus,
        wardId: resolved,
        updatedAt: nowIso,
      };
      if (itemsPatch) {
        updatePayload.items = itemsPatch;
      }
      if (nextStatus === 'approved') {
        updatePayload.approvedBy = actor?.name || actor?.username || 'ผู้อนุมัติ';
        updatePayload.approvedAt = nowIso;
      } else if (nextStatus === 'rejected') {
        updatePayload.rejectedReason = rejectedReason || 'ไม่อนุมัติรายการ';
        updatePayload.approvedBy = actor?.name || actor?.username || 'ผู้อนุมัติ';
        updatePayload.approvedAt = nowIso;
      }

      tx.update(reqRef, sanitizeForFirestore(updatePayload));

      const auditId = `audit_req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(
        doc(db, 'wards', resolved, 'audit_logs', auditId),
        sanitizeForFirestore({
          id: auditId,
          wardId: resolved,
          timestamp: nowIso,
          userId: actor?.id || 'usr_ward_staff',
          userName: actor?.name || 'เจ้าหน้าที่',
          role: actor?.role || 'user',
          action:
            nextStatus === 'approved'
              ? 'REQUISITION_APPROVED'
              : nextStatus === 'rejected'
              ? 'REQUISITION_REJECTED'
              : 'REQUISITION_SUBMITTED',
          targetCollection: 'restock_requisitions',
          targetId: reqId,
          details: {
            fromStatus: currentStatus,
            toStatus: nextStatus,
            wardId: resolved,
            channelId: resolved,
            rejectedReason: rejectedReason || undefined,
          },
        })
      );
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะใบเบิก' };
  }
}

/**
 * Atomic Firestore Transaction for receiving an approved requisition into ward drug stock.
 */
export async function receiveRestockRequisitionTransaction(params: {
  channelId?: string;
  reqId: string;
  receivedItems: RestockRequisitionItem[];
  currentDrugs: DrugItem[];
  actor: User | null;
}): Promise<{ ok: boolean; error?: string; updatedDrugs: DrugItem[] }> {
  const { channelId, reqId, receivedItems, currentDrugs, actor } = params;
  const resolved = resolveWardId(channelId || getActiveWardIdFromStorage());
  const reqRef = getRequisitionDocRef(resolved, reqId);
  const nowIso = new Date().toISOString();
  const todayIso = getBangkokTodayIso();

  try {
    await ensureWardWorkspaceInitialized(resolved);
    const resolvedDrugPatches: Array<{ drugId: string; item: RestockRequisitionItem; matched?: DrugItem }> =
      receivedItems.map((item) => {
        let matched = item.drugId ? currentDrugs.find((d) => d.id === item.drugId) : undefined;
        if (!matched) {
          const fuzzy = findFuzzyDrugOrItemMatches(item.name, currentDrugs, {
            getName: (d) => d.name,
            getSpec: (d) => d.spec || d.unit || '',
            getCodes: (d) => [d.tmtCode, d.hospitalDrugCode, d.barcode, d.id],
            minScore: 55,
          });
          matched = fuzzy[0]?.item;
        }
        return {
          drugId: matched?.id || item.drugId || '',
          item,
          matched,
        };
      });

    const updatedMap = new Map<string, DrugItem>();

    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) {
        throw new Error('ไม่พบใบเบิกในระบบ');
      }
      const reqData = reqSnap.data() as RestockRequisition;
      if (reqData.status !== 'approved') {
        throw new Error(
          reqData.status === 'received'
            ? 'ใบเบิกนี้ได้บันทึกรับเข้าคลังไปแล้ว'
            : 'ใบเบิกต้องผ่านการอนุมัติ (approved) ก่อนจึงจะรับเข้าคลังได้'
        );
      }

      const drugSnapshots = new Map<
        string,
        { ref: ReturnType<typeof getDrugDocRef>; existing: DrugItem | null }
      >();
      for (const entry of resolvedDrugPatches) {
        if (!entry.drugId || drugSnapshots.has(entry.drugId)) continue;
        const dRef = getDrugDocRef(resolved, entry.drugId);
        const dSnap = await tx.get(dRef);
        drugSnapshots.set(entry.drugId, {
          ref: dRef,
          existing: dSnap.exists()
            ? ({ ...(dSnap.data() as DrugItem), id: dSnap.id })
            : (entry.matched || null),
        });
      }

      const stockAuditSummary: Array<{
        drugId: string;
        name: string;
        addedQty: number;
        newTotal: number;
        lotNumber: string;
      }> = [];

      for (const entry of resolvedDrugPatches) {
        const recvQty = Math.max(
          0,
          Number(entry.item.receivedQty ?? entry.item.approvedQty ?? entry.item.neededQty ?? 0) || 0
        );
        if (!entry.drugId || recvQty <= 0) continue;

        const snapHolder = drugSnapshots.get(entry.drugId);
        const baseDrug = updatedMap.get(entry.drugId) || snapHolder?.existing || entry.matched;
        if (!baseDrug || !snapHolder) continue;

        const lotNo = String(entry.item.lotNumber || `LOT-${todayIso.replace(/-/g, '')}`).trim();
        const expIso =
          normalizeExpDateToIso(entry.item.expiryDate) || baseDrug.expDate || baseDrug.exp || '';

        const existingLots: DrugLotBatch[] =
          Array.isArray(baseDrug.lots) && baseDrug.lots.length > 0
            ? [...baseDrug.lots]
            : baseDrug.remaining > 0
            ? [
                {
                  lotNumber: baseDrug.lotNumber || 'LOT-EXISTING',
                  expiryDate:
                    normalizeExpDateToIso(baseDrug.expDate || baseDrug.exp) || baseDrug.expDate || '',
                  quantity: Math.max(0, Number(baseDrug.remaining ?? baseDrug.totalQty ?? 0) || 0),
                  receivedDate: baseDrug.receivedDate || undefined,
                },
              ]
            : [];

        const existingLotIdx = existingLots.findIndex(
          (l) => l.lotNumber === lotNo && (l.expiryDate || '') === (expIso || '')
        );

        if (existingLotIdx >= 0) {
          existingLots[existingLotIdx] = {
            ...existingLots[existingLotIdx],
            quantity: existingLots[existingLotIdx].quantity + recvQty,
            receivedDate: todayIso,
          };
        } else {
          existingLots.push({
            lotNumber: lotNo,
            expiryDate: expIso,
            quantity: recvQty,
            receivedDate: todayIso,
          });
        }

        const recomputed = recomputeDrugFromLots({
          ...baseDrug,
          lots: existingLots,
          batches: existingLots,
          receivedDate: todayIso,
          receivedQty: recvQty,
          updatedAt: nowIso,
          channelId: resolved,
        });

        updatedMap.set(entry.drugId, recomputed);
        tx.set(
          snapHolder.ref,
          sanitizeForFirestore({ ...recomputed, wardId: resolved }),
          { merge: true }
        );

        stockAuditSummary.push({
          drugId: entry.drugId,
          name: recomputed.name,
          addedQty: recvQty,
          newTotal: recomputed.remaining,
          lotNumber: lotNo,
        });
      }

      tx.set(
        reqRef,
        sanitizeForFirestore({
          status: 'received',
          wardId: resolved,
          items: receivedItems,
          receivedBy: actor?.name || actor?.username || 'ผู้รับเข้าคลัง',
          receivedAt: nowIso,
          updatedAt: nowIso,
        }),
        { merge: true }
      );

      const auditId = `audit_recv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(
        doc(db, 'wards', resolved, 'audit_logs', auditId),
        sanitizeForFirestore({
          id: auditId,
          wardId: resolved,
          timestamp: nowIso,
          userId: actor?.id || 'usr_ward_staff',
          userName: actor?.name || 'เจ้าหน้าที่',
          role: actor?.role || 'user',
          action: 'REQUISITION_RECEIVED',
          targetCollection: 'restock_requisitions',
          targetId: reqId,
          details: {
            wardId: resolved,
            channelId: resolved,
            receivedItemsCount: stockAuditSummary.length,
            stockChanges: stockAuditSummary,
          },
        })
      );
    });

    const nextDrugs = currentDrugs.map((d) => updatedMap.get(d.id) || d);
    return { ok: true, updatedDrugs: nextDrugs };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'ไม่สามารถรับเข้าคลังแบบ Transaction ได้',
      updatedDrugs: currentDrugs,
    };
  }
}

export async function ensureChannelDrugsCollectionExists(wardId?: string): Promise<number> {
  const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
  const snap = await getDocs(
    query(getDrugsCollectionPath(resolved), where('wardId', '==', resolved))
  );
  return snap.size;
}

export async function markRequisitionField(
  wardId: string | undefined,
  reqId: string,
  patch: Partial<RestockRequisition>
): Promise<boolean> {
  try {
    const resolved = resolveWardId(wardId || getActiveWardIdFromStorage());
    await updateDoc(
      getRequisitionDocRef(resolved, reqId),
      sanitizeForFirestore({ ...patch, wardId: resolved, updatedAt: new Date().toISOString() })
    );
    return true;
  } catch {
    return false;
  }
}
