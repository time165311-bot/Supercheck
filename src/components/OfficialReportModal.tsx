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

  // Zoom & Pan Engine state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchPinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Week values tracking for bag and cart
  const [weekItemValues, setWeekItemValues] = useState<{ [itemKey: string]: { [week: number]: string } }>({});

  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFitScreen = () => {
    if (previewContainerRef.current && previewContentRef.current) {
      const containerW = previewContainerRef.current.clientWidth - 48;
      const contentW = previewContentRef.current.scrollWidth || 1080;
      if (contentW > 0 && containerW > 0) {
        const fitScale = Math.min(1.0, Math.max(0.4, containerW / contentW));
        setZoom(Math.round(fitScale * 100) / 100);
        setPan({ x: 0, y: 0 });
      }
    } else {
      setZoom(0.85);
      setPan({ x: 0, y: 0 });
    }
  };

  // PC: Ctrl + Mouse Wheel zoom
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom((prev) => Math.min(2.5, Math.max(0.4, Math.round((prev + delta) * 100) / 100)));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
      target.closest('input, button, select, textarea')
    ) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
  };

  // Mobile Touch Pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchRef.current = { initialDist: dist, initialZoom: zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchPinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchPinchRef.current.initialDist;
      const nextZoom = Math.min(2.5, Math.max(0.4, touchPinchRef.current.initialZoom * ratio));
      setZoom(Math.round(nextZoom * 100) / 100);
    }
  };

  const handleTouchEnd = () => {
    touchPinchRef.current = null;
  };

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
    setShowToolbar(true);
    setTimeout(() => {
      handleFitScreen();
    }, 150);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-start items-center p-2 sm:p-4 overflow-hidden animate-in fade-in">
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
        .paper-preview, .sheet-preview, .a4-page-sheet, .a4-print-container {
          display: inline-block !important;
          width: max-content !important;
          min-width: 100% !important;
          box-sizing: border-box !important;
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        /* Strict isolation for report content to beat global dark: utilities */
        .a4-page-sheet,
        .a4-page-sheet *,
        .a4-print-container, 
        .a4-print-container *, 
        .paper-preview, 
        .paper-preview *,
        [class*="a4-"] *,
        .a4-page-sheet [class*="bg-"],
        .a4-page-sheet [class*="text-"],
        .a4-page-sheet [class*="dark:"] {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
          border-color: #cbd5e1 !important;
          background-image: none !important;
          color-scheme: light !important;
          box-shadow: none !important;
          text-shadow: none !important;
          backdrop-filter: none !important;
        }
        /* Restore header and specific table colors */
        .a4-page-sheet th,
        .a4-page-sheet thead tr,
        .a4-page-sheet th *,
        .a4-print-container th, 
        .a4-print-container thead tr,
        .paper-preview th,
        .paper-preview thead tr {
          background-color: #f1f5f9 !important;
          background: #f1f5f9 !important;
          color: #000000 !important;
        }
        /* High-contrast status colors */
        .a4-page-sheet .text-emerald-700, .a4-print-container .text-emerald-700, .paper-preview .text-emerald-700, .paper-preview .text-emerald-600 { color: #15803d !important; background-color: transparent !important; }
        .a4-page-sheet .text-rose-700, .a4-print-container .text-rose-700, .paper-preview .text-rose-700, .paper-preview .text-rose-600 { color: #b91c1c !important; background-color: transparent !important; }
        .a4-page-sheet .text-amber-700, .a4-print-container .text-amber-700, .paper-preview .text-amber-700, .paper-preview .text-amber-600 { color: #b45309 !important; background-color: transparent !important; }
        
        /* Fix for potential black banners in headers/footers */
        .a4-page-sheet header, .a4-page-sheet footer, .a4-page-sheet section, .a4-page-sheet div[class*="bg-"] {
          background-color: #ffffff !important;
          background: #ffffff !important;
        }
        .a4-page-sheet table, .a4-page-sheet tr, .a4-page-sheet td {
          background-color: #ffffff !important;
          color: #000000 !important;
          border: 1px solid #000000 !important;
        }
        .a4-page-sheet thead th {
          background-color: #f1f5f9 !important;
          color: #000000 !important;
        }
      `}</style>

      <div className="bg-white dark:bg-[#242526] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] my-auto mt-4 pt-[env(safe-area-inset-top)] flex flex-col overflow-hidden border border-[#e4e6eb] dark:border-[#3a3b3c] relative">
        {/* 1. Sticky Header Controls (Fixed above document, no overlap) */}
        <div className="shrink-0 w-full bg-[#f0f2f5] dark:bg-[#18191a] border-b border-[#e4e6eb] dark:border-[#3a3b3c] z-50">
          {!showToolbar ? (
            <div className="p-2 flex justify-end items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-auto ml-2">A4 Document Preview</span>
              <button
                type="button"
                onClick={() => setShowToolbar(true)}
                className="px-3 py-1.5 rounded-xl bg-accent text-white shadow-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-accent-hover transition-all active:scale-95"
              >
                <span>👁️ แสดงแผงควบคุม</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-2 sm:px-4 sm:py-2 flex flex-wrap items-center justify-between gap-3">
              {/* Left: Category Tabs + Round Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-[#e4e6eb] dark:bg-[#3a3b3c] p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('eq');
                        setSelectedRoundId('current');
                      }}
                      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap leading-normal overflow-visible active:scale-95 flex items-center gap-1.5 ${
                        selectedCategory === 'eq' ? 'bg-accent text-white shadow-md font-extrabold' : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] dark:hover:text-white'
                      }`}
                    >
                      <span className="shrink-0 leading-none">🏫</span>
                      <span className="whitespace-nowrap">ครุภัณฑ์</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('bag');
                        setSelectedRoundId('current');
                      }}
                      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap leading-normal overflow-visible active:scale-95 flex items-center gap-1.5 ${
                        selectedCategory === 'bag' ? 'bg-accent text-white shadow-md font-extrabold' : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] dark:hover:text-white'
                      }`}
                    >
                      <span className="shrink-0 leading-none">💼</span>
                      <span className="whitespace-nowrap">กระเป๋า</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('cart');
                        setSelectedRoundId('current');
                      }}
                      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap leading-normal overflow-visible active:scale-95 flex items-center gap-1.5 ${
                        selectedCategory === 'cart' ? 'bg-accent text-white shadow-md font-extrabold' : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] dark:hover:text-white'
                      }`}
                    >
                      <span className="shrink-0 leading-none">🛒</span>
                      <span className="whitespace-nowrap">รถ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('drug');
                        setSelectedRoundId('current');
                      }}
                      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap leading-normal overflow-visible active:scale-95 flex items-center gap-1.5 ${
                        selectedCategory === 'drug' ? 'bg-accent text-white shadow-md font-extrabold' : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505] dark:hover:text-white'
                      }`}
                    >
                      <span className="shrink-0 leading-none">💊</span>
                      <span className="whitespace-nowrap">คลังยา</span>
                    </button>
                </div>

                <select
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="bg-white dark:bg-[#242526] text-[#050505] dark:text-[#e4e6eb] border border-[#e4e6eb] dark:border-[#3a3b3c] rounded-xl px-3 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-accent/20"
                >
                  <option value="current">🟢 รอบปัจจุบัน</option>
                  {filteredHistoryRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      🕒 [{r.timestamp || r.date}] {r.who || 'ไม่ระบุ'}
                    </option>
                  ))}
                </select>

                {selectedRecord && onDeleteHistoryRecord && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentRecord}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
                    title="ลบประวัติรอบนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" /> ลบรอบนี้
                  </button>
                )}
              </div>

              {/* Right: Zoom + Export + Toggle + Close */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                <div className="flex items-center gap-0.5 bg-white dark:bg-[#242526] border border-[#e4e6eb] dark:border-[#3a3b3c] rounded-xl p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                    title="ซูมออก"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-800 dark:text-slate-200 rounded font-bold transition cursor-pointer text-[11px]"
                    title="รีเซ็ต 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                    title="ซูมเข้า"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                  <button
                    type="button"
                    onClick={handleFitScreen}
                    className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-[#1877f2] dark:text-blue-400 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-[11px]"
                    title="พอดีหน้าจอ"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">พอดีจอ</span>
                  </button>
                </div>

                <button
                  onClick={handleSendReportToGas}
                  disabled={isExportingGas}
                  className="bg-accent hover:bg-accent-hover text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap shadow-sm active:scale-95 transition-all"
                  title="ส่ง Report เข้า Google Sheets"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">ส่ง Sheets</span>
                </button>

                <button
                  onClick={handlePrintPdf}
                  disabled={isPrinting}
                  className="bg-accent hover:bg-accent-hover text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap shadow-sm active:scale-95 transition-all"
                  title="ดาวน์โหลด PDF (A4 แนวนอน)"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowToolbar(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#e4e6eb] dark:bg-[#3a3b3c] hover:bg-[#d8dadf] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] font-bold flex items-center gap-1.5 text-xs cursor-pointer transition-colors"
                  title="ซ่อนแผงควบคุม"
                >
                  <span>👁️ ซ่อน</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] flex items-center justify-center transition cursor-pointer shrink-0"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`px-3 py-1.5 text-xs font-semibold flex items-center justify-between ${
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

        {/* Body Area - Scrollable Clean HTML Table with Zoom & Pan */}
        <div
          ref={previewContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="preview-container flex-1 overflow-auto p-4 sm:p-12 bg-[#cbd5e1] dark:bg-black/60 select-none relative flex justify-center items-start"
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
          }}
        >
          <div
            ref={previewContentRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              display: 'inline-block',
              width: 'max-content',
              minWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            {selectedCategory === 'drug' ? (
              <DrugInventoryReportPreview
                drugs={resolvedDrugs}
                date={displayDate}
                inspector={displayInspector}
                signature={userSignature}
                clinicName={cleanClinicName}
                subCategory={drugSubCategory}
                onSubCategoryChange={setDrugSubCategory}
                headerNote={drugHeaderNote}
                onHeaderNoteChange={setDrugHeaderNote}
              />
            ) : selectedCategory === 'bag' || selectedCategory === 'cart' ? (
              <EmergencyChecklistReportPreview
                type={selectedCategory}
                items={activeItems}
                date={displayDate}
                inspector={displayInspector}
                signature={userSignature}
                agencyName={cleanClinicName}
                weekItemValues={weekItemValues}
                onWeekItemValuesChange={setWeekItemValues}
              />
            ) : (
              <div
                className="a4-page-sheet a4-print-container paper-preview sheet-preview p-6 rounded-lg shadow"
                style={{
                  display: 'inline-block',
                  width: 'max-content',
                  minWidth: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff !important',
                  background: '#ffffff !important',
                  color: '#000000 !important',
                }}
              >
            {/* Header Document Area */}
            <div className="text-center mb-4" style={{ backgroundColor: '#ffffff !important', background: '#ffffff !important' }}>
              <h2 className="text-xl font-bold" style={{ color: '#000000 !important' }}>{mainDocHeading}</h2>
              <p className="text-sm mt-1" style={{ color: '#000000 !important' }}>ณ วันที่ {formatThaiDate(displayDate)}</p>
            </div>

            <div className="flex justify-between items-center text-xs font-medium mb-3" style={{ color: '#000000 !important', backgroundColor: '#ffffff !important', background: '#ffffff !important' }}>
              <div>
                <span className="font-semibold" style={{ color: '#000000 !important' }}>{cleanClinicName}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1" style={{ color: '#000000 !important' }}>
                  <Calendar className="w-3.5 h-3.5" style={{ color: '#000000 !important' }} />
                  วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(displayDate)}
                </span>
                {displayInspector && (
                  <span className="flex items-center gap-1 font-medium" style={{ color: '#000000 !important' }}>
                    <UserIcon className="w-3.5 h-3.5" style={{ color: '#000000 !important' }} />
                    ผู้ตรวจ: {displayInspector}
                  </span>
                )}
              </div>
            </div>

            <table className="w-full min-w-[1050px] border-collapse border border-slate-400 text-xs" style={{ backgroundColor: '#ffffff !important', color: '#000000 !important' }}>
              <thead>
                <tr className="font-bold text-center" style={{ backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
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
                <tr className="font-semibold text-center text-[11px]" style={{ backgroundColor: '#f1f5f9 !important', color: '#000000 !important' }}>
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
                      <tr key={idx} style={{ color: '#000000 !important' }}>
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.code || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.sap || '-'}</td>
                        <td className="border border-slate-300 p-2 text-left font-normal" style={{ paddingLeft: '8px' }}>{item.name || '-'}</td>
                        <td className="border border-slate-300 p-2 text-xs">{item.spec || '-'}</td>
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
            <div className="mt-8 pt-4 border-t border-slate-200 flex justify-around text-xs" style={{ color: '#000000 !important', backgroundColor: '#ffffff !important', background: '#ffffff !important' }}>
              <div className="text-center flex flex-col items-center">
                {userSignature ? (
                  <div className="h-12 flex items-end justify-center mb-1">
                    <img src={userSignature} alt="ลายเซ็น" className="max-h-12 max-w-[140px] object-contain" />
                  </div>
                ) : (
                  <div className="h-12" />
                )}
                <p style={{ color: '#000000 !important' }}>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                <p style={{ color: '#000000 !important' }}>({displayInspector || '....................................................'})</p>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="h-12" />
                <p style={{ color: '#000000 !important' }}>ลงชื่อ .................................................... หัวหน้างาน</p>
                <p style={{ color: '#000000 !important' }}>(....................................................)</p>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for History Deletion */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <Trash2 className="w-5 h-5" />
              <span>ยืนยันการลบประวัติการตรวจรอบนี้?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการลบประวัติการตรวจรอบ <b>"{recordToDelete.title || recordToDelete.timestamp}"</b> วันที่ {recordToDelete.date || recordToDelete.timestamp} ออกจากระบบและเครื่องทั้งหมดหรือไม่? การดำเนินการนี้จะมีผลถาวร
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCurrentRecord}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
