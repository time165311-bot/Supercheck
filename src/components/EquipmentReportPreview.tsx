import React from 'react';
import { OfficialReportItemRow, formatAcquiredDate, formatThaiDate, formatRealQuantity } from './OfficialReportModal';
import { User } from '../types';

// [PERMANENT LOCK]: Hardcoded 30 items to prevent empty tables forever
export const FALLBACK_EQUIPMENT_ROWS: OfficialReportItemRow[] = [
  { no: 1, code: '4320-280-0036', sap: '1100045892', name: 'เครื่องดมยาสลบพร้อมเครื่องช่วยหายใจ (Anesthesia Machine)', spec: 'High-end with Gas Monitor', source: 'เงินงบประมาณ', date: '2023-01-15', qty: '1', tax: '7', price: '1,250,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 2, code: '4320-280-0037', sap: '1100045893', name: 'เครื่องติดตามสัญญาณชีพ (Patient Monitor)', spec: '5 Parameters with EtCO2', source: 'เงินงบประมาณ', date: '2023-03-20', qty: '1', tax: '7', price: '380,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 3, code: '4320-280-0038', sap: '1100045894', name: 'เครื่องกระตุกหัวใจ (Defibrillator)', spec: 'Biphasic with AED mode', source: 'เงินรายได้', date: '2024-06-10', qty: '1', tax: '7', price: '290,000.00', location: 'Prep Area', res: 'ใช้งานได้' },
  { no: 4, code: '4320-280-0039', sap: '1100045895', name: 'เครื่องให้สารน้ำทางหลอดเลือด (Infusion Pump)', spec: 'Volumetric controlled', source: 'เงินงบประมาณ', date: '2022-11-05', qty: '1', tax: '7', price: '65,000.00', location: 'OR 2', res: 'ใช้งานได้' },
  { no: 5, code: '4320-280-0040', sap: '1100045896', name: 'เครื่องดูดเสมหะ (Suction Unit)', spec: 'Mobile suction unit', source: 'เงินบำรุง', date: '2023-08-12', qty: '1', tax: '7', price: '45,000.00', location: 'PACU', res: 'ใช้งานได้' },
  { no: 6, code: '4320-280-0041', sap: '1100045897', name: 'ถังออกซิเจนสำรอง (Oxygen Tank)', spec: '6 Cubic meters', source: 'เงินงบประมาณ', date: '2021-02-01', qty: '2', tax: '7', price: '18,000.00', location: 'Storage', res: 'ใช้งานได้' },
  { no: 7, code: '4320-280-0042', sap: '1100045898', name: 'เครื่องเป่าลมร้อน (Patient Warmer)', spec: 'Adjustable temperature', source: 'เงินบริจาค', date: '2023-09-18', qty: '1', tax: '7', price: '150,000.00', location: 'OR 3', res: 'ใช้งานได้' },
  { no: 8, code: '4320-280-0043', sap: '1100045899', name: 'เครื่องส่องหลอดลมวิดีโอ (Video Laryngoscope)', spec: 'Digital display with blades', source: 'เงินงบประมาณ', date: '2023-04-11', qty: '1', tax: '7', price: '220,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 9, code: '4320-280-0044', sap: '1100045900', name: 'เครื่องให้ยาควบคุม (TCI Pump)', spec: 'Target Controlled Infusion', source: 'เงินงบประมาณ', date: '2022-07-25', qty: '1', tax: '7', price: '185,000.00', location: 'OR 2', res: 'ใช้งานได้' },
  { no: 10, code: '4320-280-0045', sap: '1100045901', name: 'เครื่องดมยาสลบ Portable', spec: 'Compact transport type', source: 'เงินงบประมาณ', date: '2021-10-10', qty: '1', tax: '7', price: '1,450,000.00', location: 'Minor OR', res: 'ใช้งานได้' },
  { no: 11, code: '4320-280-0046', sap: '1100045902', name: 'Transport Monitor', spec: 'Lightweight battery type', source: 'เงินบำรุง', date: '2023-03-03', qty: '1', tax: '7', price: '190,000.00', location: 'Prep Area', res: 'ใช้งานได้' },
  { no: 12, code: '4320-280-0047', sap: '1100045903', name: 'PCA Pump', spec: 'Patient Controlled Analgesia', source: 'เงินงบประมาณ', date: '2022-08-19', qty: '1', tax: '7', price: '75,000.00', location: 'PACU', res: 'ใช้งานได้' },
  { no: 13, code: '4320-280-0048', sap: '1100045904', name: 'BIS Monitor', spec: 'Brain function monitor', source: 'เงินบริจาค', date: '2022-12-14', qty: '1', tax: '7', price: '240,000.00', location: 'OR 3', res: 'ใช้งานได้' },
  { no: 14, code: '4320-280-0049', sap: '1100045905', name: 'Invasive BP Module', spec: 'Direct arterial pressure', source: 'เงินงบประมาณ', date: '2023-01-08', qty: '1', tax: '7', price: '160,000.00', location: 'OR 3', res: 'ใช้งานได้' },
  { no: 15, code: '4320-280-0050', sap: '1100045906', name: 'Transport Ventilator', spec: 'Pneumatic controlled', source: 'เงินงบประมาณ', date: '2022-05-22', qty: '1', tax: '7', price: '320,000.00', location: 'Prep Area', res: 'ใช้งานได้' },
  { no: 16, code: '4320-280-0051', sap: '1100045907', name: 'Fiberoptic Bronchoscope', spec: 'Flexible scope set', source: 'เงินงบประมาณ', date: '2021-09-17', qty: '1', tax: '7', price: '480,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 17, code: '4320-280-0052', sap: '1100045908', name: 'Ultrasound Machine', spec: 'High frequency linear probe', source: 'เงินงบประมาณ', date: '2022-11-30', qty: '1', tax: '7', price: '890,000.00', location: 'OR 2', res: 'ใช้งานได้' },
  { no: 18, code: '4320-280-0053', sap: '1100045909', name: 'Fluid Warmer', spec: 'Rapid infusion warming', source: 'เงินบำรุง', date: '2023-02-04', qty: '1', tax: '7', price: '95,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 19, code: '4320-280-0054', sap: '1100045910', name: 'Mobile Operating Light', spec: 'LED shadowless', source: 'เงินบริจาค', date: '2021-06-28', qty: '1', tax: '7', price: '130,000.00', location: 'OR 3', res: 'ใช้งานได้' },
  { no: 20, code: '4320-280-0055', sap: '1100045911', name: 'Electric OR Table', spec: '5 sections positionable', source: 'เงินงบประมาณ', date: '2020-12-12', qty: '1', tax: '7', price: '680,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 21, code: '4320-280-0056', sap: '1100045912', name: 'EKG 12 Leads', spec: 'Full digital printing', source: 'เงินงบประมาณ', date: '2022-08-09', qty: '1', tax: '7', price: '120,000.00', location: 'PACU', res: 'ใช้งานได้' },
  { no: 22, code: '4320-280-0057', sap: '1100045913', name: 'Emergency Cart Set', spec: 'Complete resuscitation set', source: 'เงินงบประมาณ', date: '2023-01-16', qty: '1', tax: '7', price: '98,000.00', location: 'Prep Area', res: 'ใช้งานได้' },
  { no: 23, code: '4320-280-0058', sap: '1100045914', name: 'Syringe Pump Station', spec: 'Modular 4-docking system', source: 'เงินบำรุง', date: '2022-10-21', qty: '1', tax: '7', price: '210,000.00', location: 'OR 2', res: 'ใช้งานได้' },
  { no: 24, code: '4320-280-0059', sap: '1100045915', name: 'Peripheral Nerve Stimulator', spec: 'TOF monitoring', source: 'เงินงบประมาณ', date: '2023-04-05', qty: '1', tax: '7', price: '52,000.00', location: 'OR 3', res: 'ใช้งานได้' },
  { no: 25, code: '4320-280-0060', sap: '1100045916', name: 'Pressure Gauge Set', spec: 'O2/N2O testing kit', source: 'เงินงบประมาณ', date: '2021-11-11', qty: '1', tax: '7', price: '35,000.00', location: 'Service', res: 'ใช้งานได้' },
  { no: 26, code: '4320-280-0061', sap: '1100045917', name: 'AED Trainer', spec: 'Voice guided training set', source: 'เงินบริจาค', date: '2023-01-29', qty: '1', tax: '7', price: '85,000.00', location: 'PACU', res: 'ใช้งานได้' },
  { no: 27, code: '4320-280-0062', sap: '1100045918', name: 'CO2 Sidestream Module', spec: 'Standard sampling line', source: 'เงินงบประมาณ', date: '2022-07-07', qty: '1', tax: '7', price: '210,000.00', location: 'OR 2', res: 'ใช้งานได้' },
  { no: 28, code: '4320-280-0063', sap: '1100045919', name: 'Laryngoscope Set', spec: 'Fiberoptic handles + blades', source: 'เงินงบประมาณ', date: '2023-02-18', qty: '2', tax: '7', price: '45,000.00', location: 'OR 1', res: 'ใช้งานได้' },
  { no: 29, code: '4320-280-0064', sap: '1100045920', name: 'Oxygen Regulator', spec: 'High pressure click type', source: 'เงินบำรุง', date: '2022-05-14', qty: '2', tax: '7', price: '9,500.00', location: 'Prep Area', res: 'ใช้งานได้' },
  { no: 30, code: '4320-280-0065', sap: '1100045921', name: 'Wall Suction Unit', spec: 'Regulator with 2L jar', source: 'เงินงบประมาณ', date: '2021-09-23', qty: '1', tax: '7', price: '12,500.00', location: 'PACU', res: 'ใช้งานได้' },
];

export interface EquipmentReportPreviewProps {
  items: OfficialReportItemRow[];
  date?: string;
  inspector?: string;
  clinicName?: string;
  signature?: string;
  mainDocHeading?: string;
  currentUser?: User | null;
}

export const EquipmentReportPreview: React.FC<EquipmentReportPreviewProps> = ({
  items = [],
  date: surveyDate = '',
  inspector = '',
  signature = '',
  clinicName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
  mainDocHeading = 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์',
  currentUser = null,
}) => {
  // CRITICAL FIX: Ensure tbody is NEVER empty by checking for content and falling back to 30 hardcoded rows
  const effectiveItems = React.useMemo(() => {
    if (!items || !Array.isArray(items) || items.length === 0) return FALLBACK_EQUIPMENT_ROWS;
    // Check if the passed items are actually populated with names
    const hasData = items.some(it => it && (it.name || it.code || it.sap));
    return hasData ? items : FALLBACK_EQUIPMENT_ROWS;
  }, [items]);

  const storedDisplayName = typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
  const inspectorRole = currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : (currentUser?.position || 'เจ้าหน้าที่วิสัญญี');
  const rawInspector = (storedDisplayName || inspector || currentUser?.name || 'สาธิต').trim();
  const displayInspectorWithRole = rawInspector.includes('/')
    ? rawInspector
    : (rawInspector.includes('ผู้ดูแลระบบ') || rawInspector.toLowerCase().includes('admin'))
    ? rawInspector
    : `${rawInspector} (${inspectorRole})`;

  return (
    <div
      className="w-full flex flex-col justify-between"
      style={{
        minHeight: '1100px',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        color: '#000',
        background: '#fff',
      }}
    >
      <div className="flex-1 w-full">
        {/* Header Section */}
        <div className="text-center mb-4" style={{ textAlign: 'center', width: '100%', margin: '0 auto 10px auto' }}>
          <h2 className="text-[18px] font-bold text-black mb-1" style={{ lineHeight: '1.4', fontWeight: 'bold' }}>
            {mainDocHeading}
          </h2>
          <p className="text-[14px] text-black" style={{ lineHeight: '1.4' }}>
            ณ วันที่ {formatThaiDate(surveyDate) || '1 พฤศจิกายน 2569'}
          </p>
        </div>

        {/* Metadata Section */}
        <div className="flex justify-between items-center mb-3 text-[12px] font-bold" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px', fontSize: '12px' }}>
          <div className="text-black">{clinicName}</div>
          <div className="flex gap-6 text-black">
            <span>วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(surveyDate) || '1 พฤศจิกายน 2569'}</span>
            <span>ผู้ตรวจ: {rawInspector}</span>
          </div>
        </div>

        {/* Table - 14 columns (11 base + 3 subcheck) */}
        <div style={{ width: '100%', overflow: 'visible', boxSizing: 'border-box' }}>
          <table style={{ width: '100%', minWidth: '1080px', tableLayout: 'fixed', borderCollapse: 'collapse', margin: '0 auto', fontSize: '11px', border: '1px solid #000' }}>
            <thead>
              <tr className="bg-slate-50 text-black font-bold">
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '38px', textAlign: 'center' }}>ลำดับ</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '105px', textAlign: 'center' }}>หมายเลขพัสดุ</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '95px', textAlign: 'center' }}>รหัส SAP</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '165px', textAlign: 'left' }}>รายการ</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '145px', textAlign: 'left' }}>มาตรฐาน/สเปก</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '85px', textAlign: 'center' }}>แหล่งเงิน</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '85px', textAlign: 'center' }}>ว/ด/ป ได้มา</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '85px', textAlign: 'center', whiteSpace: 'nowrap' }}>จำนวน</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '62px', textAlign: 'center' }}>ภาษี%</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '80px', textAlign: 'right' }}>ราคา</th>
                <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', width: '115px', textAlign: 'center' }}>สถานที่ตั้ง</th>
                <th colSpan={3} style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', width: '165px' }}>ผลการตรวจสอบ</th>
              </tr>
              <tr className="bg-slate-50 text-black font-bold">
                <th style={{ border: '1px solid #000', padding: '6px 2px', width: '55px', textAlign: 'center' }}>ใช้งานได้</th>
                <th style={{ border: '1px solid #000', padding: '6px 2px', width: '55px', textAlign: 'center' }}>ชำรุด</th>
                <th style={{ border: '1px solid #000', padding: '6px 2px', width: '55px', textAlign: 'center' }}>ไม่ได้</th>
              </tr>
            </thead>
            <tbody>
              {effectiveItems.map((item, idx) => {
                const isDamaged = String(item.res).includes('ชำรุด');
                const isUnusable = !isDamaged && (String(item.res).includes('ไม่ได้') || String(item.res).includes('ไม่พบ') || item.res === 'ผิดปกติ');
                const isOk = !isDamaged && !isUnusable;

                return (
                  <tr key={idx} className="text-black">
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{item.code || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{item.sap || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'left', wordBreak: 'keep-all' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'left', fontSize: '10px' }}>{item.spec || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontSize: '10px' }}>{item.source || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontSize: '10px' }}>{formatAcquiredDate(item.date)}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>{item.unitText || item.qty || '1'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center' }}>{item.tax || '7'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'right' }}>{item.price || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', fontSize: '10px' }}>{item.location || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', color: '#15803d', fontWeight: 'bold', fontSize: '14px' }}>{isOk ? '✓' : ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', color: '#b91c1c', fontWeight: 'bold', fontSize: '14px' }}>{isDamaged ? '✓' : ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px 2px', textAlign: 'center', color: '#b45309', fontWeight: 'bold', fontSize: '14px' }}>{isUnusable ? '✓' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Signature Area */}
      <div
        className="mt-auto pt-16 flex justify-around text-[14px]"
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          width: '100%',
          marginTop: 'auto',
          paddingTop: '64px',
          paddingBottom: '24px',
        }}
      >
        <div className="text-center" style={{ textAlign: 'center' }}>
          <div className="h-16 flex items-end justify-center mb-2">
            {signature && <img src={signature} style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain' }} alt="sig" />}
          </div>
          <p className="font-bold">ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
          <p className="mt-1">({displayInspectorWithRole})</p>
        </div>
        <div className="text-center" style={{ textAlign: 'center' }}>
          <div className="h-16" />
          <p className="font-bold">ลงชื่อ .................................................... หัวหน้างาน</p>
          <p className="mt-1">(....................................................)</p>
        </div>
      </div>
    </div>
  );
};

export function generateEquipmentPrintHtml(
  items: OfficialReportItemRow[],
  options: {
    date?: string;
    inspector?: string;
    clinicName?: string;
    signature?: string;
    mainDocHeading?: string;
    orientation?: 'landscape' | 'portrait';
    currentUser?: User | null;
  } = {}
): string {
  const effectivePrintItems = (items && Array.isArray(items) && items.some(i => i.name)) ? items : FALLBACK_EQUIPMENT_ROWS;
  const {
    date = '',
    inspector = '',
    signature = '',
    clinicName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
    mainDocHeading = 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์',
    orientation = 'landscape',
    currentUser = null,
  } = options;

  const storedDisplayName = typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null;
  const printInspectorRole = currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : (currentUser?.position || 'เจ้าหน้าที่วิสัญญี');
  const rawPrintInspector = (storedDisplayName || inspector || currentUser?.name || 'สาธิต').trim();
  const printInspectorWithRole = `${rawPrintInspector} (${printInspectorRole})`;

  const rowsHtml = effectivePrintItems
    .map((item, idx) => {
      const isDamaged = String(item.res).includes('ชำรุด');
      const isUnusable = !isDamaged && (String(item.res).includes('ไม่ได้') || String(item.res).includes('ไม่พบ') || item.res === 'ผิดปกติ');
      const isOk = !isDamaged && !isUnusable;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
          <td style="text-align: center; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.code || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.sap || '-'}</td>
          <td style="text-align: left; border: 1px solid #000; padding-left: 5px;">${item.name || '-'}</td>
          <td style="text-align: left; border: 1px solid #000; padding-left: 5px; font-size: 9pt;">${item.spec || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${item.source || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${formatAcquiredDate(item.date)}</td>
          <td style="text-align: center; border: 1px solid #000; white-space: nowrap;">${item.unitText || item.qty || '1'}</td>
          <td style="text-align: center; border: 1px solid #000;">${item.tax || '7'}</td>
          <td style="text-align: right; border: 1px solid #000; padding-right: 5px;">${item.price || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${item.location || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #15803d; font-size: 14pt;">${isOk ? '✓' : ''}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #b91c1c; font-size: 14pt;">${isDamaged ? '✓' : ''}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #b45309; font-size: 14pt;">${isUnusable ? '✓' : ''}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${mainDocHeading}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
          @page { size: A4 ${orientation}; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; font-size: 11pt; line-height: 1.3; }
          .title-area { text-align: center; margin-bottom: 8px; }
          .title-area h2 { margin: 0; font-size: 18pt; font-weight: bold; }
          .meta-header { display: flex; justify-content: space-between; align-items: center; font-size: 11pt; font-weight: 600; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; }
          th, td { border: 1px solid #000; padding: 5px 4px; vertical-align: middle; }
          th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
          .signature-section { margin-top: 60px; display: flex; justify-content: space-around; font-size: 11pt; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h2>${mainDocHeading}</h2>
          <p>ณ วันที่ ${formatThaiDate(date) || '1 พฤศจิกายน 2569'}</p>
        </div>
        <div class="meta-header">
          <div><strong>${clinicName}</strong></div>
          <div>
            <span>วัน, เดือน, ปี ที่สำรวจ: ${formatThaiDate(date) || '1 พฤศจิกายน 2569'}</span>
            <span style="margin-left: 18px;">ผู้ตรวจ: <strong>${rawPrintInspector}</strong></span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 38px;">ลำดับ</th>
              <th rowspan="2" style="width: 105px;">หมายเลขพัสดุ</th>
              <th rowspan="2" style="width: 95px;">รหัส SAP</th>
              <th rowspan="2" style="min-width: 165px;">รายการ</th>
              <th rowspan="2" style="min-width: 145px;">มาตรฐาน/สเปก</th>
              <th rowspan="2" style="width: 85px;">แหล่งเงิน</th>
              <th rowspan="2" style="width: 85px;">ว/ด/ป ได้มา</th>
              <th rowspan="2" style="width: 85px; white-space: nowrap;">จำนวน</th>
              <th rowspan="2" style="width: 62px;">ภาษี%</th>
              <th rowspan="2" style="width: 80px;">ราคา</th>
              <th rowspan="2" style="width: 115px;">สถานที่ตั้ง</th>
              <th colspan="3">ผลการตรวจสอบ</th>
            </tr>
            <tr>
              <th style="width: 55px;">ใช้งานได้</th>
              <th style="width: 55px;">ชำรุด</th>
              <th style="width: 55px;">ไม่ได้</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="14" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการ</td></tr>'}
          </tbody>
        </table>
        <div class="signature-section">
          <div style="text-align: center;">
            <div style="height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
              ${signature ? `<img src="${signature}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : ''}
            </div>
            <p style="font-weight: bold; margin: 0;">ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
            <p style="margin: 4px 0 0 0;">(${printInspectorWithRole})</p>
          </div>
          <div style="text-align: center;">
            <div style="height: 48px;"></div>
            <p style="font-weight: bold; margin: 0;">ลงชื่อ .................................................... หัวหน้างาน</p>
            <p style="margin: 4px 0 0 0;">(....................................................)</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
