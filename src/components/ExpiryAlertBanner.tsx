import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { ExpiryAlertItem } from '../types';

interface ExpiryAlertBannerProps {
  alerts: ExpiryAlertItem[];
  onOpenAlertDetails: () => void;
}

export const ExpiryAlertBanner: React.FC<ExpiryAlertBannerProps> = ({
  alerts,
  onOpenAlertDetails,
}) => {
  if (alerts.length === 0) return null;

  const expiredCount = alerts.filter((a) => a.status === 'expired').length;
  const warningCount = alerts.filter((a) => a.status === 'warning').length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </div>

        <div>
          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>รายการยา/เวชภัณฑ์ในรถและกระเป๋า Emer</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              {expiredCount > 0 && (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  หมดอายุ {expiredCount}
                </span>
              )}
              {expiredCount > 0 && warningCount > 0 && <span>·</span>}
              {warningCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  ใกล้หมด {warningCount}
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            สามารถกดดูรายการเพื่อเปลี่ยนของใหม่และตั้งวันหมดอายุได้ทันที
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
        <button
          onClick={onOpenAlertDetails}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
        >
          <span>ดูรายการ/เปลี่ยนของ</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
