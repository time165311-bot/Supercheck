import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Download, X, FileSpreadsheet, History, Trash2, Calendar, User as UserIcon } from 'lucide-react';
import { InspectionHistoryRecord, User, DrugItem } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import {
  DrugInventoryReportPreview,
  generateDrugPrintHtml,
  getDrugCategoryTitle,
} from './DrugInventoryReportPreview';

export interface OfficialReportItemRow {
  no?: string | number;
  code?: string;
  sap?: string;
  name: string;
  spec?: string;
  source?: string;
  date?: string;
  qty?: string | number;
  tax?: string | number;
  price?: string | number;
  location?: string;
  res: string; // 'ใช้งานได้' | 'ใช้งานไม่ได้' | 'ไม่พบรายการ'
  note?: string;
}

export interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'eq' | 'bag' | 'cart' | 'drug';
  initialDrugSubCategory?: 'all' | 'monthly' | 'quarterly' | 'adhoc';
  title?: string;
  date?: string;
  inspector?: string;
  items?: OfficialReportItemRow[];
  eqItems?: OfficialReportItemRow[];
  bagItems?: OfficialReportItemRow[];
  cartItems?: OfficialReportItemRow[];
  drugs?: DrugItem[];
  sheetUrl?: string;
  apiUrl?: string;
  historyRecords?: InspectionHistoryRecord[];
  currentUser?: User | null;
  onDeleteHistoryRecord?: (recordId: string) => void;
}

export function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  if (thaiMonths.some((m) => str.includes(m))) {
    return str;
  }
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const thaiMonth = thaiMonths[m - 1] || '';
    const thaiYear = y < 2400 ? y + 543 : y;
    return `${d} ${thaiMonth} ${thaiYear}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    const thaiMonth = thaiMonths[m - 1] || '';
    const thaiYear = y < 2400 ? y + 543 : y;
    return `${d} ${thaiMonth} ${thaiYear}`;
  }
  return str;
}

export function formatAcquiredDate(dateVal?: string | null): string {
  if (!dateVal) return '-';
  const str = String(dateVal).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '-';

  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  for (let i = 0; i < 12; i++) {
    if (str.includes(thaiMonthsShort[i]) || str.includes(thaiMonthsFull[i])) {
      return str.replace(/\s+/g, ' ');
    }
  }

  // ISO string: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    if (y < 2400) y += 543;
    return `${d}/${m}/${y}`;
  }

  // DMY string: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let y = parseInt(dmyMatch[3], 10);
    if (y < 2400) y += 543;
    return `${d}/${m}/${y}`;
  }

  return str.replace(/\s+/g, ' ');
}

export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'eq',
  initialDrugSubCategory = 'monthly',
  title = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
  date: surveyDate = new Date().toISOString().split('T')[0],
  inspector = '',
  items = [],
  eqItems = [],
  bagItems = [],
  cartItems = [],
  drugs: propDrugs,
  sheetUrl = '',
  apiUrl = '',
  historyRecords = [],
  currentUser = null,
  onDeleteHistoryRecord,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'eq' | 'bag' | 'cart' | 'drug'>('eq');
  const [selectedRoundId, setSelectedRoundId] = useState<string>('current');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [drugSubCategory, setDrugSubCategory] = useState<'all' | 'monthly' | 'quarterly' | 'adhoc'>(initialDrugSubCategory);
  const [drugHeaderNote, setDrugHeaderNote] = useState<string>('(เพิ่ม Column Exp.)');

  // Sync category when initialCategory changes or modal opens
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
    if (initialDrugSubCategory) {
      setDrugSubCategory(initialDrugSubCategory);
    }
    setSelectedRoundId('current');
    setFeedback(null);
  }, [initialCategory, initialDrugSubCategory, isOpen]);

  // Load drugs from prop, local storage, or initial constant
  const resolvedDrugs: DrugItem[] = useMemo(() => {
    if (propDrugs && propDrugs.length > 0) return propDrugs;
    try {
      const saved = localStorage.getItem('anesthesia_drug_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return INITIAL_DRUGS_DATA;
  }, [propDrugs, isOpen]);

  // Convert drugs to OfficialReportItemRow format
  const drugReportItems: OfficialReportItemRow[] = useMemo(() => {
    return resolvedDrugs.map((d, idx) => {
      const catLabel =
        d.category === 'monthly'
          ? 'คลังเดือน'
          : d.category === 'quarterly'
          ? 'เบิก 3 เดือน'
          : 'เบิกเป็นครั้งๆ';

      const isNormal = Number(d.remaining || 0) >= Number(d.minStock || 0);

      return {
        no: idx + 1,
        code: d.id,
        sap: '-',
        name: d.name,
        spec: `หมวด: ${catLabel} | ยอดต่ำสุด: ${d.minStock ?? '-'} | เบิกครั้งละ: ${d.batchRequest ?? '-'}`,
        source: 'คลังยาและสารน้ำวิสัญญี',
        date: d.receivedDate || '-',
        qty: d.remaining !== undefined ? String(d.remaining) : '1',
        tax: '7',
        price: '-',
        location: `คลังยา (${catLabel})`,
        res: isNormal ? 'ใช้งานได้' : 'ใช้งานไม่ได้',
        note: [d.expDate ? `Exp: ${d.expDate}` : '', d.note ? d.note : ''].filter(Boolean).join(' | '),
      };
    });
  }, [resolvedDrugs]);

  // Selected history record (if not "current")
  const selectedRecord = historyRecords.find((r) => r.id === selectedRoundId);

  // Filter history records relevant to this category or all
  const filteredHistoryRecords = historyRecords.filter((r) => {
    if (selectedCategory === 'eq') return r.type === 'eq';
    if (selectedCategory === 'bag') return r.type === 'bag';
    if (selectedCategory === 'cart') return r.type === 'cart';
    if (selectedCategory === 'drug') return r.type === 'drug';
    return true;
  });

  // Determine active rows and metadata
  let activeItems: OfficialReportItemRow[] = [];
  let displayTitle = title;
  let displayDate = surveyDate;
  let displayInspector = inspector;

  if (selectedRecord) {
    activeItems = selectedRecord.rows || [];
    displayTitle = selectedRecord.title || title;
    displayDate = selectedRecord.date || surveyDate;
    displayInspector = selectedRecord.who || inspector;
  } else {
    // Current live data
    if (selectedCategory === 'eq') {
      activeItems = eqItems.length > 0 ? eqItems : items;
      displayTitle = 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    } else if (selectedCategory === 'bag') {
      activeItems = bagItems.length > 0 ? bagItems : items;
      displayTitle = 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency';
    } else if (selectedCategory === 'cart') {
      activeItems = cartItems.length > 0 ? cartItems : items;
      displayTitle = 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
    } else {
      activeItems = drugReportItems;
      displayTitle = 'แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ';
    }
  }

  // Derived clean clinic name (strictly without '(ภาพรวมทุกห้อง)')
  const cleanClinicName = useMemo(() => {
    const raw = String(displayTitle || 'คลินิกงานบริการผู้ป่วยในวิสัญญี')
      .replace(/\s*\(ภาพรวมทุกห้อง\)/g, '')
      .trim();
    if (selectedCategory === 'eq' || raw.includes('คลินิกงานบริการ')) {
      return 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    }
    return raw || 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
  }, [displayTitle, selectedCategory]);

  // Main document heading:
  // For 'eq' -> 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์'
  // For 'bag' -> 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency'
  // For 'cart' -> 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency'
  // For 'drug' -> 'แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ'
  const mainDocHeading = useMemo(() => {
    if (selectedCategory === 'eq') return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
    if (selectedCategory === 'bag') return 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency';
    if (selectedCategory === 'cart') return 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';
    if (selectedCategory === 'drug') return getDrugCategoryTitle(drugSubCategory, displayDate);
    return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
  }, [selectedCategory, drugSubCategory, displayDate]);

  if (!isOpen) return null;

  // Window Print Engine for A4 Landscape with repeated headers on every page
  const handlePrintPdf = () => {
    setIsPrinting(true);
    setFeedback({
      type: 'info',
      message: 'กำลังเปิดหน้าต่างพิมพ์... ในช่อง "ปลายทาง" (Destination) ให้เลือก "Save as PDF" (บันทึกเป็น PDF) เพื่อเซฟไฟล์ A4 แนวนอน',
    });

    // Optionally notify Apps Script in background (non-blocking)
    if (apiUrl && apiUrl.trim() !== '') {
      fetch(apiUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'export_pdf',
          surveyDate: formatThaiDate(displayDate),
          locationName: cleanClinicName,
          documentTitle: mainDocHeading,
          inspector: displayInspector,
          itemsCount: activeItems.length,
        }),
      }).catch(() => {});
    }

    // Build pure HTML table rows
    const rowsHtml = activeItems
      .map((item, idx) => {
        const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
        const isBad = item.res ? item.res.includes('ไม่ได้') : false;
        const isMiss = item.res ? item.res.includes('ไม่พบ') : false;

        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="text-align: center; font-family: monospace;">${item.code || '-'}</td>
            <td style="text-align: center; font-family: monospace;">${item.sap || '-'}</td>
            <td style="text-align: left; padding-left: 8px; font-weight: normal;">${item.name || '-'}</td>
            <td style="text-align: left; font-size: 8.5pt;">${item.spec || '-'}</td>
            <td style="text-align: center; font-size: 8.5pt;">${item.source || '-'}</td>
            <td style="text-align: center; font-size: 8.5pt; white-space: nowrap;">${formatAcquiredDate(item.date)}</td>
            <td style="text-align: center;">${item.qty || '1'}</td>
            <td style="text-align: center;">${item.tax || '7'}</td>
            <td style="text-align: right;">${item.price || '-'}</td>
            <td style="text-align: center; font-size: 8.5pt;">${item.location || '-'}</td>
            <td style="text-align: center; font-weight: bold; color: #15803d; font-size: 11pt;">${isOk ? '✓' : ''}</td>
            <td style="text-align: center; font-weight: bold; color: #b91c1c; font-size: 11pt;">${isBad ? '✓' : ''}</td>
            <td style="text-align: center; font-weight: bold; color: #b45309; font-size: 11pt;">${isMiss ? '✓' : ''}</td>
          </tr>
        `;
      })
      .join('');

    // Complete isolated HTML document with strict A4 Landscape & repeated table header CSS
    const printHtml =
      selectedCategory === 'drug'
        ? generateDrugPrintHtml(resolvedDrugs, {
            date: displayDate,
            inspector: displayInspector,
            clinicName: cleanClinicName,
            subCategory: drugSubCategory,
            headerNote: drugHeaderNote,
          })
        : `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${mainDocHeading} - ${cleanClinicName} (${formatThaiDate(displayDate)})</title>
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
              font-size: 10pt;
              line-height: 1.25;
            }

            .title-area {
              text-align: center;
              margin-bottom: 8px;
            }

            .title-area h2 {
              margin: 0;
              font-size: 16pt;
              font-weight: bold;
            }

            .title-area p {
              margin: 2px 0 0 0;
              font-size: 11pt;
            }

            .meta-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10pt;
              font-weight: 600;
              margin-bottom: 6px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9pt;
            }

            /* บังคับซ้ำหัวตารางทุกหน้าอัตโนมัติ */
            thead {
              display: table-header-group !important;
            }

            /* ป้องกันการตัดแถวตารางขาดครึ่งหน้า */
            tr {
              page-break-inside: avoid !important;
            }

            th, td {
              border: 1px solid #000;
              padding: 4px 5px;
            }

            th {
              background-color: #f1f5f9 !important;
              font-weight: bold;
              text-align: center;
              vertical-align: middle;
            }

            .signature-section {
              margin-top: 24px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
              font-size: 10pt;
            }

            .sign-col {
              text-align: center;
              line-height: 1.8;
            }
          </style>
        </head>
        <body>
          <div class="title-area">
            <h2>${mainDocHeading}</h2>
            <p>ณ วันที่ ${formatThaiDate(displayDate)}</p>
          </div>
          <div class="meta-header">
            <div><strong>${cleanClinicName}</strong></div>
            <div>
              <span>วัน, เดือน, ปี ที่สำรวจ: ${formatThaiDate(displayDate)}</span>
              ${displayInspector ? `<span style="margin-left: 18px;">ผู้ตรวจ: <strong>${displayInspector}</strong></span>` : ''}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 36px;">ลำดับที่</th>
                <th rowspan="2" style="width: 90px;">หมายเลขพัสดุ</th>
                <th rowspan="2" style="width: 90px;">รหัสสินทรัพย์ SAP</th>
                <th rowspan="2" style="min-width: 170px; text-align: center;">รายการ</th>
                <th rowspan="2" style="min-width: 140px; text-align: left;">มาตรฐานและคุณลักษณะเฉพาะ</th>
                <th rowspan="2" style="width: 85px;">แหล่งเงินที่มา (ประเภทเงินงบประมาณ)</th>
                <th rowspan="2" style="width: 90px; min-width: 90px; white-space: nowrap; text-align: center;">ว/ด/ป ที่ได้มา</th>
                <th rowspan="2" style="width: 45px;">จำนวนตามบัญชี</th>
                <th rowspan="2" style="width: 45px;">อัตราภาษี (%)</th>
                <th rowspan="2" style="width: 75px;">ราคา (รวมภาษี)</th>
                <th rowspan="2" style="width: 85px;">สถานที่ตั้ง ตึก / ชั้น / ห้อง</th>
                <th colspan="3">ผลการตรวจสอบพัสดุ</th>
              </tr>
              <tr style="font-size: 8.5pt;">
                <th style="width: 50px;">พบรายการ ใช้งานได้</th>
                <th style="width: 50px;">พบรายการ ใช้งานไม่ได้</th>
                <th style="width: 50px;">ไม่พบรายการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="14" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการ</td></tr>'}
            </tbody>
          </table>
          <div class="signature-section">
            <div class="sign-col">
              <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
              <p>(${displayInspector || '....................................................'})</p>
            </div>
            <div class="sign-col">
              <p>ลงชื่อ .................................................... หัวหน้างาน</p>
              <p>(....................................................)</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Use isolated invisible iframe to trigger print dialog without affecting main UI
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.id = 'report-print-frame';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          window.print();
        } finally {
          setIsPrinting(false);
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 1500);
        }
      }, 300);
    } else {
      setIsPrinting(false);
      window.print();
    }
  };

  const handleDeleteCurrentRecord = () => {
    if (!selectedRecord || !onDeleteHistoryRecord) return;
    if (confirm(`ยืนยันการลบประวัติการตรวจรอบ "${selectedRecord.title}" (${selectedRecord.timestamp})?`)) {
      onDeleteHistoryRecord(selectedRecord.id);
      setSelectedRoundId('current');
    }
  };

  const isAdmin = !currentUser || currentUser.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      {/* Media Print Global Rules */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        @media print {
          body {
            font-family: 'TH Sarabun PSK', 'Sarabun', sans-serif !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
        .preview-container {
          overflow-x: auto !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-x pan-y !important;
        }
        .paper-preview, .sheet-preview {
          display: inline-block !important;
          width: max-content !important;
          min-width: 100% !important;
          box-sizing: border-box !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 border-b flex flex-wrap justify-between items-center bg-slate-50 gap-2 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-slate-800">ตัวอย่างรายงานและพิมพ์ PDF (A4 แนวนอน)</h3>
            <p className="text-xs text-slate-500">
              สั่งพิมพ์ผ่าน Window Print Engine ได้ทันที จัดหน้า A4 แนวนอนและซ้ำหัวตารางทุกหน้าเป๊ะ 100%
            </p>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {/* 4 Category Tabs */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-semibold mr-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('eq');
                  setSelectedRoundId('current');
                }}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  selectedCategory === 'eq' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏥 ครุภัณฑ์
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('bag');
                  setSelectedRoundId('current');
                }}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  selectedCategory === 'bag' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💼 กระเป๋า
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('cart');
                  setSelectedRoundId('current');
                }}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  selectedCategory === 'cart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛒 รถ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('drug');
                  setSelectedRoundId('current');
                }}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  selectedCategory === 'drug' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💊 คลังยา
              </button>
            </div>

            {/* Direct Google Sheet Button */}
            {sheetUrl && sheetUrl.trim() !== '' && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs transition"
                title="เปิด Google Sheet ปัจจุบัน"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">เปิด Google Sheet</span>
              </a>
            )}

            {/* Native Print & Save as PDF Button (A4 Landscape) */}
            <button
              onClick={handlePrintPdf}
              disabled={isPrinting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow transition-all cursor-pointer text-xs sm:text-sm active:scale-[0.98]"
              title="เปิดหน้าต่างพิมพ์ทันทีเพื่อบันทึกเป็น PDF (A4 แนวนอน)"
            >
              <Printer className="w-4 h-4" />
              <span>ดาวน์โหลด PDF (A4 แนวนอน)</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-bold cursor-pointer text-xs sm:text-sm"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-bar: Inspection Round / History Selector */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-blue-600" />
              เลือกรอบการตรวจ:
            </span>
            <select
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="current">🟢 รอบตรวจปัจจุบัน (ข้อมูลล่าสุด)</option>
              {filteredHistoryRecords.map((r) => {
                const typeLabel =
                  r.type === 'eq' ? 'ครุภัณฑ์' : r.type === 'bag' ? 'กระเป๋า' : r.type === 'cart' ? 'รถ' : 'คลังยา';
                return (
                  <option key={r.id} value={r.id}>
                    🕒 [{r.timestamp || r.date}] {typeLabel} - ผู้ตรวจ: {r.who || 'ไม่ระบุ'} ({r.rows?.length || 0} รายการ)
                  </option>
                );
              })}
            </select>

            {selectedRecord && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-medium">
                กำลังดูประวัติรอบ {selectedRecord.timestamp}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs">
              จำนวน <b>{activeItems.length}</b> รายการ
            </span>

            {selectedRecord && isAdmin && onDeleteHistoryRecord && (
              <button
                type="button"
                onClick={handleDeleteCurrentRecord}
                className="text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold text-xs transition cursor-pointer"
                title="ลบประวัติรอบตรวจนี้"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรอบนี้</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'info'
                ? 'bg-blue-50 text-blue-800 border-b border-blue-200'
                : feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body Area - Scrollable Clean HTML Table (Instant Preview) */}
        <div
          className="preview-container flex-1 overflow-auto p-4 sm:p-6 bg-slate-100"
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
          }}
        >
          {selectedCategory === 'drug' ? (
            <DrugInventoryReportPreview
              drugs={resolvedDrugs}
              date={displayDate}
              inspector={displayInspector}
              clinicName={cleanClinicName}
              subCategory={drugSubCategory}
              onSubCategoryChange={setDrugSubCategory}
              headerNote={drugHeaderNote}
              onHeaderNoteChange={setDrugHeaderNote}
            />
          ) : (
            <div
              className="paper-preview sheet-preview bg-white p-6 rounded-lg shadow"
            style={{
              display: 'inline-block',
              width: 'max-content',
              minWidth: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Header Document Area */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">{mainDocHeading}</h2>
              <p className="text-sm text-slate-600 mt-1">ณ วันที่ {formatThaiDate(displayDate)}</p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-700 font-medium mb-3">
              <div>
                <span className="font-semibold text-slate-900">{cleanClinicName}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(displayDate)}
                </span>
                {displayInspector && (
                  <span className="flex items-center gap-1 font-medium text-slate-800">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    ผู้ตรวจ: {displayInspector}
                  </span>
                )}
              </div>
            </div>

            {/* Standard 12-Column HTML Table */}
            <table className="w-full min-w-[1050px] border-collapse border border-slate-400 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold text-center">
                  <th rowSpan={2} className="border border-slate-400 p-2 w-12">ลำดับที่</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">หมายเลขพัสดุ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">รหัสสินทรัพย์ SAP</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-center min-w-[180px]">รายการ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-left min-w-[160px]">มาตรฐานและคุณลักษณะเฉพาะ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-24">แหล่งเงินที่มา (ประเภทเงินงบประมาณ)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-24 min-w-[90px] whitespace-nowrap text-center">ว/ด/ป ที่ได้มา</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-16">จำนวนตามบัญชี</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-16">อัตราภาษี (%)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-right w-24">ราคา (รวมภาษี)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">สถานที่ตั้ง ตึก / ชั้น / ห้อง</th>
                  <th colSpan={3} className="border border-slate-400 p-2">ผลการตรวจสอบพัสดุ</th>
                </tr>
                <tr className="bg-slate-100 text-slate-800 font-semibold text-center text-[11px]">
                  <th className="border border-slate-400 p-1 w-16 text-emerald-700">พบรายการ ใช้งานได้</th>
                  <th className="border border-slate-400 p-1 w-16 text-rose-700">พบรายการ ใช้งานไม่ได้</th>
                  <th className="border border-slate-400 p-1 w-16 text-amber-700">ไม่พบรายการ</th>
                </tr>
              </thead>
              <tbody>
                {activeItems && activeItems.length > 0 ? (
                  activeItems.map((item, idx) => {
                    const isOk = item.res ? item.res.includes('ใช้งานได้') : (item as any).status === 'normal' || (item as any).checked;
                    const isBad = item.res ? item.res.includes('ไม่ได้') : false;
                    const isMiss = item.res ? item.res.includes('ไม่พบ') : false;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 text-slate-800">
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.code || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.sap || '-'}</td>
                        <td className="border border-slate-300 p-2 text-left font-normal" style={{ paddingLeft: '8px' }}>{item.name || '-'}</td>
                        <td className="border border-slate-300 p-2 text-slate-600 text-xs">{item.spec || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs">{item.source || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs whitespace-nowrap">{formatAcquiredDate(item.date)}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.qty || '1'}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.tax || '7'}</td>
                        <td className="border border-slate-300 p-2 text-right">{item.price || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs">{item.location || '-'}</td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-emerald-600">
                          {isOk ? '✓' : ''}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-rose-600">
                          {isBad ? '✓' : ''}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-amber-600">
                          {isMiss ? '✓' : ''}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={14} className="border border-slate-300 p-8 text-center text-slate-400">
                      ไม่มีข้อมูลรายการในหมวดนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Signature Area */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex justify-around text-xs text-slate-700">
              <div className="text-center space-y-2">
                <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                <p>({displayInspector || '....................................................'})</p>
              </div>
              <div className="text-center space-y-2">
                <p>ลงชื่อ .................................................... หัวหน้างาน</p>
                <p>(....................................................)</p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
