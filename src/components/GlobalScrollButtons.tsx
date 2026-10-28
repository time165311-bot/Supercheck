import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export const GlobalScrollButtons: React.FC = () => {
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show buttons when scrolled down more than 160px
      if (window.scrollY > 160) {
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
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  return (
    <div
      style={{ bottom: '90px', right: '16px', zIndex: 40 }}
      className={`fixed flex flex-col gap-2 items-end transition-all duration-300 ease-in-out select-none ${
        showButtons ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-hidden={!showButtons}
    >
      {/* Scroll to Top Button */}
      <button
        type="button"
        onClick={scrollToTop}
        className="group flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 border border-neutral-200/90 dark:border-neutral-700/80 shadow-md hover:shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-xs font-semibold"
        title="เลื่อนขึ้นบนสุด"
        aria-label="เลื่อนขึ้นบนสุด"
      >
        <ArrowUp className="w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform group-hover:-translate-y-0.5" />
        <span className="text-[11px] font-bold hidden sm:inline">ขึ้นบนสุด</span>
      </button>

      {/* Scroll to Bottom Button */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="group flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 border border-neutral-200/90 dark:border-neutral-700/80 shadow-md hover:shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-xs font-semibold"
        title="เลื่อนลงล่างสุด"
        aria-label="เลื่อนลงล่างสุด"
      >
        <ArrowDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400 transition-transform group-hover:translate-y-0.5" />
        <span className="text-[11px] font-bold hidden sm:inline">ลงล่างสุด</span>
      </button>
    </div>
  );
};
