import React, { useState } from 'react';
import { OfficialReportItemRow, formatAcquiredDate, formatThaiDate } from './OfficialReportModal';
import { getMonthAndYearThai } from './DrugInventoryReportPreview';
import { Calendar, User as UserIcon, Building2 } from 'lucide-react';

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
}) => {
  const currentWeek = propActiveWeek || getWeekOfMonth(surveyDate);
  const { month, year } = getMonthAndYearThai(surveyDate);
  const shortDate = formatShortDmy(surveyDate);

  const [internalWeekDates, setInternalWeekDates] = useState<{ [key: number]: string }>({
    1: currentWeek === 1 ? shortDate : '',
    2: currentWeek === 2 ? shortDate : '',
    3: currentWeek === 3 ? shortDate : '',
    4: currentWeek === 4 ? shortDate : '',
    5: currentWeek === 5 ? shortDate : '',
  });

  const resolvedWeekDates = propWeekDates || internalWeekDates;

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

  // 1. Header Layout
  const headingTitle =
    type === 'cart'
      ? `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} / ปี ${year}  หน่วยงาน: ${agencyName}`
      : `ตารางตรวจเช็คกระเป๋ายา Emergency ประจำเดือน ${month} / ปี ${year}`;

  // Group items by their section/group
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
      className="a4-page-sheet a4-print-container paper-preview sheet-preview isolate !bg-white !text-black p-6 rounded-lg shadow"
      style={{
        display: 'inline-block',
        width: 'max-content',
        minWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff !important',
        background: '#ffffff !important',
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
        .a4-print-container td, 
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
        /* Specifically target icons if any */
        .a4-page-sheet svg,
        .a4-print-container svg {
          color: #000000 !important;
        }
        /* Fix for input placeholders and text */
        .a4-page-sheet input::placeholder,
        .a4-print-container input::placeholder {
          color: #94a3b8 !important;
        }
        .a4-page-sheet input,
        .a4-print-container input {
          color: #000000 !important;
        }
      `}</style>
      {/* Week Selector & Quick Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            รอบสัปดาห์ที่ตรวจ:
          </span>
          {[1, 2, 3, 4, 5].map((w) => (
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
      <div className="text-center mb-4" style={{ backgroundColor: '#ffffff !important', background: '#ffffff !important' }}>
        <h2 className="text-2xl font-bold tracking-wide" style={{ fontSize: '18pt', color: '#000000 !important' }}>
          {headingTitle}
        </h2>
        {type === 'bag' && (
          <p className="text-sm font-semibold mt-1 flex items-center justify-center gap-1.5" style={{ fontSize: '12pt', color: '#000000 !important' }}>
            <Building2 className="w-4 h-4" style={{ color: '#000000 !important' }} />
            หน่วยงาน: {agencyName}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center text-sm font-medium mb-3" style={{ fontSize: '11pt', color: '#000000 !important', backgroundColor: '#ffffff !important', background: '#ffffff !important' }}>
        <div>
          <span style={{ color: '#000000 !important' }}>{agencyName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1" style={{ color: '#000000 !important' }}>
            <Calendar className="w-4 h-4" style={{ color: '#000000 !important' }} />
            วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(surveyDate)}
          </span>
          {inspector && (
            <span className="flex items-center gap-1 font-medium" style={{ color: '#000000 !important' }}>
              <UserIcon className="w-4 h-4" style={{ color: '#000000 !important' }} />
              ผู้ตรวจ: {inspector}
            </span>
          )}
        </div>
      </div>

      <table
        className="w-full border-collapse border border-slate-400"
        style={{
          minWidth: '850px',
          fontSize: '12pt',
          color: '#000000 !important',
          backgroundColor: '#ffffff !important'
        }}
      >
        <thead>
          <tr className="font-bold text-center" style={{ fontSize: '12pt', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
            {/* Col 1: รายการ (280px, left) */}
            <th
              rowSpan={2}
              className="border border-slate-400 p-2"
              style={{ width: '280px', minWidth: '260px', textAlign: 'center', verticalAlign: 'middle' }}
            >
              รายการ
            </th>
            {/* Col 2: จำนวน (60px, center, nowrap) */}
            <th
              rowSpan={2}
              className="border border-slate-400 p-2"
              style={{ width: '60px', minWidth: '60px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
            >
              จำนวน
            </th>
            {/* Col 3-7: สัปดาห์ที่ 1 ถึง สัปดาห์ที่ 5 (75px each) */}
            {[1, 2, 3, 4, 5].map((w) => (
              <th
                key={w}
                className={`border border-slate-400 p-1.5 text-center ${
                  currentWeek === w ? 'bg-blue-50/80 text-blue-900 font-bold' : ''
                }`}
                style={{ width: '75px', minWidth: '70px', verticalAlign: 'middle' }}
              >
                สัปดาห์ที่ {w}
              </th>
            ))}
            {/* Col 8: วันหมดอายุ (EXP) (100px, center, nowrap) */}
            <th
              rowSpan={2}
              className="border border-slate-400 p-2"
              style={{ width: '100px', minWidth: '95px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}
            >
              วันหมดอายุ (EXP)
            </th>
          </tr>
          {/* Header Row 2: ระบุวันที่ตรวจ (DD/MM/YY) */}
          <tr className="text-center text-xs" style={{ fontSize: '10pt', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
            {[1, 2, 3, 4, 5].map((w) => {
              const wkDate = resolvedWeekDates[w] || (currentWeek === w ? shortDate : '');
              return (
                <th
                  key={w}
                  className={`border border-slate-400 p-1 text-center font-normal ${
                    currentWeek === w ? 'bg-blue-50/80 font-semibold text-blue-900' : ''
                  }`}
                  style={{ width: '75px' }}
                >
                  <input
                    type="text"
                    value={wkDate}
                    onChange={(e) => handleDateChange(w, e.target.value)}
                    placeholder="ว/ด/ป"
                    className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-xs p-0 text-slate-800"
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedItems).map(([gName, groupRows], gIdx) => (
            <React.Fragment key={gName || gIdx}>
              {/* Category / Sub-section Banner Row */}
              <tr className="font-bold" style={{ backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
                <td
                  colSpan={8}
                  className="border border-slate-300 p-1.5 pl-3 text-left font-bold"
                  style={{ textAlign: 'left', paddingLeft: '12px', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}
                >
                  📁 {gName}
                </td>
              </tr>
              {/* Group items rows */}
              {groupRows.map((item, idx) => {
                const itemKey = `${item.name}|${item.code || ''}`;
                const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
                const isBad = item.res ? item.res.includes('ไม่ได้') : false;
                const isMiss = item.res ? item.res.includes('ไม่พบ') : false;

                const checkSymbol = isOk ? '✓' : isBad ? '✗' : isMiss ? '?' : '-';

                const expStr = item.exp || (item as any).expDate || (item.note?.match(/Exp:\s*([^\s|]+)/)?.[1]) || '';
                const formattedExp = expStr ? formatAcquiredDate(expStr) : '-';

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {/* Col 1: รายการ (ชิดซ้าย, padding-left: 8px) */}
                    <td
                      className="border border-slate-300 p-2 font-normal"
                      style={{ textAlign: 'left', paddingLeft: '8px' }}
                    >
                      {item.name || '-'}
                    </td>
                    {/* Col 2: จำนวน (ตรงกลาง, nowrap) */}
                    <td
                      className="border border-slate-300 p-2 text-center"
                      style={{ textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      {item.qty || '1'}
                    </td>
                    {/* Col 3-7: สัปดาห์ที่ 1 ถึง 5 */}
                    {[1, 2, 3, 4, 5].map((w) => {
                      const customVal = resolvedWeekValues[itemKey]?.[w];
                      const itemWeekVal = item.weekVals?.[w];

                      let displayVal = '-';
                      if (customVal !== undefined) {
                        displayVal = customVal;
                      } else if (itemWeekVal !== undefined) {
                        displayVal = itemWeekVal;
                      } else if (currentWeek === w) {
                        displayVal = item.val || checkSymbol;
                      }

                      const isValOk = displayVal === '✓' || displayVal.toLowerCase() === 'ok';
                      const isValBad = displayVal === '✗' || displayVal.toLowerCase() === 'fail';
                      const isValEmpty = displayVal === '-' || displayVal === '';

                      return (
                        <td
                          key={w}
                          className={`border border-slate-300 p-0 text-center ${
                            currentWeek === w ? 'bg-blue-50/40' : ''
                          }`}
                          style={{ textAlign: 'center', width: '75px', minWidth: '70px' }}
                        >
                          <input
                            type="text"
                            value={isValEmpty ? '' : displayVal}
                            placeholder="-"
                            onChange={(e) => handleCellValChange(itemKey, w, e.target.value)}
                            className={`w-full h-8 text-center bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded text-xs p-1 outline-none font-semibold ${
                              isValOk
                                ? 'text-emerald-700 text-sm font-bold'
                                : isValBad
                                ? 'text-rose-700 text-sm font-bold'
                                : isValEmpty
                                ? 'text-slate-400'
                                : 'text-slate-900 font-bold'
                            }`}
                            title={`สัปดาห์ที่ ${w}: พิมพ์ค่าที่ตรวจได้ เช่น 1, 2, 1400/1700 PSI หรือ ✓, ✗`}
                          />
                        </td>
                      );
                    })}
                    {/* Col 8: วันหมดอายุ (EXP) (ตรงกลาง, nowrap) */}
                    <td
                      className="border border-slate-300 p-2 text-center text-xs"
                      style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11pt' }}
                    >
                      {formattedExp}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold" style={{ fontSize: '11pt', color: '#000000 !important', backgroundColor: '#ffffff !important' }}>
            <td
              colSpan={2}
              className="border border-slate-400 p-2 text-center font-bold"
              style={{ textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}
            >
              ผู้ตรวจสอบ 1 (ผู้ตรวจเช็ค)
            </td>
            {[1, 2, 3, 4, 5].map((w) => (
              <td
                key={w}
                className={`border border-slate-400 p-1.5 text-center text-xs ${
                  currentWeek === w ? 'font-bold' : ''
                }`}
                style={{ textAlign: 'center', verticalAlign: 'middle', fontSize: '10pt', backgroundColor: currentWeek === w ? '#f1f5f9 !important' : '#ffffff !important', color: '#000000 !important' }}
              >
                {currentWeek === w ? (
                  <div className="flex flex-col items-center justify-center min-h-[36px]">
                    {signature && (
                      <img
                        src={signature}
                        alt="ลายเซ็น"
                        className="max-h-7 max-w-[65px] object-contain mb-0.5"
                      />
                    )}
                    <span style={{ color: '#000000 !important' }}>{inspector || '....................'}</span>
                  </div>
                ) : (
                  '....................'
                )}
              </td>
            ))}
            <td className="border border-slate-400 p-2 text-center" style={{ color: '#000000 !important' }}>-</td>
          </tr>
          <tr className="font-semibold" style={{ fontSize: '11pt', color: '#000000 !important', backgroundColor: '#ffffff !important' }}>
            <td
              colSpan={2}
              className="border border-slate-400 p-2 text-center font-bold"
              style={{ textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}
            >
              ผู้ตรวจสอบ 2 (หัวหน้างาน/ผู้รับรอง)
            </td>
            {[1, 2, 3, 4, 5].map((w) => (
              <td
                key={w}
                className="border border-slate-400 p-2 text-center text-xs"
                style={{ textAlign: 'center', verticalAlign: 'middle', fontSize: '10pt', color: '#000000 !important' }}
              >
                ....................
              </td>
            ))}
            <td className="border border-slate-400 p-2 text-center" style={{ color: '#000000 !important' }}>-</td>
          </tr>
        </tfoot>
      </table>

      {/* Note under table */}
      <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
        <p>* เกณฑ์การตรวจสอบ: สัญลักษณ์ ✓ = ปกติ/พร้อมใช้งาน, ✗ = ผิดปกติ/ต้องเปลี่ยนทดแทน, - = ยังไม่ได้ตรวจ</p>
        <p>เอกสารรับรองระบบคุณภาพงานวิสัญญีวิทยา</p>
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
  } = {}
): string {
  const {
    date = '',
    inspector = '',
    signature = '',
    agencyName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
    activeWeek = getWeekOfMonth(date),
    weekDates = {},
    weekItemValues = {},
  } = options;

  const { month, year } = getMonthAndYearThai(date);
  const shortDate = formatShortDmy(date);

  const headingTitle =
    type === 'cart'
      ? `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} / ปี ${year}  หน่วยงาน: ${agencyName}`
      : `ตารางตรวจเช็คกระเป๋ายา Emergency ประจำเดือน ${month} / ปี ${year}`;

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
          <td colspan="8" style="padding: 4px 8px; text-align: left; border: 1px solid #000; font-size: 10.5pt;">
            📁 ${gName}
          </td>
        </tr>
      `;

      const rowsHtml = groupRows
        .map((item) => {
          const itemKey = `${item.name}|${item.code || ''}`;
          const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
          const isBad = item.res ? item.res.includes('ไม่ได้') : false;
          const isMiss = item.res ? item.res.includes('ไม่พบ') : false;

          const checkSymbol = isOk ? '✓' : isBad ? '✗' : isMiss ? '?' : '-';

          const expStr = item.exp || (item as any).expDate || (item.note?.match(/Exp:\s*([^\s|]+)/)?.[1]) || '';
          const formattedExp = expStr ? formatAcquiredDate(expStr) : '-';

          const weekCells = [1, 2, 3, 4, 5]
            .map((w) => {
              const customVal = weekItemValues[itemKey]?.[w];
              const itemWeekVal = item.weekVals?.[w];

              let displayVal = '-';
              if (customVal !== undefined && customVal !== '') {
                displayVal = customVal;
              } else if (itemWeekVal !== undefined && itemWeekVal !== '') {
                displayVal = itemWeekVal;
              } else if (activeWeek === w) {
                displayVal = item.val || checkSymbol;
              }

              const isValOk = displayVal === '✓' || displayVal.toLowerCase() === 'ok';
              const isValBad = displayVal === '✗' || displayVal.toLowerCase() === 'fail';
              const isValEmpty = displayVal === '-' || displayVal === '';

              const cellStyle = isValOk
                ? 'color: #15803d; font-weight: bold; font-size: 11pt;'
                : isValBad
                ? 'color: #b91c1c; font-weight: bold; font-size: 11pt;'
                : isValEmpty
                ? 'color: #94a3b8;'
                : 'color: #0f172a; font-weight: bold; font-size: 9.5pt;';

              return `<td style="text-align: center; border: 1px solid #000; ${cellStyle}">${displayVal}</td>`;
            })
            .join('');

          return `
            <tr>
              <td style="text-align: left; padding-left: 8px; border: 1px solid #000;">${item.name || '-'}</td>
              <td style="text-align: center; border: 1px solid #000; white-space: nowrap;">${item.qty || '1'}</td>
              ${weekCells}
              <td style="text-align: center; border: 1px solid #000; white-space: nowrap; font-size: 9.5pt;">${formattedExp}</td>
            </tr>
          `;
        })
        .join('');

      return groupHeader + rowsHtml;
    })
    .join('');

  const weekHeadersHtml = [1, 2, 3, 4, 5]
    .map((w) => {
      const wkDate = weekDates[w] || (activeWeek === w ? shortDate : 'DD/MM/YY');
      return `<th style="width: 75px; text-align: center; border: 1px solid #000; font-size: 9.5pt; font-weight: normal;">${wkDate}</th>`;
    })
    .join('');

  const inspector1Cells = [1, 2, 3, 4, 5]
    .map((w) => {
      const isTarget = activeWeek === w;
      if (isTarget && (signature || inspector)) {
        return `<td style="text-align: center; border: 1px solid #000; font-size: 9pt; vertical-align: middle; padding: 2px;">
          ${signature ? `<img src="${signature}" style="max-height: 24px; max-width: 65px; object-fit: contain; display: block; margin: 0 auto 1px auto;" alt="ลายเซ็น" />` : ''}
          <span>${inspector || ''}</span>
        </td>`;
      }
      return `<td style="text-align: center; border: 1px solid #000; font-size: 9.5pt;">....................</td>`;
    })
    .join('');

  const inspector2Cells = [1, 2, 3, 4, 5]
    .map(() => `<td style="text-align: center; border: 1px solid #000; font-size: 9.5pt;">....................</td>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${headingTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');

          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            font-family: 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
            background: #fff;
            font-size: 11pt;
            line-height: 1.25;
          }

          .title-area {
            text-align: center;
            margin-bottom: 6px;
          }

          .title-area h2 {
            margin: 0;
            font-size: 16pt;
            font-weight: bold;
          }

          .title-area p {
            margin: 2px 0 0 0;
            font-size: 11.5pt;
            font-weight: 600;
          }

          .meta-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10.5pt;
            font-weight: 600;
            margin-bottom: 6px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
          }

          thead {
            display: table-header-group !important; /* Force repeat header on every printed page */
          }

          tr {
            page-break-inside: avoid !important;
          }

          th, td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: middle;
          }

          th {
            background-color: #f1f5f9;
            font-weight: bold;
            text-align: center;
          }

          tfoot {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h2>${headingTitle}</h2>
          ${type === 'bag' ? `<p>หน่วยงาน: ${agencyName}</p>` : ''}
        </div>
        <div class="meta-header">
          <div>
            <span>${agencyName}</span>
          </div>
          <div>
            <span>วัน, เดือน, ปี ที่สำรวจ: ${formatThaiDate(date)}</span>
            ${inspector ? `<span style="margin-left: 18px;">ผู้ตรวจ: <strong>${inspector}</strong></span>` : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 280px; text-align: center;">รายการ</th>
              <th rowspan="2" style="width: 60px; text-align: center; white-space: nowrap;">จำนวน</th>
              <th colspan="5" style="text-align: center;">สัปดาห์ที่ 1 - 5</th>
              <th rowspan="2" style="width: 100px; text-align: center; white-space: nowrap;">วันหมดอายุ (EXP)</th>
            </tr>
            <tr>
              ${weekHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${tableBodyHtml || '<tr><td colspan="8" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการ</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="2" style="text-align: center; border: 1px solid #000;">ผู้ตรวจสอบ 1 (ผู้ตรวจเช็ค)</td>
              ${inspector1Cells}
              <td style="text-align: center; border: 1px solid #000;">-</td>
            </tr>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="2" style="text-align: center; border: 1px solid #000;">ผู้ตรวจสอบ 2 (หัวหน้างาน/ผู้รับรอง)</td>
              ${inspector2Cells}
              <td style="text-align: center; border: 1px solid #000;">-</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
}
