import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  Send,
  Database,
  Search,
  Filter,
  Check,
  Cpu,
  FileText,
  Building,
  ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { User, DrugItem, EquipmentItem, HaAuditLogEntry, FhirMedicationDispensePayload } from '../types';
import { logAuditEvent } from '../services/auditLogger';
import { fetchHaAuditLogs, subscribeHaAuditLogs } from '../services/firebase';

export interface HaAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  drugs: DrugItem[];
  equipment: { [key: string]: EquipmentItem[] };
  activeChannelName?: string;
}

export type HaReportType = 'daily_cart' | 'controlled_drugs' | 'equipment_calibration' | 'audit_trail' | 'fhir_bridge';

export const HaAuditReportModal: React.FC<HaAuditReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  drugs = [],
  equipment = {},
  activeChannelName = 'ห้องผ่าตัด OR (Master)',
}) => {
  const [activeTab, setActiveTab] = useState<HaReportType>('daily_cart');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'afternoon' | 'night'>('morning');
  const [inspectorName, setInspectorName] = useState<string>(() => currentUser?.name || 'พว. วิสัญญี ปฏิบัติการ');
  const [wardHeadName, setWardHeadName] = useState<string>('พว. หัวหน้าแผนกวิสัญญีวิทยา');
  const [cartSealNo, setCartSealNo] = useState<string>('SL-2026-9482');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string>('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<HaAuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // FHIR Bridge Simulator State
  const [fhirSimDrug, setFhirSimDrug] = useState<string>('Atropine 0.6 mg / ml');
  const [fhirSimQty, setFhirSimQty] = useState<number>(2);
  const [fhirSimPatientHn, setFhirSimPatientHn] = useState<string>('HN-6904128');
  const [fhirSimDoctor, setFhirSimDoctor] = useState<string>('นพ. กิตติพงษ์ แพทย์เวร');
  const [fhirSimStatus, setFhirSimStatus] = useState<any>(null);
  const [isSimulatingFhir, setIsSimulatingFhir] = useState<boolean>(false);

  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // Sync user name if available
  useEffect(() => {
    if (currentUser?.name) {
      setInspectorName(currentUser.name);
    }
  }, [currentUser]);

  // Load audit logs on open or tab switch
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingLogs(true);
    fetchHaAuditLogs(80)
      .then((logs) => {
        if (logs && logs.length > 0) {
          setAuditLogs(logs);
        } else {
          try {
            const cached = localStorage.getItem('ha_audit_logs_cache');
            if (cached) setAuditLogs(JSON.parse(cached));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Audit logs fetch warning:', err);
        try {
          const cached = localStorage.getItem('ha_audit_logs_cache');
          if (cached) setAuditLogs(JSON.parse(cached));
        } catch {}
      })
      .finally(() => setIsLoadingLogs(false));

    const unsubscribe = subscribeHaAuditLogs((updatedLogs) => {
      if (updatedLogs && updatedLogs.length > 0) {
        setAuditLogs(updatedLogs);
      }
    }, 80);

    const handleLocalAudit = (e: any) => {
      if (e.detail) {
        setAuditLogs((prev) => [e.detail, ...prev.filter((p) => p.id !== e.detail.id)]);
      }
    };
    window.addEventListener('ha_audit_log_added', handleLocalAudit);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('ha_audit_log_added', handleLocalAudit);
    };
  }, [isOpen, activeTab]);

  // Daily Crash Cart Checklist Standard Dataset
  const dailyCartChecklist = useMemo(() => {
    return [
      { id: 'c1', cat: 'สถานะภายนอก', name: 'หมายเลขซีลล็อค (Lock Seal No.)', std: 'ซีลล็อคครบสมบูรณ์ ไม่ถูกตัด', result: 'ปกติ', note: `ซีลเลขที่ ${cartSealNo}` },
      { id: 'c2', cat: 'ระบบไฟฟ้าและออกซิเจน', name: 'เครื่องกระตุกหัวใจ (Defibrillator / AED)', std: 'Selftest ผ่าน, แบตเตอรี่เต็ม, สายครบ', result: 'ปกติ', note: 'Self-Test OK (100% Bat)' },
      { id: 'c3', cat: 'ระบบไฟฟ้าและออกซิเจน', name: 'ถังออกซิเจนฉุกเฉิน (O2 Tank พร้อมเกจ์)', std: 'แรงดัน >= 1500 PSI, หัวต่อพร้อมใช้', result: 'ปกติ', note: '1800 PSI' },
      { id: 'c4', cat: 'ระบบไฟฟ้าและออกซิเจน', name: 'เครื่องดูดเสมหะฉุกเฉิน (Portable Suction)', std: 'แรงดูด >= 300 mmHg, สายดูดสะอาด', result: 'ปกติ', note: 'Vacuum OK (-400 mmHg)' },
      { id: 'c5', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: 'Adrenaline (Epinephrine 1:1000) 1 mg/ml', std: '10 amp, ตรวจวันหมดอายุ', result: 'ปกติ', note: '10 amp (EXP: 10/2027)' },
      { id: 'c6', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: 'Atropine Sulfate 0.6 mg/ml', std: '10 amp, ตรวจวันหมดอายุ', result: 'ปกติ', note: '10 amp (EXP: 08/2027)' },
      { id: 'c7', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: 'Amiodarone 150 mg/3ml', std: '4 amp, ตรวจวันหมดอายุ', result: 'ปกติ', note: '4 amp (EXP: 05/2027)' },
      { id: 'c8', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: 'Sodium Bicarbonate 7.5% 50ml', std: '4 ขวด, ไม่ตกตะกอน', result: 'ปกติ', note: '4 ขวด (EXP: 12/2026)' },
      { id: 'c9', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: 'Calcium Gluconate 10% 10ml', std: '4 amp, ตรวจวันหมดอายุ', result: 'ปกติ', note: '4 amp (EXP: 09/2027)' },
      { id: 'c10', cat: 'ชั้นที่ 1 ยาช่วยชีวิตฉุกเฉิน', name: '50% Glucose (Dextrose) 50ml', std: '4 หลอด, ตรวจวันหมดอายุ', result: 'ปกติ', note: '4 หลอด (EXP: 11/2027)' },
      { id: 'c11', cat: 'ชั้นที่ 2 ทางเดินหายใจ (Airway)', name: 'ชุดไฟส่องกล่องเสียง (Laryngoscope Handle & Blades)', std: 'ด้าม 1, Blade Curve No. 2, 3, 4 ไฟติดสว่าง', result: 'ปกติ', note: 'หลอดไฟ LED สว่างชัด' },
      { id: 'c12', cat: 'ชั้นที่ 2 ทางเดินหายใจ (Airway)', name: 'ท่อช่วยหายใจ (Endotracheal Tube) No. 6.5, 7.0, 7.5, 8.0', std: 'ขนาดละ 2 ท่อ (Cuff ไม่รั่ว)', result: 'ปกติ', note: 'ครบทุกขนาด' },
      { id: 'c13', cat: 'ชั้นที่ 2 ทางเดินหายใจ (Airway)', name: 'ลูกยางบีบช่วยหายใจพร้อมถุงสำรอง (Ambu Bag & Mask)', std: 'ผู้ใหญ่ 1 ชุด + Mask No. 3, 4, 5', result: 'ปกติ', note: 'แรงคืนตัวดี ลิ้นวาล์วปกติ' },
      { id: 'c14', cat: 'ชั้นที่ 3 สารน้ำและอุปกรณ์แทงเส้น', name: 'สารน้ำ NSS 0.9% 1,000 ml & 500 ml', std: 'ขนาดละ 2 ถุง ไม่รั่วซึม', result: 'ปกติ', note: 'พร้อมใช้งาน' },
      { id: 'c15', cat: 'ชั้นที่ 3 สารน้ำและอุปกรณ์แทงเส้น', name: 'เข็มแทงน้ำเกลือ IV Catheter No. 18, 20, 22', std: 'เบอร์ละ 5 ชิ้น ซองไม่ฉีกขาด', result: 'ปกติ', note: 'บรรจุภัณฑ์สมบูรณ์' },
    ];
  }, [cartSealNo]);

  // Controlled Drugs & Expiry Log Dataset
  const controlledAndExpiryDrugs = useMemo(() => {
    const list = [
      { id: 'cd-1', code: 'NARC-01', name: 'Fentanyl 0.1 mg / 2ml (ยาเสพติดให้โทษประเภท 2)', category: 'ยาควบคุมพิเศษ', lot: 'LOT-FN9421', exp: '2027-04-15', stock: 10, par: 10, unit: 'amp', status: 'ตรงตาม Par' },
      { id: 'cd-2', code: 'NARC-02', name: 'Morphine Sulfate 10 mg / 1ml (ยาเสพติดให้โทษประเภท 2)', category: 'ยาควบคุมพิเศษ', lot: 'LOT-MP8812', exp: '2027-02-28', stock: 5, par: 5, unit: 'amp', status: 'ตรงตาม Par' },
      { id: 'cd-3', code: 'NARC-03', name: 'Pethidine HCl 50 mg / 1ml (ยาเสพติดให้โทษประเภท 2)', category: 'ยาควบคุมพิเศษ', lot: 'LOT-PT7411', exp: '2026-12-31', stock: 5, par: 5, unit: 'amp', status: 'ตรงตาม Par' },
      { id: 'cd-4', code: 'HAD-01', name: 'Midazolam 5 mg / 1ml (วัตถุออกฤทธิ์ต่อจิตประสาท)', category: 'วัตถุออกฤทธิ์', lot: 'LOT-MD3019', exp: '2027-08-20', stock: 10, par: 10, unit: 'amp', status: 'ตรงตาม Par' },
      { id: 'cd-5', code: 'HAD-02', name: 'Potassium Chloride (KCl 10% 20 mEq / 10ml)', category: 'High Alert Drug', lot: 'LOT-KC2901', exp: '2026-11-28', stock: 8, par: 10, unit: 'amp', status: 'ใกล้หมดอายุ (Exp < 30 วัน)' },
      { id: 'cd-6', code: 'HAD-03', name: 'Norepinephrine (Levophed 4 mg / 4ml)', category: 'High Alert Drug', lot: 'LOT-NE4102', exp: '2026-12-15', stock: 4, par: 4, unit: 'amp', status: 'ใกล้หมดอายุ (Exp < 45 วัน)' },
      { id: 'cd-7', code: 'HAD-04', name: 'Adrenaline (Epinephrine 1:1000 1mg)', category: 'Emergency Drug', lot: 'LOT-AD9041', exp: '2027-10-15', stock: 15, par: 15, unit: 'amp', status: 'ตรงตาม Par' },
      { id: 'cd-8', code: 'HAD-05', name: 'Atropine Sulfate 0.6 mg / 1ml', category: 'Emergency Drug', lot: 'LOT-AT6190', exp: '2027-09-01', stock: 10, par: 10, unit: 'amp', status: 'ตรงตาม Par' },
    ];
    return list;
  }, []);

  // Equipment Calibration Dataset
  const equipmentCalibrations = useMemo(() => {
    return [
      { code: 'EQ-ANES-001', sap: '7400-0192-01', name: 'เครื่องดมยาสลบพร้อมเครื่องช่วยหายใจ (Anesthesia Workstation)', model: 'Dräger Perseus A500', loc: 'ห้องผ่าตัด OR 1', lastCal: '2026-05-10', nextCal: '2027-05-10', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'บ. ดราเกอร์ เมดิคอล' },
      { code: 'EQ-ANES-002', sap: '7400-0192-02', name: 'เครื่องดมยาสลบพร้อมเครื่องช่วยหายใจ (Anesthesia Workstation)', model: 'GE Healthcare Aisys CS2', loc: 'ห้องผ่าตัด OR 2', lastCal: '2026-06-15', nextCal: '2027-06-15', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'บ. ยีอี เฮลธ์แคร์' },
      { code: 'EQ-DEFIB-01', sap: '7400-0834-01', name: 'เครื่องกระตุกไฟฟ้าหัวใจชนิดไบเฟสิค (Biphasic Defibrillator)', model: 'Zoll R Series Plus', loc: 'รถฉุกเฉิน Crash Cart OR', lastCal: '2026-08-01', nextCal: '2027-08-01', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'งานวิศวกรรมการแพทย์ รพ.' },
      { code: 'EQ-MON-001', sap: '7400-0452-01', name: 'เครื่องเฝ้าระวังสัญญาณชีพระหว่างผ่าตัด (Multiparameter Monitor)', model: 'Mindray BeneVision N17', loc: 'ห้องผ่าตัด OR 1', lastCal: '2026-04-12', nextCal: '2027-04-12', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'งานวิศวกรรมการแพทย์ รพ.' },
      { code: 'EQ-PUMP-001', sap: '7400-0612-01', name: 'เครื่องให้สารละลายทางหลอดเลือดดำ (Infusion Pump)', model: 'Terumo TE-171', loc: 'ตู้พักฟื้น PACU', lastCal: '2026-07-20', nextCal: '2027-07-20', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'งานวิศวกรรมการแพทย์ รพ.' },
      { code: 'EQ-SYR-001', sap: '7400-0720-01', name: 'เครื่องให้ยาควบคุมปริมาณอัตโนมัติ (TCI Syringe Pump)', model: 'B.Braun Perfusor Space', loc: 'ห้องผ่าตัด OR 1', lastCal: '2026-03-18', nextCal: '2027-03-18', status: 'ผ่านเกณฑ์ (พร้อมใช้งาน)', engineer: 'บ. บี.บราวน์' },
      { code: 'EQ-VAP-001', sap: '7400-0901-01', name: 'หม้อต้มยาสลบ Sevoflurane Vaporizer', model: 'Vapor 2000', loc: 'ห้องผ่าตัด OR 1', lastCal: '2026-02-14', nextCal: '2027-02-14', status: 'รอการสอบเทียบประจำปี', engineer: 'ศูนย์เครื่องมือแพทย์' },
    ];
  }, []);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchAction = auditFilterAction === 'all' || log.action === auditFilterAction;
      const matchSearch =
        !auditSearchQuery.trim() ||
        log.userName?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.action?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.targetId?.toLowerCase().includes(auditSearchQuery.toLowerCase());
      return matchAction && matchSearch;
    });
  }, [auditLogs, auditFilterAction, auditSearchQuery]);

  const shiftLabel = selectedShift === 'morning' ? 'เวรเช้า (08:00 - 16:00 น.)' :
                     selectedShift === 'afternoon' ? 'เวรบ่าย (16:00 - 24:00 น.)' :
                     selectedShift === 'night' ? 'เวรดึก (24:00 - 08:00 น.)' : 'ทุกผลัดเวร';

  // Excel Export Handler
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Daily Cart Check Sheet
      const cartRows = dailyCartChecklist.map((item, idx) => ({
        ลำดับ: idx + 1,
        หมวดหมู่: item.cat,
        รายการตรวจเช็ค: item.name,
        เกณฑ์มาตรฐาน: item.std,
        ผลการตรวจ: item.result,
        รายละเอียดผลตรวจ: item.note,
        วันที่ตรวจ: selectedDate,
        เวร: shiftLabel,
        ผู้ตรวจ: inspectorName,
        หัวหน้าวอร์ด: wardHeadName,
      }));
      const ws1 = XLSX.utils.json_to_sheet(cartRows);
      ws1['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 38 }, { wch: 36 }, { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Daily_Cart_Check');

      // Sheet 2: Controlled Drugs & Expiry
      const drugRows = controlledAndExpiryDrugs.map((item, idx) => ({
        ลำดับ: idx + 1,
        รหัสยา: item.code,
        ชื่อยาและสารน้ำ: item.name,
        กลุ่มยา: item.category,
        Lot_Batch: item.lot,
        วันหมดอายุ: item.exp,
        ยอดคงเหลือจริง: item.stock,
        เกณฑ์Par: item.par,
        หน่วย: item.unit,
        สถานะการประเมิน: item.status,
      }));
      const ws2 = XLSX.utils.json_to_sheet(drugRows);
      ws2['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 38 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 26 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Controlled_Drugs_Log');

      // Sheet 3: Equipment Calibration
      const eqRows = equipmentCalibrations.map((item, idx) => ({
        ลำดับ: idx + 1,
        รหัสครุภัณฑ์: item.code,
        รหัสSAP: item.sap,
        ชื่อเครื่องมือแพทย์: item.name,
        รุ่น_ยี่ห้อ: item.model,
        สถานที่ตั้ง: item.loc,
        วันที่สอบเทียบล่าสุด: item.lastCal,
        รอบสอบเทียบถัดไป: item.nextCal,
        สถานะความพร้อม: item.status,
        ผู้ดูแล_วิศวกร: item.engineer,
      }));
      const ws3 = XLSX.utils.json_to_sheet(eqRows);
      ws3['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 38 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Equipment_Calibration');

      // Sheet 4: Activity Log / Audit Trail
      const logRows = auditLogs.slice(0, 100).map((log, idx) => ({
        ลำดับ: idx + 1,
        วันเวลา_Timestamp: log.timestamp,
        ผู้ใช้งาน: log.userName,
        บทบาท_Role: log.role,
        รหัสคำสั่ง_Action: log.action,
        ตารางเป้าหมาย: log.targetCollection,
        รหัสอ้างอิง: log.targetId,
        รายละเอียด: JSON.stringify(log.details || {}),
        IP_Address: log.ipAddress || '-',
      }));
      const ws4 = XLSX.utils.json_to_sheet(logRows);
      ws4['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 45 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Audit_Trail_Log');

      const fileName = `HA_JCI_Audit_Report_${selectedDate}_${selectedShift}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // Audit Log on Export
      await logAuditEvent({
        action: 'EXPORT_EXCEL',
        targetCollection: 'reports',
        targetId: fileName,
        details: {
          reportType: activeTab,
          selectedDate,
          selectedShift,
          sheetsCount: 4,
          fileType: 'xlsx',
        },
        currentUser,
      });

      setNotificationMsg('✓ ส่งออกไฟล์ Excel มาตรฐาน HA/JCI สำเร็จเรียบร้อย');
      setTimeout(() => setNotificationMsg(''), 4000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Print / Print Preview Handler
  const handlePrintPdf = async () => {
    if (!printFrameRef.current) return;
    setIsExporting(true);

    try {
      const doc = printFrameRef.current.contentDocument || printFrameRef.current.contentWindow?.document;
      if (!doc) return;

      const printHtml = generateHaPrintHtml({
        tab: activeTab,
        selectedDate,
        shiftLabel,
        inspectorName,
        wardHeadName,
        cartSealNo,
        wardName: activeChannelName,
        cartItems: dailyCartChecklist,
        drugItems: controlledAndExpiryDrugs,
        equipmentItems: equipmentCalibrations,
        auditLogs: auditLogs.slice(0, 50),
      });

      doc.open();
      doc.write(printHtml);
      doc.close();

      setTimeout(async () => {
        printFrameRef.current?.contentWindow?.focus();
        printFrameRef.current?.contentWindow?.print();

        // Record Audit Trail for PDF Export
        await logAuditEvent({
          action: 'EXPORT_HA_REPORT',
          targetCollection: 'reports',
          targetId: `HA_A4_PRINT_${activeTab}`,
          details: {
            reportType: activeTab,
            selectedDate,
            selectedShift,
            wardName: activeChannelName,
            inspectorName,
            wardHeadName,
          },
          currentUser,
        });

        setIsExporting(false);
      }, 500);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเตรียมพิมพ์ PDF: ' + err.message);
      setIsExporting(false);
    }
  };

  // FHIR Webhook Simulation Test Handler
  const handleSimulateFhir = async () => {
    setIsSimulatingFhir(true);
    setFhirSimStatus(null);
    try {
      const payload: FhirMedicationDispensePayload = {
        resourceType: 'MedicationDispense',
        id: `disp-sim-${Date.now().toString(36)}`,
        status: 'completed',
        medicationCodeableConcept: {
          coding: [{
            system: 'https://standard.moph.go.th/tmt',
            code: 'TMT-59421',
            display: fhirSimDrug,
          }],
          text: fhirSimDrug,
        },
        subject: {
          reference: `Patient/${fhirSimPatientHn}`,
          display: `ผู้ป่วยฉุกเฉิน (${fhirSimPatientHn})`,
        },
        context: {
          display: activeChannelName || 'ห้องผ่าตัด OR 1',
        },
        performer: [{
          actor: {
            display: fhirSimDoctor,
          },
        }],
        quantity: {
          value: fhirSimQty,
          unit: 'amp',
        },
        whenHandedOver: new Date().toISOString(),
        note: [{ text: 'ทดสอบการส่ง Webhook ตัดสต็อกอัตโนมัติจากระบบ HIS (HL7 FHIR R4)' }],
      };

      const res = await fetch('/api/fhir/MedicationDispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setFhirSimStatus(data);

      // Refresh Audit Trail
      const updated = await fetchHaAuditLogs(50);
      setAuditLogs(updated);

      setNotificationMsg('✓ จำลองคำสั่งเบิกจ่าย HL7 FHIR และตัดสต็อกบันทึกลง Audit Trail สำเร็จ');
      setTimeout(() => setNotificationMsg(''), 4000);
    } catch (err: any) {
      setFhirSimStatus({ error: err.message });
    } finally {
      setIsSimulatingFhir(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-[#1C1E24] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide">HA / JCI Audit Export & Activity Trail</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 border border-white/30 text-white">
                  v2026 Standards
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                ระบบออกรายงานมาตรฐานรับรองโรงพยาบาล พร้อม Append-Only Audit Trail และ HL7 FHIR Bridge
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notificationMsg && (
          <div className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg('')} className="text-white hover:text-emerald-100">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-white/10 overflow-x-auto bg-slate-50 dark:bg-[#181A20] px-3 pt-2 shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('daily_cart')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'daily_cart'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 bg-white dark:bg-[#1C1E24] rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>1. Daily Crash Cart (เช้า-บ่าย-ดึก)</span>
          </button>

          <button
            onClick={() => setActiveTab('controlled_drugs')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'controlled_drugs'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 bg-white dark:bg-[#1C1E24] rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. Controlled Drug & Expiry Log</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment_calibration')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'equipment_calibration'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 bg-white dark:bg-[#1C1E24] rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>3. Equipment Calibration</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_trail')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'audit_trail'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 bg-white dark:bg-[#1C1E24] rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>4. 🛡️ Activity Log / Audit Trail ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fhir_bridge')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'fhir_bridge'
                ? 'border-blue-600 text-blue-600 dark:text-cyan-400 bg-white dark:bg-[#1C1E24] rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>5. 🔗 HIS / EMR Bridge (HL7 FHIR)</span>
          </button>
        </div>

        {/* Filter Controls Bar (For tabs 1-3) */}
        {(activeTab === 'daily_cart' || activeTab === 'controlled_drugs' || activeTab === 'equipment_calibration') && (
          <div className="p-3 sm:p-4 bg-slate-100/70 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#242526] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold text-slate-500">วันที่:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-bold outline-none cursor-pointer"
                />
              </div>

              {activeTab === 'daily_cart' && (
                <div className="flex items-center gap-1.5 bg-white dark:bg-[#242526] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-bold text-slate-500">ผลัดเวร:</span>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="bg-transparent font-bold outline-none cursor-pointer"
                  >
                    <option value="morning">เวรเช้า (08:00 - 16:00 น.)</option>
                    <option value="afternoon">เวรบ่าย (16:00 - 24:00 น.)</option>
                    <option value="night">เวรดึก (24:00 - 08:00 น.)</option>
                    <option value="all">ทุกผลัดเวร</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-white dark:bg-[#242526] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                <Building className="w-3.5 h-3.5 text-cyan-500" />
                <span className="font-bold text-slate-500">วอร์ด:</span>
                <span className="font-bold text-slate-800 dark:text-cyan-200">{activeChannelName}</span>
              </div>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintPdf}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ / ออก PDF A4</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ส่งออก Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Main Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: Daily Crash Cart Check Sheet */}
          {activeTab === 'daily_cart' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-blue-900 dark:text-cyan-300">แบบฟอร์มตรวจสอบรถพยาบาล / รถตู้ยาฉุกเฉินประจำวัน (HA/JCI Daily Crash Cart)</h4>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    ตรวจสอบความพร้อมใช้ทุกผลัดเวรเพื่อรับรองมาตรฐานความปลอดภัยของผู้ป่วย (Patient Safety Goals: CPR Ready)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300">เลขซีลล็อค (Seal No.):</span>
                  <input
                    type="text"
                    value={cartSealNo}
                    onChange={(e) => setCartSealNo(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#242526] font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#242526] text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="p-3 w-12 text-center">ลำดับ</th>
                      <th className="p-3 w-36">หมวดหมู่</th>
                      <th className="p-3">รายการตรวจเช็ค</th>
                      <th className="p-3 w-48">เกณฑ์มาตรฐาน HA/JCI</th>
                      <th className="p-3 w-28 text-center">ผลการตรวจ</th>
                      <th className="p-3 w-48">บันทึกค่าที่วัดได้ / รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {dailyCartChecklist.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                        <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-blue-600 dark:text-cyan-400">{item.cat}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{item.std}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{item.result}</span>
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures Block Preview */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181A20] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-[#242526] border border-slate-200 dark:border-white/5 space-y-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">ผู้รับผิดชอบการตรวจเช็ค (Inspector)</span>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full bg-transparent font-bold outline-none border-b border-dashed border-slate-300 dark:border-white/20 pb-0.5"
                      placeholder="ลงชื่อพยาบาลผู้ตรวจ"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">ตำแหน่ง: พยาบาลวิสัญญีประจำเวร • วันที่ {selectedDate} ({shiftLabel})</div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#242526] border border-slate-200 dark:border-white/5 space-y-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">หัวหน้าวอร์ด / ผู้รับรอง (Ward Supervisor / Witness)</span>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <input
                      type="text"
                      value={wardHeadName}
                      onChange={(e) => setWardHeadName(e.target.value)}
                      className="w-full bg-transparent font-bold outline-none border-b border-dashed border-slate-300 dark:border-white/20 pb-0.5"
                      placeholder="ลงชื่อหัวหน้าวอร์ด"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">ตำแหน่ง: พยาบาลวิชาชีพชำนาญการพิเศษ / หัวหน้ากลุ่มงานวิสัญญีวิทยา</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Controlled Drug & Expiry Log */}
          {activeTab === 'controlled_drugs' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-300">รายงานการตรวจสอบยาเสพติดให้โทษ, ยาควบคุมพิเศษ และยาใกล้หมดอายุประจำเดือน</h4>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    ตรวจสอบยอดคงคลัง Double-Check สองบุคคลทุกเดือนตามข้อกำหนดพรบ.ยาเสพติดและมาตรฐาน JCI Medication Management (MMU)
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Double Sign-off Required</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#242526] text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="p-3 w-12 text-center">ลำดับ</th>
                      <th className="p-3 w-28">รหัสยา</th>
                      <th className="p-3">ชื่อยาและขนาดความแรง</th>
                      <th className="p-3 w-32">ประเภท</th>
                      <th className="p-3 w-28">Lot / Batch</th>
                      <th className="p-3 w-28">วันหมดอายุ</th>
                      <th className="p-3 w-20 text-center">คงเหลือ</th>
                      <th className="p-3 w-20 text-center">Par Level</th>
                      <th className="p-3 w-36">สถานะการประเมิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {controlledAndExpiryDrugs.map((item, idx) => {
                      const isWarning = item.status.includes('ใกล้หมดอายุ');
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-slate-500">{item.code}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.lot}</td>
                          <td className="p-3 font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{item.exp}</td>
                          <td className="p-3 text-center font-bold text-blue-600 dark:text-cyan-400">{item.stock} {item.unit}</td>
                          <td className="p-3 text-center font-bold text-slate-500">{item.par}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isWarning
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            }`}>
                              {isWarning ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                              <span>{item.status}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Equipment Calibration Record */}
          {activeTab === 'equipment_calibration' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-300">ประวัติการตรวจสอบสภาพความพร้อมและการสอบเทียบเครื่องมือแพทย์ (Medical Equipment Calibration)</h4>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    บันทึกประวัติการบำรุงรักษาเชิงป้องกัน (Preventive Maintenance - PM) และรอบสอบเทียบประจำปีตามมาตรฐาน HA/JCI FMS
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>PM Calibration Tracker</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#242526] text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="p-3 w-12 text-center">ลำดับ</th>
                      <th className="p-3 w-28">รหัสครุภัณฑ์</th>
                      <th className="p-3">ชื่อเครื่องมือแพทย์</th>
                      <th className="p-3 w-36">ยี่ห้อ / รุ่น</th>
                      <th className="p-3 w-32">สถานที่ตั้ง</th>
                      <th className="p-3 w-28">สอบเทียบล่าสุด</th>
                      <th className="p-3 w-28">รอบถัดไป</th>
                      <th className="p-3 w-36">สถานะความพร้อม</th>
                      <th className="p-3 w-36">ผู้รับผิดชอบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {equipmentCalibrations.map((item, idx) => {
                      const isPending = item.status.includes('รอการสอบเทียบ');
                      return (
                        <tr key={item.code} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-300">{item.code}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{item.model}</td>
                          <td className="p-3 text-slate-500">{item.loc}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.lastCal}</td>
                          <td className="p-3 font-mono font-bold text-[11px] text-blue-600 dark:text-cyan-400">{item.nextCal}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            }`}>
                              {isPending ? <Clock className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                              <span>{item.status}</span>
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">{item.engineer}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Activity Log / Audit Trail (Append-Only) */}
          {activeTab === 'audit_trail' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-purple-900 dark:text-purple-300">ระบบบันทึกประวัติความปลอดภัยแบบอ่านอย่างเดียว (Append-Only Audit Trail)</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 dark:bg-purple-500/30 text-purple-800 dark:text-purple-300">
                      Immutable Ledger
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    จัดเก็บใน Firestore Collection `audit_logs` ห้ามแก้ไขหรือลบย้อนหลัง เพื่อใช้ในการสอบทานเมื่อเกิดเหตุไม่พึงประสงค์ (Incident Analysis)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setIsLoadingLogs(true);
                      const l = await fetchHaAuditLogs(100);
                      setAuditLogs(l);
                      setIsLoadingLogs(false);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-[#242526] border border-slate-200 dark:border-white/10 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition active:scale-95 cursor-pointer shadow-xs"
                    title="โหลดข้อมูลล่าสุด"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Audit Search & Action Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-[#181A20] p-3 rounded-2xl border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2 bg-white dark:bg-[#242526] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อผู้ปฏิบัติงาน, รหัสคำสั่ง หรือรายละเอียด..."
                    className="bg-transparent outline-none w-full text-xs"
                  />
                  {auditSearchQuery && (
                    <button onClick={() => setAuditSearchQuery('')} className="text-slate-400 hover:text-slate-600">✕</button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-500">ประเภทเหตุการณ์:</span>
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="bg-white dark:bg-[#242526] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 font-bold outline-none cursor-pointer"
                  >
                    <option value="all">ทั้งหมด (All Events)</option>
                    <option value="UPDATE_DRUG_STOCK">UPDATE_DRUG_STOCK (แก้ไขยอดคลังยา)</option>
                    <option value="FHIR_MEDICATION_DISPENSE">FHIR_MEDICATION_DISPENSE (เบิกยาผ่าน HIS)</option>
                    <option value="DEFECTIVE_FLAG">DEFECTIVE_FLAG (แจ้งของชำรุด/มีปัญหา)</option>
                    <option value="ROLE_CHANGE">ROLE_CHANGE (เปลี่ยนสิทธิ์ผู้ใช้)</option>
                    <option value="EXPORT_HA_REPORT">EXPORT_HA_REPORT (ส่งออกรายงาน)</option>
                    <option value="EXPORT_EXCEL">EXPORT_EXCEL (ส่งออกไฟล์ Excel)</option>
                  </select>
                </div>
              </div>

              {/* Audit Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#242526] text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-40">วันเวลา (Timestamp)</th>
                      <th className="p-3 w-44">ผู้ดำเนินการ (User)</th>
                      <th className="p-3 w-48">เหตุการณ์ (Action)</th>
                      <th className="p-3 w-32">เป้าหมาย (Target)</th>
                      <th className="p-3">รายละเอียด (Details)</th>
                      <th className="p-3 w-28">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          {isLoadingLogs ? 'กำลังโหลดข้อมูล Audit Trail จาก Firestore...' : 'ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก'}
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => {
                        const isFhir = log.action === 'FHIR_MEDICATION_DISPENSE';
                        const isStock = log.action === 'UPDATE_DRUG_STOCK';
                        const isDefective = log.action === 'DEFECTIVE_FLAG';
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                            <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : '-'}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{log.userName}</div>
                              <div className="text-[10px] text-slate-400">{log.role}</div>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                                isFhir ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300' :
                                isStock ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' :
                                isDefective ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300' :
                                'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {log.targetCollection}/{log.targetId}
                            </td>
                            <td className="p-3 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                              {JSON.stringify(log.details || {})}
                            </td>
                            <td className="p-3 font-mono text-[10px] text-slate-400">{log.ipAddress || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HIS / EMR Integration Bridge (HL7 FHIR & Webhook) */}
          {activeTab === 'fhir_bridge' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-cyan-900 dark:text-cyan-300">HIS / EMR Integration Bridge (HL7 FHIR Release 4 & Webhook Service)</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-200 dark:bg-cyan-500/30 text-cyan-800 dark:text-cyan-300">
                      Auto-Deduction Engine
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    รองรับการเชื่อมต่อกับระบบสารสนเทศโรงพยาบาล (HOSxP, Infostat, Smart Hospital) เพื่อตัดสต็อกยาฉุกเฉินและเตือนเมื่อสต็อกต่ำกว่า Par Level อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Endpoint Guide Box */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181A20] space-y-2 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">FHIR RESTful Endpoints สำหรับฝ่ายเทคโนโลยีสารสนเทศ (Hospital IT)</span>
                
                <div className="p-3 rounded-xl bg-white dark:bg-[#242526] border border-slate-200 dark:border-white/5 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-bold text-[9px]">POST</span>
                    <span className="text-blue-600 dark:text-cyan-400 font-bold">/api/fhir/MedicationDispense</span>
                    <span className="text-slate-400 text-[10px]">• HL7 FHIR Standard Payload</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-bold text-[9px]">POST</span>
                    <span className="text-blue-600 dark:text-cyan-400 font-bold">/api/fhir/StockDeduction</span>
                    <span className="text-slate-400 text-[10px]">• Simplified JSON Webhook สำหรับ HOSxP/Infostat</span>
                  </div>
                </div>
              </div>

              {/* Interactive Live Simulator */}
              <div className="p-4 sm:p-5 rounded-2xl border border-cyan-200 dark:border-cyan-500/30 bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/50 dark:from-cyan-950/20 dark:via-[#1C1E24] dark:to-blue-950/20 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h4 className="text-sm font-black text-slate-800 dark:text-cyan-200">
                    เครื่องมือจำลองการส่งข้อมูลจากระบบ HIS (Live Webhook Simulator)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">ชนิดยาที่เบิกจาก HIS:</label>
                    <select
                      value={fhirSimDrug}
                      onChange={(e) => setFhirSimDrug(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#242526] font-bold outline-none cursor-pointer"
                    >
                      <option value="Atropine 0.6 mg / ml">Atropine 0.6 mg / ml</option>
                      <option value="Adrenaline 1 mg / ml">Adrenaline 1 mg / ml</option>
                      <option value="Amiodarone 150 mg / 3ml">Amiodarone 150 mg / 3ml</option>
                      <option value="Midazolam 5 mg / ml">Midazolam 5 mg / ml</option>
                      <option value="Sodium Bicarbonate 7.5% 50ml">Sodium Bicarbonate 7.5%</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">จำนวนที่สั่งเบิก:</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={fhirSimQty}
                      onChange={(e) => setFhirSimQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#242526] font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">HN ผู้ป่วย:</label>
                    <input
                      type="text"
                      value={fhirSimPatientHn}
                      onChange={(e) => setFhirSimPatientHn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#242526] font-mono font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">แพทย์ผู้สั่งเบิก:</label>
                    <input
                      type="text"
                      value={fhirSimDoctor}
                      onChange={(e) => setFhirSimDoctor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#242526] font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSimulateFhir}
                    disabled={isSimulatingFhir}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black flex items-center gap-2 shadow-lg shadow-cyan-600/20 active:scale-95 transition cursor-pointer disabled:opacity-50 text-xs"
                  >
                    <Send className={`w-4 h-4 ${isSimulatingFhir ? 'animate-bounce' : ''}`} />
                    <span>{isSimulatingFhir ? 'กำลังประมวลผลตัดสต็อก...' : 'ส่งคำสั่งจำลองเบิกยา (Trigger Webhook)'}</span>
                  </button>
                </div>

                {/* Simulation Result */}
                {fhirSimStatus && (
                  <div className="p-3.5 rounded-xl bg-slate-900 text-cyan-300 font-mono text-xs overflow-x-auto space-y-2 border border-cyan-500/30">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>HL7 FHIR MedicationDispense Response:</span>
                      <span className="text-emerald-400">HTTP 201 Created</span>
                    </div>
                    <pre className="text-[11px] leading-relaxed">
                      {JSON.stringify(fhirSimStatus, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hidden Iframe for Standard A4 Official PDF Printing */}
        <iframe
          ref={printFrameRef}
          style={{ position: 'absolute', width: 0, height: 0, border: 0, visibility: 'hidden' }}
          title="HA_JCI_Print_Frame"
        />
      </div>
    </div>
  );
};

/**
 * Generates an official, formal Government/Healthcare A4 Document layout with Thai Emblem / Garudas
 */
function generateHaPrintHtml(params: {
  tab: HaReportType;
  selectedDate: string;
  shiftLabel: string;
  inspectorName: string;
  wardHeadName: string;
  cartSealNo: string;
  wardName: string;
  cartItems: any[];
  drugItems: any[];
  equipmentItems: any[];
  auditLogs: any[];
}): string {
  const { tab, selectedDate, shiftLabel, inspectorName, wardHeadName, cartSealNo, wardName, cartItems, drugItems, equipmentItems } = params;

  let tableContent = '';
  let reportTitle = '';
  let subTitle = '';

  if (tab === 'daily_cart') {
    reportTitle = 'รายงานการตรวจสอบรถพยาบาลและรถตู้ยาฉุกเฉินประจำวัน (Daily Emergency Crash Cart Check Sheet)';
    subTitle = `หน่วยงาน/หอผู้ป่วย: ${wardName} • ประจำวันที่: ${selectedDate} • ผลัดเวร: ${shiftLabel} • หมายเลขซีล: ${cartSealNo}`;
    tableContent = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">ลำดับ</th>
            <th style="width: 140px;">หมวดหมู่</th>
            <th>รายการตรวจสอบ</th>
            <th style="width: 200px;">เกณฑ์มาตรฐาน (HA/JCI)</th>
            <th style="width: 80px; text-align: center;">ผลการตรวจ</th>
            <th style="width: 150px;">บันทึกผลการตรวจ</th>
          </tr>
        </thead>
        <tbody>
          ${cartItems.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td style="font-weight: bold;">${item.cat}</td>
              <td>${item.name}</td>
              <td style="color: #4b5563;">${item.std}</td>
              <td style="text-align: center; font-weight: bold; color: #047857;">✓ ${item.result}</td>
              <td style="font-family: monospace;">${item.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (tab === 'controlled_drugs') {
    reportTitle = 'รายงานการตรวจสอบยาเสพติดให้โทษ ยาควบคุมพิเศษ และยาใกล้หมดอายุประจำเดือน (Controlled Drugs & Expiry Log)';
    subTitle = `หน่วยงาน: กลุ่มงานวิสัญญีวิทยา / ${wardName} • ประจำเดือน: ${selectedDate}`;
    tableContent = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">ลำดับ</th>
            <th style="width: 90px;">รหัสยา</th>
            <th>ชื่อยาและขนาดความแรง</th>
            <th style="width: 110px;">กลุ่มยา</th>
            <th style="width: 100px;">Lot/Batch</th>
            <th style="width: 90px;">วันหมดอายุ</th>
            <th style="width: 60px; text-align: center;">คงเหลือ</th>
            <th style="width: 60px; text-align: center;">Par</th>
            <th style="width: 120px;">สถานะการประเมิน</th>
          </tr>
        </thead>
        <tbody>
          ${drugItems.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td style="font-family: monospace;">${item.code}</td>
              <td style="font-weight: bold;">${item.name}</td>
              <td>${item.category}</td>
              <td style="font-family: monospace;">${item.lot}</td>
              <td style="font-family: monospace; font-weight: bold;">${item.exp}</td>
              <td style="text-align: center; font-weight: bold;">${item.stock} ${item.unit}</td>
              <td style="text-align: center;">${item.par}</td>
              <td style="font-weight: bold; color: ${item.status.includes('ใกล้หมดอายุ') ? '#b91c1c' : '#047857'};">
                ${item.status}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    reportTitle = 'ประวัติการตรวจสอบสภาพความพร้อมและการสอบเทียบเครื่องมือแพทย์ (Medical Equipment Calibration Record)';
    subTitle = `กลุ่มงานวิสัญญีวิทยา / งานวิศวกรรมชีวการแพทย์ • ประจำปี: 2026-2027`;
    tableContent = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">ลำดับ</th>
            <th style="width: 100px;">รหัสครุภัณฑ์</th>
            <th>ชื่อเครื่องมือแพทย์</th>
            <th style="width: 120px;">ยี่ห้อ/รุ่น</th>
            <th style="width: 90px;">สถานที่ตั้ง</th>
            <th style="width: 80px;">สอบเทียบล่าสุด</th>
            <th style="width: 80px;">รอบถัดไป</th>
            <th style="width: 120px;">สถานะความพร้อม</th>
            <th style="width: 120px;">ผู้ดูแล/วิศวกร</th>
          </tr>
        </thead>
        <tbody>
          ${equipmentItems.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td style="font-family: monospace; font-weight: bold;">${item.code}</td>
              <td style="font-weight: bold;">${item.name}</td>
              <td>${item.model}</td>
              <td>${item.loc}</td>
              <td style="font-family: monospace;">${item.lastCal}</td>
              <td style="font-family: monospace; font-weight: bold; color: #1d4ed8;">${item.nextCal}</td>
              <td style="font-weight: bold; color: #047857;">${item.status}</td>
              <td>${item.engineer}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        body {
          font-family: 'Sarabun', 'TH Sarabun New', -apple-system, sans-serif;
          color: #111827;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.4;
        }
        .header-container {
          text-align: center;
          margin-bottom: 15px;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 10px;
        }
        .emblem-svg {
          width: 50px;
          height: 50px;
          margin: 0 auto 6px auto;
          display: block;
        }
        .org-name {
          font-size: 17px;
          font-weight: bold;
          color: #1e3a8a;
          letter-spacing: -0.2px;
        }
        .doc-title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
        }
        .doc-sub {
          font-size: 12px;
          color: #4b5563;
          margin-top: 2px;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11.5px;
        }
        .report-table th, .report-table td {
          border: 1px solid #d1d5db;
          padding: 5px 7px;
          vertical-align: middle;
        }
        .report-table th {
          background-color: #f3f4f6;
          font-weight: bold;
          color: #1f2937;
        }
        .sign-container {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        .sign-box {
          width: 45%;
          text-align: center;
          font-size: 12px;
        }
        .sign-line {
          margin-top: 45px;
          border-bottom: 1px dashed #6b7280;
          margin-bottom: 6px;
        }
        .footer-note {
          margin-top: 25px;
          font-size: 10px;
          color: #6b7280;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          padding-top: 6px;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <!-- Thai Public Health Medical Seal Emblem -->
        <svg class="emblem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" stroke="#1E3A8A" stroke-width="4" fill="#EFF6FF"/>
          <path d="M50 20 L50 80 M20 50 L80 50" stroke="#1E3A8A" stroke-width="8" stroke-linecap="round"/>
          <circle cx="50" cy="50" r="14" fill="#2563EB"/>
        </svg>
        <div class="org-name">โรงพยาบาลศูนย์การแพทย์วิสัญญีวิทยา (Ministry of Public Health)</div>
        <div class="doc-title">${reportTitle}</div>
        <div class="doc-sub">${subTitle}</div>
      </div>

      ${tableContent}

      <div class="sign-container">
        <div class="sign-box">
          <div>ลงชื่อ ................................................................</div>
          <div style="font-weight: bold; margin-top: 4px;">(${inspectorName})</div>
          <div>ผู้ตรวจสอบประจำเวร / พยาบาลวิสัญญี</div>
          <div style="color: #6b7280; font-size: 10px; margin-top: 2px;">วันที่ ......../......../............ เวลา ........:........ น.</div>
        </div>

        <div class="sign-box">
          <div>ลงชื่อ ................................................................</div>
          <div style="font-weight: bold; margin-top: 4px;">(${wardHeadName})</div>
          <div>หัวหน้ากลุ่มงานวิสัญญีวิทยา / ผู้รับรองผล</div>
          <div style="color: #6b7280; font-size: 10px; margin-top: 2px;">วันที่ ......../......../............ เวลา ........:........ น.</div>
        </div>
      </div>

      <div class="footer-note">
        เอกสารนี้จัดพิมพ์ขึ้นจากระบบอัตโนมัติ Anesthesia Care ผ่านการตรวจสอบและบันทึกรหัสตรวจสอบความถูกต้อง (SHA-256 Audit Ledger) ตามมาตรฐาน HA / JCI MMU.
      </div>
    </body>
    </html>
  `;
}
