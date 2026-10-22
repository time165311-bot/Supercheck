import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
  ArrowLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { DrugCategory, DrugItem, User } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { sendInspectionToGas } from '../services/api';
import { Send } from 'lucide-react';

interface DrugInventoryViewProps {
  currentUser: User | null;
  onBack: () => void;
  sheetUrl?: string;
  apiUrl?: string;
  onOpenPreview?: (category: DrugCategory) => void;
}

export const DrugInventoryView: React.FC<DrugInventoryViewProps> = ({
  currentUser,
  onBack,
  sheetUrl,
  apiUrl,
  onOpenPreview,
}) => {
  const [activeTab, setActiveTab] = useState<DrugCategory>('monthly');
  const [drugs, setDrugs] = useState<DrugItem[]>(() => {
    try {
      const saved = localStorage.getItem('anesthesia_drug_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load drug inventory from localStorage', e);
    }
    return INITIAL_DRUGS_DATA;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'expired'>('all');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DrugItem | null>(null);

  // New Drug Form State
  const [newDrugName, setNewDrugName] = useState('');
  const [newRemaining, setNewRemaining] = useState<number>(10);
  const [newReceivedDate, setNewReceivedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newReceivedQty, setNewReceivedQty] = useState<number>(10);
  const [newMinStock, setNewMinStock] = useState<number>(10);
  const [newBatchRequest, setNewBatchRequest] = useState<string>('10');
  const [newExpDate, setNewExpDate] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('anesthesia_drug_inventory', JSON.stringify(drugs));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [drugs]);

  // Filtered lists for the active tab
  const currentTabDrugs = useMemo(() => {
    return drugs.filter((d) => d.category === activeTab);
  }, [drugs, activeTab]);

  // Sorted by expiration date: earliest at top -> later at bottom, empty dates at the bottom
  const sortedTabDrugs = useMemo(() => {
    return [...currentTabDrugs].sort((a, b) => {
      const expA = a.expDate ? a.expDate.trim() : '';
      const expB = b.expDate ? b.expDate.trim() : '';
      if (expA && expB) {
        const cmp = expA.localeCompare(expB);
        if (cmp !== 0) return cmp;
      }
      if (expA && !expB) return -1;
      if (!expA && expB) return 1;
      return a.name.localeCompare(b.name, 'th');
    });
  }, [currentTabDrugs]);

  // Counts
  const monthlyCount = drugs.filter((d) => d.category === 'monthly').length;
  const quarterlyCount = drugs.filter((d) => d.category === 'quarterly').length;
  const adhocCount = drugs.filter((d) => d.category === 'adhoc').length;

  const lowStockMonthly = drugs.filter(
    (d) => d.category === 'monthly' && d.remaining <= d.minStock
  ).length;
  const lowStockQuarterly = drugs.filter(
    (d) => d.category === 'quarterly' && d.remaining <= d.minStock
  ).length;
  const lowStockAdhoc = drugs.filter(
    (d) => d.category === 'adhoc' && d.remaining <= d.minStock
  ).length;

  const lowStockCurrent = useMemo(() => {
    return currentTabDrugs.filter((d) => d.remaining <= d.minStock).length;
  }, [currentTabDrugs]);

  // Active tab expiration stats
  const expiringSoonCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentTabDrugs.filter((d) => {
      if (!d.expDate) return false;
      const exp = new Date(d.expDate);
      if (isNaN(exp.getTime())) return false;
      exp.setHours(0, 0, 0, 0);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 90;
    }).length;
  }, [currentTabDrugs]);

  const expiredCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentTabDrugs.filter((d) => {
      if (!d.expDate) return false;
      const exp = new Date(d.expDate);
      if (isNaN(exp.getTime())) return false;
      exp.setHours(0, 0, 0, 0);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff < 0;
    }).length;
  }, [currentTabDrugs]);

  const displayedDrugs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sortedTabDrugs.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (d.note && d.note.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      if (!matchesSearch) return false;

      if (statusFilter === 'low') {
        return d.remaining <= d.minStock;
      }
      if (statusFilter === 'expiring') {
        if (!d.expDate) return false;
        const exp = new Date(d.expDate);
        if (isNaN(exp.getTime())) return false;
        exp.setHours(0, 0, 0, 0);
        const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 90;
      }
      if (statusFilter === 'expired') {
        if (!d.expDate) return false;
        const exp = new Date(d.expDate);
        if (isNaN(exp.getTime())) return false;
        exp.setHours(0, 0, 0, 0);
        const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff < 0;
      }

      return true;
    });
  }, [sortedTabDrugs, searchTerm, statusFilter]);

  const getExpirationInfo = (expDate?: string) => {
    if (!expDate) return { text: 'ไม่ระบุวันหมดอายุ', days: null, status: 'none' as const };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return { text: expDate, days: null, status: 'none' as const };
    exp.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return { text: `หมดอายุแล้ว (${Math.abs(diff)} วัน)`, days: diff, status: 'expired' as const };
    }
    if (diff <= 90) {
      return { text: `ใกล้หมดอายุ (เหลือ ${diff} วัน)`, days: diff, status: 'expiring' as const };
    }
    return { text: `เหลือ ${diff} วัน`, days: diff, status: 'ok' as const };
  };

  // Handlers for updating rows in real time
  const handleUpdateField = (
    id: string,
    field: keyof DrugItem,
    value: string | number
  ) => {
    setDrugs((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      })
    );
  };

  const handleSaveData = () => {
    try {
      localStorage.setItem('anesthesia_drug_inventory', JSON.stringify(drugs));
      setSaveSuccessMsg('✓ บันทึกข้อมูลการตรวจเช็คคลังยาเรียบร้อยแล้ว');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const [isSyncingGas, setIsSyncingGas] = useState(false);

  const handleSyncToGas = async () => {
    if (!apiUrl) {
      alert('กรุณาระบุ URL ของ Google Apps Script ในหน้าตั้งค่าก่อนครับ');
      return;
    }
    setIsSyncingGas(true);
    const catName =
      activeTab === 'quarterly'
        ? 'ยาเบิกทุก 3 เดือน'
        : activeTab === 'adhoc'
        ? 'ยาเบิกเป็นครั้งๆ / ยาตามงบประมาณ'
        : 'ยาในคลังเดือน';

    const now = new Date();
    const thaiYear = String(now.getFullYear() + 543);
    const day = ('0' + now.getDate()).slice(-2);
    const month = ('0' + (now.getMonth() + 1)).slice(-2);
    const dateFormatted = `${day}${month}${thaiYear}`;
    const catCode = activeTab === 'quarterly' ? '3เดือน' : activeTab === 'adhoc' ? 'ครั้งคราว' : 'เดือน';
    const uniqueSheet = `คลังยา_${catCode}_${dateFormatted}`;

    try {
      await sendInspectionToGas(apiUrl, {
        type: 'drug',
        category: activeTab,
        sheet: 'คลังยาและสารน้ำ',
        sheetName: uniqueSheet,
        title: `แบบฟอร์มตรวจสอบ ${catName}`,
        date: new Date().toISOString().split('T')[0],
        who: currentUser?.name || currentUser?.username || 'ผู้ดูแลระบบ',
        user: currentUser?.username || 'user',
        rows: sortedTabDrugs.map((d) => ({
          name: d.name,
          remaining: d.remaining,
          receivedDate: d.receivedDate,
          receivedQty: d.receivedQty,
          totalQty: d.remaining + d.receivedQty,
          minStock: d.minStock,
          batchRequest: d.batchRequest,
          expDate: d.expDate,
          note: d.note,
        })),
      });
      setSaveSuccessMsg(`✓ ส่งข้อมูล "${catName}" ลง Google Sheet สร้างแท็บใหม่เรียบร้อยแล้ว`);
      setTimeout(() => setSaveSuccessMsg(''), 4500);
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล: ' + (e.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSyncingGas(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('คุณต้องการรีเซ็ตรายการคลังยาและสารน้ำกลับเป็นค่าเริ่มต้นทั้งหมดหรือไม่?')) {
      setDrugs(INITIAL_DRUGS_DATA);
      localStorage.setItem(
        'anesthesia_drug_inventory',
        JSON.stringify(INITIAL_DRUGS_DATA)
      );
      setSaveSuccessMsg('✓ รีเซ็ตข้อมูลเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const handleAddNewDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName.trim()) {
      alert('กรุณากรอกชื่อยาหรือสารน้ำ');
      return;
    }

    const newId = `${activeTab[0]}-${Date.now()}`;
    const newItem: DrugItem = {
      id: newId,
      category: activeTab,
      name: newDrugName.trim(),
      remaining: Number(newRemaining) || 0,
      receivedDate: newReceivedDate,
      receivedQty: Number(newReceivedQty) || 0,
      minStock: Number(newMinStock) || 0,
      batchRequest: newBatchRequest.trim(),
      expDate: newExpDate,
      note: newNote.trim(),
    };

    setDrugs((prev) => [newItem, ...prev]);
    setShowAddModal(false);
    // Reset form
    setNewDrugName('');
    setNewRemaining(10);
    setNewReceivedQty(10);
    setNewMinStock(10);
    setNewBatchRequest('10');
    setNewExpDate('');
    setNewNote('');
    setSaveSuccessMsg(`✓ เพิ่มรายการ "${newItem.name}" เรียบร้อยแล้ว`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    const targetName = itemToDelete.name;
    setDrugs((prev) => prev.filter((d) => d.id !== targetId));
    setItemToDelete(null);
    setSaveSuccessMsg(`✓ ลบรายการ "${targetName}" เรียบร้อยแล้ว`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-in fade-in">
      {/* Top Navigation / Back & Actions Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-[#161822] p-4 sm:p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">กลับหน้าหลัก</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              ระบบตรวจเช็คคลังยาและสารน้ำ
            </h1>
          </div>
        </div>

        {/* Action Buttons: Add Drug, Save, Sync to Gas, Direct to Google Sheet */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มยา</span>
          </button>

          <button
            type="button"
            onClick={handleSaveData}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>บันทึก</span>
          </button>

          {/* Sync & Create Sheet in Google Sheets */}
          {apiUrl && (
            <button
              type="button"
              disabled={isSyncingGas}
              onClick={handleSyncToGas}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="ส่งข้อมูลหมวดนี้ไปสร้างแท็บใหม่ใน Google Sheets"
            >
              <Send className="w-4 h-4" />
              <span>{isSyncingGas ? 'กำลังส่งข้อมูล...' : 'ส่งผลลง Google Sheet'}</span>
            </button>
          )}

          {/* Preview & Print A4 Report */}
          {onOpenPreview && (
            <button
              type="button"
              onClick={() => onOpenPreview(activeTab)}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              title="ดูพรีวิวแบบฟอร์ม A4 และดาวน์โหลด PDF"
            >
              <Printer className="w-4 h-4" />
              <span>พรีวิว & พิมพ์ A4</span>
            </button>
          )}

          {/* Direct Link to Google Sheet */}
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              title="มุ่งตรงไปยัง Google Sheet โดยตรง"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>มุ่งตรงไปยังหน้าชีต</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => alert('กรุณาระบุ URL ของ Google Sheet ในหน้าตั้งค่าก่อนครับ')}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>มุ่งตรงไปยังหน้าชีต</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-2xl text-center shadow-xs animate-in fade-in">
          {saveSuccessMsg}
        </div>
      )}

      {/* Top Tabs Bar inside page (3 Categories) - Responsive and never cut off */}
      <div className="bg-white dark:bg-[#161822] p-2.5 sm:p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
              activeTab === 'monthly'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 bg-neutral-50 dark:bg-neutral-900/50'
            }`}
          >
            <span>📅 ยาในคลังเดือน</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'monthly' ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
              {monthlyCount}
            </span>
            {lowStockMonthly > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                ⚠️ {lowStockMonthly}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quarterly')}
            className={`flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
              activeTab === 'quarterly'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 bg-neutral-50 dark:bg-neutral-900/50'
            }`}
          >
            <span>📦 ยาเบิกทุก 3 เดือน</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'quarterly' ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
              {quarterlyCount}
            </span>
            {lowStockQuarterly > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                ⚠️ {lowStockQuarterly}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adhoc')}
            className={`flex-1 min-w-[180px] px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
              activeTab === 'adhoc'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 bg-neutral-50 dark:bg-neutral-900/50'
            }`}
          >
            <span>⚡ ยาเบิกเป็นครั้งๆ / ยาตามงบประมาณ</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'adhoc' ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
              {adhocCount}
            </span>
            {lowStockAdhoc > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                ⚠️ {lowStockAdhoc}
              </span>
            )}
          </button>
        </div>

        {/* 4 Clinical KPI Dashboard Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
          <div
            onClick={() => setStatusFilter('all')}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              statusFilter === 'all'
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div>
              <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">ยาทั้งหมดในหมวดนี้</span>
              <span className="text-base font-extrabold text-neutral-900 dark:text-white">{currentTabDrugs.length} รายการ</span>
            </div>
            <span className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('low')}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              statusFilter === 'low'
                ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div>
              <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">สต็อกต่ำ (ต้องเบิก)</span>
              <span className={`text-base font-extrabold ${lowStockCurrent > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-white'}`}>
                {lowStockCurrent} รายการ
              </span>
            </div>
            <span className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('expiring')}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              statusFilter === 'expiring'
                ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div>
              <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">ใกล้หมดอายุ (≤ 90 วัน)</span>
              <span className={`text-base font-extrabold ${expiringSoonCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-white'}`}>
                {expiringSoonCount} รายการ
              </span>
            </div>
            <span className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('expired')}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              statusFilter === 'expired'
                ? 'border-rose-700 bg-rose-100/70 dark:bg-rose-950/60'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div>
              <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">หมดอายุแล้ว (Exp)</span>
              <span className={`text-base font-extrabold ${expiredCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-900 dark:text-white'}`}>
                {expiredCount} รายการ
              </span>
            </div>
            <span className="p-2 rounded-lg bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Search & Quick Filter Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap transition ${
                statusFilter === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              🌟 ทั้งหมด ({sortedTabDrugs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap transition flex items-center gap-1 ${
                statusFilter === 'low'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>เตือนเบิก ({lowStockCurrent})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expiring')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap transition flex items-center gap-1 ${
                statusFilter === 'expiring'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ใกล้หมดอายุ ({expiringSoonCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap transition flex items-center gap-1 ${
                statusFilter === 'expired'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              <span>หมดอายุ ({expiredCount})</span>
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อยา, สารน้ำ, หรือหมายเหตุ..."
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-neutral-400 border border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-[#161822] text-neutral-900 dark:text-neutral-100 p-3 sm:p-5 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-neutral-200/70 dark:border-neutral-800">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
              แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              หมวดหมู่:{' '}
              {activeTab === 'monthly'
                ? 'ยาในคลังเดือน'
                : activeTab === 'quarterly'
                ? 'ยาเบิกทุก 3 เดือน'
                : 'ยาเบิกเป็นครั้งๆ / ยาตามงบประมาณ'}
            </p>
          </div>
          <span className="text-[11px] text-neutral-400 font-medium">
            ข้อมูล ณ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* 1. Mobile Optimized Card List View (block on mobile, hidden on tablet/desktop) */}
        <div className="block md:hidden space-y-2.5">
          {displayedDrugs.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              ไม่พบรายการยาหรือสารน้ำในหมวดนี้
            </div>
          ) : (
            displayedDrugs.map((item, idx) => {
              const totalQty = item.remaining + item.receivedQty;
              const isLowStock = item.remaining <= item.minStock;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isLowStock
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/15'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-neutral-400 shrink-0">#{idx + 1}</span>
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {item.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isLowStock && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          ⚠️ ต่ำกว่าเกณฑ์
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-500"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact Grid of Values */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div className="bg-white dark:bg-neutral-800/80 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center">
                      <span className="block text-[10px] text-neutral-400 font-medium">คงเหลือ</span>
                      <input
                        type="number"
                        min="0"
                        value={item.remaining}
                        onChange={(e) =>
                          handleUpdateField(item.id, 'remaining', Number(e.target.value) || 0)
                        }
                        className={`w-full text-center font-bold text-xs outline-none bg-transparent ${
                          isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-white'
                        }`}
                      />
                    </div>

                    <div className="bg-white dark:bg-neutral-800/80 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center">
                      <span className="block text-[10px] text-neutral-400 font-medium">จำนวนรับ</span>
                      <input
                        type="number"
                        min="0"
                        value={item.receivedQty}
                        onChange={(e) =>
                          handleUpdateField(item.id, 'receivedQty', Number(e.target.value) || 0)
                        }
                        className="w-full text-center font-bold text-xs outline-none bg-transparent text-neutral-900 dark:text-white"
                      />
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">รวม</span>
                      <span className="font-extrabold text-xs text-emerald-700 dark:text-emerald-300">{totalQty}</span>
                    </div>
                  </div>

                  {/* Details row: Min, Batch, Exp */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-800/50 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <span>ยอดต่ำสุด (Min):</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">{item.minStock}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-800/50 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <span>เบิกครั้งละ:</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.batchRequest || '-'}</span>
                    </div>
                  </div>

                  {/* Date & Note */}
                  <div className="mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/80 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-neutral-400">
                      Exp: {item.expDate || '-'}
                    </span>
                    {item.note && (
                      <span className="text-neutral-600 dark:text-neutral-300 truncate max-w-[150px]">
                        {item.note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Table View (hidden on mobile, block on tablet/desktop) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <table className="w-full border-collapse text-xs min-w-[950px]">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-bold border-b border-neutral-200 dark:border-neutral-700 text-center">
                <th className="p-2.5 w-12">#</th>
                <th className="p-2.5 text-left min-w-[180px]">ชนิดยา / สารน้ำ</th>
                <th className="p-2.5 w-32 bg-blue-50/50 dark:bg-blue-950/20">คงเหลือ</th>
                <th className="p-2.5 w-48">การรับงวดนี้ (วันที่ / จำนวน)</th>
                <th className="p-2.5 w-20 bg-emerald-50/50 dark:bg-emerald-950/20 font-bold text-emerald-800 dark:text-emerald-300">รวม</th>
                <th className="p-2.5 w-36">เกณฑ์เบิก (ต่ำสุด / ครั้งละ)</th>
                <th className="p-2.5 w-40">วันหมดอายุ (Exp)</th>
                <th className="p-2.5 min-w-[140px] text-left">หมายเหตุ</th>
                <th className="p-2.5 w-14">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-[#161822]">
              {displayedDrugs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-xs text-neutral-400">
                    ไม่พบรายการยาหรือสารน้ำที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                displayedDrugs.map((item, idx) => {
                  const totalQty = (Number(item.remaining) || 0) + (Number(item.receivedQty) || 0);
                  const isLowStock = item.remaining <= item.minStock;
                  const expInfo = getExpirationInfo(item.expDate);
                  const isExpired = expInfo.status === 'expired';
                  const isExpiringSoon = expInfo.status === 'expiring';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isExpired
                          ? 'bg-rose-100/50 dark:bg-rose-950/40 hover:bg-rose-100/80'
                          : isLowStock
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50/80'
                          : isExpiringSoon
                          ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* 1. Index */}
                      <td className="p-2.5 text-center text-neutral-500 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* 2. Name & Status Badges */}
                      <td className="p-2.5 text-left">
                        <div className="space-y-1">
                          <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 block">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {isExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-600 text-white animate-pulse">
                                🔴 หมดอายุแล้ว
                              </span>
                            )}
                            {isExpiringSoon && !isExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ⏳ ใกล้หมดอายุ
                              </span>
                            )}
                            {isLowStock && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                ⚠️ สต็อกต่ำ
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Remaining (Numeric Stepper) */}
                      <td className="p-2 bg-blue-50/30 dark:bg-blue-950/10">
                        <div className="flex items-center justify-center gap-1 bg-white dark:bg-neutral-800 px-1 py-1 rounded-xl border border-neutral-300 dark:border-neutral-700 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateField(item.id, 'remaining', Math.max(0, (Number(item.remaining) || 0) - 1))}
                            className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer transition shrink-0"
                            title="ลดจำนวน (-1)"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.remaining}
                            onChange={(e) =>
                              handleUpdateField(item.id, 'remaining', Math.max(0, Number(e.target.value) || 0))
                            }
                            className={`w-12 py-0.5 text-center font-extrabold text-xs outline-none bg-transparent ${
                              isLowStock ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-900 dark:text-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateField(item.id, 'remaining', (Number(item.remaining) || 0) + 1)}
                            className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer transition shrink-0"
                            title="เพิ่มจำนวน (+1)"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* 4. Received Date & Received Qty */}
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="date"
                            value={item.receivedDate || ''}
                            onChange={(e) => handleUpdateField(item.id, 'receivedDate', e.target.value)}
                            className="w-28 px-1.5 py-1 text-center text-[11px] bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500"
                            title="วันที่รับ"
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.receivedQty}
                            onChange={(e) =>
                              handleUpdateField(item.id, 'receivedQty', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-14 px-1.5 py-1 text-center font-bold text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500"
                            title="จำนวนที่รับ"
                          />
                        </div>
                      </td>

                      {/* 5. Total Quantity */}
                      <td className="p-2 text-center bg-emerald-50/30 dark:bg-emerald-950/10">
                        <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs shadow-2xs">
                          {totalQty}
                        </span>
                      </td>

                      {/* 6. Thresholds (Min & Batch) */}
                      <td className="p-2">
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 px-1.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700" title="ยอดต่ำสุด (Min)">
                            <span className="text-[10px] text-neutral-400 font-medium">Min:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.minStock}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'minStock', Math.max(0, Number(e.target.value) || 0))
                              }
                              className="w-full text-center font-bold text-xs outline-none bg-transparent"
                            />
                          </div>
                          <div className="bg-white dark:bg-neutral-800 px-1.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700" title="เบิกครั้งละ">
                            <input
                              type="text"
                              value={item.batchRequest || ''}
                              onChange={(e) => handleUpdateField(item.id, 'batchRequest', e.target.value)}
                              placeholder="ครั้งละ"
                              className="w-full text-center text-xs outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      </td>

                      {/* 7. Exp Date & Expiration indicator */}
                      <td className="p-2 text-center">
                        <div className="space-y-1">
                          <input
                            type="date"
                            value={item.expDate || ''}
                            onChange={(e) => handleUpdateField(item.id, 'expDate', e.target.value)}
                            className={`w-full px-2 py-1 text-center text-[11px] rounded-lg border outline-none ${
                              isExpired
                                ? 'border-rose-400 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                                : isExpiringSoon
                                ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium'
                                : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                            }`}
                          />
                          {item.expDate && (
                            <span
                              className={`block text-[10px] font-semibold text-center truncate ${
                                isExpired
                                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                                  : isExpiringSoon
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {expInfo.text}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Note */}
                      <td className="p-2 text-left">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => handleUpdateField(item.id, 'note', e.target.value)}
                          placeholder="หมายเหตุเพิ่มเติม..."
                          className="w-full px-2 py-1 text-left text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500 text-neutral-800 dark:text-neutral-200"
                        />
                      </td>

                      {/* 9. Actions */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                          title="ลบรายการนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Drug Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>➕</span>
                <span>เพิ่มรายการยาหรือสารน้ำใหม่ ({activeTab === 'monthly' ? 'คลังเดือน' : activeTab === 'quarterly' ? 'เบิก 3 เดือน' : 'เบิกครั้งๆ'})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewDrug} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  ชื่อยา / สารน้ำ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDrugName}
                  onChange={(e) => setNewDrugName(e.target.value)}
                  placeholder="เช่น Atropine, NSS 1000 mL..."
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    คงเหลือเริ่มต้น
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newRemaining}
                    onChange={(e) => setNewRemaining(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    ยอดต่ำสุด (Min Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    วันที่รับ
                  </label>
                  <input
                    type="date"
                    value={newReceivedDate}
                    onChange={(e) => setNewReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    จำนวนที่รับ
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newReceivedQty}
                    onChange={(e) => setNewReceivedQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    เบิกครั้งละ
                  </label>
                  <input
                    type="text"
                    value={newBatchRequest}
                    onChange={(e) => setNewBatchRequest(e.target.value)}
                    placeholder="เช่น 10 หลอด / 5 กล่อง"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    วันหมดอายุ (Exp)
                  </label>
                  <input
                    type="date"
                    value={newExpDate}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  ยืนยันเพิ่มรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                ยืนยันการลบรายการยา?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                คุณต้องการลบรายการ <span className="font-semibold text-neutral-800 dark:text-neutral-200">"{itemToDelete.name}"</span> ใช่หรือไม่?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
