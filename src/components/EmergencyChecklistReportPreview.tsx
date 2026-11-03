import React, { useState, useMemo, useEffect } from 'react';
import {
  OfficialReportItemRow,
  formatAcquiredDate,
  formatThaiDate,
  stripEmojis,
  isCurrentYearExp,
  parseSubExpItems,
  formatRealQuantity,
  cleanQuantityUnit,
  formatStrictCountableNumbers,
} from './OfficialReportModal';
import { getMonthAndYearThai } from './DrugInventoryReportPreview';
import { Calendar, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { getWednesdaysInfoForMonth } from '../utils/wednesdayUtils';

export function getWeekOfMonth(dateStr?: string): number {
  if (!dateStr) return 1;
  const isoMatch = String(dateStr).match(/\d{4}[-/.]\d{1,2}[-/.](\d{1,2})/);
  if (isoMatch) {
    const day = parseInt(isoMatch[1], 10);
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
  }
  const dmyMatch = String(dateStr).match(/^(\d{1,2})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
  }
  return 1;
}

export function formatShortDmy(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '';
  const isoMatch = String(dateStr).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    const shortYear = String(y < 2400 ? y + 543 : y).slice(-2);
    return `${d}/${m}/${shortYear}`;
  }
  const dmyMatch = String(dateStr).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const y = parseInt(dmyMatch[3], 10);
    const shortYear = String(y < 2400 ? y + 543 : y).slice(-2);
    return `${d}/${m}/${shortYear}`;
  }
  return dateStr;
}

export { getWednesdaysInfoForMonth, calculateWednesdaysForMonth } from '../utils/wednesdayUtils';

export interface EmergencyChecklistReportPreviewProps {
  type: 'bag' | 'cart';
  title?: string;
  items: OfficialReportItemRow[];
  date?: string;
  inspector?: string;
  agencyName?: string;
  activeWeek?: number;
  onActiveWeekChange?: (week: number) => void;
  weekDates?: { [key: number]: string };
  onWeekDatesChange?: (dates: { [key: number]: string }) => void;
  weekItemValues?: { [itemKey: string]: { [week: number]: string } };
  onWeekItemValuesChange?: (values: { [itemKey: string]: { [week: number]: string } }) => void;
  signature?: string;
  currentUser?: User | null;
}

export const EmergencyChecklistReportPreview: React.FC<EmergencyChecklistReportPreviewProps> = ({
  type,
  items = [],
  date: surveyDate = '',
  inspector = '',
  signature = '',
  agencyName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
  activeWeek: propActiveWeek,
  onActiveWeekChange,
  weekDates: propWeekDates,
  onWeekDatesChange,
  weekItemValues: propWeekItemValues,
  onWeekItemValuesChange,
  currentUser = null,
}) => {
  const inspectorRole = currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่';
  const rawInspector = (inspector || currentUser?.name || 'คุณสาทิตย์ บุตรน้ำเพชร').trim();

  // Sanitize agencyName
  const cleanAgency = React.useMemo(() => {
    let a = String(agencyName || '').trim();
    a = a.replace(/^หน่วยงาน\s*:?\s*/g, '');
    a = a.replace(/^แบบฟอร์ม.*$/g, '');
    if (!a || a.includes('แบบฟอร์ม')) {
      a = 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    }
    return a;
  }, [agencyName]);

  // Dynamic Wednesday Calculation for selected month/year
  const wedInfo = useMemo(() => {
    return getWednesdaysInfoForMonth(surveyDate);
  }, [surveyDate]);

  const { dates: defaultWednesdays, totalWednesdays, weeks, monthNameThai, yearBE } = wedInfo;

  const currentWeek = useMemo(() => {
    const rawWk = propActiveWeek || getWeekOfMonth(surveyDate);
    return rawWk > totalWednesdays ? totalWednesdays : rawWk;
  }, [propActiveWeek, surveyDate, totalWednesdays]);

  const { month, year } = useMemo(() => {
    if (monthNameThai && yearBE) {
      return { month: monthNameThai, year: String(yearBE) };
    }
    return getMonthAndYearThai(surveyDate);
  }, [monthNameThai, yearBE, surveyDate]);

  const shortDate = formatShortDmy(surveyDate);

  const [internalWeekDates, setInternalWeekDates] = useState<{ [key: number]: string }>(() => {
    const initial: { [key: number]: string } = {};
    for (let wk = 1; wk <= 5; wk++) {
      initial[wk] = currentWeek === wk ? shortDate : defaultWednesdays[wk] || '';
    }
    return initial;
  });

  const resolvedWeekDates = useMemo(() => {
    const dates = propWeekDates || internalWeekDates;
    const formatted: Record<number, string> = {};
    for (let wk = 1; wk <= totalWednesdays; wk++) {
      const d = dates[wk];
      if (d && d.trim() && d !== '-' && !d.includes('....')) {
        formatted[wk] = formatShortDmy(d);
      } else {
        formatted[wk] = defaultWednesdays[wk] || '';
      }
    }
    return formatted;
  }, [propWeekDates, internalWeekDates, defaultWednesdays, totalWednesdays]);

  const handleDateChange = (wk: number, val: string) => {
    const updated = { ...resolvedWeekDates, [wk]: val };
    if (onWeekDatesChange) {
      onWeekDatesChange(updated);
    } else {
      setInternalWeekDates(updated);
    }
  };

  const [internalWeekValues, setInternalWeekValues] = useState<{ [itemKey: string]: { [week: number]: string } }>({});
  const resolvedWeekValues = propWeekItemValues || internalWeekValues;

  const effectiveStoredName = typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
  const defaultInspector1 = (effectiveStoredName || inspector || currentUser?.name || 'สาธิต').trim();
  const [inspectors1, setInspectors1] = useState<{ [week: number]: string }>(() => {
    const init: { [week: number]: string } = {};
    for (let w = 1; w <= 5; w++) init[w] = defaultInspector1;
    return init;
  });

  useEffect(() => {
    setInspectors1((prev) => {
      const next = { ...prev };
      for (let w = 1; w <= 5; w++) {
        if (!next[w] || next[w] === '-' || next[w] === 'คุณสาทิตย์ บุตรน้ำเพชร' || next[w] === 'ผู้ดูแลระบบ (Admin)') {
          next[w] = defaultInspector1;
        }
      }
      return next;
    });
  }, [defaultInspector1]);

  const [inspectors2, setInspectors2] = useState<{ [week: number]: string }>({
    1: '', 2: '', 3: '', 4: '', 5: '',
  });

  const handleCellValChange = (itemKey: string, week: number, val: string) => {
    const updated = {
      ...resolvedWeekValues,
      [itemKey]: {
        ...(resolvedWeekValues[itemKey] || {}),
        [week]: val,
      },
    };
    if (onWeekItemValuesChange) {
      onWeekItemValuesChange(updated);
    } else {
      setInternalWeekValues(updated);
    }
  };

  const headingTitle =
    type === 'cart'
      ? `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} พ.ศ. ${year}`
      : `ตารางตรวจเช็คกระเป๋า Emergency ประจำเดือน ${month} พ.ศ. ${year}`;

  const groupedItems = React.useMemo(() => {
    const groups: { [g: string]: OfficialReportItemRow[] } = {};
    items.forEach((item) => {
      let gName = item.group;
      if (!gName && item.location) {
        const match = item.location.match(/\((.*?)\)/);
        if (match) gName = match[1];
      }
      if (!gName) gName = 'เวชภัณฑ์และอุปกรณ์ทั่วไป';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(item);
    });
    return groups;
  }, [items]);

  return (
    <div
      className="a4-page-sheet a4-print-container paper-preview sheet-preview isolate !bg-white !text-black"
      style={{
        width: '100%',
        margin: '0 auto',
        padding: '8px 16px',
        boxSizing: 'border-box',
        overflow: 'visible',
        background: '#ffffff',
        borderRadius: '8px',
        backgroundColor: '#ffffff !important',
        color: '#000000 !important',
        fontFamily: "'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
      }}
    >
      <style>{`
        .a4-page-sheet,
        .a4-page-sheet *,
        .a4-print-container, 
        .a4-print-container *, 
        .a4-print-container table, 
        .a4-print-container thead, 
        .a4-print-container tbody, 
        .a4-print-container tfoot,
        .a4-print-container tr, 
        .a4-print-container th, 
        .a4-print-container td {
          background-color: #ffffff !important;
          color: #000000 !important;
          border-color: #cbd5e1 !important;
          background-image: none !important;
          color-scheme: light !important;
          white-space: normal;
          word-break: keep-all !important;
          padding: 6px 4px !important;
          overflow: visible !important;
          line-height: 1.3 !important;
          font-size: 11px !important;
          vertical-align: middle !important;
          height: auto !important;
        }
        .a4-print-container .nowrap {
          white-space: nowrap !important;
        }
        .a4-print-container p, 
        .a4-print-container span, 
        .a4-print-container div,
        .a4-print-container input {
          background-color: #ffffff !important;
          color: #000000 !important;
          border-color: #cbd5e1 !important;
          background-image: none !important;
          color-scheme: light !important;
        }
        .a4-page-sheet th,
        .a4-print-container th, 
        .a4-print-container .bg-slate-100,
        .a4-print-container thead tr,
        .a4-print-container .bg-slate-50,
        .a4-print-container tfoot tr {
          background-color: #f1f5f9 !important;
          color: #000000 !important;
        }
        .a4-page-sheet svg,
        .a4-print-container svg {
          color: #000000 !important;
        }
        .a4-page-sheet input::placeholder,
        .a4-print-container input::placeholder {
          color: #94a3b8 !important;
        }
        .a4-page-sheet input,
        .a4-print-container input {
          color: #000000 !important;
        }
      `}</style>

      {/* Week Selector Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            รอบสัปดาห์ที่ตรวจ ({totalWednesdays} สัปดาห์):
          </span>
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onActiveWeekChange && onActiveWeekChange(w)}
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer text-xs ${
                currentWeek === w
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              สัปดาห์ที่ {w} {currentWeek === w ? '✓' : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
          <span>
            จำนวนรวม: <b>{items.length}</b> รายการ
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            รอบตรวจสัปดาห์ที่ {currentWeek} ({shortDate || '-'})
          </span>
        </div>
      </div>

      {/* 1. Header Layout */}
      <div className="text-center mb-2" style={{ backgroundColor: '#ffffff !important', background: '#ffffff !important', overflow: 'visible', textAlign: 'center', width: '100%', margin: '0 auto 6px auto' }}>
        <h2 className="text-2xl font-bold tracking-wide" style={{ fontSize: '18pt', color: '#000000 !important', lineHeight: '1.3', overflow: 'visible', fontWeight: 'bold', margin: 0 }}>
          {headingTitle}
        </h2>
      </div>

      <div className="flex justify-between items-center text-sm font-medium mb-2.5" style={{ fontSize: '12px', color: '#000000 !important', backgroundColor: '#ffffff !important', background: '#ffffff !important', overflow: 'visible', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
        <div>
          <span style={{ color: '#000000 !important', lineHeight: '1.4', fontWeight: 'bold', fontSize: '12pt' }}>หน่วยงาน: {cleanAgency}</span>
        </div>
        <div className="flex items-center gap-4" style={{ display: 'flex', gap: '24px' }}>
          <span className="flex items-center gap-1" style={{ color: '#000000 !important', lineHeight: '1.4' }}>
            <Calendar className="w-4 h-4" style={{ color: '#000000 !important' }} />
            วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(surveyDate)}
          </span>
          {inspector && (
            <span className="flex items-center gap-1 font-medium" style={{ color: '#000000 !important', lineHeight: '1.4' }}>
              <UserIcon className="w-4 h-4" style={{ color: '#000000 !important' }} />
              ผู้ตรวจ: {inspector}
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }}>
      <table
        className="border-collapse border border-slate-400"
        style={{
          width: '100%',
          minWidth: '880px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: '12px',
          lineHeight: '1.4',
          color: '#000000 !important',
          backgroundColor: '#ffffff !important',
          margin: '0 auto'
        }}
      >
        <thead>
          <tr className="font-bold text-center" style={{ fontSize: '12pt', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
            {/* Col 1: รายการ */}
            <th
              rowSpan={2}
              className="border border-slate-400"
              style={{ width: '280px', minWidth: '220px', textAlign: 'center', verticalAlign: 'middle', paddingLeft: '10px', lineHeight: '1.4 !important', padding: '6px 4px !important' }}
            >
              รายการ
            </th>
            {/* Col 2: จำนวนตั้งต้น */}
            <th
              rowSpan={2}
              className="border border-slate-400 nowrap"
              style={{ width: '85px', minWidth: '85px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.4 !important', padding: '6px 4px !important' }}
            >
              จำนวนตั้งต้น
            </th>
            {/* Col 3: สัปดาห์ที่ตรวจ (Colspan dynamically 4 or 5) */}
            <th
              colSpan={totalWednesdays}
              className="border border-slate-400"
              style={{ verticalAlign: 'middle', lineHeight: '1.4 !important', padding: '6px 4px !important', textAlign: 'center' }}
            >
              สัปดาห์ที่ตรวจ
            </th>
            {/* Col 4: วันหมดอายุ (EXP) */}
            <th
              rowSpan={2}
              className="border border-slate-400"
              style={{ width: '120px', minWidth: '120px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.4 !important', padding: '6px 4px !important' }}
            >
              วันหมดอายุ (EXP)
            </th>
          </tr>
          {/* Header Row 2: dynamic weeks header */}
          <tr className="text-center text-xs" style={{ fontSize: '10pt', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
            {weeks.map((w) => {
              const wkDate = resolvedWeekDates[w] || (currentWeek === w ? shortDate : '');
              return (
                <th
                  key={w}
                  className={`border border-slate-400 p-1 text-center font-semibold ${
                    currentWeek === w ? 'bg-blue-50/80 font-bold text-blue-900' : ''
                  }`}
                  style={{ width: `${375 / totalWednesdays}px` }}
                >
                  <div className="font-bold text-[11px] text-black">สัปดาห์ที่ {w}</div>
                  <input
                    type="text"
                    value={wkDate}
                    onChange={(e) => handleDateChange(w, e.target.value)}
                    placeholder="ว/ด/ป"
                    className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-[10px] p-0 text-slate-800 font-semibold"
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedItems).map(([gName, groupRows], gIdx) => (
            <React.Fragment key={gName || gIdx}>
              {/* Category Banner Row */}
              <tr className="font-bold" style={{ backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
                <td
                  colSpan={3 + totalWednesdays}
                  className="border border-slate-300 p-1.5 pl-3 text-left font-bold"
                  style={{ textAlign: 'left', paddingLeft: '12px', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}
                >
                  {stripEmojis(gName)}
                </td>
              </tr>
              {/* Group items rows */}
              {groupRows.map((item, idx) => {
                const itemKey = `${item.name}|${item.code || ''}`;
                const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
                const isBad = item.res ? item.res.includes('ไม่ได้') : false;
                const isMiss = item.res ? item.res.includes('ไม่พบ') : false;

                const expStr = item.exp || (item as any).expDate || (item.note?.match(/Exp:\s*([^\s|]+)/)?.[1]) || '';

                // Real sub-item quantity calculation preserving user configuration
                const realCheckVal = formatRealQuantity(item.qty, item.name, item.spec, item.exp, (item as any).subItemQuantities);

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td
                      className="border border-slate-300"
                      style={{ textAlign: 'left', paddingLeft: '10px', lineHeight: '1.4 !important', padding: '6px 4px !important' }}
                    >
                      {item.name || '-'}
                    </td>
                    <td
                      className="border border-slate-300 nowrap font-bold"
                      style={{ textAlign: 'center', whiteSpace: 'nowrap', lineHeight: '1.4 !important', padding: '6px 4px !important' }}
                    >
                      {realCheckVal || item.qty || '1'}
                    </td>
                    {weeks.map((w) => {
                      const customVal = resolvedWeekValues[itemKey]?.[w];
                      const itemWeekVal = item.weekVals?.[w];

                      let displayVal = '-';
                      if (customVal !== undefined && customVal !== '') {
                        displayVal = formatStrictCountableNumbers(customVal);
                      } else if (itemWeekVal !== undefined && itemWeekVal !== '') {
                        displayVal = formatStrictCountableNumbers(itemWeekVal);
                      } else if (currentWeek === w) {
                        if (item.val && item.val !== '✓') {
                          displayVal = formatStrictCountableNumbers(item.val);
                        } else if (isOk) {
                          displayVal = formatStrictCountableNumbers(realCheckVal || item.qty || '1');
                        } else if (isBad) {
                          displayVal = '✗';
                        } else if (isMiss) {
                          displayVal = '?';
                        }
                      }

                      if (realCheckVal && realCheckVal.includes(',')) {
                        if (displayVal === '1' || displayVal === '✓') {
                          displayVal = realCheckVal;
                        }
                      }

                      const isValBad = displayVal === '✗' || displayVal.toLowerCase() === 'fail' || (displayVal.toLowerCase().includes('psi') && parseInt(displayVal.replace(/\D/g, ''), 10) < 500);
                      const isValEmpty = displayVal === '-' || displayVal === '';

                      return (
                        <td
                          key={w}
                          className={`border border-slate-300 p-0 text-center ${
                            currentWeek === w ? 'bg-blue-50/40' : ''
                          }`}
                          style={{ textAlign: 'center', width: `${375 / totalWednesdays}px` }}
                        >
                          <input
                            type="text"
                            value={isValEmpty ? '' : displayVal}
                            placeholder="-"
                            onChange={(e) => handleCellValChange(itemKey, w, e.target.value)}
                            className={`w-full h-8 text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-xs p-1 outline-none font-bold ${
                              isValBad
                                ? 'text-rose-700 text-sm font-bold'
                                : isValEmpty
                                ? 'text-slate-400'
                                : 'text-black text-sm font-bold'
                            }`}
                            style={{ color: isValBad ? '#be123c' : isValEmpty ? '#94a3b8' : '#000000 !important' }}
                            title={`สัปดาห์ที่ ${w}`}
                          />
                        </td>
                      );
                    })}
                    <td
                      className="border border-slate-300 p-1.5 text-center text-xs"
                      style={{
                        width: '120px',
                        minWidth: '120px',
                        textAlign: 'center',
                        fontSize: '10.5pt',
                        lineHeight: '1.3',
                      }}
                    >
                      {((item.name?.toLowerCase().includes('tank') || item.name?.includes('ถัง')) && 
                        (item.name?.toLowerCase().includes('o2') || item.name?.toLowerCase().includes('oxygen') || item.name?.includes('ออกซิเจน')) &&
                        !(item.name?.toLowerCase().includes('cannula') || item.name?.toLowerCase().includes('mask') || item.name?.includes('หน้ากาก') || item.name?.includes('สาย')))
                        ? 'ปริมาณแรงดันไม่ต่ำกว่า 500 psi'
                        : (() => {
                            const subItems = parseSubExpItems(expStr);
                            if (subItems.length === 0) return '-';
                            return (
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                {subItems.map((sub, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      color: sub.isRed ? '#DC2626 !important' : '#000000 !important',
                                      fontWeight: sub.isRed ? 'bold' : 'normal',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {sub.label ? `${sub.label}: ${sub.formattedDate}` : sub.formattedDate}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}

          {/* Table Footer Row 1: ผู้ตรวจสอบ 1 */}
          <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
            <td
              className="border border-slate-400 font-bold"
              style={{ textAlign: 'left', paddingLeft: '10px', verticalAlign: 'middle', height: '36px' }}
            >
              ผู้ตรวจสอบ 1
            </td>
            <td className="border border-slate-400" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              -
            </td>
            {weeks.map((w) => {
              const hasActivity = !!resolvedWeekDates[w] || items.some((it) => {
                const ik = `${it.name}|${it.code || ''}`;
                return it.weekVals?.[w] || resolvedWeekValues[ik]?.[w];
              });
              const val = inspectors1[w] !== undefined && inspectors1[w] !== '' ? inspectors1[w] : (hasActivity ? defaultInspector1 : '-');
              return (
                <td key={w} className="border border-slate-400 p-0 text-center" style={{ width: `${375 / totalWednesdays}px`, verticalAlign: 'middle' }}>
                  <input
                    type="text"
                    value={val === '-' ? '' : val}
                    placeholder="-"
                    onChange={(e) => setInspectors1((prev) => ({ ...prev, [w]: e.target.value }))}
                    className="w-full h-8 text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-[10.5px] p-0.5 font-bold text-slate-800"
                    title={`ผู้ตรวจสอบ 1 สัปดาห์ที่ ${w}`}
                  />
                </td>
              );
            })}
            <td className="border border-slate-400" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              -
            </td>
          </tr>

          {/* Table Footer Row 2: ผู้ตรวจสอบ 2 */}
          <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
            <td
              className="border border-slate-400 font-bold"
              style={{ textAlign: 'left', paddingLeft: '10px', verticalAlign: 'middle', height: '36px' }}
            >
              ผู้ตรวจสอบ 2
            </td>
            <td className="border border-slate-400" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              -
            </td>
            {weeks.map((w) => {
              const val = inspectors2[w] || '';
              return (
                <td key={w} className="border border-slate-400 p-0 text-center" style={{ width: `${375 / totalWednesdays}px`, verticalAlign: 'middle' }}>
                  <input
                    type="text"
                    value={val}
                    placeholder="-"
                    onChange={(e) => setInspectors2((prev) => ({ ...prev, [w]: e.target.value }))}
                    className="w-full h-8 text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-[10.5px] p-0.5 font-bold text-slate-800"
                    title={`ผู้ตรวจสอบ 2 สัปดาห์ที่ ${w}`}
                  />
                </td>
              );
            })}
            <td className="border border-slate-400" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              -
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
};

export function generateEmergencyPrintHtml(
  type: 'bag' | 'cart',
  items: OfficialReportItemRow[],
  options: {
    date?: string;
    inspector?: string;
    agencyName?: string;
    activeWeek?: number;
    weekDates?: { [key: number]: string };
    weekItemValues?: { [itemKey: string]: { [week: number]: string } };
    signature?: string;
    orientation?: 'landscape' | 'portrait';
    currentUser?: User | null;
  } = {}
): string {
  const {
    date = '',
    inspector = '',
    agencyName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
    weekDates = {},
    weekItemValues = {},
    orientation = 'landscape',
    currentUser = null,
  } = options;

  const wedInfo = getWednesdaysInfoForMonth(date || new Date().toISOString());
  const { dates: defaultPrintWednesdays, totalWednesdays, weeks, monthNameThai, yearBE } = wedInfo;

  const activeWeek = options.activeWeek && options.activeWeek <= totalWednesdays ? options.activeWeek : 1;

  const effectiveStoredName = typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
  const printInspectorRaw = (effectiveStoredName || inspector || currentUser?.name || 'สาธิต').trim();

  const cleanPrintAgency = (() => {
    let a = String(agencyName || '').trim();
    a = a.replace(/^หน่วยงาน\s*:?\s*/g, '');
    a = a.replace(/^แบบฟอร์ม.*$/g, '');
    if (!a || a.includes('แบบฟอร์ม')) {
      a = 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    }
    return a;
  })();

  const month = monthNameThai || getMonthAndYearThai(date || new Date().toISOString()).month;
  const year = String(yearBE || getMonthAndYearThai(date || new Date().toISOString()).year);

  const headingTitle =
    type === 'cart'
      ? `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} พ.ศ. ${year}`
      : `ตารางตรวจเช็คกระเป๋า Emergency ประจำเดือน ${month} พ.ศ. ${year}`;

  const resolvedPrintWeekDates: Record<number, string> = {};
  for (let w = 1; w <= totalWednesdays; w++) {
    const rawVal = weekDates[w];
    if (rawVal && rawVal.trim() && rawVal !== '-' && !rawVal.includes('....')) {
      resolvedPrintWeekDates[w] = formatShortDmy(rawVal);
    } else {
      resolvedPrintWeekDates[w] = defaultPrintWednesdays[w] || '';
    }
  }

  // Group items by section
  const groups: { [g: string]: OfficialReportItemRow[] } = {};
  items.forEach((item) => {
    let gName = item.group;
    if (!gName && item.location) {
      const match = item.location.match(/\((.*?)\)/);
      if (match) gName = match[1];
    }
    if (!gName) gName = 'เวชภัณฑ์และอุปกรณ์ทั่วไป';
    if (!groups[gName]) groups[gName] = [];
    groups[gName].push(item);
  });

  const tableBodyHtml = Object.entries(groups)
    .map(([gName, groupRows]) => {
      const groupHeader = `
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="${3 + totalWednesdays}" style="padding: 4px 8px; text-align: left; border: 1px solid #000; font-size: 10.5pt;">
            ${stripEmojis(gName)}
          </td>
        </tr>
      `;

      const rowsHtml = groupRows
        .map((item) => {
          const itemKey = `${item.name}|${item.code || ''}`;
          const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
          const isBad = item.res ? item.res.includes('ไม่ได้') : false;
          const isMiss = item.res ? item.res.includes('ไม่พบ') : false;
          const expStr = item.exp || (item as any).expDate || (item.note?.match(/Exp:\s*([^\s|]+)/)?.[1]) || '';

          const expCellHtml = ((item.name?.toLowerCase().includes('tank') || item.name?.includes('ถัง')) && 
            (item.name?.toLowerCase().includes('o2') || item.name?.toLowerCase().includes('oxygen') || item.name?.includes('ออกซิเจน')) &&
            !(item.name?.toLowerCase().includes('cannula') || item.name?.toLowerCase().includes('mask') || item.name?.includes('หน้ากาก') || item.name?.includes('สาย')))
            ? 'ปริมาณแรงดันไม่ต่ำกว่า 500 psi'
            : (() => {
                const subItems = parseSubExpItems(expStr);
                if (subItems.length === 0) return '-';
                return subItems.map((sub) => {
                  const text = sub.label ? `${sub.label}: ${sub.formattedDate}` : sub.formattedDate;
                  const colorStyle = sub.isRed ? 'color: #DC2626 !important; font-weight: bold;' : 'color: #000000 !important; font-weight: normal;';
                  return `<div style="${colorStyle} white-space: nowrap; line-height: 1.3;">${text}</div>`;
                }).join('');
              })();

          const realCheckVal = formatRealQuantity(item.qty, item.name, item.spec, item.exp, (item as any).subItemQuantities);

          const weekCells = weeks
            .map((w) => {
              const customVal = weekItemValues[itemKey]?.[w];
              const itemWeekVal = item.weekVals?.[w];

              let displayVal = '-';
              if (customVal !== undefined && customVal !== '') {
                displayVal = formatStrictCountableNumbers(customVal);
              } else if (itemWeekVal !== undefined && itemWeekVal !== '') {
                displayVal = formatStrictCountableNumbers(itemWeekVal);
              } else if (activeWeek === w) {
                if (item.val && item.val !== '✓') {
                  displayVal = formatStrictCountableNumbers(item.val);
                } else if (isOk) {
                  displayVal = formatStrictCountableNumbers(realCheckVal || item.qty || '1');
                } else if (isBad) {
                  displayVal = '✗';
                } else if (isMiss) {
                  displayVal = '?';
                }
              }

              if (realCheckVal && realCheckVal.includes(',')) {
                if (displayVal === '1' || displayVal === '✓') {
                  displayVal = realCheckVal;
                }
              }

              const isValBad = displayVal === '✗' || displayVal.toLowerCase() === 'fail' || (displayVal.toLowerCase().includes('psi') && parseInt(displayVal.replace(/\D/g, ''), 10) < 500);
              const isValEmpty = displayVal === '-' || displayVal === '';

              const cellStyle = isValBad
                ? 'color: #b91c1c; font-weight: bold; font-size: 11pt;'
                : isValEmpty
                ? 'color: #94a3b8;'
                : 'color: #000000; font-weight: bold; font-size: 10.5pt;';

              return `<td style="text-align: center; border: 1px solid #000; ${cellStyle}">${displayVal}</td>`;
            })
            .join('');

          return `
            <tr>
              <td style="text-align: left; padding-left: 8px; border: 1px solid #000;">${item.name || '-'}</td>
              <td style="text-align: center; border: 1px solid #000; white-space: nowrap !important; font-weight: bold;">${realCheckVal || item.qty || '1'}</td>
              ${weekCells}
              <td style="text-align: center; border: 1px solid #000; font-size: 9pt; line-height: 1.3; padding: 4px 2px;">
                ${expCellHtml}
              </td>
            </tr>
          `;
        })
        .join('');

      return groupHeader + rowsHtml;
    })
    .join('');

  const printFooterRows = `
    <tr style="background-color: #f8fafc; font-weight: bold;">
      <td style="text-align: left; padding-left: 8px; border: 1px solid #000; font-weight: bold; height: 28px;">ผู้ตรวจสอบ 1</td>
      <td style="text-align: center; border: 1px solid #000;">-</td>
      ${weeks.map((w) => {
        const isWeekActive = !!weekDates[w] || items.some((it) => it.weekVals?.[w] || weekItemValues[`${it.name}|${it.code || ''}`]?.[w]);
        const val = isWeekActive ? printInspectorRaw : '-';
        return `<td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${val}</td>`;
      }).join('')}
      <td style="text-align: center; border: 1px solid #000;">-</td>
    </tr>
    <tr style="background-color: #f8fafc; font-weight: bold;">
      <td style="text-align: left; padding-left: 8px; border: 1px solid #000; font-weight: bold; height: 28px;">ผู้ตรวจสอบ 2</td>
      <td style="text-align: center; border: 1px solid #000;">-</td>
      ${weeks.map(() => `<td style="text-align: center; border: 1px solid #000; font-size: 9pt;">-</td>`).join('')}
      <td style="text-align: center; border: 1px solid #000;">-</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${headingTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
          @page { size: A4 ${orientation}; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; font-size: 11pt; line-height: 1.25; }
          .title-area { text-align: center; margin-bottom: 6px; }
          .title-area h2 { margin: 0; font-size: 16pt; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; }
          th, td { border: 1px solid #000; padding: 5px 4px; line-height: 1.3 !important; vertical-align: middle; }
          th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h2>${headingTitle}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 280px;">รายการ</th>
              <th rowspan="2" style="width: 85px;">จำนวนตั้งต้น</th>
              <th colspan="${totalWednesdays}">สัปดาห์ที่ตรวจ</th>
              <th rowspan="2" style="width: 100px;">วันหมดอายุ (EXP)</th>
            </tr>
            <tr>
              ${weeks.map(w => `<th style="width: ${375 / totalWednesdays}px;">สัปดาห์ที่ ${w}<br><small style="font-size:8.5pt; font-weight:normal;">${resolvedPrintWeekDates[w] || 'วัน,เดือน,ปี'}</small></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableBodyHtml ? (tableBodyHtml + printFooterRows) : `<tr><td colspan="${3 + totalWednesdays}" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการ</td></tr>`}
          </tbody>
        </table>
      </body>
    </html>
  `;
}
