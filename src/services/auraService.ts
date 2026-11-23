import { dataURLtoBlob } from '../utils/imageUtils';
import { authorizedFetch } from './aiService';

export interface PaperChecklistItem {
  name: string;
  expected: string;
  actual: string;
  w1?: string;
  w2?: string;
  w3?: string;
  w4?: string;
  exp?: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED';
  issue?: string;
}

export interface PaperChecklistResult {
  text: string;
  parsedItems: PaperChecklistItem[];
  targetLocation?: string;
  targetName?: string;
  diffSummary?: {
    total: number;
    completeCount: number;
    diffCount: number;
    restockCount: number;
  };
  diffItems?: PaperChecklistItem[];
  restockItems?: PaperChecklistItem[];
}

/**
 * Service to extract handwritten/printed checklist tables directly from images via Gemini Vision
 */
export const readPaperChecklistOnly = async (
  imageBase64: string,
  targetGroup?: string
): Promise<PaperChecklistResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('TIMEOUT'), 60000);
  try {
    // 1. ส่งแบบ FormData (Multipart) เพราะเสถียรที่สุดในเบราว์เซอร์ ไม่ติดข้อจำกัดขนาด JSON ของ iframe proxy
    const blob = dataURLtoBlob(imageBase64);
    const formData = new FormData();
    formData.append('image', blob, 'paper_checklist.jpg');
    formData.append('imageBase64', imageBase64);
    if (targetGroup) {
      formData.append('targetGroup', targetGroup);
    }

    const response = await authorizedFetch('/api/ai/read-paper', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.text) {
        return {
          text: data.text,
          parsedItems: Array.isArray(data.parsedItems) ? data.parsedItems : [],
          targetLocation: data.targetLocation,
          targetName: data.targetName,
          diffSummary: data.diffSummary || {
            total: (data.parsedItems || []).length,
            completeCount: (data.parsedItems || []).length,
            diffCount: 0,
            restockCount: 0,
          },
          diffItems: Array.isArray(data.diffItems) ? data.diffItems : [],
          restockItems: Array.isArray(data.restockItems) ? data.restockItems : [],
        };
      }
    }
  } catch (err1: any) {
    if (err1?.name === 'AbortError') {
      return {
        text: '⏱️ การประมวลผลภาพใช้เวลานานเกินกำหนด กรุณาลองส่งภาพที่ชัดเจนขึ้นอีกครั้งนะคะ ✨🌸',
        parsedItems: [],
      };
    }
    console.warn('FormData upload error, trying JSON fallback...', err1);
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort('TIMEOUT'), 45000);
    try {
      const response2 = await authorizedFetch('/api/ai/read-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64, targetGroup }),
        signal: controller2.signal,
      });
      if (response2.ok) {
        const data2 = await response2.json();
        if (data2 && data2.text) {
          return {
            text: data2.text,
            parsedItems: Array.isArray(data2.parsedItems) ? data2.parsedItems : [],
            diffSummary: data2.diffSummary || {
              total: (data2.parsedItems || []).length,
              completeCount: (data2.parsedItems || []).length,
              diffCount: 0,
              restockCount: 0,
            },
            diffItems: Array.isArray(data2.diffItems) ? data2.diffItems : [],
            restockItems: Array.isArray(data2.restockItems) ? data2.restockItems : [],
          };
        }
      }
    } catch (err2) {
      console.warn('Network fetch error in readPaperChecklistOnly:', err2);
      return {
        text: '❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI กรุณาลองใหม่อีกครั้งนะคะ ✨🌸',
        parsedItems: [],
      };
    } finally {
      clearTimeout(timer2);
    }
  } finally {
    clearTimeout(timer);
  }

  return {
    text: '⚠️ น้องออร่าไม่พบข้อมูลตารางที่อ่านได้จากภาพนี้ กรุณาลองถ่ายภาพให้ตรง ชัดเจน และมีแสงสว่างเพียงพอนะคะ ✨🌸',
    parsedItems: [],
  };
};

/**
 * Mode 3: Quick Section OCR targeting a specific category (e.g. Airway, IV, Solution)
 */
export const quickOcrCategory = async (
  imageBase64: string,
  categoryName: string
): Promise<PaperChecklistResult> => {
  return readPaperChecklistOnly(imageBase64, categoryName);
};

export interface LabelScanItem {
  itemName: string;
  sizeOrSpec?: string;
  expDate: string;
  rawExpText?: string;
  lotNumber?: string;
  categoryHint?: 'drug' | 'bag' | 'cart' | 'equipment' | string;
  confidenceNote?: string;
}

export interface LabelScanResult {
  success: boolean;
  imageType: 'LABEL_OR_BOX' | 'CHECKLIST_TABLE';
  items: LabelScanItem[];
  summaryText: string;
  message?: string;
}

/**
 * Vision Expiry Scan: Extracts medication/equipment name, EXP date, and Lot number from a label/box photo
 */
export const scanLabelForExpiry = async (
  imageBase64: string,
  forceLabelMode: boolean = false
): Promise<LabelScanResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('TIMEOUT'), 45000);

  try {
    const blob = dataURLtoBlob(imageBase64);
    const formData = new FormData();
    formData.append('image', blob, 'label_scan.jpg');
    formData.append('imageBase64', imageBase64);
    formData.append('forceLabelMode', forceLabelMode ? 'true' : 'false');

    const response = await authorizedFetch('/api/ai/scan-label', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: Boolean(data.success),
        imageType: data.imageType === 'CHECKLIST_TABLE' && !forceLabelMode ? 'CHECKLIST_TABLE' : 'LABEL_OR_BOX',
        items: Array.isArray(data.items) ? data.items : [],
        summaryText: data.summaryText || 'สแกนฉลากเรียบร้อยแล้วค่ะ ✨',
        message: data.message,
      };
    }
  } catch (err1) {
    try {
      const fallbackResp = await authorizedFetch('/api/ai/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, forceLabelMode }),
      });
      if (fallbackResp.ok) {
        const data2 = await fallbackResp.json();
        return {
          success: Boolean(data2.success),
          imageType: data2.imageType === 'CHECKLIST_TABLE' && !forceLabelMode ? 'CHECKLIST_TABLE' : 'LABEL_OR_BOX',
          items: Array.isArray(data2.items) ? data2.items : [],
          summaryText: data2.summaryText || 'สแกนฉลากเรียบร้อยแล้วค่ะ ✨',
          message: data2.message,
        };
      }
    } catch {
      // handled below
    }
  } finally {
    clearTimeout(timer);
  }

  return {
    success: false,
    imageType: 'LABEL_OR_BOX',
    items: [],
    summaryText: 'ไม่สามารถวิเคราะห์ฉลากจากภาพได้ กรุณาลองใหม่อีกครั้งนะคะ ✨🌸',
  };
};

export interface SmartVisionItem {
  matchedId?: string;
  name: string;
  quantity: number;
  status: 'ready' | 'low' | 'expired' | 'damaged';
  expiryDate?: string;
  lotNumber?: string;
  note?: string;
}

export interface SmartVisionResult {
  success: boolean;
  detectedType: 'checklist_table' | 'drug_label';
  summaryMessage: string;
  items: SmartVisionItem[];
  error?: string;
}

/**
 * Unified 1-shot Smart Vision scan (auto-detects checklist table vs. drug/equipment label)
 * Completes in 1 single API roundtrip (3-5s with pre-compressed image).
 */
export const smartVisionScan = async (
  imageBase64: string,
  mode: 'auto' | 'audit-paper' | 'scan-label' = 'auto',
  existingItems: any[] = []
): Promise<SmartVisionResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('TIMEOUT'), 45000);
  try {
    const response = await authorizedFetch('/api/ai/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mode, existingItems }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (response.ok && payload.success && payload.data) {
      return {
        success: true,
        detectedType:
          payload.data.detectedType === 'drug_label' ? 'drug_label' : 'checklist_table',
        summaryMessage:
          payload.data.summaryMessage ||
          `อ่านข้อมูลสำเร็จ พบทั้งหมด ${payload.data.items?.length || 0} รายการค่ะ`,
        items: Array.isArray(payload.data.items) ? payload.data.items : [],
      };
    }
    return {
      success: false,
      detectedType: mode === 'scan-label' ? 'drug_label' : 'checklist_table',
      summaryMessage: '',
      items: [],
      error: payload?.error || payload?.message || 'ไม่สามารถอ่านรูปภาพได้',
    };
  } catch (err: any) {
    return {
      success: false,
      detectedType: mode === 'scan-label' ? 'drug_label' : 'checklist_table',
      summaryMessage: '',
      items: [],
      error:
        err?.name === 'AbortError'
          ? 'การวิเคราะห์ภาพใช้เวลานานเกินกำหนด กรุณาลองถ่ายใหม่อีกครั้งค่ะ'
          : err?.message || 'ไม่สามารถเชื่อมต่อระบบวิเคราะห์ภาพได้',
    };
  } finally {
    clearTimeout(timer);
  }
};

