import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface GlobalScrollButtonsProps {
  onNavigateHome?: () => void;
  showHomeButton?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
}

export const GlobalScrollButtons: React.FC<GlobalScrollButtonsProps> = ({
  isAnyModalOpen = false,
}) => {
  const [showButtons, setShowButtons] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      // 1. Check if we have scrolled enough to even consider showing buttons
      const isScrolledDown = window.scrollY > 150;
      
      if (isScrolledDown) {
        setIsScrolling(true);
        
        // 2. Clear existing timer
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }

        // 3. Set timer to hide after 2 seconds of inactivity
        hideTimerRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2000);
      } else {
        setIsScrolling(false);
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          setShowButtons(isScrolledDown);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

  // Only render if showButtons is true (scrolled down) AND isScrolling is true (currently scrolling or just scrolled)
  const isVisible = showButtons && isScrolling;

  return (
    <div
      style={{
        position: 'fixed',
        left: '16px', // Move to the LEFT side to avoid overlapping Aura on the right
        bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        zIndex: 9998,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(-20px) scale(0.9)',
      }}
      className="flex flex-col gap-2 items-center select-none transition-all duration-500 ease-out transform-gpu"
    >
      {/* 1. ปุ่ม [↑] (Scroll to Top) */}
      <button
        type="button"
        onClick={scrollToTop}
        className="w-11 h-11 rounded-2xl bg-white/90 dark:bg-slate-800/90 text-blue-600 border border-blue-100 dark:border-white/10 shadow-2xl backdrop-blur-xl transition-all active:scale-90 flex items-center justify-center cursor-pointer"
        title="เลื่อนขึ้นบนสุด"
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* 2. ปุ่ม [↓] (Scroll to Bottom) */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="w-11 h-11 rounded-2xl bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl transition-all active:scale-90 flex items-center justify-center cursor-pointer"
        title="เลื่อนลงล่างสุด"
      >
        <ArrowDown className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
};
