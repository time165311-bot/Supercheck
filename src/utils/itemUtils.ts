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
 * Strips leading numeric prefixes from item names (e.g., "1. Name" -> "Name", "1.1. Name" -> "Name")
 */
export function sanitizeItemName(name: string): string {
  if (!name) return '';
  // Remove leading numbers ONLY if followed by a clear separator (e.g., "1. ", "1: ", "1- ")
  // This prevents stripping numbers from names like "5% D/N/2" or "0.9% NSS"
  return name.replace(/^\d+\s*[\.\:\-]\s*/, '').trim();
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


