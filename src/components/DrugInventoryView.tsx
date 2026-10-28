import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Minus,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
  Package,
  Save,
  FileSpreadsheet,
} from 'lucide-react';
import { DrugCategory, DrugItem, User } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';

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
  // Active Tab: 'monthly' (ประจำเดือน) | 'quarterly' (3 เดือน) | 'adhoc' (ครั้งคราว)
  const [activeTab, setActiveTab] = useState<DrugCategory>('monthly');

  // Internal drug state fallback
  const [internalDrugs, setInternalDrugs] = useState<DrugItem[]>(INITIAL_DRUGS_DATA);
  const drugs = externalDrugs || internalDrugs;

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'expired'>('all');

  // Quick Detail Modal State (Pop-up Modal)
  const [detailItem, setDetailItem] = useState<DrugItem | null>(null);

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DrugItem | null>(null);

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DrugCategory>('monthly');
  const [formRemaining, setFormRemaining] = useState<number>(10);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formBatchRequest, setFormBatchRequest] = useState('10');
  const [formUnit, setFormUnit] = useState('amp');
  const [formReceivedDate, setFormReceivedDate] = useState('');
  const [formReceivedQty, setFormReceivedQty] = useState<number>(0);
  const [formExpDate, setFormExpDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formBarcode, setFormBarcode] = useState('');

  // Toast Feedback state
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Helper to update drugs list
  const updateDrugsList = (nextList: DrugItem[]) => {
    if (onDrugsChange) {
      onDrugsChange(nextList);
    } else {
      setInternalDrugs(nextList);
    }
  };

  // Check if expiration date is in current year (2026 / 2569)
  const isExpCurrentYear = (dateStr?: string) => {
    if (!dateStr) return false;
    const str = String(dateStr).trim();
    if (!str || str === '-' || str === 'null') return false;
    const currentYearAD = new Date().getFullYear(); // 2026
    const currentYearBE = currentYearAD + 543;       // 2569
    const shortAD = String(currentYearAD).slice(-2); // "26"
    const shortBE = String(currentYearBE).slice(-2); // "69"
    return (
      str.includes(String(currentYearAD)) ||
      str.includes(String(currentYearBE)) ||
      new RegExp(`[\\/.-]${shortAD}$`).test(str) ||
      new RegExp(`[\\/.-]${shortBE}$`).test(str)
    );
  };

  // Calculate expiration status
  const getExpirationInfo = (expDate?: string) => {
    if (!expDate) return { text: 'ไม่ระบุวันหมดอายุ', status: 'none' as const };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return { text: expDate, status: 'none' as const };
    exp.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: 'หมดอายุแล้ว', status: 'expired' as const };
    if (diff <= 90) return { text: `เหลือ ${diff} วัน`, status: 'expiring' as const };
    return { text: expDate, status: 'ok' as const };
  };

  // Filtered list of drugs for active tab
  const displayedDrugs = useMemo(() => {
    return drugs.filter((d) => {
      if (d.category !== activeTab) return false;

      // Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = d.name.toLowerCase().includes(q);
        const matchBarcode = d.barcode?.toLowerCase().includes(q);
        const matchNote = d.note?.toLowerCase().includes(q);
        if (!matchName && !matchBarcode && !matchNote) return false;
      }

      // Status Filter
      const expInfo = getExpirationInfo(d.expDate);
      const isLowStock = Number(d.remaining) <= Number(d.minStock);
      const isExpired = expInfo.status === 'expired';
      const isExpiring = expInfo.status === 'expiring';

      if (statusFilter === 'low' && !isLowStock) return false;
      if (statusFilter === 'expiring' && !isExpiring) return false;
      if (statusFilter === 'expired' && !isExpired) return false;

      return true;
    });
  }, [drugs, activeTab, searchTerm, statusFilter]);

  // Adjust stock count (+/-)
  const handleDeltaQty = (drugId: string, delta: number) => {
    const nextList = drugs.map((d) => {
      if (d.id === drugId) {
        const nextRem = Math.max(0, Number(d.remaining || 0) + delta);
        return { ...d, remaining: nextRem };
      }
      return d;
    });
    updateDrugsList(nextList);

    // Sync detail item modal if open
    if (detailItem && detailItem.id === drugId) {
      setDetailItem((prev) => (prev ? { ...prev, remaining: Math.max(0, Number(prev.remaining || 0) + delta) } : null));
    }
  };

  // Batch Check All Normal
  const handleBatchCheckAll = () => {
    const tabLabel = activeTab === 'monthly' ? 'ประจำเดือน' : activeTab === 'quarterly' ? '3 เดือน' : 'ครั้งคราว';
    showToast(`✓ บันทึกเช็คปกติครบทุกรายการในหมวด [${tabLabel}] เรียบร้อยแล้ว`);
    if (onCelebrate) onCelebrate();
  };

  // Open Edit Modal
  const handleOpenEdit = (drug: DrugItem) => {
    setEditingDrug(drug);
    setFormName(drug.name);
    setFormCategory(drug.category);
    setFormRemaining(drug.remaining);
    setFormMinStock(drug.minStock);
    setFormBatchRequest(drug.batchRequest || '10');
    setFormUnit(drug.unit || 'amp');
    setFormReceivedDate(drug.receivedDate || '');
    setFormReceivedQty(drug.receivedQty || 0);
    setFormExpDate(drug.expDate || '');
    setFormNote(drug.note || '');
    setFormBarcode(drug.barcode || '');
    setShowAddModal(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingDrug(null);
    setFormName('');
    setFormCategory(activeTab);
    setFormRemaining(10);
    setFormMinStock(5);
    setFormBatchRequest('10');
    setFormUnit('amp');
    setFormReceivedDate(new Date().toISOString().split('T')[0]);
    setFormReceivedQty(10);
    setFormExpDate('');
    setFormNote('');
    setFormBarcode('');
    setShowAddModal(true);
  };

  // Save Add / Edit
  const handleSaveDrugForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('กรุณากรอกชื่อยา/สารน้ำ');
      return;
    }

    if (editingDrug) {
      const nextList = drugs.map((d) => {
        if (d.id === editingDrug.id) {
          return {
            ...d,
            name: formName.trim(),
            category: formCategory,
            remaining: Number(formRemaining),
            minStock: Number(formMinStock),
            batchRequest: formBatchRequest.trim(),
            unit: formUnit.trim(),
            receivedDate: formReceivedDate,
            receivedQty: Number(formReceivedQty),
            expDate: formExpDate,
            note: formNote.trim(),
            barcode: formBarcode.trim(),
          };
        }
        return d;
      });
      updateDrugsList(nextList);
      showToast(`✓ แก้ไขข้อมูลยา "${formName.trim()}" เรียบร้อยแล้ว`);
    } else {
      const newDrug: DrugItem = {
        id: `drug_${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        remaining: Number(formRemaining),
        minStock: Number(formMinStock),
        batchRequest: formBatchRequest.trim() || '10',
        unit: formUnit.trim() || 'amp',
        receivedDate: formReceivedDate,
        receivedQty: Number(formReceivedQty),
        expDate: formExpDate,
        note: formNote.trim(),
        barcode: formBarcode.trim(),
      };
      updateDrugsList([...drugs, newDrug]);
      showToast(`✓ เพิ่มรายการยา "${formName.trim()}" เรียบร้อยแล้ว`);
    }

    setShowAddModal(false);
  };

  // Confirm Delete
  const handleExecuteDelete = () => {
    if (!itemToDelete) return;
    const targetName = itemToDelete.name;
    const nextList = drugs.filter((d) => d.id !== itemToDelete.id);
    updateDrugsList(nextList);
    setItemToDelete(null);
    if (detailItem?.id === itemToDelete.id) setDetailItem(null);
    showToast(`✓ ลบรายการยา "${targetName}" เรียบร้อยแล้ว`);
  };

  const isAdmin = !currentUser || currentUser.role === 'admin';

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      {/* Toast Feedback Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-xl text-xs flex items-center gap-2 animate-in fade-in border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            title="กลับหน้าหลัก"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              ระบบคลังยาและสารน้ำ (Medicine Inventory)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ตรวจสอบสต็อก ยอดคงเหลือ และวันหมดอายุคลังยาวิสัญญี
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onOpenPreview && (
            <button
              onClick={() => onOpenPreview(activeTab)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>พิมพ์แบบฟอร์มรายงาน A4</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายการยาใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer text-center whitespace-nowrap ${
            activeTab === 'monthly'
              ? 'bg-accent text-white shadow-md font-extrabold'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>💊 ยาและสารน้ำประจำเดือน</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quarterly')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer text-center whitespace-nowrap ${
            activeTab === 'quarterly'
              ? 'bg-accent text-white shadow-md font-extrabold'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🚨 ยาความเสี่ยงสูง/กู้ชีพ (3 เดือน)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('adhoc')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer text-center whitespace-nowrap ${
            activeTab === 'adhoc'
              ? 'bg-accent text-white shadow-md font-extrabold'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📦 ยาฉุกเฉินเฉพาะกิจ (ครั้งคราว)</span>
        </button>
      </div>

      {/* Search & Status Filter Control Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อยา, สารน้ำ, รหัสบาร์โค้ด..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              ทั้งหมด ({drugs.filter((d) => d.category === activeTab).length})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              สต็อกต่ำ
            </button>
            <button
              onClick={() => setStatusFilter('expiring')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expiring'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              ใกล้หมดอายุ
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expired'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              หมดอายุแล้ว
            </button>
          </div>
        </div>

        {/* Quick Batch Check Action Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            พบ <b>{displayedDrugs.length}</b> รายการยาในหมวดนี้
          </span>

          <button
            onClick={handleBatchCheckAll}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>บันทึกเช็คปกติครบทุกรายการ</span>
          </button>
        </div>
      </div>

      {/* 1. Clean Inventory List View (Single-mode view, NO duplicate cards) */}
      {displayedDrugs.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
          ไม่พบรายการยาที่ตรงกับเงื่อนไขการค้นหา
        </div>
      ) : (
        <div className="space-y-2">
          {displayedDrugs.map((item, idx) => {
            const expInfo = getExpirationInfo(item.expDate);
            const isLowStock = Number(item.remaining) <= Number(item.minStock);
            const isExpired = expInfo.status === 'expired';
            const isExpiringSoon = expInfo.status === 'expiring';
            const isCurrentYear = isExpCurrentYear(item.expDate);

            return (
              <div
                key={item.id || idx}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs hover:border-accent/40 ${
                  isExpired
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                    : isExpiringSoon
                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                    : isLowStock
                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Left Info Column */}
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setDetailItem(item)}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-accent font-black border border-blue-100 dark:border-blue-900/40 flex items-center justify-center shrink-0 text-sm">
                    {idx + 1}
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                        {item.name}
                      </h3>
                      {item.unit && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 shrink-0">
                          {item.unit}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>
                        คงเหลือ: <b className="text-slate-800 dark:text-slate-200 font-extrabold">{item.remaining}</b> {item.unit || ''} (Min: {item.minStock})
                      </span>
                      {item.expDate && (
                        <span className={`font-semibold ${isCurrentYear ? 'text-red-600 font-bold' : ''}`}>
                          EXP: <span className={isCurrentYear ? 'text-red-600 font-bold underline' : ''}>{item.expDate}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions & Stepper Controls */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  {/* Status Badge */}
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 ${
                      isExpired
                        ? 'bg-rose-600 text-white'
                        : isExpiringSoon
                        ? 'bg-amber-500 text-white'
                        : isLowStock
                        ? 'bg-orange-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isExpired ? 'หมดอายุ' : isExpiringSoon ? 'ใกล้หมดอายุ' : isLowStock ? 'สต็อกต่ำ' : 'ปกติ'}
                  </div>

                  {/* Quantity Stepper [-] count [+] */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeltaQty(item.id, -1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
                      title="ลดจำนวน 1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center font-extrabold text-xs text-slate-800 dark:text-slate-100">
                      {item.remaining}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeltaQty(item.id, 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
                      title="เพิ่มจำนวน 1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 2. Quick Detail Modal Button (ℹ️ รายละเอียด) */}
                  <button
                    onClick={() => setDetailItem(item)}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-accent font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-blue-100 dark:border-blue-900/40"
                    title="ดูรายละเอียดข้อมูลยาครบถ้วน"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">รายละเอียด</span>
                  </button>

                  {/* Edit / Delete Buttons */}
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="แก้ไขข้อมูลยา"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="ลบรายการยา"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Quick Detail Pop-up Modal (Add Item Quick Detail Modal - รูป 48, 49) */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                  รายละเอียดข้อมูลยาและสารน้ำ
                </span>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">
                  {detailItem.name}
                </h3>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Grid Matching Official PDF Report Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* ชนิดยา/สารน้ำ */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [ชนิดยา / สารน้ำ]
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {detailItem.name}
                </p>
              </div>

              {/* ยอดต่ำสุด (Min) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [ยอดต่ำสุด (Min Stock)]
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {detailItem.minStock} {detailItem.unit || 'หน่วย'}
                </p>
              </div>

              {/* เบิกครั้งละ */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [เบิกครั้งละ]
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {detailItem.batchRequest || '10'} {detailItem.unit || ''}
                </p>
              </div>

              {/* วันรับยา / จำนวนรับ */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [วันรับยา / จำนวนรับ]
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {detailItem.receivedDate || '-'} ({detailItem.receivedQty || 0} {detailItem.unit || ''})
                </p>
              </div>

              {/* วันหมดอายุ (EXP) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-1 sm:col-span-2">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [วันหมดอายุ (EXP)]
                </span>
                <p className={`font-bold text-sm ${isExpCurrentYear(detailItem.expDate) ? 'text-red-600 font-black' : 'text-slate-800 dark:text-slate-100'}`}>
                  {detailItem.expDate || 'ไม่ระบุวันหมดอายุ'}
                  {isExpCurrentYear(detailItem.expDate) && (
                    <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                      ⚠️ หมดอายุปีนี้
                    </span>
                  )}
                </p>
              </div>

              {/* หมายเหตุ */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-1 sm:col-span-2">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                  [หมายเหตุ / สถานะเบิกจ่าย]
                </span>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {detailItem.note || 'ปกติ / สำรองครบถ้วน'}
                </p>
              </div>
            </div>

            {/* Stepper Control for Remaining Quantity Inside Modal */}
            <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-3">
              <div>
                <span className="block text-[11px] font-bold text-accent uppercase">
                  [ปรับจำนวนคงเหลือปัจจุบัน]
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  กดปุ่ม + / - เพื่ออัปเดตยอดเรียลไทม์
                </span>
              </div>

              <div className="flex items-center bg-white dark:bg-slate-800 rounded-2xl p-1 border border-blue-200 dark:border-blue-900 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleDeltaQty(detailItem.id, -1)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition cursor-pointer active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-extrabold text-base text-accent">
                  {detailItem.remaining}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeltaQty(detailItem.id, 1)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. Clean Check Button (3. ปรับแต่งปุ่มบันทึกเช็คให้คลีน ไม่ลิเก) */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    handleOpenEdit(item);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  <span>แก้ไขข้อมูล</span>
                </button>
              )}

              {/* Clean Vector Checkmark Button (100% Sport/Minimal Style, No duplicate emojis) */}
              <button
                type="button"
                onClick={() => {
                  showToast(`✓ บันทึกการเช็ค "${detailItem.name}" เรียบร้อยแล้ว`);
                  setDetailItem(null);
                  if (onCelebrate) onCelebrate();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer leading-normal"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>บันทึกการเช็ค</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveDrugForm}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingDrug ? 'แก้ไขข้อมูลยา / สารน้ำ' : 'เพิ่มรายการยาใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as DrugCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="monthly">ประจำเดือน (คลังยาหลัก)</option>
                  <option value="quarterly">3 เดือน (ยาความเสี่ยงสูง/กู้ชีพ)</option>
                  <option value="adhoc">ครั้งคราว (ยาฉุกเฉินเฉพาะกิจ)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อยา / สารน้ำเต็ม
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น Adrenaline 1 mg/ml amp"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนคงเหลือ
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formRemaining}
                    onChange={(e) => setFormRemaining(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ยอดต่ำสุด (Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เบิกครั้งละ
                  </label>
                  <input
                    type="text"
                    value={formBatchRequest}
                    onChange={(e) => setFormBatchRequest(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หน่วยนับ
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="amp, vial, bottle"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    วันที่รับยา
                  </label>
                  <input
                    type="date"
                    value={formReceivedDate}
                    onChange={(e) => setFormReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนที่รับ
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formReceivedQty}
                    onChange={(e) => setFormReceivedQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  วันหมดอายุ (EXP)
                </label>
                <input
                  type="date"
                  value={formExpDate}
                  onChange={(e) => setFormExpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="ระบุสถานะเบิกจ่าย หรือสำรอง"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:bg-accent-hover transition cursor-pointer shadow-sm"
              >
                {editingDrug ? 'บันทึกการแก้ไข' : 'เพิ่มรายการยา'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <Trash2 className="w-5 h-5" />
              <span>ยืนยันการลบรายการยา?</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              คุณต้องการลบรายการยา <b>"{itemToDelete.name}"</b> ออกจากระบบคลังยาหรือไม่? การดำเนินการนี้จะลบข้อมูลออกถาวร
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer shadow-xs"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
