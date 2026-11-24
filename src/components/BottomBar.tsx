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
  sheetUrl = '',
  isVisible = true,
}) => {
  const isDark = theme === 'dark';
  const trimmedSheetUrl = sheetUrl?.trim() || '';

  return (
    <nav
      aria-hidden={!isVisible}
      className={`fixed bottom-4 left-0 right-0 z-40 px-2.5 sm:px-3 pointer-events-none flex justify-center md:hidden transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        willChange: 'transform, opacity',
        transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, calc(100% + 28px), 0)',
        transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
      }}
    >
      {/* ตัวแถบ Navigator หลัก: ทึบแสง 100%, โค้งมน 3xl, แบ่ง 5 ช่องเท่ากัน */}
      <div
        className={`${isVisible ? 'pointer-events-auto' : 'pointer-events-none'} w-full max-w-md shadow-lg rounded-3xl px-2 py-2 flex items-center justify-between border transition-colors duration-200 ${
          isDark
            ? 'bg-[#181A20] border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* 1. หน้าหลัก */}
        <button
          onClick={() => onNavigate('home')}
          type="button"
          className={`flex-1 flex items-center justify-center py-2 transition-colors cursor-pointer active:scale-95 ${
            currentView === 'home' && !isDrawerOpen
              ? 'text-blue-600'
              : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          title="หน้าหลัก"
        >
          <Home className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 2. รายงาน */}
        <button
          onClick={onOpenReport}
          type="button"
          className={`flex-1 flex items-center justify-center py-2 transition-colors cursor-pointer active:scale-95 ${
            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
          title="รายงาน"
        >
          <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 3. ปุ่มสแกนอัจฉริยะตรงกลาง */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={onOpenBarcodeScanner}
            type="button"
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 active:scale-90 active:opacity-90 transition-transform cursor-pointer"
            title="สแกนอัจฉริยะ"
          >
            <Barcode className="w-6 h-6 text-white shrink-0" />
          </button>
        </div>

        {/* 4. ชีต (เปิด Google Sheets จริงในแท็บใหม่ทันทีหากมี URL หรือเปิดตั้งค่าหากยังไม่มี) */}
        {trimmedSheetUrl ? (
          <a
            href={trimmedSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center py-2 transition-colors cursor-pointer active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="เปิด Google Sheets"
          >
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
          </a>
        ) : (
          <button
            onClick={onOpenGoogleSheet}
            type="button"
            className={`flex-1 flex items-center justify-center py-2 transition-colors cursor-pointer active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="ตั้งค่า Google Sheets"
          >
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* 5. เมนู */}
        <button
          onClick={onOpenDrawer}
          type="button"
          className={`flex-1 flex items-center justify-center py-2 transition-colors cursor-pointer active:scale-95 ${
            isDrawerOpen
              ? 'text-blue-600'
              : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          title="เปิดเมนู"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </nav>
  );
};
