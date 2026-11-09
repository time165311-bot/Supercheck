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
import { parseExpDateObj } from '../utils/itemUtils';

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
  apiUrl: _apiUrl,
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

  // Calculate expiration status with robust Buddhist Era (พ.ศ.) and Gregorian parsing
  const getExpirationInfo = (expDate?: string) => {
    if (!expDate || expDate === '-' || expDate === 'null') return { text: 'ไม่ระบุวันหมดอายุ', status: 'none' as const };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = parseExpDateObj(expDate);
    if (!exp || isNaN(exp.getTime())) return { text: expDate, status: 'none' as const };
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
    <div className="space-y-4 max-w-6xl mx-auto pb-10 font-['TH_Sarabun_New','Sarabun',sans-serif]">
      {/* Toast Feedback Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-xl text-xs flex items-center gap-2 animate-in fade-in border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar - Clean One UI Palette (Royal Blue Gradient) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white p-4 rounded-3xl border border-blue-400/30 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer flex items-center justify-center border border-white/20"
            title="กลับหน้าหลัก"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
              ระบบคลังยาและสารน้ำ (Medicine Inventory)
            </h2>
            <p className="text-xs text-blue-100/90 font-medium">
              ตรวจสอบสต็อก ยอดคงเหลือ และวันหมดอายุคลังยาวิสัญญี
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onOpenPreview && (
            <button
              onClick={() => onOpenPreview(activeTab)}
              className="px-3.5 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>พิมพ์แบบฟอร์มรายงาน A4</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายการยาใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs: Horizontal Scrollable Pill Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
            activeTab === 'monthly'
              ? 'bg-blue-600 text-white shadow-md font-extrabold'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>💊 ยาและสารน้ำประจำเดือน</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quarterly')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
            activeTab === 'quarterly'
              ? 'bg-blue-600 text-white shadow-md font-extrabold'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>🚨 ยาความเสี่ยงสูง/กู้ชีพ (3 เดือน)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('adhoc')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
            activeTab === 'adhoc'
              ? 'bg-blue-600 text-white shadow-md font-extrabold'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>📦 ยาฉุกเฉินเฉพาะกิจ (ครั้งคราว)</span>
        </button>
      </div>

      {/* Search & Status Filter Control Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อยา, สารน้ำ, รหัสบาร์โค้ด..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100 font-medium text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({drugs.filter((d) => d.category === activeTab).length})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              สต็อกต่ำ
            </button>
            <button
              onClick={() => setStatusFilter('expiring')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expiring'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ใกล้หมดอายุ
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expired'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              หมดอายุแล้ว
            </button>
          </div>
        </div>

        {/* Quick Batch Check Action Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            พบ <b>{displayedDrugs.length}</b> รายการยาในหมวดนี้
          </span>

          <button
            onClick={handleBatchCheckAll}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>บันทึกเช็คปกติครบทุกรายการ</span>
          </button>
        </div>
      </div>

      {/* Clean Inventory List View */}
      {displayedDrugs.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs">
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
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-150 transform-gpu contain-content flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs hover:border-blue-300 ${
                  isExpired
                    ? 'bg-rose-50/70 border-rose-200'
                    : isExpiringSoon
                    ? 'bg-amber-50/70 border-amber-200'
                    : isLowStock
                    ? 'bg-orange-50/70 border-orange-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Left Info Column */}
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setDetailItem(item)}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-black border border-blue-100 flex items-center justify-center shrink-0 text-sm">
                    {idx + 1}
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate leading-tight">
                        {item.name}
                      </h3>
                      {item.unit && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 shrink-0">
                          {item.unit}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap font-sans">
                      <span>
                        คงเหลือ: <b className="text-slate-900 font-extrabold">{item.remaining}</b> {item.unit || ''} (Min: {item.minStock})
                      </span>
                      {item.expDate && (
                        <span className={`flex items-center gap-1 font-semibold ${isCurrentYear ? 'text-rose-600 font-bold' : ''}`}>
                          <span>EXP: <span className={isCurrentYear ? 'underline' : ''}>{item.expDate}</span></span>
                          {isCurrentYear && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold border border-rose-200 shrink-0">
                              EXP ปีนี้
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions & Stepper Controls */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Status Badge */}
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 ${
                      isExpired
                        ? 'bg-rose-600 text-white'
                        : isExpiringSoon
                        ? 'bg-amber-500 text-white'
                        : isLowStock
                        ? 'bg-orange-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {isExpired ? 'หมดอายุ' : isExpiringSoon ? 'ใกล้หมดอายุ' : isLowStock ? 'สต็อกต่ำ' : 'ปกติ'}
                  </div>

                  {/* Quantity Stepper [-] count [+] */}
                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeltaQty(item.id, -1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
                      title="ลดจำนวน 1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center font-extrabold text-xs text-slate-900">
                      {item.remaining}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeltaQty(item.id, 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
                      title="เพิ่มจำนวน 1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Detail Modal Button (ℹ️ รายละเอียด) */}
                  <button
                    onClick={() => setDetailItem(item)}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-blue-100"
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
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        title="แก้ไขข้อมูลยา"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 transition cursor-pointer"
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

      {/* Quick Detail Pop-up Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto relative font-sans">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  รายละเอียดข้อมูลยาและสารน้ำ
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {detailItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block font-medium">ยอดคงเหลือในคลัง</span>
                <span className="text-lg font-black text-blue-600">{detailItem.remaining} {detailItem.unit || ''}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block font-medium">ยอดขั้นต่ำ (Min Stock)</span>
                <span className="text-lg font-black text-slate-700">{detailItem.minStock} {detailItem.unit || ''}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block font-medium">วันที่รับเข้า</span>
                <span className="text-xs font-bold text-slate-800">{detailItem.receivedDate || '-'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block font-medium">วันหมดอายุ (EXP)</span>
                <span className="text-xs font-bold text-rose-600">{detailItem.expDate || '-'}</span>
              </div>
            </div>

            {detailItem.note && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <b>หมายเหตุ:</b> {detailItem.note}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Drug Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto relative font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>{editingDrug ? 'แก้ไขรายการยา/สารน้ำ' : 'เพิ่มรายการยา/สารน้ำใหม่'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDrugForm} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ชื่อยา / สารน้ำ <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น Atropine 0.6 mg/ml"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">หมวดหมู่ยา</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as DrugCategory)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="monthly">💊 ยาและสารน้ำประจำเดือน</option>
                  <option value="quarterly">🚨 ยาความเสี่ยงสูง/กู้ชีพ (3 เดือน)</option>
                  <option value="adhoc">📦 ยาฉุกเฉินเฉพาะกิจ (ครั้งคราว)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">จำนวนคงเหลือ</label>
                  <input
                    type="number"
                    value={formRemaining}
                    onChange={(e) => setFormRemaining(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ยอดขั้นต่ำ (Min)</label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="เช่น amp, vial, bottle"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">วันหมดอายุ (EXP)</label>
                  <input
                    type="text"
                    value={formExpDate}
                    onChange={(e) => setFormExpDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น เก็บในตู้เย็น 2-8°C"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 border border-slate-200 shadow-2xl font-sans text-xs">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>ยืนยันการลบรายการยา</span>
            </h3>
            <p className="text-slate-700">
              คุณต้องการลบรายการยา <b>"{itemToDelete.name}"</b> ออกจากคลังใช่หรือไม่?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs cursor-pointer"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
