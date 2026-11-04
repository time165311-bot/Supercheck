import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Save, Trash2, Upload, Image as ImageIcon, Plus, Minus, Layers, Hash, Calendar } from 'lucide-react';
import { EquipmentItem } from '../types';
import { getItemSubItemsInfo, getItemSizes } from '../utils/itemUtils';

export interface SubExpField {
  id: string;
  label: string;
  date: string;
  qty: number | string;
  hasNoExp?: boolean;
}

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: EquipmentItem | null;
  groups: string[];
  mode?: 'add' | 'edit';
  type?: 'bag' | 'cart';
  onSave: (updatedItem: EquipmentItem) => void;
  onDelete?: (itemId: string) => void;
}

function toIsoDate(str?: string): string {
  if (!str) return '';
  const s = str.trim();
  if (!s || s === '-' || s.toLowerCase() === 'no exp') return '';
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    if (y > 2400) y -= 543;
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let y = parseInt(dmyMatch[3], 10);
    if (y > 2400) y -= 543;
    return `${y}-${m}-${d}`;
  }
  return s;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  onClose,
  item,
  groups,
  mode,
  type = 'cart',
  onSave,
  onDelete,
}) => {
  const isAddMode = mode === 'add' || !item || !item.id;

  // Form Fields
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(
    item?.location || item?.category || (groups.length > 0 ? groups[0] : 'ทั่วไป')
  );
  const [customCategory, setCustomCategory] = useState('');
  const [spec, setSpec] = useState(item?.spec || '');
  const [img, setImg] = useState(item?.img || '');

  // Check Type Selector:
  // 'single': แบบที่ 1 ตรวจเช็กรวมตามจำนวนตั้งต้นปกติ (Single Count)
  // 'sub_items': แบบที่ 2 ตรวจเช็กแยกตามชิ้นย่อย / แต่ละเบอร์ 4 สัปดาห์ (Multiple Sub-items / Weekly Batches)
  const initialCheckType = useMemo<'single' | 'sub_items'>(() => {
    if (item?.checkType) return item.checkType;
    if (item) {
      if (item.subItems && item.subItems.length > 1) return 'sub_items';
      if (item.subExps && item.subExps.length > 1) return 'sub_items';
      const sizes = getItemSizes(item);
      if (sizes.length > 1) return 'sub_items';
    }
    return 'single';
  }, [item]);

  const [checkType, setCheckType] = useState<'single' | 'sub_items'>(initialCheckType);

  // Single Count fields (แบบที่ 1)
  const [qty, setQty] = useState<string>(() => {
    if (item?.qty !== undefined && item?.qty !== null) return String(item.qty);
    return '1';
  });
  const [noExp, setNoExp] = useState<boolean>(() => {
    if (!item?.exp) return false;
    const expStr = item.exp.trim();
    return expStr === '-' || expStr.toLowerCase() === 'no exp' || !expStr.match(/^\d{4}-\d{2}-\d{2}$/);
  });
  const [singleExp, setSingleExp] = useState<string>(() => {
    if (!item?.exp) return '-';
    const expStr = item.exp.trim();
    if (expStr.includes(',') || expStr.includes(':')) return '';
    if (expStr === '-' || expStr.toLowerCase() === 'no exp') return '-';
    if (!expStr.match(/^\d{4}-\d{2}-\d{2}$/)) return expStr;
    return toIsoDate(expStr);
  });

  // Multiple Sub-items fields (แบบที่ 2)
  const [subExps, setSubExps] = useState<SubExpField[]>(() => {
    if (!item) {
      return [
        { id: `sub_${Date.now()}_1`, label: 'เบอร์ 1', date: '', qty: 1, hasNoExp: false },
        { id: `sub_${Date.now()}_2`, label: 'เบอร์ 2', date: '', qty: 1, hasNoExp: false },
      ];
    }

    const fields: SubExpField[] = [];
    const info = getItemSubItemsInfo(item);

    if (info.isMulti) {
      info.subItems.forEach((se, idx) => {
        const isNoExp = se.hasNoExp ?? (!se.date || se.date === '-' || se.date.toLowerCase() === 'no exp' || !se.date.match(/^\d{4}-\d{2}-\d{2}$/));
        fields.push({
          id: `sub_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          label: se.label,
          date: isNoExp ? (se.date || '-') : toIsoDate(se.date),
          qty: se.qty,
          hasNoExp: isNoExp,
        });
      });
      return fields;
    }

    const expStr = item.exp || '';
    if (expStr && expStr.trim() && expStr !== '-') {
      const parts = expStr.includes(',') ? expStr.split(',') : [expStr];
      if (parts.length > 1) {
        parts.forEach((p, idx) => {
          const trimmed = p.trim();
          if (!trimmed) return;
          if (trimmed.includes(':')) {
            const colonIdx = trimmed.indexOf(':');
            const rawDate = trimmed.substring(colonIdx + 1).trim();
            const isNoExp = !rawDate || rawDate === '-' || rawDate.toLowerCase() === 'no exp';
            fields.push({
              id: `sub_${idx}_${Date.now()}_${idx}`,
              label: trimmed.substring(0, colonIdx).trim(),
              date: isNoExp ? '' : toIsoDate(rawDate),
              qty: info.quantities[idx] || 1,
              hasNoExp: isNoExp,
            });
          } else {
            const isNoExp = !trimmed || trimmed === '-' || trimmed.toLowerCase() === 'no exp';
            fields.push({
              id: `sub_${idx}_${Date.now()}_${idx}`,
              label: `ชิ้นที่ ${idx + 1}`,
              date: isNoExp ? '' : toIsoDate(trimmed),
              qty: info.quantities[idx] || 1,
              hasNoExp: isNoExp,
            });
          }
        });
        return fields;
      }
    }

    // Default template for sub-items
    return [
      { id: `sub_${Date.now()}_1`, label: 'เบอร์ 1', date: '', qty: 1, hasNoExp: false },
      { id: `sub_${Date.now()}_2`, label: 'เบอร์ 2', date: '', qty: 1, hasNoExp: false },
    ];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify system when modal opens/closes to hide bottom bar and floating buttons on mobile
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('modal_state_change', { detail: { open: true } }));
    } else {
      window.dispatchEvent(new CustomEvent('modal_state_change', { detail: { open: false } }));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('modal_state_change', { detail: { open: false } }));
    };
  }, [isOpen]);

  // Sync state if item prop changes
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setCategory(item.location || item.category || (groups[0] || 'ทั่วไป'));
      setSpec(item.spec || '');
      setImg(item.img || '');
      setQty(item.qty !== undefined && item.qty !== null ? String(item.qty) : '1');
      setNoExp(item.exp === '-' || !item.exp || item.exp.toLowerCase() === 'no exp');
      if (item.exp && !item.exp.includes(',') && !item.exp.includes(':')) {
        setSingleExp(toIsoDate(item.exp));
      }
    }
  }, [item, groups]);

  // Add new sub-item / size row
  const handleAddSubExp = () => {
    const nextIndex = subExps.length + 1;
    setSubExps((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: `เบอร์ ${nextIndex}`,
        date: '',
        qty: 1,
        hasNoExp: false,
      },
    ]);
  };

  const handleRemoveSubExp = (id: string) => {
    if (subExps.length <= 1) {
      alert('ต้องมีรายการย่อยอย่างน้อย 1 รายการ');
      return;
    }
    setSubExps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubExpChange = (id: string, field: 'label' | 'date' | 'qty', val: string | number) => {
    setSubExps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleSubExpNoExpToggle = (id: string, checked: boolean) => {
    setSubExps((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              hasNoExp: checked,
              date: checked ? (s.date === '' || s.date.match(/^\d{4}-\d{2}-\d{2}$/) ? '-' : s.date) : '',
            }
          : s
      )
    );
  };

  // Image Upload Handler
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
        if (base64Str) setImg(base64Str);
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate total quantities for summary
  const totalSubQty = useMemo(() => {
    return subExps.reduce((acc, s) => {
      const q = parseInt(String(s.qty || '1').replace(/\D/g, ''), 10) || 1;
      return acc + q;
    }, 0);
  }, [subExps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณากรอกชื่อรายการอุปกรณ์');
      return;
    }

    const finalCategory = category === '__custom__' ? customCategory.trim() : category;
    if (!finalCategory) {
      alert('กรุณาเลือกหรือระบุหมวดหมู่/ชั้นวาง');
      return;
    }

    if (checkType === 'single') {
      // แบบที่ 1: ตรวจเช็กรวมตามจำนวนตั้งต้นปกติ (Single Count) - บันทึกสตริงข้อความเต็มตามที่ผู้ใช้พิมพ์โดยตรง
      const finalQty = qty.trim() || '1';
      const finalExp = noExp ? (singleExp.trim() || '-') : (singleExp ? singleExp.trim() : '-');

      onSave({
        ...(item || {}),
        name: name.trim(),
        location: finalCategory,
        category: finalCategory,
        spec: spec.trim(),
        qty: finalQty,
        exp: finalExp,
        img: img.trim(),
        checkType: 'single',
        subItems: [],
        subExps: [],
        subItemQuantities: [],
      });
    } else {
      // แบบที่ 2: ตรวจเช็กแยกตามชิ้นย่อย / แต่ละเบอร์ 4 สัปดาห์ (Multiple Sub-items / Weekly Batches)
      const validSubExps = subExps.length > 0 ? subExps : [
        { id: '1', label: 'ชิ้นที่ 1', date: '', qty: 1, hasNoExp: false },
      ];

      const cleanSubExps = validSubExps.map((s, idx) => {
        const lbl = s.label.trim() || `ชิ้นที่ ${idx + 1}`;
        const isNoExp = !!s.hasNoExp || !s.date || s.date === '-' || s.date.toLowerCase() === 'no exp';
        const parsedQ = parseInt(String(s.qty || '1').replace(/\D/g, ''), 10) || 1;
        return {
          label: lbl,
          exp: isNoExp ? '-' : s.date.trim(),
          qty: parsedQ,
          hasNoExp: isNoExp,
        };
      });

      const subLabels = cleanSubExps.map((s) => s.label);
      const subQuantities = cleanSubExps.map((s) => s.qty);
      const combinedExp = cleanSubExps.map((s) => `${s.label}: ${s.exp}`).join(', ');
      const totalCount = subQuantities.reduce((a, b) => a + b, 0);
      const combinedQty = subQuantities.length > 1 ? subQuantities.join(', ') : String(totalCount);

      onSave({
        ...(item || {}),
        name: name.trim(),
        location: finalCategory,
        category: finalCategory,
        spec: spec.trim(),
        qty: combinedQty,
        exp: combinedExp,
        img: img.trim(),
        checkType: 'sub_items',
        subItems: subLabels,
        subExps: cleanSubExps,
        subItemQuantities: subQuantities,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#181A20] rounded-t-[2.5rem] sm:rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[88vh] flex flex-col font-sans overflow-hidden">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mt-3 shrink-0" />

        {/* Modal Header */}
        <div className="flex justify-between items-center px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#181A20] z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
              {isAddMode ? '➕' : '✏️'}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {isAddMode
                  ? `เพิ่มรายการอุปกรณ์ (${type === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'})`
                  : 'แก้ไขรายการอุปกรณ์'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAddMode ? 'กำหนดข้อมูลและรูปแบบการตรวจเช็ก 4 สัปดาห์' : 'ปรับปรุงข้อมูลรายการอุปกรณ์และวันหมดอายุ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs min-h-0">
            {/* 1. Item Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                ชื่อรายการอุปกรณ์ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Laryngoscope set, Ambu bag, IV Catheter, 0.9% NSS"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-bold"
                required
              />
            </div>

            {/* 2. Category / Shelf Group */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                หมวดหมู่ / ชั้นวาง <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-bold"
              >
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
                <option value="__custom__">+ สร้างหมวดหมู่ใหม่...</option>
              </select>
              {category === '__custom__' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..."
                  className="w-full mt-2 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold"
                  required
                />
              )}
            </div>

            {/* 3. รูปแบบการตรวจเช็ก (Check Type Selector) */}
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
              <label className="block text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                <span className="text-blue-600 dark:text-blue-400">⚙️</span>
                <span>รูปแบบการตรวจเช็ก (Check Type)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Option 1: Single Count */}
                <button
                  type="button"
                  onClick={() => setCheckType('single')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    checkType === 'single'
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Hash size={14} className={checkType === 'single' ? 'text-blue-600' : 'text-slate-400'} />
                      <span>แบบที่ 1: ตรวจเช็กรวม</span>
                    </span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      checkType === 'single' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                    }`}>
                      {checkType === 'single' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    นับรวมตามยอด เช่น 4 ชิ้น (แสดงปุ่ม -, + และสถานะเป้าหมาย 4/4 ในสัปดาห์)
                  </p>
                </button>

                {/* Option 2: Multiple Sub-items */}
                <button
                  type="button"
                  onClick={() => setCheckType('sub_items')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    checkType === 'sub_items'
                      ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 text-purple-950 dark:text-purple-100 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Layers size={14} className={checkType === 'sub_items' ? 'text-purple-600' : 'text-slate-400'} />
                      <span>แบบที่ 2: แยกตามชิ้นย่อย</span>
                    </span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      checkType === 'sub_items' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                    }`}>
                      {checkType === 'sub_items' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    แยกชิ้นย่อย/แต่ละเบอร์ 4 สัปดาห์ และระบุ EXP แยกอิสระแต่ละชิ้น
                  </p>
                </button>
              </div>
            </div>

            {/* 4. DETAILS SECTION BASED ON CHECK TYPE */}
            {checkType === 'single' ? (
              /* --- แบบที่ 1: ตรวจเช็กรวมตามจำนวนตั้งต้นปกติ (Single Count) --- */
              <div className="space-y-3.5 p-3.5 bg-white dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      จำนวนตั้งต้น (Target Quantity)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="เช่น 1 ห่อ 1 คู่, 1, 1, 2 ขวด, 3 อัน"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold text-sm"
                      />
                      {/* Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold">ยอดด่วน:</span>
                        {['1', '2', '3', '4', '5', '10'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setQty(p)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                              qty === p
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      คุณลักษณะ / สเปกเพิ่มเติม
                    </label>
                    <input
                      type="text"
                      value={spec}
                      onChange={(e) => setSpec(e.target.value)}
                      placeholder="เช่น พร้อมใช้งาน, ขนาดมาตรฐาน"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Single EXP Picker */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                      <Calendar size={13} className="text-rose-500" />
                      <span>วันหมดอายุ (EXP)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      <input
                        type="checkbox"
                        checked={noExp}
                        onChange={(e) => setNoExp(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                      />
                      <span>ไม่มีวันหมดอายุ (No EXP)</span>
                    </label>
                  </div>

                  {noExp ? (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">ระบุข้อความ EXP พิมพ์อิสระ (เช่น -, ไม่ระบุ):</label>
                      <input
                        type="text"
                        value={singleExp}
                        onChange={(e) => setSingleExp(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 text-xs font-bold"
                        placeholder="เช่น - หรือ ไม่ระบุวันหมดอายุ"
                      />
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={singleExp}
                      onChange={(e) => setSingleExp(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 h-10 font-bold"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* --- แบบที่ 2: ตรวจเช็กแยกตามชิ้นย่อย / แต่ละเบอร์ 4 สัปดาห์ (Multiple Sub-items) --- */
              <div className="space-y-3.5 p-3.5 bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-500/20 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-purple-200/60 dark:border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-white text-xs">
                      รายการชิ้นย่อย / แต่ละเบอร์
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                      {subExps.length} รายการ (รวม {totalSubQty} ชิ้น)
                    </span>
                  </div>

                  {/* Button + เพิ่มชิ้นย่อย/เบอร์ */}
                  <button
                    type="button"
                    onClick={handleAddSubExp}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    <span>+ เพิ่มชิ้นย่อย/เบอร์</span>
                  </button>
                </div>

                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  ระบุชื่อย่อย/เบอร์, จำนวนตั้งต้นของชิ้นนั้น และวันหมดอายุ (EXP) ของแต่ละชิ้นได้แยกกันอย่างอิสระ:
                </p>

                {/* Sub-items List */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-0.5">
                  {subExps.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="p-3 bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2 hover:border-purple-300 transition"
                    >
                      {/* Sub-item Row 1: Label & Quantity Stepper */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 min-w-[20px] text-center">
                          #{idx + 1}
                        </span>

                        <input
                          type="text"
                          value={sub.label}
                          onChange={(e) => handleSubExpChange(sub.id, 'label', e.target.value)}
                          placeholder="ชื่อย่อย/เบอร์ เช่น เบอร์ 3.0, ชิ้นที่ 1"
                          className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-[11px] text-slate-900 dark:text-white outline-none focus:border-purple-500 font-bold"
                          required
                        />

                        {/* Qty Stepper */}
                        <div className="flex items-center bg-slate-100 dark:bg-white/10 rounded-lg p-0.5 border border-slate-200 dark:border-white/10 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(String(sub.qty || '1'), 10) || 1;
                              if (curr > 1) handleSubExpChange(sub.id, 'qty', curr - 1);
                            }}
                            className="w-6 h-6 rounded bg-white dark:bg-black/30 hover:bg-slate-200 text-slate-700 dark:text-white flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95"
                            title="ลดจำนวน"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-purple-700 dark:text-purple-300">
                            {sub.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const curr = parseInt(String(sub.qty || '1'), 10) || 1;
                              handleSubExpChange(sub.id, 'qty', curr + 1);
                            }}
                            className="w-6 h-6 rounded bg-white dark:bg-black/30 hover:bg-slate-200 text-slate-700 dark:text-white flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95"
                            title="เพิ่มจำนวน"
                          >
                            +
                          </button>
                        </div>

                        {/* Delete sub-item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubExp(sub.id)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer shrink-0"
                          title="ลบชิ้นย่อยนี้"
                        >
                          <Minus size={14} className="stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Sub-item Row 2: EXP Date Picker + No EXP Toggle */}
                      <div className="flex items-center gap-2 pl-6">
                        {sub.hasNoExp ? (
                          <input
                            type="text"
                            value={sub.date}
                            onChange={(e) => handleSubExpChange(sub.id, 'date', e.target.value)}
                            placeholder="ระบุข้อความ EXP เช่น -, ไม่ระบุ, ดูข้างถัง"
                            className="flex-1 min-w-[120px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/20 text-[11px] text-slate-700 dark:text-white outline-none focus:border-purple-500 h-8 font-bold"
                          />
                        ) : (
                          <input
                            type="date"
                            value={sub.date}
                            onChange={(e) => handleSubExpChange(sub.id, 'date', e.target.value)}
                            className="flex-1 min-w-[120px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-[11px] text-slate-900 dark:text-white outline-none focus:border-purple-500 h-8 font-bold"
                          />
                        )}

                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10.5px] font-bold text-slate-700 dark:text-slate-300 shrink-0 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition">
                          <input
                            type="checkbox"
                            checked={!!sub.hasNoExp}
                            onChange={(e) => handleSubExpNoExpToggle(sub.id, e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                          />
                          <span>No EXP</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sub-items Spec Field */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    คุณลักษณะ / สเปกเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="เช่น ชุดพร้อมใช้, เบอร์มาตรฐานสำหรับผู้ใหญ่/เด็ก"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}

            {/* 5. Image Section */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">รูปภาพอุปกรณ์</label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={img}
                    onChange={(e) => setImg(e.target.value)}
                    placeholder="วาง URL รูปภาพ..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-[11px] outline-none focus:border-blue-500"
                  />
                  <ImageIcon size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-bold text-[11px] border border-slate-200 dark:border-white/10 flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  <Upload size={14} />
                  <span>อัปโหลด</span>
                </button>
              </div>

              {img && (
                <div className="mt-2 flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <img src={img} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-white/20" />
                  <span className="text-[10px] text-emerald-600 font-bold">✓ พรีวิวรูปภาพสำเร็จ</span>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Action Footer (Mobile Keyboard Friendly) */}
          <div className="sticky bottom-0 bg-white dark:bg-[#181A20] z-[100] border-t border-slate-100 dark:border-white/5 px-5 py-3 shadow-md flex items-center justify-between shrink-0">
            {!isAddMode && onDelete && item?.id ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`คุณต้องการลบรายการ "${name}" ออกจากระบบใช่หรือไม่?`)) {
                    onDelete(item.id!);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold transition cursor-pointer"
              >
                <Trash2 size={15} />
                <span>ลบรายการ</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white font-bold transition cursor-pointer hover:bg-slate-200 dark:hover:bg-white/20"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md cursor-pointer active:scale-95"
              >
                {isAddMode ? <Plus size={15} className="stroke-[2.5]" /> : <Save size={15} />}
                <span>{isAddMode ? 'บันทึกรายการ' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
