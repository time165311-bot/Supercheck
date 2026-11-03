import React, { useState, useRef } from 'react';
import { X, Save, Trash2, Upload, Image as ImageIcon, Plus, Minus } from 'lucide-react';
import { EquipmentItem } from '../types';

interface SubExpField {
  id: string;
  label: string;
  date: string;
  qty: string | number;
}

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EquipmentItem;
  groups: string[];
  onSave: (updatedItem: EquipmentItem) => void;
  onDelete: (itemId: string) => void;
}

function toIsoDate(str?: string): string {
  if (!str) return '';
  const s = str.trim();
  if (!s || s === '-') return '';
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
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState(item.name || '');
  const [category, setCategory] = useState(item.location || item.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [spec, setSpec] = useState(item.spec || '');
  const [qty, setQty] = useState(item.qty || '1');
  const [img, setImg] = useState(item.img || '');
  const [noExp, setNoExp] = useState<boolean>(item.exp === '-' || !item.exp);

  // Dynamic Sub-EXP State with individual quantities
  const [subExps, setSubExps] = useState<SubExpField[]>(() => {
    const fields: SubExpField[] = [];
    const expStr = item.exp || '';
    const storedSubQuantities = item.subItemQuantities || [];

    if (item.subExps && item.subExps.length > 0) {
      item.subExps.forEach((se, idx) => {
        fields.push({
          id: `sub_${idx}_${Date.now()}`,
          label: se.label || `ชิ้นที่ ${idx + 1}`,
          date: toIsoDate(se.exp),
          qty: se.qty || storedSubQuantities[idx] || 1,
        });
      });
      return fields;
    }

    if (expStr && expStr.trim() && expStr !== '-') {
      const parts = expStr.includes(',') ? expStr.split(',') : [expStr];
      parts.forEach((p, idx) => {
        const trimmed = p.trim();
        if (!trimmed) return;
        const initialQty = storedSubQuantities[idx] !== undefined ? storedSubQuantities[idx] : 1;

        if (trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          const l = trimmed.substring(0, colonIdx).trim();
          const d = trimmed.substring(colonIdx + 1).trim();
          fields.push({
            id: `sub_${idx}_${Date.now()}`,
            label: l,
            date: toIsoDate(d),
            qty: initialQty,
          });
        } else {
          fields.push({
            id: `sub_${idx}_${Date.now()}`,
            label: parts.length > 1 ? `ชิ้นที่ ${idx + 1}` : '',
            date: toIsoDate(trimmed),
            qty: initialQty,
          });
        }
      });
    }

    // Fallback if item has subItemQuantities array without explicit subExps string
    if (fields.length === 0 && storedSubQuantities.length > 1) {
      storedSubQuantities.forEach((q, idx) => {
        fields.push({
          id: `sub_${idx}_${Date.now()}`,
          label: `รายการย่อยที่ ${idx + 1}`,
          date: '',
          qty: q,
        });
      });
    }

    return fields;
  });

  // Single EXP date state (fallback if subExps is empty)
  const [singleExp, setSingleExp] = useState<string>(() => {
    if (!item.exp || item.exp.includes(',') || item.exp.includes(':')) return '';
    return toIsoDate(item.exp);
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddSubExp = () => {
    if (subExps.length === 0) {
      if (singleExp) {
        setSubExps([
          { id: `sub_${Date.now()}_1`, label: 'ชิ้นที่ 1', date: singleExp, qty: 1 },
          { id: `sub_${Date.now()}_2`, label: 'ชิ้นที่ 2', date: '', qty: 1 },
        ]);
      } else {
        setSubExps([
          { id: `sub_${Date.now()}_1`, label: 'ชิ้นที่ 1', date: '', qty: 1 },
          { id: `sub_${Date.now()}_2`, label: 'ชิ้นที่ 2', date: '', qty: 1 },
        ]);
      }
    } else {
      setSubExps((prev) => [
        ...prev,
        { id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, label: `ชิ้นที่ ${prev.length + 1}`, date: '', qty: 1 },
      ]);
    }
  };

  const handleRemoveSubExp = (id: string) => {
    setSubExps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubExpChange = (id: string, field: 'label' | 'date' | 'qty', val: string | number) => {
    setSubExps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณากรอกชื่อรายการอุปกรณ์');
      return;
    }

    const finalCategory = category === '__custom__' ? customCategory.trim() : category;

    let finalExp = '';
    let finalSubQuantities: number[] = [];

    if (noExp) {
      finalExp = '-';
    } else if (subExps.length > 0) {
      finalExp = subExps
        .filter((s) => s.date || s.label)
        .map((s) => (s.label ? `${s.label.trim()}: ${s.date}` : s.date))
        .join(', ');
      finalSubQuantities = subExps.map((s) => {
        const parsed = parseInt(String(s.qty || '1').replace(/\D/g, ''), 10);
        return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
      });
    } else {
      finalExp = singleExp;
    }

    let finalQtyString = qty.trim();
    if (finalSubQuantities.length > 1) {
      finalQtyString = finalSubQuantities.join(', ');
    }

    onSave({
      ...item,
      name: name.trim(),
      location: finalCategory,
      category: finalCategory,
      spec: spec.trim(),
      qty: finalQtyString,
      exp: finalExp,
      img: img.trim(),
      subItemQuantities: finalSubQuantities.length > 0 ? finalSubQuantities : undefined,
      subExps: subExps.map((s) => ({
        label: s.label.trim(),
        exp: s.date,
        qty: parseInt(String(s.qty || '1').replace(/\D/g, ''), 10) || 1,
      })),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#181A20] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-white/5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-blue-500">✏️</span>
            <span>แก้ไขรายการอุปกรณ์</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              ชื่อรายการอุปกรณ์ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-bold"
              required
            />
          </div>

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
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                จำนวนตั้งต้น
              </label>
              <input
                type="text"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                คุณลักษณะ / สเปกเพิ่มเติม
              </label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Dynamic Sub-EXP Section */}
          <div className="space-y-2 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">
                วันหมดอายุ (EXP)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-blue-600 dark:text-blue-400">
                <input
                  type="checkbox"
                  checked={noExp}
                  onChange={(e) => setNoExp(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600"
                />
                <span>ไม่มีวันหมดอายุ (No EXP)</span>
              </label>
            </div>

            {!noExp && (
              <>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddSubExp}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-blue-200 dark:border-blue-500/20"
                  >
                    <Plus size={13} className="stroke-[2.5]" />
                    <span>+ เพิ่มวันหมดอายุย่อย</span>
                  </button>
                </div>

                {subExps.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold italic">
                      ระบุชื่อกำกับ, วันหมดอายุ และจำนวนตั้งต้นของแต่ละรายการย่อย:
                    </p>
                    {subExps.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-1.5 bg-white dark:bg-black/30 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-2xs">
                        <input
                          type="text"
                          value={sub.label}
                          onChange={(e) => handleSubExpChange(sub.id, 'label', e.target.value)}
                          placeholder="ชื่อกำกับ (เช่น No.18, 100 cc)"
                          className="w-24 sm:w-28 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-[11px] text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold shrink-0"
                        />
                        <input
                          type="date"
                          value={sub.date}
                          onChange={(e) => handleSubExpChange(sub.id, 'date', e.target.value)}
                          className="flex-1 min-w-[100px] px-2 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-[11px] text-slate-900 dark:text-white outline-none focus:border-blue-500 h-8 font-bold"
                        />
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/10 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 shrink-0">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">จำนวณ:</span>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={sub.qty || 1}
                            onChange={(e) => handleSubExpChange(sub.id, 'qty', e.target.value)}
                            className="w-10 text-center bg-transparent border-0 font-bold text-xs text-blue-600 dark:text-blue-400 outline-none"
                            title="จำนวนตั้งต้นของรายการย่อยนี้"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubExp(sub.id)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer shrink-0"
                          title="- ลบรายการย่อยนี้"
                        >
                          <Minus size={14} className="stroke-[2.5]" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="date"
                      value={singleExp}
                      onChange={(e) => setSingleExp(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 h-9 font-bold text-xs"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">รูปภาพอุปกรณ์</label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={img}
                  onChange={(e) => setImg(e.target.value)}
                  placeholder="วาง URL รูปภาพ..."
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white text-[11px] outline-none focus:border-blue-500"
                />
                <ImageIcon size={14} className="absolute left-2.5 top-3 text-slate-400" />
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
                className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-bold text-[11px] border border-slate-200 dark:border-white/10 flex items-center gap-1 shrink-0 transition cursor-pointer"
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

          <div className="pt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                if (confirm(`คุณต้องการลบรายการ "${name}" ออกจากระบบใช่หรือไม่?`)) {
                  onDelete(item.id || '');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold transition cursor-pointer"
            >
              <Trash2 size={15} />
              <span>ลบรายการ</span>
            </button>

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
                <Save size={15} />
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
