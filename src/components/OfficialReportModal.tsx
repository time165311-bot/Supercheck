import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Map,
  MapPin,
  Printer,
  RefreshCw,
  Square,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionHistoryRecord, User } from '../types';
import { sendInspectionToGas } from '../services/api';
import { ROOMS, CORRIDORS, CORRIDOR_LABELS } from '../constants/initialData';

export interface OfficialReportItemRow {
  no?: string;
  code?: string;
  sap?: string;
  name: string;
  spec?: string;
  source?: string;
  date?: string;
  qty?: string;
  tax?: string;
  price?: string;
  location?: string;
  res: string; // 'ใช้งานได้' | 'ใช้งานไม่ได้' | 'ไม่พบรายการ'
  note?: string;
}

interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'eq' | 'bag' | 'cart';
  title?: string;
  date?: string;
  inspector?: string;
  items?: OfficialReportItemRow[];
  eqItems?: OfficialReportItemRow[];
  bagItems?: OfficialReportItemRow[];
  cartItems?: OfficialReportItemRow[];
  sheetUrl?: string;
  apiUrl?: string;
  historyRecords?: InspectionHistoryRecord[];
  currentUser?: User | null;
  onDeleteHistoryRecord?: (recordId: string) => void;
}

export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'eq',
  title: initialTitle = 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)',
  date: initialDate = new Date().toISOString().split('T')[0],
  inspector: initialInspector = '',
  items: defaultItems = [],
  eqItems = [],
  bagItems = [],
  cartItems = [],
  sheetUrl,
  apiUrl = '',
  historyRecords = [],
  currentUser,
  onDeleteHistoryRecord,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'eq' | 'bag' | 'cart'>(initialCategory);
  const [filterProblemOnly, setFilterProblemOnly] = useState(false);
  
  // Round selection states
  const [selectedRoundId, setSelectedRoundId] = useState<string>('current');
  const [pendingRoundId, setPendingRoundId] = useState<string>('current');
  const [showRoundPickerModal, setShowRoundPickerModal] = useState<boolean>(false);
  const [isRoundDropdownOpen, setIsRoundDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [roundToDelete, setRoundToDelete] = useState<{ id: string; title: string; date: string } | null>(null);

  // Download Floorplan and multi-round export modal states
  const [showDownloadPlanModal, setShowDownloadPlanModal] = useState<boolean>(false);
  const [selectedRoundsToExport, setSelectedRoundsToExport] = useState<string[]>(['current']);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Mobile zoom
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory(initialCategory);
      setSelectedRoundId('current');
      setPendingRoundId('current');
      setSyncMsg('');
      setIsRoundDropdownOpen(false);
      setRoundToDelete(null);
      setShowDownloadPlanModal(false);
      setSelectedRoundsToExport(['current']);
    }
  }, [isOpen, initialCategory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoundDropdownOpen(false);
      }
    };
    if (isRoundDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRoundDropdownOpen]);

  const getDataForCategory = (cat: 'eq' | 'bag' | 'cart') => {
    if (cat === 'eq') {
      return {
        title: 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)',
        items: eqItems.length > 0 ? eqItems : defaultItems,
        date: initialDate,
        inspector: initialInspector,
      };
    } else if (cat === 'bag') {
      return {
        title: 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency',
        items: bagItems.length > 0 ? bagItems : defaultItems,
        date: initialDate,
        inspector: initialInspector,
      };
    } else {
      return {
        title: 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency',
        items: cartItems.length > 0 ? cartItems : defaultItems,
        date: initialDate,
        inspector: initialInspector,
      };
    }
  };

  const categoryHistoryRecords = historyRecords.filter((h) => h.type === selectedCategory);

  // Determine active title, date, inspector, items based on selectedRoundId
  let curTitle = '';
  let curDate = initialDate;
  let curInspector = initialInspector;
  let curItems: OfficialReportItemRow[] = [];

  if (selectedRoundId === 'current') {
    const live = getDataForCategory(selectedCategory);
    curTitle = live.title;
    curDate = live.date;
    curInspector = live.inspector;
    curItems = live.items;
  } else {
    const match = historyRecords.find((h) => h.id === selectedRoundId);
    if (match) {
      curTitle = match.title;
      curDate = match.date;
      curInspector = match.who;
      curItems = match.rows as OfficialReportItemRow[];
    } else {
      const live = getDataForCategory(selectedCategory);
      curTitle = live.title;
      curDate = live.date;
      curInspector = live.inspector;
      curItems = live.items;
    }
  }

  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '';
    const m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dStr;
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const day = parseInt(m[3], 10);
    const month = months[parseInt(m[2], 10) - 1];
    const year = parseInt(m[1], 10) + 543;
    return `${day} ${month} ${year}`;
  };

  const thaiDate = formatThaiDate(curDate);
  const isPendingDifferent = pendingRoundId !== selectedRoundId;

  const handleConfirmRoundSelection = () => {
    setSelectedRoundId(pendingRoundId);
    setShowRoundPickerModal(false);
  };

  // Send to Google Sheets (GAS)
  const handleSyncToGoogleSheet = async () => {
    if (!apiUrl || !apiUrl.trim()) {
      setSyncMsg('กรุณาตั้งค่า Google Apps Script URL ในตั้งค่าก่อน');
      setTimeout(() => setSyncMsg(''), 4000);
      return;
    }

    setIsSyncing(true);
    setSyncMsg('กำลังส่งข้อมูลไปยัง Google Sheets...');
    try {
      const sheetBaseName =
        selectedCategory === 'bag'
          ? 'กระเป๋า Emergency'
          : selectedCategory === 'cart'
          ? 'รถ Emergency'
          : 'ครุภัณฑ์';

      const res = await sendInspectionToGas(apiUrl, {
        type: selectedCategory,
        sheet: sheetBaseName,
        title: curTitle,
        date: curDate,
        who: curInspector || 'ผู้ตรวจสอบ',
        user: currentUser?.username || 'anonymous',
        rows: curItems.map((r, i) => ({
          no: r.no || String(i + 1),
          code: r.code || '-',
          sap: r.sap || '-',
          name: r.name,
          spec: r.spec || '-',
          source: r.source || '-',
          date: r.date || '-',
          qty: r.qty || '1',
          tax: r.tax || '7',
          price: r.price || '-',
          location: r.location || '-',
          res: r.res,
          note: r.note || '',
        })),
      });

      if (res.success) {
        setSyncMsg('✓ ส่งข้อมูลไปยัง Google Sheets สำเร็จแล้ว');
      } else {
        setSyncMsg('⚠️ ส่งข้อมูลไม่สำเร็จ (ตรวจสอบ Web App URL)');
      }
    } catch (err) {
      setSyncMsg('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  // Helper to trigger browser file download
  const triggerBlobDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // High-Fidelity Excel XML Generator matching Google Sheets A4 form 100%
  const generateExcelXml = (
    sheetTitle: string,
    docTitle: string,
    dateStr: string,
    inspectorStr: string,
    categoryName: string,
    itemsToExport: OfficialReportItemRow[]
  ) => {
    const formattedDate = formatThaiDate(dateStr) || dateStr;

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${sheetTitle.replace(/[\/\\?*:[\]]/g, '_').slice(0, 31)}</x:Name>
                  <x:WorksheetOptions>
                    <x:FitToPage/>
                    <x:Print>
                      <x:FitWidth>1</x:FitWidth>
                      <x:FitHeight>0</x:FitHeight>
                      <x:ValidPrinterInfo/>
                      <x:PaperSizeIndex>9</x:PaperSizeIndex>
                      <x:Scale>78</x:Scale>
                    </x:Print>
                    <x:PageSetup>
                      <x:Layout x:Orientation="Landscape"/>
                      <x:Header x:Margin="0.1"/>
                      <x:Footer x:Margin="0.1"/>
                      <x:PageMargins x:Bottom="0.15" x:Left="0.1" x:Right="0.1" x:Top="0.15"/>
                    </x:PageSetup>
                    <x:Selected/>
                    <x:DoNotDisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            @page {
              size: 297mm 210mm;
              margin: 5mm 4mm 5mm 4mm;
              mso-page-orientation: landscape;
            }
            body {
              font-family: 'Sarabun', 'TH Sarabun New', 'Prompt', sans-serif;
              color: #000000;
              margin: 0;
              padding: 10px;
              background: #ffffff;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #000000;
              padding: 4px;
              font-size: 9pt;
              text-align: center;
              vertical-align: middle;
            }
            th {
              background-color: #f1f5f9;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; font-size: 15pt; font-weight: bold; margin-bottom: 2px;">
            ทะเบียนรายการครุภัณฑ์และอุปกรณ์ (${categoryName})
          </div>
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 8px;">
            ณ วันที่ ${formattedDate}
          </div>

          <table style="width: 100%; border: none; margin-bottom: 8px;">
            <tr style="border: none;">
              <td style="border: none; text-align: left; font-size: 9.5pt; font-weight: bold; width: 50%;">
                ${docTitle}<br/>
                หัวหน้าภาควิชา/หน่วยงาน ............................................
              </td>
              <td style="border: none; text-align: right; font-size: 9.5pt; font-weight: bold; width: 50%;">
                วัน, เดือน, ปี ที่สำรวจ ${formattedDate}<br/>
                กรรมการผู้ตรวจ ${inspectorStr || 'ผู้ดูแลระบบ'}
              </td>
            </tr>
          </table>

          <table>
            <thead>
              <tr style="background-color: #f1f5f9; font-weight: bold;">
                <th rowspan="2" style="width: 35px;">ลำดับที่</th>
                <th rowspan="2" style="width: 110px;">หมายเลขพัสดุ</th>
                <th rowspan="2" style="width: 90px;">รหัสสินทรัพย์ SAP</th>
                <th rowspan="2" style="width: 170px;">รายการ</th>
                <th rowspan="2" style="width: 140px;">มาตรฐานและคุณลักษณะเฉพาะ</th>
                <th rowspan="2" style="width: 100px;">แหล่งเงินที่มา (ประเภทเงินงบประมาณ)</th>
                <th rowspan="2" style="width: 80px;">ว/ด/ป ที่ได้มา</th>
                <th rowspan="2" style="width: 45px;">จำนวนตามบัญชี</th>
                <th rowspan="2" style="width: 45px;">อัตราภาษี (%)</th>
                <th rowspan="2" style="width: 75px;">ราคา (รวมภาษี)</th>
                <th rowspan="2" style="width: 110px;">สถานที่ตั้ง ตึก / ชั้น / ห้อง</th>
                <th colspan="2" style="width: 90px;">ผลการตรวจสอบพัสดุ</th>
                <th rowspan="2" style="width: 55px;">ไม่พบรายการ</th>
              </tr>
              <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 8.5pt;">
                <th style="width: 45px;">พบรายการ ใช้งานได้</th>
                <th style="width: 45px;">ใช้งานไม่ได้</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToExport
                .map((row, idx) => {
                  const isOk = (row.res || '').includes('ใช้งานได้');
                  const isBad = (row.res || '').includes('ไม่ได้');
                  const isMiss = (row.res || '').includes('ไม่พบ');
                  return `
                    <tr>
                      <td style="text-align: center;">${idx + 1}</td>
                      <td style="text-align: center; mso-number-format:'\\@';">${row.code || '-'}</td>
                      <td style="text-align: center; mso-number-format:'\\@';">${row.sap || '-'}</td>
                      <td style="text-align: left;">${row.name || '-'}</td>
                      <td style="text-align: left;">${row.spec || '-'}</td>
                      <td style="text-align: center;">${row.source || '-'}</td>
                      <td style="text-align: center;">${row.date || '-'}</td>
                      <td style="text-align: center;">${row.qty || '1'}</td>
                      <td style="text-align: center;">${row.tax || '7'}</td>
                      <td style="text-align: center;">${row.price || '-'}</td>
                      <td style="text-align: center;">${row.location || '-'}${row.note ? ` (${row.note})` : ''}</td>
                      <td style="text-align: center; color: #15803d; font-weight: bold; font-size: 11pt;">${isOk ? '✓' : ''}</td>
                      <td style="text-align: center; color: #b91c1c; font-weight: bold; font-size: 11pt;">${isBad ? '✓' : ''}</td>
                      <td style="text-align: center; color: #d97706; font-weight: bold; font-size: 11pt;">${isMiss ? '✓' : ''}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>

          <div style="margin-top: 25px; padding-top: 15px;">
            <table style="width: 100%; border: none;">
              <tr style="border: none;">
                <td style="border: none; width: 50%; text-align: center; font-size: 9.5pt; vertical-align: top;">
                  ลงชื่อ .................................................... ผู้ตรวจสอบ<br/><br/>
                  ( ${inspectorStr || '....................................................'} )
                </td>
                <td style="border: none; width: 50%; text-align: center; font-size: 9.5pt; vertical-align: top;">
                  ลงชื่อ .................................................... หัวหน้างาน<br/><br/>
                  ( .................................................... )
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  // Direct Excel Download of Current View using SheetJS
  const handleDownloadExcel = () => {
    const itemsToExport = filterProblemOnly
      ? curItems.filter((it) => it.res && it.res !== 'ใช้งานได้')
      : curItems;

    // Create a worksheet
    const worksheetData = [
      ['ทะเบียนรายการครุภัณฑ์และอุปกรณ์'],
      ['ณ วันที่ ' + thaiDate],
      [], // Empty row
      ['ลำดับที่', 'หมายเลขพัสดุ', 'รหัสสินทรัพย์ SAP', 'รายการ', 'มาตรฐานและคุณลักษณะเฉพาะ', 'แหล่งเงินที่มา', 'ว/ด/ป ที่ได้มา', 'จำนวนตามบัญชี', 'อัตราภาษี (%)', 'ราคา (รวมภาษี)', 'สถานที่ตั้ง', 'พบรายการ ใช้งานได้', 'ใช้งานไม่ได้', 'ไม่พบรายการ'],
      ...itemsToExport.map((row, idx) => [
        idx + 1,
        row.code || '-',
        row.sap || '-',
        row.name || '-',
        row.spec || '-',
        row.source || '-',
        row.date || '-',
        row.qty || '1',
        row.tax || '7',
        row.price || '-',
        (row.location || '-') + (row.note ? ` (${row.note})` : ''),
        row.res.includes('ใช้งานได้') ? '✓' : '',
        row.res.includes('ไม่ได้') ? '✓' : '',
        row.res.includes('ไม่พบ') ? '✓' : ''
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Basic styling/column width estimation is hard with pure SheetJS
    // but at least it creates a real .xlsx file.
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    
    const catName = selectedCategory === 'eq' ? 'ครุภัณฑ์' : selectedCategory === 'bag' ? 'กระเป๋า' : 'รถ';
    const safeTitle = curTitle.replace(/[\/\s()]/g, '_');
    
    XLSX.writeFile(workbook, `รายงาน_${catName}_${safeTitle}_${curDate}.xlsx`);
  };

  // Download True A4 Landscape PDF using jsPDF + autoTable
  const handleDownloadPdf = () => {
    // 0.25 inch margin is 6.35 mm
    const margin = 6.35;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ทะเบียนรายการครุภัณฑ์และอุปกรณ์', 148, 12, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`ณ วันที่ ${thaiDate || '-'}`, 148, 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)', 14, 24);
    doc.text(`วัน, เดือน, ปี ที่สำรวจ ${thaiDate || '-'}`, 283, 24, { align: 'right' });

    doc.text('หัวหน้าภาควิชา/หน่วยงาน ....................................', 14, 30);
    doc.text(`กรรมการผู้ตรวจ ${curInspector || 'ผู้ดูแลระบบ'}`, 283, 30, { align: 'right' });

    const itemsToExport = filterProblemOnly
      ? curItems.filter((it) => it.res && it.res !== 'ใช้งานได้')
      : curItems;

    const tableData = itemsToExport.map((row, idx) => {
      const isOk = row.res.includes('ใช้งานได้') ? 'X' : '';
      const isBad = row.res.includes('ไม่ได้') ? 'X' : '';
      const isMiss = row.res.includes('ไม่พบ') ? 'X' : '';
      return [
        idx + 1,
        row.code || '-',
        row.sap || '-',
        row.name || '-',
        row.spec || '-',
        row.source || '-',
        row.date || '-',
        row.qty || '1',
        row.tax || '7',
        row.price || '-',
        row.location || '-',
        isOk,
        isBad,
        isMiss,
      ];
    });

    (doc as any).autoTable({
      startY: 35,
      margin: { top: margin, bottom: margin, left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontSize: 7, halign: 'center' },
      bodyStyles: { fontSize: 6, halign: 'center' },
      head: [
        [
          { content: 'ลำดับที่', rowSpan: 2 },
          { content: 'หมายเลขพัสดุ', rowSpan: 2 },
          { content: 'รหัสสินทรัพย์ SAP', rowSpan: 2 },
          { content: 'รายการ', rowSpan: 2 },
          { content: 'มาตรฐานและคุณลักษณะเฉพาะ', rowSpan: 2 },
          { content: 'แหล่งเงินที่มา', rowSpan: 2 },
          { content: 'ว/ด/ป ที่ได้มา', rowSpan: 2 },
          { content: 'จำนวนตามบัญชี', rowSpan: 2 },
          { content: 'อัตราภาษี (%)', rowSpan: 2 },
          { content: 'ราคา (รวมภาษี)', rowSpan: 2 },
          { content: 'สถานที่ตั้ง ตึก/ชั้น/ห้อง', rowSpan: 2 },
          { content: 'ผลการตรวจสอบพัสดุ', colSpan: 3 },
        ],
        [
          'ใช้งานได้',
          'ใช้งานไม่ได้',
          'ไม่พบรายการ',
        ],
      ],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 1.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'left', cellWidth: 36 },
        4: { halign: 'left', cellWidth: 40 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'center', cellWidth: 12 },
        8: { halign: 'center', cellWidth: 12 },
        9: { halign: 'right', cellWidth: 18 },
        10: { halign: 'center', cellWidth: 26 },
        11: { halign: 'center', cellWidth: 14 },
        12: { halign: 'center', cellWidth: 14 },
        13: { halign: 'center', cellWidth: 14 },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(9);
    doc.text(`ลงชื่อ .................................................... ผู้ตรวจสอบ\n( ${curInspector || 'ผู้ดูแลระบบ'} )`, 70, finalY + 12, { align: 'center' });
    doc.text(`ลงชื่อ .................................................... หัวหน้างาน\n( .................................................... )`, 220, finalY + 12, { align: 'center' });

    doc.save(`รายงานทะเบียนครุภัณฑ์_${curDate}.pdf`);
  };

  // Export Separated by Category for Selected Rounds
  const handleExportSeparatedCategories = () => {
    // Gather rounds to export
    const roundsToProcess: Array<{ id: string; date: string; title: string; who: string; type: string; rows: OfficialReportItemRow[] }> = [];

    if (selectedRoundsToExport.includes('current')) {
      const live = getDataForCategory(selectedCategory);
      roundsToProcess.push({
        id: 'current',
        date: live.date,
        title: live.title,
        who: live.inspector,
        type: selectedCategory,
        rows: live.items,
      });
    }

    selectedRoundsToExport.forEach((rId) => {
      if (rId === 'current') return;
      const match = historyRecords.find((h) => h.id === rId);
      if (match) {
        roundsToProcess.push({
          id: match.id,
          date: match.date,
          title: match.title,
          who: match.who,
          type: match.type,
          rows: match.rows as OfficialReportItemRow[],
        });
      }
    });

    if (roundsToProcess.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 รอบการตรวจ');
      return;
    }

    // Export each category: ครุภัณฑ์, กระเป๋า, รถ
    const categories: Array<{ key: 'eq' | 'bag' | 'cart'; label: string }> = [
      { key: 'eq', label: 'ครุภัณฑ์' },
      { key: 'bag', label: 'กระเป๋า' },
      { key: 'cart', label: 'รถ' },
    ];

    categories.forEach((cat) => {
      // Find matching items from selected rounds
      let combinedRows: OfficialReportItemRow[] = [];
      let roundDate = curDate;
      let roundWho = curInspector;

      roundsToProcess.forEach((rnd) => {
        if (rnd.type === cat.key || rnd.type === 'eq') {
          roundDate = rnd.date;
          roundWho = rnd.who || roundWho;
          combinedRows = [...combinedRows, ...rnd.rows];
        }
      });

      // If no history items found for category, use live items
      if (combinedRows.length === 0) {
        const live = getDataForCategory(cat.key);
        combinedRows = live.items;
        roundDate = live.date;
        roundWho = live.inspector;
      }

      if (combinedRows.length > 0) {
        const xml = generateExcelXml(
          `รายงาน_${cat.label}`,
          `คลินิกงานบริการผู้ป่วยในวิสัญญี - ${cat.label}`,
          roundDate,
          roundWho,
          cat.label,
          combinedRows
        );
        triggerBlobDownload(xml, `แผนผังและรายงาน_${cat.label}_${roundDate}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      }
    });

    setShowDownloadPlanModal(false);
  };

  // Reliable cross-platform print matching preview 100%
  const handlePrint = () => {
    // Reset zoom temporarily during print so scale doesn't clip
    const prevZoom = zoomLevel;
    setZoomLevel(100);
    setTimeout(() => {
      window.print();
      setZoomLevel(prevZoom);
    }, 120);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, curItems, filterProblemOnly, curInspector]);

  if (!isOpen) return null;

  const problemCount = curItems.filter((it) => it.res && it.res !== 'ใช้งานได้').length;
  const displayedItems = filterProblemOnly
    ? curItems.filter((it) => it.res && it.res !== 'ใช้งานได้')
    : curItems;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs select-none official-report-modal-overlay">
      <div className="bg-white dark:bg-black rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden relative official-report-modal-container">
        {/* Unified Single-Row Compact Header & Control Bar */}
        <div className="no-print px-4 py-2.5 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0 flex-wrap text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Category Tabs */}
            <div className="flex items-center bg-neutral-200/80 dark:bg-neutral-800 p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('eq');
                  setSelectedRoundId('current');
                  setPendingRoundId('current');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  selectedCategory === 'eq'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <span className="sm:inline hidden">🏥</span>
                <span>ครุภัณฑ์</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('bag');
                  setSelectedRoundId('current');
                  setPendingRoundId('current');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  selectedCategory === 'bag'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <span className="sm:inline hidden">💼</span>
                <span>กระเป๋า</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('cart');
                  setSelectedRoundId('current');
                  setPendingRoundId('current');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  selectedCategory === 'cart'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <span className="sm:inline hidden">🛒</span>
                <span>รถ</span>
              </button>
            </div>

            {/* Round Selector Dropdown (Max ~7 items visible, scrollable with mouse wheel) */}
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-500 font-medium hidden sm:inline">รอบ:</span>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsRoundDropdownOpen(!isRoundDropdownOpen)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium focus:outline-none cursor-pointer flex items-center justify-between gap-1.5 min-w-[170px] max-w-[260px] truncate shadow-2xs"
                  title="คลิกเพื่อเลือกรอบตรวจที่ต้องการดู"
                >
                  <span className="truncate">
                    {selectedRoundId === 'current'
                      ? `รอบล่าสุด (${initialDate})`
                      : (() => {
                          const rec = categoryHistoryRecords.find((h) => h.id === selectedRoundId);
                          return rec ? `${rec.date} - ${rec.title}` : 'เลือกรอบตรวจ';
                        })()}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-neutral-400 transition-transform duration-150 ${isRoundDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRoundDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-72 sm:w-80 max-h-[225px] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5">
                    {/* Option 1: Current Round */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundId('current');
                        setPendingRoundId('current');
                        setIsRoundDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        selectedRoundId === 'current'
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <div className="truncate flex items-center gap-1.5">
                        <span className="text-emerald-500 font-bold">●</span>
                        <span className="font-semibold">รอบล่าสุด (ปัจจุบัน)</span>
                        <span className="text-[11px] text-neutral-500">({initialDate})</span>
                      </div>
                      {selectedRoundId === 'current' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>

                    {/* Past Rounds */}
                    {categoryHistoryRecords.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-neutral-400 text-center">
                        ไม่มีประวัติรอบย้อนหลัง
                      </div>
                    ) : (
                      categoryHistoryRecords.map((h) => {
                        const isSelected = selectedRoundId === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoundId(h.id);
                              setPendingRoundId(h.id);
                              setIsRoundDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">{h.date}</span>
                              <span className="text-neutral-400 mx-1">•</span>
                              <span className="text-neutral-700 dark:text-neutral-300">{h.title}</span>
                              {h.who && (
                                <span className="text-[10px] text-neutral-400 ml-1">[{h.who}]</span>
                              )}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Delete Round Button (admin only, triggers custom confirmation modal) */}
              {selectedRoundId !== 'current' && (!currentUser || currentUser.role === 'admin') && onDeleteHistoryRecord && (
                <button
                  type="button"
                  onClick={() => {
                    const match = categoryHistoryRecords.find((h) => h.id === selectedRoundId);
                    setRoundToDelete({
                      id: selectedRoundId,
                      title: match?.title || 'รอบตรวจที่เลือก',
                      date: match?.date || '',
                    });
                  }}
                  title="ลบข้อมูลรอบตรวจนี้ (เฉพาะแอดมิน)"
                  className="p-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 transition cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterProblemOnly(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  !filterProblemOnly ? 'bg-blue-600 text-white shadow-2xs' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                ทั้งหมด ({curItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterProblemOnly(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterProblemOnly ? 'bg-rose-600 text-white shadow-2xs' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                ผิดปกติ ({problemCount})
              </button>
            </div>

            {/* Changed from "Excel" to "ดาวน์โหลดแผนผัง" as requested */}
            <button
              type="button"
              onClick={() => setShowDownloadPlanModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="ดาวน์โหลดแผนผังและส่งออกรายงาน Excel เลือกรอบตรวจได้"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>ดาวน์โหลดแผนผัง</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ A4</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 10, 20))}
                className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition cursor-pointer"
                title="ย่อขนาด (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold px-1 text-neutral-700 dark:text-neutral-200">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 15, 180))}
                className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition cursor-pointer"
                title="ขยายขนาด (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="ปิดหน้าต่างรายงาน"
          className="no-print absolute top-4 right-4 z-50 p-2 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition cursor-pointer backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {syncMsg && (
          <div className="no-print px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center">
            {syncMsg}
          </div>
        )}

        {/* Report Preview Body (A4 Landscape Form simulation) */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-neutral-200/80 dark:bg-neutral-950">
          <div className="min-w-fit flex justify-center pb-16">
            <div
              id="printable-official-table-doc"
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                transformOrigin: 'top center',
              }}
              className="bg-white text-neutral-900 w-full max-w-[1050px] min-h-[550px] h-auto p-6 sm:p-10 rounded-2xl shadow-2xl border border-neutral-300 font-sans flex flex-col"
            >
              {/* Title & Header matching Google Sheets */}
              <div className="text-center mb-4">
                <h2 className="text-base font-bold text-neutral-900 tracking-wide">ทะเบียนรายการครุภัณฑ์และอุปกรณ์</h2>
                <p className="text-xs font-medium text-neutral-800 mt-0.5">ณ วันที่ {thaiDate || '-'}</p>
              </div>

              {/* Metadata Above Table */}
              <div className="flex justify-between items-start text-xs mb-3 font-medium text-neutral-900">
                <div className="space-y-1">
                  <p>{curTitle}</p>
                  <p>หัวหน้าภาควิชา/หน่วยงาน ............................................</p>
                </div>
                <div className="space-y-1 text-right">
                  <p>วัน, เดือน, ปี ที่สำรวจ {thaiDate || '-'}</p>
                  <p>กรรมการผู้ตรวจ {curInspector || 'ผู้ดูแลระบบ'}</p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-900 font-bold border border-neutral-400 text-center text-[11px]">
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-10">ลำดับที่</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-24">หมายเลขพัสดุ</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-20">รหัสสินทรัพย์ SAP</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 text-left">รายการ</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 text-left w-32">มาตรฐานและคุณลักษณะเฉพาะ</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-20">แหล่งเงินที่มา (ประเภทเงินงบประมาณ)</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-20">ว/ด/ป ที่ได้มา</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-12">จำนวนตามบัญชี</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-12">อัตราภาษี (%)</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-16">ราคา (รวมภาษี)</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-24">สถานที่ตั้ง ตึก / ชั้น / ห้อง</th>
                      <th colSpan={2} className="p-1.5 border border-neutral-400">ผลการตรวจสอบพัสดุ</th>
                      <th rowSpan={2} className="p-1.5 border border-neutral-400 w-14">ไม่พบรายการ</th>
                    </tr>
                    <tr className="bg-neutral-100 text-neutral-900 font-bold border border-neutral-400 text-center text-[10px]">
                      <th className="p-1 border border-neutral-400 w-12">พบรายการ ใช้งานได้</th>
                      <th className="p-1 border border-neutral-400 w-12">ใช้งานไม่ได้</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedItems.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-neutral-500 border border-neutral-400">
                          ไม่มีรายการในรอบนี้
                        </td>
                      </tr>
                    ) : (
                      displayedItems.map((row, idx) => {
                        const isOk = row.res.includes('ใช้งานได้');
                        const isBad = row.res.includes('ไม่ได้');
                        const isMiss = row.res.includes('ไม่พบ');
                        return (
                          <tr key={idx} className="border border-neutral-400 hover:bg-neutral-50 text-xs">
                            <td className="p-1.5 border border-neutral-400 text-center font-medium">{idx + 1}</td>
                            <td className="p-1.5 border border-neutral-400 text-center font-mono text-[11px]">{row.code || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center font-mono text-[11px]">{row.sap || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 font-medium">{row.name || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-neutral-600">{row.spec || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.source || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.date || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.qty || '1'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.tax || '7'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.price || '-'}</td>
                            <td className="p-1.5 border border-neutral-400 text-center">{row.location || '-'}{row.note ? ` (${row.note})` : ''}</td>
                            <td className="p-1.5 border border-neutral-400 text-center text-emerald-700 font-bold text-sm">
                              {isOk ? '✓' : ''}
                            </td>
                            <td className="p-1.5 border border-neutral-400 text-center text-rose-600 font-bold text-sm">
                              {isBad ? '✓' : ''}
                            </td>
                            <td className="p-1.5 border border-neutral-400 text-center text-amber-600 font-bold text-sm">
                              {isMiss ? '✓' : ''}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures Line */}
              <div className="mt-10 pt-6 border-t border-neutral-300 flex justify-between items-center text-xs text-neutral-800">
                <div className="w-1/2 text-center px-4 space-y-1">
                  <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    ( {curInspector || '....................................................'} )
                  </p>
                </div>
                <div className="w-1/2 text-center px-4 space-y-1">
                  <p>ลงชื่อ .................................................... หัวหน้างาน</p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    ( .................................................... )
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Round Picker Card Modal */}
        {showRoundPickerModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>เลือกดูรอบตรวจย้อนหลัง ({selectedCategory === 'eq' ? 'ครุภัณฑ์' : selectedCategory === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency'})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRoundPickerModal(false)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
                {/* Current round option card */}
                <div
                  onClick={() => {
                    setPendingRoundId('current');
                    setShowRoundPickerModal(false);
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    pendingRoundId === 'current'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5 text-sm">
                      <span>🟢</span>
                      <span>รอบล่าสุดที่กำลังตรวจสอบ (ปัจจุบัน)</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      วันที่: {initialDate} | ข้อมูลปัจจุบันแบบเรียลไทม์
                    </div>
                  </div>
                  {pendingRoundId === 'current' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </div>

                {categoryHistoryRecords.length === 0 ? (
                  <div className="p-6 text-center text-neutral-400 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl">
                    ยังไม่มีประวัติรอบตรวจย้อนหลังสำหรับหมวดนี้
                  </div>
                ) : (
                  categoryHistoryRecords.map((h) => {
                    const isSelected = pendingRoundId === h.id;
                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          setPendingRoundId(h.id);
                          setShowRoundPickerModal(false);
                        }}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold'
                            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm truncate">
                            {h.title}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-3 flex-wrap">
                            <span>📅 {h.date} {h.time ? `(${h.time})` : ''}</span>
                            <span>👤 ผู้ตรวจ: {h.who || '-'}</span>
                            <span>📦 รายการ: {h.rows?.length || 0} รายการ</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowRoundPickerModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold text-xs cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download Plan & Multi-round Export Modal */}
        {showDownloadPlanModal && (
          <div className="absolute inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                      ดาวน์โหลดแผนผังและส่งออกรายงาน
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      ติ๊กเลือกรอบการตรวจที่ต้องการ (เลือกหลายรอบ หรือเลือกพร้อมกันทั้ง 5 รอบ)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDownloadPlanModal(false)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selection list */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
                {/* Bulk Select / Clear */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = ['current', ...(historyRecords || []).map((h) => h.id)];
                        setSelectedRoundsToExport(allIds);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold text-[11px] hover:bg-blue-200 transition cursor-pointer"
                    >
                      เลือกทั้งหมด ({1 + (historyRecords?.length || 0)} รอบ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRoundsToExport([])}
                      className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-[11px] hover:bg-neutral-200 transition cursor-pointer"
                    >
                      ล้างการเลือก
                    </button>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    เลือกอยู่ {selectedRoundsToExport.length} รอบ
                  </span>
                </div>

                {/* Round options with checkboxes */}
                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {/* Current Round Option */}
                  <div
                    onClick={() => {
                      setSelectedRoundsToExport((prev) =>
                        prev.includes('current')
                          ? prev.filter((id) => id !== 'current')
                          : [...prev, 'current']
                      );
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      selectedRoundsToExport.includes('current')
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="pt-0.5 text-blue-600">
                        {selectedRoundsToExport.includes('current') ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>🟢 รอบล่าสุดที่กำลังตรวจสอบ (ปัจจุบัน)</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          วันที่: {initialDate} | ผู้ตรวจ: {initialInspector || 'ผู้ดูแลระบบ'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historical Rounds (up to 5 or more) */}
                  {(!historyRecords || historyRecords.length === 0) ? (
                    <div className="p-4 text-center text-neutral-400 bg-neutral-50 dark:bg-neutral-800/20 rounded-xl text-[11px]">
                      ยังไม่มีประวัติรอบตรวจก่อนหน้า (ระบบจะส่งออกข้อมูลจากรอบปัจจุบัน)
                    </div>
                  ) : (
                    historyRecords.map((h, idx) => {
                      const isChecked = selectedRoundsToExport.includes(h.id);
                      const catLabel = h.type === 'eq' ? 'ครุภัณฑ์' : h.type === 'bag' ? 'กระเป๋า' : 'รถ';
                      return (
                        <div
                          key={h.id}
                          onClick={() => {
                            setSelectedRoundsToExport((prev) =>
                              isChecked
                                ? prev.filter((id) => id !== h.id)
                                : [...prev, h.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="pt-0.5 text-blue-600">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-neutral-900 dark:text-white truncate">
                                รอบที่ {(historyRecords || []).length - idx}: {h.title}
                              </div>
                              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>📅 {h.date} {h.time || ''}</span>
                                <span>👤 ผู้ตรวจ: {h.who || '-'}</span>
                                <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px]">หมวด: {catLabel}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Export Options */}
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    เลือกรูปแบบที่ต้องการดาวน์โหลด:
                  </div>

                  {/* Option 1: Excel Separated by Category */}
                  <button
                    type="button"
                    onClick={handleExportSeparatedCategories}
                    className="w-full p-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-between transition cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>ส่งออก Excel แยกตามประเภท (ครุภัณฑ์, กระเป๋า, รถ)</span>
                    </div>
                    <span className="text-[11px] bg-blue-500/40 px-2 py-0.5 rounded-full">ฟอร์ม A4 100%</span>
                  </button>

                  {/* Option 2: Download PDF A4 Landscape Report */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadPdf();
                      setShowDownloadPlanModal(false);
                    }}
                    className="w-full p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>ดาวน์โหลดรายงานเป็นไฟล์ PDF (ฟอร์ม A4 แนวนอน)</span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">PDF Explicit</span>
                  </button>

                  {/* Option 3: Download Single Excel for Current Preview */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadExcel();
                      setShowDownloadPlanModal(false);
                    }}
                    className="w-full p-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ดาวน์โหลดเฉพาะหมวดที่เปิดอยู่ ({selectedCategory === 'eq' ? 'ครุภัณฑ์' : selectedCategory === 'bag' ? 'กระเป๋า' : 'รถ'})</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDownloadPlanModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-xs cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Round Confirmation Modal */}
        {roundToDelete && (
          <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  ยืนยันการลบข้อมูลรอบตรวจ?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  คุณต้องการลบข้อมูลรอบตรวจ <span className="font-semibold text-neutral-800 dark:text-neutral-200">"{roundToDelete.title}"</span> ({roundToDelete.date}) ใช่หรือไม่? ข้อมูลของรอบนี้จะถูกลบออกจากระบบอย่างถาวร
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoundToDelete(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = roundToDelete.id;
                    setRoundToDelete(null);
                    if (onDeleteHistoryRecord) {
                      onDeleteHistoryRecord(targetId);
                    }
                    setSelectedRoundId('current');
                    setPendingRoundId('current');
                    setSyncMsg('✓ ลบข้อมูลรอบตรวจเรียบร้อยแล้ว');
                    setTimeout(() => setSyncMsg(''), 3000);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ยืนยันลบข้อมูล</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
