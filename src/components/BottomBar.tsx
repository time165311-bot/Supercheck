import React from 'react';
import { ExternalLink, FileSpreadsheet, Home, Send, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface BottomBarProps {
  currentView: string;
  currentUser: User | null;
  onGoHome: () => void;
  onOpenReport: () => void;
  onOpenDrugInventory?: () => void;
  onOpenGoogleSheet: () => void;
  onOpenProfile: () => void;
  sheetUrl?: string;
  isVisible?: boolean;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  currentView,
  currentUser,
  onGoHome,
  onOpenReport,
  onOpenDrugInventory,
  onOpenGoogleSheet,
  onOpenProfile,
  sheetUrl,
  isVisible = true,
}) => {
  return (
    <nav
      className={`fixed bottom-3 left-0 right-0 z-30 transition-all duration-300 ease-in-out select-none px-4 pointer-events-none ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
      }`}
    >
      <div className="max-w-md mx-auto pointer-events-auto bg-white/85 dark:bg-[#15171e]/90 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-lg shadow-black/5 px-2 py-1.5 flex items-center justify-around">
        {/* 1. Home */}
        <button
          type="button"
          onClick={onGoHome}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3.5 rounded-xl transition-all cursor-pointer ios-touch ${
            currentView === 'home'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
          title="หน้าหลัก"
        >
          <div
            className={`p-1 rounded-xl transition ${
              currentView === 'home'
                ? 'bg-blue-50 dark:bg-blue-950/60'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Home className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight">หน้าหลัก</span>
        </button>

        {/* 2. Official Report */}
        <button
          type="button"
          onClick={onOpenReport}
          className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-3.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-all cursor-pointer ios-touch"
          title="ดูผลรายงาน 14 คอลัมน์ทางการ"
        >
          <div className="p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight">รายงาน</span>
        </button>

        {/* 3. Google Sheet Navigation */}
        <button
          type="button"
          onClick={onOpenGoogleSheet}
          className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-3.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-all cursor-pointer ios-touch"
          title={sheetUrl ? 'เปิดไฟล์ Google Sheet' : 'ตั้งค่า Google Sheet'}
        >
          <div className="p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Send className="w-4 h-4 transform -rotate-45" />
          </div>
          <span className="text-[10px] tracking-tight flex items-center gap-0.5">
            <span>ชีต</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </span>
        </button>

        {/* 4. User Profile */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-3.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-all cursor-pointer ios-touch"
          title="โปรไฟล์ผู้ใช้งาน & บัญชี"
        >
          <div className="p-0.5 rounded-full ring-2 ring-transparent hover:ring-blue-500/40 transition">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover shadow-2xs"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center text-[10px] font-bold">
                {currentUser?.name ? currentUser.name.charAt(0) : <UserIcon className="w-3 h-3" />}
              </div>
            )}
          </div>
          <span className="text-[10px] tracking-tight truncate max-w-16">
            {currentUser?.name ? currentUser.name.split(' ')[0] : 'โปรไฟล์'}
          </span>
        </button>
      </div>
    </nav>
  );
};
