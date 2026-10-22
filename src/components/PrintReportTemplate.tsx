import React from 'react';
import { OfficialReportItemRow } from './OfficialReportModal';

interface PrintReportTemplateProps {
  title?: string;
  date?: string;
  inspector?: string;
  items: OfficialReportItemRow[];
  category?: 'eq' | 'bag' | 'cart' | 'drug';
}

export const PrintReportTemplate: React.FC<PrintReportTemplateProps> = ({
  title = 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)',
  date = '',
  inspector = 'ผู้ดูแลระบบ',
  items = [],
  category = 'eq',
}) => {
  const reportTitle =
    category === 'bag'
      ? 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency'
      : category === 'cart'
      ? 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency'
      : category === 'drug'
      ? 'แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ'
      : 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์';

  return (
    <div
      id="print-report-template-root"
      style={{
        width: '1050px',
        padding: '20px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: "'Sarabun', 'TH Sarabun PSK', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Header Layout */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#000000' }}>
          {reportTitle}
        </h2>
        <h3 style={{ fontSize: '16px', fontWeight: 'normal', margin: 0, color: '#000000' }}>
          ณ วันที่ {date || '-'}
        </h3>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '13px', marginBottom: '10px', fontWeight: '500' }}>
        <div>
          <div style={{ marginBottom: '2px' }}>{title}</div>
          <div>หัวหน้าภาควิชา/หน่วยงาน ................................................................</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '2px' }}>วัน, เดือน, ปี ที่สำรวจ {date || '-'}</div>
          <div>กรรมการผู้ตรวจ {inspector || 'ผู้ดูแลระบบ'}</div>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '10px',
          tableLayout: 'fixed',
          fontFamily: "'Sarabun', 'TH Sarabun PSK', sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '4%' }} />
          <col style={{ width: '4%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>ลำดับ</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>หมายเลขพัสดุ</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>รหัสสินทรัพย์ SAP</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>รายการ</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>คุณลักษณะเฉพาะ</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>แหล่งเงิน</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>ว/ด/ป ได้มา</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>จำนวน</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>อัตรา(%)</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>ราคา</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>สถานที่ตั้ง</th>
            <th colSpan={3} style={{ border: '1px solid #000', padding: '3px 2px', verticalAlign: 'middle' }}>ผลการตรวจ</th>
          </tr>
          <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: '11px', textAlign: 'center' }}>
            <th style={{ border: '1px solid #000', padding: '3px 2px', verticalAlign: 'middle' }}>พบรายการ: ใช้งานได้</th>
            <th style={{ border: '1px solid #000', padding: '3px 2px', verticalAlign: 'middle' }}>พบรายการ: ใช้งานไม่ได้</th>
            <th style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'middle' }}>ไม่พบรายการ</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
                ไม่มีรายการข้อมูลในรอบตรวจนี้
              </td>
            </tr>
          ) : (
            items.map((row, idx) => {
              const isOk = (row.res || '').includes('ใช้งานได้');
              const isBad = (row.res || '').includes('ไม่ได้');
              const isMiss = (row.res || '').includes('ไม่พบ');

              return (
                <tr key={idx} style={{ fontSize: '13px' }}>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {idx + 1}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.code || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.sap || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left', verticalAlign: 'middle', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    {row.name || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left', verticalAlign: 'middle', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    {row.spec || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.source || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.date || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.qty || '1'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.tax || '7'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right', verticalAlign: 'middle' }}>
                    {row.price || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {row.location || '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', color: '#15803d' }}>
                    {isOk || isMiss || isBad ? '✓' : ''}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', color: '#15803d' }}>
                    {isOk ? '✓' : ''}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', color: '#b91c1c' }}>
                    {isBad ? '✓' : ''}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Footer Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '13px' }}>
        <div style={{ width: '40%', textAlign: 'center' }}>
          <div>ลงชื่อ ............................................................................ ผู้ตรวจสอบ</div>
          <div style={{ marginTop: '4px' }}>({inspector || 'ผู้ดูแลระบบ'})</div>
        </div>
        <div style={{ width: '40%', textAlign: 'center' }}>
          <div>ลงชื่อ ............................................................................ หัวหน้างาน</div>
          <div style={{ marginTop: '4px' }}>( ............................................................................ )</div>
        </div>
      </div>
    </div>
  );
};
