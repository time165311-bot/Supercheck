import { DrugItem, DrugLotBatch, EquipmentItem } from '../types';
import { getBangkokTodayIso, normalizeExpDateToIso, parseBangkokDate } from './dateUtils';

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
  subQuantities: number[]; // Target quantities for sub-items
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
        subQuantities: [parsedQty],
      };
    }
    return { isType1: false, isType2: false, totalQty: 1, subItems: [], subQuantities: [1] };
  }

  // 2. If explicitly checkType === 'sub_items' or has subItems array > 1
  if (item.checkType === 'sub_items' || (item.subItems && item.subItems.length > 1)) {
    const subList = item.subItems && item.subItems.length > 1
      ? item.subItems
      : (item.subExps && item.subExps.length > 1 ? item.subExps.map((s) => s.label || '').filter(Boolean) : []);
    
    if (subList.length > 1) {
      const explicitQtys = item.subItemQuantities || (item.subExps ? item.subExps.map(s => s.qty || 1) : []);
      const finalQtys = Array.from({ length: subList.length }, (_, i) => explicitQtys[i] || 1);

      return {
        isType1: false,
        isType2: true,
        totalQty: finalQtys.reduce((a, b) => a + b, 0),
        subItems: subList,
        subQuantities: finalQtys,
      };
    }
  }

  const subSizes = getItemSizes(item);
  const isType2 = subSizes.length > 1;

  if (isType2) {
    const subInfo = getItemSubItemsInfo(item as any);
    return {
      isType1: false,
      isType2: true,
      totalQty: subInfo.quantities.reduce((a, b) => a + b, 0),
      subItems: subSizes,
      subQuantities: subInfo.quantities,
    };
  }

  // Not Type 2. Check if Type 1 (homogeneous multiple items > 1)
  const name = (item.name || '').toLowerCase();
  // Exclude gas tanks / PSI
  const isPressure = (name.includes('o2') || name.includes('oxygen') || name.includes('ถัง')) &&
    (name.includes('tank') || name.includes('ความดัน') || name.includes('psi'));

  if (isPressure) {
    return { isType1: false, isType2: false, totalQty: 1, subItems: [], subQuantities: [1] };
  }

  const rawQty = String(item.qty || '').trim();
  // If comma in qty e.g. "1, 1", it would have been caught or shouldn't be Type 1
  if (rawQty.includes(',') || rawQty.includes('/')) {
    const extracted = extractQuantityNumbers(rawQty, item.subItemQuantities);
    if (extracted.length > 1) {
       return { isType1: false, isType2: true, totalQty: extracted.reduce((a,b) => a+b, 0), subItems: extracted.map((_, i) => `ชิ้นที่ ${i+1}`), subQuantities: extracted };
    }
    return { isType1: false, isType2: false, totalQty: 1, subItems: [], subQuantities: [1] };
  }

  const parsedQty = parseInt(rawQty.replace(/\D/g, ''), 10);
  if (!isNaN(parsedQty) && parsedQty > 1) {
    return {
      isType1: true,
      isType2: false,
      totalQty: parsedQty,
      subItems: [],
      subQuantities: [parsedQty],
    };
  }

  return { isType1: false, isType2: false, totalQty: 1, subItems: [], subQuantities: [1] };
}

/**
 * Extracts numeric quantity list from item.qty string or item.subItemQuantities
 * e.g., "อย่างละ 2 อัน" -> [2, 2]
 * e.g., "1 set (1, 1, 2 อัน)" -> [1, 1, 2]
 * e.g., "1, 1, 2" -> [1, 1, 2]
 * e.g., "2, 2, 2, 2" -> [2, 2, 2, 2]
 */
export function extractQuantityNumbers(
  strQty?: string | number,
  subItemQuantities?: number[],
  subItemCount?: number
): number[] {
  if (subItemQuantities && subItemQuantities.length > 0) {
    return subItemQuantities;
  }
  if (!strQty && strQty !== 0) return [];
  const s = String(strQty).trim();
  if (!s || s === '-') return [];

  // Match "อย่างละ X" e.g. "อย่างละ 2", "อย่างละ 2 อัน", "อย่างละ 5"
  const eachMatch = s.match(/อย่างละ\s*(\d+)/i);
  if (eachMatch) {
    const num = parseInt(eachMatch[1], 10);
    const count = subItemCount && subItemCount > 0 ? subItemCount : 2;
    return Array(count).fill(num);
  }

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
  const knownSizes = getItemSizes(item);
  const candidateCount = Math.max(
    parsedExpSubs.length,
    knownSizes.length,
    item.subItems?.length || 0
  );

  const qtySource = item.qty || (item as any).unitText || (item as any).initialQtyText;
  const qtyNumbers = extractQuantityNumbers(qtySource, item.subItemQuantities, candidateCount);

  // Determine the target sub-item count
  const targetCount = Math.max(candidateCount, qtyNumbers.length);

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

/**
 * Computes the real target quantity check value string for Auto-Check:
 * - Type 2 (sub-items e.g. IV Catheter, Extension tube): real sub-quantities e.g. "2, 2, 2, 2" or "1, 1, 2"
 * - Type 1 (homogeneous e.g. Tape 4 เส้น, Syringe blow cuff 2 อัน): total count string e.g. "4", "2"
 * - O2 tank: "2000, 2000" (PSI)
 * - Single item: "1" (or its target single quantity)
 */
export function getRealTargetCheckValue(item: EquipmentItem): string {
  const name = (item.name || '').toLowerCase();

  // O2 tank special case: full pressure 2000 PSI per tank
  if (
    (name.includes('o2') || name.includes('oxygen') || name.includes('ออกซิเจน')) &&
    (name.includes('tank') || name.includes('ถัง'))
  ) {
    return '2000, 2000';
  }

  const classification = getItemQuantityClassification(item);

  // Type 1: Homogeneous item (e.g. Tape 4 เส้น -> '4')
  if (classification.isType1) {
    return String(classification.totalQty || 1);
  }

  // Type 2: Heterogeneous item (e.g. IV Catheter 4 sizes of 2 each -> '2, 2, 2, 2')
  if (classification.isType2) {
    const subInfo = getItemSubItemsInfo(item);
    if (subInfo.quantities && subInfo.quantities.length > 0) {
      return subInfo.quantities.join(', ');
    }
    return classification.subItems.map(() => '1').join(', ');
  }

  if (item.subItemQuantities && item.subItemQuantities.length > 0) {
    return item.subItemQuantities.join(', ');
  }

  const qtyNumbers = extractQuantityNumbers(item.qty, item.subItemQuantities);
  if (qtyNumbers.length > 1) {
    return qtyNumbers.join(', ');
  }

  const singleParsed = parseInt(String(item.qty || '1').replace(/\D/g, ''), 10);
  if (!isNaN(singleParsed) && singleParsed > 1) {
    return String(singleParsed);
  }

  return '1';
}

/**
 * Resolves the unit text string to display in PDF report column 2 and EditItemModal:
 * - If unitText or initialQtyText exists and is non-empty, use it.
 * - If subItemQuantities are all identical (e.g. [2, 2] or [5, 5]), formats as "อย่างละ X".
 * - If qty is comma-separated identical numbers (e.g. "2, 2"), formats as "อย่างละ 2".
 * - Otherwise falls back to item.qty or '1'.
 */
export function resolveItemUnitText(item?: {
  unitText?: string;
  initialQtyText?: string;
  qty?: string | number;
  subItemQuantities?: number[];
  subExps?: Array<{ qty?: number }>;
}): string {
  if (!item) return '1';
  if (item.unitText && String(item.unitText).trim()) return String(item.unitText).trim();
  if (item.initialQtyText && String(item.initialQtyText).trim()) return String(item.initialQtyText).trim();

  // If subItemQuantities or subExps exist and all are identical (e.g. [2, 2]), return "อย่างละ X"
  const sq = item.subItemQuantities || (item.subExps ? item.subExps.map((s) => s.qty || 1) : []);
  if (sq.length > 1 && sq.every((q) => q === sq[0])) {
    return `อย่างละ ${sq[0]}`;
  }

  const rawQty = item.qty !== undefined && item.qty !== null ? String(item.qty).trim() : '';
  if (rawQty && rawQty !== '-') {
    if (rawQty.includes(',')) {
      const parts = rawQty
        .split(',')
        .map((p: string) => parseInt(p.trim(), 10))
        .filter((n: number) => !isNaN(n));
      if (parts.length > 1 && parts.every((n: number) => n === parts[0])) {
        return `อย่างละ ${parts[0]}`;
      }
    }
    return rawQty;
  }

  return '1';
}

/**
 * Normalizes expiration date strings:
 * - Converts MM/YY, MM/YYYY, MM-YY (e.g., "12/73", "12/2073", "05/26") to 1st day of month (e.g. "01/12/2573" or "01/05/2026")
 * - Handles "No EXP", "ไม่มีวันหมดอายุ", "-" to set hasNoExp: true
 */
export function normalizeExpDate(expStr?: string): { expDate: string; hasNoExp: boolean } {
  if (!expStr || expStr.trim() === '' || expStr === '-' || /no\s*exp/i.test(expStr) || /ไม่มี/i.test(expStr)) {
    return { expDate: '-', hasNoExp: true };
  }

  const s = expStr.trim();

  // Match MM/YY or MM/YYYY or MM-YY or MM.YY
  const mmYyMatch = s.match(/^(\d{1,2})[-/.](\d{2,4})$/);
  if (mmYyMatch) {
    const month = String(parseInt(mmYyMatch[1], 10)).padStart(2, '0');
    let year = parseInt(mmYyMatch[2], 10);
    if (year < 100) {
      if (year >= 50) year += 2500;
      else year += 2000;
    }
    return { expDate: `01/${month}/${year}`, hasNoExp: false };
  }

  // Match YYYY-MM or YYYY/MM
  const yyyyMmMatch = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (yyyyMmMatch) {
    let year = parseInt(yyyyMmMatch[1], 10);
    const month = String(parseInt(yyyyMmMatch[2], 10)).padStart(2, '0');
    return { expDate: `01/${month}/${year}`, hasNoExp: false };
  }

  return { expDate: s, hasNoExp: false };
}

/**
 * Strips leading numeric prefixes from item names (e.g., "1. Name" -> "Name", "1.1. Name" -> "Name")
 */
export function sanitizeItemName(name: string): string {
  if (!name) return '';
  let cleaned = name
    .replace(/สัปดาห์\s*\d+\s*(?:ต่อ\s*\d+)?/gi, '')
    .replace(/สัปดาห์ที่\s*\d+/gi, '')
    .replace(/จำนวนมาตรฐาน\s*\d*\s*(?:ชุด|อัน|ชิ้น|ขวด|เส้น|amp)?/gi, '')
    .replace(/จำนวนตั้งต้น/gi, '')
    .replace(/par\s*level/gi, '')
    .replace(/ยอดยกมา/gi, '')
    .replace(/รวมสัปดาห์[^\n]*/gi, '')
    .replace(/^\d+\s*[\.\:\-]\s*/, '')
    .trim();
  return cleaned || name.trim();
}

/**
 * Sorts an array of items naturally by name (e.g., No. 4 < No. 10)
 */
export function sortItemsNaturally<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = sanitizeItemName(a.name);
    const nameB = sanitizeItemName(b.name);
    
    // Primary sort: Sanitized Name (Natural)
    const nameComp = nameA.localeCompare(nameB, 'th', { numeric: true, sensitivity: 'base' });
    if (nameComp !== 0) return nameComp;
    
    // Secondary sort: Original Name (just in case)
    return a.name.localeCompare(b.name, 'th', { numeric: true });
  });
}

/**
 * Safely parses any date string (ISO, YYYY-MM-DD, DD/MM/YYYY, MM/YY) into a Date object,
 * properly adjusting Thai Buddhist Era years (พ.ศ. >= 2400) to standard CE years (-543)
 * so it never returns Invalid Date (NaN).
 */
export function parseExpDateObj(dateStr?: string): Date | null {
  return parseBangkokDate(dateStr);
}

/**
 * Extract numbers/sizes from a medical item name
 * e.g., "Endotracheal tube No. 7.5" -> ["7.5"]
 * e.g., "Syringe 3 ml" -> ["3"]
 * e.g., "IV Catheter 18G" -> ["18"]
 * e.g., "NSS 1000 cc" -> ["1000"]
 */
export function extractSignificantNumbers(str: string): string[] {
  if (!str) return [];
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  const results: string[] = [];
  matches.forEach((m) => {
    results.push(m);
    const num = parseFloat(m);
    if (!isNaN(num)) {
      results.push(String(num));
    }
  });
  return Array.from(new Set(results));
}

/**
 * Anesthesia Ward Medical Aliases & Equivalents Dictionary
 * Maps generic names, commercial/brand names, Thai phonetics, and common clinical abbreviations.
 */
export const ANESTHESIA_ALIASES: string[][] = [
  ['adrenaline', 'epinephrine', 'อะดรีนาลีน', 'แอดดรีนาลีน', 'เอพิเนฟริน', 'adren'],
  ['noradrenaline', 'norepinephrine', 'levophed', 'นอร์เอพิเนฟริน', 'นอร์อะดรีนาลีน', 'เลโวเฟด'],
  ['atropine', 'อะโทรปีน', 'เอโทรปีน'],
  ['ephedrine', 'เอฟิดรีน', 'อีฟิดรีน'],
  ['dopamine', 'โดปามีน'],
  ['dobutamine', 'โดบูทามีน'],
  ['amiodarone', 'cordarone', 'อะมิโอดาโรน', 'คอร์ดาโรน'],
  ['adenosine', 'adenocor', 'อะดีโนซีน'],
  ['nicardipine', 'perdipine', 'นิคาร์ดิปีน', 'เพอร์ดิปีน'],
  ['labetalol', 'trandate', 'ลาบีทาลอล'],
  ['propofol', 'diprivan', 'โพรโพฟอล', 'ดิปริแวน'],
  ['midazolam', 'dormicum', 'ไมดาโซแลม', 'ดอร์มิคุม', 'ดอร์มิคุ่ม'],
  ['diazepam', 'valium', 'ไดอะซีแพม', 'แวเลียม'],
  ['fentanyl', 'sublimaze', 'เฟนทานิล', 'เฟนตานิล'],
  ['morphine', 'มอร์ฟีน'],
  ['pethidine', 'meperidine', 'เพทิดีน', 'เดเมอรอล'],
  ['ketamine', 'calypsol', 'เคตามีน'],
  ['succinylcholine', 'scoline', 'anectine', 'suxamethonium', 'ซัคซีนิลโคลีน', 'สโคลีน'],
  ['cisatracurium', 'nimbex', 'ซิสอะทราคูเรียม', 'นิมเบกซ์'],
  ['atracurium', 'tracrium', 'อะทราคูเรียม', 'แทรคเรียม'],
  ['vecuronium', 'norcuron', 'เวคูโรเนียม'],
  ['rocuronium', 'esmeron', 'โรโคโรเนียม', 'โรคูโรเนียม', 'เอสเมอรอน'],
  ['sugammadex', 'bridion', 'ซูกัมมาเด็กซ์', 'ไบรดิออน'],
  ['lidocaine', 'xylocaine', 'ลิโดเคน', 'ไซโลเคน'],
  ['bupivacaine', 'marcaine', 'บูพิวาเคน', 'มาร์เคน'],
  ['neostigmine', 'prostigmin', 'นีโอสติกมีน', 'โพรสติกมิน'],
  ['naloxone', 'narcan', 'นาล็อกโซน', 'นาร์แคน'],
  ['flumazenil', 'anexate', 'ฟลูมาเซนิล', 'แอนเน็กเซต'],
  ['tranexamic acid', 'transamin', 'ทรานซามิน', 'ทราเนซามิก'],
  ['dexamethasone', 'เดกซาเมทาโซน', 'เดกซ่า'],
  ['hydrocortisone', 'ไฮโดรคอร์ติโซน'],
  ['ondansetron', 'zofran', 'ออนแดนซีตรอน', 'โซฟราน'],
  ['metoclopramide', 'plasil', 'เมโทโคลพราไมด์', 'พลาซิล'],
  ['calcium gluconate', 'แคลเซียมกลูโคเนต', 'calcium'],
  ['sodium bicarbonate', 'nahco3', 'โซเดียมไบคาร์บอเนต', '7.5% nahco3'],
  ['magnesium sulfate', 'mgso4', 'แมกนีเซียมซัลเฟต'],
  ['sevoflurane', 'sevorane', 'เซโวฟลูเรน'],
  ['desflurane', 'suprane', 'เดสฟลูเรน'],
  ['isoflurane', 'forane', 'ไอโซฟลูเรน'],
  ['endotracheal tube', 'et tube', 'ett', 'ท่อช่วยหายใจ'],
  ['laryngeal mask airway', 'laryngeal mask', 'lma', 'หน้ากากกล่องเสียง'],
  ['oropharyngeal airway', 'oral airway', 'guedel', 'airway'],
  ['nasopharyngeal airway', 'nasal airway', 'npa'],
  ['laryngoscope', 'ลาริงโกสโคป', 'macintosh', 'miller blade'],
  ['stylet', 'สไตเลท', 'ไกด์วาย', 'ไกด์ลวด'],
  ['ambu bag', 'bvm', 'แอมบูแบค', 'แอมบูแบ็ก', 'ลูกบีบช่วยหายใจ'],
  ['nasal cannula', 'o2 cannula', 'cannula', 'สายแคนนูลา', 'สายออกซิเจน'],
  ['iv catheter', 'angiocath', 'jelco', 'venflon', 'เข็มเปิดเส้น', 'เข็ม iv', 'ไอวีแคท'],
  ['extension tube', 't-way', 'three way', 'ทรีเวย์', 'สายต่อ'],
  ['0.9% nss', 'nss', 'normal saline', 'น้ำเกลือ'],
  ['sterile water', 'water for injection', 'น้ำกลั่น'],
  ['lactated ringer', 'ringer lactate', 'lrs', 'rls', 'ริงเกอร์'],
];

/**
 * Computes a clinical match confidence score (0 = incompatible/no match).
 * Enforces strict size/number verification (e.g. 7.0 vs 7.5, 18G vs 20G).
 */
export function scoreMedicalItemMatch(queryName: string, candidateName: string, candidateSpec: string = ''): number {
  if (!queryName || !candidateName) return 0;
  const qClean = queryName.trim().toLowerCase();
  const cClean = candidateName.trim().toLowerCase();
  const specClean = candidateSpec.trim().toLowerCase();
  const fullCandidate = `${cClean} ${specClean}`.trim();

  if (qClean === cClean || qClean === fullCandidate) return 100;

  // 1. Adult vs Pediatric check
  const qChild = qClean.includes('เด็ก') || qClean.includes('pediatric') || qClean.includes('pedia');
  const cChild = fullCandidate.includes('เด็ก') || fullCandidate.includes('pediatric') || fullCandidate.includes('pedia');
  const qAdult = qClean.includes('ผู้ใหญ่') || qClean.includes('adult');
  const cAdult = fullCandidate.includes('ผู้ใหญ่') || fullCandidate.includes('adult');

  if (qChild && !cChild && cAdult) return 0;
  if (qAdult && !cAdult && cChild) return 0;

  // 2. Strict size/number matching (e.g. No. 7.0 vs 7.5, 18G vs 20G, 3 ml vs 10 ml)
  const qNums = extractSignificantNumbers(qClean);
  const cNums = extractSignificantNumbers(fullCandidate);
  let hasExactNumberMatch = false;

  if (qNums.length > 0 && cNums.length > 0) {
    const hasSharedNumber = qNums.some((qn) => cNums.includes(qn));
    if (!hasSharedNumber) {
      return 0; // Reject cross-size match strictly
    }
    hasExactNumberMatch = true;
  }

  let score = 0;

  // 3. Anesthesia Medical Alias Group Matching
  for (const group of ANESTHESIA_ALIASES) {
    const qMatches = group.some((alias) => qClean.includes(alias));
    const cMatches = group.some((alias) => fullCandidate.includes(alias));
    if (qMatches && cMatches) {
      score = Math.max(score, hasExactNumberMatch ? 90 : qNums.length > 0 && cNums.length === 0 ? 55 : 80);
    }
  }

  // 4. Direct substring match
  if (fullCandidate.includes(qClean) || cClean.includes(qClean)) {
    score = Math.max(score, hasExactNumberMatch ? 95 : 85);
  } else if (qClean.includes(cClean) && cClean.length >= 3) {
    score = Math.max(score, hasExactNumberMatch ? 85 : 70);
  }

  if (score > 0) {
    // Penalize slightly if query had a size number but candidate did not specify one
    if (qNums.length > 0 && cNums.length === 0) {
      score -= 15;
    }
    return score;
  }

  // 5. Word overlap & Tokenization
  const getKeywords = (s: string) =>
    s
      .replace(/[^a-z0-9ก-๙.]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['เบอร์', 'ขนาด', 'no', 'อย่าง', 'ละ', 'ชุด', 'ชิ้น', 'อัน', 'กระเป๋า', 'รถ', 'ตู้', 'และ', 'กับ', 'หรือ', 'ของ'].includes(w));

  const qWords = getKeywords(qClean);
  const cWords = getKeywords(fullCandidate);

  if (qWords.length === 0 || cWords.length === 0) return 0;

  let matchCount = 0;
  for (const qw of qWords) {
    if (cWords.some((cw) => cw === qw || (qw.length >= 4 && cw.includes(qw)) || (cw.length >= 4 && qw.includes(cw)))) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / qWords.length;
  if (matchCount >= 2 || (matchCount >= 1 && matchRatio >= 0.5)) {
    return Math.round(40 + matchRatio * 30 + (hasExactNumberMatch ? 20 : 0));
  }

  return 0;
}

/**
 * Intelligent matching between OCR / Voice item names and Catalog equipment/drug names.
 */
export function matchMedicalItemName(queryName: string, candidateName: string, candidateSpec: string = ''): boolean {
  return scoreMedicalItemMatch(queryName, candidateName, candidateSpec) > 0;
}

/**
 * Returns matched items sorted by highest clinical + size confidence score.
 */
export function findBestMedicalMatches<T>(
  queryName: string,
  items: T[],
  getName: (it: T) => string,
  getSpec?: (it: T) => string
): T[] {
  return items
    .map((it) => ({
      item: it,
      score: scoreMedicalItemMatch(queryName, getName(it), getSpec ? getSpec(it) : ''),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Normalizes a DrugItem's lot batches and recomputes aggregate remaining/totalQty
 * plus earliest active lot expiryDate (FEFO baseline).
 */
export function recomputeDrugFromLots(drug: DrugItem): DrugItem {
  const rawLots = Array.isArray(drug.lots) && drug.lots.length > 0
    ? drug.lots
    : Array.isArray(drug.batches) && drug.batches.length > 0
    ? drug.batches
    : [];

  if (rawLots.length === 0) {
    const normalizedExp = normalizeExpDateToIso(drug.expDate || drug.exp) || (drug.expDate || drug.exp || '');
    const qty = Math.max(0, Number(drug.remaining ?? drug.totalQty ?? 0) || 0);
    return {
      ...drug,
      remaining: qty,
      totalQty: qty,
      expDate: normalizedExp,
      exp: normalizedExp,
    };
  }

  const normalizedLots: DrugLotBatch[] = rawLots
    .map((lot) => ({
      lotNumber: String(lot.lotNumber || 'LOT-DEFAULT').trim() || 'LOT-DEFAULT',
      expiryDate: normalizeExpDateToIso(lot.expiryDate) || String(lot.expiryDate || '').trim(),
      quantity: Math.max(0, Number(lot.quantity) || 0),
      receivedDate: lot.receivedDate ? (normalizeExpDateToIso(lot.receivedDate) || lot.receivedDate) : undefined,
    }))
    .sort((a, b) => {
      const da = a.expiryDate || '9999-12-31';
      const db = b.expiryDate || '9999-12-31';
      return da.localeCompare(db);
    });

  const activeLots = normalizedLots.filter((l) => l.quantity > 0);
  const totalRemaining = normalizedLots.reduce((sum, l) => sum + l.quantity, 0);
  const earliestLot = activeLots.find((l) => Boolean(l.expiryDate)) || activeLots[0] || normalizedLots[0];
  const earliestExp = earliestLot?.expiryDate || normalizeExpDateToIso(drug.expDate || drug.exp) || '';

  return {
    ...drug,
    lots: normalizedLots,
    batches: normalizedLots,
    remaining: totalRemaining,
    totalQty: totalRemaining,
    expDate: earliestExp,
    exp: earliestExp,
    lotNumber: earliestLot?.lotNumber || drug.lotNumber,
  };
}

/**
 * Performs FEFO (First Expired, First Out) deduction across a drug's lot batches,
 * clamping remaining quantities safely at >= 0.
 */
export function deductDrugLotsFEFO(
  drug: DrugItem,
  qtyToDeduct: number
): {
  updatedDrug: DrugItem;
  deductedFromLots: Array<{ lotNumber: string; deductedQty: number; expiryDate: string }>;
  remainingToDeduct: number;
} {
  const safeQty = Math.max(0, Number(qtyToDeduct) || 0);
  const normalized = recomputeDrugFromLots(drug);
  const deductedFromLots: Array<{ lotNumber: string; deductedQty: number; expiryDate: string }> = [];

  if (!normalized.lots || normalized.lots.length === 0) {
    const before = Math.max(0, Number(normalized.remaining ?? normalized.totalQty ?? 0) || 0);
    const actualDeduct = Math.min(before, safeQty);
    const nextQty = Math.max(0, before - safeQty);
    if (actualDeduct > 0) {
      deductedFromLots.push({
        lotNumber: normalized.lotNumber || 'DEFAULT',
        deductedQty: actualDeduct,
        expiryDate: normalized.expDate || '',
      });
    }
    return {
      updatedDrug: {
        ...normalized,
        remaining: nextQty,
        totalQty: nextQty,
        updatedAt: new Date().toISOString(),
      },
      deductedFromLots,
      remainingToDeduct: Math.max(0, safeQty - actualDeduct),
    };
  }

  let left = safeQty;
  const nextLots = normalized.lots.map((lot) => {
    if (left <= 0 || lot.quantity <= 0) return lot;
    const take = Math.min(lot.quantity, left);
    left -= take;
    if (take > 0) {
      deductedFromLots.push({
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

  const recomputed = recomputeDrugFromLots({
    ...normalized,
    lots: nextLots,
    batches: nextLots,
    updatedAt: getBangkokTodayIso(),
  });

  return {
    updatedDrug: {
      ...recomputed,
      updatedAt: new Date().toISOString(),
    },
    deductedFromLots,
    remainingToDeduct: left,
  };
}

function computeLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export interface FuzzyMedicalMatchResult<T> {
  item: T;
  score: number;      // 0 - 100 normalized confidence
  matchedBy: 'code' | 'exact' | 'alias' | 'fuzzy';
}

/**
 * Enhanced medical matching combining Standard Codes (TMT / HIS / Barcode),
 * Clinical Alias Dictionary, Token Overlap, and Levenshtein similarity with strict size guard.
 */
export function findFuzzyDrugOrItemMatches<T>(
  queryName: string,
  items: T[],
  options: {
    getName: (it: T) => string;
    getSpec?: (it: T) => string;
    getCodes?: (it: T) => Array<string | undefined>;
    queryCode?: string;
    minScore?: number;
  }
): FuzzyMedicalMatchResult<T>[] {
  const qRaw = (queryName || '').trim().toLowerCase();
  const qCode = (options.queryCode || '').trim().toLowerCase();
  const minScore = options.minScore ?? 45;

  const qAlpha = qRaw.replace(/[^a-z0-9ก-๙]/g, '');
  const qNums = extractSignificantNumbers(qRaw);

  const results: FuzzyMedicalMatchResult<T>[] = [];

  for (const item of items) {
    const cName = (options.getName(item) || '').trim();
    const cSpec = (options.getSpec ? options.getSpec(item) : '') || '';
    const codes = (options.getCodes ? options.getCodes(item) : [])
      .map((c) => (c || '').trim().toLowerCase())
      .filter(Boolean);

    // 1. Standard code exact match (TMT / HIS / Barcode)
    if (qCode && codes.some((c) => c === qCode)) {
      results.push({ item, score: 100, matchedBy: 'code' });
      continue;
    }

    if (!qRaw && !qCode) continue;

    // 2. Clinical & Size-guarded score
    const cLower = cName.toLowerCase();
    const fullLower = `${cLower} ${cSpec.toLowerCase()}`.trim();
    if (qRaw && (qRaw === cLower || qRaw === fullLower)) {
      results.push({ item, score: 100, matchedBy: 'exact' });
      continue;
    }

    // Strict size check before Levenshtein fuzzy matching
    const cNums = extractSignificantNumbers(fullLower);
    if (qNums.length > 0 && cNums.length > 0 && !qNums.some((qn) => cNums.includes(qn))) {
      continue;
    }

    const baseScore = scoreMedicalItemMatch(qRaw, cName, cSpec);
    if (baseScore > 0) {
      const matchedBy: FuzzyMedicalMatchResult<T>['matchedBy'] =
        baseScore >= 95 ? 'exact' : baseScore >= 75 ? 'alias' : 'fuzzy';
      if (baseScore >= minScore) {
        results.push({ item, score: Math.min(100, baseScore), matchedBy });
      }
      continue;
    }

    // 3. Levenshtein similarity fallback (handles OCR typos e.g. "Adrenalin" vs "Adrenaline", "Propfol")
    const cAlpha = cLower.replace(/[^a-z0-9ก-๙]/g, '');
    if (qAlpha.length >= 4 && cAlpha.length >= 4) {
      const dist = computeLevenshtein(qAlpha, cAlpha);
      const maxLen = Math.max(qAlpha.length, cAlpha.length);
      const simScore = Math.round((1 - dist / maxLen) * 100);
      if (simScore >= Math.max(minScore, 62)) {
        results.push({ item, score: Math.min(92, simScore), matchedBy: 'fuzzy' });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

