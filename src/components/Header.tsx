import React from 'react';
import { Bell, RefreshCw, Settings } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  onGoHome: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenDrugInventory?: () => void;
  unreadCount: number;
  isSyncing?: boolean;
  isVisible?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onGoHome,
  onOpenSettings,
  onOpenNotifications,
  onOpenDrugInventory,
  unreadCount,
  isSyncing = false,
  isVisible = true,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header
      className={`bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/80 sticky top-0 z-30 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left Side: Apple / Samsung One UI Minimalist Emblem & Brand */}
        <div className="flex items-center gap-3">
          <div
            onClick={onGoHome}
            className="cursor-pointer select-none group flex items-center gap-2.5 ios-touch"
            title="กลับสู่หน้าหลัก"
          >
            {/* Pure Blue & White Minimalist Emblem */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-600/25 group-hover:scale-105 transition-transform duration-200 relative overflow-hidden border border-blue-400/40 bg-blue-600"
            >
              {/* Clean tactical geometry */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_40%,rgba(255,255,255,0.25)_50%,transparent_60%)] animate-pulse" />
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 relative z-10 text-white">
                <path
                  d="M12 3L19 7V17L12 21L5 17V7L12 3Z"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  fill="rgba(255,255,255,0.18)"
                />
                <path
                  d="M12 7v10m-5-5h10"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Header Text: Single unified line, no wrapping */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white tracking-tight">
                Anesthesia Check
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                  isAdmin
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                }`}
              >
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Drug Inventory, Bell, Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenDrugInventory && (
            <button
              onClick={onOpenDrugInventory}
              title="ตรวจเช็คคลังยาและสารน้ำ"
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ios-touch"
            >
              <span>💊</span>
              <span className="hidden sm:inline">คลังยา</span>
            </button>
          )}

          {/* Notification Bell (iOS rounded-full touch) */}
          <button
            onClick={onOpenNotifications}
            title="การแจ้งเตือนและประวัติ"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 transition cursor-pointer ios-touch"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#ff3b30] text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="ตั้งค่าระบบ"
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 transition cursor-pointer ios-touch"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
