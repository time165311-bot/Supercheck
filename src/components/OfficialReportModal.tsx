import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  Printer,
  RotateCcw,
  Send,
  Smartphone,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { InspectionHistoryRecord } from '../types';

interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  date: string;
  inspector: string;
  items: Array<{
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
  }>;
  sheetUrl?: string;
  historyRecords?: InspectionHistoryRecord[];
}

export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({
  isOpen,
  onClose,
  title: initialTitle,
  date: initialDate,
  inspector: initialInspector,
  items: initialItems,
  sheetUrl,
  historyRecords = [],
}) => {
  const [filterProblemOnly, setFilterProblemOnly] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('current');
  const [fitScreenMobile, setFitScreenMobile] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const touchStartDist = useRef<number | null>(null);

  // Active view data (can be current or switched to a past round)
  const [curTitle, setCurTitle] = useState(initialTitle);
  const [curDate, setCurDate] = useState(initialDate);
  const [curInspector, setCurInspector] = useState(initialInspector);
  const [curItems, setCurItems] = useState(initialItems);
  const [currentRoundName, setCurrentRoundName] = useState('รอบล่าสุด');

  useEffect(() => {
    if (selectedRoundId === 'current') {
      setCurTitle(initialTitle);
      setCurDate(initialDate);
      setCurInspector(initialInspector);
      setCurItems(initialItems);
      setCurrentRoundName('รอบล่าสุด');
    } else {
      const match = historyRecords.find((h) => h.id === selectedRoundId);
      if (match) {
        setCurTitle(match.title);
        setCurDate(match.date);
        setCurInspector(match.who);
        setCurItems(match.rows);
        setCurrentRoundName(match.title + ' (' + match.date + ')');
      }
    }
  }, [selectedRoundId, initialTitle, initialDate, initialInspector, initialItems, historyRecords]);

  // Format date to Thai Buddhist Era
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

  // Reliable cross-platform / iframe printer (ensures ZERO font overlapping in print)
  const handlePrint = () => {
    let iframe = document.getElementById('print-report-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-report-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '1200px';
      iframe.style.height = '900px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const itemsToPrint = filterProblemOnly
      ? curItems.filter((it) => it.res && it.res !== 'ใช้งานได้')
      : curItems;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>แบบฟอร์มรายงานตรวจเช็ค - ${thaiDate || ''}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 8mm 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff !important;
              color: #000 !important;
              font-family: 'Sarabun', 'TH Sarabun New', 'Prompt', 'Cordia New', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 8pt;
              line-height: 1.3;
            }
            .title-box {
              text-align: center;
              margin-bottom: 6px;
            }
            .title-box h2 {
              font-size: 13pt;
              font-weight: bold;
              margin: 0 0 2px 0;
              line-height: 1.2;
            }
            .title-box p {
              font-size: 9pt;
              margin: 0;
              line-height: 1.2;
            }
            .meta-box {
              width: 100%;
              margin-bottom: 6px;
              border-bottom: 1px solid #000;
              padding-bottom: 4px;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
            }
            .meta-table td {
              border: none !important;
              padding: 1px 0;
              font-size: 8.5pt;
              line-height: 1.3;
            }
            table.report-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 8pt;
              margin-bottom: 8px;
            }
            table.report-table th, table.report-table td {
              border: 1px solid #000 !important;
              padding: 3px 2px;
              vertical-align: middle;
              text-align: center;
              line-height: 1.25;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            table.report-table th {
              background-color: #f1f5f9 !important;
              font-weight: bold;
              font-size: 8pt;
            }
            .check-mark {
              font-size: 10.5pt;
              font-weight: bold;
              line-height: 1;
            }
            .sig-section {
              margin-top: 14px;
              width: 100%;
              page-break-inside: avoid;
            }
            .sig-table {
              width: 100%;
              border-collapse: collapse;
            }
            .sig-table td {
              border: none !important;
              text-align: center;
              font-size: 9.5pt;
              line-height: 1.7;
              padding: 2px 8px;
            }
          </style>
        </head>
        <body>
          <div class="title-box">
            <h2>ทะเบียนรายการครุภัณฑ์และอุปกรณ์</h2>
            <p>ณ วันที่ ${thaiDate || '........................................'}</p>
          </div>
          <div class="meta-box">
            <table class="meta-table">
              <tr>
                <td style="text-align: left; width: 50%;">หน่วยงาน: <b>${curTitle || 'คลินิกงานบริการผู้ป่วยในวิสัญญี'}</b></td>
                <td style="text-align: right; width: 50%;">วัน, เดือน, ปี ที่สำรวจ: <b>${thaiDate || '-'}</b></td>
              </tr>
              <tr>
                <td style="text-align: left;">หัวหน้าภาควิชา/หน่วยงาน: ....................................................</td>
                <td style="text-align: right;">กรรมการผู้ตรวจ: <b>${curInspector || '....................................................'}</b></td>
              </tr>
            </table>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th rowspan="3" style="width: 3.5%;">ลำดับ</th>
                <th rowspan="3" style="width: 10%;">หมายเลขพัสดุ</th>
                <th rowspan="3" style="width: 8%;">รหัส SAP</th>
                <th rowspan="3" style="width: 16.5%;">รายการ</th>
                <th rowspan="3" style="width: 12%;">มาตรฐาน/คุณลักษณะ</th>
                <th rowspan="3" style="width: 8%;">แหล่งเงินที่มา<br>(ประเภทงบประมาณ)</th>
                <th rowspan="3" style="width: 7%;">ว/ด/ป ได้มา</th>
                <th rowspan="3" style="width: 3.5%;">จำนวน</th>
                <th rowspan="3" style="width: 3.5%;">ภาษี %</th>
                <th rowspan="3" style="width: 7%;">ราคา</th>
                <th rowspan="3" style="width: 9%;">สถานที่ตั้ง</th>
                <th colspan="3">ผลการตรวจสอบพัสดุ</th>
              </tr>
              <tr>
                <th colspan="2">พบรายการ</th>
                <th rowspan="2" style="width: 4%;">ไม่พบ</th>
              </tr>
              <tr>
                <th style="width: 4%;">ใช้งานได้</th>
                <th style="width: 4%;">ใช้งานไม่ได้</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToPrint.map((row, idx) => {
                const isOk = row.res.includes('ใช้งานได้');
                const isBad = row.res.includes('ไม่ได้');
                const isMiss = row.res.includes('ไม่พบ');
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${row.code || '-'}</td>
                    <td>${row.sap || '-'}</td>
                    <td>${row.name || '-'}</td>
                    <td>${row.spec || '-'}</td>
                    <td>${row.source || '-'}</td>
                    <td>${row.date || '-'}</td>
                    <td>${row.qty || '1'}</td>
                    <td>${row.tax || '7'}</td>
                    <td>${row.price || '-'}</td>
                    <td>${row.location || '-'}${row.note ? ` (${row.note})` : ''}</td>
                    <td class="check-mark" style="color: #047857;">${isOk ? '✓' : ''}</td>
                    <td class="check-mark" style="color: #b91c1c;">${isBad ? '✓' : ''}</td>
                    <td class="check-mark" style="color: #b45309;">${isMiss ? '✓' : ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="sig-section">
            <table class="sig-table">
              <tr>
                <td style="width: 50%;">
                  ลงชื่อ .................................................... ผู้ตรวจสอบ<br>
                  <b>( ${curInspector || '....................................................'} )</b>
                </td>
                <td style="width: 50%;">
                  ลงชื่อ .................................................... หัวหน้างาน<br>
                  <b>( .................................................... )</b>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `);
    doc.close();

    const doIframePrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        window.print();
      }
    };

    if (iframe.contentWindow?.document?.fonts?.ready) {
      iframe.contentWindow.document.fonts.ready.then(() => {
        setTimeout(doIframePrint, 150);
      });
    } else {
      setTimeout(doIframePrint, 300);
    }
  };

  // Keyboard shortcut Ctrl + P (Print), Ctrl + / - / 0 (Zoom In / Out / Reset)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handlePrint();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoomLevel((prev) => Math.min(prev + 10, 200));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setZoomLevel((prev) => Math.max(prev - 10, 50));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(100);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, curItems, filterProblemOnly, curInspector, curTitle, curDate, zoomLevel]);

  // Touch Pinch-to-zoom for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = dist - touchStartDist.current;
      if (Math.abs(diff) > 15) {
        if (diff > 0) {
          setZoomLevel((prev) => Math.min(prev + 4, 200));
        } else {
          setZoomLevel((prev) => Math.max(prev - 4, 50));
        }
        touchStartDist.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  if (!isOpen) return null;

  const problemCount = curItems.filter((it) => it.res && it.res !== 'ใช้งานได้').length;
  const displayedItems = filterProblemOnly
    ? curItems.filter((it) => it.res && it.res !== 'ใช้งานได้')
    : curItems;

  const handleDownloadExcel = () => {
    const headers = [
      'ลำดับ',
      'รหัสครุภัณฑ์',
      'หมายเลข SAP',
      'รายการครุภัณฑ์',
      'คุณลักษณะ/ยี่ห้อ/รุ่น',
      'วิธีได้มา',
      'วันที่ได้มา',
      'จำนวน',
      'อัตราภาษี (%)',
      'ราคาต่อหน่วย (บาท)',
      'สถานที่ตั้ง',
      'ผลการตรวจสอบ',
      'หมายเหตุ',
    ];

    const escapeCsv = (val: any) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvRows: string[] = [];
    csvRows.push(headers.map(escapeCsv).join(','));

    displayedItems.forEach((it, idx) => {
      csvRows.push(
        [
          it.no || String(idx + 1),
          it.code || '-',
          it.sap || '-',
          it.name,
          it.spec || '-',
          it.source || '-',
          it.date || '-',
          it.qty || '1',
          it.tax || '7',
          it.price || '-',
          it.location || '-',
          it.res || 'ใช้งานได้',
          it.note || '',
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `รายงาน_${curTitle.replace(/[\/\s]/g, '_')}_${curDate}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenSheetWithRound = () => {
    if (!sheetUrl) return;
    window.open(sheetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-black rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden relative">
        {/* Top Control Bar - With padding-right for top-right absolute close button */}
        <div className="px-4 py-2.5 pr-14 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0 flex-wrap relative">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-neutral-800 dark:text-white truncate">
                แบบฟอร์มรายงานตรวจเช็คทางการ (14 คอลัมน์)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* History Round Selector */}
            {historyRecords.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <History className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <label htmlFor="round-select" className="sr-only">
                  เลือกรอบตรวจ
                </label>
                <select
                  id="round-select"
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="current">รอบล่าสุดที่กำลังตรวจ ({initialDate})</option>
                  {historyRecords.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.date} {h.time ? `(${h.time})` : ''} - {h.title} [{h.who}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Zoom In/Out Controls (Ctrl +/- & Touch) */}
            <div className="flex items-center gap-0.5 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-0.5 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(prev - 10, 50))}
                title="ซูมออก (Ctrl -)"
                className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 min-w-9 text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(prev + 10, 200))}
                title="ซูมเข้า (Ctrl +)"
                className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomLevel !== 100 && (
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  title="รีเซ็ต 100% (Ctrl 0)"
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Mobile Fit Toggle Button */}
            <button
              type="button"
              onClick={() => setFitScreenMobile(!fitScreenMobile)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                fitScreenMobile
                  ? 'bg-sky-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700'
              }`}
              title="สลับโหมดฟิตหน้าจอในมือถือ (ไม่ต้องเลื่อนซ้ายขวา)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {fitScreenMobile ? 'โหมดฟิตจอเปิดอยู่' : 'ฟิตหน้าจอมือถือ'}
              </span>
            </button>

            {/* Filter options */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterProblemOnly(false)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  !filterProblemOnly
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                ทั้งหมด ({curItems.length})
              </button>
              {problemCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterProblemOnly(true)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    filterProblemOnly
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-white dark:bg-neutral-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  มีปัญหา ({problemCount})
                </button>
              )}
            </div>

            {/* Download Excel Button */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              title="ดาวน์โหลดรายงานเป็นไฟล์ Excel (.csv)"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด Excel</span>
            </button>

            {/* Print Button without Ctrl+P text */}
            <button
              type="button"
              onClick={handlePrint}
              title="สั่งพิมพ์รายงาน A4 ทันที (หรือกดแป้น Ctrl + P)"
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์</span>
            </button>
          </div>

          {/* Absolute Top-Right Close (X) Button firmly pinned to the top-right corner of the modal frame */}
          <button
            type="button"
            onClick={onClose}
            title="ปิดหน้าต่างรายงาน"
            className="absolute top-2 right-2.5 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Formal Document Body (Supports mobile fit toggle & Zoom) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-auto p-2 sm:p-5 bg-slate-50 dark:bg-slate-950 font-['Sarabun',sans-serif]"
        >
          <div
            id="printable-official-table-doc"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.1s ease-out',
            }}
            className={`${
              fitScreenMobile ? 'w-full text-[9px]' : 'min-w-[960px]'
            } max-w-5xl mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-7 rounded-2xl shadow-xs border border-slate-300 dark:border-slate-800 leading-normal`}
          >
            {/* Formal Header */}
            <div className="text-center mb-4">
              <h2 className="text-sm sm:text-base font-bold tracking-tight">
                ทะเบียนรายการครุภัณฑ์และอุปกรณ์ ({currentRoundName})
              </h2>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                ณ วันที่ {thaiDate || '........................................'}
              </p>
            </div>

            {/* Department & Inspector Info */}
            <div className="grid grid-cols-2 gap-4 mb-3 text-xs font-medium border-b border-slate-300 dark:border-slate-700 pb-2.5">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">หน่วยงาน: </span>
                  <span className="font-semibold">{curTitle || 'คลินิกงานบริการผู้ป่วยในวิสัญญี'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">หัวหน้าภาควิชา/หน่วยงาน: </span>
                  <span className="border-b border-dotted border-slate-400 inline-block w-32 sm:w-40"></span>
                </div>
              </div>

              <div className="space-y-1 text-right">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">วัน, เดือน, ปี ที่สำรวจ: </span>
                  <span className="font-semibold">{thaiDate || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">กรรมการผู้ตรวจ: </span>
                  <span className="font-semibold border-b border-dotted border-slate-400 px-2">
                    {curInspector || '........................................'}
                  </span>
                </div>
              </div>
            </div>

            {/* 14-Column Formal Table */}
            <div className="border border-slate-700 dark:border-slate-400 rounded-xs overflow-hidden">
              <table className="w-full border-collapse text-[10px] sm:text-[10.5px]">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-7 sm:w-8 bg-slate-200 dark:bg-slate-800">
                      ลำดับ
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-20 sm:w-24 bg-slate-200 dark:bg-slate-800">
                      หมายเลขพัสดุ
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-16 sm:w-20 bg-slate-200 dark:bg-slate-800">
                      รหัส SAP
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-28 sm:w-36 bg-slate-200 dark:bg-slate-800">
                      รายการ
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-24 sm:w-32 bg-slate-200 dark:bg-slate-800">
                      มาตรฐาน/คุณลักษณะ
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-16 sm:w-20 bg-slate-200 dark:bg-slate-800">
                      แหล่งเงินที่มา<br />(ประเภทงบประมาณ)
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-14 sm:w-16 bg-slate-200 dark:bg-slate-800">
                      ว/ด/ป ได้มา
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-10 sm:w-12 bg-slate-200 dark:bg-slate-800">
                      จำนวน
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-8 sm:w-10 bg-slate-200 dark:bg-slate-800">
                      ภาษี %
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-16 sm:w-20 bg-slate-200 dark:bg-slate-800">
                      ราคา
                    </th>
                    <th rowSpan={3} className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-20 sm:w-24 bg-slate-200 dark:bg-slate-800">
                      สถานที่ตั้ง
                    </th>
                    <th colSpan={3} className="p-1 text-center border-b border-r border-slate-400 dark:border-slate-600 bg-slate-200 dark:bg-slate-800">
                      ผลการตรวจสอบพัสดุ
                    </th>
                  </tr>
                  <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-slate-600">
                    <th colSpan={2} className="border-r border-slate-400 dark:border-slate-600 p-1 text-center bg-slate-200 dark:bg-slate-800">
                      พบรายการ
                    </th>
                    <th rowSpan={2} className="p-1 text-center w-12 sm:w-14 border-b-2 border-b-slate-900 dark:border-b-slate-200 border-r border-slate-400 dark:border-slate-600 bg-slate-200 dark:bg-slate-800">
                      ไม่พบ
                    </th>
                  </tr>
                  <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                    <th className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-12 sm:w-14 bg-slate-200 dark:bg-slate-800">
                      ใช้งานได้
                    </th>
                    <th className="border-r border-slate-400 dark:border-slate-600 border-b-2 border-b-slate-900 dark:border-b-slate-200 p-1 text-center w-12 sm:w-14 bg-slate-200 dark:bg-slate-800">
                      ใช้งานไม่ได้
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((row, idx) => {
                    const isOk = row.res.includes('ใช้งานได้');
                    const isBad = row.res.includes('ไม่ได้');
                    const isMiss = row.res.includes('ไม่พบ');

                    return (
                      <tr
                        key={idx}
                        className="border-b border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-medium">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-mono text-[9px] sm:text-[10px]">
                          {row.code || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-mono text-[9px] sm:text-[10px]">
                          {row.sap || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-medium">
                          {row.name}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center text-slate-600 dark:text-slate-400">
                          {row.spec || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center text-slate-600 dark:text-slate-400">
                          {row.source || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center whitespace-nowrap">
                          {row.date || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center">
                          {row.qty || '1'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center">
                          {row.tax || '7'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center font-mono text-[9px] sm:text-[10px]">
                          {row.price || '-'}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center">
                          <div>{row.location || '-'}</div>
                          {row.note && (
                            <div className="text-[9px] text-red-600 dark:text-red-400 font-semibold">
                              ({row.note})
                            </div>
                          )}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                          {isOk ? '✓' : ''}
                        </td>
                        <td className="border-r border-slate-300 dark:border-slate-700 p-1 text-center text-red-600 dark:text-red-400 font-bold text-sm">
                          {isBad ? '✓' : ''}
                        </td>
                        <td className="p-1 text-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                          {isMiss ? '✓' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Signatures Line */}
            <div className="mt-8 pt-5 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center text-xs text-slate-800 dark:text-slate-200">
              <div className="w-1/2 text-center px-4 space-y-1">
                <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  ( {curInspector || '....................................................'} )
                </p>
              </div>
              <div className="w-1/2 text-center px-4 space-y-1">
                <p>ลงชื่อ .................................................... หัวหน้างาน</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  ( .................................................... )
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
