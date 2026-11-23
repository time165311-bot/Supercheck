import express from 'express';
import { ThinkingLevel, Type } from '@google/genai';
import multer from 'multer';
import {
  createServerGeminiClient,
  getServerGeminiKey,
  normalizeServerExpDateToIso,
  withAbortTimeout,
  withChildAbortTimeout,
} from '../lib/firebaseServer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function extractMediaFromRequest(req: express.Request): {
  pureBase64: string;
  mimeType: string;
} {
  let pureBase64 = '';
  let mimeType =
    String(
      req.body?.mimeType ||
        req.body?.attachment?.mimeType ||
        'image/jpeg'
    ).trim() || 'image/jpeg';

  if (req.file) {
    pureBase64 = req.file.buffer.toString('base64');
    mimeType = req.file.mimetype || mimeType;
  } else {
    const rawCandidate =
      req.body?.imageBase64 ||
      req.body?.fileBase64 ||
      req.body?.attachment?.base64 ||
      '';
    if (rawCandidate) {
      const rawStr = String(rawCandidate).trim();
      const mimeMatch = rawStr.match(/^data:([^;]+);base64,/i);
      if (mimeMatch?.[1]) {
        mimeType = mimeMatch[1].trim();
      }
      pureBase64 = rawStr.replace(/^data:[^;]+;base64,/i, '').trim();
    }
  }

  return { pureBase64, mimeType };
}

export function createAiVisionRouter(): express.Router {
  const router = express.Router();

  router.post('/vision', upload.single('image'), async (req, res) => {
    const apiKey = getServerGeminiKey();
    if (!apiKey) {
      return res.json({
        success: false,
        isQuotaExceeded: true,
        error: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถประมวลผลไฟล์ได้ในขณะนี้ค่ะ',
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถประมวลผลไฟล์ได้ในขณะนี้ค่ะ',
        items: [],
      });
    }

    const { pureBase64, mimeType } = extractMediaFromRequest(req);

    if (!pureBase64) {
      return res.status(400).json({ success: false, error: 'ไม่พบไฟล์รูปภาพหรือเอกสาร PDF' });
    }

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const imagePart = {
        inlineData: {
          mimeType,
          data: pureBase64,
        },
      };

      const mode = req.body?.mode as string | undefined;
      const promptType = req.body?.promptType;
      const filterText = req.body?.prompt || req.body?.filterInstructions || '';

      // Unified 1-Shot Smart Vision Endpoint (mode: 'auto' | 'audit-paper' | 'scan-label')
      if (mode && !promptType) {
        const existingItems = Array.isArray(req.body?.existingItems) ? req.body.existingItems : [];
        const compactExisting = existingItems.slice(0, 100).map((it: any) => ({
          id: it.id || it.itemId || '',
          name: it.name || '',
          spec: it.spec || '',
          location: it.locationLabel || it.type || '',
          exp: it.exp || it.expDate || '-',
        }));

        const visionSchema = {
          type: Type.OBJECT,
          properties: {
            detectedType: {
              type: Type.STRING,
              description: 'ประเภทของภาพที่อ่านได้: "checklist_table" (ใบตรวจเช็ก/ตารางสต็อก) หรือ "drug_label" (ฉลากยา/เวชภัณฑ์/วันหมดอายุ)',
            },
            summaryMessage: {
              type: Type.STRING,
              description: 'ข้อความสรุปสั้นๆ 1-2 ประโยคสำหรับแสดงในแชต',
            },
            items: {
              type: Type.ARRAY,
              description: 'รายการยา เวชภัณฑ์ หรือครุภัณฑ์ที่อ่านได้จากภาพ',
              items: {
                type: Type.OBJECT,
                properties: {
                  matchedId: {
                    type: Type.STRING,
                    description: 'ID ของรายการในระบบที่ตรงกัน (หากไม่มีให้ใส่ค่าว่าง "")',
                  },
                  name: {
                    type: Type.STRING,
                    description: 'ชื่อยา เวชภัณฑ์ หรือครุภัณฑ์ที่อ่านได้ (รวมขนาด/ไซส์ถ้ามี)',
                  },
                  quantity: {
                    type: Type.NUMBER,
                    description: 'จำนวนที่นับได้หรือระบุในใบตรวจ (ถ้าไม่มีให้ใส่ 1)',
                  },
                  status: {
                    type: Type.STRING,
                    description: 'สถานะ: "ready" (ปกติ/ครบ), "low" (เหลือน้อย), "expired" (หมดอายุ/ใกล้หมดอายุ), หรือ "damaged" (ชำรุด)',
                  },
                  expiryDate: {
                    type: Type.STRING,
                    description: 'วันหมดอายุในรูปแบบ YYYY-MM-DD (หากไม่มีในภาพให้ใส่ค่าว่าง "")',
                  },
                  lotNumber: {
                    type: Type.STRING,
                    description: 'เลข Lot หรือ Serial Number (หากไม่มีให้ใส่ค่าว่าง "")',
                  },
                  note: {
                    type: Type.STRING,
                    description: 'หมายเหตุเพิ่มเติมที่พบในภาพ',
                  },
                },
                required: ['name', 'quantity', 'status'],
              },
            },
          },
          required: ['detectedType', 'summaryMessage', 'items'],
        };

        const visionPrompt = `คุณคือน้องออร่า AI ผู้เชี่ยวชาญด้านคลังยาและครุภัณฑ์แผนกวิสัญญี
วิเคราะห์รูปภาพนี้ (อ่านได้ทุกมุมมองแม้กลับหัวหรือตะแคงข้าง)
โหมดที่ร้องขอ: ${mode}
รายการที่มีอยู่ในระบบปัจจุบัน (ใช้จับคู่ matchedId หากชื่อและขนาดตรงกันหรือใกล้เคียง):
${JSON.stringify(compactExisting)}

คำสั่งสำคัญ:
1. หากเป็นใบตรวจเช็ก (ตารางที่มีช่องติ๊กถูก ตัวเลข หรือลายมือเขียน) หรือ mode = "audit-paper":
   - ตั้ง detectedType = "checklist_table"
   - อ่านทุกบรรทัดอย่างละเอียดครบถ้วน แปลงเครื่องหมายติ๊กถูกเป็น status "ready" และหากมีวงกลม/กากบาท/ขาด/ชำรุดให้เป็น "damaged" หรือ "low"
2. หากเป็นฉลากยา ซองอุปกรณ์ปราศจากเชื้อ หรือสติกเกอร์ครุภัณฑ์ หรือ mode = "scan-label":
   - ตั้ง detectedType = "drug_label"
   - ดึงชื่อยา/อุปกรณ์ (รวมขนาด เช่น No. 7.5, 18G, 1 mg/ml), วันหมดอายุ (EXP แปลงเป็น ค.ศ. YYYY-MM-DD เสมอ ถ้าเป็น พ.ศ. ให้ลบ 543), และเลข Lot
3. จับคู่ matchedId กับรายการในระบบให้แม่นยำตามชื่อสามัญ/ชื่อการค้าและขนาดเสมอ`;

        const visionResp = await withAbortTimeout(110000, async (signal) => {
          try {
            return await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: { parts: [imagePart, { text: visionPrompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: visionSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  systemInstruction: 'คุณคือ AI ผู้เชี่ยวชาญการอ่านใบตรวจเช็กและฉลากยาวิสัญญี อ่านตัวเลขและวันที่แม่นยำ 100% ตอบตาม JSON Schema เท่านั้น',
                },
              })
            );
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            return await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: { parts: [imagePart, { text: visionPrompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: visionSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              })
            );
          }
        });

        const rawVisionText = visionResp?.text || '{}';
        const matchVision = rawVisionText.match(/\{[\s\S]*\}/);
        const parsedVision = JSON.parse(matchVision ? matchVision[0] : rawVisionText);
        parsedVision.items = Array.isArray(parsedVision.items)
          ? parsedVision.items.map((it: any) => ({
              ...it,
              expiryDate: it?.expiryDate ? normalizeServerExpDateToIso(it.expiryDate) : '',
            }))
          : [];
        return res.json({ success: true, data: parsedVision });
      }

      // Mode A: Structured drug label / expiry / barcode extraction
      if (promptType === 'drug_label') {
        const drugLabelModeSchema = {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            genericName: { type: Type.STRING },
            expDate: { type: Type.STRING, description: 'Expiry date normalized to CE YYYY-MM-DD' },
            lotNumber: { type: Type.STRING },
            sizeOrConcentration: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ['name', 'expDate'],
        };

        const labelPrompt = `คุณคือน้องออร่า เภสัชกร/วิสัญญีพยาบาล AI อ่านฉลากยาหรือกล่องอุปกรณ์ทางการแพทย์จากภาพนี้
สกัดข้อมูลสำคัญออกมาเป็น JSON ตาม Schema เท่านั้น:
- expDate แปลงเป็น ค.ศ. YYYY-MM-DD (ถ้ามี พ.ศ. ให้ลบ 543, ถ้ามีแค่เดือน/ปี ให้ใช้วันที่ 01)`;

        const labelResp = await withAbortTimeout(90000, async (signal) => {
          try {
            return await withChildAbortTimeout(signal, 40000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: { parts: [imagePart, { text: labelPrompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: drugLabelModeSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              })
            );
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            return await withChildAbortTimeout(signal, 40000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: { parts: [imagePart, { text: labelPrompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: drugLabelModeSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              })
            );
          }
        });

        const rawLabel = labelResp?.text || '{}';
        const matchObj = rawLabel.match(/\{[\s\S]*\}/);
        const data = JSON.parse(matchObj ? matchObj[0] : rawLabel);
        if (data?.expDate) {
          data.expDate = normalizeServerExpDateToIso(data.expDate);
        }
        return res.json({ success: true, promptType, data, items: data?.name ? [data] : [] });
      }

      // Mode B: Default checklist / equipment table extraction
      let prompt = `คุณคือน้องออร่า ผู้ช่วยวิสัญญีประจำวอร์ด
กรุณาตรวจอ่านแบบฟอร์มกระดาษตารางตรวจเช็กนี้ (หากรูปถ่ายกลับหัวหรือวางแนวนอน ให้หมุนอ่านในทิศทางที่ถูกต้องอัตโนมัติ)
วิเคราะห์ภาพตารางอุปกรณ์วิสัญญีหรือตารางเวชภัณฑ์นี้อย่างละเอียดแบบบรรทัดต่อบรรทัด (Line-by-line strict extraction) สกัดรายการอุปกรณ์ทุกแถวในตารางออกมาให้ครบถ้วน 100% ห้ามข้ามรายการเด็ดขาด แม้ข้อความจะเบลอหรือตัวเล็ก ให้สแกนหา "รายการ / ชื่ออุปกรณ์", "จำนวน/เช็ก", และ "วันหมดอายุ / EXP" สรุปรายการทั้งหมดกลับมาเป็น JSON Array เท่านั้น ในรูปแบบ:
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

      const checklistArraySchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            unitText: { type: Type.STRING },
            category: { type: Type.STRING },
            subItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            exp: { type: Type.STRING },
          },
          required: ['name'],
        },
      };

      let response;
      try {
        response = await withAbortTimeout(110000, async (signal) => {
          try {
            return await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: checklistArraySchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              })
            );
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            return await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: checklistArraySchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              })
            );
          }
        });
      } catch {
        return res.json({
          success: true,
          isQuotaExceeded: true,
          message: 'โควตาโมเดล Vision เต็มชั่วคราว น้องออร่าขออภัยที่ไม่สามารถอ่านรูปได้ในขณะนี้ค่ะ ✨🌸',
          items: [],
        });
      }

      const text = response?.text || '[]';
      let items: any[] = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        items = Array.isArray(parsed)
          ? parsed.map((it: any) => ({
              ...it,
              exp: it?.exp && it.exp !== '-' ? normalizeServerExpDateToIso(it.exp) : (it?.exp || '-'),
            }))
          : [];
      } catch {
        items = [];
      }

      const filteredItems = applyServerFiltering(items);
      return res.json({
        success: true,
        items: filteredItems.length > 0 ? filteredItems : items,
      });
    } catch {
      return res.json({
        success: true,
        isQuotaExceeded: true,
        message: 'ระบบวิเคราะห์ภาพด้วย AI เกิดข้อขัดข้องชั่วคราว น้องออร่าขออภัยที่ไม่สามารถอ่านรูปได้ในขณะนี้ค่ะ ✨🌸',
        items: [],
      });
    }
  });

  const auditResponseSchema = {
    type: Type.OBJECT,
    properties: {
      paperItems: {
        type: Type.ARRAY,
        description: 'รายการอุปกรณ์และยาทั้งหมดที่อ่านได้จากกระดาษ (ทุกแถวในตาราง)',
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
    required: ['paperItems', 'missingInWeb', 'extraInWeb', 'matchedItems', 'discrepancies', 'summaryText'],
  };

  router.post('/audit-paper', upload.single('image'), async (req, res) => {
    const apiKey = getServerGeminiKey();
    const rawWebItems = req.body?.currentWebItems;
    let currentWebItems: any[] = [];
    try {
      currentWebItems = rawWebItems ? JSON.parse(rawWebItems) : [];
    } catch {
      currentWebItems = [];
    }

    const targetType = req.body?.targetType || 'bag';
    const targetLabel = targetType === 'cart' ? 'รถฉุกเฉิน (Crash Cart)' : targetType === 'drug' ? 'คลังยาวิสัญญี' : 'กระเป๋ายาฉุกเฉิน (Emergency Bag)';

    const { pureBase64, mimeType } = extractMediaFromRequest(req);
    if (!pureBase64) {
      return res.status(400).json({ success: false, error: 'NO_IMAGE', message: 'กรุณาแนบรูปภาพหรือไฟล์ PDF กระดาษตรวจเช็ก' });
    }

    if (!apiKey) {
      return res.json({
        success: false,
        isQuotaExceeded: true,
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถเปรียบเทียบข้อมูลจริงได้ในขณะนี้ค่ะ ✨🌸',
        result: null,
      });
    }

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const imagePart = {
        inlineData: {
          mimeType,
          data: pureBase64,
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

คำเตือนสำคัญด้านการประมวลผลภาพ (Crucial Visual & Auto-Orientation Instructions):
- ไม่ว่าภาพจะกลับหัว (180 องศา), ตะแคงข้าง (90/270 องศา), หรือเอียง ให้อ่านตัวอักษรและตารางตามแนวทิศทางจริงของเนื้อหา ห้ามปฏิเสธการอ่านหรือหยุดทำงานเด็ดขาด
- สกัดรายการอุปกรณ์และยาทุกแถวในกระดาษออกมาเป็น "paperItems" ทั้งหมด 100% ครบถ้วนทุกแถว ห้ามข้ามแม้แต่รายการเดียว
- ห้ามมโน ห้ามคาดเดา และห้ามดึงรายการยาหรืออุปกรณ์ภายนอกที่ไม่มีในภาพกระดาษมาใส่เด็ดขาด

หมวดหมู่เป้าหมาย: ${targetLabel}
รายการอุปกรณ์และยาในระบบเว็บปัจจุบัน (Current Web System Items):
${JSON.stringify(simplifiedWebItems, null, 2)}

คำแนะนำการตรวจเช็คเปรียบเทียบ (Document Audit Instructions):
1. อ่านตารางในภาพถ่ายอย่างละเอียดแบบบรรทัดต่อบรรทัด (Line-by-line strict extraction):
   - สกัดรายการอุปกรณ์/ยา ทุกแถวในกระดาษลงใน "paperItems" ทั้งชื่อยา, ชื่ออุปกรณ์, ขนาด/เบอร์, จำนวนกำหนด (Par level / Target Qty) และวันหมดอายุ (EXP)
2. นำรายการจากกระดาษมาเปรียบเทียบกับรายการในเว็บ:
   - "missingInWeb": รายการที่ปรากฏในกระดาษอย่างชัดเจน แต่ยังไม่มีในระบบเว็บปัจจุบัน (ระบุ itemName, targetQuantity, expDate, category)
   - "extraInWeb": รายการที่มีอยู่ในระบบเว็บปัจจุบัน แต่ในกระดาษแบบฟอร์มนี้ไม่มี (ระบุ itemName, webQty)
   - "matchedItems": รายการที่มีตรงกันทั้งในกระดาษและเว็บ โดยชื่อและจำนวนสอดคล้องกัน (ระบุ itemName, paperQty, webQty)
   - "discrepancies": รายการที่มีชื่อตรงกันหรือคล้ายคลึงกันอย่างชัดเจน แต่จำนวน (Quantity) ไม่ตรงกัน หรือมีข้อแตกต่างที่สำคัญ (ระบุ itemName, paperQty, webQty, issue)
3. "summaryText": เขียนสรุปวิเคราะห์สั้นๆ ในน้ำเสียงที่ไพเราะ สดใส และน่ารักสไตล์น้องออร่า ผู้ช่วยวิสัญญี (มี ✨🌸🎀) บอกให้ชัดเจนว่าอ่านได้ทั้งหมดกี่รายการ ตรงกันกี่รายการ ขาดในเว็บกี่รายการ และมีรายการใดที่จำนวนไม่ตรงกันบ้าง`;

      let response;
      const startTime = Date.now();
      try {
        response = await withAbortTimeout(110000, async (signal) => {
          try {
            const resp = await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: { parts: [imagePart, { text: promptText }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: auditResponseSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  systemInstruction: 'คุณคือน้องออร่า AI ผู้ช่วยตรวจสอบความถูกต้องของรายการอุปกรณ์และคลังยาวิสัญญีวิทยา มีความละเอียดรอบคอบ เปรียบเทียบข้อมูลแม่นยำ 100% สุภาพและน่ารัก อ่านภาพได้ทุกมุมมองแม้กลับหัวหรือเอียง',
                },
              })
            );
            console.log(`[AuditPaper] AI finished in ${Date.now() - startTime}ms (model: gemini-4-hydrogen)`);
            return resp;
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            console.error('[AuditPaper] gemini-4-hydrogen error:', e1?.message || e1);
            const resp2 = await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: { parts: [imagePart, { text: promptText }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: auditResponseSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                  systemInstruction: 'คุณคือน้องออร่า AI ผู้ช่วยตรวจสอบความถูกต้องของรายการอุปกรณ์และคลังยาวิสัญญีวิทยา มีความละเอียดรอบคอบ เปรียบเทียบข้อมูลแม่นยำ 100% สุภาพและน่ารัก อ่านภาพได้ทุกมุมมองแม้กลับหัวหรือเอียง',
                },
              })
            );
            console.log(`[AuditPaper] AI finished in ${Date.now() - startTime}ms (model: gemini-3.1-flash-lite)`);
            return resp2;
          }
        });
      } catch (e2: any) {
        console.error('[AuditPaper] Vision timeout/fallback error:', e2?.message || e2);
        return res.json({
          success: true,
          isQuotaExceeded: true,
          message: 'โควตาโมเดล Vision เต็มชั่วคราว น้องออร่าขออภัยที่ไม่สามารถเปรียบเทียบข้อมูลได้ในขณะนี้ค่ะ ✨🌸',
          result: null,
        });
      }

      const text = response?.text || '{}';
      let result: any = {
        paperItems: [],
        missingInWeb: [],
        extraInWeb: [],
        matchedItems: [],
        discrepancies: [],
        summaryText: '',
      };

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('[AuditPaper] JSON parse error, building minimal response:', parseErr);
        result.summaryText = 'น้องออร่าอ่านภาพถ่ายตารางตรวจเช็กได้แล้ว แต่ระบบแปลง JSON มีข้อผิดพลาดเล็กน้อย กรุณาลองส่งใหม่อีกครั้งนะคะ ✨🌸';
      }

      result.paperItems = Array.isArray(result.paperItems)
        ? result.paperItems.map((it: any) => ({
            ...it,
            expDate: it?.expDate ? normalizeServerExpDateToIso(it.expDate) : '',
          }))
        : [];
      result.missingInWeb = Array.isArray(result.missingInWeb)
        ? result.missingInWeb.map((it: any) => ({
            ...it,
            expDate: it?.expDate ? normalizeServerExpDateToIso(it.expDate) : '',
          }))
        : [];
      if (!Array.isArray(result.extraInWeb)) result.extraInWeb = [];
      if (!Array.isArray(result.matchedItems)) result.matchedItems = [];
      if (!Array.isArray(result.discrepancies)) result.discrepancies = [];
      if (!result.summaryText) {
        result.summaryText = `น้องออร่าเปรียบเทียบรายการเรียบร้อยแล้วค่ะ! อ่านได้จากกระดาษ ${result.paperItems.length} รายการ, ตรงกัน ${result.matchedItems.length} รายการ, ขาดในเว็บ ${result.missingInWeb.length} รายการ และจำนวนไม่ตรงกัน ${result.discrepancies.length} รายการค่ะ ✨🌸`;
      }

      return res.json({ success: true, result });
    } catch (error: any) {
      console.warn('[AuditPaper] Server error:', error);
      return res.json({
        success: false,
        message: 'ระบบวิเคราะห์ภาพด้วย AI เกิดข้อขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ ✨🌸',
        result: null,
      });
    }
  });

  router.post('/read-paper', upload.single('image'), async (req, res) => {
    const { pureBase64, mimeType } = extractMediaFromRequest(req);

    if (!pureBase64) {
      return res.status(400).json({ success: false, error: 'NO_IMAGE_DATA', message: 'กรุณาส่งไฟล์รูปภาพหรือเอกสาร PDF' });
    }

    const apiKey = getServerGeminiKey();
    if (!apiKey) {
      return res.json({
        success: false,
        text: '⚠️ ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถประมวลผลภาพจริงได้ในขณะนี้ค่ะ ✨🌸',
      });
    }

    const targetGroup = req.body?.targetGroup || (req.query?.targetGroup as string) || '';

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const imagePart = {
        inlineData: {
          data: pureBase64,
          mimeType,
        },
      };

      const groupInstruction = targetGroup
        ? `\nผู้ใช้ต้องการเน้นสแกนด่วนเฉพาะหมวด "${targetGroup}" กรุณาสกัดข้อมูลอุปกรณ์ที่อยู่ในหมวดนี้เป็นหลักอย่างแม่นยำ`
        : '';

      const readPaperSchema = {
        type: Type.OBJECT,
        properties: {
          targetLocation: { type: Type.STRING, description: 'เป๋า, รถ, คลังยา, หรือ ครุภัณฑ์' },
          targetName: { type: Type.STRING, description: 'ชื่อฟอร์มที่อ่านได้จากหัวกระดาษ' },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                expected: { type: Type.STRING },
                actual: { type: Type.STRING },
                w1: { type: Type.STRING },
                w2: { type: Type.STRING },
                w3: { type: Type.STRING },
                w4: { type: Type.STRING },
                exp: { type: Type.STRING, description: 'วันหมดอายุในรูปแบบ YYYY-MM-DD (ถ้าเป็น พ.ศ. ลบ 543) หรือ -' },
                status: { type: Type.STRING, description: 'COMPLETE, INCOMPLETE, หรือ EXPIRED' },
                issue: { type: Type.STRING },
              },
              required: ['name', 'status'],
            },
          },
        },
        required: ['targetLocation', 'targetName', 'items'],
      };

      const promptText = `
คุณคือน้องออร่า ผู้ช่วยวิสัญญี สกัดข้อมูลตารางกระดาษนี้แบบ "ช่องต่อช่อง" จากซ้ายไปขวาให้ครบ 100% ทุกบรรทัด${groupInstruction}

กฎเหล็ก (Strict Rules):
0. กฎการหมุน: หากภาพเอียงหรือกลับหัว ให้ตรวจจับทิศทางตัวอักษรและหมุนภาพในใจ (Mental Rotation) ให้อ่านได้ปกติ ห้ามปฏิเสธการอ่าน
1. ลายมือไทย: ตารางเป็นลายมือเขียนภาษาไทยและตัวเลข ให้อ่านอย่างละเอียด หากอ่านไม่ออกให้ระบุ "(อ่านไม่ออก)" ห้ามตัดบท
2. EXP: ห้ามสลับแถววันหมดอายุ ดูตามอุปกรณ์นั้นๆ เคร่งครัด แปลงเป็น ค.ศ. YYYY-MM-DD เสมอ (หากเป็น พ.ศ. ลบ 543) ถ้าไม่มีให้ใส่ "-"
3. ตรวจเช็ค: หากมีเครื่องหมาย ✓, ตัวเลข หรือลายเซ็นในช่องสัปดาห์ W1-W4 ให้ระบุให้ครบ
4. ห้ามมโน: อ่านทุกรายการ Line-by-line ห้ามข้ามแม้ตัวเล็ก/เบลอ ห้ามเพิ่มข้อมูลที่ไม่มีในภาพเด็ดขาด
5. targetLocation: ระบุว่าเป็น "เป๋า" (Emergency Bag), "รถ" (Crash Cart), "คลังยา" (Drug Stock), หรือ "ครุภัณฑ์" (Equipment)`;

      const startTime = Date.now();
      let rawAiResponse: string | undefined | null = null;
      try {
        rawAiResponse = await withAbortTimeout(110000, async (signal) => {
          try {
            const resp = await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents: { parts: [imagePart, { text: promptText }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: readPaperSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              })
            );
            console.log(`[ReadPaper] AI finished in ${Date.now() - startTime}ms (model: gemini-4-hydrogen)`);
            return resp?.text;
          } catch (e1: any) {
            if (signal.aborted) throw e1;
            console.error('[ReadPaper] gemini-4-hydrogen error:', e1?.message || e1);
            const resp2 = await withChildAbortTimeout(signal, 50000, (attemptSignal) =>
              aiClient.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: { parts: [imagePart, { text: promptText }] },
                config: {
                  abortSignal: attemptSignal,
                  responseMimeType: 'application/json',
                  responseSchema: readPaperSchema,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              })
            );
            console.log(`[ReadPaper] AI finished in ${Date.now() - startTime}ms (model: gemini-3.1-flash-lite)`);
            return resp2?.text;
          }
        });
      } catch {
        rawAiResponse = null;
      }

      if (!rawAiResponse) {
        console.error(`[ReadPaper] Timeout (110s) or AI failed to return response after ${Date.now() - startTime}ms`);
        return res.json({
          success: false,
          text: '⚠️ ระบบประมวลผล AI ใช้เวลานานเกินไป หรือโมเดลขัดข้อง กรุณาลองส่งใหม่อีกครั้งนะคะ ✨🌸',
        });
      }

      let parsedItems: any[] = [];
      let targetLocation = '';
      let targetName = '';

      try {
        const jsonMatch = rawAiResponse.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : rawAiResponse.replace(/^```json/i, '').replace(/```$/g, '').trim();
        const parsedData = JSON.parse(cleanJson);
        targetLocation = parsedData.targetLocation || '';
        targetName = parsedData.targetName || '';
        const rawItems = Array.isArray(parsedData.items) ? parsedData.items : [];
        parsedItems = rawItems.map((it: any) => ({
          name: String(it?.name || '').trim(),
          expected: String(it?.expected || '1').trim(),
          actual: String(it?.actual ?? it?.expected ?? '1').trim(),
          w1: it?.w1 || '-',
          w2: it?.w2 || '-',
          w3: it?.w3 || '-',
          w4: it?.w4 || '-',
          exp: it?.exp && it.exp !== '-' ? normalizeServerExpDateToIso(it.exp) : '-',
          status: it?.status === 'EXPIRED' || it?.status === 'INCOMPLETE' ? it.status : 'COMPLETE',
          issue: it?.issue || '',
        }));
      } catch (jsonErr) {
        console.warn('[ReadPaper] JSON parse warning:', jsonErr);
      }

      const formattedLines = parsedItems
        .map((p, i) => `${i + 1}. ${p.name} | ${p.expected} | ${p.w1} | ${p.w2} | ${p.w3} | ${p.w4} | ${p.exp}`)
        .join('\n');

      const displayText = [
        '📋 **ผลการอ่านเอกสารตารางตรวจเช็ก (โดยน้องออร่า):**',
        `- **ชื่อฟอร์ม:** ${targetName || 'แบบฟอร์มตรวจเช็ก'}`,
        `- **ประเภท:** ${targetLocation || 'ทั่วไป'}`,
        `- **จำนวนรายการที่อ่านได้:** ${parsedItems.length} รายการ`,
        formattedLines ? `\n${formattedLines}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const diffItems = parsedItems.filter(
        (p) => p.status !== 'COMPLETE' || (p.issue && p.issue.trim() !== '') || p.actual !== p.expected
      );
      const restockItems = parsedItems.filter(
        (p) => p.status === 'INCOMPLETE' || p.status === 'EXPIRED' || (p.issue && p.issue.trim() !== '')
      );

      const completeCount = parsedItems.length - diffItems.length;
      return res.json({
        success: true,
        text: displayText,
        parsedItems,
        targetLocation,
        targetName,
        diffSummary: {
          total: parsedItems.length,
          complete: completeCount,
          completeCount,
          diffs: diffItems.length,
          diffCount: diffItems.length,
          restockCount: restockItems.length,
        },
        diffItems,
        restockItems,
      });
    } catch (err: any) {
      console.error('[ReadPaper] Critical Error:', err);
      return res.json({
        success: false,
        text: `❌ ${err?.message || 'เกิดข้อขัดข้องในการเชื่อมต่อกับ AI'} กรุณาลองใหม่อีกครั้งนะคะ ✨🌸`,
      });
    }
  });

  const labelScanSchema = {
    type: Type.OBJECT,
    properties: {
      imageType: {
        type: Type.STRING,
        description: 'Classify image strictly as LABEL_OR_BOX (medication bottle/ampoule/blister/packaging/device box) or CHECKLIST_TABLE (multi-row inspection checklist form)',
      },
      items: {
        type: Type.ARRAY,
        description: 'List of detected drug labels or medical device packages in the photo',
        items: {
          type: Type.OBJECT,
          properties: {
            itemName: { type: Type.STRING, description: 'Generic and/or brand medication or device name' },
            sizeOrSpec: { type: Type.STRING, description: 'Exact size, gauge, concentration, or volume (e.g. No. 7.5, 18G, 1 mg/ml, 50 mg/5ml)' },
            expDate: { type: Type.STRING, description: 'Expiry date normalized to YYYY-MM-DD in CE (if only MM/YY or MM/YYYY is shown, use YYYY-MM-01; convert Buddhist Era พ.ศ. to CE by subtracting 543)' },
            rawExpText: { type: Type.STRING, description: 'Exact expiry text printed on the label (e.g. EXP 08/2027)' },
            lotNumber: { type: Type.STRING, description: 'Lot or Batch number printed on the label (e.g. LOT 2409A12), empty string if not visible' },
            categoryHint: { type: Type.STRING, description: 'Likely category: drug, bag, cart, or equipment' },
            confidenceNote: { type: Type.STRING, description: 'Short Thai observation about the label clarity' },
          },
          required: ['itemName', 'expDate'],
        },
      },
      summaryText: {
        type: Type.STRING,
        description: 'Short friendly Thai summary by Aura describing the scanned label(s)',
      },
    },
    required: ['imageType', 'items', 'summaryText'],
  };

  router.post('/scan-label', upload.single('image'), async (req, res) => {
    const { pureBase64, mimeType } = extractMediaFromRequest(req);

    if (!pureBase64) {
      return res.status(400).json({ success: false, error: 'NO_IMAGE_DATA', message: 'กรุณาแนบรูปภาพฉลากยาหรือไฟล์ PDF' });
    }

    const apiKey = getServerGeminiKey();
    if (!apiKey) {
      return res.json({
        success: false,
        isQuotaExceeded: true,
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถอ่านฉลากยาได้ในขณะนี้ค่ะ ✨🌸',
      });
    }

    const forceLabelMode = req.body?.forceLabelMode === 'true' || req.body?.forceLabelMode === true;

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const imagePart = {
        inlineData: {
          mimeType,
          data: pureBase64,
        },
      };

      const promptText = `คุณคือน้องออร่า AI ผู้ช่วยพยาบาลวิสัญญีประจำห้องผ่าตัด
งานของคุณ: วิเคราะห์ภาพนี้${forceLabelMode ? ' (โหมดสแกนฉลากยา/กล่องอุปกรณ์โดยตรง)' : ''}

1. จำแนกประเภทภาพ ("imageType"):
   - "LABEL_OR_BOX": ภาพถ่ายขวดยา, แอมพูล, แผงยา, ฉลากยา, ซองอุปกรณ์ปราศจากเชื้อ, หรือกล่องอุปกรณ์ทางการแพทย์
   - "CHECKLIST_TABLE": ภาพถ่ายแบบฟอร์มกระดาษตารางตรวจเช็กที่มีหลายแถวและช่องสัปดาห์ W1-W4
   ${forceLabelMode ? '(ผู้ใช้เจาะจงสแกนฉลากยา/กล่องอุปกรณ์ ให้ตั้ง imageType = "LABEL_OR_BOX" และสกัดข้อมูลฉลากให้ดีที่สุด)' : ''}

2. หากเป็น LABEL_OR_BOX ให้สกัดข้อมูลจากฉลากให้แม่นยำ 100%:
   - "itemName": ชื่อยาหรืออุปกรณ์ทางการแพทย์ (ระบุทั้งชื่อสามัญ/ชื่อการค้าที่เห็นชัด เช่น Epinephrine / Adrenaline, Midazolam / Dormicum, Rocuronium / Esmeron, Endotracheal tube)
   - "sizeOrSpec": ขนาด เบอร์ เกจ หรือความเข้มข้น เช่น "No. 7.5", "18G", "1 mg/ml", "10 ml" (สำคัญมาก ห้ามเดาขนาดผิด!)
   - "expDate": วันหมดอายุแปลงเป็นมาตรฐาน ค.ศ. รูปแบบ "YYYY-MM-DD" (เช่น EXP 08/2027 -> "2027-08-01", EXP 12/28 -> "2028-12-01", ถ้าฉลากเป็น พ.ศ. 2570 ให้แปลงเป็น ค.ศ. 2027) หากไม่พบวันหมดอายุให้ส่ง "-"
   - "rawExpText": ข้อความวันหมดอายุตามที่พิมพ์จริงบนฉลาก
   - "lotNumber": เลข Lot / Batch No. เช่น "LOT 2409A12" (ถ้าไม่เห็นให้ส่ง "")
   - "categoryHint": เดาว่าเป็น "drug", "bag", "cart", หรือ "equipment"
   - "summaryText": สรุปสั้นๆ สไตล์น้องออร่า`;

      const response = await withAbortTimeout(90000, async (signal) => {
        try {
          return await withChildAbortTimeout(signal, 40000, (attemptSignal) =>
            aiClient.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: { parts: [imagePart, { text: promptText }] },
              config: {
                abortSignal: attemptSignal,
                responseMimeType: 'application/json',
                responseSchema: labelScanSchema,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            })
          );
        } catch (e1: any) {
          if (signal.aborted) throw e1;
          return await withChildAbortTimeout(signal, 40000, (attemptSignal) =>
            aiClient.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: { parts: [imagePart, { text: promptText }] },
              config: {
                abortSignal: attemptSignal,
                responseMimeType: 'application/json',
                responseSchema: labelScanSchema,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              },
            })
          );
        }
      });

      const rawText = response?.text || '{}';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      const normalizedItems = Array.isArray(parsed.items)
        ? parsed.items.map((it: any) => ({
            ...it,
            expDate: it?.expDate ? normalizeServerExpDateToIso(it.expDate) : '',
          }))
        : [];

      return res.json({
        success: true,
        imageType: forceLabelMode ? 'LABEL_OR_BOX' : (parsed.imageType || 'LABEL_OR_BOX'),
        items: normalizedItems,
        summaryText: parsed.summaryText || 'น้องออร่าสแกนฉลากเรียบร้อยแล้วค่ะ ✨🌸',
      });
    } catch (error: any) {
      console.error('[ScanLabel] Error:', error?.message || error);
      return res.json({
        success: false,
        imageType: 'LABEL_OR_BOX',
        items: [],
        message: 'ไม่สามารถวิเคราะห์ฉลากจากภาพได้ กรุณาลองถ่ายให้เห็นตัวอักษร EXP / Lot ชัดขึ้นนะคะ ✨🌸',
      });
    }
  });

  const photoMatchSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: 'สรุปผลภาษาไทยสั้นๆ' },
      mappings: {
        type: Type.ARRAY,
        description: 'ผลการจับคู่รูปภาพกับลำดับครุภัณฑ์',
        items: {
          type: Type.OBJECT,
          properties: {
            imageIndex: { type: Type.INTEGER, description: 'ลำดับ index ของภาพ (0, 1, 2...)' },
            orderNumber: { type: Type.STRING, description: 'หมายเลขลำดับที่อ่านได้จากภาพ เช่น "35", "12"' },
            detectedNumber: { type: Type.STRING, description: 'ตัวเลขหรือรหัสที่อ่านได้จากภาพ' },
            equipmentId: { type: Type.STRING, description: 'id ของครุภัณฑ์ที่ตรงกัน (ถ้ามี)' },
            equipmentName: { type: Type.STRING, description: 'ชื่อครุภัณฑ์ที่ตรงกัน (ถ้ามี)' },
            unmatched: { type: Type.BOOLEAN, description: 'true หากอ่านไม่ชัดหรือไม่พบในระบบ' },
            reason: { type: Type.STRING, description: 'เหตุผลกรณี unmatched' },
          },
          required: ['imageIndex'],
        },
      },
    },
    required: ['mappings'],
  };

  router.post('/match-photos', async (req, res) => {
    const apiKey = getServerGeminiKey();
    if (!apiKey) {
      return res.json({
        success: false,
        isQuotaExceeded: true,
        message: 'ยังไม่ได้ระบุ GEMINI_API_KEY ในระบบ น้องออร่าไม่สามารถอ่านรูปภาพได้ในขณะนี้ค่ะ ✨🌸',
        mappings: [],
      });
    }

    const { images, equipmentCatalog } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, error: 'NO_IMAGES', message: 'กรุณาส่งรูปภาพที่ต้องการจับคู่' });
    }

    try {
      const aiClient = createServerGeminiClient(apiKey);
      const catalogStr = Array.isArray(equipmentCatalog) && equipmentCatalog.length > 0
        ? JSON.stringify(equipmentCatalog.slice(0, 300)).slice(0, 32000)
        : 'ไม่มีข้อมูลรายการครุภัณฑ์';

      const promptText = `คุณคือระบบตรวจจับหมายเลขลำดับบนรูปภาพเครื่องมือแพทย์ เพื่อจับคู่กับทะเบียนครุภัณฑ์
รายการครุภัณฑ์ในระบบ (context.equipment):
${catalogStr}

คำสั่ง:
สำหรับรูปภาพแต่ละใบ (index: 0, 1, 2, ...):
1. มองหา "ตัวเลขลำดับ" ที่เขียนกำกับไว้บนรูปภาพ (เช่น ลายมือปากกามาร์กเกอร์บนเทป, สติกเกอร์ตัวเลข, ป้ายตัวเลขกำกับ เช่น เลข 35, 12, 27) หรือตัวเลขบนตัวเครื่อง
2. นำตัวเลขไปจับคู่กับ context.equipment ตาม orderNumber, no หรือ id
3. หากพบตัวเลข ให้ส่ง detectedNumber, orderNumber, equipmentId, equipmentName, unmatched: false
4. หากรูปภาพไม่มีตัวเลข หรือตัวเลขเบลอ/อ่านไม่ออก ให้ส่ง unmatched: true, reason: "อ่านตัวเลขไม่ชัดเจน"`;

      const userParts: any[] = [];
      images.forEach((img: any, idx: number) => {
        const cleanBase64 = String(img.base64 || img.dataUrl || '').replace(/^data:[^;]+;base64,/i, '').trim();
        if (cleanBase64) {
          userParts.push({ text: `[IMAGE index=${img.index ?? idx}${img.fileName ? ` file="${img.fileName}"` : ''}]` });
          userParts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          });
        }
      });
      userParts.push({ text: promptText });

      const response = await withAbortTimeout(60000, async (signal) => {
        try {
          return await withChildAbortTimeout(signal, 30000, (attemptSignal) =>
            aiClient.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: { parts: userParts },
              config: {
                abortSignal: attemptSignal,
                responseMimeType: 'application/json',
                responseSchema: photoMatchSchema,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            })
          );
        } catch (e1: any) {
          if (signal.aborted) throw e1;
          return await withChildAbortTimeout(signal, 25000, (attemptSignal) =>
            aiClient.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: { parts: userParts },
              config: {
                abortSignal: attemptSignal,
                responseMimeType: 'application/json',
                responseSchema: photoMatchSchema,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              },
            })
          );
        }
      });

      const rawText = response?.text || '{}';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      const rawMappings = Array.isArray(parsed.mappings) ? parsed.mappings : [];

      return res.json({
        success: true,
        summary: parsed.summary || `วิเคราะห์ภาพสำเร็จ ${rawMappings.length} รายการ`,
        mappings: rawMappings,
      });
    } catch (error: any) {
      console.error('[MatchPhotos] Error:', error?.message || error);
      return res.json({
        success: false,
        mappings: [],
        message: 'ไม่สามารถประมวลผลรูปภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ ✨🌸',
      });
    }
  });

  return router;
}
