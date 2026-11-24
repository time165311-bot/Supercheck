import {
  Sparkles,
  BriefcaseMedical,
  Truck,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  MoreVertical,
  Maximize2,
  X,
  Plus,
  Calendar,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PaperAuditModal } from './PaperAuditModal';
import { CheckItemState, ListConfig, EquipmentItem } from '../types';
import { formatAcquiredDate } from './OfficialReportModal';
import { EditItemModal } from './EditItemModal';
import { getWednesdaysInfoForMonth } from '../utils/wednesdayUtils';
import { compressImageForFirestore } from '../utils/helpers';

import {
  getItemSizes,
  parseSubExps,
  getItemSubItemsInfo,
  extractQuantityNumbers,
  getItemQuantityClassification,
  getRealTargetCheckValue,
  sanitizeItemName,
  sortItemsNaturally,
  matchMedicalItemName,
} from '../utils/itemUtils';
export type { SubExpItemInfo as SubExpItem } from '../utils/itemUtils';
export { getItemSizes, parseSubExps, getRealTargetCheckValue, sanitizeItemName, sortItemsNaturally, matchMedicalItemName };

export function getDeviceTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseSubItemStatuses(weekVal: string | undefined, subQuantities: number[]): string[] {
  const subCount = subQuantities.length;
  if (subCount <= 1) {
    const target = String(subQuantities[0] || 1);
    return [weekVal === target || weekVal === '✓' ? target : weekVal === '0' || weekVal === '✗' ? '0' : ''];
  }
  if (!weekVal || weekVal === '-') {
    return Array(subCount).fill('');
  }
  if (weekVal === '1' || weekVal === '✓') {
    // If it's a bulk "1" or "✓", expand it using the actual target quantities!
    return subQuantities.map(q => String(q));
  }
  if (weekVal === '0' || weekVal === '✗') {
    return Array(subCount).fill('0');
  }
  if (weekVal.includes(',')) {
    const parts = weekVal.split(',').map((p) => p.trim());
    return Array.from({ length: subCount }, (_, i) => {
      if (parts[i] !== undefined && parts[i] !== '') return parts[i];
      // If a part is missing in a comma list, default to its target qty if the overall check is positive?
      // Actually, just return what's there or empty.
      return '';
    });
  }
  // Single value for multiple items? Treat as if all are that value or all are '1'
  return Array(subCount).fill(weekVal);
}

export interface EmergencyChecklistProps {
  type: 'bag' | 'cart' | 'ambulance' | string;
  title: string;
  subtitle: string;
  listConfig: ListConfig;
  checks: Record<string, CheckItemState>;
  onToggleCheck: (itemKey: string, result: 'ปกติ' | 'ผิดปกติ' | '', itemName: string, week?: number, isMassAction?: boolean, customValue?: string) => void;
  onUpdateNote: (itemKey: string, note: string) => void;
  onOpenBarcodeScan?: () => void;
  onZoomImage?: (imgUrl: string) => void;
  onBack: () => void;
  onAddItem?: (newItem: {
    name: string;
    groupName: string;
    spec?: string;
    qty?: string;
    exp?: string;
    img?: string;
    checkType?: 'single' | 'sub_items';
    subItems?: string[];
    subExps?: Array<{ label?: string; exp?: string; qty?: number; hasNoExp?: boolean }>;
    subItemQuantities?: number[];
  }) => void;
  onDeleteItem?: (type: 'bag' | 'cart' | 'ambulance' | string, itemKey: string) => void;
  onEditItem?: (item: EquipmentItem) => void;
  weekDates: Record<number, string>;
  onWeekDatesChange: (dates: Record<number, string>) => void;
  onSaveByWeek?: (week: number, weekDates: Record<number, string>) => Promise<void> | void;
  onClearWeekChecks?: (week: number) => void;
  isSavingReport?: boolean;
  onClearAll?: (type: 'bag' | 'cart' | 'ambulance' | string) => void;
  isVisible?: boolean;
}

export const EmergencyChecklistView: React.FC<EmergencyChecklistProps> = ({
  type,
  title,
  subtitle,
  listConfig,
  checks,
  onToggleCheck,
  onUpdateNote,
  onOpenBarcodeScan,
  onZoomImage,
  onBack: _onBack,
  onAddItem,
  onDeleteItem,
  onEditItem,
  weekDates,
  onWeekDatesChange,
  onSaveByWeek,
  onClearWeekChecks,
  isSavingReport = false,
  onClearAll,
  isVisible = true,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaperAuditOpen, setIsPaperAuditOpen] = useState<boolean>(false);
  const [expandedMultiItems, setExpandedMultiItems] = useState<Record<string, boolean>>({});
  const [pendingBulkAction, setPendingBulkAction] = useState<null | 'clear_all' | 'clear_checks' | 'pass_5_weeks'>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const isSavingLocalRef = useRef<boolean>(false);

  // 1. Dynamic Wednesdays Per Current Month (4 or 5 Wednesdays)
  const wedInfo = useMemo(() => {
    return getWednesdaysInfoForMonth(new Date());
  }, []);

  const totalWeeksInMonth = wedInfo.totalWednesdays;
  const availableWeeks = wedInfo.weeks;

  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Ensure selectedWeek is within availableWeeks
  useEffect(() => {
    if (selectedWeek > totalWeeksInMonth) {
      setSelectedWeek(totalWeeksInMonth);
    }
  }, [totalWeeksInMonth, selectedWeek]);

  // 🌟 Auto Current Date Detection 100%: Set default to device's today date if not specified
  useEffect(() => {
    const todayStr = getDeviceTodayDateStr();
    let updated = false;
    const newDates = { ...weekDates };

    // 1. Ensure current selected week always has today's date if empty
    if (!newDates[selectedWeek] || !newDates[selectedWeek].trim()) {
      newDates[selectedWeek] = todayStr;
      updated = true;
    }

    // 2. Ensure all available weeks in the current month have a valid date
    availableWeeks.forEach((wk) => {
      if (!newDates[wk] || !newDates[wk].trim()) {
        newDates[wk] = todayStr;
        updated = true;
      }
    });

    if (updated) {
      onWeekDatesChange(newDates);
    }
  }, [selectedWeek, availableWeeks, weekDates, onWeekDatesChange]);

  const handleDateChange = (wk: number, dateVal: string) => {
    onWeekDatesChange({ ...weekDates, [wk]: dateVal });
  };

  const handleSaveAndPreview = async () => {
    if (!onSaveByWeek || isSavingReport || isSavingLocalRef.current) return;
    isSavingLocalRef.current = true;
    try {
      await onSaveByWeek(selectedWeek, weekDates);
    } finally {
      setTimeout(() => {
        isSavingLocalRef.current = false;
      }, 600);
    }
  };

  // Add Item Modal State
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemGroup, setNewItemGroup] = useState<string>('');
  const [customGroup, setCustomGroup] = useState<string>('');
  const [newItemSpec, setNewItemSpec] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemNoExp, setNewItemNoExp] = useState<boolean>(false);
  const [newItemExp, setNewItemExp] = useState<string>('');
  const [newItemExpParts, setNewItemExpParts] = useState<Record<string, string>>({});
  const [newItemImgUrl, setNewItemImgUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Item Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [itemToEdit, setItemToEdit] = useState<EquipmentItem | null>(null);

  const handleOpenEditModal = (item: EquipmentItem) => {
    setItemToEdit(item);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (updatedItem: EquipmentItem) => {
    if (onEditItem) {
      onEditItem(updatedItem);
    }
    setIsEditModalOpen(false);
    setItemToEdit(null);
  };

  const handleAddNewItemFromModal = (newItem: EquipmentItem) => {
    if (onAddItem) {
      onAddItem({
        name: newItem.name,
        groupName: newItem.location || newItem.category || (groups[0] || 'ทั่วไป'),
        spec: newItem.spec,
        qty: newItem.qty,
        exp: newItem.exp,
        img: newItem.img,
        checkType: newItem.checkType,
        subItems: newItem.subItems,
        subItemQuantities: newItem.subItemQuantities,
        subExps: newItem.subExps,
      });
    }
    setIsAddItemModalOpen(false);
  };

  const handleDeleteItemInEdit = (itemId: string) => {
    if (onDeleteItem) {
      onDeleteItem(type, itemId);
    }
    setIsEditModalOpen(false);
    setItemToEdit(null);
  };

  const groups = useMemo(() => {
    if (!listConfig || !listConfig.groups) return [];
    return Object.keys(listConfig.groups);
  }, [listConfig]);

  // Auto-reset group filter to 'all' if selected group no longer exists or items were freshly batch-added
  useEffect(() => {
    if (selectedGroup !== 'all' && !groups.includes(selectedGroup)) {
      setSelectedGroup('all');
    }
  }, [groups, selectedGroup]);

  // Flattened items list
  const allItems = useMemo(() => {
    const itemsList: Array<{
      itemKey: string;
      id: string;
      name: string;
      no?: string;
      code?: string;
      spec?: string;
      qty?: string;
      location?: string;
      exp?: string;
      img?: string;
      groupName: string;
      checkType?: 'single' | 'sub_items';
      subItems?: string[];
      subItemQuantities?: number[];
      subExps?: Array<{ label?: string; exp?: string; qty?: number; hasNoExp?: boolean }>;
      unitText?: string;
    }> = [];

    if (!listConfig || !listConfig.groups) return itemsList;

    Object.entries(listConfig.groups).forEach(([groupName, groupItems]) => {
      groupItems.forEach((item, idx) => {
        const itemKey = item.id || `${type}_${groupName}_${idx}`;
        itemsList.push({
          itemKey,
          id: item.id || itemKey,
          name: item.name,
          no: item.no,
          code: item.code,
          spec: item.spec,
          qty: item.qty,
          location: item.location || groupName,
          exp: item.exp,
          img: item.img,
          unitText: item.unitText,
          groupName,
          checkType: item.checkType,
          subItems: item.subItems,
          subItemQuantities: item.subItemQuantities,
          subExps: item.subExps,
        });
      });
    });
    
    // Group and Sort Naturally
    const finalItems: typeof itemsList = [];
    const groupedByLocation: Record<string, typeof itemsList> = {};
    
    itemsList.forEach(item => {
      if (!groupedByLocation[item.groupName]) {
        groupedByLocation[item.groupName] = [];
      }
      groupedByLocation[item.groupName].push(item);
    });
    
    // Sort each group and flatten
    Object.keys(groupedByLocation).forEach(groupName => {
      const sortedGroup = sortItemsNaturally(groupedByLocation[groupName]);
      finalItems.push(...sortedGroup);
    });

    return finalItems;
  }, [listConfig, type]);

  // Filtered Items based on group filter and search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesGroup = selectedGroup === 'all' || item.groupName === selectedGroup;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.spec && item.spec.toLowerCase().includes(q)) ||
        item.groupName.toLowerCase().includes(q);

      return matchesGroup && matchesSearch;
    });
  }, [allItems, selectedGroup, searchQuery]);

  // Per-week status helper: uses weekVals[selectedWeek] so clearing W1 resets W1 stats/cards to 0 immediately
  const getItemWeekStatus = (item: (typeof allItems)[number]): 'normal' | 'defective' | '' => {
    const c = checks[item.itemKey];
    const weekVal = c?.weekVals?.[selectedWeek];
    const hasWeekVal = weekVal !== undefined && String(weekVal).trim() !== '';

    if (!hasWeekVal) {
      return '';
    }

    const classification = getItemQuantityClassification(item);
    const valStr = String(weekVal).trim();

    if (classification.isType2) {
      const subStatuses = parseSubItemStatuses(valStr, classification.subQuantities);
      const isSubAllOk = subStatuses.every((s, i) => s === String(classification.subQuantities[i] || 1));
      const isSubAnyBad = subStatuses.some((s, i) => s === '0' || s === '✗' || (s !== '' && s !== String(classification.subQuantities[i] || 1)));
      if (isSubAnyBad) return 'defective';
      if (isSubAllOk) return 'normal';
      return '';
    }

    if (classification.isType1) {
      const parsed = valStr.includes(',')
        ? valStr.split(',').map((p) => p.trim()).filter((p) => p === '1' || p === '✓' || parseInt(p, 10) > 0).length
        : parseInt(valStr.replace(/\D/g, ''), 10);
      if (valStr === '0' || valStr === '✗' || (!isNaN(parsed) && parsed < classification.totalQty)) {
        return 'defective';
      }
      if (!isNaN(parsed) && parsed >= classification.totalQty) {
        return 'normal';
      }
      return '';
    }

    // O2 Tank check (< 500 PSI on either tank is defective)
    const lowerName = item.name.toLowerCase();
    if ((lowerName.includes('o2') || lowerName.includes('oxygen') || item.name.includes('ออกซิเจน')) && (lowerName.includes('tank') || item.name.includes('ถัง'))) {
      const nums = valStr.split(',').map((p) => parseInt(p.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
      if (nums.length > 0 && nums.some((n) => n < 500)) return 'defective';
      if (nums.length > 0) return 'normal';
    }

    if (valStr === '0' || valStr === '✗') return 'defective';
    return 'normal';
  };

  // Summary statistics for selectedWeek (readinessPct reflects normal/ready items strictly)
  const totalCount = allItems.length;
  const normalCount = allItems.filter((i) => getItemWeekStatus(i) === 'normal').length;
  const defectiveCount = allItems.filter((i) => getItemWeekStatus(i) === 'defective').length;
  const checkedCount = normalCount + defectiveCount;
  const readinessPct = totalCount > 0 ? Math.round((normalCount / totalCount) * 100) : 0;

  // Toggle Pass All / Cancel Check Logic (strictly checked against selectedWeek status)
  const areAllPassed = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => getItemWeekStatus(item) === 'normal');
  }, [filteredItems, checks, selectedWeek]);

  const handleTogglePassAll = () => {
    if (areAllPassed) {
      // Reset all items in current view/week back to unchecked (0%)
      if (selectedGroup === 'all' && !searchQuery.trim() && onClearWeekChecks) {
        onClearWeekChecks(selectedWeek);
      } else {
        filteredItems.forEach((item) => {
          onToggleCheck(item.itemKey, '', item.name, selectedWeek, true, '');
        });
      }
    } else {
      // Mark all items (including sub-items & countable items) as passed with real target quantities
      filteredItems.forEach((item) => {
        const passVal = getRealTargetCheckValue(item);
        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, passVal);
      });
    }
  };

  // Local File Upload Handler (auto-compressed <= 440k chars for Firestore safety)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setActionNotice('ขนาดไฟล์รูปภาพเกิน 10MB กรุณาเลือกไฟล์ขนาดเล็กกว่านี้');
      setTimeout(() => setActionNotice(null), 3500);
      return;
    }
    try {
      const compressedBase64 = await compressImageForFirestore(file, 1024, 0.72);
      if (compressedBase64) {
        setNewItemImgUrl(compressedBase64);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Str = event.target?.result as string;
        if (base64Str) {
          setNewItemImgUrl(base64Str);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle submit new item
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setActionNotice('กรุณากรอกชื่อรายการอุปกรณ์');
      setTimeout(() => setActionNotice(null), 3500);
      return;
    }

    const finalGroup = newItemGroup === '__custom__' ? customGroup.trim() : newItemGroup || (groups[0] || 'ทั่วไป');
    if (!finalGroup) {
      setActionNotice('กรุณาเลือกหรือกรอกหมวดหมู่/ตำแหน่ง');
      setTimeout(() => setActionNotice(null), 3500);
      return;
    }

    let combinedExp = '';
    if (newItemNoExp) {
      combinedExp = '-';
    } else if (modalSizes.length > 1) {
      combinedExp = modalSizes.filter((s: string) => newItemExpParts[s]).map((s: string) => `${s}:${newItemExpParts[s]}`).join(', ');
    } else {
      combinedExp = newItemExp.trim() || '-';
    }

    if (onAddItem) {
      onAddItem({
        name: newItemName.trim(),
        groupName: finalGroup,
        spec: newItemSpec.trim(),
        qty: newItemQty.trim() || '1',
        exp: combinedExp,
        img: newItemImgUrl.trim(),
      });
    }

    // Reset Form
    setNewItemName('');
    setNewItemSpec('');
    setNewItemQty('1');
    setNewItemNoExp(false);
    setNewItemExp('');
    setNewItemExpParts({});
    setNewItemImgUrl('');
    setIsAddItemModalOpen(false);
  };

  const modalSizes = useMemo(() => {
    return getItemSizes({ name: newItemName, spec: newItemSpec, qty: newItemQty });
  }, [newItemName, newItemSpec, newItemQty]);

  return (
    <div className="space-y-3.5 font-['TH_Sarabun_New','Sarabun',sans-serif] pb-28 animate-in fade-in duration-300 text-slate-800 dark:text-[#E3E3E3] relative">
      {/* Inline Warning / Notice Banner */}
      {actionNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="ml-1 opacity-80 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 🌟 Stable Header Banner (Single Back Button handled by App header) */}
      <div className="w-full z-20 mb-3.5">
        {/* 🌟 Clean One UI Royal Blue Header Banner (Gemini Dark Surface in Dark Mode) */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 dark:from-[#1E1F20] dark:via-[#1A1B1C] dark:to-[#131314] text-white p-3.5 sm:p-4 rounded-[1.8rem] border border-blue-400/30 dark:border-white/10 shadow-md flex justify-between items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 leading-tight">
                {type === 'bag' ? (
                  <BriefcaseMedical size={20} className="text-amber-200 dark:text-amber-300 shrink-0" />
                ) : type === 'ambulance' ? (
                  <Truck size={20} className="text-rose-200 dark:text-rose-400 shrink-0" />
                ) : (
                  <Truck size={20} className="text-cyan-200 dark:text-[#A8C7FA] shrink-0" />
                )}
                <span>{title} (ประจำเดือน {new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })})</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ปุ่ม + เพิ่มรายการ */}
            <button
              type="button"
              onClick={() => {
                setNewItemGroup(groups[0] || 'ทั่วไป');
                setIsAddItemModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
              title="เพิ่มรายการอุปกรณ์ใหม่"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>เพิ่มรายการ</span>
            </button>

            {/* Bulk Clear Inventory Items */}
            <button
              type="button"
              onClick={() => setPendingBulkAction('clear_all')}
              className="px-3 py-2 rounded-xl bg-red-600/20 text-red-100 hover:bg-red-600/30 font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95 border border-red-500/30"
              title="ลบรายการอุปกรณ์ทั้งหมดในหน้านี้"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">ลบทั้งหมด</span>
            </button>

            {/* 2-State Toggle Pass All / Cancel All Button */}
            <button
              type="button"
              onClick={handleTogglePassAll}
              className={`px-3 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap ${
                areAllPassed ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={areAllPassed ? `ยกเลิกการตรวจทั้งหมด (สัปดาห์ที่ ${selectedWeek})` : `กดตรวจผ่านปกติทุกรายการประจำสัปดาห์ที่ ${selectedWeek}`}
            >
              {areAllPassed ? <X size={15} /> : <Check size={15} />}
              <span>{areAllPassed ? `ยกเลิกตรวจ (W${selectedWeek})` : `ตรวจผ่านทั้งหมด (W${selectedWeek})`}</span>
            </button>

            {/* Clear All Checks Button */}
            <button
              type="button"
              onClick={() => setPendingBulkAction('clear_checks')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 font-bold text-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
              title={`ล้างค่าการตรวจเช็กทั้งหมดสำหรับสัปดาห์ที่ ${selectedWeek}`}
            >
              <span>🧹</span>
              <span>ล้างค่า (W{selectedWeek})</span>
            </button>

            {/* Render 5-Week Pass Button ONLY if totalWeeksInMonth === 5 */}
            {totalWeeksInMonth === 5 && (
              <button
                type="button"
                onClick={() => setPendingBulkAction('pass_5_weeks')}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="กดตรวจผ่านปกติทุกรายการ ครบทั้ง 5 สัปดาห์ในครั้งเดียว"
              >
                <CheckCheck size={15} />
                <span>ตรวจผ่าน 5 สัปดาห์</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 📅 Week Selector Bar (Dynamic 4 or 5 Weeks - Smooth Document Flow, No Sticky Freeze) */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#181A20] border border-slate-200/90 dark:border-white/10 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Calendar size={16} className="text-blue-600" />
            <span>เลือกสัปดาห์ที่ตรวจ (เดือนนี้มี {totalWeeksInMonth} สัปดาห์):</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {availableWeeks.map((wk) => (
              <button
                key={wk}
                type="button"
                onClick={() => setSelectedWeek(wk)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                  selectedWeek === wk
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200/80 dark:border-white/10'
                }`}
              >
                <span>สัปดาห์ที่ {wk}</span>
                {selectedWeek === wk && <CheckCircle2 size={12} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-100 dark:border-white/10 pt-3 min-w-0 max-w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">วันที่ตรวจเช็ค (สัปดาห์ที่ {selectedWeek}):</span>
            <input
              type="date"
              value={weekDates?.[selectedWeek] || getDeviceTodayDateStr()}
              onChange={(e) => handleDateChange(selectedWeek, e.target.value)}
              className="flex-1 min-w-0 w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-xs font-bold text-blue-700 dark:text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
            />
          </div>

          <button
            type="button"
            disabled={isSavingReport}
            onClick={handleSaveAndPreview}
            className="w-full sm:w-auto justify-center shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 group"
            title="บันทึกข้อมูลและเข้าสู่หน้าพรีวิวเพื่อพิมพ์ PDF"
          >
            {isSavingReport ? (
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <CheckCircle2 size={15} className="group-hover:scale-110 transition-transform" />
            )}
            <span>{isSavingReport ? 'กำลังบันทึก...' : 'บันทึก & พรีวิว PDF'}</span>
          </button>
        </div>
      </div>

      {/* Progress & Summary Badge Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1F20] border border-slate-200/90 dark:border-white/10 shadow-xs space-y-2.5 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-[#E3E3E3] tabular-nums">
            <span>ความพร้อม (สัปดาห์ที่ {selectedWeek}):</span>
            <span className="text-blue-600 dark:text-[#A8C7FA] font-extrabold">
              {normalCount} / {totalCount}
            </span>
            <span className="text-slate-500 dark:text-[#8E918F] font-semibold">
              ({readinessPct}%)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#81C995] font-bold border border-emerald-200 dark:border-emerald-500/30 tabular-nums whitespace-nowrap">
              ✓ ปกติ {normalCount}
            </span>
            {defectiveCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/12 dark:bg-rose-500/15 text-rose-700 dark:text-[#F28B82] font-bold border border-rose-200 dark:border-rose-500/30 flex items-center gap-1 tabular-nums whitespace-nowrap">
                <AlertTriangle size={12} />
                <span>ไม่ครบ/มีปัญหา {defectiveCount}</span>
              </span>
            )}
            {totalCount - checkedCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] font-semibold border border-slate-200 dark:border-white/10 tabular-nums whitespace-nowrap">
                รอตรวจ {totalCount - checkedCount}
              </span>
            )}
          </div>
        </div>

        {/* Live Readiness Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#282A2C] overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${
              readinessPct === 100
                ? 'bg-emerald-500 dark:bg-[#81C995]'
                : defectiveCount > 0
                ? 'bg-amber-500 dark:bg-[#FDD663]'
                : 'bg-blue-600 dark:bg-[#A8C7FA]'
            }`}
            style={{ width: `${readinessPct}%` }}
          />
        </div>
      </div>

      {/* Group Selector Pills & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-2.5 text-slate-400 dark:text-[#8E918F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่ออุปกรณ์, รหัส, ตำแหน่ง..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#1E1F20] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-[#E3E3E3] text-xs outline-none focus:border-blue-500 dark:focus:border-[#A8C7FA] focus:ring-1 focus:ring-blue-100 dark:focus:ring-[#A8C7FA]/25 transition placeholder:text-slate-400 dark:placeholder:text-[#8E918F] font-sans shadow-xs"
          />
        </div>

        {groups.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedGroup === 'all'
                  ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-xs'
                  : 'bg-white dark:bg-[#1E1F20] text-slate-700 dark:text-[#C4C7C5] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#282A2C]'
              }`}
            >
              ทั้งหมด ({allItems.length})
            </button>
            {groups.map((grp) => {
              const grpItems = allItems.filter((i) => i.groupName === grp);
              const grpCount = grpItems.length;
              const grpNormal = grpItems.filter((i) => getItemWeekStatus(i) === 'normal').length;
              const grpChecked = grpItems.filter((i) => getItemWeekStatus(i) !== '').length;
              const isGrpDone = grpCount > 0 && grpNormal >= grpCount;

              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                    selectedGroup === grp
                      ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-xs'
                      : isGrpDone
                      ? 'bg-emerald-500/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#81C995] border border-emerald-200 dark:border-emerald-500/30 font-bold'
                      : 'bg-white dark:bg-[#1E1F20] text-slate-700 dark:text-[#C4C7C5] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#282A2C]'
                  }`}
                >
                  <span>{grp}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                    selectedGroup === grp
                      ? 'bg-white/20 dark:bg-black/15 text-white dark:text-[#131314]'
                      : 'bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5]'
                  }`}>
                    {grpChecked}/{grpCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Unified Section Header Banner with Dynamic Pass-All / Cancel-All Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-[#1E1F20] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-[#A8C7FA] shrink-0" />
          <span className="font-bold text-xs text-slate-800 dark:text-[#E3E3E3] truncate">
            {selectedGroup === 'all' ? `ตรวจเช็กทั้งหมด (${filteredItems.length} รายการ)` : `หมวด: ${selectedGroup}`}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#A8C7FA]/15 text-blue-700 dark:text-[#A8C7FA] font-bold border border-blue-200 dark:border-[#A8C7FA]/25 shrink-0 whitespace-nowrap">
            สัปดาห์ที่ {selectedWeek}
          </span>
        </div>

        <button
          type="button"
          onClick={handleTogglePassAll}
          className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition whitespace-nowrap shrink-0 ${
            areAllPassed
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          title={areAllPassed ? `ยกเลิกการตรวจทั้งหมด (สัปดาห์ที่ ${selectedWeek})` : `กดตรวจผ่านปกติทุกรายการประจำสัปดาห์ที่ ${selectedWeek}`}
        >
          {areAllPassed ? <X size={13} strokeWidth={2.5} /> : <Check size={13} strokeWidth={2.5} />}
          <span>{areAllPassed ? `ยกเลิกตรวจ (W${selectedWeek})` : `ตรวจผ่านทั้งหมด (W${selectedWeek})`}</span>
        </button>
      </div>

      {/* 📋 Clean Checklist Cards (CSS Column Layout for Seamless Desktop Masonry Flow Without Gaps) */}
      <div className="columns-1 md:columns-2 gap-3.5 md:gap-4 [column-fill:_balance]">
        {filteredItems.length === 0 ? (
          <div className="w-full p-6 text-center bg-white dark:bg-[#1E1F20] rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-[#8E918F] text-xs shadow-xs mb-4">
            ไม่พบรายการอุปกรณ์ตรงตามคำค้นหา
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const check = checks[item.itemKey];
            const weekVal = check?.weekVals?.[selectedWeek];

            // Use comprehensive classification
            const classification = getItemQuantityClassification(item);
            const isType1 = classification.isType1;
            const isType2 = classification.isType2;
            const targetTotalQty = classification.totalQty;
            const subItems = isType2 ? classification.subItems : [];
            const hasMultipleSubItems = isType2;
            const subStatuses = parseSubItemStatuses(weekVal, classification.subQuantities);

            // Calculate current counted quantity for Type 1 items strictly from selectedWeek weekVal
            let currentCount: number | null = null;
            if (weekVal !== undefined && String(weekVal).trim() !== '') {
              if (weekVal.includes(',')) {
                const parts = weekVal.split(',').map((p) => p.trim());
                currentCount = parts.filter((p) => p === '1' || p === '✓' || parseInt(p, 10) > 0).length;
              } else {
                const parsed = parseInt(String(weekVal).replace(/\D/g, ''), 10);
                currentCount = isNaN(parsed) ? (weekVal === '✗' ? 0 : null) : parsed;
              }
            }

            const isCountOk = currentCount !== null && currentCount >= targetTotalQty;
            const isCountPartial = currentCount !== null && currentCount > 0 && currentCount < targetTotalQty;
            const isCountZero = currentCount === 0;
            const hasWeekVal = weekVal !== undefined && String(weekVal).trim() !== '';

            const isOk = isType2
              ? (hasWeekVal ? subStatuses.every((s, i) => s === String(classification.subQuantities[i] || 1)) : false)
              : isType1
              ? isCountOk
              : (hasWeekVal && weekVal !== '0' && weekVal !== '✗');
            const isBad = isType2
              ? (hasWeekVal ? subStatuses.some((s, i) => s === '0' || s === '✗' || (s !== '' && s !== String(classification.subQuantities[i] || 1))) : false)
              : isType1
              ? isCountZero || isCountPartial
              : (weekVal === '0' || weekVal === '✗');

            const currentExp = check?.exp || item.exp || '';
            const subExps = parseSubExps(currentExp);

            // Handler for Type 1 count updates
            const handleSetCount = (newCount: number) => {
              const safeCount = Math.max(0, newCount);
              const result = safeCount >= targetTotalQty ? 'ปกติ' : 'ผิดปกติ';
              onToggleCheck(item.itemKey, result, item.name, selectedWeek, true, String(safeCount));
            };

            // Handler for toggling single sub-item
            const handleToggleSubItem = (idx: number, targetStatus: string) => {
              const nextStatuses = [...subStatuses];
              const subInfo = getItemSubItemsInfo(item);
              const realTarget = String(subInfo.quantities[idx] || 1);
              
              // If already targetStatus, toggle off/reset or keep
              if (nextStatuses[idx] === targetStatus) {
                nextStatuses[idx] = targetStatus === realTarget ? '0' : realTarget;
              } else {
                nextStatuses[idx] = targetStatus;
              }
              
              // Fill any unselected sub-items with their target if user has started checking
              const cleaned = nextStatuses.map((s, i) => {
                const subTarget = String(subInfo.quantities[i] || 1);
                return (s === '0' || s === '✗') ? '0' : subTarget;
              });
              
              const combinedStr = cleaned.join(', ');
              const hasProblem = cleaned.some((s, i) => {
                const subTarget = String(subInfo.quantities[i] || 1);
                return s !== subTarget;
              });
              onToggleCheck(item.itemKey, hasProblem ? 'ผิดปกติ' : 'ปกติ', item.name, selectedWeek, true, combinedStr);
            };

            const handleMasterAllOk = () => {
              const subInfo = getItemSubItemsInfo(item);
              const allOk = subInfo.quantities.map(q => String(q)).join(', ');
              onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, allOk);
            };

            const handleMasterAllBad = () => {
              const allBad = Array(subItems.length).fill('0').join(', ');
              onToggleCheck(item.itemKey, 'ผิดปกติ', item.name, selectedWeek, true, allBad);
            };

            return (
              <div
                key={item.itemKey}
                style={{ breakInside: 'avoid' }}
                className={`break-inside-avoid mb-3.5 md:mb-4 inline-block w-full align-top p-3 sm:p-3.5 rounded-2xl border transition-colors duration-150 space-y-2.5 card-perf bg-white dark:bg-[#1E1F20] text-slate-900 dark:text-[#E3E3E3] shadow-xs ${
                  isBad && isCountPartial
                    ? 'border-slate-200 dark:border-white/10 border-l-4 border-l-amber-500 dark:border-l-[#FDD663]'
                    : isBad
                    ? 'border-slate-200 dark:border-white/10 border-l-4 border-l-rose-500 dark:border-l-[#F28B82]'
                    : isOk
                    ? 'border-slate-200 dark:border-white/10 border-l-4 border-l-emerald-500 dark:border-l-[#81C995]'
                    : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/25'
                }`}
              >
                {/* Clean Header Row (Left-to-right scan) */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-[#282A2C] text-blue-700 dark:text-[#A8C7FA] font-bold border border-blue-200/80 dark:border-white/10">
                          {item.groupName}
                        </span>
                        {item.no && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#E3E3E3] font-mono font-bold border border-slate-200 dark:border-white/10">
                            #{item.no}
                          </span>
                        )}
                        {item.code && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] font-mono border border-slate-200 dark:border-white/10">
                            {item.code}
                          </span>
                        )}
                        {isType1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] font-bold border border-slate-200 dark:border-white/10 tabular-nums shrink-0 whitespace-nowrap">
                            เป้า {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}
                            {currentCount !== null && (
                              <span
                                className={`ml-1 font-mono ${
                                  isCountOk
                                    ? 'text-emerald-600 dark:text-[#81C995]'
                                    : isCountPartial
                                    ? 'text-amber-600 dark:text-[#FDD663]'
                                    : 'text-rose-600 dark:text-[#F28B82]'
                                }`}
                              >
                                ({currentCount}/{targetTotalQty})
                              </span>
                            )}
                          </span>
                        )}
                        {hasMultipleSubItems && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30 tabular-nums shrink-0 whitespace-nowrap">
                            {subItems.length} ชิ้นย่อย ({subStatuses.filter((s, i) => s === String(classification.subQuantities[i] || 1)).length}/{subItems.length} ปกติ)
                          </span>
                        )}
                      </div>

                      {/* 3-Dots Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item as any)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#282A2C] text-slate-400 hover:text-blue-600 dark:hover:text-[#A8C7FA] transition cursor-pointer shrink-0"
                        title="แก้ไขรายการอุปกรณ์"
                      >
                        <MoreVertical size={15} />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#E3E3E3] leading-snug">
                      {idx + 1}. {sanitizeItemName(item.name)}
                    </h3>

                    {item.spec && (
                      <p className="text-xs text-slate-500 dark:text-[#8E918F] line-clamp-1 font-sans">{item.spec}</p>
                    )}

                    {/* Non-multi Single Item / Type 1 EXP Display */}
                    {!hasMultipleSubItems && (() => {
                      const cleanExp = String(currentExp || '').trim();
                      const hasValidExp = Boolean(cleanExp && cleanExp !== '-' && !/^no\s*exp$/i.test(cleanExp));
                      const isIsoDateExp = /^\d{4}-\d{2}-\d{2}$/.test(cleanExp);

                      return (
                        <div className="mt-1 flex items-center gap-2">
                          {!hasValidExp ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 dark:text-[#8E918F] font-semibold bg-slate-100 dark:bg-[#282A2C] px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                                ไม่มี EXP
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateNote(item.itemKey, `EXP:${getDeviceTodayDateStr()}`)}
                                className="text-[10px] text-blue-600 dark:text-[#A8C7FA] font-bold hover:underline cursor-pointer"
                              >
                                + ใส่วันที่
                              </button>
                            </div>
                          ) : isIsoDateExp ? (
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-rose-600 dark:text-[#F28B82] font-bold flex items-center gap-1 shrink-0">
                                <span>⏳ EXP:</span>
                              </p>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={cleanExp}
                                  onChange={(e) => onUpdateNote(item.itemKey, `EXP:${e.target.value}`)}
                                  className="text-[10px] bg-white dark:bg-[#282A2C] border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-rose-700 dark:text-[#F28B82] font-bold outline-none w-32 h-7"
                                  title="แก้ไขวันหมดอายุ"
                                />
                                <button
                                  type="button"
                                  onClick={() => onUpdateNote(item.itemKey, 'EXP:-')}
                                  className="p-1 rounded-md bg-slate-100 dark:bg-[#282A2C] hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-[#8E918F] hover:text-rose-600 dark:hover:text-[#F28B82] transition cursor-pointer"
                                  title="ล้างวันหมดอายุ"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-rose-700 dark:text-[#F28B82] font-bold bg-rose-500/10 dark:bg-rose-500/15 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/30">
                                ⏳ EXP: {cleanExp}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateNote(item.itemKey, `EXP:${getDeviceTodayDateStr()}`)}
                                className="text-[10px] text-blue-600 dark:text-[#A8C7FA] font-bold hover:underline cursor-pointer"
                              >
                                ปรับวันที่
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {item.img && (
                    <div
                      onClick={() => onZoomImage && onZoomImage(item.img!)}
                      className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition relative shadow-xs"
                    >
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      <Maximize2
                        size={10}
                        className="absolute bottom-1 right-1 text-white bg-black/60 rounded p-0.5"
                      />
                    </div>
                  )}
                </div>

                {/* Sub-Items Dynamic Check Section (Collapsible Accordion) */}
                {hasMultipleSubItems ? (() => {
                  const isExpanded = !!expandedMultiItems[item.itemKey];
                  const passedSubCount = subStatuses.filter((s, i) => s === String(classification.subQuantities[i] || 1)).length;
                  return (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10 transition-all duration-200 ease-in-out overflow-hidden transform-gpu">
                      {/* Accordion Header Trigger */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMultiItems((prev) => ({
                              ...prev,
                              [item.itemKey]: !prev[item.itemKey],
                            }))
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#282A2C] hover:bg-blue-50 dark:hover:bg-[#333537] text-slate-700 dark:text-[#E3E3E3] hover:text-blue-700 dark:hover:text-[#A8C7FA] text-[11px] font-bold transition cursor-pointer border border-slate-200/80 dark:border-white/10 whitespace-nowrap"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          <span>
                            {isExpanded ? 'ซ่อน' : 'แสดง'}รายการย่อย ({passedSubCount}/{subItems.length} ชิ้น)
                          </span>
                        </button>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-[#8E918F]">
                          สัปดาห์ที่ {selectedWeek}
                        </span>
                      </div>

                      {/* Master Actions always accessible without needing to expand */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMasterAllOk}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                            isOk
                              ? 'bg-emerald-600 dark:bg-emerald-500/20 text-white dark:text-[#81C995] border border-transparent dark:border-emerald-500/40 shadow-xs'
                              : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-[#81C995] border border-slate-200/80 dark:border-white/10'
                          }`}
                        >
                          <Check size={14} strokeWidth={2.5} />
                          <span>ปกติทั้งหมด ({subItems.length} ชิ้น)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleMasterAllBad}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                            isBad
                              ? 'bg-rose-600 dark:bg-rose-500/20 text-white dark:text-[#F28B82] border border-transparent dark:border-rose-500/40 shadow-xs'
                              : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-[#F28B82] border border-slate-200/80 dark:border-white/10'
                          }`}
                        >
                          <X size={14} strokeWidth={2.5} />
                          <span>มีปัญหาทั้งหมด</span>
                        </button>
                      </div>

                      {/* Expandable Sub-item Grid */}
                      {isExpanded && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {subItems.map((subLabel, idx) => {
                            const subInfo = getItemSubItemsInfo(item);
                            const subTarget = String(subInfo.quantities[idx] || 1);
                            const status = subStatuses[idx];
                            const isSubOk = status === subTarget;
                            const isSubBad = status === '0' || status === '✗' || (status !== '' && status !== subTarget);
                            const matchedSubExp = (
                              subExps[idx]?.date ||
                              subExps.find((s) => s.label?.includes(subLabel))?.date ||
                              ''
                            ).trim();
                            const hasSubExp = Boolean(
                              matchedSubExp &&
                              matchedSubExp !== '-' &&
                              !/^no\s*exp$/i.test(matchedSubExp)
                            );

                            return (
                              <div
                                key={idx}
                                className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 transition bg-slate-50 dark:bg-[#282A2C] ${
                                  isSubBad
                                    ? 'border-rose-300 dark:border-rose-500/40'
                                    : isSubOk
                                    ? 'border-emerald-300 dark:border-emerald-500/40'
                                    : 'border-slate-200 dark:border-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-bold text-xs text-slate-800 dark:text-[#E3E3E3] truncate" title={subLabel}>
                                    {subLabel}
                                  </span>
                                  {hasSubExp ? (
                                    <span className="text-[10px] text-rose-600 dark:text-[#F28B82] font-bold hidden sm:inline truncate">
                                      EXP: {matchedSubExp}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 dark:text-[#8E918F] hidden sm:inline truncate">
                                      ไม่มี EXP
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const subInfo = getItemSubItemsInfo(item);
                                      handleToggleSubItem(idx, String(subInfo.quantities[idx] || 1));
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 whitespace-nowrap ${
                                      isSubOk
                                        ? 'bg-emerald-600 dark:bg-emerald-500/25 text-white dark:text-[#81C995] border border-transparent dark:border-emerald-500/40 shadow-2xs'
                                        : 'bg-white dark:bg-[#1E1F20] border border-slate-300 dark:border-white/10 text-slate-700 dark:text-[#C4C7C5] hover:bg-emerald-50 dark:hover:bg-emerald-500/15'
                                    }`}
                                    title={`ตรวจแล้ว ปกติ (${subTarget})`}
                                  >
                                    <Check size={13} strokeWidth={3} />
                                    <span>ผ่าน ({subTarget})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubItem(idx, '0')}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 whitespace-nowrap ${
                                      isSubBad
                                        ? 'bg-rose-600 dark:bg-rose-500/25 text-white dark:text-[#F28B82] border border-transparent dark:border-rose-500/40 shadow-2xs'
                                        : 'bg-white dark:bg-[#1E1F20] border border-slate-300 dark:border-white/10 text-slate-700 dark:text-[#C4C7C5] hover:bg-rose-50 dark:hover:bg-rose-500/15'
                                    }`}
                                    title="ตรวจแล้ว มีปัญหา/ขาด (0)"
                                  >
                                    <X size={13} strokeWidth={3} />
                                    <span>ไม่ผ่าน</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })() : isType1 ? (
                  /* Type 1 Quantity Check Section (Clean Balanced Layout with Unlocked -/+ Stepper & Incomplete Status) */
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-[#C4C7C5]">
                        ตรวจนับได้ ({item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}):
                      </span>
                      {isCountOk ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-[#81C995] font-bold border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                          ครบ (ปกติ)
                        </span>
                      ) : isCountPartial ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-[#FDD663] font-bold border border-amber-300 dark:border-amber-500/35 whitespace-nowrap">
                          ไม่ครบ / ขาดจำนวน ({currentCount}/{targetTotalQty})
                        </span>
                      ) : isCountZero ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/12 dark:bg-rose-500/20 text-rose-700 dark:text-[#F28B82] font-bold border border-rose-200 dark:border-rose-500/35 whitespace-nowrap">
                          หมด / ขาดจำนวน (0/{targetTotalQty})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-[#8E918F] whitespace-nowrap">
                          เป้าหมาย {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                      {/* Unlocked Stepper Count Selector (- down to 0) */}
                      <div className="flex items-center bg-slate-100 dark:bg-[#282A2C] rounded-xl p-1 border border-slate-200 dark:border-white/10 shrink-0">
                        <button
                          type="button"
                          disabled={currentCount === 0}
                          onClick={() => handleSetCount(Math.max(0, (currentCount ?? targetTotalQty) - 1))}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E1F20] shadow-2xs hover:bg-slate-50 dark:hover:bg-[#333537] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center font-bold text-slate-700 dark:text-[#E3E3E3] active:scale-90 transition cursor-pointer text-base"
                          title="ลดจำนวน (-1)"
                        >
                          -
                        </button>
                        <div className="px-2.5 text-center min-w-[48px] tabular-nums whitespace-nowrap">
                          <span
                            className={`text-base font-bold ${
                              isCountOk
                                ? 'text-emerald-600 dark:text-[#81C995]'
                                : isCountPartial
                                ? 'text-amber-600 dark:text-[#FDD663]'
                                : isCountZero
                                ? 'text-rose-600 dark:text-[#F28B82]'
                                : 'text-slate-900 dark:text-[#E3E3E3]'
                            }`}
                          >
                            {currentCount !== null ? currentCount : '-'}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-[#8E918F] font-bold">/{targetTotalQty}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetCount((currentCount ?? 0) + 1)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E1F20] shadow-2xs hover:bg-slate-50 dark:hover:bg-[#333537] flex items-center justify-center font-bold text-slate-700 dark:text-[#E3E3E3] active:scale-90 transition cursor-pointer text-base"
                          title="เพิ่มจำนวน (+1)"
                        >
                          +
                        </button>
                      </div>

                      {/* Balanced Action Buttons (Right-aligned, whitespace-nowrap prevents broken wrapping) */}
                      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                        <button
                          type="button"
                          onClick={() => handleSetCount(targetTotalQty)}
                          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                            isCountOk
                              ? 'bg-emerald-600 dark:bg-emerald-500/20 text-white dark:text-[#81C995] border border-transparent dark:border-emerald-500/40 shadow-xs'
                              : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-[#81C995] border border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <Check size={14} strokeWidth={2.5} className="shrink-0" />
                          <span>ครบ {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetCount(0)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                            isCountZero
                              ? 'bg-rose-600 dark:bg-rose-500/20 text-white dark:text-[#F28B82] border border-transparent dark:border-rose-500/40 shadow-xs'
                              : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-[#F28B82] border border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <X size={14} strokeWidth={2.5} className="shrink-0" />
                          <span>ขาด (0)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Touch Check Buttons for Single Items */
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                          isOk
                            ? 'bg-emerald-600 dark:bg-emerald-500/20 text-white dark:text-[#81C995] border border-transparent dark:border-emerald-500/40 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-[#81C995] border border-slate-200/80 dark:border-white/10'
                        }`}
                      >
                        <Check size={15} strokeWidth={2.5} className="shrink-0" />
                        <span>ปกติ (พร้อมใช้)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.itemKey, 'ผิดปกติ', item.name, selectedWeek)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                          isBad
                            ? 'bg-rose-600 dark:bg-rose-500/20 text-white dark:text-[#F28B82] border border-transparent dark:border-rose-500/40 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#C4C7C5] hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-[#F28B82] border border-slate-200/80 dark:border-white/10'
                        }`}
                      >
                        <X size={15} strokeWidth={2.5} className="shrink-0" />
                        <span>มีปัญหา</span>
                      </button>
                    </div>
                  </div>
                )}

                  {/* O2 Tank PSI Input (Special handling - 2 distinct tanks) */}
                  {((item.name.toLowerCase().includes('o2') || item.name.toLowerCase().includes('oxygen') || item.name.includes('ออกซิเจน')) && (item.name.toLowerCase().includes('tank') || item.name.includes('ถัง'))) && (() => {
                    const currentWkVal = check?.weekVals?.[selectedWeek] || '';
                    const parts = currentWkVal.split(',').map((p) => p.replace(/\D/g, ''));
                    const psi1 = parts[0] || '';
                    const psi2 = parts[1] || '';

                    const handleUpdateO2 = (p1: string, p2: string) => {
                      const clean1 = p1.slice(0, 4);
                      const clean2 = p2.slice(0, 4);
                      const combined = `${clean1}, ${clean2}`;
                      const num1 = parseInt(clean1, 10);
                      const num2 = parseInt(clean2, 10);
                      const isLow1 = clean1 !== '' && num1 < 500;
                      const isLow2 = clean2 !== '' && num2 < 500;
                      const hasProblem = isLow1 || isLow2;
                      const res: 'ปกติ' | 'ผิดปกติ' = hasProblem ? 'ผิดปกติ' : 'ปกติ';
                      onToggleCheck(item.itemKey, res, item.name, selectedWeek, true, combined);
                    };

                    const num1 = psi1 !== '' ? parseInt(psi1, 10) : NaN;
                    const num2 = psi2 !== '' ? parseInt(psi2, 10) : NaN;
                    const isLow1 = !isNaN(num1) && num1 < 500;
                    const isLow2 = !isNaN(num2) && num2 < 500;

                    return (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              ถังที่ 1 (PSI)
                            </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  max="9999"
                                  maxLength={4}
                                  value={psi1}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                    handleUpdateO2(val, psi2);
                                  }}
                                  placeholder="เช่น 1950"
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-bold text-center text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">psi</span>
                              </div>
                            {isLow1 && (
                              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                                ⚠️ ต่ำกว่า 500 PSI
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              ถังที่ 2 (PSI)
                            </label>
                            <input
                              type="number"
                              max="9999"
                              maxLength={4}
                              value={psi2}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                handleUpdateO2(psi1, val);
                              }}
                              placeholder="เช่น 1700"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-bold text-center text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                            {isLow2 && (
                              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                                ⚠️ ต่ำกว่า 500 PSI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Defect note input when marked defective */}
                  {isBad && (
                    <input
                      type="text"
                      value={check?.note && check.note.startsWith('PSI:') ? '' : (check?.note || '')}
                      onChange={(e) => onUpdateNote(item.itemKey, e.target.value)}
                      placeholder="ระบุอาการเสีย หรือปัญหาที่พบ..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/80 outline-none text-rose-900 dark:text-rose-100 placeholder:text-rose-400 dark:placeholder:text-rose-400/70 focus:ring-1 focus:ring-rose-300 font-sans"
                    />
                  )}
                </div>
            );
          })
        )}
      </div>

      {/* ➕ Modal เพิ่มรายการอุปกรณ์ใหม่ */}
      {isAddItemModalOpen && (
        <EditItemModal
          isOpen={isAddItemModalOpen}
          mode="add"
          type={type}
          onClose={() => setIsAddItemModalOpen(false)}
          groups={groups}
          onSave={handleAddNewItemFromModal}
        />
      )}

      {/* ✏️ Modal แก้ไขรายการอุปกรณ์ */}
      {isEditModalOpen && itemToEdit && (
        <EditItemModal
          isOpen={isEditModalOpen}
          mode="edit"
          type={type}
          onClose={() => setIsEditModalOpen(false)}
          item={itemToEdit as any}
          groups={groups}
          onSave={handleSaveEdit}
          onDelete={handleDeleteItemInEdit}
        />
      )}

      {/* 📋 Modal ตรวจเทียบกระดาษกับระบบเว็บ (Paper Checklist Audit) */}
      <PaperAuditModal
        isOpen={isPaperAuditOpen}
        onClose={() => setIsPaperAuditOpen(false)}
        initialCategory={type}
      />

      {/* 🛡️ In-UI Bulk Action Confirmation Modal (Replaces native window.confirm) */}
      {pendingBulkAction && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPendingBulkAction(null)}
        >
          <div
            className="bg-white dark:bg-[#1E2028] rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-white/10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                pendingBulkAction === 'pass_5_weeks' ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'
              }`}>
                {pendingBulkAction === 'pass_5_weeks' ? <CheckCheck size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {pendingBulkAction === 'clear_all'
                    ? `ลบรายการทั้งหมดใน${type === 'bag' ? 'กระเป๋า' : type === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน'}?`
                    : pendingBulkAction === 'clear_checks'
                    ? `ล้างผลตรวจสัปดาห์ที่ ${selectedWeek}?`
                    : 'ตรวจผ่านปกติครบ 5 สัปดาห์?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {pendingBulkAction === 'clear_all'
                    ? 'รายการอุปกรณ์ทั้งหมดในหมวดนี้จะถูกลบถาวร ไม่สามารถย้อนกลับได้'
                    : pendingBulkAction === 'clear_checks'
                    ? `ค่าผลการตรวจทั้งหมดในสัปดาห์ที่ ${selectedWeek} จะถูกรีเซ็ตเป็นยังไม่ตรวจ`
                    : 'ทุกรายการในสัปดาห์ที่ 1-5 จะถูกทำเครื่องหมายว่า "ปกติ"'}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingBulkAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingBulkAction === 'clear_all') {
                    onClearAll?.(type);
                  } else if (pendingBulkAction === 'clear_checks') {
                    if (onClearWeekChecks) {
                      onClearWeekChecks(selectedWeek);
                    } else {
                      allItems.forEach((item) => {
                        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, '');
                      });
                    }
                  } else if (pendingBulkAction === 'pass_5_weeks') {
                    [1, 2, 3, 4, 5].forEach((wk) => {
                      allItems.forEach((item) => {
                        const passVal = getRealTargetCheckValue(item);
                        onToggleCheck(item.itemKey, 'ปกติ', item.name, wk, true, passVal);
                      });
                    });
                  }
                  setPendingBulkAction(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs cursor-pointer transition active:scale-95 ${
                  pendingBulkAction === 'pass_5_weeks'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
