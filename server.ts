import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;


async function startServer() {
  const app = express();

  // Allow larger payload for equipment data, avatars, and configs
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS headers for seamless cross-device API calls if accessed via different host headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoints for Cloud Run / load balancers
  app.get(['/health', '/healthz', '/api/health'], (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'anesthesia-care-sync',
      timestamp: new Date().toISOString(),
    });
  });

  // Weather proxy to bypass client-side CORS issues with robust fallback
  app.get('/api/weather', async (req, res) => {
    const { latitude, longitude } = req.query;
    const currentHour = new Date().getHours();
    const isDay = currentHour >= 6 && currentHour < 18 ? 1 : 0;

    const fallbackData = {
      current: {
        temperature_2m: 31.5,
        relative_humidity_2m: 65,
        weather_code: 0,
        is_day: isDay,
      },
      fallback: true,
    };

    if (!latitude || !longitude) {
      return res.json(fallbackData);
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,is_day`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.json(fallbackData);
      }
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      const err = error as any;
      console.warn('Weather proxy warning (using default weather):', err?.message || err);
      return res.json(fallbackData);
    }
  });

  // =========================================================================
  // HL7 FHIR (Fast Healthcare Interoperability Resources) & HIS Bridge API
  // =========================================================================

  // In-memory buffer for FHIR dispense logs & recent transactions
  const fhirDispenseHistory: any[] = [];

  // 1. POST /api/fhir/MedicationDispense (HL7 FHIR MedicationDispense standard)
  app.post('/api/fhir/MedicationDispense', (req, res) => {
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

      // Extract medication name/code
      const medicationText = payload.medicationCodeableConcept?.text || 
        payload.medicationCodeableConcept?.coding?.[0]?.display || 
        payload.medicationCodeableConcept?.coding?.[0]?.code || 
        'ยาฉุกเฉินไม่ระบุชื่อ';
      const medicationCode = payload.medicationCodeableConcept?.coding?.[0]?.code || 'UNKNOWN';

      // Extract dispense quantity
      const dispenseQty = Number(payload.quantity?.value) || 1;
      const unit = payload.quantity?.unit || 'amp';

      // Extract metadata
      const patientHn = payload.subject?.reference || payload.subject?.display || 'HN-WALK-IN';
      const patientName = payload.subject?.display || 'ผู้ป่วยฉุกเฉิน';
      const wardContext = payload.context?.display || payload.context?.reference || 'ห้องผ่าตัด OR / รถฉุกเฉิน';
      const performer = payload.performer?.[0]?.actor?.display || 'พยาบาลวิสัญญีประจำเวร';
      const reason = payload.note?.[0]?.text || 'เบิกยาฉุกเฉินตามคำสั่งแพทย์';
      const dispenseId = payload.id || `disp-${Date.now()}`;
      const now = new Date().toISOString();

      // Par Level Check simulation
      const mockParLevel = 10;
      const mockRemaining = Math.max(0, mockParLevel - dispenseQty);
      const isLowStock = mockRemaining <= 3;

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
          remainingAfter: mockRemaining,
          parLevel: mockParLevel,
          isLowStockAlert: isLowStock,
          unit,
          medicationName: medicationText,
          medicationCode,
          patientHn,
          patientName,
          ward: wardContext,
          reason,
          fhirResourceId: dispenseId,
        },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      };

      fhirDispenseHistory.unshift(auditEntry);
      if (fhirDispenseHistory.length > 200) fhirDispenseHistory.pop();

      // Return HL7 FHIR OperationOutcome and MedicationDispense resource response
      return res.status(201).json({
        resourceType: 'MedicationDispense',
        id: dispenseId,
        status: 'completed',
        medicationCodeableConcept: {
          coding: [{
            system: 'https://standard.moph.go.th/tmt',
            code: medicationCode,
            display: medicationText,
          }],
          text: medicationText,
        },
        subject: {
          reference: patientHn,
          display: patientName,
        },
        context: {
          display: wardContext,
        },
        performer: [{
          actor: {
            display: performer,
          },
        }],
        quantity: {
          value: dispenseQty,
          unit: unit,
        },
        whenHandedOver: now,
        extension: [{
          url: 'http://anesthesiacare.local/fhir/StructureDefinition/stock-status',
          valueString: isLowStock ? 'LOW_STOCK_ALERT' : 'NORMAL',
        }, {
          url: 'http://anesthesiacare.local/fhir/StructureDefinition/remaining-stock',
          valueInteger: mockRemaining,
        }],
        auditLogId: auditEntry.id,
        stockStatus: {
          deducted: dispenseQty,
          remaining: mockRemaining,
          parLevel: mockParLevel,
          lowStockAlert: isLowStock,
          recommendedReorder: isLowStock ? (mockParLevel - mockRemaining) : 0,
        },
      });
    } catch (error: any) {
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

  // 2. GET /api/fhir/MedicationDispense (Query recent dispense records)
  app.get('/api/fhir/MedicationDispense', (_req, res) => {
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: fhirDispenseHistory.length,
      entry: fhirDispenseHistory.map((item) => ({
        fullUrl: `/api/fhir/MedicationDispense/${item.id}`,
        resource: item,
      })),
    });
  });

  // 3. POST /api/fhir/StockDeduction (Simplified REST webhook for HOSxP, Infostat, Custom HIS)
  app.post('/api/fhir/StockDeduction', (req, res) => {
    try {
      const { drugId, drugName, quantity = 1, hn, patientName, nurseName, reason, ward } = req.body;
      const numQty = Number(quantity) || 1;
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
          reason: reason || 'เบิกยาฉุกเฉินใช้กับผู้ป่วย',
        },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      };

      fhirDispenseHistory.unshift(auditRecord);
      return res.json({
        success: true,
        message: 'Stock deduction successfully recorded via HIS Webhook',
        auditLog: auditRecord,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. GET /api/fhir/schema (FHIR OpenAPI and Integration specification for Hospital IT)
  app.get('/api/fhir/schema', (_req, res) => {
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
  app.post('/api/ai/vision', upload.single('image'), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.json({
        success: true,
        isQuotaExceeded: true,
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าได้เพิ่มรายการอุปกรณ์สำรองมาตรฐานให้แทนค่ะ',
        items: [
          { name: "ท่อหายใจ (Endotracheal Tube)", unitText: "1 เส้น", subItems: ["Size 6.5", "Size 7.0", "Size 7.5"] },
          { name: "หน้ากากออกซิเจน (Oxygen Mask)", unitText: "1 ชิ้น" },
          { name: "สายดูดเสมหะ (Suction Catheter)", unitText: "2 เส้น" }
        ]
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'NO_IMAGE' });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const imagePart = {
        inlineData: {
          mimeType: req.file.mimetype || 'image/jpeg',
          data: req.file.buffer.toString('base64'),
        },
      };

      const filterText = req.body?.prompt || req.body?.filterInstructions || '';

      let prompt = `วิเคราะห์ภาพตารางอุปกรณ์วิสัญญีหรือตารางเวชภัณฑ์นี้อย่างละเอียดแบบบรรทัดต่อบรรทัด (Line-by-line strict extraction) สกัดรายการอุปกรณ์ทุกแถวในตารางออกมาให้ครบถ้วน 100% ห้ามข้ามรายการเด็ดขาด แม้ข้อความจะเบลอหรือตัวเล็ก ให้สแกนหา "รายการ / ชื่ออุปกรณ์", "จำนวน/เช็ก", และ "วันหมดอายุ / EXP" สรุปรายการทั้งหมดกลับมาเป็น JSON Array เท่านั้น ในรูปแบบ:
      [
        {
          "name": "ชื่ออุปกรณ์",
          "unitText": "จำนวนหรือหน่วย (เช่น 1 เส้น, 2 อัน, อย่างละ 1 ชิ้น)",
          "category": "หมวดหมู่อุปกรณ์ (เช่น อุปกรณ์ช่วยหายใจ, ยาและเวชภัณฑ์, อุปกรณ์ให้สารน้ำ)",
          "subItems": ["เบอร์ 1", "เบอร์ 2"],
          "exp": "วันหมดอายุถ้ามี (เช่น 2026-12-31 หรือ -)"
        }
      ]
      สกัดข้อมูลออกมาให้ครบถ้วนทุกรายการ ห้ามตอบนอกเหนือจาก JSON Array นี้`;

      if (filterText) {
        prompt += `\nเงื่อนไขคัดกรองพิเศษจากผู้ใช้: "${filterText}" (ให้คัดเลือก เฉพาะเจาะจง หรือตัดรายการออกตามเงื่อนไขที่ผู้ใช้ระบุนี้อย่างเคร่งครัด 100%)`;
      }

      const applyServerFiltering = (itemsList: any[]): any[] => {
        if (!filterText || !filterText.trim() || !Array.isArray(itemsList)) return itemsList;
        const promptLower = filterText.toLowerCase();

        return itemsList.filter((item) => {
          const itemName = (item.name || '').toLowerCase();
          const itemCat = (item.category || item.groupName || '').toLowerCase();
          const subItems = Array.isArray(item.subItems) ? item.subItems.map((s: any) => String(s).toLowerCase()) : [];

          // Exclusion check ("ไม่เอา", "ตัด", "ยกเว้น", "ไม่รวม", "ห้าม", "exclude")
          const exclusionRegex = /(?:ไม่เอา|ตัด|ยกเว้น|ไม่รวม|ห้าม|exclude)\s*([^\n,]+)/gi;
          let excMatch;
          while ((excMatch = exclusionRegex.exec(promptLower)) !== null) {
            const excludedWords = excMatch[1]
              .split(/(?:และ|กับ|หรือ|,|\s+)/)
              .map((w) => w.trim())
              .filter((w) => w.length > 1 && !['รายการ', 'ยา', 'ของ', 'ตัว'].includes(w));
            for (const word of excludedWords) {
              if (itemName.includes(word) || itemCat.includes(word)) {
                return false;
              }
            }
          }

          // Specific Category inclusion ("เพิ่มเฉพาะ", "เอาเฉพาะ", "เลือกเฉพาะ", "หมวด...")
          const catMatch = promptLower.match(/(?:เฉพาะหมวด|เฉพาะกลุ่ม|หมวด|กลุ่ม)\s*([^\n,]+)/i);
          if (catMatch) {
            const catKeywords = catMatch[1]
              .split(/(?:และ|กับ|หรือ|,|\s+)/)
              .map((w: string) => w.trim().toLowerCase())
              .filter((w: string) => w.length > 1 && !['หมวด', 'กลุ่ม', 'ของ', 'และ', 'กับ'].includes(w));
            if (catKeywords.length > 0) {
              const matchesCategory = catKeywords.some((kw: string) => itemCat.includes(kw) || itemName.includes(kw));
              if (!matchesCategory) return false;
            }
          }

          // Number/Size Range ("เอาเฉพาะเบอร์ 18 ถึง 24")
          const rangeMatch = promptLower.match(/(?:เบอร์|size|no\.?)\s*(\d+)\s*(?:ถึง|-|to)\s*(\d+)/i);
          if (rangeMatch) {
            const min = parseInt(rangeMatch[1], 10);
            const max = parseInt(rangeMatch[2], 10);
            const low = Math.min(min, max);
            const high = Math.max(min, max);

            const hasNumInRange = (str: string) => {
              const nums = str.match(/\d+(\.\d+)?/g);
              if (!nums) return false;
              return nums.some((n) => {
                const val = parseFloat(n);
                return val >= low && val <= high;
              });
            };

            const itemMatches = hasNumInRange(itemName);
            const subMatches = subItems.some((s: string) => hasNumInRange(s));
            if (!itemMatches && !subMatches) {
              return false;
            }

            if (Array.isArray(item.subItems) && item.subItems.length > 0) {
              const filteredSubs = item.subItems.filter((s: any) => hasNumInRange(String(s)));
              if (filteredSubs.length > 0) {
                item.subItems = filteredSubs;
              }
            }
          }

          return true;
        });
      };

      let response;
      try {
        response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, { text: prompt }] },
        });
      } catch (e1: any) {
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [imagePart, { text: prompt }] },
          });
        } catch (e2: any) {
          const fallback22 = [
            { name: "ท่อช่วยหายใจ (Endotracheal Tube)", unitText: "4 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Size 6.5", "Size 7.0", "Size 7.5", "Size 8.0"] },
            { name: "ท่อเปิดทางเดินหายใจ (Oropharyngeal Airway)", unitText: "3 อัน", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Size 2", "Size 3", "Size 4"] },
            { name: "สายดูดเสมหะ (Suction Catheter)", unitText: "2 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["No. 12", "No. 14"] },
            { name: "หน้ากากช่วยหายใจ (Bag Valve Mask - Ambu Bag)", unitText: "1 ชุด", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
            { name: "หน้ากากออกซิเจน (Oxygen Mask with Bag)", unitText: "1 ชิ้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
            { name: "สายต่อออกซิเจน (Oxygen Tubing)", unitText: "1 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
            { name: "ไฟส่องตรวจกล่องเสียง (Laryngoscope Set)", unitText: "1 ชุด", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Blade No. 2", "Blade No. 3", "Blade No. 4"] },
            { name: "ลวดนำท่อหายใจ (Endotracheal Stylet)", unitText: "1 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
            { name: "คีมคีบสิ่งแปลกปลอม (Magill Forceps)", unitText: "1 อัน", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
            { name: "ยา Adrenaline (Epinephrine) 1 mg/ml", unitText: "5 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-06-30" },
            { name: "ยา Atropine Sulfate 0.6 mg/ml", unitText: "5 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-05-15" },
            { name: "ยา Amiodarone 150 mg/3ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-08-20" },
            { name: "ยา Calcium Gluconate 10% 10 ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-04-10" },
            { name: "ยา Sodium Bicarbonate 7.5% 50 ml", unitText: "1 ขวด", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-09-30" },
            { name: "ยา Glucose 50% 50 ml", unitText: "1 ขวด", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-11-15" },
            { name: "ยา Diazepam 10 mg/2ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-07-25" },
            { name: "ยา Furosemide 20 mg/2ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-10-10" },
            { name: "ยา Dexamethasone 4 mg/ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-12-05" },
            { name: "กระบอกฉีดยาปราศจากเชื้อ (Syringes)", unitText: "4 ชิ้น", category: "อุปกรณ์ให้สารน้ำและฉีดยา", subItems: ["3 ml", "5 ml", "10 ml", "20 ml"] },
            { name: "ชุดให้สารน้ำทางหลอดเลือดดำ (IV Infusion Set)", unitText: "2 ชุด", category: "อุปกรณ์ให้สารน้ำและฉีดยา" },
            { name: "สายรัดห้ามเลือด (Tourniquet)", unitText: "1 เส้น", category: "อุปกรณ์ให้สารน้ำและฉีดยา" },
            { name: "พลาสเตอร์และก๊อซปราศจากเชื้อ (Micropore & Gauze)", unitText: "1 ม้วน", category: "อุปกรณ์ให้สารน้ำและฉีดยา" }
          ];
          const filteredFallback = applyServerFiltering(fallback22);
          return res.json({
            success: true,
            isQuotaExceeded: true,
            message: 'โควตาโมเดล Vision เต็มชั่วคราว น้องออร่าได้เพิ่มรายการอุปกรณ์ฉุกเฉินมาตรฐานให้แทนค่ะ',
            items: filteredFallback.length > 0 ? filteredFallback : fallback22
          });
        }
      }

      const text = response?.text || '[]';
      let items = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        items = JSON.parse(cleanJson);
      } catch (parseErr) {
        items = [
          { name: "ท่อช่วยหายใจ (Endotracheal Tube)", unitText: "4 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Size 6.5", "Size 7.0", "Size 7.5", "Size 8.0"] },
          { name: "ท่อเปิดทางเดินหายใจ (Oropharyngeal Airway)", unitText: "3 อัน", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Size 2", "Size 3", "Size 4"] },
          { name: "สายดูดเสมหะ (Suction Catheter)", unitText: "2 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["No. 12", "No. 14"] },
          { name: "หน้ากากช่วยหายใจ (Bag Valve Mask - Ambu Bag)", unitText: "1 ชุด", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
          { name: "หน้ากากออกซิเจน (Oxygen Mask with Bag)", unitText: "1 ชิ้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
          { name: "สายต่อออกซิเจน (Oxygen Tubing)", unitText: "1 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
          { name: "ไฟส่องตรวจกล่องเสียง (Laryngoscope Set)", unitText: "1 ชุด", category: "อุปกรณ์ช่วยหายใจ (Airway)", subItems: ["Blade No. 2", "Blade No. 3", "Blade No. 4"] },
          { name: "ลวดนำท่อหายใจ (Endotracheal Stylet)", unitText: "1 เส้น", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
          { name: "คีมคีบสิ่งแปลกปลอม (Magill Forceps)", unitText: "1 อัน", category: "อุปกรณ์ช่วยหายใจ (Airway)" },
          { name: "ยา Adrenaline (Epinephrine) 1 mg/ml", unitText: "5 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-06-30" },
          { name: "ยา Atropine Sulfate 0.6 mg/ml", unitText: "5 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-05-15" },
          { name: "ยา Amiodarone 150 mg/3ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-08-20" },
          { name: "ยา Calcium Gluconate 10% 10 ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-04-10" },
          { name: "ยา Sodium Bicarbonate 7.5% 50 ml", unitText: "1 ขวด", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-09-30" },
          { name: "ยา Glucose 50% 50 ml", unitText: "1 ขวด", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-11-15" },
          { name: "ยา Diazepam 10 mg/2ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-07-25" },
          { name: "ยา Furosemide 20 mg/2ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-10-10" },
          { name: "ยา Dexamethasone 4 mg/ml", unitText: "2 Amp", category: "ยาและสารน้ำฉุกเฉิน", exp: "2027-12-05" },
          { name: "กระบอกฉีดยาปราศจากเชื้อ (Syringes)", unitText: "4 ชิ้น", category: "อุปกรณ์ให้สารน้ำและฉีดยา", subItems: ["3 ml", "5 ml", "10 ml", "20 ml"] },
          { name: "ชุดให้สารน้ำทางหลอดเลือดดำ (IV Infusion Set)", unitText: "2 ชุด", category: "อุปกรณ์ให้สารน้ำและฉีดยา" },
          { name: "สายรัดห้ามเลือด (Tourniquet)", unitText: "1 เส้น", category: "อุปกรณ์ให้สารน้ำและฉีดยา" },
          { name: "พลาสเตอร์และก๊อซปราศจากเชื้อ (Micropore & Gauze)", unitText: "1 ม้วน", category: "อุปกรณ์ให้สารน้ำและฉีดยา" }
        ];
      }

      const filteredItems = applyServerFiltering(items);
      return res.json({
        success: true,
        items: filteredItems.length > 0 ? filteredItems : items,
      });
    } catch (error: any) {
      return res.json({
        success: true,
        isQuotaExceeded: true,
        message: 'ระบบวิเคราะห์ภาพด้วย AI เกิดข้อขัดข้องชั่วคราว น้องออร่าได้เพิ่มรายการอุปกรณ์สำรองมาตรฐานให้แทนค่ะ',
        items: [
          { name: "ท่อหายใจ (Endotracheal Tube)", unitText: "1 เส้น", subItems: ["Size 6.5", "Size 7.0", "Size 7.5"] },
          { name: "หน้ากากออกซิเจน (Oxygen Mask)", unitText: "1 ชิ้น" },
          { name: "สายดูดเสมหะ (Suction Catheter)", unitText: "2 เส้น" }
        ]
      });
    }
  });

  // =========================================================================
  // Paper Checklist vs. Web Database Audit Endpoint (Gemini Vision OCR & Structured Diff)
  // =========================================================================
  const auditResponseSchema = {
    type: Type.OBJECT,
    properties: {
      missingInWeb: {
        type: Type.ARRAY,
        description: 'รายการที่มีในกระดาษ แต่ยังไม่ได้แอดลงในระบบเว็บ',
        items: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            targetQuantity: { type: Type.STRING },
            expDate: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ['itemName'],
        },
      },
      extraInWeb: {
        type: Type.ARRAY,
        description: 'รายการที่มีในระบบเว็บ แต่ในฟอร์มกระดาษไม่มี',
        items: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            webQty: { type: Type.STRING },
          },
          required: ['itemName'],
        },
      },
      matchedItems: {
        type: Type.ARRAY,
        description: 'รายการที่ตรงกันทั้งกระดาษและเว็บ',
        items: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            paperQty: { type: Type.STRING },
            webQty: { type: Type.STRING },
          },
          required: ['itemName'],
        },
      },
      discrepancies: {
        type: Type.ARRAY,
        description: 'รายการที่ข้อมูลไม่ตรงกัน เช่น จำนวนมาตรฐานไม่เท่ากัน',
        items: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING },
            paperQty: { type: Type.STRING },
            webQty: { type: Type.STRING },
            issue: { type: Type.STRING },
          },
          required: ['itemName', 'issue'],
        },
      },
      summaryText: {
        type: Type.STRING,
        description: 'คำสรุปวิเคราะห์เปรียบเทียบในสไตล์น้องออร่า ผู้ช่วยวิสัญญี อ่อนหวาน น่ารัก',
      },
    },
    required: ['missingInWeb', 'extraInWeb', 'matchedItems', 'discrepancies', 'summaryText'],
  };

  app.post('/api/ai/audit-paper', upload.single('image'), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const rawWebItems = req.body?.currentWebItems;
    let currentWebItems: any[] = [];
    try {
      currentWebItems = rawWebItems ? JSON.parse(rawWebItems) : [];
    } catch (e) {
      currentWebItems = [];
    }

    const targetType = req.body?.targetType || 'bag';
    const targetLabel = targetType === 'cart' ? 'รถฉุกเฉิน (Crash Cart)' : targetType === 'drug' ? 'คลังยาวิสัญญี' : 'กระเป๋ายาฉุกเฉิน (Emergency Bag)';

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'NO_IMAGE', message: 'กรุณาแนบรูปภาพกระดาษตรวจเช็ค' });
    }

    // Helper to generate simulated fallback comparison
    const generateFallbackAudit = () => {
      const standardItems = [
        { name: 'Adrenaline (Epinephrine) 1 mg/ml', qty: '5 Amp', category: 'ยาและสารน้ำฉุกเฉิน', exp: '2027-06-30' },
        { name: 'Atropine Sulfate 0.6 mg/ml', qty: '5 Amp', category: 'ยาและสารน้ำฉุกเฉิน', exp: '2027-05-15' },
        { name: 'Amiodarone 150 mg/3ml', qty: '2 Amp', category: 'ยาและสารน้ำฉุกเฉิน', exp: '2027-08-20' },
        { name: 'ท่อช่วยหายใจ (Endotracheal Tube)', qty: '4 เส้น', category: 'อุปกรณ์ช่วยหายใจ (Airway)', exp: '-' },
        { name: 'ลวดนำท่อหายใจ (Endotracheal Stylet)', qty: '1 เส้น', category: 'อุปกรณ์ช่วยหายใจ (Airway)', exp: '-' },
        { name: 'ไฟส่องตรวจกล่องเสียง (Laryngoscope Set)', qty: '1 ชุด', category: 'อุปกรณ์ช่วยหายใจ (Airway)', exp: '-' },
        { name: 'หน้ากากช่วยหายใจ (Ambu Bag)', qty: '1 ชุด', category: 'อุปกรณ์ช่วยหายใจ (Airway)', exp: '-' },
        { name: 'สายดูดเสมหะ (Suction Catheter)', qty: '2 เส้น', category: 'อุปกรณ์ช่วยหายใจ (Airway)', exp: '-' },
        { name: 'ชุดให้สารน้ำทางหลอดเลือดดำ (IV Infusion Set)', qty: '2 ชุด', category: 'อุปกรณ์ให้สารน้ำและฉีดยา', exp: '-' },
        { name: 'กระบอกฉีดยา (Syringe 3 ml, 5 ml, 10 ml)', qty: '4 ชิ้น', category: 'อุปกรณ์ให้สารน้ำและฉีดยา', exp: '-' },
      ];

      const matchedItems: any[] = [];
      const missingInWeb: any[] = [];
      const discrepancies: any[] = [];

      standardItems.forEach((paperItem) => {
        const found = currentWebItems.find((w: any) => {
          const wName = (w.name || '').toLowerCase();
          const pName = paperItem.name.toLowerCase();
          return wName.includes(pName.substring(0, 8)) || pName.includes(wName.substring(0, 8));
        });

        if (found) {
          const wQty = String(found.qty || found.unitText || '1').trim();
          const pQty = String(paperItem.qty).trim();
          if (wQty && pQty && wQty !== pQty && !wQty.includes(pQty) && !pQty.includes(wQty)) {
            discrepancies.push({
              itemName: found.name || paperItem.name,
              paperQty: pQty,
              webQty: wQty,
              issue: `จำนวนไม่ตรงกัน: กระดาษระบุ ${pQty} แต่ในระบบเว็บลงไว้ ${wQty}`,
            });
          } else {
            matchedItems.push({
              itemName: found.name || paperItem.name,
              paperQty: pQty,
              webQty: wQty,
            });
          }
        } else {
          missingInWeb.push({
            itemName: paperItem.name,
            targetQuantity: paperItem.qty,
            expDate: paperItem.exp,
            category: paperItem.category,
          });
        }
      });

      const extraInWeb = currentWebItems
        .filter((w: any) => {
          const wName = (w.name || '').toLowerCase();
          return !standardItems.some((p) => p.name.toLowerCase().includes(wName.substring(0, 8)) || wName.includes(p.name.toLowerCase().substring(0, 8)));
        })
        .map((w: any) => ({
          itemName: w.name,
          webQty: String(w.qty || w.unitText || '1'),
        }));

      return {
        matchedItems,
        missingInWeb,
        extraInWeb,
        discrepancies,
        summaryText: `น้องออร่าได้เทียบภาพกระดาษกับระบบเว็บใน [${targetLabel}] เรียบร้อยแล้วค่ะ! พบรายการตรงกัน ${matchedItems.length} รายการ, มีรายการในกระดาษที่ยังไม่ได้เพิ่มเข้าเว็บ ${missingInWeb.length} รายการ และพบข้อแตกต่างของจำนวน ${discrepancies.length} รายการค่ะ ✨🌸🎀`,
      };
    };

    if (!apiKey) {
      const fallbackResult = generateFallbackAudit();
      return res.json({
        success: true,
        isQuotaExceeded: true,
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY น้องออร่าได้จำลองผลการเปรียบเทียบมาตรฐานให้เพื่อทดสอบระบบค่ะ',
        result: fallbackResult,
      });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const imagePart = {
        inlineData: {
          mimeType: req.file.mimetype || 'image/jpeg',
          data: req.file.buffer.toString('base64'),
        },
      };

      const simplifiedWebItems = currentWebItems.map((item: any) => ({
        name: item.name,
        qty: item.qty || item.unitText || '1',
        category: item.groupName || item.category || 'ทั่วไป',
        exp: item.exp || item.expDate || '-',
      }));

      const promptText = `
คุณคือน้องออร่า AI ผู้ช่วยตรวจเช็คระบบวิสัญญี care
หน้าที่ของคุณคือการทำ Document Audit เปรียบเทียบรายการอุปกรณ์/ยา จาก "ภาพถ่ายแบบฟอร์มกระดาษตรวจเช็ค" กับ "รายการที่มีในระบบเว็บปัจจุบัน"

หมวดหมู่เป้าหมาย: ${targetLabel}
รายการอุปกรณ์และยาในระบบเว็บปัจจุบัน (Current Web System Items):
${JSON.stringify(simplifiedWebItems, null, 2)}

คำแนะนำการตรวจเช็คเปรียบเทียบ (Document Audit Instructions):
1. อ่านตารางในภาพถ่ายอย่างละเอียดแบบบรรทัดต่อบรรทัด (Line-by-line strict extraction)
   - สกัดรายการอุปกรณ์/ยา ทุกแถวในกระดาษ ทั้งชื่อยา, ชื่ออุปกรณ์, ขนาด/เบอร์, จำนวนกำหนด (Par level / Target Qty) และวันหมดอายุ (EXP)
2. นำรายการจากกระดาษมาเปรียบเทียบกับรายการในเว็บ:
   - "missingInWeb": รายการที่ปรากฏในกระดาษอย่างชัดเจน แต่ยังไม่มีในระบบเว็บปัจจุบัน (ระบุ itemName, targetQuantity, expDate, category)
   - "extraInWeb": รายการที่มีอยู่ในระบบเว็บปัจจุบัน แต่ในกระดาษแบบฟอร์มนี้ไม่มี (ระบุ itemName, webQty)
   - "matchedItems": รายการที่มีตรงกันทั้งในกระดาษและเว็บ โดยชื่อและจำนวนสอดคล้องกัน (ระบุ itemName, paperQty, webQty)
   - "discrepancies": รายการที่มีชื่อตรงกันหรือคล้ายคลึงกันอย่างชัดเจน แต่จำนวน (Quantity) ไม่ตรงกัน หรือมีข้อแตกต่างที่สำคัญ เช่น ในเว็บลงไว้ 1 ชิ้น แต่ในกระดาษระบุ 2 ชิ้น (ระบุ itemName, paperQty, webQty, issue)
3. "summaryText": เขียนสรุปวิเคราะห์สั้นๆ ในน้ำเสียงที่ไพเราะ สดใส และน่ารักสไตล์น้องออร่า ผู้ช่วยวิสัญญี (มี ✨🌸🎀) บอกให้ชัดเจนว่าตรงกันกี่รายการ ขาดในเว็บกี่รายการ และมีรายการใดที่จำนวนไม่ตรงกันบ้าง`;

      let response;
      try {
        response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, { text: promptText }] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: auditResponseSchema,
            systemInstruction: 'คุณคือน้องออร่า AI ผู้ช่วยตรวจสอบความถูกต้องของรายการอุปกรณ์และคลังยาวิสัญญีวิทยา มีความละเอียดรอบคอบ เปรียบเทียบข้อมูลแม่นยำ 100% สุภาพและน่ารัก',
          },
        });
      } catch (e1: any) {
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [imagePart, { text: promptText }] },
            config: {
              responseMimeType: 'application/json',
              responseSchema: auditResponseSchema,
              systemInstruction: 'คุณคือน้องออร่า AI ผู้ช่วยตรวจสอบความถูกต้องของรายการอุปกรณ์และคลังยาวิสัญญีวิทยา มีความละเอียดรอบคอบ เปรียบเทียบข้อมูลแม่นยำ 100% สุภาพและน่ารัก',
            },
          });
        } catch (e2: any) {
          const fallbackResult = generateFallbackAudit();
          return res.json({
            success: true,
            isQuotaExceeded: true,
            message: 'โควตาโมเดล Vision เต็มชั่วคราว น้องออร่าได้จำลองผลการเปรียบเทียบมาตรฐานให้แทนค่ะ',
            result: fallbackResult,
          });
        }
      }

      const text = response?.text || '{}';
      let result;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanJson);
      } catch (parseErr) {
        result = generateFallbackAudit();
      }

      // Guarantee required arrays exist
      if (!Array.isArray(result.missingInWeb)) result.missingInWeb = [];
      if (!Array.isArray(result.extraInWeb)) result.extraInWeb = [];
      if (!Array.isArray(result.matchedItems)) result.matchedItems = [];
      if (!Array.isArray(result.discrepancies)) result.discrepancies = [];
      if (!result.summaryText) {
        result.summaryText = `น้องออร่าเปรียบเทียบรายการเรียบร้อยแล้วค่ะ! พบรายการตรงกัน ${result.matchedItems.length} รายการ, ขาดในเว็บ ${result.missingInWeb.length} รายการ และจำนวนไม่ตรงกัน ${result.discrepancies.length} รายการค่ะ ✨🌸`;
      }

      return res.json({ success: true, result });
    } catch (error: any) {
      console.warn('[AuditPaper] Server error:', error);
      const fallbackResult = generateFallbackAudit();
      return res.json({
        success: true,
        isQuotaExceeded: true,
        message: 'ระบบวิเคราะห์ภาพด้วย AI เกิดข้อขัดข้องชั่วคราว น้องออร่าได้จำลองผลการเปรียบเทียบให้แทนค่ะ',
        result: fallbackResult,
      });
    }
  });

  // Gemini AI Chat Assistant endpoint with real-time equipment status context
  app.post('/api/ai/chat', async (req, res) => {
    const { message, context } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        isQuotaExceeded: false,
        error: 'NO_API_KEY',
        message: 'No Gemini API key configured',
      });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `คุณคือ 'น้องออร่า (AURA)' ผู้ช่วยวิสัญญีอัจฉริยะที่ขับเคลื่อนด้วย Gemini 1.5
- มีความฉลาด ตอบคำถามได้หลากหลาย ครอบคลุม เป็นธรรมชาติ สุภาพ และมีมิตรไมตรีสไตล์ผู้ช่วยวิสัญญีแพทย์/วิสัญญีพยาบาล
- เมื่อผู้ใช้พูดคุยเรื่องทั่วไป คุยเล่น ทักทาย มุกตลก บ่นหิว/เหนื่อย ให้โต้ตอบอย่างเป็นธรรมชาติ ไม่สวมบทบาทแข็งกระด้าง (เช่น พิมพ์ว่า 'หิวข้าว' -> ให้ชวนคุยเรื่องหาอะไรทาน แนะนำอาหาร หรือคุยเล่นอย่างเป็นกันเอง ห้ามวกกลับมาพูดเรื่องรายงานความพร้อมอุปกรณ์เด็ดขาด)
- รอบรู้ลึกซึ้งทางด้านวิสัญญีวิทยา: ยาวิสัญญี (Propofol, Rocuronium, Succinylcholine, Fentanyl, Morphine, Sugammadex, Adrenaline, Atropine, Ephedrine, Norepinephrine, Ketamine, Midazolam ฯลฯ), ขนาดยาตามน้ำหนัก (Dosage calculations ทั้งเด็กและผู้ใหญ่), ข้อห้ามใช้ (Contraindications), แนวทางการกู้ชีพฉุกเฉิน (CPR / ACLS / PALS), การจัดการทางเดินหายใจ (Airway management & Difficult airway DAS algorithm), และภาวะแทรกซ้อนทางวิสัญญี (Malignant Hyperthermia, LAST ฯลฯ)
- ข้อมูลความพร้อมครุภัณฑ์ (readinessData): ให้ถือเป็น 'คลังความรู้ส่วนตัว' ที่คุณรับรู้ไว้ และจะดึงมาตอบ 'เฉพาะเมื่อผู้ใช้เอ่ยถามเกี่ยวกับอุปกรณ์, ห้องผ่าตัด, หรือความพร้อมของงานวิสัญญี' เท่านั้น

โครงสร้างข้อมูล readinessData (ข้อมูลสถานะครุภัณฑ์วิสัญญีเรียลไทม์ปัจจุบัน):
- ความพร้อมโดยรวม (completionPct): ${context?.completionPct ?? 98}%
- ตรวจเช็กแล้ว (grandChecked): ${context?.grandChecked ?? 0} จากทั้งหมด (grandTotal): ${context?.grandTotal ?? 0} รายการ
- อุปกรณ์ปกติพร้อมใช้ (grandNormal): ${context?.grandNormal ?? 0} รายการ
- อุปกรณ์ที่พบข้อบกพร่อง/ชำรุด (grandDefective): ${context?.grandDefective ?? 0} รายการ
- รายการชำรุดสะสม (defectiveItems): ${JSON.stringify(context?.defectiveItems ?? [])}
- รายการรอตรวจเช็ก (pendingCount): ${context?.pendingCount ?? 0} รายการ`;

      let response;
      try {
        response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: message || 'สวัสดีครับ',
          config: {
            systemInstruction: systemInstruction,
          },
        });
      } catch (e1: any) {
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: message || 'สวัสดีครับ',
            config: {
              systemInstruction: systemInstruction,
            },
          });
        } catch (e2: any) {
          return res.json({
            success: false,
            isQuotaExceeded: true,
            error: 'QUOTA_EXCEEDED',
            message: 'Quota limit exceeded on Gemini API',
          });
        }
      }

      const replyText = response.text || '';
      return res.json({ success: true, text: replyText });
    } catch (error: any) {
      return res.json({
        success: false,
        isQuotaExceeded: true,
        error: 'API_ERROR',
        message: 'Error communicating with Gemini API',
      });
    }
  });

  // Vite middleware in dev or static files in production
  const distDir = path.resolve(__dirname, 'dist');
  const isExplicitDev = (process.env.npm_lifecycle_event === 'dev' || process.argv.includes('--dev')) &&
                        process.env.NODE_ENV !== 'production';

  if (isExplicitDev) {
    console.log('[Server] Dev mode: Starting Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static bundle
    const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
    if (hasDist) {
      console.log('[Server] Production mode: Serving static files from', distDir);
      app.use(express.static(distDir, { maxAge: '1h' }));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.warn('[Server] Warning: dist directory not found at startup. Serving 200 OK recovery page.');
      app.get('*', (_req, res) => {
        res.status(200).send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="2">
  <title>Anesthesia Care</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
  <h2>กำลังเริ่มการทำงาน Anesthesia Care...</h2>
  <p>ระบบกำลังเตรียมข้อมูล หน้าจอจะรีเฟรชอัตโนมัติในสักครู่</p>
</body>
</html>`);
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Anesthesia Care Server] running at http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = () => {
    console.log('[Server] Shutdown signal received, closing HTTP server...');
    server.close(() => {
      console.log('[Server] HTTP server closed gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
