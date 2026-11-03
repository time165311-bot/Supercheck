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
} from 'lucide-react';
import { CheckItemState, ListConfig, EquipmentItem } from '../types';
import { formatAcquiredDate } from './OfficialReportModal';
import { EditItemModal } from './EditItemModal';

export interface SubExpItem {
  label: string;
  date: string;
}

export function parseSubExps(expStr?: string): SubExpItem[] {
  if (!expStr || !expStr.trim() || expStr === '-') return [];
  const parts = expStr.includes(',') ? expStr.split(',') : [expStr];
  const results: SubExpItem[] = [];
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

export function getItemSizes(item: { name: string; spec?: string; qty?: string; exp?: string }): string[] {
  const name = (item.name || '').toLowerCase();
  const spec = (item.spec || '').toLowerCase();
  const exp = item.exp || '';

  // 1. If exp has explicit sub-item labels (e.g. "สำลีก้อน: ..., ถุงมือ: ...")
  if (exp && exp.includes(':') && exp.includes(',')) {
    const subExps = parseSubExps(exp);
    const validLabels = subExps.map((s) => s.label).filter(Boolean);
    if (validLabels.length > 1) {
      return validLabels;
    }
  }

  // 2. Specific known dual / multi medical supply items
  if (name.includes('สำลีก้อน') || name.includes('ถุงมือ')) {
    return ['สำลีก้อน', 'ถุงมือ'];
  }
  if (name.includes('betadine') || name.includes('ammonia')) {
    return ['Betadine', 'Ammonia'];
  }
  if (name.includes('micropore') || name.includes('transpore')) {
    return ['Micropore', 'Transpore'];
  }
  if (name.includes('syringe blow cuff')) {
    return ['อันที่ 1', 'อันที่ 2'];
  }
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

  // 3. Multi-size equipment (e.g., Endotracheal tube No. 4, 5, 5.5, 6, 6.5, 7, 7.5 or Oral airway No. 2, 3, 4)
  const combined = `${item.name} ${item.spec || ''}`;
  const sizePattern = /(?:No\.|no\.|เบอร์|ขนาด)\s*([0-9.,\s/&]+)/i;
  const match = combined.match(sizePattern);
  if (match && match[1]) {
    const rawSizes = match[1].split(/[,/&]/).map((s: string) => s.trim()).filter((s: string) => /^\d+(\.\d+)?$/.test(s));
    if (rawSizes.length > 1) {
      return rawSizes.map((s: string) => `No.${s}`);
    }
  }

  // 4. Quantity with comma e.g. "1 แผง, 1 คู่" or "1, 1 ขวด"
  if (item.qty && item.qty.includes(',')) {
    const parts = item.qty.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((_, i) => `ชิ้นที่ ${i + 1}`);
    }
  }

  // 5. Quantity count > 1 (e.g., "2 อัน", "3 อัน", "4 เส้น") excluding fluid bags/bottles
  const isExcluded = name.includes('o2') || name.includes('oxygen') || name.includes('ถัง') || name.includes('psi') || name.includes('5% d/w') || name.includes('nss') || name.includes('water') || name.includes('alcohol');
  if (!isExcluded) {
    const qtyNum = parseInt(String(item.qty || '').replace(/\D/g, ''), 10);
    if (!isNaN(qtyNum) && qtyNum > 1 && qtyNum <= 10) {
      return Array.from({ length: qtyNum }, (_, i) => `ชิ้นที่ ${i + 1}`);
    }
  }

  return [];
}

export function parseSubItemStatuses(weekVal: string | undefined, subCount: number): string[] {
  if (subCount <= 1) {
    return [weekVal === '1' ? '1' : weekVal === '0' || weekVal === '✗' ? '0' : ''];
  }
  if (!weekVal || weekVal === '-') {
    return Array(subCount).fill('');
  }
  if (weekVal === '1' || weekVal === '✓') {
    return Array(subCount).fill('1');
  }
  if (weekVal === '0' || weekVal === '✗') {
    return Array(subCount).fill('0');
  }
  if (weekVal.includes(',')) {
    const parts = weekVal.split(',').map((p) => p.trim());
    return Array.from({ length: subCount }, (_, i) => (parts[i] !== undefined ? parts[i] : '1'));
  }
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

  // 1. Dynamic Weeks Per Month (4 or 5 weeks)
  const totalWeeksInMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay(); // 0-6
    const weeks = Math.ceil((numDays + firstDayOfWeek) / 7);
    return weeks === 4 ? 4 : 5;
  }, []);

  const availableWeeks = useMemo(() => {
    return totalWeeksInMonth === 4 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
  }, [totalWeeksInMonth]);

  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Ensure selectedWeek is within availableWeeks
  useEffect(() => {
    if (selectedWeek > totalWeeksInMonth) {
      setSelectedWeek(totalWeeksInMonth);
    }
  }, [totalWeeksInMonth, selectedWeek]);

  // Default Wednesday for each week automatically if not set
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const newDates = { ...weekDates };
    let updated = false;
    for (let wk = 1; wk <= totalWeeksInMonth; wk++) {
      if (!newDates[wk]) {
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay();
        const firstWedDate = 1 + ((3 - firstDayOfWeek + 7) % 7);
        const targetDate = firstWedDate + (wk - 1) * 7;
        const d = new Date(year, month, targetDate);
        const lastDay = new Date(year, month + 1, 0).getDate();
        const actualD = d.getDate() > lastDay || d.getMonth() !== month ? new Date(year, month, lastDay) : d;
        newDates[wk] = actualD.toISOString().split('T')[0];
        updated = true;
      }
    }
    if (updated) {
      onWeekDatesChange(newDates);
    }
  }, [totalWeeksInMonth]);

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
          groupName,
        });
      });
    });

    return itemsList;
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
      const subItems = getItemSizes(item);
      if (subItems.length > 1) {
        const subStat = parseSubItemStatuses(wkVal, subItems.length);
        return subStat.every((s) => s === '1');
      }
      return wkVal === '1' || c?.result === 'ปกติ';
    });
  }, [filteredItems, checks, selectedWeek]);

  const handleTogglePassAll = () => {
    if (areAllPassed) {
      filteredItems.forEach((item) => {
        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, '');
      });
    } else {
      filteredItems.forEach((item) => {
        onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, '1');
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
      
      {/* Scroll-based Auto-Hide Sticky Container */}
      <div
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
        className="sticky top-2 z-30 space-y-2.5 backdrop-blur-md bg-white/95 dark:bg-[#0E0F12]/95 p-1 rounded-[2rem] shadow-sm"
      >
        {/* 🌟 Clean One UI Royal Blue Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white p-3.5 sm:p-4 rounded-[1.8rem] border border-blue-400/30 shadow-md flex justify-between items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold transition cursor-pointer active:scale-95 border border-white/20 flex items-center justify-center"
              title="ย้อนกลับ"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1">
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

            {/* Render 5-Week Pass Button ONLY if totalWeeksInMonth === 5 */}
            {totalWeeksInMonth === 5 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('คุณต้องการทำเครื่องหมาย "ปกติ" ให้กับทุกรายการในทุกสัปดาห์ (1-5) ใช่หรือไม่?')) {
                    [1, 2, 3, 4, 5].forEach((wk) => {
                      allItems.forEach((item) => {
                        onToggleCheck(item.itemKey, 'ปกติ', item.name, wk, true);
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
          </div>
        </div>

        {/* 📅 Week Selector Bar (Dynamic 4 or 5 Weeks) */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
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
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  <span>สัปดาห์ที่ {wk}</span>
                  {selectedWeek === wk && <CheckCircle2 size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">วันที่ตรวจเช็ค (สัปดาห์ที่ {selectedWeek}):</span>
              <input
                type="date"
                value={weekDates[selectedWeek] || ''}
                onChange={(e) => handleDateChange(selectedWeek, e.target.value)}
                className="flex-1 min-w-[120px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-blue-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
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
                className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold border border-slate-200 transition active:scale-95 whitespace-nowrap"
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

      {/* 📋 Minimalist Clean Checklist Cards */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs shadow-xs">
            ไม่พบรายการอุปกรณ์ตรงตามคำค้นหา
          </div>
        ) : (
          filteredItems.map((item) => {
            const check = checks[item.itemKey];
            const weekVal = check?.weekVals?.[selectedWeek];
            const subItems = getItemSizes(item);
            const hasMultipleSubItems = subItems.length > 1;
            const subStatuses = parseSubItemStatuses(weekVal, subItems.length);

            const isOk = hasMultipleSubItems
              ? (weekVal ? subStatuses.every((s) => s === '1') : false)
              : (weekVal === '1' || check?.result === 'ปกติ');
            const isBad = hasMultipleSubItems
              ? (weekVal ? subStatuses.some((s) => s === '0' || s === '✗') : false)
              : (weekVal === '0' || check?.result === 'ผิดปกติ');

            const currentExp = check?.exp || item.exp || '';
            const subExps = parseSubExps(currentExp);

            // Handler for toggling single sub-item
            const handleToggleSubItem = (idx: number, targetStatus: '1' | '0') => {
              const nextStatuses = [...subStatuses];
              // If already targetStatus, toggle off/reset or keep
              if (nextStatuses[idx] === targetStatus) {
                nextStatuses[idx] = targetStatus === '1' ? '0' : '1';
              } else {
                nextStatuses[idx] = targetStatus;
              }
              // Fill any unselected sub-items with '1' if user has started checking
              const cleaned = nextStatuses.map((s) => (s === '0' ? '0' : '1'));
              const combinedStr = cleaned.join(', ');
              const hasProblem = cleaned.some((s) => s === '0');
              onToggleCheck(item.itemKey, hasProblem ? 'ผิดปกติ' : 'ปกติ', item.name, selectedWeek, true, combinedStr);
            };

            const handleMasterAllOk = () => {
              const allOk = Array(subItems.length).fill('1').join(', ');
              onToggleCheck(item.itemKey, 'ปกติ', item.name, selectedWeek, true, allOk);
            };

            const handleMasterAllBad = () => {
              const allBad = Array(subItems.length).fill('0').join(', ');
              onToggleCheck(item.itemKey, 'ผิดปกติ', item.name, selectedWeek, true, allBad);
            };

            return (
              <div
                key={item.itemKey}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 space-y-2.5 ${
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
                        {hasMultipleSubItems && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            {subItems.length} ชิ้นย่อย ({subStatuses.filter((s) => s === '1').length}/{subItems.length} ปกติ)
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
                      {item.name}
                    </h3>

                    {item.spec && (
                      <p className="text-xs text-slate-500 line-clamp-1 font-sans">{item.spec}</p>
                    )}

                    {/* Non-multi Single Item EXP Display */}
                    {!hasMultipleSubItems && item.exp && (
                      <div className="mt-1 flex items-center gap-2 border-l-2 border-rose-200 pl-2">
                        <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <span>⏳ EXP:</span>
                        </p>
                        <input
                          type="date"
                          value={currentExp}
                          onChange={(e) => onUpdateNote(item.itemKey, `EXP:${e.target.value}`)}
                          className="text-[10px] bg-white border border-rose-200 rounded px-1 py-0.5 text-rose-700 font-bold outline-none w-32 h-7"
                          title="ใส่วันหมดอายุ"
                        />
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
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                      <span>ตรวจเช็กแยกตามชิ้นย่อย / แต่ละเบอร์:</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        สัปดาห์ที่ {selectedWeek}
                      </span>
                    </div>

                    {/* Sub-item Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subItems.map((subLabel, idx) => {
                        const status = subStatuses[idx];
                        const isSubOk = status === '1';
                        const isSubBad = status === '0';
                        const matchedSubExp = subExps[idx]?.date || (subExps.find((s) => s.label?.includes(subLabel))?.date) || '';

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 transition ${
                              isSubBad
                                ? 'bg-rose-50 border-rose-200'
                                : isSubOk
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-black/20 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-800 line-clamp-1" title={subLabel}>
                                {subLabel}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubItem(idx, '1')}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                                    isSubOk
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-emerald-100'
                                  }`}
                                  title="ตรวจแล้ว ปกติ (1)"
                                >
                                  <Check size={12} strokeWidth={3} />
                                  <span>1</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubItem(idx, '0')}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                                    isSubBad
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-rose-100'
                                  }`}
                                  title="ตรวจแล้ว มีปัญหา/ขาด (0)"
                                >
                                  <X size={12} strokeWidth={3} />
                                  <span>0</span>
                                </button>
                              </div>
                            </div>

                            {/* Sub-item EXP Date Picker if applicable */}
                            {(item.exp || subExps.length > 0) && (
                              <div className="flex items-center gap-1 pt-1 border-t border-slate-200/60 text-[10px]">
                                <span className="text-slate-500 font-semibold shrink-0">EXP:</span>
                                <input
                                  type="date"
                                  value={matchedSubExp}
                                  onChange={(e) => {
                                    const newSubExps = subExps.length >= subItems.length
                                      ? [...subExps]
                                      : subItems.map((lbl, i) => ({ label: lbl, date: subExps[i]?.date || '' }));
                                    newSubExps[idx] = { label: subLabel, date: e.target.value };
                                    const combined = newSubExps
                                      .map((s) => (s.label ? `${s.label.trim()}: ${s.date}` : s.date))
                                      .filter(Boolean)
                                      .join(', ');
                                    onUpdateNote(item.itemKey, `EXP:${combined}`);
                                  }}
                                  className="flex-1 bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] text-rose-700 font-bold outline-none h-6"
                                />
                              </div>
                            )}
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

                  {/* O2 Tank PSI Input (Special handling) */}
                  {((item.name.toLowerCase().includes('o2') || item.name.toLowerCase().includes('oxygen') || item.name.includes('ออกซิเจน')) && (item.name.toLowerCase().includes('tank') || item.name.includes('ถัง'))) && (
                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-xl border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-800 shrink-0">ความดัน (PSI):</span>
                      <input
                        type="text"
                        value={check?.weekVals?.[selectedWeek] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = parseInt(val.replace(/\D/g, ''), 10);
                          const result = !isNaN(num) && num >= 500 ? 'ปกติ' : (val ? 'ผิดปกติ' : '');
                          // Pass PSI string as customValue to be stored in weekVals
                          onToggleCheck(item.itemKey, result === 'ปกติ' ? 'ปกติ' : 'ผิดปกติ', item.name, selectedWeek, true, val.toLowerCase().includes('psi') ? val : `${val} PSI`);
                          onUpdateNote(item.itemKey, `PSI:${val}`);
                        }}
                        placeholder="ระบุ PSI เช่น 1350"
                        className="flex-1 bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-900 outline-none"
                      />
                      {check?.weekVals?.[selectedWeek] && (
                        <span className={`text-[10px] font-bold ${parseInt(String(check?.weekVals?.[selectedWeek]).replace(/\D/g, ''), 10) >= 500 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {parseInt(String(check?.weekVals?.[selectedWeek]).replace(/\D/g, ''), 10) >= 500 ? '✓ ผ่าน' : '✗ ต่ำ'}
                        </span>
                      )}
                    </div>
                  )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-blue-600" />
                <span>เพิ่มรายการอุปกรณ์ ({type === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'})</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ชื่อรายการอุปกรณ์ <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="เช่น Laryngoscope set, Ambu bag, 0.9% NSS"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">หมวดหมู่ / ชั้นวาง <span className="text-rose-500">*</span></label>
                <select
                  value={newItemGroup}
                  onChange={(e) => setNewItemGroup(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="__custom__">+ สร้างหมวดหมู่ใหม่...</option>
                </select>
                {newItemGroup === '__custom__' && (
                  <input
                    type="text"
                    value={customGroup}
                    onChange={(e) => setCustomGroup(e.target.value)}
                    placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..."
                    className="w-full mt-2 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">จำนวนตั้งต้น</label>
                  <input
                    type="text"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="เช่น 1 หรือ 1, 1"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">วันหมดอายุ (EXP)</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemNoExp}
                        onChange={(e) => setNewItemNoExp(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>ไม่มีวันหมดอายุ</span>
                    </label>
                  </div>
                  {newItemNoExp ? (
                    <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold text-center">
                      ไม่มีวันหมดอายุ (แสดงเป็น "-")
                    </div>
                  ) : modalSizes.length > 1 ? (
                    <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold mb-1 italic">ระบุวันหมดอายุแยกตามชิ้น/ไซส์:</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {modalSizes.map((sz: string) => (
                          <div key={sz} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 min-w-[45px]">{sz}:</span>
                            <input
                              type="date"
                              value={newItemExpParts[sz] || ''}
                              onChange={(e) => setNewItemExpParts({ ...newItemExpParts, [sz]: e.target.value })}
                              className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-[11px] outline-none focus:border-blue-500 h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={newItemExp}
                      onChange={(e) => setNewItemExp(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 h-10"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">คุณลักษณะ / สเปกเพิ่มเติม</label>
                <input
                  type="text"
                  value={newItemSpec}
                  onChange={(e) => setNewItemSpec(e.target.value)}
                  placeholder="เช่น ขนาด No. 3, 4 หรือ ชนิดพร้อมใช้"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* 📷 รูปภาพอุปกรณ์ + Local File Upload */}
              <div className="space-y-1 pt-1">
                <label className="block text-slate-700 font-bold">รูปภาพอุปกรณ์</label>
                
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newItemImgUrl}
                      onChange={(e) => setNewItemImgUrl(e.target.value)}
                      placeholder="วาง URL รูปภาพ..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:border-blue-500"
                    />
                    <ImageIcon size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Local File Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 flex items-center gap-1 shrink-0 transition cursor-pointer"
                    title="เลือกไฟล์รูปภาพจากเครื่องมือถือหรือคอมพิวเตอร์"
                  >
                    <Upload size={14} />
                    <span>อัปโหลด</span>
                  </button>
                </div>

                {newItemImgUrl && (
                  <div className="mt-2 flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <img src={newItemImgUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-300" />
                    <span className="text-[11px] text-emerald-700 font-bold">✓ โหลดรูปภาพสำเร็จ</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal แก้ไขรายการอุปกรณ์ */}
      {isEditModalOpen && itemToEdit && (
        <EditItemModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          item={itemToEdit as any}
          groups={groups}
          onSave={handleSaveEdit}
          onDelete={handleDeleteItemInEdit}
        />
      )}
    </div>
  );
};
