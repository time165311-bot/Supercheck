import * as XLSX from 'xlsx';
import { DrugItem, HaAuditLogEntry, ListConfig } from '../types';

export interface HaAuditExcelParams {
  channelName: string;
  currentUserName: string;
  totalChecksCompleted: number;
  totalAnomalies: number;
  criticalLowStockCount: number;
  lists?: Record<'bag' | 'cart', ListConfig>;
  drugs: DrugItem[];
  auditLogs: HaAuditLogEntry[];
}

export function exportHaAuditExcel(params: HaAuditExcelParams): string {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary Dashboard Analytics
  const summaryData = [
    ['รายงานสรุปมาตรฐาน HA & JCI Compliance - งานวิสัญญีวิทยา'],
    ['วอร์ด/ห้องปฏิบัติการ (Channel):', params.channelName],
    ['วันที่ออกรายงาน:', new Date().toLocaleString('th-TH')],
    ['ผู้จัดทำรายงาน:', params.currentUserName],
    [],
    ['ตัวชี้วัดคุณภาพ (KPI)', 'ผลลัพธ์'],
    ['จำนวนรายการที่ตรวจเช็กแล้ว (Completed Checks)', params.totalChecksCompleted],
    ['จำนวนพบความผิดปกติ/ชำรุด (Anomalies)', params.totalAnomalies],
    ['จำนวนยาวิกฤตใกล้หมดสต็อก (Low Stock Alerts)', params.criticalLowStockCount],
    ['จำนวนบันทึกกิจกรรมทั้งหมด (Total Audit Logs)', params.auditLogs.length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Analytics');

  // Sheet 2: Audit Trail Logs
  const auditRows = params.auditLogs.map((log, i) => ({
    'ลำดับ': i + 1,
    'วัน-เวลา': new Date(log.timestamp).toLocaleString('th-TH'),
    'ผู้ดำเนินการ': log.userName,
    'รหัสผู้ใช้': log.userId,
    'ตำแหน่ง/สิทธิ์': log.role,
    'การกระทำ (Action)': log.action,
    'เป้าหมาย (Target Collection)': log.targetCollection,
    'Target ID': log.targetId,
    'รายละเอียด': JSON.stringify(log.details),
    'IP/Host': log.ipAddress || 'Web Client',
  }));
  const wsAudit = XLSX.utils.json_to_sheet(auditRows);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Trail Logs');

  // Sheet 3: Emergency Bag & Cart Inventory
  const equipRows: any[] = [];
  (['bag', 'cart'] as const).forEach((cat) => {
    const groups = params.lists?.[cat]?.groups || {};
    Object.entries(groups).forEach(([gName, items]) => {
      items.forEach((it) => {
        equipRows.push({
          'ประเภท': cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน',
          'หมวดหมู่/ชั้น': gName,
          'ชื่อรายการ': it.name,
          'จำนวนมาตรฐาน': it.qty || '1',
          'วันหมดอายุ': it.exp || '-',
          'หมายเหตุ': it.note || '-',
        });
      });
    });
  });
  const wsEquip = XLSX.utils.json_to_sheet(equipRows);
  XLSX.utils.book_append_sheet(wb, wsEquip, 'Emergency Bag & Cart');

  // Sheet 4: Drugs Stock
  const drugRows = params.drugs.map((d, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสยา (TMT/HIS)': d.tmtCode || d.hospitalDrugCode || d.barcode || '-',
    'ชื่อยา/สารน้ำ': d.name,
    'หมวดหมู่': d.category,
    'คงเหลือ': d.remaining,
    'เกณฑ์ขั้นต่ำ': d.minStock,
    'Lot ปัจจุบัน': d.lotNumber || '-',
    'วันหมดอายุ (เร็วที่สุด)': d.expDate || d.exp || '-',
    'หมายเหตุ': d.note || '-',
  }));
  const wsDrugs = XLSX.utils.json_to_sheet(drugRows);
  XLSX.utils.book_append_sheet(wb, wsDrugs, 'Drugs Stock');

  const fileName = `HA_JCI_Report_${params.channelName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
