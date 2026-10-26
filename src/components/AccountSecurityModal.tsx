import React, { useState } from 'react';
import { Key, LogOut, ShieldCheck, User as UserIcon, X, CheckCircle2 } from 'lucide-react';
import { User } from '../types';
import { PasswordModal } from './PasswordModal';

interface AccountSecurityModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onLogout: () => void;
  onChangePasswordSubmit: (oldPw: string, newPw: string) => Promise<{ success: boolean; message: string }>;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onLogout,
  onChangePasswordSubmit,
}) => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !currentUser) return null;

  const handlePasswordSubmit = async (oldPw: string, newPw: string) => {
    const res = await onChangePasswordSubmit(oldPw, newPw);
    if (res.success) {
      setSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว');
      setShowPasswordChange(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
    return res;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
        <div className="bg-white dark:bg-[#242526] rounded-2xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#e4e6eb] dark:border-[#3a3b3c] animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#e4e6eb] dark:border-[#3a3b3c] mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1877f2]/10 dark:bg-[#1877f2]/20 text-[#1877f2] flex items-center justify-center text-xl">
                🔑
              </div>
              <div>
                <h3 className="text-base font-bold text-[#050505] dark:text-[#e4e6eb]">
                  บัญชีและความปลอดภัย
                </h3>
                <p className="text-xs text-[#65676b] dark:text-[#b0b3b8]">
                  Account & Security Management
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] flex items-center justify-center transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current User Card */}
          <div className="p-4 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] mb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] truncate">
                    {currentUser.name}
                  </h4>
                  {currentUser.role === 'admin' ? (
                    <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold text-[10px] tracking-wide">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] font-semibold text-[10px]">
                      Staff
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">
                  @{currentUser.username} {(currentUser as any).department ? `• ${(currentUser as any).department}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setShowPasswordChange(true)}
              className="w-full p-3.5 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#050505] dark:text-[#e4e6eb] group-hover:text-[#1877f2] transition">
                    เปลี่ยนรหัสผ่าน
                  </p>
                  <p className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                    ปรับเปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชี
                  </p>
                </div>
              </div>
              <span className="text-[#65676b] dark:text-[#b0b3b8] font-bold text-lg">›</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">
                    ออกจากระบบ
                  </p>
                  <p className="text-[11px] text-red-500/80 dark:text-red-400/70">
                    ลงชื่อออกจากบัญชีผู้ใช้งานนี้
                  </p>
                </div>
              </div>
              <span className="text-red-500 font-bold text-lg">›</span>
            </button>
          </div>

        </div>
      </div>

      {/* Password Change Sub-modal */}
      <PasswordModal
        isOpen={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
};
