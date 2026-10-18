import React, { useEffect, useState } from 'react';

interface SubmissionLoadingModalProps {
  isOpen: boolean;
  progressPercent: number;
  statusText: string;
}

export const SubmissionLoadingModal: React.FC<SubmissionLoadingModalProps> = ({
  isOpen,
  progressPercent,
  statusText,
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none transition-all duration-300">
      {/* Pure spinning arrow circle loader without any white container box */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Continuous rotating outer halo */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping opacity-25" />

        <svg className="w-full h-full transform -rotate-90 animate-spin [animation-duration:2.5s]" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          {/* Subtle Track */}
          <circle
            cx="50"
            cy="50"
            r="38"
            className="stroke-white/10"
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Active Spinning Arc */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="url(#loaderGradient)"
            strokeWidth="4"
            strokeDasharray={2 * Math.PI * 38}
            strokeDashoffset={2 * Math.PI * 38 * 0.35}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight drop-shadow-md">
            {displayNumber}%
          </span>
        </div>
      </div>

      {/* Clean Status Text below loader */}
      <p className="mt-5 text-sm font-medium text-white/90 drop-shadow-sm tracking-wide text-center max-w-xs">
        {statusText || 'กำลังบันทึกและส่งข้อมูล...'}
      </p>
    </div>
  );
};
