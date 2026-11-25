import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X, Check, Clock } from 'lucide-react';
import { getBangkokTodayIso, normalizeExpDateToIso } from '../utils/dateUtils';

export const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

const DEFAULT_MIN_YEAR = 2026;
const DEFAULT_MAX_YEAR = 2032;

function getDaysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

function parseIsoParts(isoStr?: string): { year: number; month: number; day: number } | null {
  const normalized = normalizeExpDateToIso(isoStr);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [y, m, d] = normalized.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m, day: d };
}

function formatPartsToIso(year: number, month1Based: number, day: number): string {
  const maxDay = getDaysInMonth(year, month1Based);
  const clampedDay = Math.max(1, Math.min(day, maxDay));
  return `${String(year).padStart(4, '0')}-${String(month1Based).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function addMonthsFromBangkokToday(monthsToAdd: number): string {
  const todayIso = getBangkokTodayIso();
  const [y, m, d] = todayIso.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth1Based = (totalMonths % 12) + 1;
  return formatPartsToIso(targetYear, targetMonth1Based, d);
}

export function formatDisplayDmy(isoStr?: string): string {
  const parts = parseIsoParts(isoStr);
  if (!parts) return '';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function formatThaiShortLabel(isoStr?: string): string {
  const parts = parseIsoParts(isoStr);
  if (!parts) return '';
  return `${parts.day} ${THAI_SHORT_MONTHS[parts.month - 1]} ${parts.year}`;
}

const EXPIRY_PRESETS = [
  { label: '+6 เดือน', months: 6 },
  { label: '+1 ปี', months: 12 },
  { label: '+2 ปี', months: 24 },
  { label: '+3 ปี', months: 36 },
] as const;

export interface MinimalExpiryDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
  showQuickPresets?: boolean;
  className?: string;
  disabled?: boolean;
}

export const MinimalExpiryDatePicker: React.FC<MinimalExpiryDatePickerProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'เลือกวันหมดอายุ (DD/MM/YYYY)',
  compact = false,
  showQuickPresets = true,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const parsedValue = useMemo(() => parseIsoParts(value), [value]);
  const todayParts = useMemo(() => parseIsoParts(getBangkokTodayIso())!, []);

  // Draft year/month/day shown inside the popover while picking
  const [draftYear, setDraftYear] = useState<number>(() =>
    parsedValue?.year ?? Math.max(DEFAULT_MIN_YEAR, todayParts.year)
  );
  const [draftMonth, setDraftMonth] = useState<number>(() => parsedValue?.month ?? todayParts.month);
  const [draftDay, setDraftDay] = useState<number>(() => parsedValue?.day ?? todayParts.day);
  const [yearWindowStart, setYearWindowStart] = useState<number>(DEFAULT_MIN_YEAR);

  // Sync draft state whenever opening or external value changes
  useEffect(() => {
    if (parsedValue) {
      setDraftYear(parsedValue.year);
      setDraftMonth(parsedValue.month);
      setDraftDay(parsedValue.day);
      if (parsedValue.year < yearWindowStart || parsedValue.year > yearWindowStart + 6) {
        if (parsedValue.year >= DEFAULT_MIN_YEAR && parsedValue.year <= DEFAULT_MAX_YEAR) {
          setYearWindowStart(DEFAULT_MIN_YEAR);
        } else {
          setYearWindowStart(Math.min(parsedValue.year, DEFAULT_MIN_YEAR));
        }
      }
    } else if (isOpen) {
      setDraftYear(Math.max(DEFAULT_MIN_YEAR, todayParts.year));
      setDraftMonth(todayParts.month);
      setDraftDay(todayParts.day);
      setYearWindowStart(DEFAULT_MIN_YEAR);
    }
  }, [parsedValue, isOpen, todayParts]);

  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 80, left: 16, width: 340, maxHeight: 520 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popW = Math.min(352, vw - 20);
    const estimatedPopH = 445;

    let left = rect.left;
    if (left + popW > vw - 10) {
      left = Math.max(10, vw - popW - 10);
    }
    if (left < 10) left = 10;

    const spaceBelow = vh - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    let top: number;
    let maxHeight: number;

    if (spaceBelow >= estimatedPopH || spaceBelow >= spaceAbove) {
      top = Math.min(rect.bottom + 8, vh - Math.min(estimatedPopH, spaceBelow) - 10);
      if (spaceBelow < 320 && vh >= 480) {
        // Center comfortably on tight viewports
        top = Math.max(12, Math.round((vh - Math.min(estimatedPopH, vh - 24)) / 2));
        maxHeight = vh - 24;
      } else {
        top = rect.bottom + 8;
        maxHeight = Math.max(280, vh - top - 12);
      }
    } else {
      maxHeight = Math.max(280, Math.min(estimatedPopH, spaceAbove));
      top = Math.max(12, rect.top - maxHeight - 8);
    }

    setPopoverCoords({ top, left, width: popW, maxHeight });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    window.addEventListener('resize', onResizeOrScroll, { passive: true });
    window.addEventListener('scroll', onResizeOrScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, { capture: true });
    };
  }, [isOpen, updatePosition]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  const yearsGrid = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => yearWindowStart + idx);
  }, [yearWindowStart]);

  const maxDayInDraftMonth = useMemo(() => getDaysInMonth(draftYear, draftMonth), [draftYear, draftMonth]);

  const handleSelectYear = (year: number) => {
    setDraftYear(year);
    const nextIso = formatPartsToIso(year, draftMonth, draftDay);
    onChange(nextIso);
  };

  const handleSelectMonth = (month1Based: number) => {
    setDraftMonth(month1Based);
    const nextIso = formatPartsToIso(draftYear, month1Based, draftDay);
    onChange(nextIso);
  };

  const handleSelectDay = (day: number) => {
    if (day > maxDayInDraftMonth) return;
    setDraftDay(day);
    const nextIso = formatPartsToIso(draftYear, draftMonth, day);
    onChange(nextIso);
    setIsOpen(false);
  };

  const handleApplyPreset = (months: number, closeAfter = false) => {
    const iso = addMonthsFromBangkokToday(months);
    onChange(iso);
    const nextParts = parseIsoParts(iso);
    if (nextParts) {
      setDraftYear(nextParts.year);
      setDraftMonth(nextParts.month);
      setDraftDay(nextParts.day);
    }
    if (closeAfter) {
      setIsOpen(false);
    }
  };

  const displayDmy = formatDisplayDmy(value);
  const displayThai = formatThaiShortLabel(value);
  const activeNormalizedIso = normalizeExpDateToIso(value);

  const presetMatches = useMemo(() => {
    const map: Record<number, boolean> = {};
    EXPIRY_PRESETS.forEach((p) => {
      map[p.months] = activeNormalizedIso !== '' && activeNormalizedIso === addMonthsFromBangkokToday(p.months);
    });
    return map;
  }, [activeNormalizedIso]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Trigger Row */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`flex-1 min-w-0 flex items-center justify-between gap-2 text-left transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            compact
              ? 'h-8 px-2.5 rounded-lg text-[11px]'
              : 'h-10.5 px-3.5 rounded-xl text-xs sm:text-sm'
          } border ${
            isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-300 dark:border-white/10 hover:border-blue-400 dark:hover:border-white/25'
          } bg-white dark:bg-[#1E1F20] text-slate-900 dark:text-[#E3E3E3] font-bold`}
          title="คลิกเพื่อเลือกวันหมดอายุ"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Calendar
              size={compact ? 13 : 15}
              className="text-blue-500 dark:text-[#A8C7FA] shrink-0"
            />
            {displayDmy ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="tabular-nums tracking-tight whitespace-nowrap text-slate-900 dark:text-white">
                  {displayDmy}
                </span>
                <span
                  className={`shrink-0 rounded-md font-bold whitespace-nowrap ${
                    compact ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[10.5px]'
                  } bg-blue-500/12 text-blue-700 dark:bg-[#A8C7FA]/15 dark:text-[#A8C7FA] border border-blue-500/20`}
                >
                  {displayThai}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 dark:text-[#8E918F] font-medium truncate">
                {placeholder}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-[#8E918F] shrink-0">
            {isOpen ? '▲' : '▼'}
          </span>
        </button>

        {onClear && activeNormalizedIso && !disabled && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setIsOpen(false);
            }}
            className={`${
              compact ? 'w-8 h-8 rounded-lg' : 'w-10.5 h-10.5 rounded-xl'
            } shrink-0 flex items-center justify-center border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#282A2C] text-slate-500 dark:text-[#8E918F] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/30 transition cursor-pointer`}
            title="ล้างวันที่หมดอายุ"
          >
            <X size={compact ? 13 : 15} />
          </button>
        )}
      </div>

      {/* Quick EXP Presets Row */}
      {showQuickPresets && !disabled && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500 dark:text-[#8E918F] font-bold flex items-center gap-1 mr-0.5 whitespace-nowrap">
            <Clock size={11} className="text-blue-500 dark:text-[#A8C7FA]" />
            <span>ทางลัด EXP:</span>
          </span>
          {EXPIRY_PRESETS.map((preset) => {
            const isMatched = presetMatches[preset.months];
            return (
              <button
                key={preset.months}
                type="button"
                onClick={() => handleApplyPreset(preset.months, false)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  isMatched
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#282A2C] text-slate-700 dark:text-[#E3E3E3] border-slate-200 dark:border-white/10 hover:bg-blue-50 dark:hover:bg-[#333639] hover:border-blue-400/50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Minimalist Dark Popover via Portal (Never clipped by Modal overflow) */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
            {/* Subtle invisible/dimmed backdrop for click-outside on mobile & desktop */}
            <div
              className="fixed inset-0 bg-black/35 sm:bg-black/20 backdrop-blur-[1px]"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={popoverRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`,
                width: `${popoverCoords.width}px`,
                maxHeight: `${popoverCoords.maxHeight}px`,
              }}
              className="fixed z-10 flex flex-col rounded-2xl bg-[#1E1F20] border border-white/10 text-[#E3E3E3] shadow-[0_20px_50px_rgba(0,0,0,0.65)] overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Popover Header: Current Selected Date Preview */}
              <div className="px-3.5 py-2.5 border-b border-white/10 bg-[#171819] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar size={15} className="text-[#A8C7FA] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white tabular-nums truncate">
                      {displayDmy || formatPartsToIso(draftYear, draftMonth, draftDay).split('-').reverse().join('/')}
                    </div>
                    <div className="text-[10.5px] font-bold text-[#A8C7FA] truncate">
                      {Math.min(draftDay, maxDayInDraftMonth)} {THAI_SHORT_MONTHS[draftMonth - 1]} {draftYear}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                  title="ปิดหน้าต่าง"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Popover Body: Year (2026-2032) -> Thai Month -> Days (1-31) */}
              <div className="p-3.5 space-y-3 overflow-y-auto overscroll-contain">
                {/* 1. Year Section (2026 - 2032) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      ปี (ค.ศ.)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setYearWindowStart((y) => Math.max(2020, y - 4))}
                        className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 transition cursor-pointer"
                        title="ปีก่อนหน้า"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setYearWindowStart(DEFAULT_MIN_YEAR)}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9.5px] font-bold text-slate-300 transition cursor-pointer tabular-nums"
                        title="รีเซ็ตช่วงปี 2026-2032"
                      >
                        {yearsGrid[0]}–{yearsGrid[yearsGrid.length - 1]}
                      </button>
                      <button
                        type="button"
                        onClick={() => setYearWindowStart((y) => Math.min(2040, y + 4))}
                        className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 transition cursor-pointer"
                        title="ปีถัดไป"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {yearsGrid.map((yr) => {
                      const active = draftYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => handleSelectYear(yr)}
                          className={`py-1.5 rounded-lg text-[11px] font-bold tabular-nums transition cursor-pointer border ${
                            active
                              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                              : 'bg-[#282A2C] text-slate-200 border-white/10 hover:bg-[#333639] hover:border-white/20'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Thai Month Section (ม.ค. - ธ.ค.) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    เดือน (ภาษาไทย)
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {THAI_SHORT_MONTHS.map((mLabel, mIdx) => {
                      const mNum = mIdx + 1;
                      const active = draftMonth === mNum;
                      return (
                        <button
                          key={mLabel}
                          type="button"
                          onClick={() => handleSelectMonth(mNum)}
                          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center justify-center gap-1 ${
                            active
                              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                              : 'bg-[#282A2C] text-slate-200 border-white/10 hover:bg-[#333639] hover:border-white/20'
                          }`}
                        >
                          <span className="text-[9px] opacity-60 tabular-nums">
                            {String(mNum).padStart(2, '0')}
                          </span>
                          <span>{mLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Day Grid Section (1 - 31) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      วันที่ (1 - {maxDayInDraftMonth})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      แตะวันที่เพื่อเลือกและปิด
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((dNum) => {
                      const isDisabledDay = dNum > maxDayInDraftMonth;
                      const active = !isDisabledDay && Math.min(draftDay, maxDayInDraftMonth) === dNum && Boolean(activeNormalizedIso);
                      const isToday =
                        draftYear === todayParts.year &&
                        draftMonth === todayParts.month &&
                        dNum === todayParts.day;
                      return (
                        <button
                          key={dNum}
                          type="button"
                          disabled={isDisabledDay}
                          onClick={() => handleSelectDay(dNum)}
                          className={`h-8 rounded-lg text-xs font-bold tabular-nums transition border ${
                            isDisabledDay
                              ? 'opacity-20 cursor-not-allowed bg-transparent border-transparent text-slate-600'
                              : active
                              ? 'bg-blue-600 text-white border-blue-400 shadow-xs cursor-pointer'
                              : isToday
                              ? 'bg-[#282A2C] text-[#A8C7FA] border-blue-500/40 hover:bg-blue-600/30 cursor-pointer'
                              : 'bg-[#282A2C] text-slate-200 border-white/10 hover:bg-[#383B3F] hover:border-white/25 cursor-pointer'
                          }`}
                        >
                          {dNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inside Popover Quick EXP Presets */}
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 block">
                    กำหนดด่วนจากวันนี้:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {EXPIRY_PRESETS.map((preset) => (
                      <button
                        key={preset.months}
                        type="button"
                        onClick={() => handleApplyPreset(preset.months, true)}
                        className={`py-1.5 rounded-lg text-[10.5px] font-bold border transition cursor-pointer active:scale-95 ${
                          presetMatches[preset.months]
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[#282A2C] text-slate-200 border-white/10 hover:bg-[#383B3F]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Popover Footer Actions */}
              <div className="px-3.5 py-2.5 border-t border-white/10 bg-[#171819] flex items-center justify-between gap-2 shrink-0">
                {onClear ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setIsOpen(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-[11px] font-bold transition cursor-pointer"
                  >
                    ล้างวันที่
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextIso = formatPartsToIso(draftYear, draftMonth, draftDay);
                    onChange(nextIso);
                    setIsOpen(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Check size={13} />
                  <span>ใช้ {formatPartsToIso(draftYear, draftMonth, draftDay).split('-').reverse().join('/')}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
