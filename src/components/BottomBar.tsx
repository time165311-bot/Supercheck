import React from 'react';
import { ExternalLink, FileSpreadsheet, Home, Send, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface BottomBarProps {
  currentView: string;
  currentUser: User | null;
  onGoHome: () => void;
  onOpenReport: () => void;
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
  onOpenGoogleSheet,
  onOpenProfile,
  sheetUrl,
  isVisible = true,
}) => {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out select-none shadow-lg ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
        {/* 1. Left-most: Home */}
        <button
          type="button"
          onClick={onGoHome}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition cursor-pointer ${
            currentView === 'home'
              ? 'text-neutral-900 dark:text-white font-bold'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
          title="หน้าหลัก"
        >
          <div
            className={`p-1.5 rounded-xl transition ${
              currentView === 'home' ? 'bg-neutral-100 dark:bg-neutral-900' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">หน้าหลัก</span>
        </button>

        {/* 2. Official Report */}
        <button
          type="button"
          onClick={onOpenReport}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer"
          title="ดูผลรายงาน 14 คอลัมน์ทางการ"
        >
          <div className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 transition">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-[10px] tracking-tight">ดูผลรายงาน</span>
        </button>

        {/* 3. Google Sheet Navigation */}
        <button
          type="button"
          onClick={onOpenGoogleSheet}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer"
          title={sheetUrl ? 'เปิดไฟล์ Google Sheet' : 'ตั้งค่า Google Sheet'}
        >
          <div className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 transition flex items-center justify-center">
            <Send className="w-5 h-5 transform -rotate-45 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-[10px] tracking-tight flex items-center gap-0.5">
            <span>Google Sheet</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </span>
        </button>

        {/* 4. Right-most: User Profile */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer"
          title="โปรไฟล์ผู้ใช้งาน & บัญชี"
        >
          <div className="p-0.5 rounded-full ring-2 ring-transparent hover:ring-neutral-400 transition">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover shadow-2xs"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs font-bold">
                {currentUser?.name ? currentUser.name.charAt(0) : <UserIcon className="w-3.5 h-3.5" />}
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
