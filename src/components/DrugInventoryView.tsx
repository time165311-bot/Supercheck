import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  LayoutGrid,
  Table as TableIcon,
  Pencil,
  Send,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { DrugCategory, DrugItem, User } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { sendInspectionToGas } from '../services/api';

interface DrugInventoryViewProps {
  currentUser: User | null;
  onBack: () => void;
  sheetUrl?: string;
  apiUrl?: string;
  onOpenPreview?: (category: DrugCategory) => void;
  drugs?: DrugItem[];
  onDrugsChange?: (drugs: DrugItem[]) => void;
}

export const DrugInventoryView: React.FC<DrugInventoryViewProps> = ({
  currentUser,
  onBack,
  sheetUrl,
  apiUrl,
  onOpenPreview,
  drugs: externalDrugs,
  onDrugsChange,
}) => {
  const [activeTab, setActiveTab] = useState<DrugCategory>('monthly');
  const [drugs, setDrugs] = useState<DrugItem[]>(() => {
    if (externalDrugs && externalDrugs.length > 0) {
      return externalDrugs;
    }
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

  // Sync when external drugs change (e.g. from restore backup or Google Sheets sync)
  useEffect(() => {
    if (externalDrugs && Array.isArray(externalDrugs)) {
      setDrugs(externalDrugs);
    }
  }, [externalDrugs]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'expired'>('all');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DrugItem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Horizontal scroll container ref for Shift+Wheel on PC
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // New Drug Form State
  const [newDrugName, setNewDrugName] = useState('');
  const [newRemaining, setNewRemaining] = useState<number>(10);
  const [newReceivedDate, setNewReceivedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newReceivedQty, setNewReceivedQty] = useState<number>(10);
  const [newMinStock, setNewMinStock] = useState<number>(10);
  const [newBatchRequest, setNewBatchRequest] = useState<string>('10');
  const [newUnit, setNewUnit] = useState<string>('');
  const [newExpDate, setNewExpDate] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  // Edit Drug State & Form
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);
  const [editDrugName, setEditDrugName] = useState('');
  const [editCategory, setEditCategory] = useState<DrugCategory>('monthly');
  const [editRemaining, setEditRemaining] = useState<number>(0);
  const [editReceivedDate, setEditReceivedDate] = useState<string>('');
  const [editReceivedQty, setEditReceivedQty] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(0);
  const [editBatchRequest, setEditBatchRequest] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('');
  const [editExpDate, setEditExpDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Persist to localStorage on change and notify parent
  useEffect(() => {
    try {
      localStorage.setItem('anesthesia_drug_inventory', JSON.stringify(drugs));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
    if (onDrugsChange) {
      onDrugsChange(drugs);
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

  // PC Scroll Experience: Allow Shift + Mouse Wheel for horizontal scrolling
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [viewMode]);

  // Local Save: Saves only within application memory and localStorage (Never calls Google Sheets)
  const handleSaveData = () => {
    try {
      localStorage.setItem('anesthesia_drug_inventory', JSON.stringify(drugs));
      setSaveSuccessMsg('✓ บันทึกข้อมูลลงในแอปเรียบร้อยแล้ว (บันทึกเฉพาะในแอป)');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const [isSyncingGas, setIsSyncingGas] = useState(false);

  // Send Report to Google Sheets and auto-open the Sheet
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
          unit: d.unit || '',
          expDate: d.expDate,
          note: d.note,
        })),
      });
      setSaveSuccessMsg(`✓ ส่ง Report "${catName}" เข้า Google Sheet เรียบร้อยแล้ว`);
      if (sheetUrl) {
        window.open(sheetUrl, '_blank');
      }
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
      unit: newUnit.trim() || undefined,
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
    setNewUnit('');
    setNewExpDate('');
    setNewNote('');
    setSaveSuccessMsg(`✓ เพิ่มรายการ "${newItem.name}" เรียบร้อยแล้ว`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleOpenEditDrug = (item: DrugItem) => {
    setEditingDrug(item);
    setEditDrugName(item.name);
    setEditCategory(item.category);
    setEditRemaining(item.remaining);
    setEditReceivedDate(item.receivedDate || '');
    setEditReceivedQty(item.receivedQty || 0);
    setEditMinStock(item.minStock);
    setEditBatchRequest(item.batchRequest || '');
    setEditUnit(item.unit || '');
    setEditExpDate(item.expDate || '');
    setEditNote(item.note || '');
  };

  const handleSaveEditDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDrug) return;
    if (!editDrugName.trim()) {
      alert('กรุณากรอกชื่อยาหรือสารน้ำ');
      return;
    }

    setDrugs((prev) =>
      prev.map((d) => {
        if (d.id === editingDrug.id) {
          return {
            ...d,
            name: editDrugName.trim(),
            category: editCategory,
            remaining: Number(editRemaining) || 0,
            receivedDate: editReceivedDate,
            receivedQty: Number(editReceivedQty) || 0,
            minStock: Number(editMinStock) || 0,
            batchRequest: editBatchRequest.trim(),
            unit: editUnit.trim() || undefined,
            expDate: editExpDate,
            note: editNote.trim(),
          };
        }
        return d;
      })
    );

    setEditingDrug(null);
    setSaveSuccessMsg(`✓ แก้ไขข้อมูล "${editDrugName.trim()}" เรียบร้อยแล้ว`);
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

        {/* Action Buttons: Add Drug, Save, Sync to Gas */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            title="เพิ่มรายการยาหรือสารน้ำใหม่"
          >
            <Plus className="w-4 h-4" />
            <span>➕ เพิ่มรายการยาใหม่</span>
          </button>

          <button
            type="button"
            onClick={handleSaveData}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            title="บันทึกข้อมูลเฉพาะภายในแอป (ไม่ส่งไปยัง Google Sheets)"
          >
            <Save className="w-4 h-4" />
            <span>บันทึก</span>
          </button>

          {/* Sync & Create Sheet in Google Sheets + Auto Open */}
          {apiUrl && (
            <button
              type="button"
              disabled={isSyncingGas}
              onClick={handleSyncToGas}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="ส่ง Report ข้อมูลหมวดนี้เข้า Google Sheets และเปิดหน้าชีตทันที"
            >
              <Send className="w-4 h-4" />
              <span>{isSyncingGas ? 'กำลังส่งข้อมูล...' : 'ส่ง Report เข้า Google Sheets'}</span>
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
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
              ข้อมูล ณ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
                title="ตาราง 8 คอลัมน์ (มี Sticky ตรึงชื่อยา)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>ตาราง 8 คอลัมน์</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
                title="มุมมองการ์ดสรุป"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>การ์ด</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Main 8-Column Table View (Sticky Column & Touch Experience) */}
        {viewMode === 'table' ? (
          <div
            ref={tableContainerRef}
            className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs table-horizontal-scrollbar bg-white dark:bg-[#161822]"
            style={{
              overflowX: 'auto',
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table className="w-full border-collapse text-xs min-w-[880px]">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-bold border-b border-neutral-200 dark:border-neutral-700 text-center">
                  {/* Col 1: ชนิดยา/สารน้ำ (Sticky Column) */}
                  <th
                    className="py-3.5 px-3.5 text-left min-w-[200px] sm:min-w-[240px] font-bold text-neutral-800 dark:text-neutral-200 sticky left-0 z-20 bg-neutral-100 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 shadow-[2px_0_5px_rgba(0,0,0,0.04)]"
                    style={{ position: 'sticky', left: 0, zIndex: 20 }}
                  >
                    ชนิดยา/สารน้ำ
                  </th>
                  {/* Col 2: คงเหลือ */}
                  <th className="py-3.5 px-2 text-center w-24 sm:w-28 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    คงเหลือ
                  </th>
                  {/* Col 3: วันที่รับ */}
                  <th className="py-3.5 px-2 text-center w-32 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    วันที่รับ
                  </th>
                  {/* Col 4: จำนวนรับ */}
                  <th className="py-3.5 px-2 text-center w-20 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    จำนวนรับ
                  </th>
                  {/* Col 5: รวม */}
                  <th className="py-3.5 px-2 text-center w-20 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    รวม
                  </th>
                  {/* Col 6: ยอดต่ำสุด */}
                  <th className="py-3.5 px-2 text-center w-24 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    ยอดต่ำสุด
                  </th>
                  {/* Col 7: เบิกครั้งละ */}
                  <th className="py-3.5 px-2 text-center w-24 font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90 whitespace-nowrap">
                    เบิกครั้งละ
                  </th>
                  {/* Col 8: หมายเหตุ */}
                  <th className="py-3.5 px-3 text-left min-w-[190px] font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800/90">
                    หมายเหตุ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800 bg-white dark:bg-[#161822]">
                {displayedDrugs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-neutral-400">
                      ไม่พบรายการยาหรือสารน้ำที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  displayedDrugs.map((item) => {
                    const totalQty = (Number(item.remaining) || 0) + (Number(item.receivedQty) || 0);
                    const isLowStock = Number(item.remaining) <= Number(item.minStock);
                    const expInfo = getExpirationInfo(item.expDate);
                    const isExpired = expInfo.status === 'expired';
                    const isExpiringSoon = expInfo.status === 'expiring';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isExpired
                            ? 'bg-rose-50/20 dark:bg-rose-950/15 hover:bg-rose-50/40 dark:hover:bg-rose-950/25'
                            : isLowStock
                            ? 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/35 dark:hover:bg-amber-950/20'
                            : isExpiringSoon
                            ? 'bg-orange-50/15 dark:bg-orange-950/10 hover:bg-orange-50/30 dark:hover:bg-orange-950/20'
                            : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40'
                        }`}
                      >
                        {/* 1. ชนิดยา/สารน้ำ (Sticky Column) */}
                        <td
                          className={`py-3.5 px-3.5 text-left sticky left-0 z-10 border-r border-neutral-200 dark:border-neutral-700/80 shadow-[2px_0_5px_rgba(0,0,0,0.04)] transition-colors ${
                            isExpired
                              ? 'bg-rose-50/80 dark:bg-[#191517]'
                              : isLowStock
                              ? 'bg-amber-50/70 dark:bg-[#191816]'
                              : isExpiringSoon
                              ? 'bg-orange-50/50 dark:bg-[#181816]'
                              : 'bg-white dark:bg-[#161822]'
                          }`}
                          style={{ position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          <div className="space-y-1">
                            <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 block leading-snug">
                              {item.name}
                              {item.unit && (
                                <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400 ml-1.5">
                                  ({item.unit})
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.expDate && (
                                <span className="text-[10.5px] text-neutral-400 dark:text-neutral-400 font-mono">
                                  Exp: {item.expDate}
                                </span>
                              )}
                              {isLowStock && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-amber-100/70 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40">
                                  สต็อกต่ำ
                                </span>
                              )}
                              {isExpired && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-rose-100/70 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40">
                                  หมดอายุ
                                </span>
                              )}
                              {isExpiringSoon && !isExpired && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-orange-100/60 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/40">
                                  ใกล้หมดอายุ
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. คงเหลือ */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1 bg-neutral-50 dark:bg-neutral-800/80 px-1 py-0.5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateField(item.id, 'remaining', Math.max(0, (Number(item.remaining) || 0) - 1))}
                              className="w-5 h-5 rounded-md bg-white dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-xs cursor-pointer transition shrink-0 shadow-2xs"
                              title="ลดจำนวน (-1)"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.remaining}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'remaining', Math.max(0, Number(e.target.value) || 0))
                              }
                              className={`w-10 text-center font-bold text-xs outline-none bg-transparent ${
                                isLowStock ? 'text-amber-800 dark:text-amber-300' : 'text-neutral-900 dark:text-white'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateField(item.id, 'remaining', (Number(item.remaining) || 0) + 1)}
                              className="w-5 h-5 rounded-md bg-white dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-xs cursor-pointer transition shrink-0 shadow-2xs"
                              title="เพิ่มจำนวน (+1)"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* 3. วันที่รับ */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <input
                            type="date"
                            value={item.receivedDate || ''}
                            onChange={(e) => handleUpdateField(item.id, 'receivedDate', e.target.value)}
                            className="w-28 px-1.5 py-1 text-center text-[11px] bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500 font-medium"
                            title="วันที่รับยา/สารน้ำ"
                          />
                        </td>

                        {/* 4. จำนวนรับ */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={item.receivedQty}
                            onChange={(e) =>
                              handleUpdateField(item.id, 'receivedQty', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-16 px-1.5 py-1 text-center font-bold text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500"
                            title="จำนวนที่รับ"
                          />
                        </td>

                        {/* 5. รวม */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs shadow-2xs">
                            {totalQty}
                          </span>
                        </td>

                        {/* 6. ยอดต่ำสุด */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={item.minStock}
                            onChange={(e) =>
                              handleUpdateField(item.id, 'minStock', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-16 px-1.5 py-1 text-center font-semibold text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500"
                            title="ยอดต่ำสุด (Min Stock)"
                          />
                        </td>

                        {/* 7. เบิกครั้งละ */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <input
                            type="text"
                            value={item.batchRequest || ''}
                            onChange={(e) => handleUpdateField(item.id, 'batchRequest', e.target.value)}
                            placeholder="-"
                            className="w-20 px-1.5 py-1 text-center text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500 font-medium"
                            title="จำนวนที่เบิกในแต่ละครั้ง"
                          />
                        </td>

                        {/* 8. หมายเหตุ (พร้อมปุ่มจัดการแก้ไขและลบ) */}
                        <td className="py-3 px-3 text-left">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) => handleUpdateField(item.id, 'note', e.target.value)}
                              placeholder="ระบุหมายเหตุ..."
                              className="flex-1 px-2.5 py-1 text-left text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500 text-neutral-800 dark:text-neutral-200"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenEditDrug(item)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer shrink-0"
                              title="แก้ไขข้อมูลยา"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer shrink-0"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 2. Compact Card View (Clean & Interactive on Mobile) */
          <div className="space-y-3">
            {displayedDrugs.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                ไม่พบรายการยาหรือสารน้ำในหมวดนี้
              </div>
            ) : (
              displayedDrugs.map((item, idx) => {
                const totalQty = (Number(item.remaining) || 0) + (Number(item.receivedQty) || 0);
                const isLowStock = Number(item.remaining) <= Number(item.minStock);
                const expInfo = getExpirationInfo(item.expDate);
                const isExpired = expInfo.status === 'expired';
                const isExpiringSoon = expInfo.status === 'expiring';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isExpired
                        ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/15 dark:bg-rose-950/10'
                        : isLowStock
                        ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/15 dark:bg-amber-950/10'
                        : isExpiringSoon
                        ? 'border-orange-200 dark:border-orange-900/40 bg-orange-50/10 dark:bg-orange-950/5'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-neutral-400 shrink-0">#{idx + 1}</span>
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {item.name}
                          {item.unit && (
                            <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400 ml-1.5">
                              ({item.unit})
                            </span>
                          )}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLowStock && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md font-medium bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40 whitespace-nowrap">
                            สต็อกต่ำ
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md font-medium bg-rose-100/70 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40 whitespace-nowrap">
                            หมดอายุ
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditDrug(item)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                          title="แก้ไขข้อมูลยา"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
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
                            isLowStock ? 'text-amber-800 dark:text-amber-300' : 'text-neutral-900 dark:text-white'
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

                    {/* Details row: Min, Batch, Received Date */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                      <div className="flex flex-col bg-white dark:bg-neutral-800/50 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center">
                        <span className="text-[10px] text-neutral-400">ยอดต่ำสุด</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{item.minStock}</span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-neutral-800/50 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center">
                        <span className="text-[10px] text-neutral-400">เบิกครั้งละ</span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{item.batchRequest || '-'}</span>
                      </div>
                      <div className="flex flex-col bg-white dark:bg-neutral-800/50 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center">
                        <span className="text-[10px] text-neutral-400">วันที่รับ</span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{item.receivedDate || '-'}</span>
                      </div>
                    </div>

                    {/* Interactive Date Picker for Exp Date & Editable Note on Mobile */}
                    <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800/80 px-2.5 py-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
                        <span className="text-[11px] text-neutral-400 font-medium shrink-0">วันหมดอายุ:</span>
                        <input
                          type="date"
                          value={item.expDate || ''}
                          onChange={(e) => handleUpdateField(item.id, 'expDate', e.target.value)}
                          className="bg-transparent text-neutral-800 dark:text-neutral-200 outline-none text-xs font-mono cursor-pointer flex-1"
                          title="แตะเพื่อเลือกวันหมดอายุ"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => handleUpdateField(item.id, 'note', e.target.value)}
                          placeholder="หมายเหตุเพิ่มเติม..."
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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
                    หน่วยนับ (เช่น หลอด, ขวด, amp, กล่อง)
                  </label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="เช่น หลอด / ขวด / amp"
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

      {/* Edit Drug Modal */}
      {editingDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>แก้ไขข้อมูลยา / สารน้ำ</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingDrug(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDrug} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  ชื่อยา / สารน้ำ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDrugName}
                  onChange={(e) => setEditDrugName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as DrugCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500 font-medium"
                  >
                    <option value="monthly">📅 ยาในคลังเดือน</option>
                    <option value="quarterly">📦 ยาเบิกทุก 3 เดือน</option>
                    <option value="adhoc">⚡ ยาเบิกเป็นครั้งๆ / ตามงบประมาณ</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    หน่วยนับ (เช่น หลอด, ขวด, amp)
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="เช่น หลอด, ขวด, amp"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    คงเหลือ
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRemaining}
                    onChange={(e) => setEditRemaining(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    ยอดต่ำสุด (Min Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(Number(e.target.value) || 0)}
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
                    value={editReceivedDate}
                    onChange={(e) => setEditReceivedDate(e.target.value)}
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
                    value={editReceivedQty}
                    onChange={(e) => setEditReceivedQty(Number(e.target.value) || 0)}
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
                    value={editBatchRequest}
                    onChange={(e) => setEditBatchRequest(e.target.value)}
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
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
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
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none border border-neutral-300 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDrug(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
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
