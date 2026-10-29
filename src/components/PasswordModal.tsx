import React, { useState } from 'react';
import { Eye, EyeOff, Key, Lock, X } from 'lucide-react';

import { User } from '../types';

interface PasswordModalProps {
  isOpen: boolean;
  forced?: boolean;
  currentUser?: User | null;
  onClose: () => void;
  onSubmit?: (oldPw: string, newPw: string) => Promise<{ success: boolean; message: string }>;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  forced = false,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPw) {
      setError('กรุณาระบุรหัสผ่านเดิม');
      return;
    }
    if (newPw.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPw !== confirmPw) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    if (newPw === oldPw) {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
      return;
    }

    setLoading(true);
    let res = { success: true, message: '' };
    if (onSubmit) {
      res = await onSubmit(oldPw, newPw);
    }
    setLoading(false);

    if (res.success) {
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none leading-normal">
      <div className="bg-white dark:bg-[#242526] rounded-2xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#e4e6eb] dark:border-[#3a3b3c] animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#e7f3ff] dark:bg-[#1877f2]/20 text-[#1877f2] flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#050505] dark:text-[#e4e6eb]">
                เปลี่ยนรหัสผ่าน
              </h3>
              {forced && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนเริ่มใช้งาน
                </p>
              )}
            </div>
          </div>
          {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] flex items-center justify-center transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
              รหัสผ่านเดิม
            </label>
            <div className="relative">
              <input
                type={showOldPw ? 'text' : 'password'}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-[#1877f2] text-xs"
                placeholder="รหัสผ่านปัจจุบัน"
              />
              <button
                type="button"
                onClick={() => setShowOldPw(!showOldPw)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] transition cursor-pointer"
                title={showOldPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
              รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-[#1877f2] text-xs"
                placeholder="รหัสผ่านใหม่"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] transition cursor-pointer"
                title={showNewPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
              ยืนยันรหัสผ่านใหม่
            </label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-[#1877f2] text-xs"
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] transition cursor-pointer"
                title={showConfirmPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-bold pt-1">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3">
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
