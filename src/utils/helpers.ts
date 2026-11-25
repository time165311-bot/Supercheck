import { DrugItem, EquipmentItem, ListConfig, CheckItemState } from '../types';
import { parseExpDateObj } from './itemUtils';

/**
 * Generates channel-isolated localStorage / sessionStorage keys so switching wards
 * never mixes drugs, equipment, checklists, or chat histories across channels.
 */
export function getChannelStorageKeys(channelId: string) {
  const safeId = (channelId || 'channel_master').trim() || 'channel_master';
  return {
    LISTS: `anesthesia_lists_${safeId}`,
    CHECKS: `anesthesia_checks_${safeId}`,
    DRUGS: `anesthesia_drugs_${safeId}`,
    EQ: `anesthesia_eq_${safeId}`,
    CHAT_HISTORY: `aura_chat_${safeId}`,
    WEEK_DATES: `anesthesia_week_dates_${safeId}`,
  };
}

/**
 * Compresses an uploaded image File or Blob to JPEG and guarantees the resulting
 * Base64 Data URL stays strictly below 450,000 characters (safe under Firestore's 500,000-byte limit).
 */
export function compressImageForFirestore(
  file: File | Blob,
  maxWidth: number = 1024,
  initialQuality: number = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const MAX_CHARS = 440000;
          let targetMaxDim = maxWidth;
          let quality = initialQuality;

          const renderAt = (maxDim: number, q: number): string => {
            let width = img.width || maxDim;
            let height = img.height || maxDim;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.max(1, Math.round((height * maxDim) / width));
                width = maxDim;
              } else {
                width = Math.max(1, Math.round((width * maxDim) / height));
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return dataUrl;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL('image/jpeg', q);
          };

          let result = renderAt(targetMaxDim, quality);
          const attempts: Array<[number, number]> = [
            [maxWidth, 0.55],
            [Math.min(800, maxWidth), 0.5],
            [640, 0.42],
            [480, 0.35],
          ];

          for (const [dim, q] of attempts) {
            if (result.length <= MAX_CHARS) break;
            result = renderAt(dim, q);
          }

          resolve(result);
        } catch (err) {
          resolve(dataUrl.length <= 450000 ? dataUrl : dataUrl.slice(0, 450000));
        }
      };
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(file);
  });
}

const isJunkEq = (name?: string, id?: string): boolean => {
  const n = (name || '').trim();
  const i = (id || '').trim();
  if (!n) return true;
  if (/^eq[\s_-]*17\d+/i.test(n) || /^eq[\s_-]*17\d+/i.test(i)) return true;
  if (/^eq[\s_-]*\d{8,}$/i.test(n) || /^eq[\s_-]*\d{8,}$/i.test(i)) return true;
  if (/^test[\s_-]*\d*$/i.test(n)) return true;
  return false;
};

export interface AuraCompactInventoryItem {
  id: string;
  name: string;
  quantity: number | string;
  minQuantity: number | string;
  expiryDate: string;
  location: string;
}

export interface AuraLiveContextSummary {
  totalDrugs: number;
  totalEquipment: number;
  expiringSoonOrExpired: Array<{ name: string; remaining: number | string; expDate: string; daysRemaining: number }>;
  lowStock: Array<{ name: string; remaining: number; minStock: number; unit: string }>;
  damagedEquipment: Array<{ name: string; location: string; note?: string }>;
  bagCheckedRatio: string;
  cartCheckedRatio: string;
  ambulanceCheckedRatio: string;
  summaryText: string;
  inventory: AuraCompactInventoryItem[];
}

/**
 * Builds a compact real-time operational snapshot of drugs, OR equipment,
 * emergency bags, and crash carts for Aura AI clinical & inventory reasoning.
 */
export function buildAuraLiveContext(
  drugs: DrugItem[] = [],
  equipment: Record<string, EquipmentItem[]> = {},
  lists?: Record<string, ListConfig>,
  globalChecks?: Record<string, Record<string, CheckItemState>>
): AuraLiveContextSummary {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiringSoonOrExpired: AuraLiveContextSummary['expiringSoonOrExpired'] = [];
  const lowStock: AuraLiveContextSummary['lowStock'] = [];
  const compactInventory: AuraCompactInventoryItem[] = [];

  (drugs || []).forEach((d) => {
    const expStr = d.expDate || d.exp || '-';
    const rem = Number(d.remaining ?? d.totalQty ?? 0);
    const min = Number(d.minStock ?? 0);

    compactInventory.push({
      id: String(d.id || ''),
      name: d.name,
      quantity: rem,
      minQuantity: min,
      expiryDate: expStr,
      location: 'คลังยา',
    });

    if (expStr && expStr !== '-') {
      const dObj = parseExpDateObj(expStr);
      if (dObj) {
        const diffDays = Math.ceil((dObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          expiringSoonOrExpired.push({
            name: d.name,
            remaining: d.remaining ?? d.totalQty ?? 0,
            expDate: expStr,
            daysRemaining: diffDays,
          });
        }
      }
    }
    if (min > 0 && rem <= min) {
      lowStock.push({
        name: d.name,
        remaining: rem,
        minStock: min,
        unit: d.unit || 'ชิ้น',
      });
    }
  });

  let totalEquipment = 0;
  const damagedEquipment: AuraLiveContextSummary['damagedEquipment'] = [];

  Object.entries(equipment || {}).forEach(([roomId, items]) => {
    const checks = globalChecks?.[roomId] || {};
    (items || []).forEach((eq, idx) => {
      if (isJunkEq(eq.name, eq.id)) return;
      totalEquipment++;
      const key = eq.id || `${roomId}_${idx}`;
      const chk = checks[key];
      const loc = eq.location || `ห้อง ${roomId.toUpperCase()}`;
      compactInventory.push({
        id: String(key),
        name: eq.name,
        quantity: eq.unitText || eq.qty || 1,
        minQuantity: 1,
        expiryDate: chk?.exp || eq.exp || '-',
        location: loc,
      });
      if (chk?.result === 'ผิดปกติ') {
        damagedEquipment.push({
          name: eq.name,
          location: loc,
          note: chk.note || eq.note,
        });
      }
    });
  });

  const calcRatio = (cat: 'bag' | 'cart' | 'ambulance') => {
    const groups = lists?.[cat]?.groups || {};
    const checks = globalChecks?.[cat] || {};
    let total = 0;
    let passed = 0;
    const catLabel =
      cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน';
    Object.entries(groups).forEach(([gName, items]) => {
      (items || []).forEach((it, idx) => {
        if (isJunkEq(it.name, it.id)) return;
        total++;
        const key = it.id || `${cat}_${gName}_${idx}`;
        const chk = checks[key];
        compactInventory.push({
          id: String(key),
          name: it.name,
          quantity: it.unitText || it.qty || 1,
          minQuantity: 1,
          expiryDate: chk?.exp || it.exp || '-',
          location: catLabel,
        });
        if (chk?.result === 'ปกติ') passed++;
        if (chk?.result === 'ผิดปกติ') {
          damagedEquipment.push({
            name: it.name,
            location: catLabel,
            note: chk?.note || it.note,
          });
        }
      });
    });
    return `${passed}/${total}`;
  };

  const bagCheckedRatio = calcRatio('bag');
  const cartCheckedRatio = calcRatio('cart');
  const ambulanceCheckedRatio = calcRatio('ambulance');

  const lines = [
    `คลังยา: ${(drugs || []).length} รายการ (ใกล้/หมดอายุ ≤30 วัน: ${expiringSoonOrExpired.length}, ต่ำกว่า Min Stock: ${lowStock.length})`,
    `ครุภัณฑ์ห้อง OR: ${totalEquipment} รายการ (ชำรุด/ผิดปกติ: ${damagedEquipment.length})`,
    `กระเป๋าฉุกเฉินตรวจปกติ: ${bagCheckedRatio} | รถฉุกเฉินตรวจปกติ: ${cartCheckedRatio} | รถพยาบาลฉุกเฉิน: ${ambulanceCheckedRatio}`,
  ];

  if (expiringSoonOrExpired.length > 0) {
    lines.push(
      `ยาใกล้หมดอายุ: ${expiringSoonOrExpired
        .slice(0, 6)
        .map((x) => `${x.name} (EXP ${x.expDate})`)
        .join(', ')}`
    );
  }
  if (lowStock.length > 0) {
    lines.push(
      `ยาใกล้หมด: ${lowStock
        .slice(0, 6)
        .map((x) => `${x.name} เหลือ ${x.remaining}/${x.minStock} ${x.unit}`)
        .join(', ')}`
    );
  }
  if (damagedEquipment.length > 0) {
    lines.push(
      `อุปกรณ์ชำรุด: ${damagedEquipment
        .slice(0, 6)
        .map((x) => `${x.name} [${x.location}]`)
        .join(', ')}`
    );
  }

  return {
    totalDrugs: (drugs || []).length,
    totalEquipment,
    expiringSoonOrExpired: expiringSoonOrExpired.slice(0, 15),
    lowStock: lowStock.slice(0, 15),
    damagedEquipment: damagedEquipment.slice(0, 15),
    bagCheckedRatio,
    cartCheckedRatio,
    ambulanceCheckedRatio,
    summaryText: lines.join('\n'),
    inventory: compactInventory.slice(0, 60),
  };
}
