import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Printer,
  X,
  FileSpreadsheet,
  Trash2,
  Maximize2,
  RefreshCw,
  Scaling,
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
import {
  EquipmentReportPreview,
  generateEquipmentPrintHtml,
} from './EquipmentReportPreview';

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
  val?: string;
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

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    if (y < 2400) y += 543;
    return `${d}/${m}/${y}`;
  }

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

  const currentYearAD = new Date().getFullYear();
  const currentYearBE = currentYearAD + 543;
  const shortAD = String(currentYearAD).slice(-2);
  const shortBE = String(currentYearBE).slice(-2);

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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFitToScreen, setIsFitToScreen] = useState<boolean>(true);
  const [orientation] = useState<'landscape' | 'portrait'>('landscape');

  const [weekItemValues] = useState<{ [itemKey: string]: { [week: number]: string } }>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [modalContentWidth, setModalContentWidth] = useState<number>(
    typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 1200) : 1120
  );
  const [sheetHeight, setSheetHeight] = useState<number>(850);

  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        setSelectedCategory(initialCategory);
      }
      if (initialDrugSubCategory) {
        setDrugSubCategory(initialDrugSubCategory);
      }
      setSelectedRoundId('current');
      setFeedback(null);
      setIsFitToScreen(true);
    }
  }, [initialCategory, initialDrugSubCategory, isOpen]);

  // Synchronous layout effect & observer for immediate mount render measurement
  useLayoutEffect(() => {
    if (!isOpen) return;

    const measureSizes = () => {
      if (scrollContainerRef.current) {
        const cw = scrollContainerRef.current.clientWidth;
        if (cw > 0) setModalContentWidth(cw);
      }
      if (sheetRef.current) {
        const sh = sheetRef.current.offsetHeight;
        if (sh > 0) setSheetHeight(sh);
      }
    };

    measureSizes();
    const raf = requestAnimationFrame(measureSizes);
    const timer = setTimeout(measureSizes, 60);

    window.addEventListener('resize', measureSizes);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', measureSizes);
    };
  }, [isOpen, selectedCategory, selectedRoundId, drugSubCategory, isFullscreen, isFitToScreen]);

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

  const selectedRecord = historyRecords.find((r) => r.id === selectedRoundId);

  const filteredHistoryRecords = historyRecords.filter((r) => {
    if (selectedCategory === 'eq') return r.type === 'eq';
    if (selectedCategory === 'bag') return r.type === 'bag';
    if (selectedCategory === 'cart') return r.type === 'cart';
    if (selectedCategory === 'drug') return r.type === 'drug';
    return true;
  });

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

  const cleanClinicName = useMemo(() => {
    const raw = String(displayTitle || 'คลินิกงานบริการผู้ป่วยในวิสัญญี')
      .replace(/\s*\(ภาพรวมทุกห้อง\)/g, '')
      .trim();
    if (selectedCategory === 'eq' || raw.includes('คลินิกงานบริการ')) {
      return 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    }
    return raw || 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
  }, [displayTitle, selectedCategory]);

  const mainDocHeading = useMemo(() => {
    const { month, year } = getMonthAndYearThai(displayDate);
    if (selectedCategory === 'eq') return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
    if (selectedCategory === 'bag') return `ตารางตรวจเช็คกระเป๋ายา Emergency ประจำเดือน ${month} / ปี ${year}`;
    if (selectedCategory === 'cart') return `ตารางตรวจเช็ครถ Emergency ประจำเดือน ${month} / ปี ${year}  หน่วยงาน: ${cleanClinicName}`;
    if (selectedCategory === 'drug') return getDrugCategoryTitle(drugSubCategory, displayDate);
    return 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';
  }, [selectedCategory, drugSubCategory, displayDate, cleanClinicName]);

  const userSignature = useMemo(() => {
    if (currentUser?.signature) return currentUser.signature;
    if (currentUser?.id) {
      const s = localStorage.getItem(`user_signature_${currentUser.id}`);
      if (s) return s;
    }
    return localStorage.getItem('user_signature_default') || '';
  }, [currentUser]);

  if (!isOpen) return null;

  // Base Paper Width for clean A4 printing without font reflow
  const basePaperWidth = 1120;
  const availableContentWidth = Math.max(300, modalContentWidth - 48);
  const scaleFactor = isFitToScreen ? Math.min(1, availableContentWidth / basePaperWidth) : 1;

  const handlePrintPdf = () => {
    setIsPrinting(true);
    let printHtml = '';
    const printOptions = {
      date: displayDate,
      inspector: displayInspector,
      signature: userSignature,
      clinicName: cleanClinicName,
      mainDocHeading: mainDocHeading,
      orientation: orientation,
      currentUser: currentUser,
    };

    if (selectedCategory === 'drug') {
      printHtml = generateDrugPrintHtml(resolvedDrugs, {
        ...printOptions,
        subCategory: drugSubCategory,
        headerNote: drugHeaderNote,
      });
    } else if (selectedCategory === 'bag' || selectedCategory === 'cart') {
      printHtml = generateEmergencyPrintHtml(selectedCategory, activeItems, {
        ...printOptions,
        agencyName: cleanClinicName,
        weekItemValues,
      });
    } else {
      printHtml = generateEquipmentPrintHtml(activeItems, printOptions);
    }

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

  return (
    <div
      className="official-report-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.65)',
        padding: '12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="official-report-modal-card"
        style={{
          width: isFullscreen ? '100vw' : '95vw',
          maxWidth: isFullscreen ? '100vw' : '1240px',
          height: isFullscreen ? '100vh' : '90vh',
          maxHeight: isFullscreen ? '100vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isFullscreen ? '0px' : '16px',
          position: 'relative',
          background: '#f8fafc',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Modal Sticky Header Bar */}
        <div
          className="p-3 sm:p-4 border-b border-slate-200 bg-white flex flex-col gap-3 shrink-0"
          style={{
            flexShrink: 0,
            zIndex: 20,
            background: '#ffffff',
            position: 'sticky',
            top: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'eq', label: 'ครุภัณฑ์', emoji: '🏫' },
                { id: 'bag', label: 'กระเป๋า', emoji: '💼' },
                { id: 'cart', label: 'รถ', emoji: '🛒' },
                { id: 'drug', label: 'คลังยา', emoji: '💊' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id as any);
                    setSelectedRoundId('current');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="ปิดพรีวิว"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer"
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
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title={isFullscreen ? 'ย่อหน้าจอ' : 'เต็มหน้าจอ'}
              >
                <Maximize2 size={16} />
              </button>

              <button
                type="button"
                onClick={() => setIsFitToScreen(!isFitToScreen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl shadow-md transition cursor-pointer active:scale-95 ${
                  isFitToScreen
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
                title={isFitToScreen ? 'แสดงขนาดจริง 100%' : 'ปรับขนาดพอดีหน้าจอ'}
              >
                <Scaling className="w-3.5 h-3.5" />
                <span>{isFitToScreen ? '[⤢ พอดีหน้าจอ]' : '[🔍 ขนาดจริง 100%]'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendReportToGas}
                disabled={isExportingGas}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isExportingGas ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>ส่ง Sheets</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                disabled={isPrinting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isPrinting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>พิมพ์ / PDF</span>
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                feedback.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800'
                  : feedback.type === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              <span>{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs font-bold ml-2 underline"
              >
                ปิด
              </button>
            </div>
          )}
        </div>

        {/* Printable Area Content Scrollable Wrapper */}
        <div
          ref={scrollContainerRef}
          className="paper-scroll-viewport report-viewport-area"
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '16px',
            boxSizing: 'border-box',
            background: '#e2e8f0',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Print Guidance Banner */}
          <div className="w-full max-w-[1080px] bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 rounded-xl text-xs font-semibold mb-3 flex items-center justify-between no-print shrink-0">
            <span>💡 <b>คำแนะนำ:</b> แนะนำเลือกการจัดวางเป็น <b>"แนวนอน" (Landscape)</b> ในหน้าต่างพิมพ์ PDF เพื่อตารางรายงาน A4 ที่สมบูรณ์แบบที่สุด</span>
          </div>

          {/* Scaled A4 Paper Holder (Isolated Canvas Viewport) */}
          <div
            className="a4-paper-holder"
            style={{
              width: isFitToScreen ? `${basePaperWidth * scaleFactor}px` : `${basePaperWidth}px`,
              height: isFitToScreen ? `${sheetHeight * scaleFactor}px` : `${sheetHeight}px`,
              minHeight: isFitToScreen ? `${794 * scaleFactor}px` : '794px',
              position: 'relative',
              margin: '0 auto',
              boxSizing: 'border-box',
              overflow: 'visible',
              flexShrink: 0,
            }}
          >
            <div
              ref={sheetRef}
              className="a4-paper-sheet a4-paper-wrapper"
              style={{
                width: '1120px',
                minWidth: '1120px',
                transform: isFitToScreen
                  ? `translate(-50%, 0) scale(${scaleFactor})`
                  : 'translate(-50%, 0) scale(1)',
                WebkitTransform: isFitToScreen
                  ? `translate(-50%, 0) scale(${scaleFactor})`
                  : 'translate(-50%, 0) scale(1)',
                transformOrigin: 'top center',
                willChange: 'transform',
                background: '#ffffff',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                borderRadius: '2px',
                boxSizing: 'border-box',
                padding: '32px',
                position: 'absolute',
                top: 0,
                left: '50%',
                minHeight: '794px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#000000',
              }}
            >
              {/* Unified Report Content Switcher */}
              {selectedCategory === 'drug' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 border-b pb-3 no-print flex-wrap gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {['all', 'monthly', 'quarterly', 'adhoc'].map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setDrugSubCategory(sub as any)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            drugSubCategory === sub
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {sub === 'all'
                            ? 'ทั้งหมด'
                            : sub === 'monthly'
                            ? 'รายเดือน'
                            : sub === 'quarterly'
                            ? '3 เดือน'
                            : 'ครั้งคราว'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={drugHeaderNote}
                      onChange={(e) => setDrugHeaderNote(e.target.value)}
                      placeholder="หมายเหตุท้ายชื่อรายงาน..."
                      className="text-xs border border-slate-300 px-2.5 py-1 rounded-lg outline-none"
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
                  currentUser={currentUser}
                />
              ) : (
                <EquipmentReportPreview
                  items={activeItems}
                  date={displayDate}
                  inspector={displayInspector}
                  signature={userSignature}
                  clinicName={cleanClinicName}
                  mainDocHeading={mainDocHeading}
                  currentUser={currentUser}
                />
              )}
            </div>
          </div>
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
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCurrentRecord}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm cursor-pointer"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media print {
          .no-print, button, select, header, footer { display: none !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};
