import React from 'react';
import { OfficialReportItemRow, formatAcquiredDate, formatThaiDate, formatRealQuantity } from './OfficialReportModal';
import { User } from '../types';

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
  const inspectorRole = currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่';
  const rawInspector = inspector || currentUser?.name || 'คุณสาทิตย์ บุตรน้ำเพชร';
  const displayInspectorWithRole = rawInspector.includes('/') ? rawInspector : `${rawInspector} / ${inspectorRole}`;

  return (
    <div className="w-full flex flex-col justify-between" style={{ minHeight: '1200px', height: '100%', boxSizing: 'border-box' }}>
      {/* Top Document Content */}
      <div className="flex-1 w-full">
        {/* Document Header */}
        <div className="text-center mb-4" style={{ textAlign: 'center', width: '100%', margin: '0 auto 10px auto' }}>
          <h2 className="text-[18px] font-bold text-black mb-1" style={{ lineHeight: '1.4', fontWeight: 'bold' }}>
            {mainDocHeading}
          </h2>
          <p className="text-[14px] text-black" style={{ lineHeight: '1.4' }}>
            ณ วันที่ {formatThaiDate(surveyDate)}
          </p>
        </div>

        {/* Clinic & Inspector Meta */}
        <div className="flex justify-between items-center mb-3 text-[12px] font-bold" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px', fontSize: '12px' }}>
          <div className="text-black" style={{ lineHeight: '1.4' }}>{clinicName}</div>
          <div className="flex gap-6 text-black" style={{ lineHeight: '1.4', display: 'flex', gap: '24px' }}>
            <span>วัน, เดือน, ปี ที่สำรวจ: {formatThaiDate(surveyDate)}</span>
            {inspector && <span>ผู้ตรวจ: {inspector}</span>}
          </div>
        </div>

        {/* Table Container */}
        <div style={{ width: '100%', paddingRight: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }}>
          <table style={{ width: '100%', minWidth: '1100px', tableLayout: 'fixed', borderCollapse: 'collapse', margin: '0 auto', fontSize: '11px', border: '1px solid #000000' }}>
            <thead>
              <tr className="bg-slate-50 text-black font-bold">
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '38px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>ลำดับที่</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '105px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>หมายเลขพัสดุ</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '95px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>รหัสสินทรัพย์ SAP</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'left', width: '165px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>รายการ</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'left', width: '145px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>มาตรฐานและคุณลักษณะเฉพาะ</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '85px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>แหล่งเงินที่ได้มา</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '85px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>ว/ด/ป ที่ได้มา</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '42px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>จำนวน</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '62px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>อัตราภาษี (%)</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'right', width: '80px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>ราคา (รวมภาษี)</th>
                <th rowSpan={2} style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'center', width: '115px', lineHeight: '1.3', whiteSpace: 'nowrap', wordBreak: 'keep-all', fontSize: '11px', verticalAlign: 'middle' }}>สถานที่ตั้ง / ชั้น / ห้อง</th>
                <th colSpan={3} style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', wordBreak: 'normal', fontSize: '10px', verticalAlign: 'middle', minWidth: '165px', width: '165px' }}>ผลการตรวจสอบ</th>
              </tr>
              <tr className="bg-slate-50 text-black font-bold">
                <th style={{ border: '1px solid #000000', padding: '6px 2px', width: '55px', minWidth: '55px', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', wordBreak: 'normal', fontSize: '10px', verticalAlign: 'middle' }}>ใช้งานได้</th>
                <th style={{ border: '1px solid #000000', padding: '6px 2px', width: '55px', minWidth: '55px', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', wordBreak: 'normal', fontSize: '10px', verticalAlign: 'middle' }}>ชำรุด</th>
                <th style={{ border: '1px solid #000000', padding: '6px 2px', width: '55px', minWidth: '55px', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', wordBreak: 'normal', fontSize: '10px', verticalAlign: 'middle' }}>ใช้งานไม่ได้</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isBad = item.res?.includes('ไม่ได้') || item.res?.includes('ชำรุด');
                const isOk = !isBad && (item.res?.includes('ใช้งานได้') || item.res === 'ปกติ');
                const isMiss = item.res?.includes('ไม่พบ');
                return (
                  <tr key={idx} className="text-black">
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '38px', lineHeight: '1.3', whiteSpace: 'nowrap', fontSize: '11px', verticalAlign: 'middle' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '105px', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'break-all', verticalAlign: 'middle' }}>{item.code || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '95px', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'break-all', verticalAlign: 'middle' }}>{item.sap || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'left', width: '165px', wordBreak: 'keep-all', whiteSpace: 'normal', lineHeight: '1.3', fontSize: '11px', verticalAlign: 'middle' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 4px', textAlign: 'left', width: '145px', fontSize: '10.5px', wordBreak: 'keep-all', whiteSpace: 'normal', lineHeight: '1.3', verticalAlign: 'middle' }}>{item.spec || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '85px', fontSize: '10.5px', wordBreak: 'keep-all', whiteSpace: 'normal', lineHeight: '1.3', verticalAlign: 'middle' }}>{item.source || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '85px', fontSize: '10.5px', whiteSpace: 'nowrap', lineHeight: '1.3', verticalAlign: 'middle' }}>{formatAcquiredDate(item.date)}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '38px', lineHeight: '1.3', whiteSpace: 'nowrap', fontSize: '11px', verticalAlign: 'middle' }}>{formatRealQuantity(item.qty, item.name, item.spec)}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '42px', lineHeight: '1.3', whiteSpace: 'nowrap', fontSize: '11px', verticalAlign: 'middle' }}>{item.tax || '7'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', width: '75px', lineHeight: '1.3', whiteSpace: 'nowrap', fontSize: '11px', verticalAlign: 'middle' }}>{item.price || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '92px', fontSize: '10.5px', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'keep-all', verticalAlign: 'middle' }}>{item.location || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '55px', minWidth: '55px', color: '#15803d', fontWeight: 'bold', fontSize: '14px', lineHeight: '1.2', verticalAlign: 'middle', whiteSpace: 'nowrap', wordBreak: 'normal' }}>{isOk ? '✓' : ''}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '55px', minWidth: '55px', color: '#b91c1c', fontWeight: 'bold', fontSize: '14px', lineHeight: '1.2', verticalAlign: 'middle', whiteSpace: 'nowrap', wordBreak: 'normal' }}>{isBad ? '✓' : ''}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', width: '55px', minWidth: '55px', color: '#b45309', fontWeight: 'bold', fontSize: '14px', lineHeight: '1.2', verticalAlign: 'middle', whiteSpace: 'nowrap', wordBreak: 'normal' }}>{isMiss ? '✓' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Section Pinned to Bottom of Page */}
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
            {signature && (
              <img
                src={signature}
                style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain' }}
                alt="signature"
              />
            )}
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
  const {
    date = '',
    inspector = '',
    signature = '',
    clinicName = 'คลินิกงานบริการผู้ป่วยในวิสัญญี',
    mainDocHeading = 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์',
    orientation = 'landscape',
    currentUser = null,
  } = options;

  const printInspectorRole = currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่';
  const printInspectorRaw = inspector || currentUser?.name || 'คุณสาทิตย์ บุตรน้ำเพชร';
  const printInspectorWithRole = printInspectorRaw.includes('/') ? printInspectorRaw : `${printInspectorRaw} / ${printInspectorRole}`;

  const rowsHtml = items
    .map((item, idx) => {
      const isBad = item.res?.includes('ไม่ได้') || item.res?.includes('ชำรุด');
      const isOk = !isBad && (item.res?.includes('ใช้งานได้') || item.res === 'ปกติ');
      const isMiss = item.res?.includes('ไม่พบ');

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
          <td style="text-align: center; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.code || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-family: monospace; font-size: 9pt;">${item.sap || '-'}</td>
          <td style="text-align: left; border: 1px solid #000; padding-left: 5px; word-break: keep-all; white-space: nowrap;">${item.name || '-'}</td>
          <td style="text-align: left; border: 1px solid #000; padding-left: 5px; font-size: 9pt; word-break: keep-all; white-space: nowrap;">${item.spec || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${item.source || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt; white-space: nowrap;">${formatAcquiredDate(item.date)}</td>
          <td style="text-align: center; border: 1px solid #000;">${formatRealQuantity(item.qty, item.name, item.spec)}</td>
          <td style="text-align: center; border: 1px solid #000;">${item.tax || '7'}</td>
          <td style="text-align: right; border: 1px solid #000; padding-right: 5px;">${item.price || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-size: 9pt;">${item.location || '-'}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #15803d; font-size: 14pt; width: 55px; min-width: 55px;">${isOk ? '✓' : ''}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #b91c1c; font-size: 14pt; width: 55px; min-width: 55px;">${isBad ? '✓' : ''}</td>
          <td style="text-align: center; border: 1px solid #000; font-weight: bold; color: #b45309; font-size: 14pt; width: 55px; min-width: 55px;">${isMiss ? '✓' : ''}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${mainDocHeading} - ${clinicName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');

          @page {
            size: A4 ${orientation};
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
            font-size: 11pt;
            line-height: 1.3;
          }

          .title-area {
            text-align: center;
            margin-bottom: 8px;
          }

          .title-area h2 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
          }

          .title-area p {
            margin: 2px 0 0 0;
            font-size: 12pt;
          }

          .meta-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11pt;
            font-weight: 600;
            margin-bottom: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5pt;
            background-color: #fff !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
          }

          th, td {
            border: 1px solid #000 !important;
            padding: 5px 4px;
            white-space: normal !important;
            word-break: keep-all !important;
            line-height: 1.3 !important;
            vertical-align: middle !important;
          }

          th {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
          }

          .signature-section {
            margin-top: 80px;
            display: flex;
            justify-content: space-around;
            page-break-before: always;
            font-size: 11pt;
          }

          .sign-col {
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h2>${mainDocHeading}</h2>
          <p>ณ วันที่ ${formatThaiDate(date)}</p>
        </div>
        <div class="meta-header">
          <div><strong>${clinicName}</strong></div>
          <div>
            <span>วัน, เดือน, ปี ที่สำรวจ: ${formatThaiDate(date)}</span>
            ${inspector ? `<span style="margin-left: 18px;">ผู้ตรวจ: <strong>${inspector}</strong></span>` : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 38px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">ลำดับที่</th>
              <th rowspan="2" style="width: 105px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">หมายเลขพัสดุ</th>
              <th rowspan="2" style="width: 95px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">รหัสสินทรัพย์ SAP</th>
              <th rowspan="2" style="min-width: 165px; text-align: left; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">รายการ</th>
              <th rowspan="2" style="min-width: 145px; text-align: left; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">มาตรฐานและคุณลักษณะเฉพาะ</th>
              <th rowspan="2" style="min-width: 85px; width: 85px; text-align: center; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">แหล่งเงินที่ได้มา</th>
              <th rowspan="2" style="width: 85px; text-align: center; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">ว/ด/ป ที่ได้มา</th>
              <th rowspan="2" style="width: 42px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">จำนวน</th>
              <th rowspan="2" style="width: 62px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">อัตราภาษี (%)</th>
              <th rowspan="2" style="width: 80px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">ราคา (รวมภาษี)</th>
              <th rowspan="2" style="width: 115px; white-space: nowrap !important; line-height: 1.3 !important; padding: 6px 4px !important; font-size: 11px !important;">สถานที่ตั้ง / ชั้น / ห้อง</th>
              <th colspan="3" style="white-space: nowrap !important; line-height: 1.2 !important; padding: 6px 2px !important; font-size: 10px !important; min-width: 165px; width: 165px; text-align: center;">ผลการตรวจสอบ</th>
            </tr>
            <tr style="font-size: 10pt;">
              <th style="width: 55px; min-width: 55px; white-space: nowrap !important; padding: 6px 2px !important; font-size: 10px !important; line-height: 1.2 !important; text-align: center;">ใช้งานได้</th>
              <th style="width: 55px; min-width: 55px; white-space: nowrap !important; padding: 6px 2px !important; font-size: 10px !important; line-height: 1.2 !important; text-align: center;">ชำรุด</th>
              <th style="width: 55px; min-width: 55px; white-space: nowrap !important; padding: 6px 2px !important; font-size: 10px !important; line-height: 1.2 !important; text-align: center;">ใช้งานไม่ได้</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="14" style="text-align:center; padding: 20px;">ไม่มีข้อมูลรายการ</td></tr>'}
          </tbody>
        </table>
        <div class="signature-section">
          <div class="sign-col" style="display: flex; flex-direction: column; align-items: center;">
            <div style="height: 48px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
              ${signature ? `<img src="${signature}" style="max-height: 48px; max-width: 140px; object-fit: contain;" alt="ลายเซ็น" />` : ''}
            </div>
            <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
            <p>(${printInspectorWithRole})</p>
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
}
