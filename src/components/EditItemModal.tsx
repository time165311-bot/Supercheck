import React, { useState, useRef, useMemo } from 'react';
import { X, Save, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { EquipmentItem } from '../types';
import { getItemSizes } from './EmergencyChecklistView';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EquipmentItem;
  groups: string[];
  onSave: (updatedItem: EquipmentItem) => void;
  onDelete: (itemId: string) => void;
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
  const [exp, setExp] = useState(item.exp || '');
  const [img, setImg] = useState(item.img || '');
  const [expParts, setExpParts] = useState<Record<string, string>>(() => {
    const parts: Record<string, string> = {};
    if (item.exp && item.exp.includes(':')) {
      item.exp.split(',').forEach(p => {
        const [sz, dt] = p.split(':').map(s => s.trim());
        if (sz && dt) parts[sz] = dt;
      });
    }
    return parts;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizes = useMemo(() => {
    return getItemSizes({ name, spec, qty });
  }, [name, spec, qty]);

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
    
    const finalExp = sizes.length > 1
      ? sizes.filter(s => expParts[s]).map(s => `${s}:${expParts[s]}`).join(', ')
      : exp;

    onSave({
      ...item,
      name: name.trim(),
      location: finalCategory,
      category: finalCategory,
      spec: spec.trim(),
      qty: qty.trim(),
      exp: finalExp,
      img: img.trim(),
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
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">ชื่อรายการอุปกรณ์ <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">หมวดหมู่ / ชั้นวาง <span className="text-rose-500">*</span></label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
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
                className="w-full mt-2 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">จำนวนตั้งต้น</label>
              <input
                type="text"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">วันหมดอายุ (EXP)</label>
              {sizes.length > 1 ? (
                <div className="space-y-1.5 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold mb-1 italic">ระบุวันหมดอายุแยกตามชิ้น/ไซส์:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {sizes.map(sz => (
                      <div key={sz} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 min-w-[45px]">{sz}:</span>
                        <input
                          type="date"
                          value={expParts[sz] || ''}
                          onChange={(e) => setExpParts({ ...expParts, [sz]: e.target.value })}
                          className="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-[11px] text-slate-900 dark:text-white outline-none focus:border-blue-500 h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <input
                  type="date"
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500 h-10"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">คุณลักษณะ / สเปกเพิ่มเติม</label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
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
