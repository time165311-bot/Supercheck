import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Home } from 'lucide-react';

interface GlobalScrollButtonsProps {
  onNavigateHome?: () => void;
  showHomeButton?: boolean;
}

export const GlobalScrollButtons: React.FC<GlobalScrollButtonsProps> = ({
  onNavigateHome,
  showHomeButton = true,
}) => {
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show floating quick controls when scrolled down more than 80px
      if (window.scrollY > 80) {
        setShowButtons(true);
      } else {
        setShowButtons(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      behavior: 'smooth',
    });
  };

  return (
    <div
      style={{ bottom: '92px', right: '16px', zIndex: 45 }}
      className={`fixed flex flex-col gap-2 items-end transition-all duration-300 ease-in-out select-none ${
        showButtons ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-hidden={!showButtons}
    >
      {/* 1. ปุ่ม [🏠 กลับหน้าหลัก] (Back to Dashboard) */}
      {showHomeButton && onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="group flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-xs font-bold border border-blue-400/40"
          title="ย้อนกลับหน้าหลัก (Dashboard)"
        >
          <Home className="w-4 h-4 text-white transition-transform group-hover:scale-110" />
          <span className="text-[11px] font-bold">กลับหน้าหลัก</span>
        </button>
      )}

      {/* 2. ปุ่ม [↑ ขึ้นบนสุด] (Scroll to Top) */}
      <button
        type="button"
        onClick={scrollToTop}
        className="group flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/95 text-slate-800 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 shadow-md hover:shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-xs font-semibold"
        title="เลื่อนขึ้นบนสุด"
        aria-label="เลื่อนขึ้นบนสุด"
      >
        <ArrowUp className="w-4 h-4 text-blue-600 transition-transform group-hover:-translate-y-0.5" />
        <span className="text-[11px] font-bold">ขึ้นบนสุด</span>
      </button>

      {/* 3. ปุ่ม [↓ ลงล่างสุด] (Scroll to Bottom) */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="group flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/95 text-slate-800 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 shadow-md hover:shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-xs font-semibold"
        title="เลื่อนลงล่างสุด"
        aria-label="เลื่อนลงล่างสุด"
      >
        <ArrowDown className="w-4 h-4 text-slate-600 transition-transform group-hover:translate-y-0.5" />
        <span className="text-[11px] font-bold">ลงล่างสุด</span>
      </button>
    </div>
  );
};
