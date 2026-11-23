import React from 'react';
import { Info, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { DrugItem } from '../types';

export interface DrugItemCardProps {
  item: DrugItem;
  index: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isLowStock: boolean;
  isCurrentYear: boolean;
  onSelectDetail: (item: DrugItem) => void;
  onDeltaQty: (id: string, delta: number) => void;
  onEdit: (item: DrugItem) => void;
  onDelete: (item: DrugItem) => void;
}

/**
 * Memoized high-performance inventory row card for 120Hz mobile scrolling.
 * Uses border + shadow-xs instead of backdrop-blur / shadow-xl,
 * transition-colors instead of transition-all, tabular-nums for stock counters,
 * and truncate + shrink-0 to keep long drug names from wrapping status badges.
 */
export const DrugItemCard: React.FC<DrugItemCardProps> = React.memo(({
  item,
  index,
  isExpired,
  isExpiringSoon,
  isLowStock,
  isCurrentYear,
  onSelectDetail,
  onDeltaQty,
  onEdit,
  onDelete,
}) => {
  const cardTone = isExpired
    ? 'bg-rose-50/90 dark:bg-[#1E1F20] border-rose-200 dark:border-rose-900/40 text-slate-900 dark:text-white'
    : isExpiringSoon
    ? 'bg-amber-50/90 dark:bg-[#1E1F20] border-amber-200 dark:border-amber-900/40 text-slate-900 dark:text-white'
    : isLowStock
    ? 'bg-orange-50/90 dark:bg-[#1E1F20] border-orange-200 dark:border-orange-900/40 text-slate-900 dark:text-white'
    : 'bg-white dark:bg-[#1E1F20] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white';

  const statusLabel = isExpired
    ? 'หมดอายุ'
    : isExpiringSoon
    ? 'ใกล้หมดอายุ'
    : isLowStock
    ? 'ใกล้หมด'
    : 'พร้อมใช้';

  const statusTone = isExpired
    ? 'bg-rose-600 text-white'
    : isExpiringSoon
    ? 'bg-amber-500 text-white'
    : isLowStock
    ? 'bg-orange-500 text-white'
    : 'bg-emerald-600 text-white';

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-2xl border shadow-xs transition-colors duration-150 card-perf flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-blue-300 ${cardTone}`}
    >
      {/* Left Info Column */}
      <button
        type="button"
        onClick={() => onSelectDetail(item)}
        className="flex items-center gap-3 flex-1 min-w-0 w-full text-left cursor-pointer active:opacity-80 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-black border border-blue-100 flex items-center justify-center shrink-0 text-sm tabular-nums">
          {index + 1}
        </div>

        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate leading-tight">
              {item.name}
            </h3>
            {item.unit && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-white/10 shrink-0 whitespace-nowrap">
                {item.unit}
              </span>
            )}
            {(item.tmtCode || item.hospitalDrugCode) && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-mono font-bold border border-indigo-200 dark:border-indigo-900/40 shrink-0 whitespace-nowrap">
                {item.tmtCode || item.hospitalDrugCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap font-sans">
            <span className="tabular-nums">
              คงเหลือ: <b className="text-slate-900 dark:text-white font-extrabold">{item.remaining}</b> {item.unit || ''} (Min: {item.minStock})
            </span>
            {((item.lots && item.lots.length > 0) || item.lotNumber) && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold border border-blue-200 shrink-0 whitespace-nowrap">
                {item.lots && item.lots.length > 1
                  ? `${item.lots.length} Lots (FEFO)`
                  : `Lot: ${item.lots?.[0]?.lotNumber || item.lotNumber}`}
              </span>
            )}
            {item.expDate && (
              <span className={`flex items-center gap-1 font-semibold tabular-nums ${isCurrentYear ? 'text-rose-600 font-bold' : ''}`}>
                <span>
                  EXP: <span className={isCurrentYear ? 'underline' : ''}>{item.expDate}</span>
                </span>
                {isCurrentYear && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold border border-rose-200 shrink-0 whitespace-nowrap">
                    EXP ปีนี้
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Right Actions & Stepper Controls */}
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Status Badge (Locked shrink-0 & whitespace-nowrap) */}
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 whitespace-nowrap ${statusTone}`}
        >
          {statusLabel}
        </span>

        {/* Quantity Stepper [-] count [+] */}
        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeltaQty(item.id, -1);
            }}
            className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-transform active:scale-95 active:opacity-80 cursor-pointer shadow-xs touch-manipulation"
            title="ลดจำนวน 1"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-9 text-center font-extrabold text-xs text-slate-900 tabular-nums">
            {item.remaining}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeltaQty(item.id, 1);
            }}
            className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-transform active:scale-95 active:opacity-80 cursor-pointer shadow-xs touch-manipulation"
            title="เพิ่มจำนวน 1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Detail Modal Button */}
        <button
          type="button"
          onClick={() => onSelectDetail(item)}
          className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition-colors active:opacity-80 cursor-pointer border border-blue-100 shrink-0 whitespace-nowrap touch-manipulation"
          title="ดูรายละเอียดข้อมูลยาครบถ้วน"
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">รายละเอียด</span>
        </button>

        {/* Edit / Delete Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors active:opacity-80 cursor-pointer touch-manipulation"
            title="แก้ไขข้อมูลยา"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors active:opacity-80 cursor-pointer touch-manipulation"
            title="ลบรายการยา"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

DrugItemCard.displayName = 'DrugItemCard';

export interface GenericItemCardProps {
  title: string;
  subtitle?: string;
  quantity?: number | string;
  unit?: string;
  statusLabel: string;
  statusVariant?: 'ok' | 'low' | 'danger' | 'neutral';
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}

/**
 * Clean general-purpose memoized ItemCard aligned to tabular-nums,
 * zero backdrop-blur, zero transition-all, and locked shrink-0 badges.
 */
export const ItemCard: React.FC<GenericItemCardProps> = React.memo(({
  title,
  subtitle,
  quantity,
  unit,
  statusLabel,
  statusVariant = 'ok',
  onClick,
  rightSlot,
}) => {
  const badgeClasses =
    statusVariant === 'danger'
      ? 'bg-rose-600 text-white'
      : statusVariant === 'low'
      ? 'bg-amber-500 text-white'
      : statusVariant === 'neutral'
      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      : 'bg-emerald-600 text-white';

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181A20] shadow-xs transition-colors duration-150 active:scale-[0.98] active:opacity-80 card-perf flex items-center justify-between gap-3 ${
        onClick ? 'cursor-pointer touch-manipulation' : ''
      }`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
          {title}
        </p>
        {(subtitle || quantity !== undefined) && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
            {quantity !== undefined ? `จำนวน: ${quantity}${unit ? ` ${unit}` : ''}` : ''}
            {quantity !== undefined && subtitle ? ' • ' : ''}
            {subtitle || ''}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 whitespace-nowrap ${badgeClasses}`}>
          {statusLabel}
        </span>
        {rightSlot}
      </div>
    </div>
  );
});

ItemCard.displayName = 'ItemCard';
