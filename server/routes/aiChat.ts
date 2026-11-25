import express from 'express';
import { ThinkingLevel, Type } from '@google/genai';
import {
  createServerGeminiClient,
  getServerGeminiKey,
  withAbortTimeout,
  withChildAbortTimeout,
} from '../lib/firebaseServer';

interface CompactInventoryEntry {
  id: string;
  name: string;
  quantity: number | string;
  minQuantity: number | string;
  expiryDate: string;
  location: string;
}

export interface ChatAttachmentPayload {
  index?: number;
  base64?: string;
  data?: string;
  mimeType?: string;
  fileName?: string;
}

export interface CompactEquipmentEntry {
  id: string;
  no: string;
  code: string;
  sap: string;
  name: string;
  location: string;
  roomId: string;
}

export function extractEquipmentCatalog(rawContext: any): CompactEquipmentEntry[] {
  if (!rawContext || typeof rawContext !== 'object') return [];
  const rawEq = rawContext.equipment;
  if (!rawEq) return [];

  const list: CompactEquipmentEntry[] = [];
  const seenIds = new Set<string>();

  const pushItem = (eq: any, fallbackRoomId = '', fallbackSeq = 1) => {
    if (!eq || typeof eq !== 'object') return;
    const name = String(eq.name || '').trim();
    if (!name) return;
    const id = String(eq.id || `${fallbackRoomId || 'eq'}_${fallbackSeq}`);
    if (seenIds.has(id)) return;
    seenIds.add(id);
    const code = String(eq.code || '').trim();
    const sap = String(eq.sap || '').trim();
    const location = String(eq.location || (fallbackRoomId ? fallbackRoomId.toUpperCase() : '')).trim();
    const roomId = String(eq.roomId || fallbackRoomId || '').trim();
    const entry: any = {
      id,
      no: String(eq.no ?? eq.orderNumber ?? fallbackSeq),
      name,
    };
    if (eq.orderNumber) entry.orderNumber = String(eq.orderNumber);
    if (code) entry.code = code;
    if (sap) entry.sap = sap;
    if (location) entry.location = location;
    if (roomId) entry.roomId = roomId;
    list.push(entry);
  };

  if (Array.isArray(rawContext.equipmentSummary)) {
    rawContext.equipmentSummary.forEach((eq: any, idx: number) => {
      pushItem(eq, String(eq?.room || eq?.roomId || ''), idx + 1);
    });
  }

  if (Array.isArray(rawEq)) {
    rawEq.forEach((eq, idx) => pushItem(eq, String(eq?.roomId || ''), idx + 1));
  } else if (typeof rawEq === 'object') {
    let seq = 1;
    Object.entries(rawEq).forEach(([roomId, items]) => {
      if (Array.isArray(items)) {
        items.forEach((eq) => {
          pushItem(eq, roomId, seq);
          seq++;
        });
      }
    });
  }

  return list.slice(0, 300);
}

export function extractDrugsCatalog(rawContext: any) {
  if (!rawContext || typeof rawContext !== 'object' || !Array.isArray(rawContext.drugs)) return [];
  return rawContext.drugs
    .filter((d: any) => d && typeof d === 'object' && String(d.name || '').trim())
    .map((d: any) => {
      const spec = String(d.spec || '').trim();
      const note = String(d.note || '').trim().slice(0, 80);
      const entry: Record<string, any> = {
        id: String(d.id || ''),
        name: String(d.name || '').trim(),
        rem: d.remaining ?? d.totalQty ?? d.quantity ?? 0,
        min: d.minStock ?? d.minQuantity ?? 0,
        unit: String(d.unit || 'ชิ้น'),
        exp: String(d.expDate || d.expiryDate || d.exp || '-'),
        loc: String(d.location || 'คลังยาวิสัญญี'),
      };
      if (spec) entry.spec = spec;
      if (note) entry.note = note;
      return entry;
    });
}

export function extractEmergencyCatalog(rawContext: any, key: 'bags' | 'carts' | 'ambulances') {
  if (!rawContext || typeof rawContext !== 'object' || !Array.isArray(rawContext[key])) return [];
  const defaultLoc =
    key === 'bags' ? 'กระเป๋าฉุกเฉิน' : key === 'ambulances' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน';
  return rawContext[key]
    .filter((it: any) => it && typeof it === 'object' && String(it.name || '').trim())
    .map((it: any) => {
      const spec = String(it.spec || '').trim();
      const note = String(it.note || '').trim().slice(0, 80);
      const entry: Record<string, any> = {
        id: String(it.id || ''),
        name: String(it.name || '').trim(),
        qty: it.qty ?? it.quantity ?? '1',
        exp: String(it.exp || it.expiryDate || '-'),
        loc: String(it.location || defaultLoc),
        status: String(it.status || 'รอตรวจ'),
      };
      if (it.no) entry.no = String(it.no);
      if (it.groupName) entry.groupName = String(it.groupName);
      if (spec) entry.spec = spec;
      if (note) entry.note = note;
      return entry;
    });
}

/**
 * Compresses raw inventory / context payloads so only compact essential fields
 * (id, name, quantity, minQuantity, expiryDate, location) are injected into the prompt.
 */
export function compactInventoryForPrompt(rawContext: any): Record<string, any> {
  if (!rawContext || typeof rawContext !== 'object') {
    return { status: 'ไม่มีข้อมูลสรุปสด' };
  }

  const pickCompactEntry = (item: any, fallbackLocation = ''): CompactInventoryEntry | null => {
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name || item.itemName || '').trim();
    if (!name) return null;
    return {
      id: String(item.id || item.itemId || ''),
      name,
      quantity: item.quantity ?? item.remaining ?? item.totalQty ?? item.qty ?? '-',
      minQuantity: item.minQuantity ?? item.minStock ?? '-',
      expiryDate: String(item.expiryDate || item.expDate || item.exp || '-'),
      location: String(item.location || item.locationLabel || fallbackLocation || '-'),
    };
  };

  const compact: Record<string, any> = {};
  if (rawContext.currentView) compact.currentView = rawContext.currentView;
  if (rawContext.totalDrugs !== undefined) compact.totalDrugs = rawContext.totalDrugs;
  if (rawContext.totalEquipment !== undefined) compact.totalEquipment = rawContext.totalEquipment;
  if (rawContext.bagCheckedRatio) compact.bagCheckedRatio = rawContext.bagCheckedRatio;
  if (rawContext.cartCheckedRatio) compact.cartCheckedRatio = rawContext.cartCheckedRatio;
  if (rawContext.ambulanceCheckedRatio) compact.ambulanceCheckedRatio = rawContext.ambulanceCheckedRatio;
  if (rawContext.grandTotal !== undefined) compact.grandTotal = rawContext.grandTotal;
  if (rawContext.grandDefective !== undefined) compact.grandDefective = rawContext.grandDefective;
  if (rawContext.summaryText) compact.summaryText = String(rawContext.summaryText).slice(0, 1000);

  const inventoryList: CompactInventoryEntry[] = [];

  if (Array.isArray(rawContext.inventory)) {
    rawContext.inventory.slice(0, 60).forEach((it: any) => {
      const entry = pickCompactEntry(it);
      if (entry) inventoryList.push(entry);
    });
  }
  if (Array.isArray(rawContext.drugs)) {
    rawContext.drugs.slice(0, 40).forEach((d: any) => {
      const entry = pickCompactEntry(d, 'คลังยา');
      if (entry) inventoryList.push(entry);
    });
  }
  if (Array.isArray(rawContext.expiringSoonOrExpired)) {
    rawContext.expiringSoonOrExpired.slice(0, 15).forEach((d: any) => {
      const entry = pickCompactEntry(d, 'ใกล้หมดอายุ');
      if (entry) inventoryList.push(entry);
    });
  }
  if (Array.isArray(rawContext.lowStock)) {
    rawContext.lowStock.slice(0, 15).forEach((d: any) => {
      const entry = pickCompactEntry(d, 'สต็อกต่ำ');
      if (entry) inventoryList.push(entry);
    });
  }
  if (Array.isArray(rawContext.damagedEquipment)) {
    rawContext.damagedEquipment.slice(0, 15).forEach((eq: any) => {
      const entry = pickCompactEntry(eq, eq.location || 'ชำรุด');
      if (entry) inventoryList.push(entry);
    });
  }

  if (inventoryList.length > 0) {
    const seen = new Set<string>();
    compact.inventory = inventoryList.filter((item) => {
      const key = `${item.id}|${item.name}|${item.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 60);
  }

  return compact;
}

function stripMarkdownFences(rawText: string): string {
  return rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/g, '')
    .trim();
}

function extractCleanAttachmentPart(
  attachment?: ChatAttachmentPayload | null,
  fallbackIndex = 0
): {
  index: number;
  inlineData: { data: string; mimeType: string };
  fileName?: string;
} | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const rawBase64 = String(attachment.base64 || attachment.data || '').trim();
  if (!rawBase64) return null;

  const dataUrlMatch = rawBase64.match(/^data:([^;]+);base64,/i);
  const resolvedMimeType = (
    attachment.mimeType ||
    dataUrlMatch?.[1] ||
    'image/jpeg'
  ).trim();
  const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/i, '').trim();
  if (!cleanBase64) return null;

  return {
    index: typeof attachment.index === 'number' && !Number.isNaN(attachment.index) ? attachment.index : fallbackIndex,
    inlineData: {
      data: cleanBase64,
      mimeType: resolvedMimeType,
    },
    fileName: attachment.fileName,
  };
}

function isClinicalWebQuery(msg: string): boolean {
  const q = (msg || '').toLowerCase();
  return /(แนวทาง|guideline|acls|pals|dose|mg\/kg|ขนาดยา|คำนวณ|เจือจาง|ผสมยา|ข้อห้าม|ปฏิกิริยา|ค้นหาข้อมูล|งานวิจัย|ล่าสุด|google)/i.test(q);
}

function isLikelyActionCommand(msg: string): boolean {
  const q = (msg || '').toLowerCase();
  return /(ล้าง|เคลียร์|ลบ|สั่งลบ|เอา.*ออก|เอาออก|รีเซ็ต|reset|clear|delete|remove|wipe|empty|เริ่มใหม่|ไปหน้า|เปิดหน้า|เปิดคลัง|เปลี่ยนหน้า|เทียบใบ|ตรวจกระดาษ|สรุปส่งเวร|shift\s*handover|อัปเดต|แก้ไข|แก้จำนวน|แก้ชื่อ|ปรับสถานะ|แจ้งชำรุด|ชำรุด|ซ่อม|สร้างใบเบิก|ขอเบิก|เบิกเพิ่ม|นำทาง|navigate|เพิ่มรายการ|เพิ่ม|บันทึกข้อมูล|เช็กครบ|ติ๊กครบ|ย้าย|เปลี่ยนห้อง|ส่งออก|รายงาน|pdf|sheet|excel|รถพยาบาล|ambulance)/i.test(q);
}

const textChatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'คำตอบภาษาไทยที่สุภาพ น่ารัก กระชับ และเป็นประโยชน์ต่อพยาบาลวิสัญญี (ใช้ ✨🌸 ตามความเหมาะสม)',
    },
    choices: {
      type: Type.ARRAY,
      description: 'ตัวเลือกคำสั่งด่วนต่อเนื่อง 2-3 ข้อสำหรับแสดงเป็นปุ่มลัดในแชต',
      items: { type: Type.STRING },
    },
  },
  required: ['reply', 'choices'],
};

const chatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'คำตอบภาษาไทยที่สุภาพ น่ารัก กระชับ และเป็นประโยชน์ต่อพยาบาลวิสัญญี (ใช้ ✨🌸 ตามความเหมาะสม)',
    },
    choices: {
      type: Type.ARRAY,
      description: 'ตัวเลือกคำสั่งด่วนต่อเนื่อง 2-3 ข้อสำหรับแสดงเป็นปุ่มลัดในแชต',
      items: { type: Type.STRING },
    },
    action: {
      type: Type.OBJECT,
      description: 'Action อัตโนมัติ (ใส่เมื่อผู้ใช้สั่งดำเนินการเช่น MATCH_EQUIPMENT_PHOTOS, ATTACH_EQUIPMENT_PHOTOS, BULK_IMPORT_EQUIPMENT หรือ AUTO_FILL_CHECKS)',
      properties: {
        type: {
          type: Type.STRING,
          description: 'ชื่อ Action ได้แก่ MATCH_EQUIPMENT_PHOTOS, ATTACH_EQUIPMENT_PHOTOS, BULK_IMPORT_EQUIPMENT หรือ AUTO_FILL_CHECKS (ละเว้นได้หากเป็นการถาม-ตอบทั่วไป)',
        },
        mappings: {
          type: Type.ARRAY,
          description: 'รายการจับคู่รูปภาพ (ตาม index 0, 1, 2...) กับรายการครุภัณฑ์ใน context.equipment (ใช้สำหรับ MATCH_EQUIPMENT_PHOTOS หรือ ATTACH_EQUIPMENT_PHOTOS)',
          items: {
            type: Type.OBJECT,
            properties: {
              imageIndex: { type: Type.INTEGER, description: 'ลำดับ index ของภาพ (0, 1, 2...)' },
              equipmentId: { type: Type.STRING, description: 'ค่า id ของครุภัณฑ์จาก context.equipment (หรือ "" หากไม่พบ)' },
              orderNumber: { type: Type.STRING, description: 'หมายเลขลำดับที่อ่านได้จากภาพ (เช่น "35", "12")' },
              detectedNumber: { type: Type.STRING, description: 'ตัวเลขหรือรหัสที่อ่านได้จากภาพ' },
              equipmentName: { type: Type.STRING, description: 'ชื่อครุภัณฑ์ที่จับคู่ได้ (หรือ "" หากไม่พบ)' },
              unmatched: { type: Type.BOOLEAN, description: 'true หากอ่านตัวเลขไม่ชัดหรือไม่พบในระบบ' },
              reason: { type: Type.STRING, description: 'เหตุผลกรณี unmatched' },
            },
            required: ['imageIndex'],
          },
        },
        equipmentItems: {
          type: Type.ARRAY,
          description: 'รายการครุภัณฑ์ทั้งหมดที่สกัดได้จากรูปตารางทะเบียนครุภัณฑ์ (ใช้สำหรับ BULK_IMPORT_EQUIPMENT) ต้องตรวจทิศทางหัวตารางและไล่อ่านทีละบรรทัดตามแนวนอน (Row-by-Row) ครบทุกแถวห้ามข้ามแถวที่มีรอยขีดฆ่า กากบาท X หรือชื่อซ้ำกันเด็ดขาด',
          items: {
            type: Type.OBJECT,
            properties: {
              seq: { type: Type.STRING, description: 'ลำดับที่ (ตัวเลขคอลัมน์ซ้ายสุดของตาราง เช่น "1", "32", "91")' },
              asset_number: { type: Type.STRING, description: 'หมายเลขพัสดุ (คอลัมน์ที่ 2 เช่น "6515-001-0001รพ.07-2/40(1.6)(5.6)" รวมรหัส HANA ต่อท้ายถ้ามี — ห้ามนำรหัส SAP 12 หลักมาใส่ในช่องนี้)' },
              sap_code: { type: Type.STRING, description: 'รหัสสินทรัพย์ SAP (คอลัมน์ที่ 3 ตัวเลข 12 หลัก เช่น "332280003503" ถ้าช่องนี้ว่างให้ใส่ "")' },
              name: { type: Type.STRING, description: 'รายการ (คอลัมน์ที่ 4 ชื่อครุภัณฑ์พิมพ์ตัวบรรจงเท่านั้น ห้ามนำลายมือปากกามาปนกับชื่อรายการหลัก)' },
              brand_model: { type: Type.STRING, description: 'มาตรฐานและคุณลักษณะเฉพาะ (คอลัมน์ที่ 5 ยี่ห้อ, รุ่น, S/N)' },
              source_budget: { type: Type.STRING, description: 'แหล่งเงินที่ได้มา (คอลัมน์ที่ 6 เช่น กองทุนบริการ, บริจาค, งบประมาณแผ่นดิน ถ้าว่างใส่ "")' },
              acquired_date: { type: Type.STRING, description: 'ว/ด/ป ที่ได้มา (คอลัมน์ที่ 7 เช่น "20 ก.ย. 65" ถ้าว่างใส่ "")' },
              quantity: { type: Type.STRING, description: 'จำนวนตามบัญชี (คอลัมน์ที่ 8 เช่น "1")' },
              price: { type: Type.STRING, description: 'ราคา (คอลัมน์ที่ 10 ตัวเลขจำนวนเงิน เอาคอมม่าออก เช่น "125000")' },
              location_official: { type: Type.STRING, description: 'สถานที่ตั้งตามพิมพ์ (คอลัมน์ที่ 11 เช่น "ตึก 15 ชั้น 3 ห้อง OR 3" หรือ "ห้องทำงาน")' },
              handwritten_note: { type: Type.STRING, description: 'ข้อความลายมือปากกาที่เขียนเพิ่มเติมในแถวนั้น (เช่น "OR1", "OR2", "OR3", "ห้องพักฟื้น", "ให้ยืม", "ส่งคืน 25/8/66", "เราเบิกชื่อ", "ไม่ทำงาน") — ห้ามปนกับชื่อรายการหลัก' },
              is_marked_x: { type: Type.BOOLEAN, description: 'true หากช่องลำดับที่หรือแถวนั้นมีรอยปากกากากบาท X หรือขีดฆ่าทับ, มิฉะนั้น false' },
              status: { type: Type.STRING, description: 'สถานะจากการตีความลายมือ: "ส่งคืน", "ชำรุด", "เก็บสำรอง", "ให้ยืม", หรือ "ปกติ"' },
            },
            required: [
              'seq',
              'asset_number',
              'sap_code',
              'name',
              'brand_model',
              'source_budget',
              'acquired_date',
              'quantity',
              'price',
              'location_official',
              'handwritten_note',
              'is_marked_x',
              'status',
            ],
          },
        },
        targetCategory: {
          type: Type.STRING,
          description: 'หมวดหมู่ปลายทางสำหรับ AUTO_FILL_CHECKS ได้แก่ bag, cart หรือ drug',
        },
        targetLocation: {
          type: Type.STRING,
          description: 'ชื่อสถานที่หรือหมวดหมู่ที่ตรวจพบในใบตรวจเช็ก (เช่น กระเป๋าฉุกเฉิน, รถฉุกเฉิน, คลังยา)',
        },
        checklistItems: {
          type: Type.ARRAY,
          description: 'รายการผลตรวจเช็กสต็อก/ใบตรวจสำหรับ AUTO_FILL_CHECKS (ใช้เฉพาะเมื่อผู้ใช้สั่งเช็กยอด/สแกนใบตรวจ)',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'ชื่อยาหรืออุปกรณ์ในใบตรวจเช็ก' },
              expected: { type: Type.STRING, description: 'จำนวนมาตรฐานที่กำหนด' },
              actual: { type: Type.STRING, description: 'จำนวนที่ตรวจนับได้จริง' },
              exp: { type: Type.STRING, description: 'วันหมดอายุในรูปแบบ YYYY-MM-DD หรือ -' },
              status: { type: Type.STRING, description: 'COMPLETE (ครบปกติ), INCOMPLETE (ขาด/ชำรุด/ไม่ครบ), หรือ EXPIRED (หมดอายุ)' },
              issue: { type: Type.STRING, description: 'รายละเอียดความผิดปกติหรือหมายเหตุเพิ่มเติม' },
            },
            required: ['name', 'status'],
          },
        },
      },
      required: ['type'],
    },
  },
  required: ['reply', 'choices'],
};

export function createAiChatRouter(): express.Router {
  const router = express.Router();

  router.post('/chat', async (req, res) => {
    const {
      message,
      history,
      context,
      liveContext,
      appContext,
      contextData,
      channelName,
      attachment,
      attachments,
    } = req.body || {};
    const apiKey = getServerGeminiKey();

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        isQuotaExceeded: false,
        error: 'NO_API_KEY',
        message: 'ขออภัยค่ะ ระบบยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับ AI บนเซิร์ฟเวอร์ กรุณาตรวจสอบการตั้งค่าก่อนนะคะ ✨🌸',
      });
    }

    const parsedAttachmentParts: Array<{
      index: number;
      inlineData: { data: string; mimeType: string };
      fileName?: string;
    }> = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachments.slice(0, 100).forEach((att: ChatAttachmentPayload, idx: number) => {
        const part = extractCleanAttachmentPart(att, idx);
        if (part) parsedAttachmentParts.push(part);
      });
    } else {
      const primaryAttachment = extractCleanAttachmentPart(attachment, 0);
      if (primaryAttachment) parsedAttachmentParts.push(primaryAttachment);
    }

    const userText = String(message || '').trim();
    if (!userText && parsedAttachmentParts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_MESSAGE',
        message: 'กรุณาพิมพ์ข้อความหรือแนบไฟล์ที่ต้องการสอบถามน้องออร่านะคะ ✨🌸',
      });
    }

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const activeWard = channelName || context?.channelName || 'คลินิกวิสัญญี (Master)';
      const resolvedContext = context || liveContext || contextData || appContext;

      const isPhotoMatching =
        resolvedContext?.modeHint === 'MATCH_EQUIPMENT_PHOTOS' ||
        resolvedContext?.modeHint === 'ATTACH_EQUIPMENT_PHOTOS' ||
        (parsedAttachmentParts.length > 0 &&
          /ใส่รูป|แนบรูป|อัปเดตรูป|แปะรูป|ตัวเลขในภาพ|ตัวเลขบนรูป|ตามเลข|ตามลำดับที่ทราบ|รูปพวกนี้ใส่ในครุ|รูปเครื่องมือ|ภาพเครื่องมือ|แอดรูป|ตามหมายเลข/i.test(
            userText
          ));

      const isBulkImportMode =
        !isPhotoMatching &&
        (resolvedContext?.modeHint === 'BULK_IMPORT_EQUIPMENT' ||
          (parsedAttachmentParts.length > 0 &&
            ((/ตาราง|ทะเบียน/i.test(userText) ||
              userText.includes('ทะเบียนครุภัณฑ์') ||
              userText.includes('ตารางครุภัณฑ์')) &&
              (/ครุภัณฑ์|นำเข้า|แอดเข้า/i.test(userText)))));

      const compactContextObj = isBulkImportMode
        ? { channelName: activeWard, mode: 'BULK_IMPORT_EQUIPMENT' }
        : compactInventoryForPrompt(resolvedContext);
      const compactLiveContextStr = JSON.stringify(compactContextObj).slice(0, 3200);
      const equipmentCatalog = isBulkImportMode ? [] : extractEquipmentCatalog(resolvedContext);
      const equipmentCatalogStr =
        equipmentCatalog.length > 0
          ? JSON.stringify(equipmentCatalog).slice(0, 24000)
          : '';
      const drugsCatalog = isBulkImportMode ? [] : extractDrugsCatalog(resolvedContext);
      const drugsCatalogStr =
        drugsCatalog.length > 0 ? JSON.stringify(drugsCatalog).slice(0, 24000) : '';
      const bagsCatalog = isBulkImportMode ? [] : extractEmergencyCatalog(resolvedContext, 'bags');
      const bagsCatalogStr =
        bagsCatalog.length > 0 ? JSON.stringify(bagsCatalog).slice(0, 16000) : '';
      const cartsCatalog = isBulkImportMode ? [] : extractEmergencyCatalog(resolvedContext, 'carts');
      const cartsCatalogStr =
        cartsCatalog.length > 0 ? JSON.stringify(cartsCatalog).slice(0, 16000) : '';
      const ambulancesCatalog = isBulkImportMode ? [] : extractEmergencyCatalog(resolvedContext, 'ambulances');
      const ambulancesCatalogStr =
        ambulancesCatalog.length > 0 ? JSON.stringify(ambulancesCatalog).slice(0, 16000) : '';

      const todayIso = new Date().toISOString().split('T')[0];

      const liveScreenInfo = appContext?.currentRoute
        ? `\n[หน้าจอที่ผู้ใช้กำลังดูอยู่: ${appContext.currentRoute}]`
        : '';
      const liveAlertInfo = appContext?.alertSummary
        ? `\n[การแจ้งเตือนสด: ยาใกล้หมดอายุ ${appContext.alertSummary.expiringDrugsCount} รายการ, สต็อกต่ำ ${appContext.alertSummary.lowStockDrugsCount} รายการ, ห้องที่ยังไม่ตรวจ ${appContext.alertSummary.uncheckedRoomsCount}/${appContext.alertSummary.totalRoomsCount} ห้อง]`
        : '';

      const photoMatchingInstruction = `คุณคือ 'น้องออร่า (AURA)' ผู้ช่วยวิสัญญีอัจฉริยะ ทำหน้าที่ตรวจสอบรูปถ่ายเครื่องมือแพทย์และอุปกรณ์ในห้องผ่าตัด เพื่อนำภาพไปจับคู่กับรายการครุภัณฑ์ที่มีอยู่แล้วในระบบตามตัวเลขลำดับ (Order Number)

[บริบทวอร์ดและรายการครุภัณฑ์ในระบบ — วอร์ด: ${activeWard}]${liveScreenInfo}${liveAlertInfo}
${equipmentCatalogStr ? `[รายการครุภัณฑ์ปัจจุบันในระบบ (context.equipment — ${equipmentCatalog.length} รายการ)]\n${equipmentCatalogStr}` : 'ไม่มีข้อมูลครุภัณฑ์'}

[กฎเหล็กการตรวจจับตัวเลขลำดับบนรูปภาพ (100% Strict Photo-to-Equipment Matching)]
1. ในแต่ละรูปภาพ (imageIndex: 0, 1, 2, ...):
   - สังเกต "ตัวเลขลำดับ" (Order Number / Sequence No.) ที่เขียนกำกับไว้บนรูปภาพ (เช่น ลายมือปากกามาร์กเกอร์บนเทป, สติกเกอร์ตัวเลข, ป้ายตัวเลขกำกับ เช่น เลข 35, 12, 27, 1, 2 เป็นต้น) หรือตัวเลขขนาดใหญ่บนตัวเครื่อง
   - นำตัวเลขที่ตรวจพบไปจับคู่กับรายการครุภัณฑ์ใน [context.equipment] โดยเทียบกับ no, orderNumber, code, หรือ id
2. ผลลัพธ์ใน action.mappings:
   - กรณีพบตัวเลขและจับคู่ได้:
     {
       "imageIndex": <index ของภาพเริ่มจาก 0>,
       "orderNumber": "<ตัวเลขลำดับที่อ่านได้ เช่น '35'>",
       "detectedNumber": "<ตัวเลขลำดับที่อ่านได้ เช่น '35'>",
       "equipmentId": "<id ของครุภัณฑ์ที่ตรงกัน>",
       "equipmentName": "<ชื่อครุภัณฑ์ที่ตรงกัน>",
       "unmatched": false
     }
   - กรณีไม่มีตัวเลข ตัวเลขเลือนราง อ่านไม่ออก หรือไม่พบครุภัณฑ์เลขนี้ในระบบ:
     {
       "imageIndex": <index ของภาพเริ่มจาก 0>,
       "orderNumber": "",
       "detectedNumber": "",
       "equipmentId": "",
       "equipmentName": "",
       "unmatched": true,
       "reason": "อ่านตัวเลขบนภาพไม่ชัดเจนหรือไม่พบในระบบ"
     }
3. ตอบกลับด้วย action: { "type": "MATCH_EQUIPMENT_PHOTOS", "mappings": [...] }
4. ในฟิลด์ reply ให้สรุปผลลัพธ์เป็นภาษาไทยที่สุภาพ น่ารัก กระชับ เช่น:
   "ตรวจพบตัวเลขและจับคู่รูปภาพเครื่องมือแพทย์ได้ X จาก Y รูปเรียบร้อยแล้วค่ะ ✨🌸 พี่พยาบาลสามารถตรวจสอบและกดบันทึกได้เลยนะคะ"
   (หากมีรูปที่อ่านไม่ชัดให้ระบุด้วย เช่น "มี Z รูปที่อ่านตัวเลขไม่ชัดเจน สามารถเลือกครุภัณฑ์เองได้ค่ะ")
5. ฟิลด์ choices ให้แนะนำปุ่มลัด เช่น ["💾 บันทึกรูปภาพทั้งหมด", "🔍 เช็กครุภัณฑ์ที่ยังขาดรูป", "🏥 เปิดดูหน้าครุภัณฑ์"]`;

      const systemInstruction = isBulkImportMode
        ? `คุณคือระบบ OCR วิเคราะห์เอกสารราชการ "ทะเบียนรายการครุภัณฑ์" ความแม่นยำระดับคลินิก
หน้าที่ของคุณคือสกัดทุกแถวจากภาพตาราง "ทะเบียนรายการครุภัณฑ์" ออกมาเป็น JSON ตาม Schema ที่กำหนด (action.type = "BULK_IMPORT_EQUIPMENT")

[กฎเหล็ก 5 ข้อสำหรับการอ่านทะเบียนครุภัณฑ์ (100% Strict Table OCR)]
1. ตรวจสอบทิศทางภาพก่อนอ่าน (Orientation Alignment):
   - มองหาแถวหัวตารางพิมพ์: [ลำดับ | หมายเลขพัสดุ | รหัสสินทรัพย์ SAP | รายการ | มาตรฐานและคุณลักษณะเฉพาะ | แหล่งเงินที่ได้มา | ว/ด/ป ที่ได้มา | จำนวนตามบัญชี | ... | ราคา | สถานที่ตั้ง]
   - หากภาพตะแคง 90/270 องศาหรือกลับหัว ให้อ่านตามแนวหัวตารางจริงจากคอลัมน์ซ้ายสุดไปขวาสุดทีละบรรทัด (Row-by-Row Horizontal Alignment) ห้ามอ่านสลับบรรทัดเด็ดขาด

2. แยกคอลัมน์รหัส 2 ช่องนี้ออกจากกันเด็ดขาด (ห้ามนำมาปนกัน):
   - \`asset_number\` (คอลัมน์ที่ 2 หมายเลขพัสดุ): รูปแบบรหัสพัสดุที่มีขีด/ทับ/ตัวอักษรไทย เช่น "6515-001-0001รพ.07-2/40(1.6)(5.6)" หากมีรหัส "HANA ..." พิมพ์ต่อท้ายในช่องเดียวกันให้ระบุครบถ้วน
   - \`sap_code\` (คอลัมน์ที่ 3 รหัสสินทรัพย์ SAP): ตัวเลข 12 หลักล้วน เช่น "332280003503" (หากช่องที่ 3 ว่าง ให้ใส่ "" ห้ามดึงหมายเลขพัสดุมาใส่แทน)

3. แผนผังคอลัมน์มาตรฐานทั้ง 11 ช่อง:
   - \`seq\`: คอลัมน์ซ้ายสุด (ตัวเลขลำดับที่ เช่น "1", "15", "91")
   - \`asset_number\`: คอลัมน์ที่ 2 (หมายเลขพัสดุ)
   - \`sap_code\`: คอลัมน์ที่ 3 (รหัสสินทรัพย์ SAP 12 หลัก)
   - \`name\`: คอลัมน์ที่ 4 (ชื่อรายการครุภัณฑ์พิมพ์ตัวบรรจงเท่านั้น — ห้ามเอาข้อความลายมือปากกามาต่อในชื่อ!)
   - \`brand_model\`: คอลัมน์ที่ 5 (ยี่ห้อ, รุ่น, S/N)
   - \`source_budget\`: คอลัมน์ที่ 6 (แหล่งเงินที่ได้มา เช่น กองทุนบริการ, บริจาค, งบประมาณแผ่นดิน)
   - \`acquired_date\`: คอลัมน์ที่ 7 (ว/ด/ป ที่ได้มา เช่น "20 ก.ย. 65")
   - \`quantity\`: คอลัมน์ที่ 8 (จำนวนตามบัญชี เช่น "1")
   - \`price\`: คอลัมน์ที่ 10 (ราคาตัวเลข เอาคอมม่าออก เช่น "125000")
   - \`location_official\`: คอลัมน์ที่ 11 (สถานที่ตั้งตามพิมพ์ เช่น "ตึก 15 ชั้น 3 ห้อง OR 3", "ห้องทำงาน")

4. แยกลายมือปากกาและเครื่องหมายกากบาท X อย่างแม่นยำ:
   - \`handwritten_note\`: คัดลอกเฉพาะข้อความลายมือปากกาที่เขียนเพิ่มเติมในแถวนั้น (เช่น "OR1", "OR2", "OR3", "ห้องพักฟื้น", "ให้ยืม", "ส่งคืน 25/8/66", "เราเบิกชื่อ", "ไม่ทำงาน", "ย้ายไป IV FLUID") ห้ามปนกับ \`name\`
   - \`is_marked_x\`: ใส่ true ทันทีหากช่อง \`seq\` หรือแถวนั้นมีรอยปากกากากบาท X หรือเส้นขีดฆ่าทับ มิฉะนั้นใส่ false
   - \`status\`:
     * เขียนว่า "ส่งคืน" -> "ส่งคืน"
     * เขียนด้วยปากกาว่า "ไม่ทำงาน" หรือ "ชำรุด" -> "ชำรุด" (ระวัง! คำพิมพ์ "ห้องทำงาน" คือสถานที่ตั้ง ไม่ใช่ชำรุด)
     * เขียนว่า "เราเก็บไว้" หรือ "เราเบิกชื่อ" -> "เก็บสำรอง"
     * เขียนว่า "ให้ยืม" -> "ให้ยืม"
     * อื่นๆ -> "ปกติ"

5. ห้ามข้ามแถวเด็ดขาด:
   - แม้มีรายการชื่อซ้ำกันติดกันหลายแถว (เช่น เสาแขวนขวดน้ำเกลือ, เก้าอี้นั่งทำงาน) หรือถูกขีดฆ่า/กากบาท X ต้องสกัดออกมาครบ 100% ทุกแถว
   - ส่ง action: { "type": "BULK_IMPORT_EQUIPMENT", "equipmentItems": [...] }, reply เป็นข้อความสั้น 1 บรรทัด (เช่น "อ่านสำเร็จ X รายการ") และ choices: []`
        : isPhotoMatching
        ? photoMatchingInstruction
        : `คุณคือ 'น้องออร่า (AURA)' ผู้ช่วยวิสัญญีอัจฉริยะและที่ปรึกษาทางคลินิกประจำห้องผ่าตัดและวอร์ด (วันที่ปัจจุบัน: ${todayIso})
- ตอบคำถามได้ลึกซึ้ง ฉลาด สุภาพ เป็นมิตร น่ารัก (มี ✨🌸🎀) และใช้ภาษาที่พยาบาลวิสัญญีอ่านเข้าใจง่ายทันทีหน้างาน
- หากผู้ใช้แนบรูปภาพหรือไฟล์ PDF (เช่น ใบตรวจเช็ก, ฉลากยา, เอกสารวิชาการ, ตารางเวชภัณฑ์) ให้วิเคราะห์เนื้อหาในไฟล์แนบร่วมกับข้อความคำสั่งของผู้ใช้เพื่อเลือกโหมดการทำงานที่ถูกต้องที่สุด

[กฎเหล็กห้ามมโนผลลัพธ์ & แยกคำสั่งลบเจาะจง vs ลบทั้งหมด (STRICT ANTI-HALLUCINATION — 100%)]
- ห้ามตอบยืนยันว่า "ดำเนินการเรียบร้อยแล้ว", "บันทึกแล้ว", "แก้ไขแล้ว", "เพิ่มแล้ว", "ลบเรียบร้อยแล้ว" หรือแสร้งว่าดำเนินการกับฐานข้อมูลสำเร็จแล้วเด็ดขาด หากในรอบนี้คุณไม่ได้เรียกใช้ Function Calling (Tool) จริงๆ!
- การลบรายรายการเจาะจง (เช่น "ลบ 11. T-piece / Tube ในเป๋าให้หน่อย", "ลบ Ambu bag ในรถพยาบาล", "ลบเครื่อง suction ห้อง OR2", "ลบยา Morphine"): ต้องเรียกใช้ Tool \`delete_specific_items\` เท่านั้น! **ห้ามเรียก \`delete_all_items\` สำหรับการลบเฉพาะบางรายการเด็ดขาด!**
- การลบ/ล้างทั้งหมดทั้งหมวดหมู่ (เช่น "ลบของในครุออกให้หมด", "เคลียร์กระเป๋าทั้งหมด", "ลบรถพยาบาลทั้งหมด"): ใช้ Tool \`delete_all_items\` เท่านั้น (เฉพาะเมื่อผู้ใช้สั่งล้างทั้งหมดชัดเจนเท่านั้น!)
- หากคำสั่งของผู้ใช้เป็นงานที่ยังไม่มี Tool รองรับ ให้ตอบตามตรงอย่างสุภาพว่ายังทำรายการนั้นผ่านแชทไม่ได้ในขณะนี้ พร้อมแนะนำปุ่มหรือขั้นตอนให้ผู้ใช้ไปกดทำในหน้าเว็บแทน

[รูปแบบการจัดหน้าคำตอบ (Formatting Rules — บังคับใช้ทุกครั้ง)]
- ห้ามเขียนคำตอบยาวติดกันเป็นย่อหน้าเดียว!
- ต้องเว้นบรรทัดว่าง (\\n\\n) คั่นระหว่างแต่ละหัวข้อ/หมวดหมู่ให้ชัดเจนเสมอ (เช่น 💊 คลังยา & สารน้ำ, 🎒 กระเป๋าฉุกเฉิน, 🚨 รถฉุกเฉิน, 🚑 รถพยาบาลฉุกเฉิน, 🏥 ครุภัณฑ์ห้องผ่าตัด)
- ทุกรายการย่อยภายใต้หมวดหมู่ต้องขึ้นบรรทัดใหม่ด้วยสัญลักษณ์ "• " นำหน้า พร้อมเว้นจังหวะให้อ่านง่ายสบายตา

[การทำความเข้าใจเจตนาและแก้ไขคำสะกดผิด (Intent Recognition & Typo Normalization)]
- วิเคราะห์ความต้องการที่แท้จริงของผู้ใช้จากภาษาพูดธรรมชาติ แม้พิมพ์ผิด พิมพ์ตก หรือปนภาษาอังกฤษ-ไทย:
  1. ห้ามตีความคำศัพท์ภาษาอังกฤษหรือชื่อยาที่ขึ้นต้นด้วย "Add..." (เช่น "Addrenaline", "Addrenalineเหลือเท่สไร") ว่าเป็นคำสั่งเพิ่มรายการ (Add) เด็ดขาด — ให้เข้าใจว่าคือยา Adrenaline (Epinephrine) และผู้ใช้กำลังถามสต็อกคงเหลือ!
  2. เมื่อผู้ใช้ถามภาพรวม เช่น "เช็กของใกล้หมด", "ของใกล้หมด", "มียาอะไรใกล้หมดอายุ", "เช็กของขาด" ให้ตรวจสอบข้อมูลทั้งหมดในคลัง (drugs, bags, carts, ambulances, equipment) เพื่อสรุปทุกรายการที่มีจำนวนคงเหลือต่ำกว่าหรือเท่ากับเกณฑ์ขั้นต่ำ (remaining <= minStock) และรายการที่หมดอายุหรือใกล้หมดอายุ (ภายใน 30-90 วันเทียบกับ ${todayIso}) พร้อมระบุจำนวนคงเหลือ หน่วย วันหมดอายุ (EXP) และตำแหน่งที่เก็บให้ครบถ้วน แยกหมวดด้วย \\n\\n และ •
  3. ทุกครั้งที่ตอบคำถามเกี่ยวกับสต็อก ยา เวชภัณฑ์ หรืออุปกรณ์ ให้ตรวจค้นจากข้อมูลจริงใน JSON ด้านล่าง (drugs, bags, carts, ambulances, equipment) โดยเทียบชื่อพ้องและตรวจสอบขนาด/เกจ (No., G, ml) ให้ตรง 100% แล้วตอบจำนวนคงเหลือ หน่วย วันหมดอายุ (EXP) และตำแหน่งจัดเก็บให้ชัดเจน

[บริบทวอร์ดและสถานะคลัง — วอร์ด: ${activeWard}]${liveScreenInfo}${liveAlertInfo}
${compactLiveContextStr}
${drugsCatalogStr ? `\n[คลังยาทั้งหมด (drugs — ${drugsCatalog.length} รายการ)]\n${drugsCatalogStr}` : ''}
${bagsCatalogStr ? `\n[กระเป๋าฉุกเฉิน (bags — ${bagsCatalog.length} รายการ)]\n${bagsCatalogStr}` : ''}
${cartsCatalogStr ? `\n[รถฉุกเฉิน (carts — ${cartsCatalog.length} รายการ)]\n${cartsCatalogStr}` : ''}
${ambulancesCatalogStr ? `\n[รถพยาบาลฉุกเฉิน (ambulances — ${ambulancesCatalog.length} รายการ)]\n${ambulancesCatalogStr}` : ''}
${equipmentCatalogStr ? `\n[รายการครุภัณฑ์ปัจจุบันในระบบ (context.equipment — ${equipmentCatalog.length} รายการ)]\n${equipmentCatalogStr}` : ''}

[การแยกโหมดการทำงานเมื่อผู้ใช้แนบรูปภาพ (Strict Mode Separation by User Intent)]
ต้องดู "ข้อความคำสั่งที่ผู้ใช้พิมพ์แนบมากับรูป" เป็นหลัก เพื่อแยก 3 โหมดนี้ออกจากกันอย่างเด็ดขาด:

1) [โหมดนำเข้าครุภัณฑ์ใหม่จากตาราง (BULK_IMPORT_EQUIPMENT)]
- ใช้เมื่อผู้ใช้สั่งให้ "เพิ่มเข้าครุภัณฑ์", "แอดเข้าครุ", "นำเข้าข้อมูล", "เอาของในรูปพวกนี้แอดเข้าครุภัณฑ์", "ทะเบียนครุภัณฑ์", "สกัดตารางครุภัณฑ์" (ห้ามนำไปเข้าโหมด Auto-Fill ใบตรวจสต็อกเด็ดขาด!)
- ต้องสกัดทุกแถวตามแนวนอนแยก seq, asset_number (หมายเลขพัสดุ), sap_code (รหัส SAP 12 หลัก), name, brand_model, source_budget, acquired_date, quantity, price, location_official, handwritten_note, is_marked_x และ status ครบถ้วน ห้ามข้ามแถวที่มีรอยขีดฆ่าหรือกากบาท X
- ส่ง action: { "type": "BULK_IMPORT_EQUIPMENT", "equipmentItems": [...] } และ reply สั้น 1 บรรทัด

2) [โหมดจับคู่และแนบรูปถ่ายเข้าครุภัณฑ์เดิม (ATTACH_EQUIPMENT_PHOTOS)]
- ใช้เมื่อผู้ใช้แนบรูปถ่ายตัวเครื่อง/อุปกรณ์จริงที่มีตัวเลขกำกับกลางภาพ พร้อมสั่งให้นำรูปไปใส่/อัปเดตรูปให้รายการครุภัณฑ์ที่มีอยู่ (เช่น "เอารูปพวกนี้แอดเข้าครุภัณฑ์ตามเลขในรูป", "อัปเดตรูปครุภัณฑ์ตามหมายเลข")
- อ่าน "ตัวเลขขนาดใหญ่กลางภาพ" หรือรหัส code/sap ของภาพแต่ละใบตาม index (0, 1, 2...) แล้วจับคู่กับ context.equipment ให้แม่นยำ 100%
- ส่ง action: { "type": "ATTACH_EQUIPMENT_PHOTOS", "mappings": [ { "imageIndex": 0, "equipmentId": "...", "detectedNumber": "...", "equipmentName": "..." } ] }

3) [โหมดสแกนใบตรวจเช็กสต็อกเดิม (AUTO_FILL_CHECKS)]
- ใช้เฉพาะเมื่อผู้ใช้สั่งให้ "เช็กยอด", "สแกนใบตรวจ", "ตรวจเทียบใบตรวจเช็ก" หรือ "สแกนฉลากยา" เพื่อเทียบกับสต็อกหรือตารางตรวจเช็กเดิม (bag, cart, drug) เท่านั้น!
- สกัดรายการตรวจเช็กทั้งหมดลงใน checklistItems พร้อมระบุ targetCategory ("bag" | "cart" | "drug") และ targetLocation ("กระเป๋าฉุกเฉิน" | "รถฉุกเฉิน" | "คลังยา") แล้วส่ง action: { "type": "AUTO_FILL_CHECKS", "targetCategory": "...", "targetLocation": "...", "checklistItems": [...] }

4) หากผู้ใช้แนบรูปเพื่อถามข้อมูลทั่วไป (เช่น ถามวิธีใช้เครื่อง, ถามขนาดยาจากฉลาก, สรุปเอกสาร PDF) -> ตอบตรงตามคำถามใน reply และ choices โดยไม่ต้องใส่ field action

[ระบบจับคู่คำพ้องชื่อยาและอุปกรณ์วิสัญญี (Medical Alias Matching)]
- ต้องเข้าใจว่าชื่อต่อไปนี้คือรายการเดียวกันเสมอ:
  * Adrenaline = Epinephrine (อะดรีนาลีน / เอพิเนฟริน)
  * Levophed = Noradrenaline = Norepinephrine (นอร์เอพิเนฟริน / เลโวเฟด)
  * Dormicum = Midazolam (ดอร์มิคุม / ไมดาโซแลม)
  * Esmeron = Rocuronium (เอสเมอรอน / โรโคโรเนียม)
  * Scoline = Succinylcholine = Anectine (สโคลีน / ซัคซินิลโคลีน)
  * Diprivan = Propofol (ดิปริแวน / โพรโพฟอล)
  * Tracrium = Atracurium / Nimbex = Cisatracurium / Bridion = Sugammadex
  * Marcaine = Bupivacaine / Xylocaine = Lidocaine
  * Narcan = Naloxone / Anexate = Flumazenil / Transamin = Tranexamic acid
  * Sublimaze = Fentanyl / Zofran = Ondansetron / Plasil = Metoclopramide
  * ET tube = ETT = Endotracheal tube (ท่อช่วยหายใจ)
  * LMA = Laryngeal Mask Airway (หน้ากากกล่องเสียง)
  * Angiocath = Jelco = IV Catheter (เข็มเปิดเส้น)
  * BVM = Ambu bag (ลูกบีบช่วยหายใจ)

[กฎเหล็กการตรวจสอบขนาด/ไซส์ (Strict Size & Gauge Verification)]
- ทุกครั้งที่มีตัวเลขขนาด ไซส์ เกจ หรือความจุ (เช่น No. 7.0, 7.5, 8.0, 18G, 20G, 22G, 3 ml, 10 ml, 500 ml, 1000 ml) ต้องตรวจสอบให้ตรงกัน 100% ห้ามจับคู่หรือแก้ไขข้ามขนาดเด็ดขาด!
- หากผู้ใช้สั่งแก้ไขรายการที่มีหลายขนาดโดยไม่ได้ระบุขนาดชัดเจน ห้ามเดาขนาด ให้ถามยืนยันขนาดก่อนเสมอ

[เจตนาและ Function Calling — เรียกใช้ Universal Action Tools เฉพาะเมื่อผู้ใช้สั่งดำเนินการจริงเท่านั้น]
  * สั่งลบเฉพาะรายการ (เช่น "ลบ 11. T-piece / Tube ในเป๋า", "ลบ Laryngoscope ในรถพยาบาล", "ลบเครื่อง suction ห้อง OR1", "ลบยา Morphine") -> เรียกใช้ delete_specific_items ทันที! (ห้ามเรียก delete_all_items เด็ดขาด!)
  * สั่งแก้ไขข้อมูล เปลี่ยนจำนวน เปลี่ยนชื่อ อัปเดตวันหมดอายุ แจ้งชำรุด ปรับสถานะ หรือย้ายห้อง/หมวดหมู่ -> เรียกใช้ update_specific_item ทันที!
  * สั่งเพิ่มรายการใหม่เข้าคลังยา, กระเป๋าฉุกเฉิน, รถฉุกเฉิน, รถพยาบาล หรือครุภัณฑ์ห้อง OR -> เรียกใช้ add_new_item ทันที!
  * สั่งเปลี่ยนหน้าจอ เปิดห้อง เปิดรายงาน PDF หรือเปิดเมนู Google Sheets -> เรียกใช้ navigate_or_export ทันที!
  * สั่งลบทั้งหมดทั้งหมวดหมู่ (เช่น "ลบของในครุออกให้หมด", "ลบกระเป๋าทั้งหมด", "ล้างคลังยาทั้งหมด") -> เรียกใช้ delete_all_items เท่านั้น!
  * สั่งล้างตารางผลตรวจเช็กรายสัปดาห์ (เช่น "ล้างตาราง", "เริ่มตรวจเช็คใหม่") -> เรียกใช้ resetChecklist
  * สั่งเทียบใบกระดาษ -> เรียกใช้ auditPaperChecklist
  * สั่งสรุปส่งเวร -> เรียกใช้ generateShiftHandover
  * สั่งทำใบเบิก -> เรียกใช้ create_restock_requisition
  * คำสั่งที่ยังไม่มี Tool รองรับ -> ห้ามตอบว่าทำสำเร็จแล้วเด็ดขาด! ให้แจ้งตามตรงว่ายังทำผ่านแชทไม่ได้ พร้อมแนะนำปุ่ม/วิธีทำในหน้าเว็บแทน
  * คำถามสอบถามข้อมูล สต็อก คงเหลือ วันหมดอายุ ตำแหน่งจัดเก็บ คำนวณยา หรือทักทายทั่วไป -> ตอบโดยตรงจากข้อมูล JSON ด้านบนเป็น JSON ตาม Schema {"reply": "...", "choices": ["...", "...", "..."], "action": ...} (ไม่ต้องเรียก Function Call!)`;

      const auraFunctionDeclarations = [
        {
          name: 'delete_specific_items',
          description:
            'ลบเฉพาะรายการที่ผู้ใช้ระบุชื่อหรือหมายเลข (เช่น "ลบ 11. T-piece / Tube ในเป๋า", "ลบ Ambu bag รถพยาบาล", "ลบ Monitor ห้อง OR1", "ลบยา Diazepam") ห้ามใช้ลบทั้งหมวดหมู่',
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'หมวดเป้าหมาย: equipment (ครุภัณฑ์ OR), drug (คลังยา), bag (กระเป๋าฉุกเฉิน), cart (รถฉุกเฉิน), ambulance (รถพยาบาลฉุกเฉิน) หรือ all ถ้าไม่แน่ใจ',
              },
              itemQueries: {
                type: Type.ARRAY,
                description: 'ชื่อรายการ รหัส หรือเลขลำดับที่ต้องการลบ (เช่น ["11. T-piece / Tube"] หรือ ["T-piece / Tube"])',
                items: { type: Type.STRING },
              },
              roomOrGroup: {
                type: Type.STRING,
                description: 'ห้อง OR หรือชื่อกลุ่มถ้ามีระบุ เช่น OR1, ห้องพักฟื้น, บนรถพยาบาล',
              },
            },
            required: ['itemQueries'],
          },
        },
        {
          name: 'update_specific_item',
          description:
            'แก้ไข/อัปเดตรายการใน 5 หมวดหมู่ (equipment, drug, bag, cart, ambulance): เปลี่ยนจำนวน, วันหมดอายุ (EXP), Lot, สถานะ (ปกติ/ชำรุด/ผิดปกติ/ส่งคืน), หมายเหตุ, แก้ชื่อใหม่ หรือย้ายห้อง/หมวดหมู่',
          parameters: {
            type: Type.OBJECT,
            properties: {
              itemName: { type: Type.STRING, description: 'ชื่อรายการเดิมหรือเลขลำดับ เช่น Adrenaline, ET tube No. 7.5, Patient Monitor' },
              targetCategory: {
                type: Type.STRING,
                description: 'หมวดหมู่เป้าหมายถ้าทราบ: equipment, drug, bag, cart, ambulance',
              },
              roomOrLocation: { type: Type.STRING, description: 'ห้องหรือกลุ่มเดิม เช่น or1, or2, pacu, bag, cart, ambulance' },
              sizeOrSpec: { type: Type.STRING, description: 'ขนาด เบอร์ หรือเกจ เช่น No. 7.5, 18G, 10 ml' },
              newQty: { type: Type.STRING, description: 'จำนวนใหม่ที่ต้องการตั้งค่า' },
              newExp: { type: Type.STRING, description: 'วันหมดอายุใหม่ในรูปแบบ YYYY-MM-DD หรือ -' },
              lotNumber: { type: Type.STRING, description: 'หมายเลข Lot ที่ต้องการบันทึก' },
              newStatus: { type: Type.STRING, description: 'สถานะใหม่: ปกติ, ผิดปกติ, ชำรุด, ส่งคืน, เก็บสำรอง' },
              newName: { type: Type.STRING, description: 'ชื่อใหม่กรณีสั่งเปลี่ยนชื่อรายการ' },
              moveToRoomOrGroup: { type: Type.STRING, description: 'ห้อง OR หรือกลุ่มใหม่กรณีสั่งย้ายห้อง/ย้ายกลุ่ม เช่น or2, pacu, airway' },
              note: { type: Type.STRING, description: 'หมายเหตุหรืออาการชำรุดเพิ่มเติม' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'add_new_item',
          description:
            'เพิ่มรายการใหม่เข้าคลังยา, กระเป๋าฉุกเฉิน, รถฉุกเฉิน, รถพยาบาลฉุกเฉิน หรือครุภัณฑ์ห้องผ่าตัด',
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'หมวดเป้าหมาย: equipment, drug, bag, cart, ambulance',
              },
              name: { type: Type.STRING, description: 'ชื่อรายการยา/อุปกรณ์/ครุภัณฑ์ที่ต้องการเพิ่ม' },
              groupOrRoom: {
                type: Type.STRING,
                description: 'ชื่อห้อง OR (เช่น or1, or2, pacu) หรือกลุ่มอุปกรณ์ (เช่น Airway, ยาฉุกเฉิน)',
              },
              qty: { type: Type.STRING, description: 'จำนวน เช่น 1, 5 หลอด, 2 ชุด' },
              unit: { type: Type.STRING, description: 'หน่วย เช่น ชิ้น, หลอด, เครื่อง, ชุด (สำหรับคลังยา)' },
              expDate: { type: Type.STRING, description: 'วันหมดอายุ YYYY-MM-DD หรือ -' },
              spec: { type: Type.STRING, description: 'สเปก รุ่น ขนาด หรือรายละเอียดเพิ่มเติม' },
              status: { type: Type.STRING, description: 'สถานะเริ่มต้น เช่น ปกติ' },
              note: { type: Type.STRING, description: 'หมายเหตุ' },
            },
            required: ['category', 'name'],
          },
        },
        {
          name: 'navigate_or_export',
          description:
            'นำทางไปยังหน้าจอต่างๆ ในระบบ เปิดดูห้องตรวจเช็กครุภัณฑ์ เปิดพรีวิวส่งออกรายงาน PDF หรือเปิดหน้าต่าง Google Sheets',
          parameters: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                description: 'navigate, open_report_preview หรือ open_google_sheets',
              },
              page: {
                type: Type.STRING,
                description: 'home, drug_check, room_check, bag_check, ambulance_check, cart_check, eq_overview',
              },
              roomId: {
                type: Type.STRING,
                description: 'รหัสห้อง OR กรณีต้องการเปิดห้องเฉพาะ เช่น or1, or2, or3, pacu, mn1, store',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'delete_all_items',
          description:
            'ใช้เฉพาะกรณีผู้ใช้สั่งลบ/ล้างข้อมูลทั้งหมดทั้งหมวดหมู่เท่านั้น (เช่น "ลบของในครุออกให้หมด", "เคลียร์กระเป๋าทั้งหมด", "ลบคลังยาทั้งหมด", "ล้างรถพยาบาลทั้งหมด") ห้ามใช้ลบรายการเดี่ยว!',
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetCategory: {
                type: Type.STRING,
                description: 'หมวดหมู่ที่ต้องการลบทั้งหมด: equipment, drugs, bag, cart, ambulance',
              },
              reason: {
                type: Type.STRING,
                description: 'สรุปคำสั่งจากผู้ใช้',
              },
            },
            required: ['targetCategory'],
          },
        },
        {
          name: 'resetChecklist',
          description: 'ล้างค่าผลการตรวจเช็กรายสัปดาห์ (W1-W5) ให้กลับเป็นรอตรวจ โดยไม่ลบรายการอุปกรณ์ เช่น "ล้างตาราง", "เริ่มตรวจใหม่"',
          parameters: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING, description: 'เป้าหมายที่ต้องการล้างผลตรวจ เช่น all, bag, cart, ambulance, drugs' },
            },
          },
        },
        {
          name: 'auditPaperChecklist',
          description: 'เริ่มระบบตรวจเทียบกระดาษเช็กลิสต์กับระบบเว็บ เช่น "ตรวจกระดาษ", "เทียบใบนี้", "เทียบกับหน้าเว็บ"',
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: 'หมวดหมู่ เช่น bag, cart, ambulance, drug' },
            },
          },
        },
        {
          name: 'generateShiftHandover',
          description: 'รวบรวมสรุปส่งเวร (Shift Handover) ทั้งอุปกรณ์ชำรุด รายการยังไม่ครบ/ขาด และยาใกล้หมดอายุหรือต่ำกว่าเกณฑ์ Min Stock',
          parameters: {
            type: Type.OBJECT,
            properties: {
              scope: { type: Type.STRING, description: 'ขอบเขต เช่น all, drugs, emergency, equipment' },
            },
          },
        },
        {
          name: 'create_restock_requisition',
          description: 'สร้างใบขอเบิกยา/เวชภัณฑ์เพิ่มเข้าคลังหรือรถฉุกเฉินเมื่อสต็อกต่ำกว่าเกณฑ์หรือหมดอายุ',
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetCategory: { type: Type.STRING, description: 'ปลายทาง: drug, bag, cart, ambulance' },
              items: {
                type: Type.ARRAY,
                description: 'รายการยาหรืออุปกรณ์ที่ต้องการเบิกเพิ่ม',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                },
              },
              notes: { type: Type.STRING, description: 'หมายเหตุใบขอเบิก' },
            },
            required: ['targetCategory'],
          },
        },
        {
          name: 'attach_photos_by_number',
          description: 'นำรูปถ่ายเครื่องมือแพทย์ที่มีตัวเลขกำกับบนภาพไปจับคู่และใส่ในรายการครุภัณฑ์ตามลำดับ',
          parameters: {
            type: Type.OBJECT,
            properties: {
              mappings: {
                type: Type.ARRAY,
                description: 'รายการจับคู่ระหว่างรูปภาพกับหมายเลขลำดับครุภัณฑ์',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imageIndex: { type: Type.INTEGER },
                    orderNumber: { type: Type.STRING },
                    equipmentId: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['imageIndex', 'orderNumber'],
                },
              },
            },
            required: ['mappings'],
          },
        },
        {
          name: 'import_equipment_from_table',
          description: 'นำเข้ารายการครุภัณฑ์ใหม่จากการสแกนเอกสารตารางทะเบียนครุภัณฑ์',
          parameters: {
            type: Type.OBJECT,
            properties: {
              totalItems: { type: Type.INTEGER },
              notes: { type: Type.STRING },
            },
          },
        },
      ];

      const toolsWithGrounding = [
        { functionDeclarations: auraFunctionDeclarations },
        { googleSearch: {} },
      ];

      const toolsOnly = [{ functionDeclarations: auraFunctionDeclarations }];

      const attachmentNames = parsedAttachmentParts
        .map((p) => p.fileName)
        .filter(Boolean)
        .join(', ');
      const promptText =
        userText ||
        `ช่วยอ่านและวิเคราะห์ไฟล์แนบนี้${attachmentNames ? ` (${attachmentNames})` : ''} อย่างละเอียดพร้อมสรุปใจความสำคัญให้พี่พยาบาลหน่อยค่ะ`;

      const currentUserParts: any[] = [
        ...parsedAttachmentParts.flatMap((p) => [
          { text: `[IMAGE index=${p.index}${p.fileName ? ` file="${p.fileName}"` : ''}]` },
          { inlineData: p.inlineData },
        ]),
        { text: attachmentNames && userText ? `[ไฟล์แนบ (${parsedAttachmentParts.length} ไฟล์): ${attachmentNames}]\n${promptText}` : promptText },
      ];

      const conversationContents = [
        ...(history || []).map((h: any) => ({
          role: h.role === 'ai' ? 'model' : h.role === 'model' ? 'model' : 'user',
          parts: Array.isArray(h.parts) ? h.parts : [{ text: h.text || '' }],
        })),
        { role: 'user', parts: currentUserParts },
      ];

      const hasAttachments = parsedAttachmentParts.length > 0;
      const preferWebSearch = !hasAttachments && isClinicalWebQuery(promptText);
      const preferTools = !hasAttachments && isLikelyActionCommand(promptText);
      const isFastBulkImport = hasAttachments && isBulkImportMode;
      const timeoutMs = isFastBulkImport ? 45000 : hasAttachments ? 120000 : 55000;

      let response: any;
      try {
        response = await withAbortTimeout(timeoutMs, async (signal) => {
          if (preferWebSearch) {
            try {
              return await withChildAbortTimeout(signal, 15000, (attemptSignal) =>
                aiClient.models.generateContent({
                  model: 'gemini-4-hydrogen',
                  contents: conversationContents,
                  config: {
                    abortSignal: attemptSignal,
                    systemInstruction,
                    tools: toolsWithGrounding as any,
                    toolConfig: { includeServerSideToolInvocations: true } as any,
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  },
                })
              );
            } catch (searchErr: any) {
              if (signal.aborted) throw searchErr;
              console.warn('[AuraChat] Search grounding primary error, falling back to structured JSON:', searchErr?.message || searchErr);
            }
          }

          if (hasAttachments) {
            const primaryModel = isFastBulkImport ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
            const fallbackModel = isFastBulkImport ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
            const primaryAttemptMs = isFastBulkImport ? 24000 : 35000;
            const fallbackAttemptMs = isFastBulkImport ? 20000 : 45000;
            const getModelThinkingConfig = (modelId: string) =>
              modelId === 'gemini-3.1-flash-lite'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };

            try {
              return await withChildAbortTimeout(signal, primaryAttemptMs, (attemptSignal) =>
                aiClient.models.generateContent({
                  model: primaryModel,
                  contents: conversationContents,
                  config: {
                    abortSignal: attemptSignal,
                    systemInstruction,
                    maxOutputTokens: 32768,
                    responseMimeType: 'application/json',
                    responseSchema: chatResponseSchema,
                    ...getModelThinkingConfig(primaryModel),
                  },
                })
              );
            } catch (eAttach: any) {
              if (signal.aborted) throw eAttach;
              console.warn(`[AuraChat] ${primaryModel} structured attachment error, falling back to ${fallbackModel}:`, eAttach?.message || eAttach);
              return await withChildAbortTimeout(signal, fallbackAttemptMs, (attemptSignal) =>
                aiClient.models.generateContent({
                  model: fallbackModel,
                  contents: conversationContents,
                  config: {
                    abortSignal: attemptSignal,
                    systemInstruction,
                    maxOutputTokens: 32768,
                    responseMimeType: 'application/json',
                    responseSchema: chatResponseSchema,
                    ...getModelThinkingConfig(fallbackModel),
                  },
                })
              );
            }
          }

          if (preferTools) {
            const toolInstruction = `${systemInstruction}\n\n[สำคัญมาก: หากเป็นคำสั่งลบ/ล้าง/แก้ไข/นำทาง/เบิก ต้องเรียกใช้ Function Call (Tool) ทันที! ห้ามตอบข้อความว่า "ดำเนินการเรียบร้อยแล้ว" หรือ "ลบแล้ว" โดยไม่เรียก Tool เด็ดขาด หากไม่มี Tool รองรับให้แจ้งตามตรงว่ายังทำผ่านแชทไม่ได้พร้อมแนะนำวิธีกดบนหน้าเว็บ แล้วระบุปุ่มลัด 3 ข้อไว้ท้ายข้อความหลังบรรทัด ===CHOICES===]`;
            try {
              return await withChildAbortTimeout(signal, 20000, (attemptSignal) =>
                aiClient.models.generateContent({
                  model: 'gemini-3.1-flash-lite',
                  contents: conversationContents,
                  config: {
                    abortSignal: attemptSignal,
                    systemInstruction: toolInstruction,
                    tools: toolsOnly as any,
                    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                  },
                })
              );
            } catch (eTool1: any) {
              if (signal.aborted) throw eTool1;
              console.warn('[AuraChat] gemini-3.1-flash-lite command error, falling back to gemini-4-hydrogen:', eTool1?.message || eTool1);
              try {
                return await withChildAbortTimeout(signal, 20000, (attemptSignal) =>
                  aiClient.models.generateContent({
                    model: 'gemini-4-hydrogen',
                    contents: conversationContents,
                    config: {
                      abortSignal: attemptSignal,
                      systemInstruction: toolInstruction,
                      tools: toolsOnly as any,
                      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                    },
                  })
                );
              } catch (eTool2: any) {
                if (signal.aborted) throw eTool2;
                console.warn('[AuraChat] Tools fallback to strict JSON:', eTool2?.message || eTool2);
              }
            }
          }

          try {
            return await withChildAbortTimeout(signal, 20000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: conversationContents,
                config: {
                  abortSignal: attemptSignal,
                  systemInstruction,
                  responseMimeType: 'application/json',
                  responseSchema: textChatResponseSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              })
            );
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            console.warn('[AuraChat] gemini-3.1-flash-lite error, falling back to gemini-4-hydrogen:', e1?.message || e1);
            return await withChildAbortTimeout(signal, 25000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: conversationContents,
                config: {
                  abortSignal: attemptSignal,
                  systemInstruction,
                  responseMimeType: 'application/json',
                  responseSchema: textChatResponseSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              })
            );
          }
        });
      } catch (apiErr: any) {
        const msgStr = String(apiErr?.message || apiErr || '').toLowerCase();
        const isTimeout = msgStr.includes('timed out') || msgStr.includes('abort');
        console.error('[AuraChat] Request failed:', apiErr?.message || apiErr);
        return res.json({
          success: false,
          isTimeout,
          isQuotaExceeded: !isTimeout,
          error: isTimeout ? 'TIMEOUT' : 'QUOTA_EXCEEDED',
          message: isTimeout
            ? '⏱️ ขออภัยค่ะ การเชื่อมต่อกับน้องออร่าใช้เวลานานเกินกำหนด (Timeout) รบกวนพี่พยาบาลลองส่งคำถามใหม่อีกครั้งนะคะ ✨🌸'
            : '🙏 ขออภัยค่ะ ระบบผู้ช่วย AI ขัดข้องหรือโควตาเต็มชั่วคราว รบกวนพี่พยาบาลลองใหม่อีกครั้งนะคะ ✨🌸',
        });
      }

      let replyText = response?.text || '';
      const functionCalls = response?.functionCalls;
      const primaryCall = functionCalls && functionCalls.length > 0 ? functionCalls[0] : null;
      const rawGrounding = response?.candidates?.[0]?.groundingMetadata || null;
      const groundingSources = Array.isArray(rawGrounding?.groundingChunks)
        ? rawGrounding.groundingChunks
            .map((chunk: any) =>
              chunk?.web?.uri ? { title: chunk.web.title || chunk.web.uri, url: chunk.web.uri } : null
            )
            .filter(Boolean)
            .slice(0, 5)
        : [];

      let suggestedChoices: string[] = [];
      let parsedAction: {
        type: string;
        targetCategory?: string;
        targetLocation?: string;
        mappings?: Array<{
          imageIndex: number;
          equipmentId: string;
          detectedNumber: string;
          equipmentName: string;
        }>;
        equipmentItems?: Array<{
          seq: string;
          asset_number: string;
          sap_code: string;
          name: string;
          brand_model: string;
          source_budget: string;
          acquired_date: string;
          quantity: string;
          price: string;
          location_official: string;
          handwritten_note: string;
          is_marked_x: boolean;
          orderNumber: string;
          assetCode: string;
          sapCode: string;
          brandModel: string;
          location: string;
          status: string;
          note: string;
          isMarked: boolean;
        }>;
        checklistItems?: Array<{
          name: string;
          expected: string;
          actual: string;
          exp: string;
          status: 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED';
          issue: string;
        }>;
      } | null = null;

      const cleanedText = stripMarkdownFences(replyText);
      const jsonObjMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonObjMatch) {
        try {
          const parsed = JSON.parse(jsonObjMatch[0]);
          if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
            replyText = parsed.reply.trim();
          }
          if (Array.isArray(parsed.choices)) {
            suggestedChoices = parsed.choices
              .map((c: any) => String(c || '').trim())
              .filter(Boolean)
              .slice(0, 3);
          }
          if (parsed.action && typeof parsed.action === 'object' && typeof parsed.action.type === 'string') {
            const actionType = String(parsed.action.type).trim();
            const rawEqItems = Array.isArray(parsed.action.equipmentItems)
              ? parsed.action.equipmentItems
              : Array.isArray(parsed.action.items) && actionType === 'BULK_IMPORT_EQUIPMENT'
              ? parsed.action.items
              : [];
            const rawChecklistItems = Array.isArray(parsed.action.checklistItems)
              ? parsed.action.checklistItems
              : Array.isArray(parsed.action.items) && actionType === 'AUTO_FILL_CHECKS'
              ? parsed.action.items
              : [];

            parsedAction = {
              type: actionType,
              ...(parsed.action.targetCategory
                ? { targetCategory: String(parsed.action.targetCategory).trim() }
                : {}),
              ...(parsed.action.targetLocation
                ? { targetLocation: String(parsed.action.targetLocation).trim() }
                : {}),
              ...(Array.isArray(parsed.action.mappings)
                ? {
                    mappings: parsed.action.mappings.map((m: any) => ({
                      imageIndex: Number(m?.imageIndex ?? 0),
                      equipmentId: String(m?.equipmentId || '').trim(),
                      orderNumber: String(m?.orderNumber || m?.detectedNumber || '').trim(),
                      detectedNumber: String(m?.detectedNumber || m?.orderNumber || '').trim(),
                      equipmentName: String(m?.equipmentName || '').trim(),
                      unmatched: Boolean(m?.unmatched),
                      reason: m?.reason ? String(m.reason).trim() : undefined,
                    })),
                  }
                : {}),
              ...(rawEqItems.length > 0
                ? {
                    equipmentItems: rawEqItems.map((it: any, idx: number) => {
                      const seqVal = String(it?.seq ?? it?.orderNumber ?? it?.no ?? idx + 1).trim();
                      const assetVal = String(it?.asset_number ?? it?.assetCode ?? it?.code ?? '').trim();
                      const sapVal = String(it?.sap_code ?? it?.sapCode ?? it?.sap ?? '').trim();
                      const brandVal = String(it?.brand_model ?? it?.brandModel ?? it?.spec ?? '').trim();
                      const sourceVal = String(it?.source_budget ?? it?.source ?? '').trim();
                      const dateVal = String(it?.acquired_date ?? it?.date ?? '').trim();
                      const qtyVal = String(it?.quantity ?? it?.qty ?? '1').trim() || '1';
                      const priceVal = String(it?.price ?? '').replace(/,/g, '').trim();
                      const rawLocOfficial = String(it?.location_official ?? it?.location ?? '').trim();
                      const rawNote = String(it?.handwritten_note ?? it?.note ?? '').trim();
                      const rawStatus = String(it?.status || 'ปกติ').trim();
                      const locWithoutWorkingRoom = rawLocOfficial.replace(/ห้องทำงาน/g, '');
                      const combinedStatusNote = `${rawStatus} ${rawNote}`;

                      let normalizedStatus = rawStatus || 'ปกติ';
                      if (/ส่งคืน/.test(`${combinedStatusNote} ${rawLocOfficial}`)) {
                        normalizedStatus = 'ส่งคืน';
                      } else if (
                        /ชำรุด/.test(`${combinedStatusNote} ${rawLocOfficial}`) ||
                        /ไม่ทำงาน/.test(`${combinedStatusNote} ${locWithoutWorkingRoom}`)
                      ) {
                        normalizedStatus = 'ชำรุด';
                      } else if (/เก็บสำรอง|เราเก็บไว้|เราเบิกชื่อ/.test(`${combinedStatusNote} ${rawLocOfficial}`)) {
                        normalizedStatus = 'เก็บสำรอง';
                      } else if (/ให้ยืม/.test(`${combinedStatusNote} ${rawLocOfficial}`)) {
                        normalizedStatus = 'ให้ยืม';
                      } else if (!normalizedStatus || /^ปก/.test(normalizedStatus)) {
                        normalizedStatus = 'ปกติ';
                      }

                      const isMarkedX = Boolean(it?.is_marked_x ?? it?.isMarked);

                      return {
                        seq: seqVal,
                        asset_number: assetVal,
                        sap_code: sapVal,
                        name: String(it?.name || '').trim(),
                        brand_model: brandVal,
                        source_budget: sourceVal,
                        acquired_date: dateVal,
                        quantity: qtyVal,
                        price: priceVal,
                        location_official: rawLocOfficial,
                        handwritten_note: rawNote,
                        is_marked_x: isMarkedX,
                        // Backward-compatible aliases
                        orderNumber: seqVal,
                        assetCode: assetVal,
                        sapCode: sapVal,
                        brandModel: brandVal,
                        location: rawLocOfficial,
                        status: normalizedStatus,
                        note: rawNote,
                        isMarked: isMarkedX || Boolean(rawNote),
                      };
                    }),
                  }
                : {}),
              ...(rawChecklistItems.length > 0
                ? {
                    checklistItems: rawChecklistItems.map((it: any) => {
                      const rawStatus = String(it?.status || 'COMPLETE').toUpperCase();
                      const normStatus: 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED' =
                        rawStatus.includes('EXPIRE')
                          ? 'EXPIRED'
                          : rawStatus.includes('INCOMPLETE') || rawStatus.includes('DEFECT') || rawStatus.includes('LOW')
                          ? 'INCOMPLETE'
                          : 'COMPLETE';
                      return {
                        name: String(it?.name || it?.itemName || '').trim(),
                        expected: String(it?.expected ?? '1').trim(),
                        actual: String(it?.actual ?? (normStatus === 'COMPLETE' ? it?.expected ?? '1' : '0')).trim(),
                        exp: String(it?.exp || '').trim(),
                        status: normStatus,
                        issue: String(it?.issue || '').trim(),
                      };
                    }),
                  }
                : {}),
            };
          }
        } catch {
          // Keep cleaned plain text if not valid JSON
        }
      }

      if (!suggestedChoices.length) {
        const choicesDelimiterMatch = replyText.match(/(?:===CHOICES===|---CHOICES---|\[CHOICES\])([\s\S]*)$/i);
        if (choicesDelimiterMatch) {
          const rawChoices = choicesDelimiterMatch[1]
            .split('\n')
            .map((line: string) => line.replace(/^[-*•\d.)\]\s]+/, '').trim())
            .filter((line: string) => line.length > 0 && !line.startsWith('==='));
          if (rawChoices.length > 0) {
            suggestedChoices = rawChoices.slice(0, 3);
            replyText = replyText.substring(0, choicesDelimiterMatch.index).trim();
          }
        }
      }

      if (primaryCall) {
        const fnName = primaryCall.name;
        const fnArgs = (primaryCall.args as any) || {};
        if (fnName === 'delete_specific_items') {
          suggestedChoices = ['📋 สรุปส่งเวร (Shift Handover)', '💼 เปิดกระเป๋าฉุกเฉิน', '🚑 เปิดรถพยาบาลฉุกเฉิน'];
        } else if (fnName === 'delete_all_items' || fnName === 'delete_all_equipment' || fnName === 'clear_category_items' || fnName === 'clearTargetInventory') {
          suggestedChoices = ['🏥 เปิดภาพรวมครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)', '💊 เช็กสต็อกคลังยาวิสัญญี'];
        } else if (fnName === 'add_new_item') {
          suggestedChoices = ['📋 สรุปส่งเวร (Shift Handover)', '🏥 เปิดภาพรวมครุภัณฑ์', '💼 เปิดกระเป๋าฉุกเฉิน'];
        } else if (fnName === 'resetChecklist') {
          suggestedChoices = ['🚨 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน', '🚑 ตรวจเช็กรถพยาบาลฉุกเฉิน'];
        } else if (fnName === 'navigate_or_export' || fnName === 'navigateToPage' || fnName === 'navigate_app') {
          const page = String(fnArgs.page || fnArgs.targetView || '');
          if (page.includes('cart')) {
            suggestedChoices = ['📸 สแกนใบตรวจเช็กรถ', '✅ เช็กครบทุกรายการในรถ', '💊 ตรวจยาวิสัญญี'];
          } else if (page.includes('ambulance')) {
            suggestedChoices = ['✅ เช็กครบรถพยาบาล', '💼 ไปหน้ากระเป๋าฉุกเฉิน', '📋 สรุปส่งเวร (Shift Handover)'];
          } else if (page.includes('bag')) {
            suggestedChoices = ['📸 สแกนใบตรวจเช็กกระเป๋า', '✅ เช็กครบทุกรายการในกระเป๋า', '🚨 ไปหน้ารถฉุกเฉิน'];
          } else if (page.includes('drug')) {
            suggestedChoices = ['⚠️ สรุปยาใกล้หมดอายุ', '📦 เช็กสต็อก Adrenaline', '📋 สรุปส่งเวร (Shift Handover)'];
          } else {
            suggestedChoices = ['📋 สรุปส่งเวร (Shift Handover)', '🚨 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน'];
          }
          if (fnName === 'navigate_app' || fnName === 'navigate_or_export') {
            replyText = replyText || `กำลังดำเนินการเปิดหน้าที่ต้องการให้แล้วค่ะ ✨🌸`;
          }
        } else if (fnName === 'auditPaperChecklist') {
          suggestedChoices = ['📸 ถ่ายรูปหรือแนบภาพใบตรวจเช็ค', '🚨 ไปหน้ารถฉุกเฉิน', '💼 ไปหน้ากระเป๋าฉุกเฉิน'];
        } else if (fnName === 'generateShiftHandover') {
          suggestedChoices = ['⚠️ สรุปยาใกล้หมดอายุ', '🚨 ไปหน้ารถฉุกเฉิน', '💼 ไปหน้ากระเป๋าฉุกเฉิน'];
        } else if (fnName === 'update_specific_item' || fnName === 'updateInventoryItem' || fnName === 'update_item_status' || fnName === 'update_equipment_or_drug_status') {
          suggestedChoices = ['📋 สรุปส่งเวร (Shift Handover)', '💊 ตรวจสอบคลังยา', '🏥 เปิดภาพรวมครุภัณฑ์'];
        } else if (fnName === 'create_restock_requisition') {
          suggestedChoices = ['💊 เปิดหน้าคลังยา', '📋 สรุปส่งเวร (Shift Handover)', '⚠️ สรุปยาใกล้หมดอายุ'];
        } else if (fnName === 'attach_photos_by_number') {
          parsedAction = {
            type: 'MATCH_EQUIPMENT_PHOTOS',
            mappings: Array.isArray(fnArgs.mappings) ? fnArgs.mappings : [],
          };
          replyText = replyText || 'น้องออร่าได้วิเคราะห์และจับคู่รูปภาพกับครุภัณฑ์ตามลำดับให้เรียบร้อยแล้วค่ะ ✨🌸';
          suggestedChoices = ['💾 บันทึกรูปภาพทั้งหมด', '🔍 เช็กครุภัณฑ์ที่ยังขาดรูป', '🏥 เปิดดูหน้าครุภัณฑ์'];
        } else if (fnName === 'import_equipment_from_table') {
          replyText = replyText || 'น้องออร่าเตรียมนำเข้าครุภัณฑ์จากตารางให้แล้วค่ะ ✨🌸';
          suggestedChoices = ['📋 ตรวจสอบรายการ', '🏥 เปิดดูหน้าครุภัณฑ์'];
        }
      } else if (!parsedAction) {
        const looksLikeFakeExecution = /(ดำเนินการ.*เรียบร้อย|ลบ.*เรียบร้อย|ลบ.*ทั้งหมดแล้ว|บันทึก.*เรียบร้อยแล้ว|อัปเดต.*เรียบร้อยแล้ว|เพิ่ม.*เรียบร้อยแล้ว|ย้าย.*เรียบร้อยแล้ว)/i.test(replyText);
        if (looksLikeFakeExecution && isLikelyActionCommand(promptText)) {
          replyText =
            'ขออภัยค่ะ คำสั่งนี้ยังไม่ได้ถูกดำเนินการกับฐานข้อมูลจริงผ่านแชทอัตโนมัติในรอบนี้ ✨\n\nรบกวนพี่พยาบาลระบุชื่อรายการ/หมวดหมู่ให้ชัดเจนขึ้น (เช่น "ลบ 11. T-piece / Tube ในเป๋า") หรือดำเนินการผ่านปุ่มจัดการในหน้าเว็บโดยตรงได้เลยนะคะ';
          suggestedChoices = ['🏥 เปิดภาพรวมครุภัณฑ์', '💼 เปิดกระเป๋าฉุกเฉิน', '📋 สรุปส่งเวร (Shift Handover)'];
        }
      }

      if (!suggestedChoices.length) {
        suggestedChoices = ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน'];
      }

      return res.json({
        success: true,
        text: replyText,
        reply: replyText,
        suggestedChoices,
        action: parsedAction,
        functionCall: primaryCall ? { name: primaryCall.name, args: primaryCall.args } : null,
        functionCalls: functionCalls || [],
        groundingMetadata: rawGrounding,
        sources: groundingSources,
      });
    } catch (err: any) {
      console.error('[AuraChat] Unexpected server error:', err?.message || err);
      return res.json({
        success: false,
        isQuotaExceeded: false,
        error: 'API_ERROR',
        message: '🙏 ขออภัยค่ะ เกิดข้อขัดข้องระหว่างการสื่อสารกับระบบ AI กรุณาลองใหม่อีกครั้งนะคะ ✨🌸',
      });
    }
  });

  return router;
}
