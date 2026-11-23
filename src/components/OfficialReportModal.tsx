import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Printer,
  X,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Scaling,
  ChevronDown,
  SlidersHorizontal,
  CheckCircle2,
  Calendar,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { InspectionHistoryRecord, User, DrugItem } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { sendInspectionToGas } from '../services/api';
import { getBangkokYearCE } from '../utils/dateUtils';
import { exportOfficialReportPdf } from '../utils/exportPdf';
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
import { EquipmentReportPreview, generateEquipmentPrintHtml } from './EquipmentReportPreview';
import {
  extractQuantityNumbers,
  getItemQuantityClassification,
  getRealTargetCheckValue,
  sanitizeItemName,
  sortItemsNaturally
} from '../utils/itemUtils';
import { useDataContext } from '../context/DataContext';

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
  subItemQuantities?: number[];
  subExps?: Array<{ label?: string; exp?: string; qty?: number; hasNoExp?: boolean }>;
  unitText?: string;
}

export interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'eq' | 'bag' | 'cart' | 'drug' | 'ambulance' | string;
  initialDrugSubCategory?: 'all' | 'monthly' | 'quarterly' | 'adhoc';
  title?: string;
  date?: string;
  inspector?: string;
  items?: OfficialReportItemRow[];
  eqItems?: OfficialReportItemRow[];
  bagItems?: OfficialReportItemRow[];
  cartItems?: OfficialReportItemRow[];
  ambulanceItems?: OfficialReportItemRow[];
  drugs?: DrugItem[];
  sheetUrl?: string;
  apiUrl?: string;
  historyRecords?: InspectionHistoryRecord[];
  currentUser?: User | null;
  onDeleteHistoryRecord?: (recordId: string, category?: 'eq' | 'bag' | 'cart' | 'drug' | 'ambulance' | string) => Promise<void> | void;
  onDeleteAllHistoryRecords?: (category: 'eq' | 'bag' | 'cart' | 'drug' | 'ambulance' | string, recordIds: string[]) => Promise<void> | void;
  initialWeek?: number;
  initialWeekDates?: { [week: number]: string };
  initialRoundId?: string;
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

  // Handle multiple dates "Label: date, Label: date" or "date, date"
  if (str.includes(',') || str.includes(':')) {
    return str.split(',').map(p => {
      const parts = p.split(':');
      if (parts.length === 2) {
        return `${parts[0].trim()}: ${formatAcquiredDate(parts[1].trim())}`;
      }
      // If it's just a comma-separated list of dates
      const trimmed = p.trim();
      if (!trimmed) return '';
      return formatAcquiredDate(trimmed);
    }).filter(Boolean).join(', ');
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

export interface SubExpItem {
  label?: string;
  dateStr: string;
  formattedDate: string;
  isRed: boolean;
}

export function parseSubExpItems(expVal?: string | null): SubExpItem[] {
  if (!expVal) return [];
  const str = String(expVal).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return [];

  const currentYearAD = getBangkokYearCE();
  const currentYearBE = currentYearAD + 543;

  const parts = str.includes(',') ? str.split(',') : [str];
  const items: SubExpItem[] = [];

  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    let label = '';
    let datePart = trimmed;

    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      label = trimmed.substring(0, colonIdx).trim();
      datePart = trimmed.substring(colonIdx + 1).trim();
    }

    const isNoExp = !datePart || datePart === '-' || datePart.toLowerCase() === 'no exp';
    if (isNoExp) {
      items.push({
        label,
        dateStr: '-',
        formattedDate: '-',
        isRed: false,
      });
      return;
    }

    const formattedDate = formatAcquiredDate(datePart);

    let isRed = false;
    let yearAD: number | null = null;

    const isoMatch = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    const dmyMatch = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    const fmtDmyMatch = formattedDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);

    if (isoMatch) {
      let y = parseInt(isoMatch[1], 10);
      yearAD = y > 2400 ? y - 543 : y;
    } else if (dmyMatch) {
      let y = parseInt(dmyMatch[3], 10);
      yearAD = y > 2400 ? y - 543 : y;
    } else if (fmtDmyMatch) {
      let y = parseInt(fmtDmyMatch[3], 10);
      yearAD = y > 2400 ? y - 543 : y;
    }

    if (yearAD !== null) {
      // RED ONLY for current year (<= 2026 / 2569) or expired
      if (yearAD <= currentYearAD) {
        isRed = true;
      }
    } else {
      if (trimmed.includes(String(currentYearAD)) || trimmed.includes(String(currentYearBE))) {
        isRed = true;
      }
    }

    items.push({
      label,
      dateStr: datePart,
      formattedDate: formattedDate || datePart,
      isRed,
    });
  });

  return items;
}

export function isCurrentYearExp(expVal?: string | null): boolean {
  const items = parseSubExpItems(expVal);
  return items.some((i) => i.isRed);
}

export function cleanQuantityUnit(valStr?: string | number): string {
  if (!valStr && valStr !== 0) return '1';
  let str = String(valStr).trim();
  if (!str || str === '-') return '1';

  // [เงื่อนไขผ่อนปรน]: อนุญาตให้ใส่ "PSI" และรักษารูปแบบตัวเลขคั่นด้วย comma (สำหรับหลายชิ้น)
  // ห้ามลบภาษาอังกฤษถ้าเป็น "PSI" หรือหน่วยวัดแรงดัน
  const isPsi = /psi/i.test(str);
  
  if (isPsi) {
    // Keep numbers and PSI, remove Thai
    str = str.replace(/[ก-๙]+/g, '').trim();
    return str;
  }

  // Strip all Thai characters, English letters (except PSI handled above), and units
  str = str.replace(/[ก-๙a-zA-RT-Z]+/g, '').trim(); // Keep 'S' for PSI check above or just strip all except numbers and common separators
  str = str.replace(/[()]/g, '').trim();
  str = str.replace(/\s+/g, ' ').trim();
  
  if (/^\d+\s+\d+$/.test(str)) {
    str = str.replace(/\s+/g, ', ');
  }
  return str || '1';
}

export const formatStrictCountableNumbers = cleanQuantityUnit;

export function formatRealQuantity(qtyVal?: string | number, nameStr?: string, specStr?: string, expVal?: string, subQuantities?: number[]): string {
  const classification = getItemQuantityClassification({
    name: nameStr || '',
    spec: specStr,
    qty: qtyVal,
    exp: expVal,
    subItemQuantities: subQuantities,
  });

  // Type 1 (homogeneous multiple items e.g. Tape 4 เส้น, Syringe blow cuff 2 อัน, Sterile water 3 ขวด):
  // ALWAYS return single total count string e.g. "4", "2", "3"! NEVER "1, 1, 1, 1" or "1, 1"
  if (classification.isType1) {
    return String(classification.totalQty);
  }

  // Type 2 (distinct sub-items / sizes):
  if (classification.isType2) {
    if (classification.subQuantities && classification.subQuantities.length > 0) {
      return classification.subQuantities.join(', ');
    }
    return classification.subItems.map(() => '1').join(', ');
  }

  if (subQuantities && subQuantities.length > 0) {
    return subQuantities.join(', ');
  }
  const extracted = extractQuantityNumbers(qtyVal, subQuantities);
  if (extracted.length > 1) {
    return extracted.join(', ');
  }
  const strQty = String(qtyVal || '').trim();
  if (strQty.includes(',')) {
    const parts = strQty.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => {
        const cleaned = p.replace(/\D/g, '');
        return cleaned || '1';
      }).join(', ');
    }
  }

  return cleanQuantityUnit(strQty || '1');
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
  ambulanceItems = [],
  drugs: propDrugs,
  apiUrl = '',
  historyRecords = [],
  currentUser = null,
  onDeleteHistoryRecord,
  onDeleteAllHistoryRecords,
  initialWeek,
  initialWeekDates,
  initialRoundId,
}) => {
  const { activeChannel } = useDataContext();
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'eq' | 'bag' | 'cart' | 'drug' | 'ambulance'>('eq');
  const [selectedRoundId, setSelectedRoundId] = useState<string>('current');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<InspectionHistoryRecord | null>(null);
  const [confirmDeleteAllCategory, setConfirmDeleteAllCategory] = useState<'eq' | 'bag' | 'cart' | 'drug' | 'ambulance' | null>(null);
  const [isDeletingAllHistory, setIsDeletingAllHistory] = useState(false);
  const [isExportingGas, setIsExportingGas] = useState<boolean>(false);
  const [drugSubCategory, setDrugSubCategory] = useState<'all' | 'monthly' | 'quarterly' | 'adhoc'>(initialDrugSubCategory);
  const [drugHeaderNote, setDrugHeaderNote] = useState<string>('');
  const [isFitToScreen, setIsFitToScreen] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [orientation] = useState<'landscape' | 'portrait'>('landscape');

  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [isBlankForm, setIsBlankForm] = useState<boolean>(false);
  const [weekDates, setWeekDates] = useState<{ [wk: number]: string }>({});
  const [weekItemValues] = useState<{ [itemKey: string]: { [week: number]: string } }>({});

  const [inspectorNameInput, setInspectorNameInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_display_name') || currentUser?.name || inspector || 'สาธิต';
    }
    return currentUser?.name || inspector || 'สาธิต';
  });
  const [inspectorPosInput, setInspectorPosInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_display_position') || currentUser?.position || 'พยาบาลวิสัญญี';
    }
    return currentUser?.position || 'พยาบาลวิสัญญี';
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [modalContentWidth, setModalContentWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1120
  );

  // Mouse Drag-to-Scroll (Pan) states & handlers for desktop A4 paper
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        setSelectedCategory(initialCategory as any);
      }
      if (initialDrugSubCategory) {
        setDrugSubCategory(initialDrugSubCategory);
      }
      if (initialWeek !== undefined && initialWeek !== null) {
        setActiveWeek(Number(initialWeek));
      }
      if (initialWeekDates) {
        setWeekDates(initialWeekDates);
      }
      if (initialRoundId) {
        setSelectedRoundId(initialRoundId);
      } else {
        setSelectedRoundId('current');
      }
      setFeedback(null);
      setIsFitToScreen(true);
      setIsSettingsOpen(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollContainerRef.current.scrollLeft = 0;
      }
    }
  }, [initialCategory, initialDrugSubCategory, initialWeek, initialWeekDates, initialRoundId, isOpen]);

  // Reset scroll position to top-left corner whenever switching to 100% actual size
  useEffect(() => {
    if (!isFitToScreen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [isFitToScreen]);

  const handleToggleFitToScreen = () => {
    setIsFitToScreen((prev) => {
      const next = !prev;
      if (!next && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollContainerRef.current.scrollLeft = 0;
      }
      return next;
    });
  };

  // Lightweight viewport width measurement for responsive paper zoom (no height ResizeObserver needed in normal flow)
  useLayoutEffect(() => {
    if (!isOpen) return;

    let rafId: number | null = null;
    const measureWidth = () => {
      if (scrollContainerRef.current) {
        const cw = scrollContainerRef.current.clientWidth;
        if (cw > 0) {
          setModalContentWidth((prev) => (Math.abs(prev - cw) > 1 ? cw : prev));
        }
      }
    };

    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measureWidth();
      });
    };

    measureWidth();
    const timer = setTimeout(measureWidth, 60);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && scrollContainerRef.current) {
      ro = new ResizeObserver(scheduleMeasure);
      ro.observe(scrollContainerRef.current);
    }

    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearTimeout(timer);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [isOpen, selectedCategory, isFitToScreen]);

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

  const [showRoundDropdown, setShowRoundDropdown] = useState<boolean>(false);

  const selectedRecord = historyRecords.find((r) => r.id === selectedRoundId);

  const filteredHistoryRecords = useMemo(() => {
    if (!historyRecords || !Array.isArray(historyRecords)) return [];
    const seenIds = new Set<string>();
    return historyRecords.filter((r) => {
      if (!r || !r.id || seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      const t = String(r.type || '').toLowerCase();
      if (selectedCategory === 'eq') return !t || t === 'eq' || t === 'equipment' || t.includes('ครุภัณฑ์');
      if (selectedCategory === 'bag') return t === 'bag' || t.includes('กระเป๋า');
      if (selectedCategory === 'cart') return t === 'cart' || (t.includes('รถ') && !t.includes('พยาบาล'));
      if (selectedCategory === 'ambulance') return t === 'ambulance' || t.includes('พยาบาล');
      if (selectedCategory === 'drug') return t === 'drug' || t === 'drugs' || t.includes('ยา');
      return true;
    });
  }, [historyRecords, selectedCategory]);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const storedName = localStorage.getItem('user_display_name');
      const storedPos = localStorage.getItem('user_display_position');
      if (storedName) setInspectorNameInput(storedName);
      if (storedPos) setInspectorPosInput(storedPos);
    }
  }, [isOpen]);

  const handleInspectorNameChange = (val: string) => {
    setInspectorNameInput(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_display_name', val.trim() || 'สาธิต');
      window.dispatchEvent(new Event('user_profile_updated'));
    }
  };

  const handleInspectorPosChange = (val: string) => {
    setInspectorPosInput(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_display_position', val.trim() || 'พยาบาลวิสัญญี');
      window.dispatchEvent(new Event('user_profile_updated'));
    }
  };

  const activeUserName = useMemo(() => {
    return (inspectorNameInput || currentUser?.name || inspector || 'สาธิต').trim();
  }, [inspectorNameInput, currentUser, inspector]);

  const { activeItems, displayTitle, displayDate, displayInspector } = useMemo(() => {
    if (selectedRecord) {
      return {
        activeItems: selectedRecord.rows || [],
        displayTitle: selectedRecord.title || title,
        displayDate: selectedRecord.date || surveyDate,
        displayInspector: selectedRecord.who || activeUserName,
      };
    }
    if (selectedCategory === 'eq') {
      return {
        activeItems: eqItems.length > 0 ? eqItems : items,
        displayTitle: 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
        displayDate: surveyDate,
        displayInspector: activeUserName,
      };
    }
    if (selectedCategory === 'bag') {
      return {
        activeItems: bagItems.length > 0 ? bagItems : items,
        displayTitle: 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency',
        displayDate: surveyDate,
        displayInspector: activeUserName,
      };
    }
    if (selectedCategory === 'cart') {
      return {
        activeItems: cartItems.length > 0 ? cartItems : items,
        displayTitle: 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency',
        displayDate: surveyDate,
        displayInspector: activeUserName,
      };
    }
    if (selectedCategory === 'ambulance') {
      return {
        activeItems: ambulanceItems.length > 0 ? ambulanceItems : items,
        displayTitle: 'แบบฟอร์มตรวจสอบความพร้อม รถพยาบาลฉุกเฉิน (Ambulance)',
        displayDate: surveyDate,
        displayInspector: activeUserName,
      };
    }
    return {
      activeItems: drugReportItems,
      displayTitle: 'แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ',
      displayDate: surveyDate,
      displayInspector: activeUserName,
    };
  }, [selectedRecord, selectedCategory, eqItems, bagItems, cartItems, ambulanceItems, items, drugReportItems, title, surveyDate, activeUserName]);

  const memoizedWeekItemValues = useMemo(() => {
    if (selectedCategory !== 'bag' && selectedCategory !== 'cart' && selectedCategory !== 'ambulance') return {};
    if (selectedRecord) {
      return activeItems.reduce((acc, it) => {
        if (it.name) {
          acc[`${it.name}|${it.code || ''}`] = it.weekVals || {};
        }
        return acc;
      }, {} as { [itemKey: string]: { [week: number]: string } });
    }
    return activeItems.reduce((acc, it) => {
      if (it.name) {
        const realVal = formatRealQuantity(it.qty, it.name, it.spec, it.exp, it.subItemQuantities);
        const targetVal = getRealTargetCheckValue(it as any);
        acc[`${it.name}|${it.code || ''}`] =
          it.weekVals !== undefined
            ? it.weekVals
            : { [activeWeek]: it.res === 'ใช้งานได้' ? (realVal || targetVal) : (it.res === 'ใช้งานไม่ได้' ? '0' : '') };
      }
      return acc;
    }, {} as { [itemKey: string]: { [week: number]: string } });
  }, [selectedCategory, selectedRecord, activeItems, activeWeek]);

  const resolvedPreviewUser = useMemo(() => {
    return currentUser
      ? { ...currentUser, name: activeUserName, position: inspectorPosInput }
      : ({ name: activeUserName, position: inspectorPosInput } as any);
  }, [currentUser, activeUserName, inspectorPosInput]);

  const cleanClinicName = useMemo(() => {
    if (activeChannel && !activeChannel.isDefault) {
      return `คลินิกวิสัญญี (${activeChannel.name})`;
    }
    const raw = String(displayTitle || 'คลินิกงานบริการผู้ป่วยในวิสัญญี')
      .replace(/\s*\(ภาพรวมทุกห้อง\)/g, '')
      .replace(/^แบบฟอร์มตรวจสอบ.*$/g, '')
      .trim();
    if (!raw || raw.includes('แบบฟอร์ม') || raw.includes('คลินิกงานบริการ') || selectedCategory === 'eq' || selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance') {
      return 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
    }
    return raw;
  }, [displayTitle, selectedCategory, activeChannel]);

  const mainDocHeading = useMemo(() => {
    let monthVal = '';
    let yearVal = '';
    
    if (isBlankForm && (selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance')) {
      monthVal = '....................................................';
      yearVal = '............';
    } else {
      const res = getMonthAndYearThai(displayDate);
      monthVal = res.month;
      yearVal = res.year;
    }
    
    const chanTag = activeChannel && !activeChannel.isDefault ? ` (${activeChannel.name})` : '';
    if (selectedCategory === 'eq') return `ทะเบียนรายการครุภัณฑ์และอุปกรณ์${chanTag}`;
    if (selectedCategory === 'bag') return `ตารางตรวจเช็คกระเป๋า Emergency${chanTag} ประจำเดือน ${monthVal} พ.ศ. ${yearVal}`;
    if (selectedCategory === 'cart') return `ตารางตรวจเช็ครถ Emergency${chanTag} ประจำเดือน ${monthVal} พ.ศ. ${yearVal}`;
    if (selectedCategory === 'ambulance') return `ตารางตรวจเช็ครถพยาบาลฉุกเฉิน (Ambulance)${chanTag} ประจำเดือน ${monthVal} พ.ศ. ${yearVal}`;
    if (selectedCategory === 'drug') return getDrugCategoryTitle(drugSubCategory, displayDate);
    return `ทะเบียนรายการครุภัณฑ์และอุปกรณ์${chanTag}`;
  }, [selectedCategory, drugSubCategory, displayDate, activeChannel, isBlankForm]);

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
  const availableContentWidth = Math.max(280, modalContentWidth - 16);
  const scaleFactor = isFitToScreen ? Math.min(1, availableContentWidth / basePaperWidth) : 1;

  const handlePrintPdf = () => {
    setIsPrinting(true);
    let printHtml = '';
    const printOptions: any = {
      date: displayDate,
      inspector: displayInspector || activeUserName,
      signature: userSignature,
      clinicName: cleanClinicName,
      mainDocHeading: mainDocHeading,
      orientation: orientation,
      currentUser: currentUser ? { ...currentUser, name: activeUserName } : ({ name: activeUserName } as any),
    };

    if (selectedCategory === 'drug') {
      printHtml = generateDrugPrintHtml(resolvedDrugs, {
        ...printOptions,
        subCategory: drugSubCategory,
        headerNote: drugHeaderNote,
      });
    } else if (selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance') {
      const wkVals = selectedRecord ? activeItems.reduce((acc, it) => {
        if (it.name) {
          acc[`${it.name}|${it.code || ''}`] = it.weekVals || {};
        }
        return acc;
      }, {} as any) : activeItems.reduce((acc, it) => {
        if (it.name) {
          const realVal = formatRealQuantity(it.qty, it.name, it.spec, it.exp, it.subItemQuantities);
          const targetVal = getRealTargetCheckValue(it as any);
          if (it.weekVals !== undefined) {
            acc[`${it.name}|${it.code || ''}`] = it.weekVals;
          } else {
            acc[`${it.name}|${it.code || ''}`] = {
              [activeWeek]: it.res === 'ใช้งานได้' ? (realVal || targetVal) : (it.res === 'ใช้งานไม่ได้' ? '0' : '')
            };
          }
        }
        return acc;
      }, {} as any);

      printHtml = generateEmergencyPrintHtml(selectedCategory, activeItems, {
        ...printOptions,
        agencyName: cleanClinicName,
        weekItemValues: wkVals,
        weekDates: selectedRecord ? selectedRecord.weekDates : weekDates,
        activeWeek: selectedRecord ? (Object.keys(selectedRecord.rows[0]?.weekVals || {}).map(Number)[0] || 1) : activeWeek,
        isBlankForm: isBlankForm,
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

  const handleDownloadThaiPdf = async () => {
    setIsPrinting(true);
    try {
      let headers: string[] = [];
      let rows: Array<Array<string | number>> = [];

      if (selectedCategory === 'drug') {
        const filteredDrugs =
          drugSubCategory === 'all'
            ? resolvedDrugs
            : resolvedDrugs.filter((d) => d.category === drugSubCategory);
        headers = ['ลำดับ', 'รหัสยา', 'ชื่อยาและสารน้ำ', 'คงเหลือ', 'Min', 'Lot', 'วันหมดอายุ', 'หมายเหตุ'];
        rows = filteredDrugs.map((d, idx) => [
          idx + 1,
          d.tmtCode || d.hospitalDrugCode || d.barcode || '-',
          d.name,
          `${d.remaining ?? 0} ${d.unit || ''}`.trim(),
          d.minStock ?? '-',
          d.lotNumber || '-',
          d.expDate || '-',
          d.note || '-',
        ]);
      } else if (selectedCategory === 'bag' || selectedCategory === 'cart') {
        headers = ['ลำดับ', 'หมวด/ชั้น', 'รายการอุปกรณ์/ยา', 'จำนวน', 'วันหมดอายุ', 'ผลการตรวจ'];
        rows = activeItems.map((it, idx) => [
          idx + 1,
          it.group || '-',
          sanitizeItemName(it.name),
          formatRealQuantity(it.qty, it.name, it.spec, it.exp, it.subItemQuantities),
          it.exp || it.date || '-',
          isBlankForm ? '' : it.res || '-',
        ]);
      } else {
        headers = ['ลำดับ', 'รหัสครุภัณฑ์', 'รายการครุภัณฑ์', 'จำนวน', 'สถานที่', 'ผลการตรวจ', 'หมายเหตุ'];
        rows = activeItems.map((it, idx) => [
          idx + 1,
          it.code || it.sap || '-',
          sanitizeItemName(it.name),
          cleanQuantityUnit(it.qty),
          it.location || '-',
          it.res || '-',
          it.note || '-',
        ]);
      }

      await exportOfficialReportPdf({
        reportType: selectedCategory,
        title: mainDocHeading,
        departmentName: cleanClinicName,
        inspectorName: displayInspector || activeUserName,
        inspectorPosition: inspectorPosInput || currentUser?.position || 'พยาบาลวิสัญญี',
        dateStr: formatThaiDate(displayDate) || displayDate,
        signatureDataUrl: userSignature,
        headers,
        rows,
        summaryText: `รวมทั้งหมด ${rows.length} รายการ`,
      });
      setFeedback({
        type: 'success',
        message: '✓ ดาวน์โหลดไฟล์ PDF (ฟอนต์ภาษาไทย NotoSansThai) สำเร็จเรียบร้อย',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'ไม่สามารถสร้างไฟล์ PDF ได้: ' + (err?.message || err),
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleConfirmDeleteCurrentRecord = async () => {
    if (!recordToDelete || !onDeleteHistoryRecord) return;
    const recId = recordToDelete.id;
    const recCategory = (recordToDelete.type as any) || selectedCategory;
    setSelectedRoundId('current');
    setRecordToDelete(null);
    setIsSettingsOpen(false);
    setShowRoundDropdown(false);
    await onDeleteHistoryRecord(recId, recCategory);
  };

  const handleConfirmDeleteAllCategoryHistory = async () => {
    if (!confirmDeleteAllCategory || !onDeleteAllHistoryRecords) return;
    const targetCategory = confirmDeleteAllCategory;
    const idsToDelete = filteredHistoryRecords.map((r) => r.id).filter(Boolean);
    setIsDeletingAllHistory(true);
    try {
      await onDeleteAllHistoryRecords(targetCategory, idsToDelete);
      setSelectedRoundId('current');
      setConfirmDeleteAllCategory(null);
      setIsSettingsOpen(false);
      setShowRoundDropdown(false);
    } finally {
      setIsDeletingAllHistory(false);
    }
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
      } else if (selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance') {
        const uniqueSheet = selectedCategory === 'bag'
          ? `กระเป๋า_EMER_${dateFormatted}`
          : selectedCategory === 'ambulance'
          ? `รถพยาบาล_EMER_${dateFormatted}`
          : `รถ_EMER_${dateFormatted}`;
        
        // Group and Sort Naturally for Sheets
        const groups: Record<string, OfficialReportItemRow[]> = {};
        activeItems.forEach(item => {
          const g = item.group || '-';
          if (!groups[g]) groups[g] = [];
          groups[g].push(item);
        });
        
        const sortedItems: OfficialReportItemRow[] = [];
        Object.keys(groups).forEach(g => {
          sortedItems.push(...sortItemsNaturally(groups[g]));
        });

        await sendInspectionToGas(apiUrl, {
          type: selectedCategory,
          sheet: selectedCategory === 'bag' ? 'กระเป๋า Emergency' : selectedCategory === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถ Emergency',
          sheetName: uniqueSheet,
          title: mainDocHeading,
          date: displayDate,
          who: displayInspector || currentUser?.name || 'ผู้ดูแลระบบ',
          user: currentUser?.username || 'user',
          rows: sortedItems.map((item, idx) => ({
            name: `${idx + 1}. ${sanitizeItemName(item.name)}`,
            qty: String(item.qty || '1'),
            exp: item.exp || item.date || '-',
            group: item.group || '-',
            val: item.val || (item.res && item.res.includes('ใช้งานได้') ? '✓' : '-'),
            res: item.res,
            weekVals: item.weekVals || weekItemValues[item.name] || {},
          })),
        });
      } else {
        const roomNameMatch = (mainDocHeading + ' ' + (activeItems[0]?.location || '')).match(/OR\s*\d|PACU|Sterile|MINOR\s*\d/i);
        const locCode = roomNameMatch ? roomNameMatch[0].replace(/\s+/g, '').toUpperCase() : 'ทุกห้อง';
        const uniqueSheet = `ครุภัณฑ์_${locCode}_${dateFormatted}`;
        
        // Natural Sort for Equipment
        const sortedEq = sortItemsNaturally(activeItems);

        await sendInspectionToGas(apiUrl, {
          type: 'equipment',
          sheet: 'ครุภัณฑ์',
          sheetName: uniqueSheet,
          title: mainDocHeading,
          location: locCode,
          date: displayDate,
          who: displayInspector || currentUser?.name || 'ผู้ดูแลระบบ',
          user: currentUser?.username || 'user',
          tax: '7',
          startNo: 1,
          rows: sortedEq.map((item, idx) => ({
            no: String(idx + 1),
            code: item.code || '-',
            sap: item.sap || '-',
            name: sanitizeItemName(item.name),
            spec: item.spec || '-',
            source: item.source || '-',
            date: item.date || '-',
            qty: String(item.qty || '1'),
            tax: String(item.tax || '7'),
            price: String(item.price || '-'),
            location: item.location || locCode,
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

  // Mouse Drag-to-Scroll (Pan) handlers for desktop A4 paper
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Primary left click only
    const target = e.target as HTMLElement | null;
    if (target && target.closest('input, button, select, textarea, a, [role="button"], label')) {
      return;
    }
    if (!scrollContainerRef.current) return;
    setIsMouseDragging(true);
    dragStartRef.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };
  };

  useEffect(() => {
    if (!isMouseDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      e.preventDefault();
      const dx = e.pageX - dragStartRef.current.x;
      const dy = e.pageY - dragStartRef.current.y;
      scrollContainerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
      scrollContainerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const handleWindowMouseUp = () => {
      setIsMouseDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isMouseDragging]);

  return (
    <div
      className="official-report-modal-backdrop fixed inset-0 z-50 w-screen h-dvh overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="official-report-modal-card w-screen h-dvh flex flex-col overflow-hidden relative bg-slate-100 dark:bg-slate-950"
        style={{
          width: '100vw',
          maxWidth: '100vw',
          height: '100dvh',
          maxHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '0px',
          position: 'relative',
          margin: 0,
        }}
      >
        {/* Minimalist Top Bar (<= 56px height): Category Switcher + Settings Trigger + Close */}
        <header
          className="official-report-modal-header h-14 max-h-[56px] shrink-0 px-2.5 sm:px-4 bg-white dark:bg-[#181A20] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 z-30"
          style={{
            height: '54px',
            maxHeight: '56px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 min-w-0">
            {[
              { id: 'eq', label: 'ครุภัณฑ์', emoji: '🏫', count: eqItems.length || items.length },
              { id: 'bag', label: 'กระเป๋าฉุกเฉิน', emoji: '🎒', count: bagItems.length },
              { id: 'cart', label: 'รถฉุกเฉิน', emoji: '🛒', count: cartItems.length },
              { id: 'ambulance', label: 'รถพยาบาล', emoji: '🚑', count: ambulanceItems.length },
              { id: 'drug', label: 'คลังยา & สารน้ำ', emoji: '💊', count: resolvedDrugs.length },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id as any);
                  setSelectedRoundId('current');
                  setShowRoundDropdown(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-colors cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                    selectedCategory === cat.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen((prev) => !prev);
                setShowRoundDropdown(false);
              }}
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer active:scale-95 ${
                isSettingsOpen
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="ตั้งค่า / ข้อมูลผู้ตรวจ / เลือกรอบตรวจ"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ตั้งค่า / ผู้ตรวจ</span>
              {(selectedRoundId !== 'current' || isBlankForm) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors cursor-pointer active:scale-95"
              title="ปิดพรีวิว"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* Feedback Toast (Non-blocking overlay below top bar) */}
        {feedback && (
          <div
            className={`absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] sm:max-w-lg px-4 py-2 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-3 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <span className="truncate">{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-extrabold underline shrink-0 cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Collapsible Settings Drawer / Popover (Hidden by default to keep 100% reading focus) */}
        {isSettingsOpen && (
          <div
            className="fixed inset-0 z-40 flex items-end sm:items-start sm:justify-end bg-black/40 p-0 sm:pt-16 sm:pr-4"
            onClick={() => {
              setIsSettingsOpen(false);
              setShowRoundDropdown(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-[440px] max-h-[82dvh] overflow-y-auto bg-white dark:bg-[#1E2028] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 sm:p-5 space-y-4 animate-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200"
              style={{
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    ตั้งค่าเอกสาร &amp; ข้อมูลผู้ตรวจ
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setShowRoundDropdown(false);
                  }}
                  className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer active:scale-95"
                >
                  เสร็จสิ้น
                </button>
              </div>

              {/* 1. เลือกรอบตรวจ (Round Selector + History) */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  รอบบันทึกการตรวจ
                </p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRoundDropdown(!showRoundDropdown)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 text-xs font-bold transition-all hover:bg-emerald-100/80 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="truncate">
                        {selectedRoundId === 'current'
                          ? '🟢 รอบปัจจุบัน (Live Draft)'
                          : `📅 ${selectedRecord?.timestamp || selectedRecord?.date || selectedRoundId} (${selectedRecord?.who || 'ผู้ตรวจ'})`}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-emerald-600 transition-transform shrink-0 ${showRoundDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showRoundDropdown && (
                    <div className="mt-2 w-full bg-white dark:bg-[#16181E] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1 max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoundId('current');
                          setShowRoundDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          selectedRoundId === 'current'
                            ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>รอบปัจจุบัน (Live Draft)</span>
                        </span>
                        {selectedRoundId === 'current' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>

                      <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                      <div className="flex items-center justify-between px-3 py-1 gap-2">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          ประวัติบันทึก ({filteredHistoryRecords.length})
                        </p>
                        {filteredHistoryRecords.length > 0 && onDeleteAllHistoryRecords && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteAllCategory(selectedCategory);
                              setShowRoundDropdown(false);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="ลบประวัติทั้งหมดในหมวดนี้"
                          >
                            <Trash2 size={11} />
                            <span>ลบทั้งหมด</span>
                          </button>
                        )}
                      </div>

                      {filteredHistoryRecords && filteredHistoryRecords.length > 0 ? (
                        filteredHistoryRecords.map((record) => (
                          <div
                            key={record.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                              selectedRoundId === record.id
                                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRoundId(record.id);
                                setShowRoundDropdown(false);
                              }}
                              className="flex-1 text-left font-semibold truncate pr-3 cursor-pointer py-0.5"
                            >
                              📅 {record.timestamp || record.date}
                              <div className="text-[10px] opacity-60 font-medium">ตรวจโดย: {record.who || 'ไม่ระบุชื่อ'}</div>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordToDelete(record);
                                setShowRoundDropdown(false);
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0 cursor-pointer"
                              title="ลบประวัติตรวจนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="px-3 py-2.5 text-xs text-slate-400 italic text-center">ยังไม่มีประวัติในหมวดนี้</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. ข้อมูลผู้ตรวจ และตำแหน่ง */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ชื่อผู้ตรวจ:</span>
                  <input
                    type="text"
                    value={inspectorNameInput}
                    onChange={(e) => handleInspectorNameChange(e.target.value)}
                    placeholder="ชื่อ-นามสกุลผู้ตรวจ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ตำแหน่ง:</span>
                  <input
                    type="text"
                    value={inspectorPosInput}
                    onChange={(e) => handleInspectorPosChange(e.target.value)}
                    placeholder="เช่น พยาบาลวิสัญญี / วิสัญญีแพทย์"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              {/* 3. ตัวเลือกเพิ่มเติม: มุมมองกระดาษ / แบบฟอร์มเปล่า / ลบประวัติ */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleToggleFitToScreen}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                    isFitToScreen
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Scaling className="w-3.5 h-3.5" />
                  <span>{isFitToScreen ? 'พอดีความกว้างจอ' : 'ขนาดจริง 100%'}</span>
                </button>

                {(selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance') && (
                  <button
                    type="button"
                    onClick={() => setIsBlankForm(!isBlankForm)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                      isBlankForm
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{isBlankForm ? '☑ แบบฟอร์มเปล่า' : '☐ แสดงฟอร์มเปล่า'}</span>
                  </button>
                )}

                {selectedRoundId !== 'current' && selectedRecord && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setRecordToDelete(selectedRecord);
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>ลบประวัตินี้</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full-Height Smooth Document Viewer Area */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          className="paper-viewport-area paper-scroll-viewport report-viewport-area w-full flex-1 bg-slate-200/80 dark:bg-slate-950 p-2 sm:p-4"
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isFitToScreen ? 'center' : 'flex-start',
            justifyContent: 'flex-start',
            boxSizing: 'border-box',
            paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            touchAction: 'pan-x pan-y pinch-zoom',
            cursor: isFitToScreen ? 'default' : (isMouseDragging ? 'grabbing' : 'grab'),
            userSelect: isMouseDragging ? 'none' : 'auto',
          }}
        >
          {/* Normal-Flow A4 Paper Holder (Uses CSS zoom instead of transform:scale + position:absolute to eliminate mobile white cutouts and scroll lag) */}
          <div
            className="a4-paper-holder w-full"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: isFitToScreen ? 'center' : 'flex-start',
              alignItems: 'flex-start',
              position: 'relative',
              boxSizing: 'border-box',
              overflow: 'visible',
              flexShrink: 0,
            }}
          >
            <div
              id="printable-report"
              ref={sheetRef}
              className="a4-paper-sheet a4-paper-wrapper bg-white text-gray-900 rounded-xl space-y-6"
              style={{
                width: isFitToScreen && scaleFactor >= 1 ? '100%' : '1120px',
                minWidth: isFitToScreen && scaleFactor >= 1 ? '100%' : '1120px',
                maxWidth: isFitToScreen && scaleFactor >= 1 ? '100%' : 'none',
                zoom: isFitToScreen && scaleFactor < 1 ? scaleFactor : 1,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                borderRadius: '12px',
                boxSizing: 'border-box',
                padding: '20px',
                position: 'relative',
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
              ) : selectedCategory === 'bag' || selectedCategory === 'cart' || selectedCategory === 'ambulance' ? (
                <EmergencyChecklistReportPreview
                  type={selectedCategory}
                  items={activeItems}
                  date={displayDate}
                  inspector={displayInspector}
                  signature={userSignature}
                  agencyName={cleanClinicName}
                  weekItemValues={memoizedWeekItemValues}
                  weekDates={selectedRecord ? selectedRecord.weekDates : weekDates}
                  activeWeek={activeWeek}
                  currentUser={resolvedPreviewUser}
                  isBlankForm={isBlankForm}
                />
              ) : (
                <EquipmentReportPreview
                  items={activeItems}
                  date={displayDate}
                  inspector={displayInspector}
                  signature={userSignature}
                  clinicName={cleanClinicName}
                  mainDocHeading={mainDocHeading}
                  currentUser={resolvedPreviewUser}
                />
              )}
            </div>
          </div>
        </div>

        {/* Floating Bottom Action Bar (Fixed Bottom: Scale Toggle + Send Sheets + Print PDF) */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center px-3"
          style={{
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl bg-white/95 dark:bg-[#181A20]/95 border border-slate-200 dark:border-slate-700 shadow-xl max-w-full">
            <button
              type="button"
              onClick={handleToggleFitToScreen}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                isFitToScreen
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  : 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
              }`}
              title={isFitToScreen ? 'สลับเป็นขนาดจริง 100% (เลื่อนดูซ้าย-ขวาได้)' : 'สลับเป็นพอดีความกว้างจอ'}
            >
              {isFitToScreen ? <Maximize2 className="w-4 h-4 shrink-0" /> : <Minimize2 className="w-4 h-4 shrink-0" />}
              <span>{isFitToScreen ? 'ขนาด 100%' : 'พอดีจอ'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendReportToGas}
              disabled={isExportingGas}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isExportingGas ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <FileSpreadsheet className="w-4 h-4 shrink-0" />}
              <span>ส่ง Sheets</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={isPrinting}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isPrinting ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <Printer className="w-4 h-4 shrink-0" />}
              <span>พิมพ์ PDF</span>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {recordToDelete && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/65 animate-in fade-in">
            <div className="bg-white dark:bg-[#1E2028] rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">ยืนยันการลบประวัติ?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
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

        {/* Delete All History Confirmation Modal */}
        {confirmDeleteAllCategory && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/65 animate-in fade-in">
            <div className="bg-white dark:bg-[#1E2028] rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                ยืนยันลบประวัติทั้งหมด?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                ประวัติการตรวจทั้งหมดในหมวดนี้ ({filteredHistoryRecords.length} รายการ) จะถูกลบออกจากระบบถาวร ไม่สามารถกู้คืนได้
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingAllHistory}
                  onClick={() => setConfirmDeleteAllCategory(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingAllHistory}
                  onClick={handleConfirmDeleteAllCategoryHistory}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
                >
                  {isDeletingAllHistory ? 'กำลังลบ...' : 'ยืนยันลบทั้งหมด'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .official-report-modal-backdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 50 !important;
          width: 100vw !important;
          height: 100dvh !important;
          overflow: hidden !important;
        }

        .official-report-modal-card {
          display: flex !important;
          flex-direction: column !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: 100vw !important;
          max-height: 100dvh !important;
          margin: 0 !important;
          overflow: hidden !important;
          border-radius: 0 !important;
        }

        .paper-viewport-area {
          flex: 1 !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          overscroll-behavior: contain !important;
        }

        .a4-print-container {
          max-width: 100% !important;
        }

        @media print {
          .no-print, button, select, header, footer { display: none !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};
