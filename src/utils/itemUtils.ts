import { EquipmentItem } from '../types';

export interface SubExpItemInfo {
  label: string;
  date: string;
  qty: number;
  hasNoExp?: boolean;
}

export interface ItemSubItemsResult {
  subItems: SubExpItemInfo[];
  quantities: number[];
  isMulti: boolean;
}

export interface ItemQuantityClassification {
  isType1: boolean;      // Identical items with total count > 1 (e.g. Tape 4 เส้น, Syringe blow cuff 2 อัน, Sterile water 3 ขวด)
  isType2: boolean;      // Heterogeneous sub-items with distinct sizes/variants (e.g. IV Catheter No.18/20, Extension tube ผู้ใหญ่/เด็ก/T-way)
  totalQty: number;      // Target total quantity
  subItems: string[];    // Sub-item labels for Type 2
}

export function parseSubExps(expStr?: string): Array<{ label: string; date: string }> {
  if (!expStr || !expStr.trim() || expStr === '-') return [];
  const parts = expStr.includes(',') ? expStr.split(',') : [expStr];
  const results: Array<{ label: string; date: string }> = [];
  parts.forEach((p, idx) => {
    const trimmed = p.trim();
    if (!trimmed) return;
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const label = trimmed.substring(0, colonIdx).trim();
      const date = trimmed.substring(colonIdx + 1).trim();
      results.push({ label, date });
    } else {
      results.push({
        label: parts.length > 1 ? `ชิ้นที่ ${idx + 1}` : '',
        date: trimmed,
      });
    }
  });
  return results;
}

export function getItemSizes(item: {
  name: string;
  spec?: string;
  qty?: string | number;
  exp?: string;
  checkType?: 'single' | 'sub_items';
  subItems?: string[];
  subExps?: Array<{ label?: string; exp?: string }>;
}): string[] {
  const name = (item.name || '').toLowerCase();
  const spec = (item.spec || '').toLowerCase();
  const exp = item.exp || '';

  // If explicitly configured as single count, return empty sub-items
  if (item.checkType === 'single') {
    return [];
  }

  // Explicit subItems list
  if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 1) {
    return item.subItems;
  }

  // 0. Explicit subExps labels
  if (item.subExps && item.subExps.length > 1) {
    const valid = item.subExps.map((s) => s.label?.trim()).filter(Boolean) as string[];
    if (valid.length > 1) {
      return valid;
    }
  }

  // 1. Explicit sub-item labels from exp
  if (exp && exp.includes(':') && exp.includes(',')) {
    const subExps = parseSubExps(exp);
    const validLabels = subExps.map((s) => s.label).filter(Boolean);
    const hasDistinctLabels = validLabels.some((lbl) => !/^ชิ้นที่\s*\d+$/i.test(lbl) && !/^อันที่\s*\d+$/i.test(lbl));
    if (validLabels.length > 1 && hasDistinctLabels) {
      return validLabels;
    }
  }

  // 2. Specific medical supplies (Type 2: distinct items grouped together)
  if (name.includes('สำลีก้อน') || name.includes('ถุงมือ')) {
    return ['สำลีก้อน', 'ถุงมือ'];
  }
  if (name.includes('betadine') || name.includes('ammonia')) {
    return ['Betadine', 'Ammonia'];
  }
  if (name.includes('micropore') || name.includes('transpore')) {
    return ['Micropore', 'Transpore'];
  }
  // NOTE: Syringe blow cuff is Type 1 identical items of qty 2, so it is NOT in getItemSizes!
  if (name.includes('ambu bag') && (name.includes('เด็ก') || spec.includes('เด็ก'))) {
    return ['เด็ก', 'ผู้ใหญ่'];
  }
  if (name.includes('o2 mask') && (name.includes('เด็ก') || spec.includes('เด็ก'))) {
    return ['เด็ก', 'ผู้ใหญ่'];
  }
  if (name.includes('stylet')) {
    if (name.includes('กลาง') || spec.includes('กลาง')) return ['ใหญ่', 'กลาง', 'เล็ก'];
    return ['ใหญ่', 'เล็ก'];
  }
  if (name.includes('extension tube') && (name.includes('t-way') || name.includes('t') || spec.includes('t'))) {
    return ['ผู้ใหญ่', 'เด็ก', 'T-way'];
  }
  if (name.includes('extension tube') && (name.includes('เด็ก') || spec.includes('เด็ก'))) {
    return ['ผู้ใหญ่', 'เด็ก'];
  }
  if (name.includes('iv set') && (name.includes('ใหญ่') || spec.includes('ใหญ่'))) {
    return ['หยดมาตรฐาน (ใหญ่)', 'ไมโคร (เล็ก)'];
  }
  if (name.includes('0.9% nss') && (name.includes('100 cc') || name.includes('500cc') || name.includes('10cc') || name.includes('100cc'))) {
    return ['100 cc', '500 cc', '10 cc'];
  }
  if (name.includes('syringe') && (name.includes('3cc') || name.includes('5cc') || name.includes('10cc') || name.includes('ขนาด 3, 5, 10'))) {
    return ['3 cc', '5 cc', '10 cc'];
  }

  // 3. Multi-size equipment (No.18, 20, 21, 25 or เบอร์ 7, 7.5, 8)
  const combined = `${item.name} ${item.spec || ''}`;
  const sizePattern = /(?:No\.|no\.|เบอร์|ขนาด)\s*([0-9.,\s/&]+)/i;
  const match = combined.match(sizePattern);
  if (match && match[1]) {
    const rawSizes = match[1].split(/[,/&]/).map((s: string) => s.trim()).filter((s: string) => /^\d+(\.\d+)?$/.test(s));
    if (rawSizes.length > 1) {
      return rawSizes.map((s: string) => `No.${s}`);
    }
  }

  // 4. Quantity with comma representing sub-items e.g. "1 set (1, 1, 2 อัน)"
  const rawQtyStr = String(item.qty || '');
  const parenMatch = rawQtyStr.match(/\(([0-9.,\s/]+)\)/);
  if (parenMatch && (parenMatch[1].includes(',') || parenMatch[1].includes('/'))) {
    const parts = parenMatch[1].split(/[,/]/).map((p: string) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((_: string, i: number) => `แบบที่ ${i + 1}`);
    }
  }

  return [];
}

/**
 * Classifies an item into Type 1 (homogeneous multiple items e.g. Tape 4 เส้น, Syringe blow cuff 2 อัน)
 * vs Type 2 (heterogeneous sub-items e.g. IV Catheter No.18/20, Extension tube ผู้ใหญ่/เด็ก/T-way)
 */
export function getItemQuantityClassification(item: {
  name: string;
  spec?: string;
  qty?: string | number;
  exp?: string;
  checkType?: 'single' | 'sub_items';
  subItems?: string[];
  subExps?: Array<{ label?: string; exp?: string; qty?: number; hasNoExp?: boolean }>;
  subItemQuantities?: number[];
}): ItemQuantityClassification {
  // 1. If explicitly checkType === 'single', strictly enforce Type 1 (if qty > 1) or single item (if qty === 1)
  if (item.checkType === 'single') {
    const rawQty = String(item.qty || '').trim();
    const leadingNumMatch = rawQty.match(/^(\d+)/);
    const parsedQty = leadingNumMatch ? parseInt(leadingNumMatch[1], 10) : 1;
    if (!isNaN(parsedQty) && parsedQty > 1) {
      return {
        isType1: true,
        isType2: false,
        totalQty: parsedQty,
        subItems: [],
      };
    }
    return { isType1: false, isType2: false, totalQty: 1, subItems: [] };
  }

  // 2. If explicitly checkType === 'sub_items' or has subItems array > 1
  if (item.checkType === 'sub_items' || (item.subItems && item.subItems.length > 1)) {
    const subList = item.subItems && item.subItems.length > 1
      ? item.subItems
      : (item.subExps && item.subExps.length > 1 ? item.subExps.map((s) => s.label || '').filter(Boolean) : []);
    if (subList.length > 1) {
      return {
        isType1: false,
        isType2: true,
        totalQty: subList.length,
        subItems: subList,
      };
    }
  }

  const subSizes = getItemSizes(item);
  const isType2 = subSizes.length > 1;

  if (isType2) {
    return {
      isType1: false,
      isType2: true,
      totalQty: subSizes.length,
      subItems: subSizes,
    };
  }

  // Not Type 2. Check if Type 1 (homogeneous multiple items > 1)
  const name = (item.name || '').toLowerCase();
  // Exclude gas tanks / PSI
  const isPressure = (name.includes('o2') || name.includes('oxygen') || name.includes('ถัง')) &&
    (name.includes('tank') || name.includes('ความดัน') || name.includes('psi'));

  if (isPressure) {
    return { isType1: false, isType2: false, totalQty: 1, subItems: [] };
  }

  const rawQty = String(item.qty || '').trim();
  // If comma in qty e.g. "1, 1", it would have been caught or shouldn't be Type 1
  if (rawQty.includes(',') || rawQty.includes('/')) {
    return { isType1: false, isType2: false, totalQty: 1, subItems: [] };
  }

  const parsedQty = parseInt(rawQty.replace(/\D/g, ''), 10);
  if (!isNaN(parsedQty) && parsedQty > 1) {
    return {
      isType1: true,
      isType2: false,
      totalQty: parsedQty,
      subItems: [],
    };
  }

  return { isType1: false, isType2: false, totalQty: 1, subItems: [] };
}

/**
 * Extracts numeric quantity list from item.qty string or item.subItemQuantities
 * e.g., "1 set (1, 1, 2 อัน)" -> [1, 1, 2]
 * e.g., "1, 1, 2" -> [1, 1, 2]
 * e.g., "2, 2, 2, 2" -> [2, 2, 2, 2]
 */
export function extractQuantityNumbers(strQty?: string | number, subItemQuantities?: number[]): number[] {
  if (subItemQuantities && subItemQuantities.length > 0) {
    return subItemQuantities;
  }
  if (!strQty && strQty !== 0) return [];
  const s = String(strQty).trim();
  if (!s || s === '-') return [];

  // Look for numbers inside parentheses first e.g. "1 set (1, 1, 2 อัน)" or "(1, 1, 2)"
  const parenMatch = s.match(/\(([0-9.,\s/]+)\)/);
  const targetStr = parenMatch ? parenMatch[1] : s;

  if (targetStr.includes(',') || targetStr.includes('/')) {
    const parts = targetStr.split(/[,/]/).map((p) => {
      const num = parseInt(p.replace(/\D/g, ''), 10);
      return isNaN(num) || num <= 0 ? 1 : num;
    });
    if (parts.length > 1) return parts;
  }

  return [];
}

/**
 * Parses an EquipmentItem and resolves all sub-items (labels, dates, default quantities)
 */
export function getItemSubItemsInfo(item: EquipmentItem): ItemSubItemsResult {
  const subItems: SubExpItemInfo[] = [];

  // 1. If explicit subExps exist
  if (item.subExps && item.subExps.length > 0) {
    item.subExps.forEach((se, idx) => {
      const isNoExp = se.hasNoExp ?? (!se.exp || se.exp === '-' || se.exp.toLowerCase() === 'no exp');
      subItems.push({
        label: se.label || `ชิ้นที่ ${idx + 1}`,
        date: isNoExp ? '-' : (se.exp || ''),
        qty: se.qty || item.subItemQuantities?.[idx] || 1,
        hasNoExp: isNoExp,
      });
    });
    const quantities = subItems.map((s) => s.qty);
    return { subItems, quantities, isMulti: subItems.length > 1 };
  }

  // 2. Parse exp string if sub-exps formatted like "Label: Date, Label: Date"
  const parsedExpSubs = parseSubExps(item.exp);
  const qtyNumbers = extractQuantityNumbers(item.qty, item.subItemQuantities);
  const knownSizes = getItemSizes(item);

  // Determine the target sub-item count
  const targetCount = Math.max(
    parsedExpSubs.length,
    qtyNumbers.length,
    knownSizes.length
  );

  if (targetCount > 1) {
    for (let i = 0; i < targetCount; i++) {
      const label =
        parsedExpSubs[i]?.label ||
        knownSizes[i] ||
        `ชิ้นที่ ${i + 1}`;
      const rawDate = parsedExpSubs[i]?.date || '';
      const isNoExp = !rawDate || rawDate === '-' || rawDate.toLowerCase() === 'no exp';
      const date = isNoExp ? '-' : rawDate;
      const qty = qtyNumbers[i] !== undefined ? qtyNumbers[i] : 1;

      subItems.push({ label, date, qty, hasNoExp: isNoExp });
    }

    const quantities = subItems.map((s) => s.qty);
    return { subItems, quantities, isMulti: true };
  }

  // Single item
  const singleQty = parseInt(String(item.qty || '1').replace(/\D/g, ''), 10) || 1;
  const isSingleNoExp = !item.exp || item.exp === '-' || item.exp.toLowerCase() === 'no exp';
  return {
    subItems: [{
      label: '',
      date: isSingleNoExp ? '-' : item.exp!,
      qty: singleQty,
      hasNoExp: isSingleNoExp,
    }],
    quantities: [singleQty],
    isMulti: false,
  };
}
