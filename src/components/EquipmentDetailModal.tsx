import React from 'react';
import { FileText, X, Pencil } from 'lucide-react';
import { EquipmentItem } from '../types';

interface EquipmentDetailModalProps {
  isOpen: boolean;
  item: EquipmentItem | null;
  result?: string;
  note?: string;
  onClose: () => void;
  onEdit?: (item: EquipmentItem) => void;
  onZoomImage?: (imgUrl: string) => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({
  isOpen,
  item,
  result,
  note,
  onClose,
  onEdit,
  onZoomImage,
}) => {
  if (!isOpen || !item) return null;

  const orderNo = item.no || item.orderNumber || '-';
  const assetCode = item.code || item.assetCode || '-';
  const sapCode = item.sap || item.sapCode || '-';
  const checkStatus = result || item.status || 'ยังไม่ได้ตรวจ';

  const rows = [
    { label: 'ลำดับที่', value: orderNo !== '-' ? `#${orderNo}` : '-' },
    { label: 'หมายเลขพัสดุ', value: assetCode },
    { label: 'รหัสสินทรัพย์ SAP', value: sapCode },
    { label: 'ชื่อรายการ', value: item.name },
    { label: 'มาตรฐานและคุณลักษณะเฉพาะ (Spec)', value: item.spec || '-' },
    { label: 'แหล่งเงินที่ได้มา', value: item.source || '-' },
    { label: 'วันเดือนปีที่ได้มา', value: item.date || '-' },
    { label: 'จำนวนตามบัญชี', value: item.qty || '1' },
    { label: 'อัตราภาษี', value: item.tax ? `${item.tax}%` : '-' },
    { label: 'ราคา (รวมภาษี)', value: item.price ? `${item.price} บาท` : '-' },
    { label: 'สถานที่ตั้ง / ห้อง', value: item.location || (item.roomId ? item.roomId.toUpperCase() : '-') },
    { label: 'วันหมดอายุ (ถ้ามี)', value: item.exp || '-' },
    {
      label: 'ผลการตรวจสอบพัสดุ',
      value: (
        <span
          className={`font-bold ${
            checkStatus === 'ปกติ'
              ? 'text-emerald-600 dark:text-emerald-400'
              : checkStatus === 'ผิดปกติ' || checkStatus === 'ชำรุด'
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-500'
          }`}
        >
          {checkStatus === 'ปกติ'
            ? 'ใช้งานได้ปกติ'
            : checkStatus === 'ผิดปกติ' || checkStatus === 'ชำรุด'
            ? 'ใช้งานไม่ได้ / มีปัญหา'
            : checkStatus}
          {note ? ` (${note})` : ''}
        </span>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                รายละเอียดทะเบียนครุภัณฑ์
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ข้อมูลตามระเบียบพัสดุและระบบบริหารทรัพย์สิน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          {item.img && (
            <div className="mb-4 text-center">
              <img
                src={item.img}
                alt={item.name}
                onClick={() => onZoomImage?.(item.img!)}
                className="max-h-48 rounded-2xl mx-auto object-cover cursor-pointer hover:opacity-90 transition border border-slate-200 dark:border-slate-700 shadow-sm"
                title="คลิกเพื่อดูภาพขนาดใหญ่"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                แตะที่รูปเพื่อดูขนาดเต็ม
              </span>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            {rows.map((r, i) => (
              <div key={i} className="p-3 flex justify-between items-start gap-4">
                <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">
                  {r.label}
                </span>
                <span className="text-right text-slate-800 dark:text-slate-200 font-semibold break-all">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pb-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-2 shrink-0">
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>แก้ไขข้อมูล</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition active:scale-95 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
