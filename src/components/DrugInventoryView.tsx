import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  LayoutGrid,
  Minus,
  Pencil,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
  X,
  ArrowLeft,
  Package,
  Barcode,
  Camera,
  ZoomIn,
  Send,
  Printer,
  Save,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { DrugCategory, DrugItem, User } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { sendInspectionToGas } from '../services/api';
import { fileToBase64 } from '../services/media';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface DrugInventoryViewProps {
  currentUser: User | null;
  onBack: () => void;
  sheetUrl?: string;
  apiUrl?: string;
  onOpenPreview?: (category: DrugCategory) => void;
  drugs?: DrugItem[];
  onDrugsChange?: (drugs: DrugItem[]) => void;
  onCelebrate?: () => void;
}

export const DrugInventoryView: React.FC<DrugInventoryViewProps> = ({
  currentUser,
  onBack,
  apiUrl,
  onOpenPreview,
  drugs: externalDrugs,
  onDrugsChange,
  onCelebrate,
}) => {
  const [activeTab, setActiveTab] = useState<DrugCategory>('monthly');
  const [drugs, setDrugs] = useState<DrugItem[]>(INITIAL_DRUGS_DATA);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'expired'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DrugItem | null>(null);
  
  // Logic for filtering, sorting, and expiration info
  const getExpirationInfo = (expDate?: string) => {
    if (!expDate) return { text: 'ไม่ระบุวันหมดอายุ', status: 'none' as const };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return { text: expDate, status: 'none' as const };
    exp.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `หมดอายุแล้ว`, status: 'expired' as const };
    if (diff <= 90) return { text: `ใกล้หมดอายุ`, status: 'expiring' as const };
    return { text: `ปกติ`, status: 'ok' as const };
  };

  const displayedDrugs = useMemo(() => {
    return drugs.filter(d => d.category === activeTab);
  }, [drugs, activeTab]);

  const handleUpdateField = (id: string, field: keyof DrugItem, value: string | number) => {
    setDrugs(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            <ArrowLeft /> กลับ
        </button>
        <h1 className="font-bold text-lg">คลังยา</h1>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setViewMode('table')} className={`p-2 rounded-xl ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>รายการ</button>
        <button onClick={() => setViewMode('card')} className={`p-2 rounded-xl ${viewMode === 'card' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>การ์ด</button>
      </div>

      {viewMode === 'table' ? (
        <div className="space-y-2">
          {displayedDrugs.map(item => {
            const expInfo = getExpirationInfo(item.expDate);
            const isLowStock = Number(item.remaining) <= Number(item.minStock);
            const isExpired = expInfo.status === 'expired';
            const isExpiringSoon = expInfo.status === 'expiring';
            return (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs">คงเหลือ: {item.remaining}</p>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                  isExpired ? 'bg-rose-100 text-rose-800' :
                  isExpiringSoon ? 'bg-amber-100 text-amber-800' :
                  isLowStock ? 'bg-orange-100 text-orange-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {isExpired ? 'หมดอายุ' : isExpiringSoon ? 'ใกล้หมดอายุ' : isLowStock ? 'สต็อกต่ำ' : 'ปกติ'}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayedDrugs.map(item => (
            <div key={item.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold">{item.name}</h3>
              <p className="text-sm">คงเหลือ: {item.remaining}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
