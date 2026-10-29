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
      className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-2.5 transition-all duration-300 lg:hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-28 opacity-0'
      }`}
    >
      <div
        className={`max-w-md mx-auto px-5 py-2 rounded-[2rem] border backdrop-blur-2xl shadow-2xl transition-colors duration-300 ${
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

          {/* 3. Center Elevated Floating Barcode Scan Pill Button (One UI Style) */}
          <div className="relative -top-6 flex items-center justify-center">
            <button
              onClick={onOpenBarcodeScanner}
              type="button"
              className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-br from-[#3B82F6] to-cyan-500 text-white rounded-full shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20 active:scale-90 transition cursor-pointer group"
              title="สแกนบาร์โค้ดด่วน (One UI Scanner)"
            >
              <Barcode size={22} className="text-white group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black text-white mt-0.2 tracking-tight">สแกน</span>
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
