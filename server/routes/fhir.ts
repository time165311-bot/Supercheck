import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  adminDb,
  serverDb,
  normalizeServerExpDateToIso,
  ROOT_DIR,
} from '../lib/firebaseServer';

class InsufficientStockError extends Error {
  available: number;
  requested: number;
  drugName: string;
  constructor(drugName: string, available: number, requested: number) {
    super(`สต็อกยาไม่เพียงพอ (${drugName}): คงเหลือ ${available}, ต้องการตัด ${requested}`);
    this.name = 'InsufficientStockError';
    this.available = available;
    this.requested = requested;
    this.drugName = drugName;
  }
}

const SERVER_ALIAS_GROUPS: string[][] = [
  ['adrenaline', 'epinephrine', 'อะดรีนาลีน', 'เอพิเนฟริน'],
  ['noradrenaline', 'norepinephrine', 'levophed', 'นอร์เอพิเนฟริน', 'เลโวเฟด'],
  ['dormicum', 'midazolam', 'ดอร์มิคุม', 'ไมดาโซแลม'],
  ['esmeron', 'rocuronium', 'เอสเมอรอน', 'โรโคโรเนียม'],
  ['scoline', 'succinylcholine', 'anectine', 'suxamethonium', 'สโคลีน', 'ซัคซินิลโคลีน'],
  ['diprivan', 'propofol', 'ดิปริแวน', 'โพรโพฟอล'],
  ['tracrium', 'atracurium', 'nimbex', 'cisatracurium', 'อะทราคูเรียม'],
  ['bridion', 'sugammadex', 'ซูแกมมาเด็กซ์'],
  ['marcaine', 'bupivacaine', 'xylocaine', 'lidocaine', 'ลิโดเคน', 'บูพิวาเคน'],
  ['narcan', 'naloxone', 'anexate', 'flumazenil', 'transamin', 'tranexamic', 'นาลอกโซน'],
  ['sublimaze', 'fentanyl', 'morphine', 'pethidine', 'เฟนทานิล', 'มอร์ฟีน'],
  ['zofran', 'ondansetron', 'plasil', 'metoclopramide', 'ออนแดนซีตรอน'],
  ['atropine', 'อะโทรปีน', 'อะโทรพีน'],
  ['amiodarone', 'cordarone', 'อะมิโอดาโรน'],
  ['dopamine', 'dobutamine', 'ephedrine', 'โดพามีน', 'อีเฟดรีน'],
  ['kcl', 'potassium chloride', 'โพแทสเซียมคลอไรด์'],
  ['calcium gluconate', 'แคลเซียมกลูโคเนต'],
  ['sodium bicarbonate', 'nahco3', 'โซเดียมไบคาร์บอเนต'],
  ['et tube', 'ett', 'endotracheal tube', 'ท่อช่วยหายใจ'],
  ['lma', 'laryngeal mask', 'หน้ากากกล่องเสียง'],
  ['angiocath', 'jelco', 'iv catheter', 'เข็มเปิดเส้น'],
];

const extractSizeNumbers = (text: string): string[] => {
  const matches = (text || '').match(/\d+(?:\.\d+)?/g) || [];
  return Array.from(new Set(matches.map((m) => String(parseFloat(m)))));
};

const matchFhirDrugCandidate = (
  candidates: Array<{ id: string; data: any }>,
  medicationCode?: string,
  medicationText?: string
): { id: string; data: any } | undefined => {
  const codeLower = (medicationCode || '').toLowerCase().trim();
  const nameLower = (medicationText || '').toLowerCase().trim();

  if (codeLower && codeLower !== 'unknown') {
    const byCode = candidates.find((c) => {
      const codes = [c.id, c.data?.tmtCode, c.data?.hospitalDrugCode, c.data?.barcode]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase().trim());
      return codes.includes(codeLower);
    });
    if (byCode) return byCode;
  }

  if (!nameLower) return undefined;
  const qNums = extractSizeNumbers(nameLower);

  const searchTerms = new Set<string>([nameLower]);
  for (const grp of SERVER_ALIAS_GROUPS) {
    if (grp.some((alias) => nameLower.includes(alias))) {
      grp.forEach((alias) => searchTerms.add(alias));
    }
  }

  let bestCandidate: { id: string; data: any } | undefined;
  let bestScore = 0;

  for (const c of candidates) {
    const dName = String(c.data?.name || '').toLowerCase().trim();
    const dSpec = String(c.data?.spec || '').toLowerCase().trim();
    const fullCand = `${dName} ${dSpec}`.trim();
    if (!fullCand) continue;

    if (dName === nameLower || fullCand === nameLower) {
      return c;
    }

    const cNums = extractSizeNumbers(fullCand);
    if (qNums.length > 0 && cNums.length > 0 && !qNums.some((n) => cNums.includes(n))) {
      continue;
    }

    let score = 0;
    for (const term of searchTerms) {
      if (term.length >= 3 && (fullCand.includes(term) || nameLower.includes(dName))) {
        score = Math.max(score, qNums.length > 0 && cNums.some((n) => qNums.includes(n)) ? 90 : 75);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }

  return bestCandidate;
};

const applyFefoDeductionToDrugData = (
  drugData: any,
  dispenseQty: number,
  strictStock: boolean,
  nowIso: string
) => {
  const rawLots = Array.isArray(drugData?.lots) && drugData.lots.length > 0
    ? drugData.lots
    : Array.isArray(drugData?.batches) && drugData.batches.length > 0
    ? drugData.batches
    : null;

  if (rawLots) {
    const normalizedLots = rawLots
      .map((l: any) => ({
        lotNumber: String(l?.lotNumber || 'LOT-DEFAULT').trim() || 'LOT-DEFAULT',
        expiryDate: normalizeServerExpDateToIso(l?.expiryDate) || String(l?.expiryDate || ''),
        quantity: Math.max(0, Number(l?.quantity) || 0),
        ...(l?.receivedDate ? { receivedDate: l.receivedDate } : {}),
      }))
      .sort((a: any, b: any) => (a.expiryDate || '9999-12-31').localeCompare(b.expiryDate || '9999-12-31'));

    const totalAvailable = normalizedLots.reduce((sum: number, l: any) => sum + l.quantity, 0);
    if (strictStock && totalAvailable < dispenseQty) {
      throw new InsufficientStockError(drugData?.name || 'Medication', totalAvailable, dispenseQty);
    }

    let left = dispenseQty;
    const deductedLots: Array<{ lotNumber: string; deductedQty: number; expiryDate: string }> = [];
    const nextLots = normalizedLots.map((lot: any) => {
      if (left <= 0 || lot.quantity <= 0) return lot;
      const take = Math.min(lot.quantity, left);
      left -= take;
      if (take > 0) {
        deductedLots.push({
          lotNumber: lot.lotNumber,
          deductedQty: take,
          expiryDate: lot.expiryDate,
        });
      }
      return {
        ...lot,
        quantity: Math.max(0, lot.quantity - take),
      };
    });

    const remainingAfter = nextLots.reduce((sum: number, l: any) => sum + l.quantity, 0);
    const activeLots = nextLots.filter((l: any) => l.quantity > 0);
    const earliestLot = activeLots.find((l: any) => Boolean(l.expiryDate)) || activeLots[0] || nextLots[0];
    const earliestExp = earliestLot?.expiryDate || drugData?.expDate || drugData?.exp || '';

    return {
      remainingAfter,
      deductedLots,
      updatePatch: {
        remaining: remainingAfter,
        totalQty: remainingAfter,
        lots: nextLots,
        batches: nextLots,
        expDate: earliestExp,
        exp: earliestExp,
        ...(earliestLot?.lotNumber ? { lotNumber: earliestLot.lotNumber } : {}),
        updatedAt: nowIso,
      },
    };
  }

  const currentRemaining = Math.max(0, Number(drugData?.remaining ?? drugData?.totalQty ?? 0));
  if (strictStock && currentRemaining < dispenseQty) {
    throw new InsufficientStockError(drugData?.name || 'Medication', currentRemaining, dispenseQty);
  }

  const remainingAfter = Math.max(0, currentRemaining - dispenseQty);
  return {
    remainingAfter,
    deductedLots: [
      {
        lotNumber: String(drugData?.lotNumber || 'DEFAULT'),
        deductedQty: Math.min(currentRemaining, dispenseQty),
        expiryDate: String(drugData?.expDate || drugData?.exp || ''),
      },
    ],
    updatePatch: {
      remaining: remainingAfter,
      totalQty: remainingAfter,
      updatedAt: nowIso,
    },
  };
};

const executeFirestoreDrugDispense = async (params: {
  medicationCode?: string;
  medicationText: string;
  dispenseQty: number;
  channelId?: string;
  strictStock?: boolean;
  auditEntry: any;
}) => {
  const result = {
    firestoreSynced: false,
    matchedDrugId: null as string | null,
    matchedDrugName: params.medicationText,
    remainingAfter: Math.max(0, 10 - params.dispenseQty),
    parLevel: 10,
    isLowStock: Math.max(0, 10 - params.dispenseQty) <= 3,
    deductedLots: [] as Array<{ lotNumber: string; deductedQty: number; expiryDate: string }>,
  };

  const targetChan = params.channelId && params.channelId !== 'channel_master' ? params.channelId : null;
  const safeLogId = String(params.auditEntry.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const nowIso = new Date().toISOString();

  const buildAuditPayload = () => ({
    ...params.auditEntry,
    id: safeLogId,
    targetId: result.matchedDrugId || params.auditEntry.targetId || 'UNKNOWN',
    details: {
      ...params.auditEntry.details,
      remainingAfter: result.remainingAfter,
      parLevel: result.parLevel,
      isLowStockAlert: result.isLowStock,
      matchedDrugId: result.matchedDrugId,
      matchedDrugName: result.matchedDrugName,
      deductedLots: result.deductedLots,
    },
  });

  if (adminDb) {
    try {
      const drugsCol = targetChan
        ? adminDb.collection('channels').doc(targetChan).collection('drugs')
        : adminDb.collection('drugs');

      const snap = await drugsCol.get();
      const candidates: Array<{ id: string; data: any }> = snap.docs.map((d) => ({
        id: d.id,
        data: d.data(),
      }));

      const matched = matchFhirDrugCandidate(candidates, params.medicationCode, params.medicationText);
      if (!matched && params.strictStock) {
        throw new InsufficientStockError(params.medicationText, 0, params.dispenseQty);
      }

      await adminDb.runTransaction(async (tx) => {
        if (matched) {
          const drugRef = drugsCol.doc(matched.id);
          const freshSnap = await tx.get(drugRef);
          const drugData = freshSnap.exists ? freshSnap.data() : matched.data;
          const minStock = Number(drugData?.minStock ?? 3);
          const parLevel = Number(drugData?.totalQty ?? Math.max(Number(drugData?.remaining ?? 10), minStock * 2, 10));

          const deduction = applyFefoDeductionToDrugData(
            drugData,
            params.dispenseQty,
            Boolean(params.strictStock),
            nowIso
          );

          tx.update(drugRef, deduction.updatePatch);

          result.matchedDrugId = matched.id;
          result.matchedDrugName = drugData?.name || params.medicationText;
          result.remainingAfter = deduction.remainingAfter;
          result.parLevel = parLevel;
          result.deductedLots = deduction.deductedLots;
          result.isLowStock = minStock > 0 ? deduction.remainingAfter <= minStock : deduction.remainingAfter <= 3;
        }

        tx.set(adminDb!.collection('audit_logs').doc(safeLogId), buildAuditPayload());
      });

      result.firestoreSynced = true;
      return result;
    } catch (adminErr: any) {
      if (adminErr instanceof InsufficientStockError) {
        throw adminErr;
      }
      console.warn('[FHIR] Admin SDK Firestore unavailable in current env, trying Client SDK fallback:', adminErr?.message || adminErr);
    }
  }

  if (!serverDb) return result;

  try {
    const drugsColRef = targetChan
      ? collection(serverDb, 'channels', targetChan, 'drugs')
      : collection(serverDb, 'drugs');

    const snap = await getDocs(drugsColRef);
    const candidates: Array<{ id: string; data: any }> = [];
    snap.forEach((d) => candidates.push({ id: d.id, data: d.data() }));

    const matched = matchFhirDrugCandidate(candidates, params.medicationCode, params.medicationText);
    if (!matched && params.strictStock) {
      throw new InsufficientStockError(params.medicationText, 0, params.dispenseQty);
    }

    await runTransaction(serverDb, async (tx) => {
      if (matched) {
        const drugDocRef = targetChan
          ? doc(serverDb!, 'channels', targetChan, 'drugs', matched.id)
          : doc(serverDb!, 'drugs', matched.id);

        const freshSnap = await tx.get(drugDocRef);
        const drugData = freshSnap.exists() ? freshSnap.data() : matched.data;
        const minStock = Number(drugData?.minStock ?? 3);
        const parLevel = Number(drugData?.totalQty ?? Math.max(Number(drugData?.remaining ?? 10), minStock * 2, 10));

        const deduction = applyFefoDeductionToDrugData(
          drugData,
          params.dispenseQty,
          Boolean(params.strictStock),
          nowIso
        );

        tx.update(drugDocRef, deduction.updatePatch);

        result.matchedDrugId = matched.id;
        result.matchedDrugName = drugData?.name || params.medicationText;
        result.remainingAfter = deduction.remainingAfter;
        result.parLevel = parLevel;
        result.deductedLots = deduction.deductedLots;
        result.isLowStock = minStock > 0 ? deduction.remainingAfter <= minStock : deduction.remainingAfter <= 3;
      }

      tx.set(doc(serverDb!, 'audit_logs', safeLogId), buildAuditPayload());
    });

    result.firestoreSynced = true;
  } catch (fsErr: any) {
    if (fsErr instanceof InsufficientStockError) {
      throw fsErr;
    }
    console.warn('[FHIR] Firestore sync skipped/fallback:', fsErr?.message || fsErr);
  }

  return result;
};

export function createFhirRouter(): express.Router {
  const router = express.Router();
  const dataDir = path.resolve(ROOT_DIR, 'data');
  const fhirStorePath = path.join(dataDir, 'fhir_dispense.json');

  const loadPersistedFhirHistory = (): any[] => {
    try {
      if (fs.existsSync(fhirStorePath)) {
        const parsed = JSON.parse(fs.readFileSync(fhirStorePath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[FHIR] Could not load persisted FHIR file:', e);
    }
    return [];
  };

  const savePersistedFhirHistory = (records: any[]) => {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(fhirStorePath, JSON.stringify(records.slice(0, 200), null, 2), 'utf8');
    } catch (e) {
      console.warn('[FHIR] Could not write persisted FHIR file:', e);
    }
  };

  const fhirDispenseHistory: any[] = loadPersistedFhirHistory();

  router.post('/MedicationDispense', async (req, res) => {
    try {
      const payload = req.body;
      const resourceType = payload?.resourceType || 'MedicationDispense';

      if (resourceType !== 'MedicationDispense') {
        return res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Expected resourceType to be MedicationDispense',
          }],
        });
      }

      const medicationText =
        payload.medicationCodeableConcept?.text ||
        payload.medicationCodeableConcept?.coding?.[0]?.display ||
        payload.medicationCodeableConcept?.coding?.[0]?.code ||
        'ยาฉุกเฉินไม่ระบุชื่อ';
      const medicationCode = payload.medicationCodeableConcept?.coding?.[0]?.code || 'UNKNOWN';
      const dispenseQty = Math.max(1, Number(payload.quantity?.value) || 1);
      const unit = payload.quantity?.unit || 'amp';
      const patientHn = payload.subject?.reference || payload.subject?.display || 'HN-WALK-IN';
      const patientName = payload.subject?.display || 'ผู้ป่วยฉุกเฉิน';
      const wardContext = payload.context?.display || payload.context?.reference || 'ห้องผ่าตัด OR / รถฉุกเฉิน';
      const performer = payload.performer?.[0]?.actor?.display || 'พยาบาลวิสัญญีประจำเวร';
      const reason = payload.note?.[0]?.text || 'เบิกยาฉุกเฉินตามคำสั่งแพทย์';
      const dispenseId = payload.id || `disp-${Date.now()}`;
      const channelId = payload.channelId || payload.context?.channelId || 'channel_master';
      const strictStock = Boolean(payload.strictStock);
      const now = new Date().toISOString();

      const auditEntry = {
        id: `audit_fhir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: 'HIS_FHIR_BRIDGE',
        userName: performer,
        role: 'HIS/EMR System',
        action: 'FHIR_MEDICATION_DISPENSE',
        targetCollection: 'drugs',
        targetId: medicationCode,
        details: {
          field: 'remaining',
          dispenseQty,
          unit,
          medicationName: medicationText,
          medicationCode,
          patientHn,
          patientName,
          ward: wardContext,
          channelId,
          reason,
          fhirResourceId: dispenseId,
        },
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1').slice(0, 90),
      };

      const syncRes = await executeFirestoreDrugDispense({
        medicationCode,
        medicationText,
        dispenseQty,
        channelId,
        strictStock,
        auditEntry,
      });

      auditEntry.details = {
        ...auditEntry.details,
        remainingAfter: syncRes.remainingAfter,
        parLevel: syncRes.parLevel,
        isLowStockAlert: syncRes.isLowStock,
        matchedDrugId: syncRes.matchedDrugId,
        deductedLots: syncRes.deductedLots,
      } as any;

      fhirDispenseHistory.unshift(auditEntry);
      if (fhirDispenseHistory.length > 200) fhirDispenseHistory.pop();
      savePersistedFhirHistory(fhirDispenseHistory);

      return res.status(201).json({
        resourceType: 'MedicationDispense',
        id: dispenseId,
        status: 'completed',
        firestoreSynced: syncRes.firestoreSynced,
        medicationCodeableConcept: {
          coding: [{
            system: 'https://standard.moph.go.th/tmt',
            code: medicationCode,
            display: syncRes.matchedDrugName,
          }],
          text: syncRes.matchedDrugName,
        },
        subject: { reference: patientHn, display: patientName },
        context: { display: wardContext },
        performer: [{ actor: { display: performer } }],
        quantity: { value: dispenseQty, unit },
        whenHandedOver: now,
        extension: [{
          url: 'http://anesthesiacare.local/fhir/StructureDefinition/stock-status',
          valueString: syncRes.isLowStock ? 'LOW_STOCK_ALERT' : 'NORMAL',
        }, {
          url: 'http://anesthesiacare.local/fhir/StructureDefinition/remaining-stock',
          valueInteger: syncRes.remainingAfter,
        }],
        auditLogId: auditEntry.id,
        stockStatus: {
          deducted: dispenseQty,
          deductedLots: syncRes.deductedLots,
          matchedDrugId: syncRes.matchedDrugId,
          remaining: syncRes.remainingAfter,
          parLevel: syncRes.parLevel,
          lowStockAlert: syncRes.isLowStock,
          recommendedReorder: syncRes.isLowStock ? Math.max(1, syncRes.parLevel - syncRes.remainingAfter) : 0,
        },
      });
    } catch (error: any) {
      if (error instanceof InsufficientStockError) {
        return res.status(409).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'conflict',
            diagnostics: error.message,
          }],
        });
      }
      console.error('[FHIR] Error processing MedicationDispense:', error);
      return res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'fatal',
          code: 'exception',
          diagnostics: error.message || 'Internal server error processing FHIR transaction',
        }],
      });
    }
  });

  router.get('/MedicationDispense', async (_req, res) => {
    const mergedMap = new Map<string, any>();
    fhirDispenseHistory.forEach((item) => {
      if (item?.id) mergedMap.set(item.id, item);
    });

    let loadedFromAdmin = false;
    if (adminDb) {
      try {
        const snap = await adminDb.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).get();
        snap.forEach((d) => {
          const data = d.data();
          if (
            data?.action === 'FHIR_MEDICATION_DISPENSE' ||
            data?.userId === 'HIS_FHIR_BRIDGE' ||
            data?.userId === 'HOSXP_WEBHOOK'
          ) {
            mergedMap.set(d.id, { ...data, id: d.id });
          }
        });
        loadedFromAdmin = true;
      } catch {
        // Fallback to client SDK below
      }
    }

    if (!loadedFromAdmin && serverDb) {
      try {
        const q = query(collection(serverDb, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data();
          if (
            data?.action === 'FHIR_MEDICATION_DISPENSE' ||
            data?.userId === 'HIS_FHIR_BRIDGE' ||
            data?.userId === 'HOSXP_WEBHOOK'
          ) {
            mergedMap.set(d.id, { ...data, id: d.id });
          }
        });
      } catch {
        // Use persisted JSON list on error
      }
    }

    const entries = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );

    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries.map((item) => ({
        fullUrl: `/api/fhir/MedicationDispense/${item.id}`,
        resource: item,
      })),
    });
  });

  router.post('/StockDeduction', async (req, res) => {
    try {
      const { drugId, drugName, quantity = 1, hn, patientName, nurseName, reason, ward, channelId, strictStock } = req.body || {};
      const numQty = Math.max(1, Number(quantity) || 1);
      const now = new Date().toISOString();

      const auditRecord = {
        id: `audit_his_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: 'HOSXP_WEBHOOK',
        userName: nurseName || 'พยาบาลผู้เบิกจ่าย',
        role: 'Hospital HIS',
        action: 'UPDATE_DRUG_STOCK',
        targetCollection: 'drugs',
        targetId: drugId || 'DRUG-EMER-01',
        details: {
          field: 'remaining',
          deducted: numQty,
          medicationName: drugName || 'ยาฉุกเฉิน',
          patientHn: hn || '-',
          patientName: patientName || '-',
          ward: ward || 'วอร์ดฉุกเฉิน/ห้องผ่าตัด',
          channelId: channelId || 'channel_master',
          reason: reason || 'เบิกยาฉุกเฉินใช้กับผู้ป่วย',
        },
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1').slice(0, 90),
      };

      const syncRes = await executeFirestoreDrugDispense({
        medicationCode: drugId,
        medicationText: drugName || 'ยาฉุกเฉิน',
        dispenseQty: numQty,
        channelId,
        strictStock: Boolean(strictStock),
        auditEntry: auditRecord,
      });

      fhirDispenseHistory.unshift(auditRecord);
      if (fhirDispenseHistory.length > 200) fhirDispenseHistory.pop();
      savePersistedFhirHistory(fhirDispenseHistory);

      return res.json({
        success: true,
        firestoreSynced: syncRes.firestoreSynced,
        matchedDrugId: syncRes.matchedDrugId,
        remainingAfter: syncRes.remainingAfter,
        deductedLots: syncRes.deductedLots,
        lowStockAlert: syncRes.isLowStock,
        message: 'Stock deduction successfully recorded via HIS Webhook',
        auditLog: auditRecord,
      });
    } catch (err: any) {
      if (err instanceof InsufficientStockError) {
        return res.status(409).json({ success: false, error: 'INSUFFICIENT_STOCK', message: err.message });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/schema', (_req, res) => {
    res.json({
      standard: 'HL7 FHIR Release 4 (R4)',
      version: '4.0.1',
      targetApp: 'Anesthesia Care & Emergency Cart Automation',
      endpoints: [
        {
          path: '/api/fhir/MedicationDispense',
          method: 'POST',
          description: 'Auto-deduct emergency cart stock when medication is dispensed in hospital HIS/EMR',
          payloadSchema: {
            resourceType: 'MedicationDispense',
            status: 'completed',
            medicationCodeableConcept: {
              coding: [{ system: 'http://hospital-his.local/tmt', code: 'string', display: 'string' }],
              text: 'string (ชื่อยา)',
            },
            subject: { reference: 'Patient/HN...', display: 'ชื่อ-สกุล ผู้ป่วย' },
            context: { display: 'ห้องผ่าตัด OR / รถฉุกเฉิน' },
            performer: [{ actor: { display: 'ชื่อผู้เบิก/พยาบาล' } }],
            quantity: { value: 1, unit: 'amp' },
            whenHandedOver: 'ISO-8601 Timestamp',
            note: [{ text: 'เหตุผลการเบิกยา' }],
          },
        },
        {
          path: '/api/fhir/StockDeduction',
          method: 'POST',
          description: 'Simplified REST Webhook for HOSxP and Infostat',
          samplePayload: {
            drugId: 'ATROPINE-01',
            drugName: 'Atropine 0.6 mg',
            quantity: 2,
            hn: '6901234',
            patientName: 'นายทดสอบ รักษาดี',
            nurseName: 'พว. นารี วิสัญญี',
            ward: 'OR-1',
            reason: 'CPR Stat Case',
          },
        },
      ],
    });
  });

  return router;
}
