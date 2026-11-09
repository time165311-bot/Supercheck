import React from 'react';
import { Home, FileText, Barcode, FileSpreadsheet, Menu } from 'lucide-react';

interface BottomBarProps {
  currentView: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onNavigate: (view: string) => void;
  onOpenReport: () => void;
  onOpenGoogleSheet: () => void;
  onOpenDrawer: () => void;
  onOpenBarcodeScanner: () => void;
  isDrawerOpen?: boolean;
  sheetUrl?: string;
  isVisible?: boolean;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  currentView,
  theme = 'dark',
  onNavigate,
  onOpenReport,
  onOpenGoogleSheet,
  onOpenDrawer,
  onOpenBarcodeScanner,
  isDrawerOpen = false,
  isVisible = true,
}) => {
  const isDark = theme === 'dark';

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-2.5 md:hidden transform-gpu will-change-transform ${
        isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 150%, 0)',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        visibility: isVisible ? 'visible' : 'hidden',
      }}
    >
      <div
        className={`max-w-md mx-auto px-5 py-2 rounded-[2rem] border shadow-2xl transition-colors duration-200 transform-gpu ${
          isDark
            ? 'bg-[#181A20]/95 border-white/10 text-white shadow-black/60'
            : 'bg-white/95 border-slate-200/80 text-slate-800 shadow-slate-200/60'
        }`}
      >
        <div className="w-full flex items-center justify-between">
          {/* 1. หน้าหลัก (Home) */}
          <button
            onClick={() => onNavigate('home')}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              currentView === 'home' && !isDrawerOpen
                ? 'text-[#3B82F6] font-bold'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Home size={22} className={currentView === 'home' && !isDrawerOpen ? 'stroke-[2.5]' : ''} />
            <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">หน้าหลัก</span>
          </button>

          {/* 2. รายงาน (Report) */}
          <button
            onClick={onOpenReport}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText size={22} />
            <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">รายงาน</span>
          </button>

          {/* 3. Center Balanced Barcode Scan Button (Leveled with others) */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={onOpenBarcodeScanner}
              type="button"
              className="flex flex-col items-center justify-center w-11 h-11 bg-gradient-to-tr from-[#3B82F6] to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/30 ring-2 ring-blue-500/10 active:scale-95 transition-all duration-150 ease-out cursor-pointer group"
              title="สแกนบาร์โค้ดด่วน (Balanced Scanner)"
            >
              <Barcode size={20} className="text-white group-hover:scale-105 transition-transform" />
              <span className="text-[8px] font-bold text-white tracking-tight uppercase">สแกน</span>
            </button>
          </div>

          {/* 4. ชีต (Google Sheets) */}
          <button
            onClick={onOpenGoogleSheet}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="เปิด Google Sheets"
          >
            <FileSpreadsheet size={22} />
            <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">ชีต</span>
          </button>

          {/* 5. เมนูล่างขวา ("เมนู" ≡ One UI Bottom Sheet Trigger) */}
          <button
            onClick={onOpenDrawer}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              isDrawerOpen
                ? 'text-[#3B82F6] font-bold'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="เปิดเมนูด่วน One UI"
          >
            <Menu size={22} className={isDrawerOpen ? 'stroke-[2.5] text-[#3B82F6]' : ''} />
            <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">เมนู</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
