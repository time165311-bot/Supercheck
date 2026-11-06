import { getChannelDbKey, getChannelListsKey, getStored, setStored, STORAGE_KEYS } from './storage';
import { ChannelData } from '../context/DataContext';
import { EquipmentItem } from '../types';

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
 * Triggers instant re-render of inspection and checklist UI
 */
export function reRenderData(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('channel_data_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}
