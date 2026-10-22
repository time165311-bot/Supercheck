import React, { useState } from 'react';
import { Download, X, FileSpreadsheet } from 'lucide-react';
import { InspectionHistoryRecord, User, DrugItem } from '../types';

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

export interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'eq' | 'bag' | 'cart' | 'drug';
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

export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'eq',
  title = 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)',
  date: surveyDate = new Date().toISOString().split('T')[0],
  inspector = '',
  items = [],
  eqItems = [],
  bagItems = [],
  cartItems = [],
  drugs = [],
  sheetUrl = '',
  apiUrl = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'eq' | 'bag' | 'cart'>('eq');

  if (!isOpen) return null;

  // Choose the items to display based on category
  const activeItems: OfficialReportItemRow[] =
    selectedCategory === 'eq'
      ? (eqItems.length > 0 ? eqItems : items)
      : selectedCategory === 'bag'
      ? (bagItems.length > 0 ? bagItems : items)
      : (cartItems.length > 0 ? cartItems : items);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      // Use configured apiUrl or fallback
      const endpoint = apiUrl && apiUrl.trim() !== '' 
        ? apiUrl 
        : 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

      const payload = {
        a: 'export_pdf',
        action: 'export_pdf',
        surveyDate: surveyDate || '21 ตุลาคม 2569',
        locationName: title || 'คลินิกงานบริการผู้ป่วยในวิสัญญี (ภาพรวมทุกห้อง)',
        inspector: inspector || '',
        items: activeItems.map((item: any, idx: number) => {
          const isOk = item.res ? item.res.includes('ใช้งานได้') : (item.status === 'normal' || item.checked);
          return {
            no: idx + 1,
            assetNo: item.assetNo || item.code || item.id || '',
            sapNo: item.sapNo || item.sap || item.sap_id || '',
            name: item.name || item.item_name || '',
            spec: item.spec || item.specification || '',
            source: item.source || item.budget_source || '',
            aquiredDate: item.aquiredDate || item.date || item.acquired_date || '',
            amount: Number(item.amount || item.qty) || 1,
            rate: Number(item.rate || item.tax) || 7,
            price: item.price ? Number(String(item.price).replace(/,/g, '')) || 0 : 0,
            location: item.location || item.room_name || '',
            status: item.status || (isOk ? 'normal' : 'abnormal'),
            checked: isOk,
          };
        }),
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // ป้องกัน CORS Preflight
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const targetUrl = result.directUrl || result.downloadUrl || result.viewUrl || result.url;
      if (result.success && targetUrl) {
        // Direct auto-download as requested
        window.location.href = result.directUrl || result.downloadUrl || targetUrl;
      } else {
        alert('เกิดข้อผิดพลาดในการสร้าง PDF: ' + (result.error || 'ไม่ทราบสาเหตุ'));
      }
    } catch (err: any) {
      alert('ไม่สามารถเชื่อมต่อกับ Server ได้: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 border-b flex flex-wrap justify-between items-center bg-slate-50 gap-2 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-slate-800">ตัวอย่างรายงานทะเบียนครุภัณฑ์</h3>
            <p className="text-xs text-slate-500">ตรวจสอบความถูกต้องก่อนกดส่งออกไฟล์ PDF ผ่าน Google Drive</p>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {/* Category tabs */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-semibold mr-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('eq')}
                className={`px-3 py-1.5 rounded-md transition ${
                  selectedCategory === 'eq' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏥 ครุภัณฑ์
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('bag')}
                className={`px-3 py-1.5 rounded-md transition ${
                  selectedCategory === 'bag' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💼 กระเป๋า
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('cart')}
                className={`px-3 py-1.5 rounded-md transition ${
                  selectedCategory === 'cart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛒 รถ
              </button>
            </div>

            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs transition"
                title="เปิด Google Sheet ปัจจุบัน"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">เปิด Google Sheet</span>
              </a>
            )}

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow transition-all cursor-pointer text-xs sm:text-sm"
              title="ส่งออกเอกสารรายงานเป็นไฟล์ PDF A4 แนวนอนผ่าน Google Drive"
            >
              {isExporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>กำลังสร้างไฟล์ PDF ลงใน Google Drive...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลด PDF (A4 แนวนอน)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-bold cursor-pointer text-xs sm:text-sm"
              title="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Area - Scrollable Clean Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100">
          <div className="bg-white p-6 rounded-lg shadow min-w-[1050px]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">ทะเบียนรายการครุภัณฑ์และอุปกรณ์</h2>
              <p className="text-sm text-slate-600 mt-1">ณ วันที่ {surveyDate}</p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-700 font-medium mb-3">
              <div>{title}</div>
              <div>
                <span>วัน, เดือน, ปี ที่สำรวจ: {surveyDate}</span>
                {inspector && <span className="ml-3">ผู้ตรวจ: {inspector}</span>}
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-400 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold text-center">
                  <th rowSpan={2} className="border border-slate-400 p-2 w-12">ลำดับที่</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">หมายเลขพัสดุ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">รหัสสินทรัพย์ SAP</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-left min-w-[180px]">รายการ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-left min-w-[160px]">มาตรฐานและคุณลักษณะเฉพาะ</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-24">แหล่งเงินที่มา (ประเภทเงินงบประมาณ)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-24">ว/ด/ป ที่ได้มา</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-16">จำนวนตามบัญชี</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-16">อัตราภาษี (%)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-right w-24">ราคา (รวมภาษี)</th>
                  <th rowSpan={2} className="border border-slate-400 p-2 w-28">สถานที่ตั้ง ตึก / ชั้น / ห้อง</th>
                  <th colSpan={3} className="border border-slate-400 p-2">ผลการตรวจสอบพัสดุ</th>
                </tr>
                <tr className="bg-slate-100 text-slate-800 font-semibold text-center text-[11px]">
                  <th className="border border-slate-400 p-1 w-16 text-emerald-700">พบรายการ ใช้งานได้</th>
                  <th className="border border-slate-400 p-1 w-16 text-rose-700">พบรายการ ใช้งานไม่ได้</th>
                  <th className="border border-slate-400 p-1 w-16 text-amber-700">ไม่พบรายการ</th>
                </tr>
              </thead>
              <tbody>
                {activeItems && activeItems.length > 0 ? (
                  activeItems.map((item, idx) => {
                    const isOk = item.res && item.res.includes('ใช้งานได้');
                    const isBad = item.res && item.res.includes('ไม่ได้');
                    const isMiss = item.res && item.res.includes('ไม่พบ');

                    return (
                      <tr key={idx} className="hover:bg-slate-50 text-slate-800">
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.code || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono text-xs">{item.sap || '-'}</td>
                        <td className="border border-slate-300 p-2 font-medium">{item.name || '-'}</td>
                        <td className="border border-slate-300 p-2 text-slate-600 text-xs">{item.spec || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs">{item.source || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs">{item.date || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.qty || '1'}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.tax || '7'}</td>
                        <td className="border border-slate-300 p-2 text-right">{item.price || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center text-xs">{item.location || '-'}</td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-emerald-600">
                          {isOk ? '✓' : ''}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-rose-600">
                          {isBad ? '✓' : ''}
                        </td>
                        <td className="border border-slate-300 p-1 text-center font-bold text-amber-600">
                          {isMiss ? '✓' : ''}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={14} className="border border-slate-300 p-8 text-center text-slate-400">
                      ไม่มีข้อมูลรายการในหมวดนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
