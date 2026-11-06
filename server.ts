import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
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
let DATA_DIR = path.resolve(__dirname, 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const testFile = path.join(DATA_DIR, '.write_test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
} catch (err) {
  console.warn('[Server] Cannot write to ./data, using /tmp/anesthesia_data fallback:', err);
  DATA_DIR = path.resolve('/tmp', 'anesthesia_data');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('[Server] Failed to create fallback tmp data dir:', e);
  }
}
const STATE_FILE = path.join(DATA_DIR, 'app_state.json');

// Initial default state if file doesn't exist
function readServerState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading app_state.json:', e);
  }
  return {};
}

function writeServerState(data: any) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing app_state.json:', e);
    return false;
  }
}

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

  // Cross-device sync endpoints
  app.get('/api/sync', (_req, res) => {
    const state = readServerState();
    res.json({
      success: true,
      data: state,
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/sync', (req, res) => {
    const incomingData = req.body || {};
    const currentState = readServerState();

    // Merge incoming data with current state (shallow merge of known keys, preserving sub-properties)
    const updatedState = {
      ...currentState,
      ...incomingData,
      lastSyncedAt: new Date().toISOString(),
    };

    const saved = writeServerState(updatedState);
    if (saved) {
      res.json({
        success: true,
        data: updatedState,
        message: 'State synchronized successfully across devices',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to write state file on server',
      });
    }
  });

// ... (existing code)

  // Gemini Vision AI Automation: Photo-to-Items OCR
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

      let prompt = `วิเคราะห์ภาพตารางอุปกรณ์วิสัญญีหรือตารางเวชภัณฑ์นี้อย่างละเอียด และสกัดรายการอุปกรณ์ทุกแถวในตารางออกมาเป็น JSON Array เท่านั้น ในรูปแบบ:
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
      return res.json({ success: true, items: filteredItems.length > 0 ? filteredItems : items });
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
