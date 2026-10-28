import React from 'react';
import { FileSpreadsheet, Home, Menu, FileText, Barcode, QrCode } from 'lucide-react';

interface BottomBarProps {
  currentView: string;
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
  onNavigate,
  onOpenReport,
  onOpenGoogleSheet,
  onOpenDrawer,
  onOpenBarcodeScanner,
  isDrawerOpen = false,
  isVisible = true,
}) => {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-28 opacity-0'
      }`}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E4E6EB',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        }}
        className="w-full px-2 sm:px-6 py-1.5"
      >
        <div className="w-full flex items-center justify-between">
          {/* 1. หน้าหลัก */}
          <button
            onClick={() => onNavigate('home')}
            type="button"
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer active:scale-95 min-w-[62px] ${
              currentView === 'home' && !isDrawerOpen
                ? 'text-[#1877F2] font-bold bg-[#E7F3FF]'
                : 'text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]'
            }`}
          >
            <Home
              size={20}
              className={currentView === 'home' && !isDrawerOpen ? 'text-[#1877F2] stroke-[2.5]' : 'text-[#65676B]'}
            />
            <span className="text-[11px] mt-0.5 whitespace-nowrap">หน้าหลัก</span>
          </button>

          {/* 2. รายงาน */}
          <button
            onClick={onOpenReport}
            type="button"
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer active:scale-95 min-w-[62px] ${
              currentView === 'report' && !isDrawerOpen
                ? 'text-[#1877F2] font-bold bg-[#E7F3FF]'
                : 'text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]'
            }`}
          >
            <FileText
              size={20}
              className={currentView === 'report' && !isDrawerOpen ? 'text-[#1877F2] stroke-[2.5]' : 'text-[#65676B]'}
            />
            <span className="text-[11px] mt-0.5 whitespace-nowrap">รายงาน</span>
          </button>

          {/* Center Elevated Floating Barcode Scan Button */}
          <div className="relative -top-4 flex items-center justify-center">
            <button
              onClick={onOpenBarcodeScanner}
              type="button"
              style={{
                backgroundColor: '#1877F2',
                boxShadow: '0 6px 18px rgba(24, 119, 242, 0.45)',
              }}
              className="text-white w-13 h-13 rounded-full border-3 border-white flex flex-col items-center justify-center active:scale-90 hover:scale-105 transition-all cursor-pointer group shadow-lg"
              title="สแกนบาร์โค้ดด่วน (Quick Barcode Scan)"
            >
              <Barcode size={24} className="text-white group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold text-white -mt-0.5 tracking-tight">สแกน</span>
            </button>
          </div>

          {/* 3. ชีต */}
          <button
            onClick={onOpenGoogleSheet}
            type="button"
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] transition-all cursor-pointer active:scale-95 min-w-[62px]"
            title="เปิด Google Sheets"
          >
            <FileSpreadsheet size={20} className="text-[#65676B]" />
            <span className="text-[11px] mt-0.5 whitespace-nowrap">ชีต</span>
          </button>

          {/* 4. เมนูเพิ่มเติม ☰ (Triggers Slide-over Drawer) */}
          <button
            onClick={onOpenDrawer}
            type="button"
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer active:scale-95 min-w-[62px] ${
              isDrawerOpen
                ? 'text-[#1877F2] font-bold bg-[#E7F3FF]'
                : 'text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]'
            }`}
            title="เมนูเพิ่มเติม"
          >
            <Menu
              size={20}
              className={isDrawerOpen ? 'text-[#1877F2] stroke-[2.5]' : 'text-[#65676B]'}
            />
            <span className="text-[11px] mt-0.5 whitespace-nowrap">เมนูเพิ่มเติม</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
