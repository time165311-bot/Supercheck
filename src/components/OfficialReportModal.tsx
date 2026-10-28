import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  FileSpreadsheet,
  History,
  Trash2,
  Calendar,
  User as UserIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Move,
  RefreshCw,
} from 'lucide-react';
import { InspectionHistoryRecord, User, DrugItem } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { sendInspectionToGas } from '../services/api';
import {
  DrugInventoryReportPreview,
  generateDrugPrintHtml,
  getDrugCategoryTitle,
  getMonthAndYearThai,
} from './DrugInventoryReportPreview';
import {
  EmergencyChecklistReportPreview,
  generateEmergencyPrintHtml,
} from './EmergencyChecklistReportPreview';

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
  exp?: string;
  group?: string;
  val?: string; // actual count, e.g. "1400/1700 PSI", "2", "✓"
  weekVals?: { [week: number]: string };
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

export function stripEmojis(str?: string): string {
  if (!str) return '';
  return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim();
}

export function isCurrentYearExp(expVal?: string | null): boolean {
  if (!expVal) return false;
  const str = String(expVal).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return false;

  const currentYearAD = new Date().getFullYear(); // 2026
  const currentYearBE = currentYearAD + 543;       // 2569
  const shortAD = String(currentYearAD).slice(-2); // "26"
  const shortBE = String(currentYearBE).slice(-2); // "69"

  if (str.includes(String(currentYearAD)) || str.includes(String(currentYearBE))) {
    return true;
  }
  if (new RegExp(`[\\/.-]${shortAD}$`).test(str) || new RegExp(`[\\/.-]${shortBE}$`).test(str)) {
    return true;
  }
  return false;
}

export function formatRealQuantity(qtyVal?: string | number, nameStr?: string, specStr?: string): string {
  const combined = `${nameStr || ''} ${specStr || ''} ${qtyVal || ''}`;
  const strQty = String(qtyVal || '').trim();

  // Look for size / number specs like No. 4, 5, 5.5, 6 or เบอร์ 4, 5, 6
  const sizePattern = /(?:No\.|no\.|เบอร์|ขนาด)\s*([0-9.,\s/&]+)/i;
  const match = combined.match(sizePattern);
  if (match && match[1]) {
    const sizes = match[1].split(/[,/&]/).map((s) => s.trim()).filter((s) => /^\d+(\.\d+)?$/.test(s));
    if (sizes.length > 1) {
      return sizes.map(() => '1').join(', ');
    }
  }

  if (strQty.includes('อย่างละ') || strQty.includes('เหมา')) {
    const numbers = combined.match(/(\d+(\.\d+)?)/g);
    if (numbers && numbers.length > 1) {
      return Array(numbers.length).fill('1').join(', ');
    }
    return '1';
  }

  return strQty || '1';
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
  const [recordToDelete, setRecordToDelete] = useState<InspectionHistoryRecord | null>(null);
  const [isExportingGas, setIsExportingGas] = useState<boolean>(false);
  const [drugSubCategory, setDrugSubCategory] = useState<'all' | 'monthly' | 'quarterly' | 'adhoc'>(initialDrugSubCategory);
  const [drugHeaderNote, setDrugHeaderNote] = useState<string>('(เพิ่ม Column Exp.)');
  const [showToolbar, setShowToolbar] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Zoom & Pan (Simplified for clean rewrite - fixed at 100%)
  const [zoom] = useState<number>(1.0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Week values tracking for bag and cart
  const [weekItemValues, setWeekItemValues] = useState<{ [itemKey: string]: { [week: number]: string } }>({});

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
    // Reset Modal View
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
    const { month, year } = getMonthAndYearThai(displayDate);
    if (selectedCategory === 'eq') return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
    if (selectedCategory === 'bag') return `ตารางตรวจเช็คกระเป๋ายา Emergency ประจำเดือน ${month} / ปี ${year}`;
    if (selectedCategory === 'cart') return `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} / ปี ${year}  หน่วยงาน: ${cleanClinicName}`;
    if (selectedCategory === 'drug') return getDrugCategoryTitle(drugSubCategory, displayDate);
    return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
  }, [selectedCategory, drugSubCategory, displayDate, cleanClinicName]);

  // Retrieve user digital signature from profile or localStorage for auto-attaching
  const userSignature = useMemo(() => {
    if (currentUser?.signature) return currentUser.signature;
    if (currentUser?.id) {
      const s = localStorage.getItem(`user_signature_${currentUser.id}`);
      if (s) return s;
    }
    return localStorage.getItem('user_signature_default') || '';
  }, [currentUser]);

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
            <td style="text-align: center;">${formatRealQuantity(item.qty, item.name, item.spec)}</td>
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
            signature: userSignature,
            clinicName: cleanClinicName,
            subCategory: drugSubCategory,
            headerNote: drugHeaderNote,
          })
        : selectedCategory === 'bag' || selectedCategory === 'cart'
        ? generateEmergencyPrintHtml(selectedCategory, activeItems, {
            date: displayDate,
            inspector: displayInspector,
            signature: userSignature,
            agencyName: cleanClinicName,
            weekItemValues,
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
              color: #000 !important;
              background: #fff !important;
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
              color: #000 !important;
            }
 
            .title-area p {
              margin: 2px 0 0 0;
              font-size: 11pt;
              color: #000 !important;
            }
 
            .meta-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10pt;
              font-weight: 600;
              margin-bottom: 6px;
              color: #000 !important;
            }
 
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9pt;
              background-color: #fff !important;
            }
 
            /* บังคับซ้ำหัวตารางทุกหน้าอัตโนมัติ */
            thead {
              display: table-header-group !important;
            }
 
            /* ป้องกันการตัดแถวตารางขาดครึ่งหน้า */
            tr {
              page-break-inside: avoid !important;
              background-color: #fff !important;
            }
 
            th, td {
              border: 1px solid #000 !important;
              padding: 4px 5px;
              color: #000 !important;
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
              color: #000 !important;
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
            <div class="sign-col" style="display: flex; flex-direction: column; align-items: center;">
              <div style="height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
                ${userSignature ? `<img src="${userSignature}" style="max-height: 48px; max-width: 140px; object-fit: contain;" alt="ลายเซ็น" />` : ''}
              </div>
              <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
              <p>(${displayInspector || '....................................................'})</p>
            </div>
            <div class="sign-col" style="display: flex; flex-direction: column; align-items: center;">
              <div style="height: 48px;"></div>
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
    setRecordToDelete(selectedRecord);
  };

  const handleConfirmDeleteCurrentRecord = () => {
    if (!recordToDelete || !onDeleteHistoryRecord) return;
    const recId = recordToDelete.id;
    const targetTitle = recordToDelete.title || recordToDelete.timestamp;
    setSelectedRoundId('current');
    setRecordToDelete(null);
    onDeleteHistoryRecord(recId);
    setFeedback({
      type: 'success',
      message: `✓ ลบประวัติการตรวจรอบ "${targetTitle}" เรียบร้อยแล้ว`,
    });
  };

  const handleSendReportToGas = async () => {
    if (!apiUrl || !apiUrl.trim()) {
      setFeedback({
        type: 'error',
        message: 'ยังไม่ได้ระบุ Google Apps Script Web App URL (กรุณาตั้งค่าในหน้าฟันเฟือง)',
      });
      return;
    }
    setIsExportingGas(true);
    setFeedback({
      type: 'info',
      message: 'กำลังส่งข้อมูล Report เข้า Google Sheets...',
    });

    try {
      const now = new Date();
      const thaiYear = String(now.getFullYear() + 543);
      const day = ('0' + now.getDate()).slice(-2);
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const dateFormatted = `${day}${month}${thaiYear}`;

      if (selectedCategory === 'drug') {
        const catCode = drugSubCategory === 'quarterly' ? '3เดือน' : drugSubCategory === 'adhoc' ? 'ครั้งคราว' : 'เดือน';
        const uniqueSheet = `คลังยา_${catCode}_${dateFormatted}`;
        await sendInspectionToGas(apiUrl, {
          type: 'drug',
          category: drugSubCategory,
          sheet: 'คลังยาและสารน้ำ',
          sheetName: uniqueSheet,
          title: mainDocHeading,
          date: displayDate,
          who: displayInspector || currentUser?.name || 'ผู้ดูแลระบบ',
          user: currentUser?.username || 'user',
          rows: resolvedDrugs.map((d) => ({
            name: d.name,
            remaining: d.remaining,
            receivedDate: d.receivedDate,
            receivedQty: d.receivedQty,
            totalQty: Number(d.remaining || 0) + Number(d.receivedQty || 0),
            minStock: d.minStock,
            batchRequest: d.batchRequest,
            expDate: d.expDate,
            note: d.note,
          })),
        });
      } else if (selectedCategory === 'bag' || selectedCategory === 'cart') {
        const uniqueSheet = selectedCategory === 'bag' ? `กระเป๋า_EMER_${dateFormatted}` : `รถ_EMER_${dateFormatted}`;
        await sendInspectionToGas(apiUrl, {
          type: selectedCategory,
          sheet: selectedCategory === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency',
          sheetName: uniqueSheet,
          title: mainDocHeading,
          date: displayDate,
          who: displayInspector || currentUser?.name || 'ผู้ดูแลระบบ',
          user: currentUser?.username || 'user',
          rows: activeItems.map((item) => ({
            name: item.name,
            qty: String(item.qty || '1'),
            exp: item.exp || item.date || '-',
            group: item.group || '-',
            val: item.val || (item.res && item.res.includes('ใช้งานได้') ? '✓' : '-'),
            res: item.res,
            weekVals: item.weekVals || weekItemValues[item.name] || {},
          })),
        });
      } else {
        const uniqueSheet = `ครุภัณฑ์_ทุกห้อง_${dateFormatted}`;
        await sendInspectionToGas(apiUrl, {
          type: 'eq',
          sheet: 'ครุภัณฑ์',
          sheetName: uniqueSheet,
          title: mainDocHeading,
          date: displayDate,
          who: displayInspector || currentUser?.name || 'ผู้ดูแลระบบ',
          user: currentUser?.username || 'user',
          rows: activeItems.map((item, idx) => ({
            no: String(item.no || idx + 1),
            code: item.code || '-',
            sap: item.sap || '-',
            name: item.name,
            spec: item.spec || '-',
            source: item.source || '-',
            date: item.date || '-',
            qty: String(item.qty || '1'),
            tax: String(item.tax || '7'),
            price: String(item.price || '-'),
            location: item.location || '-',
            res: item.res,
            note: item.note || '',
          })),
        });
      }

      setFeedback({
        type: 'success',
        message: `✓ ส่ง Report หมวด "${mainDocHeading}" เข้า Google Sheets เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการส่งเข้า Google Sheets: ' + (err?.message || err),
      });
    } finally {
      setIsExportingGas(false);
    }
  };

  const isAdmin = !currentUser || currentUser.role === 'admin';

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div 
        className="bg-white dark:bg-[#242526] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          width: isFullscreen ? '98vw' : '96vw',
          maxWidth: isFullscreen ? 'none' : '900px',
          height: isFullscreen ? '95vh' : 'auto',
          maxHeight: isFullscreen ? '95vh' : '92vh',
          background: '#ffffff',
          borderRadius: isFullscreen ? '12px' : '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          boxSizing: 'border-box'
        }}
      >
        {/* Modal Sticky Header */}
        <div className="sticky top-0 z-50 flex flex-col gap-3 p-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'eq', label: 'ครุภัณฑ์', emoji: '🏫' },
                { id: 'bag', label: 'กระเป๋า', emoji: '💼' },
                { id: 'cart', label: 'รถ', emoji: '🛒' },
                { id: 'drug', label: 'คลังยา', emoji: '💊' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id as any);
                    setSelectedRoundId('current');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                    selectedCategory === cat.id 
                      ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-500/20' 
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <button 
              onClick={onClose}
              className="p-2.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 px-3 py-1 outline-none cursor-pointer"
              >
                <option value="current">🟢 รอบปัจจุบัน (Live)</option>
                {filteredHistoryRecords.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    📜 {rec.timestamp} ({rec.who || 'ผู้ตรวจ'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`p-2 rounded-xl transition-all active:scale-95 ${isFullscreen ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                title={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "โหมดเต็มหน้าจอ (Fit to Screen)"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider border border-slate-200">
                <span>Zoom: 100%</span>
              </div>

              <button
                onClick={handleSendReportToGas}
                disabled={isExportingGas}
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition disabled:opacity-50"
              >
                {isExportingGas ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>ส่ง Sheets</span>
              </button>

              <button
                onClick={handlePrintPdf}
                disabled={isPrinting}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition disabled:opacity-50"
              >
                {isPrinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>พิมพ์ / PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-8" ref={previewContainerRef}>
          <div 
            className="paper-preview mx-auto shadow-xl"
            style={{
              width: '100%',
              maxWidth: '850px',
              minWidth: '700px',
              margin: '0 auto',
              background: '#ffffff',
              padding: isFullscreen ? '40px' : '24px',
              borderRadius: '2px',
              boxSizing: 'border-box'
            }}
          >
            {/* Report Content Switcher */}
            {selectedCategory === 'drug' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 border-b pb-4">
                  <div className="flex gap-2">
                    {['all', 'monthly', 'quarterly', 'adhoc'].map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setDrugSubCategory(sub as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                          drugSubCategory === sub ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {sub === 'all' ? 'ทั้งหมด' : sub === 'monthly' ? 'รายเดือน' : sub === 'quarterly' ? '3 เดือน' : 'ครั้งคราว'}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={drugHeaderNote} 
                    onChange={(e) => setDrugHeaderNote(e.target.value)}
                    placeholder="หมายเหตุท้ายชื่อรายงาน..."
                    className="text-[10px] border border-slate-200 px-2 py-1 rounded outline-none"
                  />
                </div>
                <DrugInventoryReportPreview
                  drugs={resolvedDrugs}
                  date={displayDate}
                  inspector={displayInspector}
                  signature={userSignature}
                  clinicName={cleanClinicName}
                  subCategory={drugSubCategory}
                  headerNote={drugHeaderNote}
                />
              </div>
            ) : selectedCategory === 'bag' || selectedCategory === 'cart' ? (
              <EmergencyChecklistReportPreview
                type={selectedCategory}
                items={activeItems}
                date={displayDate}
                inspector={displayInspector}
                signature={userSignature}
                agencyName={cleanClinicName}
                weekItemValues={weekItemValues}
              />
            ) : (
              /* Equipment Table (14 Columns) */
              <div className="w-full">
                <div className="text-center mb-6">
                  <h2 className="text-[18px] font-bold text-black mb-1">{mainDocHeading}</h2>
                  <p className="text-[14px] text-black">ณ วันที่ {formatThaiDate(displayDate)}</p>
                </div>

                <div className="flex justify-between items-center mb-4 text-[13px] font-bold">
                  <div className="text-black">{cleanClinicName}</div>
                  <div className="flex gap-6 text-black">
                    <span>วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(displayDate)}</span>
                    {displayInspector && <span>ผู้ตรวจ: {displayInspector}</span>}
                  </div>
                </div>

                <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '950px', tableLayout: 'auto', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #000000' }}>
                    <thead>
                      <tr className="bg-slate-50 text-black font-bold">
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '35px' }}>ลำดับที่</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '100px' }}>หมายเลขพัสดุ</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '100px' }}>รหัสสินทรัพย์ SAP</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '8px 6px', textAlign: 'left', minWidth: '160px' }}>รายการ</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '8px 6px', textAlign: 'left', minWidth: '140px' }}>มาตรฐานและคุณลักษณะเฉพาะ</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '80px' }}>แหล่งเงินที่ได้มา</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '90px' }}>ว/ด/ป ที่ได้มา</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '40px' }}>จำนวน</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '40px' }}>อัตราภาษี (%)</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '80px' }}>ราคา (รวมภาษี)</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '90px' }}>สถานที่ตั้ง / ชั้น / ห้อง</th>
                        <th colSpan={3} style={{ border: '1px solid #000000', padding: '4px', textAlign: 'center' }}>ผลการตรวจสอบ</th>
                      </tr>
                      <tr className="bg-slate-50 text-black font-bold">
                        <th style={{ border: '1px solid #000000', padding: '4px', width: '55px', textAlign: 'center' }}>ใช้งานได้</th>
                        <th style={{ border: '1px solid #000000', padding: '4px', width: '55px', textAlign: 'center' }}>ชำรุด ใช้งานไม่ได้</th>
                        <th style={{ border: '1px solid #000000', padding: '4px', width: '55px', textAlign: 'center' }}>ไม่พบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((item, idx) => {
                        const isOk = item.res?.includes('ใช้งานได้');
                        const isBad = item.res?.includes('ไม่ได้');
                        const isMiss = item.res?.includes('ไม่พบ');
                        return (
                          <tr key={idx} className="text-black">
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{item.code || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{item.sap || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', wordBreak: 'keep-all' }}>{item.name}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', fontSize: '10px', wordBreak: 'keep-all' }}>{item.spec || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', fontSize: '10px' }}>{item.source || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', fontSize: '10px' }}>{formatAcquiredDate(item.date)}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center' }}>{formatRealQuantity(item.qty, item.name, item.spec)}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center' }}>{item.tax || '7'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'right' }}>{item.price || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', fontSize: '10px' }}>{item.location || '-'}</td>
                            <td style={{ border: '1px solid #000000', padding: '4px', textAlign: 'center', color: '#15803d', fontWeight: 'bold', fontSize: '14px' }}>{isOk ? '✓' : ''}</td>
                            <td style={{ border: '1px solid #000000', padding: '4px', textAlign: 'center', color: '#b91c1c', fontWeight: 'bold', fontSize: '14px' }}>{isBad ? '✓' : ''}</td>
                            <td style={{ border: '1px solid #000000', padding: '4px', textAlign: 'center', color: '#b45309', fontWeight: 'bold', fontSize: '14px' }}>{isMiss ? '✓' : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-12 flex justify-around text-[14px]">
                  <div className="text-center">
                    <div className="h-16 flex items-end justify-center mb-2">
                      {userSignature && <img src={userSignature} style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain' }} alt="signature" />}
                    </div>
                    <p className="font-bold">ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                    <p className="mt-1">({displayInspector || '....................................................'})</p>
                  </div>
                  <div className="text-center">
                    <div className="h-16" />
                    <p className="font-bold">ลงชื่อ .................................................... หัวหน้างาน</p>
                    <p className="mt-1">(....................................................)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls removed as per request */}
      </div>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">ยืนยันการลบประวัติ?</h3>
            <p className="text-sm text-slate-600 mb-6">
              คุณกำลังจะลบประวัติการตรวจรอบ "{recordToDelete.title || recordToDelete.timestamp}" ออกจากระบบถาวร ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRecordToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDeleteCurrentRecord}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @media print {
          .fixed, .sticky, button, .modal-footer, header, footer { display: none !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .paper-preview { 
            box-shadow: none !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important; 
            max-width: none !important; 
            min-width: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
