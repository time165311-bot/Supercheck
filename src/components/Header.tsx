import React from 'react';
import { Bell, RefreshCw, Settings } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  onGoHome: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  isSyncing?: boolean;
  isVisible?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onGoHome,
  onOpenSettings,
  onOpenNotifications,
  unreadCount,
  isSyncing = false,
  isVisible = true,
}) => {
  return (
    <header
      className={`bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-30 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left Side: Artistic Minimalist Medical Check Emblem & Brand Name */}
        <div className="flex items-center gap-3">
          <div
            onClick={onGoHome}
            className="cursor-pointer select-none group flex items-center gap-2.5"
            title="กลับสู่หน้าหลัก"
          >
            {/* Artistic Monoline Medical Cross + Checkmark Emblem */}
            <div className="w-7 h-7 flex items-center justify-center text-neutral-900 dark:text-white transition-transform group-hover:scale-105">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                {/* Minimalist architectural hospital cross */}
                <path
                  d="M12 3.5v7M4.5 12h7M12 12v8.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="stroke-neutral-800 dark:stroke-neutral-300 opacity-40"
                />
                {/* Dynamic continuous precision checkmark */}
                <path
                  d="M7.5 12.5l3.4 3.6L19.5 7"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-emerald-500"
                />
              </svg>
            </div>
            <span className="font-bold tracking-tight text-sm sm:text-base text-neutral-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif]">
              Aesthesia check
            </span>
          </div>
        </div>

        {/* Right Side: Sync (icon only, no text), Bell, and Settings Gear */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Minimalist Sync Indicator (Icon only - clean rotating green/sky) */}
          <div
            className={`p-2 rounded-xl transition-colors select-none flex items-center justify-center ${
              isSyncing ? 'text-sky-500' : 'text-emerald-500'
            }`}
            title={isSyncing ? 'กำลังซิงก์ข้อมูลคลาวด์...' : 'ซิงก์ข้อมูลเรียบร้อย'}
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform duration-300 ${
                isSyncing ? 'animate-spin' : ''
              }`}
            />
          </div>

          {/* Notification Bell with Badge */}
          <button
            onClick={onOpenNotifications}
            title="การแจ้งเตือนและประวัติ"
            className="relative p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute 0.5 top-0.5 right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-black animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Gear Settings */}
          <button
            onClick={onOpenSettings}
            title="ตั้งค่าระบบ"
            className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
