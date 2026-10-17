import React, { useEffect, useState } from 'react';

interface SubmissionLoadingModalProps {
  isOpen: boolean;
  progressPercent: number;
  statusText: string;
}

export const SubmissionLoadingModal: React.FC<SubmissionLoadingModalProps> = ({
  isOpen,
  progressPercent,
}) => {
  const [displayNumber, setDisplayNumber] = useState(0);

  // Smooth number-by-number ticker: 0 up to progressPercent
  useEffect(() => {
    if (!isOpen) {
      setDisplayNumber(0);
      return;
    }

    const interval = setInterval(() => {
      setDisplayNumber((prev) => {
        if (prev < progressPercent) {
          const diff = progressPercent - prev;
          const step = diff > 30 ? 3 : diff > 10 ? 2 : 1;
          return Math.min(prev + step, progressPercent);
        }
        return prev;
      });
    }, 18);

    return () => clearInterval(interval);
  }, [isOpen, progressPercent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-xs w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
        {/* Animated Circular Progress Spinner */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth="7"
              fill="transparent"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-sky-600 dark:stroke-sky-400 transition-all duration-75 ease-out"
              strokeWidth="7"
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={2 * Math.PI * 40 * (1 - displayNumber / 100)}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              {displayNumber}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
