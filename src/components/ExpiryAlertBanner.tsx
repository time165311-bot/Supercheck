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
    <div className="relative bg-white dark:bg-[#161822] rounded-2xl p-4 border border-neutral-200/70 dark:border-neutral-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs oneui-card">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4" />
        </div>

        <div>
          <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2 flex-wrap">
            <span className="text-sm tracking-tight text-neutral-900 dark:text-neutral-100 font-bold">
              การแจ้งเตือนยา & เวชภัณฑ์
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              {expiredCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200/50 dark:border-rose-900/40">
                  หมดอายุ {expiredCount} รายการ
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-semibold border border-amber-200/50 dark:border-amber-900/40">
                  ใกล้หมดอายุ {warningCount} รายการ
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            พบเวชภัณฑ์ครบกำหนด สามารถตรวจสอบรายการเพื่อเปลี่ยนของใหม่และบันทึกวันหมดอายุ
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
        <button
          onClick={onOpenAlertDetails}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ios-touch"
        >
          <span>ตรวจสอบ</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
