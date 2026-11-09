import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BriefcaseMedical,
  Truck,
  Check,
  X,
  AlertTriangle,
  CheckCheck,
  Search,
  Maximize2,
  ArrowLeft,
  MoreVertical,
  Calendar,
  Plus,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Home,
  Sparkles,
} from 'lucide-react';
import { CheckItemState, ListConfig, EquipmentItem } from '../types';
import { formatAcquiredDate } from './OfficialReportModal';
import { EditItemModal } from './EditItemModal';
import { PaperAuditModal } from './PaperAuditModal';
import { getWednesdaysInfoForMonth } from '../utils/wednesdayUtils';

import {
  getItemSizes,
  parseSubExps,
  getItemSubItemsInfo,
  extractQuantityNumbers,
  getItemQuantityClassification,
  getRealTargetCheckValue,
  sanitizeItemName,
  sortItemsNaturally
} from '../utils/itemUtils';
export type { SubExpItemInfo as SubExpItem } from '../utils/itemUtils';
export { getItemSizes, parseSubExps, getRealTargetCheckValue, sanitizeItemName, sortItemsNaturally };

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
  type: 'bag' | 'cart';
  title: string;
  subtitle: string;
  listConfig: ListConfig;
  checks: Record<string, CheckItemState>;
  onToggleCheck: (itemKey: string, result: 'ปกติ' | 'ผิดปกติ', itemName: string, week?: number, isMassAction?: boolean, customValue?: string) => void;
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
  onDeleteItem?: (type: 'bag' | 'cart', itemKey: string) => void;
  onEditItem?: (item: EquipmentItem) => void;
  weekDates: Record<number, string>;
  onWeekDatesChange: (dates: Record<number, string>) => void;
  onSaveByWeek?: (week: number, weekDates: Record<number, string>) => void;
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
  onBack,
  onAddItem,
  onDeleteItem,
  onEditItem,
  weekDates,
  onWeekDatesChange,
  onSaveByWeek,
  isVisible = true,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaperAuditOpen, setIsPaperAuditOpen] = useState<boolean>(false);

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

  const handleSaveAndPreview = () => {
    if (onSaveByWeek) {
      onSaveByWeek(selectedWeek, weekDates);
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

  // Summary statistics
  const totalCount = allItems.length;
  const checkedCount = allItems.filter((i) => checks[i.itemKey]?.result).length;
  const normalCount = allItems.filter((i) => checks[i.itemKey]?.result === 'ปกติ').length;
  const defectiveCount = allItems.filter((i) => checks[i.itemKey]?.result === 'ผิดปกติ').length;

  // 2. Toggle Pass All 3-State Logic
  const areAllPassed = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => {
      const c = checks[item.itemKey];
      const wkVal = c?.weekVals?.[selectedWeek];
      const classification = getItemQuantityClassification(item);
      
      if (classification.isType2) {
        const subInfo = getItemSubItemsInfo(item);
        const subStat = parseSubItemStatuses(wkVal, classification.subQuantities);
        return subStat.every((s, idx) => {
          const target = String(subInfo.quantities[idx] || 1);
          return s === target;
        });
      }
      if (classification.isType1) {
        const parsed = parseInt(String(wkVal || '').replace(/\D/g, ''), 10);
        return !isNaN(parsed) && parsed >= classification.totalQty;
      }
      return wkVal === '1' || c?.result === 'ปกติ';
    });
  }, [filteredItems, checks, selectedWeek]);

  const handleTogglePassAll = () => {
    if (areAllPassed) {
      // If already all passed, toggle them back to unchecked state
      filteredItems.forEach((item) => {
        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, '');
      });
    } else {
      // Mark all filtered items as passed with their real target quantities (including sub-items)
      filteredItems.forEach((item) => {
        const passVal = getRealTargetCheckValue(item);
        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, passVal);
      });
    }
  };

  // Local File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์รูปภาพเกิน 5MB กรุณาเลือกไฟล์ขนาดเล็กกว่านี้');
        return;
      }
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
      alert('กรุณากรอกชื่อรายการอุปกรณ์');
      return;
    }

    const finalGroup = newItemGroup === '__custom__' ? customGroup.trim() : newItemGroup || (groups[0] || 'ทั่วไป');
    if (!finalGroup) {
      alert('กรุณาเลือกหรือกรอกหมวดหมู่/ตำแหน่ง');
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
    <div className="space-y-3.5 font-['TH_Sarabun_New','Sarabun',sans-serif] pb-28 animate-in fade-in duration-300 text-slate-800">
      
      {/* 🌟 Auto-Hiding Header Banner (Slides up on scroll down only on mobile, stays visible 100% on desktop) */}
      <div
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s ease, opacity 0.3s ease, max-height 0.3s ease, margin 0.3s ease',
          opacity: isVisible ? 1 : 0,
          maxHeight: isVisible ? '240px' : '0px',
          overflow: isVisible ? 'visible' : 'hidden',
          marginBottom: isVisible ? '0.75rem' : '0px',
        }}
        className="w-full z-20 md:!transform-none md:!opacity-100 md:!max-h-none md:!overflow-visible md:!mb-3.5"
      >
        {/* 🌟 Clean One UI Royal Blue Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white p-3.5 sm:p-4 rounded-[1.8rem] border border-blue-400/30 shadow-md flex justify-between items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold transition cursor-pointer active:scale-95 border border-white/25 shadow-xs flex items-center gap-1.5"
              title="กลับหน้าหลัก (Dashboard)"
              aria-label="กลับหน้าหลัก"
            >
              <Home size={17} className="text-white shrink-0" />
              <span className="text-xs font-bold hidden sm:inline">หน้าหลัก</span>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 leading-tight">
                {type === 'bag' ? (
                  <BriefcaseMedical size={20} className="text-amber-200 shrink-0" />
                ) : (
                  <Truck size={20} className="text-cyan-200 shrink-0" />
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
              <span>+ เพิ่มรายการ</span>
            </button>

            {/* 3-State Toggle Pass All Button */}
            <button
              type="button"
              onClick={handleTogglePassAll}
              className={`px-3 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                areAllPassed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
              title={areAllPassed ? `ยกเลิกการตรวจทั้งหมด (สัปดาห์ที่ ${selectedWeek})` : `กดตรวจผ่านปกติทุกรายการประจำสัปดาห์ที่ ${selectedWeek}`}
            >
              <CheckCheck size={15} />
              <span>{areAllPassed ? `ยกเลิกตรวจ (W${selectedWeek})` : `ตรวจผ่านทั้งหมด (W${selectedWeek})`}</span>
            </button>

            {/* Clear All Checks Button */}
            <button
              type="button"
              onClick={() => {
                if (confirm(`คุณต้องการล้างค่าผลการตรวจเช็กทั้งหมดในสัปดาห์ที่ ${selectedWeek} ใช่หรือไม่?`)) {
                  allItems.forEach((item) => {
                    onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, '');
                  });
                }
              }}
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
                onClick={() => {
                  if (confirm('คุณต้องการทำเครื่องหมาย "ปกติ" ให้กับทุกรายการในทุกสัปดาห์ (1-5) ใช่หรือไม่?')) {
                    [1, 2, 3, 4, 5].forEach((wk) => {
                      allItems.forEach((item) => {
                        const passVal = getRealTargetCheckValue(item);
                        onToggleCheck(item.itemKey, 'ปกติ', item.name, wk, true, passVal);
                      });
                    });
                  }
                }}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="กดตรวจผ่านปกติทุกรายการ ครบทั้ง 5 สัปดาห์ในครั้งเดียว"
              >
                <CheckCheck size={15} />
                <span>ตรวจผ่าน 5 สัปดาห์</span>
              </button>
            )}

            {/* 📋 Paper Checklist vs Web Audit Button */}
            <button
              type="button"
              onClick={() => setIsPaperAuditOpen(true)}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="ถ่ายภาพกระดาษตรวจเช็คเพื่อให้น้องออร่าเปรียบเทียบรายการที่ขาดหรือจำนวนไม่ตรง"
            >
              <Sparkles size={14} className="animate-pulse" />
              <span>ตรวจเทียบกระดาษ (Audit)</span>
            </button>
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

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-white/10 pt-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">วันที่ตรวจเช็ค (สัปดาห์ที่ {selectedWeek}):</span>
            <input
              type="date"
              value={weekDates?.[selectedWeek] || getDeviceTodayDateStr()}
              onChange={(e) => handleDateChange(selectedWeek, e.target.value)}
              className="flex-1 min-w-[120px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-bold text-blue-700 dark:text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const dateVal = weekDates[selectedWeek];
                if (!dateVal) {
                  alert('กรุณาเลือกวันที่ก่อนกดใช้กับทุกสัปดาห์');
                  return;
                }
                const updated: Record<number, string> = {};
                availableWeeks.forEach((wk) => {
                  updated[wk] = dateVal;
                });
                onWeekDatesChange(updated);
              }}
              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-white/10 transition active:scale-95 whitespace-nowrap"
              title="ใช้วันที่นี้กับทุกสัปดาห์"
            >
              ใช้กับทุกสัปดาห์
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveAndPreview}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 group"
            title="บันทึกข้อมูลและเข้าสู่หน้าพรีวิวเพื่อพิมพ์ PDF"
          >
            <CheckCircle2 size={15} className="group-hover:scale-110 transition-transform" />
            <span>บันทึก & พรีวิว PDF</span>
          </button>
        </div>
      </div>

      {/* Progress & Summary Badge Bar */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <span>ความพร้อม (สัปดาห์ที่ {selectedWeek}):</span>
          <span className="text-blue-600 font-extrabold">
            {checkedCount} / {totalCount}
          </span>
          <span className="text-slate-500 font-normal">
            ({Math.round(totalCount > 0 ? (checkedCount / totalCount) * 100 : 0)}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            ✓ ปกติ {normalCount}
          </span>
          {defectiveCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>มีปัญหา {defectiveCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Group Selector Pills & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่ออุปกรณ์, รหัส, ตำแหน่ง..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition placeholder:text-slate-400 font-sans shadow-xs"
          />
        </div>

        {groups.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedGroup === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              ทั้งหมด ({allItems.length})
            </button>
            {groups.map((grp) => {
              const grpCount = allItems.filter((i) => i.groupName === grp).length;
              const grpChecked = allItems.filter(
                (i) => i.groupName === grp && checks[i.itemKey]?.result
              ).length;
              const isGrpDone = grpCount > 0 && grpChecked >= grpCount;

              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                    selectedGroup === grp
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isGrpDone
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{grp}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {grpChecked}/{grpCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 📋 Clean Checklist Cards (CSS Column Layout for Seamless Desktop Masonry Flow Without Gaps) */}
      <div className="columns-1 md:columns-2 gap-3.5 md:gap-4 [column-fill:_balance]">
        {filteredItems.length === 0 ? (
          <div className="w-full p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs shadow-xs mb-4">
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

            // Calculate current counted quantity for Type 1 items
            let currentCount: number | null = null;
            if (weekVal !== undefined && weekVal !== '') {
              if (weekVal.includes(',')) {
                const parts = weekVal.split(',').map((p) => p.trim());
                currentCount = parts.filter((p) => p === '1' || p === '✓' || parseInt(p, 10) > 0).length;
              } else {
                const parsed = parseInt(String(weekVal).replace(/\D/g, ''), 10);
                currentCount = isNaN(parsed) ? (weekVal === '✗' ? 0 : null) : parsed;
              }
            } else if (check?.result === 'ปกติ') {
              currentCount = targetTotalQty;
            } else if (check?.result === 'ผิดปกติ') {
              currentCount = 0;
            }

            const isCountOk = currentCount !== null && currentCount >= targetTotalQty;
            const isCountPartial = currentCount !== null && currentCount > 0 && currentCount < targetTotalQty;
            const isCountZero = currentCount === 0 || check?.result === 'ผิดปกติ';

            const isOk = isType2
              ? (weekVal ? subStatuses.every((s, i) => s === String(classification.subQuantities[i] || 1)) : false)
              : isType1
              ? isCountOk
              : (weekVal === '1' || weekVal === String(classification.subQuantities[0]) || check?.result === 'ปกติ');
            const isBad = isType2
              ? (weekVal ? subStatuses.some((s, i) => s === '0' || s === '✗' || (s !== '' && s !== String(classification.subQuantities[i] || 1))) : false)
              : isType1
              ? isCountZero || isCountPartial
              : (weekVal === '0' || check?.result === 'ผิดปกติ');

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
                className={`break-inside-avoid mb-3.5 md:mb-4 inline-block w-full align-top p-2.5 sm:p-3 rounded-2xl border transition-all duration-150 space-y-2 transform-gpu contain-content ${
                  isBad
                    ? 'bg-rose-50/70 border-rose-300 shadow-xs text-slate-900'
                    : isOk
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-xs text-slate-900'
                    : 'bg-white border-slate-200 shadow-xs text-slate-900 hover:border-blue-200'
                }`}
              >
                {/* Minimal Header Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          {item.groupName}
                        </span>
                        {item.no && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold">
                            #{item.no}
                          </span>
                        )}
                        {item.code && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200">
                            {item.code}
                          </span>
                        )}
                        {isType1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                            เป้าหมาย {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}
                            {currentCount !== null && (
                              <span className={`ml-1 font-mono ${isCountOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ({currentCount}/{targetTotalQty})
                              </span>
                            )}
                          </span>
                        )}
                        {hasMultipleSubItems && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            {subItems.length} ชิ้นย่อย ({subStatuses.filter((s, i) => s === String(classification.subQuantities[i] || 1)).length}/{subItems.length} ปกติ)
                          </span>
                        )}
                      </div>

                      {/* 3-Dots Edit Button [✏️] */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item as any)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                        title="แก้ไขรายการอุปกรณ์"
                      >
                        <MoreVertical size={15} />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {idx + 1}. {sanitizeItemName(item.name)}
                    </h3>

                    {item.spec && (
                      <p className="text-xs text-slate-500 line-clamp-1 font-sans">{item.spec}</p>
                    )}

                    {/* Non-multi Single Item / Type 1 EXP Display with No EXP toggle */}
                    {!hasMultipleSubItems && (
                      <div className="mt-1 flex items-center gap-2 pl-2">
                        {currentExp === '-' || !currentExp || currentExp.toLowerCase() === 'no exp' || !currentExp.match(/^\d{4}-\d{2}-\d{2}$/) ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                              EXP: {currentExp || '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateNote(item.itemKey, `EXP:${getDeviceTodayDateStr()}`)}
                              className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                            >
                              ใส่วันที่
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 border-l-2 border-rose-200 pl-2">
                            <p className="text-xs text-rose-600 font-bold flex items-center gap-1 shrink-0">
                              <span>⏳ EXP:</span>
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="date"
                                value={currentExp}
                                onChange={(e) => onUpdateNote(item.itemKey, `EXP:${e.target.value}`)}
                                className="text-[10px] bg-white border border-rose-200 rounded px-1.5 py-0.5 text-rose-700 font-bold outline-none w-32 h-7"
                                title="ใส่วันหมดอายุ"
                              />
                              <button
                                type="button"
                                onClick={() => onUpdateNote(item.itemKey, 'EXP:-')}
                                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold transition cursor-pointer"
                                title="ไม่มีวันหมดอายุ"
                              >
                                No EXP
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {item.img && (
                    <div
                      onClick={() => onZoomImage && onZoomImage(item.img!)}
                      className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition relative shadow-xs"
                    >
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      <Maximize2
                        size={10}
                        className="absolute bottom-1 right-1 text-white bg-black/60 rounded p-0.5"
                      />
                    </div>
                  )}
                </div>

                {/* Sub-Items Dynamic Check Section (when item has multiple sub-items / sizes) */}
                {hasMultipleSubItems ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100 transition-all duration-200 ease-in-out overflow-hidden transform-gpu">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                      <span>ตรวจเช็กแยกตามชิ้นย่อย / แต่ละเบอร์:</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        สัปดาห์ที่ {selectedWeek}
                      </span>
                    </div>

                    {/* Sub-item Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subItems.map((subLabel, idx) => {
                        const subInfo = getItemSubItemsInfo(item);
                        const subTarget = String(subInfo.quantities[idx] || 1);
                        const status = subStatuses[idx];
                        const isSubOk = status === subTarget;
                        const isSubBad = status === '0' || status === '✗' || (status !== '' && status !== subTarget);
                        const matchedSubExp = subExps[idx]?.date || (subExps.find((s) => s.label?.includes(subLabel))?.date) || '';
                        const isSubNoExp = !matchedSubExp || matchedSubExp === '-' || matchedSubExp.toLowerCase() === 'no exp' || !matchedSubExp.match(/^\d{4}-\d{2}-\d{2}$/);

                        return (
                          <div
                            key={idx}
                            className={`px-2 py-1.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                              isSubBad
                                ? 'bg-rose-50 border-rose-200'
                                : isSubOk
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-black/20 border-slate-200'
                            }`}
                          >
                            {/* Left: Sub-item name/label bold & clear */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-bold text-xs text-slate-800 truncate" title={subLabel}>
                                {subLabel}
                              </span>
                              {/* Center: EXP short label */}
                              <span className="text-[10px] text-slate-500 hidden sm:inline truncate">
                                {isSubNoExp ? 'No EXP' : matchedSubExp}
                              </span>
                            </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const subInfo = getItemSubItemsInfo(item);
                                    handleToggleSubItem(idx, String(subInfo.quantities[idx] || 1));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                                    isSubOk
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-emerald-100'
                                  }`}
                                  title={`ตรวจแล้ว ปกติ (${subTarget})`}
                                >
                                  <Check size={13} strokeWidth={3} />
                                  <span>ผ่าน ({subTarget})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubItem(idx, '0')}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                                    isSubBad
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-rose-100'
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

                    {/* Master Actions for Multi-Item */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleMasterAllOk}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isOk
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                        }`}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span>ปกติทั้งหมด ({subItems.length} ชิ้น)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleMasterAllBad}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isBad
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80'
                        }`}
                      >
                        <X size={14} strokeWidth={2.5} />
                        <span>มีปัญหาทั้งหมด</span>
                      </button>
                    </div>
                  </div>
                ) : isType1 ? (
                  /* Type 1 Quantity Check Section (Tape 4 เส้น, Syringe blow cuff 2 อัน, Sterile water 3 ขวด) */
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                      <span>จำนวนที่ตรวจนับได้:</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        เป้าหมาย {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* Stepper Count Selector */}
                      <div className="flex items-center bg-slate-100 dark:bg-black/20 rounded-xl p-1 border border-slate-200 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetCount((currentCount ?? targetTotalQty) - 1)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-black/40 shadow-2xs hover:bg-slate-50 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 active:scale-90 transition cursor-pointer text-base"
                          title="ลดจำนวน (-1)"
                        >
                          -
                        </button>
                        <div className="px-3 text-center min-w-[50px]">
                          <span className={`text-base font-bold ${isCountOk ? 'text-emerald-600' : isCountZero ? 'text-rose-600' : 'text-slate-900'}`}>
                            {currentCount !== null ? currentCount : '-'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">/{targetTotalQty}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetCount((currentCount ?? 0) + 1)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-black/40 shadow-2xs hover:bg-slate-50 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 active:scale-90 transition cursor-pointer text-base"
                          title="เพิ่มจำนวน (+1)"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick: ครบทั้งหมด */}
                      <button
                        type="button"
                        onClick={() => handleSetCount(targetTotalQty)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isCountOk
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                        }`}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span>ครบ {targetTotalQty} {item.qty?.replace(/[0-9\s]/g, '') || 'ชิ้น'} (ปกติ)</span>
                      </button>

                      {/* Quick: มีปัญหา / 0 */}
                      <button
                        type="button"
                        onClick={() => handleSetCount(0)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 shrink-0 ${
                          isCountZero
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                        }`}
                      >
                        <X size={14} strokeWidth={2.5} />
                        <span>มีปัญหา (0)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Touch Check Buttons for Single Items */
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isOk
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                        }`}
                      >
                        <Check size={16} strokeWidth={2.5} />
                        <span>ปกติ (พร้อมใช้)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.itemKey, 'ผิดปกติ', item.name, selectedWeek)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isBad
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80'
                        }`}
                      >
                        <X size={16} strokeWidth={2.5} />
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
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-rose-50 border border-rose-300 outline-none text-rose-900 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-300 font-sans"
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
    </div>
  );
};
