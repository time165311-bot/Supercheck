import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface GlobalScrollButtonsProps {
  onNavigateHome?: () => void;
  showHomeButton?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
}

export const GlobalScrollButtons: React.FC<GlobalScrollButtonsProps> = ({
  isBottomBarVisible = true,
  isAnyModalOpen = false,
}) => {
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Show quick scroll buttons when scrolled down more than 70px
          setShowButtons(window.scrollY > 70);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (isAnyModalOpen) return null;

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
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '80px',
        zIndex: 99,
      }}
      className="flex flex-col gap-2 items-center select-none pointer-events-auto"
    >
      {/* 1. ปุ่ม [↑] (Scroll to Top) - Minimal Clean Circular Icon */}
      <button
        type="button"
        onClick={scrollToTop}
        className="w-10 h-10 rounded-full bg-white/95 dark:bg-slate-800/95 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-white/10 shadow-md hover:shadow-lg backdrop-blur-md transition-transform duration-150 active:scale-90 flex items-center justify-center cursor-pointer"
        title="เลื่อนขึ้นบนสุด"
        aria-label="เลื่อนขึ้นบนสุด"
      >
        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* 2. ปุ่ม [↓] (Scroll to Bottom) - Minimal Clean Circular Icon */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="w-10 h-10 rounded-full bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-white/10 shadow-md hover:shadow-lg backdrop-blur-md transition-transform duration-150 active:scale-90 flex items-center justify-center cursor-pointer"
        title="เลื่อนลงล่างสุด"
        aria-label="เลื่อนลงล่างสุด"
      >
        <ArrowDown className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
};
