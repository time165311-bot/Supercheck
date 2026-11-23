import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HaAuditLogEntry } from '../types';

let regularFontBase64Cache: string | null = null;
let boldFontBase64Cache: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Thai font from ${url} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

async function ensureThaiFontLoaded(doc: jsPDF): Promise<boolean> {
  try {
    if (!regularFontBase64Cache) {
      regularFontBase64Cache = await fetchFontAsBase64('/fonts/NotoSansThai-Regular.ttf');
    }
    if (!boldFontBase64Cache) {
      boldFontBase64Cache = await fetchFontAsBase64('/fonts/NotoSansThai-Bold.ttf');
    }

    doc.addFileToVFS('NotoSansThai-Regular.ttf', regularFontBase64Cache);
    doc.addFont('NotoSansThai-Regular.ttf', 'NotoSansThai', 'normal');

    doc.addFileToVFS('NotoSansThai-Bold.ttf', boldFontBase64Cache);
    doc.addFont('NotoSansThai-Bold.ttf', 'NotoSansThai', 'bold');

    doc.setFont('NotoSansThai', 'normal');
    return true;
  } catch (err) {
    console.warn('[exportPdf] Failed to load bundled Thai fonts, falling back to default font:', err);
    return false;
  }
}

export interface OfficialPdfExportOptions {
  reportType: 'eq' | 'bag' | 'cart' | 'drug' | 'ambulance' | string;
  title: string;
  departmentName?: string;
  inspectorName: string;
  inspectorPosition?: string;
  dateStr: string;
  signatureDataUrl?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  summaryText?: string;
  fileName?: string;
}

/**
 * Generates and downloads a sharp multi-page A4 Thai PDF with embedded NotoSansThai fonts.
 */
export async function exportOfficialReportPdf(options: OfficialPdfExportOptions): Promise<void> {
  const orientation = options.headers.length > 6 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const fontLoaded = await ensureThaiFontLoaded(doc);
  const fontFamily = fontLoaded ? 'NotoSansThai' : 'helvetica';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;

  // Header Banner
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(options.departmentName || 'กลุ่มงานวิสัญญีวิทยา (Anesthesia Care Unit)', marginX, 14);

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text(options.title, marginX, 21);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`วันที่ตรวจสอบ: ${options.dateStr}`, marginX, 27);
  doc.text(
    `ผู้ตรวจ: ${options.inspectorName}${options.inspectorPosition ? ` (${options.inspectorPosition})` : ''}`,
    marginX,
    32
  );

  if (options.summaryText) {
    doc.setTextColor(15, 118, 110);
    doc.text(options.summaryText, marginX, 37);
  }

  autoTable(doc, {
    startY: options.summaryText ? 41 : 36,
    head: [options.headers],
    body: options.rows.map((r) => r.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))),
    styles: {
      font: fontFamily,
      fontSize: 8.5,
      cellPadding: 2.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: {
      font: fontFamily,
      fontStyle: 'bold',
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      halign: 'center',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: marginX, right: marginX, bottom: 24 },
    didDrawPage: (data) => {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const pageCount = doc.getNumberOfPages();
      doc.text(
        `หน้า ${data.pageNumber} / ${pageCount}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: 'right' }
      );
      doc.text(
        'Anesthesia Care Clinical Inventory & Safety Compliance Report',
        marginX,
        pageHeight - 8
      );
    },
  });

  // Signature Block on last page
  const finalY = Math.min((doc as any).lastAutoTable?.finalY + 10 || pageHeight - 40, pageHeight - 36);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  if (options.signatureDataUrl && options.signatureDataUrl.startsWith('data:image/')) {
    try {
      const fmt = options.signatureDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(options.signatureDataUrl, fmt, pageWidth - 68, finalY - 4, 38, 14);
    } catch {
      // ignore invalid image
    }
  }

  doc.text('ลงชื่อ .................................................... ผู้ตรวจ', pageWidth - marginX, finalY + 14, {
    align: 'right',
  });
  doc.text(`( ${options.inspectorName} )`, pageWidth - marginX - 10, finalY + 19, {
    align: 'right',
  });

  const safeFileName =
    options.fileName ||
    `Anesthesia_Report_${options.reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeFileName);
}

/**
 * Exports HA / JCI Audit Trail Report as a cleanly formatted Thai PDF.
 */
export async function exportHaAuditPdf(params: {
  channelName: string;
  exporterName: string;
  exporterPosition?: string;
  signatureDataUrl?: string;
  totalChecksCompleted: number;
  totalAnomalies: number;
  criticalLowStockCount: number;
  auditLogs: HaAuditLogEntry[];
}): Promise<void> {
  const headers = ['ลำดับ', 'วัน/เวลา', 'ผู้ปฏิบัติงาน', 'ตำแหน่ง', 'การกระทำ (Action)', 'รายละเอียด (Details)'];
  const rows = params.auditLogs.slice(0, 150).map((log, idx) => {
    const dt = new Date(log.timestamp).toLocaleString('th-TH', {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const detailSummary = [
      log.details?.itemName || '',
      log.details?.patientHn ? `HN: ${log.details.patientHn}` : '',
      log.details?.reason || log.details?.note || '',
      log.details?.dispenseQty !== undefined ? `จำนวน: ${log.details.dispenseQty}` : '',
    ]
      .filter(Boolean)
      .join(' | ') || JSON.stringify(log.details || {});

    return [
      idx + 1,
      dt,
      log.userName,
      log.role,
      log.action,
      detailSummary.slice(0, 140),
    ];
  });

  await exportOfficialReportPdf({
    reportType: 'eq',
    title: `รายงาน HA & JCI Audit Trail — ${params.channelName}`,
    departmentName: 'ระบบควบคุมมาตรฐานความปลอดภัยทางวิสัญญี (HA / JCI Compliance)',
    inspectorName: params.exporterName,
    inspectorPosition: params.exporterPosition,
    dateStr: new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    signatureDataUrl: params.signatureDataUrl,
    summaryText: `ตรวจเช็กแล้ว: ${params.totalChecksCompleted} | พบจุดบกพร่อง: ${params.totalAnomalies} | ยาใกล้หมดสต็อก: ${params.criticalLowStockCount} | บันทึกทั้งหมด: ${params.auditLogs.length} รายการ`,
    headers,
    rows,
    fileName: `HA_JCI_Audit_${params.channelName}_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}
