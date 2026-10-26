import React from 'react';
import { ExternalLink, FileSpreadsheet, Home, Send } from 'lucide-react';
import { User } from '../types';

interface BottomBarProps {
  currentView: string;
  currentUser?: User | null;
  onGoHome: () => void;
  onOpenReport: () => void;
  onOpenGoogleSheet: () => void;
  sheetUrl?: string;
  isVisible?: boolean;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  currentView,
  onGoHome,
  onOpenReport,
  onOpenGoogleSheet,
  sheetUrl,
  isVisible = true,
}) => {
  return (
    <nav
      className={`fixed bottom-3 left-0 right-0 z-30 transition-all duration-300 ease-in-out select-none px-4 pointer-events-none ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
      }`}
    >
      <div className="max-w-sm mx-auto pointer-events-auto bg-white dark:bg-[#242526] border border-[#e4e6eb] dark:border-[#3a3b3c] rounded-2xl shadow-xl px-3 py-1.5 flex items-center justify-evenly gap-2">
        
        {/* 1. Official Report Button [ รายงาน 📄 ] */}
        <button
          type="button"
          onClick={onOpenReport}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            currentView === 'report'
              ? 'text-[#1877f2] dark:text-[#2d88ff] font-bold'
              : 'text-[#65676b] hover:text-[#050505] dark:text-[#b0b3b8] dark:hover:text-white'
          }`}
          title="ดูผลรายงาน 14 คอลัมน์ทางการ"
        >
          <div
            className={`p-1.5 rounded-xl transition ${
              currentView === 'report'
                ? 'bg-[#e7f3ff] dark:bg-[#1877f2]/20'
                : 'hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c]'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-[11px] font-medium leading-none">รายงาน</span>
        </button>

        {/* 2. Google Sheet Navigation Button [ ชีต 🟢 ] */}
        <button
          type="button"
          onClick={onOpenGoogleSheet}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl text-[#65676b] hover:text-[#050505] dark:text-[#b0b3b8] dark:hover:text-white transition-all cursor-pointer active:scale-95"
          title={sheetUrl ? 'เปิดไฟล์ Google Sheet' : 'ตั้งค่า Google Sheet'}
        >
          <div className="p-1.5 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] transition flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Send className="w-5 h-5 transform -rotate-45" />
          </div>
          <span className="text-[11px] font-medium leading-none flex items-center gap-0.5">
            <span>ชีต</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </span>
        </button>

        {/* 3. CENTER HOME BUTTON (หน้าหลัก - ตรงกลาง) [ หน้าหลัก 🏠 ] */}
        <button
          type="button"
          onClick={onGoHome}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            currentView === 'home'
              ? 'text-[#1877f2] dark:text-[#2d88ff] font-bold'
              : 'text-[#65676b] hover:text-[#050505] dark:text-[#b0b3b8] dark:hover:text-white'
          }`}
          title="กลับสู่หน้าหลัก"
        >
          <div
            className={`p-2 rounded-2xl transition shadow-xs ${
              currentView === 'home'
                ? 'bg-[#1877f2] text-white shadow-md'
                : 'bg-[#e7f3ff] text-[#1877f2] dark:bg-[#1877f2]/20 dark:text-[#2d88ff] hover:bg-[#dbe7f2]'
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold leading-none mt-0.5">หน้าหลัก</span>
        </button>

      </div>
    </nav>
  );
};
