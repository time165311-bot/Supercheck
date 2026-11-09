import { getChannelDbKey, getChannelListsKey, getStored, setStored, STORAGE_KEYS } from './storage';
import { ChannelData } from '../context/DataContext';
import { EquipmentItem, DrugItem } from '../types';
import { categoryCovers } from '../assets/categoryCovers';

export interface VisionExtractionResult {
  success: boolean;
  items: Array<{
    name: string;
    unitText?: string;
    category?: string;
    groupName?: string;
    subItems?: string[];
    exp?: string;
    [key: string]: any;
  }>;
  isQuotaExceeded?: boolean;
  message?: string;
  error?: string;
}

/**
 * Fuzzy Matching Logic (Levenshtein Distance)
 */
export function isSimilar(input: string, target: string, threshold: number = 2): boolean {
  if (!input || !target) return false;
  const s1 = input.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '').trim();
  const s2 = target.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '').trim();
  
  if (s1.length < 2) return false;
  if (s2.includes(s1) || s1.includes(s2)) return true;

  const m = s1.length;
  const n = s2.length;
  if (Math.abs(m - n) > threshold) return false;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n] <= threshold;
}

/**
 * Find Closest Matches for Suggestions
 */
export function findClosestMatches(query: string, data: ChannelData, drugs: DrugItem[], limit: number = 3): string[] {
  const q = normalizeText(query);
  const candidates: string[] = [];
  
  drugs.forEach(d => candidates.push(d.name));
  ['bag', 'cart'].forEach(cat => {
    const groups = data.lists?.[cat as 'bag' | 'cart']?.groups || {};
    Object.values(groups).forEach((items: any) => {
      items.forEach((it: any) => candidates.push(it.name));
    });
  });

  const uniqueCandidates = Array.from(new Set(candidates));
  return uniqueCandidates
    .filter(c => isSimilar(q, c, 3))
    .slice(0, limit);
}

/**
 * Intelligently filters/excludes extracted items based on user natural language instructions
 * e.g. "เพิ่มเฉพาะหมวด IV set", "ไม่เอารายการ Terramycin และ Betadine", "เอาเฉพาะเบอร์ 18 ถึง 24"
 */
export function applyUserFiltering(items: any[], filterPrompt: string): any[] {
  if (!filterPrompt || !filterPrompt.trim() || !Array.isArray(items)) return items;
  const promptLower = filterPrompt.toLowerCase();

  return items.filter((item) => {
    const itemName = (item.name || '').toLowerCase();
    const itemCat = (item.category || item.groupName || '').toLowerCase();
    const subItems = Array.isArray(item.subItems) ? item.subItems.map((s: any) => String(s).toLowerCase()) : [];

    // 1. Exclusion checks ("ไม่เอา", "ตัด", "ยกเว้น", "ไม่รวม", "ห้าม", "delete", "exclude")
    // e.g. "ไม่เอารายการ Terramycin และ Betadine"
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

    // 2. Specific Category inclusion ("เพิ่มเฉพาะ", "เอาเฉพาะ", "เลือกเฉพาะ", "หมวด...")
    // e.g. "เพิ่มเฉพาะหมวด IV set" or "เฉพาะหมวด airway"
    const catMatch = promptLower.match(/(?:เฉพาะหมวด|เฉพาะกลุ่ม|หมวด|กลุ่ม)\s*([^\n,]+)/i);
    if (catMatch) {
      const catKeywords = catMatch[1]
        .split(/(?:และ|กับ|หรือ|,|\s+)/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 1 && !['หมวด', 'กลุ่ม', 'ของ', 'และ', 'กับ'].includes(w));
      if (catKeywords.length > 0) {
        const matchesCategory = catKeywords.some((kw) => itemCat.includes(kw) || itemName.includes(kw));
        if (!matchesCategory) return false;
      }
    }

    // 3. Number/Size Range ("เอาเฉพาะเบอร์ 18 ถึง 24")
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
}

/**
 * Extracts items from an equipment table image using Gemini Vision endpoint
 * Supports passing user filter prompt to both server and client side filtering
 */
export async function extractItemsFromImage(file: File, userPrompt?: string): Promise<VisionExtractionResult> {
  const formData = new FormData();
  formData.append('image', file);
  if (userPrompt && userPrompt.trim()) {
    formData.append('prompt', userPrompt.trim());
    formData.append('filterInstructions', userPrompt.trim());
  }

  const response = await fetch('/api/ai/vision', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data: VisionExtractionResult = await response.json();
  if (data.success && data.items && userPrompt) {
    data.items = applyUserFiltering(data.items, userPrompt);
  }
  return data;
}

/**
 * Directly dispatches extracted items to a channel database in localStorage and state
 */
export function addBatchItemsToChannel(
  channelId: string,
  newItems: any[],
  targetType: 'bag' | 'cart' = 'bag'
): ChannelData {
  const activeId = channelId || 'channel_master';
  const key = getChannelDbKey(activeId);

  const currentChannelData = getStored<ChannelData | null>(key, null) || {
    lists: {
      bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
      cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
    },
    globalChecks: {},
    emergencyWeekDates: {},
  };

  const currentList = currentChannelData.lists?.[targetType] || {
    title: targetType === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน',
    sheet: targetType === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency',
    groups: {},
  };

  const updatedGroups: Record<string, EquipmentItem[]> = { ...(currentList.groups || {}) };
  const defaultGroupName = 'อุปกรณ์และเวชภัณฑ์ฉุกเฉิน';

  newItems.forEach((item, index) => {
    const groupName = item.groupName || item.category || item.group || defaultGroupName;
    if (!updatedGroups[groupName]) {
      updatedGroups[groupName] = [];
    }

    const formattedItem: EquipmentItem = {
      id: item.id || `${targetType}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name || `รายการที่ ${index + 1}`,
      qty: String(item.unitText || item.qty || '1'),
      unitText: String(item.unitText || item.qty || '1'),
      groupName,
      location: item.location || groupName,
      category: groupName,
      exp: item.exp || item.expDate || '-',
      code: item.code || `OCR-${Math.floor(1000 + Math.random() * 9000)}`,
      spec: item.spec || 'มาตรฐานทางการแพทย์',
      subItems: Array.isArray(item.subItems) && item.subItems.length > 0 ? item.subItems : undefined,
      subItemQuantities: Array.isArray(item.subItemQuantities) && item.subItemQuantities.length > 0
        ? item.subItemQuantities
        : (Array.isArray(item.subItems) && item.subItems.length > 0 ? item.subItems.map(() => 1) : undefined),
      checkType: Array.isArray(item.subItems) && item.subItems.length > 1 ? 'sub_items' : 'single',
    };

    updatedGroups[groupName].push(formattedItem);
  });

  const updatedLists = {
    ...currentChannelData.lists,
    [targetType]: {
      ...currentList,
      groups: updatedGroups,
    },
  };

  const nextChannelData: ChannelData = {
    ...currentChannelData,
    lists: updatedLists,
  };

  // Synchronously persist
  setStored(key, nextChannelData);
  setStored(getChannelListsKey(activeId), updatedLists);
  if (activeId === 'channel_master') {
    setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
  }

  // Dispatch real-time events for instant reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: activeId, data: nextChannelData } }));
    window.dispatchEvent(new CustomEvent('items_updated', { detail: { type: targetType, count: newItems.length } }));
    window.dispatchEvent(new Event('storage'));
  }

  return nextChannelData;
}

/**
 * Clears all items in a category ('bag' | 'cart') for the specified channel
 */
export function clearChannelCategory(
  channelId: string,
  targetType: 'bag' | 'cart'
): { nextChannelData: ChannelData; clearedCount: number } {
  const activeId = channelId || 'channel_master';
  const key = getChannelDbKey(activeId);

  const currentChannelData = getStored<ChannelData | null>(key, null) || {
    lists: {
      bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
      cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
    },
    globalChecks: {},
    emergencyWeekDates: {},
  };

  const currentList = currentChannelData.lists?.[targetType] || {
    title: targetType === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน',
    sheet: targetType === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency',
    groups: {},
  };

  let clearedCount = 0;
  if (currentList.groups) {
    Object.values(currentList.groups).forEach((items: any) => {
      if (Array.isArray(items)) clearedCount += items.length;
    });
  }

  const updatedLists = {
    ...currentChannelData.lists,
    [targetType]: {
      ...currentList,
      groups: {}, // Empty groups
    },
  };

  const nextChannelData: ChannelData = {
    ...currentChannelData,
    lists: updatedLists,
  };

  // Synchronously persist
  setStored(key, nextChannelData);
  setStored(getChannelListsKey(activeId), updatedLists);
  if (activeId === 'channel_master') {
    setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
  }

  // Dispatch real-time events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('channel_data_updated', { detail: { channelId: activeId, data: nextChannelData } }));
    window.dispatchEvent(new CustomEvent('items_updated', { detail: { type: targetType, count: 0 } }));
    window.dispatchEvent(new Event('storage'));
  }

  return { nextChannelData, clearedCount };
}


/**
 * Triggers instant re-render of inspection and checklist UI
 */
export function reRenderData(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('channel_data_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}

/**
 * Normalizes input text by mapping Thai synonyms and trimming common filler words
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  let str = text.toLowerCase().trim();

  // Remove common polite/filler prefixes and suffixes
  str = str.replace(/(?:น้องออร่า|ออร่า|ช่วย|หน่อย|ที|นะ|ครับ|ค่ะ|ด้วย|ให้หน่อย|ให้ที|ให้ด้วย)+/gi, ' ').trim();

  // Normalize spaces
  return str.replace(/\s+/g, ' ');
}

/**
 * Resolves target category ('bag' | 'cart' | 'both') with negative context handling
 * e.g. "แอดในรถไม่ใช่ในเป๋า" -> 'cart'
 * e.g. "ไม่เอาเป๋า จะเอาลงรถ" -> 'cart'
 * e.g. "เช็กทั้งกระเป๋าทั้งรถ" -> 'both'
 */
export function resolveTargetCategory(text: string): 'bag' | 'cart' | 'both' {
  const norm = normalizeText(text);

  const bagPatterns = /(?:กระเป๋า|เป๋า|ในเป๋า|bag|แบ็ก|แบก)/gi;
  const cartPatterns = /(?:รถฉุกเฉิน|ตู้รถ|บนรถ|ในรถ|รถ|cart|คาร์ท|คาร์ต|ตู้)/gi;

  const negBagPattern = /(?:ไม่|ไม่ใช่|ไม่เอา|ไม่ใช่ใน)\s*(?:กระเป๋า|เป๋า|ในเป๋า|bag|แบ็ก|แบก)/gi;
  const negCartPattern = /(?:ไม่|ไม่ใช่|ไม่เอา|ไม่ใช่ใน)\s*(?:รถฉุกเฉิน|ตู้รถ|บนรถ|ในรถ|รถ|cart|คาร์ท|คาร์ต|ตู้)/gi;

  const hasNegBag = negBagPattern.test(norm);
  const hasNegCart = negCartPattern.test(norm);

  let posText = norm
    .replace(/(?:ไม่|ไม่ใช่|ไม่เอา|ไม่ใช่ใน)\s*(?:กระเป๋า|เป๋า|ในเป๋า|bag|แบ็ก|แบก)/gi, '')
    .replace(/(?:ไม่|ไม่ใช่|ไม่เอา|ไม่ใช่ใน)\s*(?:รถฉุกเฉิน|ตู้รถ|บนรถ|ในรถ|รถ|cart|คาร์ท|คาร์ต|ตู้)/gi, '');

  const hasPosBag = bagPatterns.test(posText);
  const hasPosCart = cartPatterns.test(posText);

  if (hasPosBag && hasPosCart && !hasNegBag && !hasNegCart) {
    return 'both';
  }

  if (hasPosCart || hasNegBag) {
    return 'cart';
  }

  if (hasPosBag || hasNegCart) {
    return 'bag';
  }

  return 'both';
}

export interface AutoCheckIntentResult {
  isAutoCheck: boolean;
  categories: ('bag' | 'cart')[];
  weeks: number[];
  isFullMonth: boolean;
  isSingleWeek: boolean;
  targetWeek?: number;
}

/**
 * Natural Language Intent Parser for Auto-Check commands (Specific Week vs Full Month)
 */
export function parseAutoCheckIntent(queryStr: string, currentWeekNum: number = 1, availableWeeks: number[] = [1, 2, 3, 4]): AutoCheckIntentResult {
  const q = normalizeText(queryStr);

  const isAutoCheck =
    q.includes('ตรวจผ่าน') ||
    q.includes('เช็กผ่าน') ||
    q.includes('เช็คผ่าน') ||
    q.includes('auto-check') ||
    q.includes('auto check') ||
    (
      (q.includes('ตรวจ') || q.includes('เช็ก') || q.includes('เช็ค')) &&
      (
        q.includes('ให้หน่อย') ||
        q.includes('ให้ที') ||
        q.includes('ให้หมด') ||
        q.includes('ทั้งหมด') ||
        q.includes('สัปดาห์') ||
        q.includes('อาทิตย์') ||
        q.includes('เดือนนี้') ||
        q.includes('ปกติทุกรายการ') ||
        q.includes('ผ่านทั้งหมด')
      ) &&
      !q.includes('เปิดหน้า') &&
      !q.includes('ไปที่') &&
      !q.includes('ไปหน้า') &&
      !q.includes('เพิ่ม') &&
      !q.includes('แอด') &&
      !q.includes('ลบ') &&
      !q.includes('เอาออก')
    );

  if (!isAutoCheck) {
    return {
      isAutoCheck: false,
      categories: ['bag', 'cart'],
      weeks: [],
      isFullMonth: false,
      isSingleWeek: false,
    };
  }

  // 1. Determine categories with negative context handling
  const targetCategory = resolveTargetCategory(queryStr);
  let categories: ('bag' | 'cart')[] = [];
  if (targetCategory === 'both') {
    categories = ['bag', 'cart'];
  } else {
    categories = [targetCategory];
  }

  // 2. Determine target weeks (Full month vs Single Week)
  const isFullMonth =
    q.includes('เหมาเดือน') ||
    q.includes('ทั้งเดือน') ||
    q.includes('ทุกสัปดาห์') ||
    q.includes('ทุกอาทิตย์') ||
    q.includes('ทุก week') ||
    q.includes('ทุกวีค') ||
    q.includes('ทั้งหมดของเดือน') ||
    q.includes('ครบทุกสัปดาห์') ||
    (q.includes('เดือนนี้') && !/(?:w|สัปดาห์ที่|สัปดาห์|week|อาทิตย์ที่|ที่)\s*[1-5]/i.test(q));

  if (isFullMonth) {
    return {
      isAutoCheck: true,
      categories,
      weeks: [...availableWeeks],
      isFullMonth: true,
      isSingleWeek: false,
    };
  }

  // Specific week matching
  const weekMatches: number[] = [];
  const weekRegex = /(?:สัปดาห์ที่|สัปดาห์|week|อาทิตย์ที่|ที่|w)\s*([1-5])/gi;
  let m;
  while ((m = weekRegex.exec(q)) !== null) {
    const wNum = parseInt(m[1], 10);
    if (wNum >= 1 && wNum <= 5 && !weekMatches.includes(wNum)) {
      weekMatches.push(wNum);
    }
  }

  if (weekMatches.length === 0) {
    [1, 2, 3, 4, 5].forEach((w) => {
      if (q.includes(`w${w}`) || q.includes(`ที่ ${w}`) || q.includes(`ที่${w}`)) {
        if (!weekMatches.includes(w)) weekMatches.push(w);
      }
    });
  }

  if (weekMatches.length > 0) {
    weekMatches.sort((a, b) => a - b);
    return {
      isAutoCheck: true,
      categories,
      weeks: weekMatches,
      isFullMonth: false,
      isSingleWeek: weekMatches.length === 1,
      targetWeek: weekMatches[0],
    };
  }

  if (q.includes('สัปดาห์นี้') || q.includes('อาทิตย์นี้') || q.includes('week นี้') || q.includes('วีคนี้')) {
    const safeWk = Math.min(currentWeekNum, availableWeeks.length);
    return {
      isAutoCheck: true,
      categories,
      weeks: [safeWk],
      isFullMonth: false,
      isSingleWeek: true,
      targetWeek: safeWk,
    };
  }

  const safeWk = Math.min(currentWeekNum, availableWeeks.length);
  return {
    isAutoCheck: true,
    categories,
    weeks: [safeWk],
    isFullMonth: false,
    isSingleWeek: true,
    targetWeek: safeWk,
  };
}



export type AuraIntent =
  | 'QUERY_MEDIA'
  | 'LOCATION_QUERY'
  | 'AUDIT_ZONE'
  | 'CHECK_STOCK_EXPIRY'
  | 'NAVIGATE'
  | 'ADD'
  | 'DELETE'
  | 'CLEAR'
  | 'TRANSFER'
  | 'CHANNEL_OPS'
  | 'AUTO_CHECK'
  | 'CHAT';

export interface DetectedIntent {
  intent: AuraIntent;
  confidence: number;
  entities: {
    item?: string;
    location?: string;
    category?: 'bag' | 'cart' | 'medicine' | 'equipment';
    week?: number[];
    isFullMonth?: boolean;
    action?: string;
  };
}

/**
 * Advanced Intent & Semantic Understanding Engine (NLP)
 */
export function detectAuraIntent(query: string): DetectedIntent {
  const q = normalizeText(query);
  const entities: DetectedIntent['entities'] = {};

  // 1. QUERY_MEDIA: Patterns for images, visual appearance
  const mediaPatterns = [
    'ขอดูรูป', 'ขอรูป', 'หน้าตาแบบไหน', 'รูปถ่าย', 'โชว์รูป', 'ขอดูไอเทม', 'ขอดูของ', 'ภาพถ่าย', 'หน้าตาเป็นไง'
  ];
  if (mediaPatterns.some(p => q.includes(p))) {
    const pattern = mediaPatterns.find(p => q.includes(p)) || '';
    entities.item = q.replace(pattern, '').replace(/(ออร่า|น้องออร่า|ให้หน่อย|ที|นะ|ครับ|ค่ะ|ขอดู)/gi, '').trim();
    return { intent: 'QUERY_MEDIA', confidence: 0.9, entities };
  }

  // 1.5 LOCATION_QUERY: Ask for where something is or warehouse code
  const locPatterns = [
    'อยู่ตรงไหน', 'รหัสคลัง', 'รหัสอะไร', 'วางไว้ไหน', 'จอดที่ไหน', 'เก็บไว้ไหน', 'พิกัด', 'อยู่ตู้ไหน', 'อยู่ชั้นไหน'
  ];
  if (locPatterns.some(p => q.includes(p))) {
    const pattern = locPatterns.find(p => q.includes(p)) || '';
    entities.item = q.replace(pattern, '').replace(/(ออร่า|น้องออร่า|ให้หน่อย|ที|นะ|ครับ|ค่ะ|เช็ก)/gi, '').trim();
    return { intent: 'LOCATION_QUERY', confidence: 0.9, entities };
  }

  // 2. AUDIT_ZONE: Scan for anomalies/defects in specific zones
  const auditPatterns = [
    'มีห้องไหนผิดปกติ', 'เช็กพวกรถ', 'มีไรต้องแก้ไหม', 'เช็กกระเป๋าเดือนนี้',
    'ตรวจความผิดปกติ', 'ตรวจวอร์ด', 'ห้องไหนพัง', 'มีอะไรเสียไหม', 'เช็คความเรียบร้อย'
  ];
  if (auditPatterns.some(p => q.includes(p))) {
    if (q.includes('รถ')) entities.location = 'cart';
    else if (q.includes('กระเป๋า') || q.includes('เป๋า')) entities.location = 'bag';
    else if (q.includes('ห้อง') || q.includes('or')) entities.location = 'equipment';
    else entities.location = 'all';

    return { intent: 'AUDIT_ZONE', confidence: 0.85, entities };
  }

  // 3. CHECK_STOCK_EXPIRY: Check stock levels or expiry
  const stockPatterns = [
    'ใกล้หมดอายุ', 'เหลือเท่าไหร่', 'ของขาดไหม', 'เช็กของ', 'สต็อก', 'คงเหลือ', 'exp', 'วันหมดอายุ'
  ];
  if (stockPatterns.some(p => q.includes(p))) {
    entities.item = q.replace(new RegExp(`(${stockPatterns.join('|')}|ออร่า|น้องออร่า|ให้หน่อย|ที|นะ|ครับ|ค่ะ|เช็ก|ตรวจสอบ)`, 'gi'), '').trim();
    return { intent: 'CHECK_STOCK_EXPIRY', confidence: 0.8, entities };
  }

  // 4. CHANNEL_OPS: Ward/Channel management
  if (q.includes('channel') || q.includes('แชนแนล') || q.includes('วอร์ด')) {
    return { intent: 'CHANNEL_OPS', confidence: 0.95, entities };
  }

  // 5. AUTO_CHECK: Bulk updates
  if (q.includes('ตรวจผ่าน') || q.includes('เช็กผ่าน') || q.includes('auto-check')) {
    return { intent: 'AUTO_CHECK', confidence: 0.9, entities };
  }

  // 6. CLEAR / RESET
  if ((q.includes('ลบ') || q.includes('เคลียร์')) && (q.includes('ทั้งหมด') || q.includes('ตาราง'))) {
    return { intent: 'CLEAR', confidence: 0.9, entities };
  }

  // 7. TRANSFER: Move items
  if (q.includes('ย้าย') || q.includes('สลับ') || q.includes('transfer')) {
    return { intent: 'TRANSFER', confidence: 0.85, entities };
  }

  // 8. NAVIGATION
  if (q.includes('เปิดหน้า') || q.includes('ไปที่') || q.includes('ไปหน้า') || q.includes('กลับหน้า')) {
    return { intent: 'NAVIGATE', confidence: 0.9, entities };
  }

  // 9. ADD / DELETE (Simple)
  if (q.includes('เพิ่ม') || q.includes('add') || q.includes('บันทึก')) return { intent: 'ADD', confidence: 0.8, entities };
  if (q.includes('ลบ') || q.includes('delete') || q.includes('เอาออก')) return { intent: 'DELETE', confidence: 0.8, entities };

  return { intent: 'CHAT', confidence: 0.5, entities };
}

/**
 * Core Intelligence Pillar 2: Deep Inventory Query & Visual Return
 */
export function queryItemDetails(
  itemQuery: string, 
  data: ChannelData, 
  drugs: DrugItem[], 
  equipment: Record<string, EquipmentItem[]> = {},
  currentContext?: string
): { 
  found: boolean; 
  item?: any; 
  image?: string; 
  location?: string;
  code?: string;
  stock?: string;
  suggestions?: string[];
  categoryType?: string;
} {
  const q = normalizeText(itemQuery);
  if (q.length < 2) return { found: false };

  // 0. Build Global Index with Context Bias
  // Bias order: Current View -> Drugs -> Bag -> Cart -> Equipment
  const searchOrder: Array<{
    type: string;
    items: any[];
    searchFn: (it: any) => boolean;
    formatFn: (it: any) => any;
  }> = [
    {
      type: 'ยา/สารน้ำ',
      items: drugs,
      searchFn: (d) => normalizeText(d.name).includes(q) || isSimilar(q, d.name) || (d.barcode && String(d.barcode).includes(q)),
      formatFn: (d) => ({
        found: true,
        item: d,
        image: categoryCovers.drugs,
        location: 'คลังยา OR',
        code: d.barcode || 'N/A',
        stock: `${d.remaining || 0} ${d.unit || 'Unit'}`,
        categoryType: 'ยา/สารน้ำ'
      })
    },
    {
      type: 'กระเป๋าฉุกเฉิน',
      items: Object.entries(data.lists?.bag?.groups || {}).flatMap(([g, its]) => its.map(it => ({ ...it, groupName: g }))),
      searchFn: (it) => normalizeText(it.name).includes(q) || isSimilar(q, it.name) || (it.code && normalizeText(it.code).includes(q)),
      formatFn: (it) => ({
        found: true,
        item: it,
        image: categoryCovers.bag,
        location: `กระเป๋าฉุกเฉิน (${it.groupName})`,
        code: it.code || 'N/A',
        stock: it.qty || '1',
        categoryType: 'กระเป๋าฉุกเฉิน'
      })
    },
    {
      type: 'รถฉุกเฉิน',
      items: Object.entries(data.lists?.cart?.groups || {}).flatMap(([g, its]) => its.map(it => ({ ...it, groupName: g }))),
      searchFn: (it) => normalizeText(it.name).includes(q) || isSimilar(q, it.name) || (it.code && normalizeText(it.code).includes(q)),
      formatFn: (it) => ({
        found: true,
        item: it,
        image: categoryCovers.cart,
        location: `รถฉุกเฉิน (${it.groupName})`,
        code: it.code || 'N/A',
        stock: it.qty || '1',
        categoryType: 'รถฉุกเฉิน'
      })
    },
    {
      type: 'ครุภัณฑ์ห้องผ่าตัด',
      items: Object.entries(equipment).flatMap(([room, its]) => its.map(it => ({ ...it, roomId: room }))),
      searchFn: (it) => normalizeText(it.name).includes(q) || isSimilar(q, it.name) || (it.code && normalizeText(it.code).includes(q)),
      formatFn: (it) => ({
        found: true,
        item: it,
        image: categoryCovers.equipment,
        location: `ห้องผ่าตัด ${it.roomId.toUpperCase()}`,
        code: it.code || 'N/A',
        stock: it.qty || '1',
        categoryType: 'ครุภัณฑ์ห้องผ่าตัด'
      })
    }
  ];

  // Apply context bias: Move current context to front of search order
  if (currentContext) {
    const contextMap: Record<string, string> = {
      'drug_check': 'ยา/สารน้ำ',
      'room_check': 'ครุภัณฑ์ห้องผ่าตัด',
      'bag_check': 'กระเป๋าฉุกเฉิน',
      'cart_check': 'รถฉุกเฉิน'
    };
    const targetType = contextMap[currentContext];
    if (targetType) {
      const idx = searchOrder.findIndex(s => s.type === targetType);
      if (idx > -1) {
        const [target] = searchOrder.splice(idx, 1);
        searchOrder.unshift(target);
      }
    }
  }

  // Execute Search
  for (const provider of searchOrder) {
    const match = provider.items.find(provider.searchFn);
    if (match) return provider.formatFn(match);
  }

  // 3. Not found, return suggestions from entire system
  const suggestions = findClosestMatches(itemQuery, data, drugs);
  return { found: false, suggestions };
}

/**
 * Core Intelligence Pillar 3: Proactive Anomaly Auditor
 */
export function scanAnomalies(data: ChannelData, drugs: DrugItem[], locationFilter: string = 'all'): string[] {
  const anomalies: string[] = [];
  const checks = data.globalChecks || {};

  // 1. Scan Equipment/Rooms
  if (locationFilter === 'all' || locationFilter === 'equipment') {
    Object.entries(checks).forEach(([roomId, roomChecks]) => {
      if (['bag', 'cart', 'drugs'].includes(roomId)) return;
      Object.entries(roomChecks || {}).forEach(([itemKey, val]) => {
        if (val && val.result === 'ผิดปกติ') {
          const itemName = itemKey.split('|')[1] || itemKey;
          anomalies.push(`📍 **OR ${roomId.toUpperCase()}**: ${itemName} (${val.note || 'พบข้อบกพร่อง'})`);
        }
      });
    });
  }

  // 2. Scan Bag/Cart
  if (locationFilter === 'all' || locationFilter === 'bag' || locationFilter === 'cart') {
    ['bag', 'cart'].forEach(cat => {
      if (locationFilter !== 'all' && locationFilter !== cat) return;
      const catChecks = checks[cat] || {};
      Object.entries(catChecks).forEach(([itemKey, val]) => {
        if (val && val.result === 'ผิดปกติ') {
          const itemName = itemKey.split('|')[1] || itemKey;
          anomalies.push(`📍 **${cat === 'bag' ? 'กระเป๋า' : 'รถ'}ฉุกเฉิน**: ${itemName} (${val.note || 'พบข้อบกพร่อง'})`);
        }
      });
    });
  }

  // 3. Scan Low Stock
  if (locationFilter === 'all' || locationFilter === 'medicine') {
    drugs.forEach(d => {
      if (d.remaining <= 2) {
        anomalies.push(`⚠️ **คลังยา**: ${d.name} ใกล้หมดสต็อก (คงเหลือ ${d.remaining} ${d.unit || 'Amp'})`);
      }
    });
  }

  return anomalies;
}
