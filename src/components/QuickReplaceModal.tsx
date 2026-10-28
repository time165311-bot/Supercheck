import React, { useState } from 'react';
import { Calendar, Check, RefreshCw, X } from 'lucide-react';
import { EquipmentItem } from '../types';

interface QuickReplaceModalProps {
  isOpen: boolean;
  item: EquipmentItem | null;
  category: 'bag' | 'cart';
  groupName: string;
  itemIndex: number;
  onClose: () => void;
  onConfirm: (category: 'bag' | 'cart', groupName: string, itemIndex: number, newExp: string) => void;
}

export const QuickReplaceModal: React.FC<QuickReplaceModalProps> = ({
  isOpen,
  item,
  category,
  groupName,
  itemIndex,
  onClose,
  onConfirm,
}) => {
  const [newExpDate, setNewExpDate] = useState(() => {
    // Default to +1 year from now
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });

  if (!isOpen || !item) return null;

  const setOffsetMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setNewExpDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpDate) {
      alert('กรุณาระบุวันหมดอายุใหม่');
      return;
    }
    onConfirm(category, groupName, itemIndex, newExpDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              เปลี่ยนของใหม่ / อัปเดตวันหมดอายุ
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item Info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="font-bold text-slate-900 dark:text-white">
            {item.name}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            ตำแหน่ง: {category === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency'} ({groupName})
          </div>
          <div
            className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1"
            style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>วันหมดอายุเดิม: {item.exp || 'ไม่ได้ระบุ'}</span>
          </div>
        </div>

        {/* Date Selector Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>ระบุวันหมดอายุของล็อตใหม่</span>
            </label>
            <input
              type="date"
              value={newExpDate}
              onChange={(e) => setNewExpDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">เลือกวันที่รวดเร็ว:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setOffsetMonths(6)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                +6 เดือน
              </button>
              <button
                type="button"
                onClick={() => setOffsetMonths(12)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                +1 ปี
              </button>
              <button
                type="button"
                onClick={() => setOffsetMonths(24)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                +2 ปี
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            * ระบบจะบันทึกการเปลี่ยนของใหม่ในเครื่องทันที โดยไม่ต้องส่งรายงานเข้า Google Sheets
          </p>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ยืนยันเปลี่ยนของใหม่</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
