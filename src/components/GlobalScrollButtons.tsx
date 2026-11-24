import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface GlobalScrollButtonsProps {
  onNavigateHome?: () => void;
  showHomeButton?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export const GlobalScrollButtons: React.FC<GlobalScrollButtonsProps> = ({
  isBottomBarVisible = true,
  isAnyModalOpen = false,
  scrollContainerRef,
}) => {
  const [showButtons, setShowButtons] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ticking = false;
    const targetEl = scrollContainerRef?.current;

    const handleScroll = () => {
      const scrollTop = targetEl ? targetEl.scrollTop : window.scrollY;
      const isScrolledDown = scrollTop > 150;

      if (isScrolledDown) {
        setIsScrolling(true);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 1800);
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

    const listenTarget: HTMLElement | Window = targetEl || window;
    listenTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      listenTarget.removeEventListener('scroll', handleScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scrollContainerRef]);

  if (isAnyModalOpen) return null;

  const scrollToTop = () => {
    const el = scrollContainerRef?.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const el = scrollContainerRef?.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      window.scrollTo({
        top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        behavior: 'smooth',
      });
    }
  };

  // Only render if showButtons is true (scrolled down) AND isScrolling is true (currently scrolling or just scrolled)
  const isVisible = showButtons && isScrolling;

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: isBottomBarVisible
          ? 'calc(96px + env(safe-area-inset-bottom, 0px))'
          : 'calc(24px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.9)',
      }}
      className="flex flex-col gap-2 items-center select-none transition-[transform,opacity,bottom] duration-200 ease-out transform-gpu"
    >
      {/* 1. ปุ่ม [↑] (Scroll to Top) */}
      <button
        type="button"
        onClick={scrollToTop}
        className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-slate-800/95 text-blue-600 border border-blue-200 dark:border-slate-700 shadow-md transition-transform active:scale-95 active:opacity-80 flex items-center justify-center cursor-pointer"
        title="เลื่อนขึ้นบนสุด"
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* 2. ปุ่ม [↓] (Scroll to Bottom) */}
      <button
        type="button"
        onClick={scrollToBottom}
        className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md transition-transform active:scale-95 active:opacity-80 flex items-center justify-center cursor-pointer"
        title="เลื่อนลงล่างสุด"
      >
        <ArrowDown className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
};
