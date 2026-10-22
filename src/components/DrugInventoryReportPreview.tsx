import React from 'react';
import { DrugItem, DrugCategory } from '../types';
import { formatAcquiredDate, formatThaiDate } from './OfficialReportModal';
import { Calendar, User as UserIcon, Tag } from 'lucide-react';

export function getMonthAndYearThai(dateStr?: string): { month: string; year: string } {
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  if (!dateStr || String(dateStr).trim() === '') {
    return { month: '................', year: '................' };
  }
  const str = String(dateStr).trim();

  for (let i = 0; i < 12; i++) {
    if (str.includes(thaiMonths[i])) {
      const yearMatch = str.match(/\b(25\d{2}|20\d{2})\b/);
      let year = '................';
      if (yearMatch) {
        const y = parseInt(yearMatch[1], 10);
        year = String(y < 2400 ? y + 543 : y);
      }
      return { month: thaiMonths[i], year };
    }
  }

  // ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    return {
      month: thaiMonths[m - 1] || '................',
      year: String(y < 2400 ? y + 543 : y),
    };
  }

  // DMY: DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    return {
      month: thaiMonths[m - 1] || '................',
      year: String(y < 2400 ? y + 543 : y),
    };
  }

  return { month: '................', year: '................' };
}

export function getDrugCategoryTitle(
  cat: 'all' | DrugCategory,
  dateStr?: string
): string {
  const { month, year } = getMonthAndYearThai(dateStr);
  if (cat === 'monthly') {
    return `ยาในคลัง เดือน ${month} / ปี ${year}`;
  }
  if (cat === 'quarterly') {
    return `ยาเบิกทุก 3 เดือน เดือน ${month} / ปี ${year}`;
  }
  if (cat === 'adhoc') {
    return `ยาเบิกเป็นครั้งๆ เดือน ${month} / ปี ${year}`;
  }
  return `รายงานคลังยาและสารน้ำ เดือน ${month} / ปี ${year}`;
}

export interface DrugInventoryReportPreviewProps {
  drugs: DrugItem[];
  date?: string;
  inspector?: string;
  clinicName?: string;
  subCategory?: 'all' | DrugCategory;
  onSubCategoryChange?: (cat: 'all' | DrugCategory) => void;
  headerNote?: string;
  onHeaderNoteChange?: (note: string) => void;
  editableNote?: boolean;
}

export const DrugInventoryReportPreview: React.FC<DrugInventoryReportPreviewProps> = ({
  drugs = [],
  date: surveyDate = '',
  inspector = '',
  clinicName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
  subCategory = 'monthly',
  onSubCategoryChange,
  headerNote = '(เพิ่ม Column Exp.)',
  onHeaderNoteChange,
  editableNote = true,
}) => {
  // Filter drugs based on subCategory
  const displayedDrugs = React.useMemo(() => {
    if (subCategory === 'all') return drugs;
    return drugs.filter((d) => d.category === subCategory);
  }, [drugs, subCategory]);

  const mainHeading = getDrugCategoryTitle(subCategory, surveyDate);

  return (
    <div
      className="paper-preview sheet-preview bg-white p-6 rounded-lg shadow text-slate-900"
      style={{
        display: 'inline-block',
        width: 'max-content',
        minWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        fontFamily: "'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
      }}
    >
      {/* Sub-category selector pills for Drug Preview */}
      {onSubCategoryChange && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              หมวดหมู่ยา:
            </span>
            <button
              type="button"
              onClick={() => onSubCategoryChange('monthly')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                subCategory === 'monthly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              💊 ยาในคลัง (รายเดือน)
            </button>
            <button
              type="button"
              onClick={() => onSubCategoryChange('quarterly')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                subCategory === 'quarterly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              📦 ยาเบิกทุก 3 เดือน
            </button>
            <button
              type="button"
              onClick={() => onSubCategoryChange('adhoc')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                subCategory === 'adhoc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ⚡ ยาเบิกเป็นครั้งๆ
            </button>
            <button
              type="button"
              onClick={() => onSubCategoryChange('all')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                subCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              📑 ทั้งหมด ({drugs.length})
            </button>
          </div>

          {/* Editable Header Note (e.g., '(เพิ่ม Column Exp.)') */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">หมายเหตุหัวฟอร์ม:</span>
            {editableNote && onHeaderNoteChange ? (
              <input
                type="text"
                value={headerNote}
                onChange={(e) => onHeaderNoteChange(e.target.value)}
                placeholder="เช่น (เพิ่ม Column Exp.)"
                className="border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 bg-amber-50/60 focus:bg-white focus:outline-blue-500 font-medium w-48"
              />
            ) : (
              <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold">
                {headerNote}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 1. Header Layout */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-wide" style={{ fontSize: '18pt' }}>
          {mainHeading}
        </h2>
        {headerNote && (
          <p className="text-sm font-semibold text-amber-800 mt-0.5" style={{ fontSize: '11pt' }}>
            {headerNote}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center text-sm text-slate-700 font-medium mb-3" style={{ fontSize: '11pt' }}>
        <div>
          <span className="font-semibold text-slate-900">{clinicName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(surveyDate)}
          </span>
          {inspector && (
            <span className="flex items-center gap-1 font-medium text-slate-800">
              <UserIcon className="w-4 h-4 text-slate-400" />
              ผู้ตรวจ: {inspector}
            </span>
          )}
        </div>
      </div>

      {/* 2. Standard 8-Column Table Grid */}
      <table
        className="w-full border-collapse border border-slate-400 text-slate-900"
        style={{
          minWidth: '820px',
          fontSize: '12pt',
        }}
      >
        <thead>
          <tr className="bg-slate-100 text-slate-900 font-bold text-center" style={{ fontSize: '12pt' }}>
            {/* Col 1: ชนิดยา/สารน้ำ (200px, header center, data left) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}
            >
              ชนิดยา/สารน้ำ
            </th>
            {/* Col 2: คงเหลือ (70px, center) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}
            >
              คงเหลือ
            </th>
            {/* Col 3: วันที่รับ (90px, center, nowrap) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '90px', minWidth: '90px', textAlign: 'center', whiteSpace: 'nowrap' }}
            >
              วันที่รับ
            </th>
            {/* Col 4: จำนวนที่รับ (80px, center) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}
            >
              จำนวนที่รับ
            </th>
            {/* Col 5: รวม (70px, center) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}
            >
              รวม
            </th>
            {/* Col 6: ยอดต่ำสุด (80px, center) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}
            >
              ยอดต่ำสุด
            </th>
            {/* Col 7: เบิกครั้งละ (80px, center) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}
            >
              เบิกครั้งละ
            </th>
            {/* Col 8: หมายเหตุ (150px, left) */}
            <th
              className="border border-slate-400 p-2"
              style={{ width: '150px', minWidth: '150px', textAlign: 'center' }}
            >
              หมายเหตุ
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedDrugs && displayedDrugs.length > 0 ? (
            displayedDrugs.map((d, idx) => {
              const remainingVal = d.remaining !== undefined && d.remaining !== null ? Number(d.remaining) : 0;
              const receivedQtyVal = d.receivedQty !== undefined && d.receivedQty !== null ? Number(d.receivedQty) : 0;
              const totalVal = remainingVal + receivedQtyVal;

              // Format note: prioritize Exp date if available
              const expFormatted = d.expDate ? formatAcquiredDate(d.expDate) : '';
              const noteParts: string[] = [];
              if (expFormatted && expFormatted !== '-') {
                noteParts.push(`Exp: ${expFormatted}`);
              }
              if (d.note && d.note.trim() !== '') {
                noteParts.push(d.note.trim());
              }
              const displayNote = noteParts.length > 0 ? noteParts.join(' | ') : '-';

              return (
                <tr key={d.id || idx} className="hover:bg-slate-50 transition-colors">
                  {/* Col 1: ชนิดยา/สารน้ำ (ชิดซ้าย, padding-left: 8px) */}
                  <td
                    className="border border-slate-300 p-2 font-medium"
                    style={{ textAlign: 'left', paddingLeft: '8px' }}
                  >
                    {d.name || '-'}
                  </td>
                  {/* Col 2: คงเหลือ (ตรงกลาง) */}
                  <td
                    className="border border-slate-300 p-2 text-center"
                    style={{ textAlign: 'center' }}
                  >
                    {d.remaining !== undefined && d.remaining !== null ? d.remaining : '-'}
                  </td>
                  {/* Col 3: วันที่รับ (ตรงกลาง, nowrap) */}
                  <td
                    className="border border-slate-300 p-2 text-center"
                    style={{ textAlign: 'center', whiteSpace: 'nowrap' }}
                  >
                    {formatAcquiredDate(d.receivedDate)}
                  </td>
                  {/* Col 4: จำนวนที่รับ (ตรงกลาง) */}
                  <td
                    className="border border-slate-300 p-2 text-center"
                    style={{ textAlign: 'center' }}
                  >
                    {d.receivedQty !== undefined && d.receivedQty !== null ? d.receivedQty : '-'}
                  </td>
                  {/* Col 5: รวม (ตรงกลาง, ยอดรวมคำนวณอัตโนมัติ) */}
                  <td
                    className="border border-slate-300 p-2 text-center font-semibold text-blue-700"
                    style={{ textAlign: 'center' }}
                  >
                    {totalVal}
                  </td>
                  {/* Col 6: ยอดต่ำสุด (ตรงกลาง) */}
                  <td
                    className="border border-slate-300 p-2 text-center text-slate-700"
                    style={{ textAlign: 'center' }}
                  >
                    {d.minStock !== undefined && d.minStock !== null ? d.minStock : '-'}
                  </td>
                  {/* Col 7: เบิกครั้งละ (ตรงกลาง) */}
                  <td
                    className="border border-slate-300 p-2 text-center text-slate-700"
                    style={{ textAlign: 'center' }}
                  >
                    {d.batchRequest || '-'}
                  </td>
                  {/* Col 8: หมายเหตุ (ชิดซ้าย) */}
                  <td
                    className="border border-slate-300 p-2 text-slate-600"
                    style={{ textAlign: 'left', paddingLeft: '8px', fontSize: '11pt' }}
                  >
                    {displayNote}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} className="border border-slate-300 p-8 text-center text-slate-400">
                ไม่มีรายการยาในหมวดหมู่นี้
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signature Area */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-around text-sm text-slate-700" style={{ fontSize: '11pt' }}>
        <div className="text-center space-y-2">
          <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
          <p>({inspector || '....................................................'})</p>
        </div>
        <div className="text-center space-y-2">
          <p>ลงชื่อ .................................................... หัวหน้างาน</p>
          <p>(....................................................)</p>
        </div>
      </div>
    </div>
  );
};

export function generateDrugPrintHtml(
  drugs: DrugItem[],
  options: {
    date?: string;
    inspector?: string;
    clinicName?: string;
    subCategory?: 'all' | DrugCategory;
    headerNote?: string;
  } = {}
): string {
  const {
    date = '',
    inspector = '',
    clinicName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
    subCategory = 'monthly',
    headerNote = '(เพิ่ม Column Exp.)',
  } = options;

  const displayedDrugs =
    subCategory === 'all' ? drugs : drugs.filter((d) => d.category === subCategory);
  const mainHeading = getDrugCategoryTitle(subCategory, date);

  const rowsHtml = displayedDrugs
    .map((d) => {
      const remainingVal = d.remaining !== undefined && d.remaining !== null ? Number(d.remaining) : 0;
      const receivedQtyVal = d.receivedQty !== undefined && d.receivedQty !== null ? Number(d.receivedQty) : 0;
      const totalVal = remainingVal + receivedQtyVal;

      const expFormatted = d.expDate ? formatAcquiredDate(d.expDate) : '';
      const noteParts: string[] = [];
      if (expFormatted && expFormatted !== '-') {
        noteParts.push(`Exp: ${expFormatted}`);
      }
      if (d.note && d.note.trim() !== '') {
        noteParts.push(d.note.trim());
      }
      const displayNote = noteParts.length > 0 ? noteParts.join(' | ') : '-';

      return `
        <tr>
          <td style="text-align: left; padding-left: 8px; font-weight: normal;">${d.name || '-'}</td>
          <td style="text-align: center;">${d.remaining !== undefined && d.remaining !== null ? d.remaining : '-'}</td>
          <td style="text-align: center; white-space: nowrap;">${formatAcquiredDate(d.receivedDate)}</td>
          <td style="text-align: center;">${d.receivedQty !== undefined && d.receivedQty !== null ? d.receivedQty : '-'}</td>
          <td style="text-align: center; font-weight: bold;">${totalVal}</td>
          <td style="text-align: center;">${d.minStock !== undefined && d.minStock !== null ? d.minStock : '-'}</td>
          <td style="text-align: center;">${d.batchRequest || '-'}</td>
          <td style="text-align: left; padding-left: 8px;">${displayNote}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${mainHeading} - ${clinicName}</title>
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
            line-height: 1.3;
          }

          .title-area {
            text-align: center;
            margin-bottom: 6px;
          }

          .title-area h2 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
          }

          .title-area p.header-note {
            margin: 2px 0 0 0;
            font-size: 12pt;
            font-weight: bold;
          }

          .meta-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11pt;
            font-weight: 600;
            margin-bottom: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5pt;
          }

          thead {
            display: table-header-group !important; /* Force repeat header on every printed page */
          }

          tr {
            page-break-inside: avoid !important;
          }

          th, td {
            border: 1px solid #000;
            padding: 5px 6px;
            vertical-align: middle;
          }

          th {
            background-color: #f1f5f9;
            font-weight: bold;
            text-align: center;
            font-size: 11pt;
          }

          .signature-section {
            margin-top: 24px;
            display: flex;
            justify-content: space-around;
            font-size: 11pt;
            page-break-inside: avoid;
          }

          .sign-col {
            text-align: center;
          }

          .sign-col p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h2>${mainHeading}</h2>
          ${headerNote ? `<p class="header-note">${headerNote}</p>` : ''}
        </div>
        <div class="meta-header">
          <div>
            <span>${clinicName}</span>
          </div>
          <div>
            <span>วัน, เดือน, ปี ที่สำรวจ: ${formatThaiDate(date)}</span>
            ${inspector ? `<span style="margin-left: 18px;">ผู้ตรวจ: <strong>${inspector}</strong></span>` : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 200px; text-align: center;">ชนิดยา/สารน้ำ</th>
              <th style="width: 70px; text-align: center;">คงเหลือ</th>
              <th style="width: 90px; text-align: center; white-space: nowrap;">วันที่รับ</th>
              <th style="width: 80px; text-align: center;">จำนวนที่รับ</th>
              <th style="width: 70px; text-align: center;">รวม</th>
              <th style="width: 80px; text-align: center;">ยอดต่ำสุด</th>
              <th style="width: 80px; text-align: center;">เบิกครั้งละ</th>
              <th style="width: 150px; text-align: center;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการยา</td></tr>'}
          </tbody>
        </table>
        <div class="signature-section">
          <div class="sign-col">
            <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
            <p>(${inspector || '....................................................'})</p>
          </div>
          <div class="sign-col">
            <p>ลงชื่อ .................................................... หัวหน้างาน</p>
            <p>(....................................................)</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
