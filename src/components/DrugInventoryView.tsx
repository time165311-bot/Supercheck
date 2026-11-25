import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
  Package,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  DrugCategory,
  DrugItem,
  DrugLotBatch,
  RestockRequisition,
  User,
} from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';
import { recomputeDrugFromLots } from '../utils/itemUtils';
import { isValidInventoryItem } from '../utils/inventoryStats';
import {
  diffDaysFromBangkokToday,
  getBangkokTodayIso,
  isCurrentYearExpBangkok,
  normalizeExpDateToIso,
} from '../utils/dateUtils';
import {
  canApproveRequisition,
  subscribeRestockRequisitions,
  saveRestockRequisitionWorkflow,
  transitionRestockRequisitionStatus,
  receiveRestockRequisitionTransaction,
} from '../services/firestoreService';
import { useDataContext } from '../context/DataContext';
import { DrugItemCard } from './ItemCard';
import { MinimalExpiryDatePicker } from './MinimalExpiryDatePicker';

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
  currentUser: _currentUser,
  onBack: _onBack,
  apiUrl: _apiUrl,
  onOpenPreview,
  drugs: externalDrugs,
  onDrugsChange,
  onCelebrate,
}) => {
  const { activeChannelId } = useDataContext();
  const canApprove = canApproveRequisition(_currentUser);

  // Active Tab: 'monthly' (ประจำเดือน) | 'quarterly' (3 เดือน) | 'adhoc' (ครั้งคราว)
  const [activeTab, setActiveTab] = useState<DrugCategory>('monthly');

  // Internal drug state fallback
  const [internalDrugs, setInternalDrugs] = useState<DrugItem[]>(INITIAL_DRUGS_DATA);
  const drugs = useMemo(
    () =>
      (externalDrugs || internalDrugs)
        .filter((d) => isValidInventoryItem(d))
        .map((d) => ({
          ...d,
          category:
            d.category === 'monthly' || d.category === 'quarterly' || d.category === 'adhoc'
              ? d.category
              : 'monthly',
        })),
    [externalDrugs, internalDrugs]
  );

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'expired'>('all');

  // Quick Detail Modal State (Pop-up Modal)
  const [detailItem, setDetailItem] = useState<DrugItem | null>(null);

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DrugItem | null>(null);
  const [showClearCategoryConfirm, setShowClearCategoryConfirm] = useState(false);
  const [formError, setFormError] = useState<string>('');

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
  const [formTmtCode, setFormTmtCode] = useState('');
  const [formHospitalDrugCode, setFormHospitalDrugCode] = useState('');
  const [formLotNumber, setFormLotNumber] = useState('');
  const [formLots, setFormLots] = useState<DrugLotBatch[]>([]);

  // Restock Requisition Workflow Modal State
  const [showRequisitionsModal, setShowRequisitionsModal] = useState(false);
  const [requisitions, setRequisitions] = useState<RestockRequisition[]>([]);
  const [isReqBusy, setIsReqBusy] = useState(false);

  // Toast Feedback state
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  useEffect(() => {
    const unsub = subscribeRestockRequisitions(activeChannelId || 'channel_master', (items) => {
      setRequisitions(items);
    });
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [activeChannelId]);

  // Helper to update drugs list
  const updateDrugsList = (nextList: DrugItem[]) => {
    if (onDrugsChange) {
      onDrugsChange(nextList);
    } else {
      setInternalDrugs(nextList);
    }
  };

  // Bulk action: Clear all drugs in the current active tab
  const handleClearAllCategory = () => {
    setShowClearCategoryConfirm(true);
  };

  const executeClearAllCategory = () => {
    const categoryName = activeTab === 'monthly' ? 'ประจำเดือน' : activeTab === 'quarterly' ? '3 เดือน' : 'ครั้งคราว';
    const nextList = drugs.filter((d) => d.category !== activeTab);
    updateDrugsList(nextList);
    setShowClearCategoryConfirm(false);
    showToast(`🗑️ เคลียร์รายการในหมวด ${categoryName} เรียบร้อยแล้วค่ะ`);
  };

  // Check if expiration date is in current year (Asia/Bangkok UTC+7)
  const isExpCurrentYear = (dateStr?: string) => {
    return isCurrentYearExpBangkok(dateStr);
  };

  // Calculate expiration status with strict Asia/Bangkok (UTC+7) date diff & Buddhist Era normalization
  const getExpirationInfo = (expDate?: string) => {
    if (!expDate || expDate === '-' || expDate === 'null') {
      return { text: 'ไม่ระบุวันหมดอายุ', status: 'none' as const };
    }
    const diff = diffDaysFromBangkokToday(expDate);
    if (diff === null) return { text: expDate, status: 'none' as const };
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
  const handleDeltaQty = useCallback((drugId: string, delta: number) => {
    const nextList = drugs.map((d) => {
      if (d.id === drugId) {
        const nextRem = Math.max(0, Number(d.remaining || 0) + delta);
        return { ...d, remaining: nextRem };
      }
      return d;
    });
    updateDrugsList(nextList);

    // Sync detail item modal if open
    setDetailItem((prev) =>
      prev && prev.id === drugId
        ? { ...prev, remaining: Math.max(0, Number(prev.remaining || 0) + delta) }
        : prev
    );
  }, [drugs]);

  // Batch Check All Normal
  const handleBatchCheckAll = () => {
    const tabLabel = activeTab === 'monthly' ? 'ประจำเดือน' : activeTab === 'quarterly' ? '3 เดือน' : 'ครั้งคราว';
    showToast(`✓ บันทึกเช็คปกติครบทุกรายการในหมวด [${tabLabel}] เรียบร้อยแล้ว`);
    if (onCelebrate) onCelebrate();
  };

  // Open Edit Modal
  const handleOpenEdit = useCallback((drug: DrugItem) => {
    setFormError('');
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
    setFormTmtCode(drug.tmtCode || '');
    setFormHospitalDrugCode(drug.hospitalDrugCode || '');
    setFormLotNumber(drug.lotNumber || '');
    setFormLots(Array.isArray(drug.lots) ? drug.lots : []);
    setShowAddModal(true);
  }, []);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingDrug(null);
    setFormName('');
    setFormCategory(activeTab);
    setFormRemaining(10);
    setFormMinStock(5);
    setFormBatchRequest('10');
    setFormUnit('amp');
    setFormReceivedDate(getBangkokTodayIso());
    setFormReceivedQty(10);
    setFormExpDate('');
    setFormNote('');
    setFormBarcode('');
    setFormTmtCode('');
    setFormHospitalDrugCode('');
    setFormLotNumber('');
    setFormLots([]);
    setShowAddModal(true);
  };

  // Save Add / Edit
  const handleSaveDrugForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('กรุณากรอกชื่อยา/สารน้ำ');
      return;
    }
    setFormError('');

    const normalizedExp = normalizeExpDateToIso(formExpDate) || formExpDate.trim();
    const cleanedLots: DrugLotBatch[] = formLots
      .filter((l) => l.lotNumber.trim() || l.expiryDate.trim() || l.quantity > 0)
      .map((l) => ({
        lotNumber: l.lotNumber.trim() || 'LOT-DEFAULT',
        expiryDate: normalizeExpDateToIso(l.expiryDate) || l.expiryDate.trim(),
        quantity: Math.max(0, Number(l.quantity) || 0),
        receivedDate: l.receivedDate || getBangkokTodayIso(),
      }));

    if (editingDrug) {
      const nextList = drugs.map((d) => {
        if (d.id === editingDrug.id) {
          const updatedBase: DrugItem = {
            ...d,
            name: formName.trim(),
            category: formCategory,
            remaining: Number(formRemaining),
            minStock: Number(formMinStock),
            batchRequest: formBatchRequest.trim(),
            unit: formUnit.trim(),
            receivedDate: formReceivedDate,
            receivedQty: Number(formReceivedQty),
            expDate: normalizedExp,
            note: formNote.trim(),
            barcode: formBarcode.trim(),
            tmtCode: formTmtCode.trim() || undefined,
            hospitalDrugCode: formHospitalDrugCode.trim() || undefined,
            lotNumber: formLotNumber.trim() || undefined,
            lots: cleanedLots.length > 0 ? cleanedLots : undefined,
            batches: cleanedLots.length > 0 ? cleanedLots : undefined,
          };
          return cleanedLots.length > 0 ? recomputeDrugFromLots(updatedBase) : updatedBase;
        }
        return d;
      });
      updateDrugsList(nextList);
      showToast(`✓ แก้ไขข้อมูลยา "${formName.trim()}" เรียบร้อยแล้ว`);
    } else {
      const baseDrug: DrugItem = {
        id: `drug_${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        remaining: Number(formRemaining),
        minStock: Number(formMinStock),
        batchRequest: formBatchRequest.trim() || '10',
        unit: formUnit.trim() || 'amp',
        receivedDate: formReceivedDate,
        receivedQty: Number(formReceivedQty),
        expDate: normalizedExp,
        note: formNote.trim(),
        barcode: formBarcode.trim(),
        tmtCode: formTmtCode.trim() || undefined,
        hospitalDrugCode: formHospitalDrugCode.trim() || undefined,
        lotNumber: formLotNumber.trim() || undefined,
        lots: cleanedLots.length > 0 ? cleanedLots : undefined,
        batches: cleanedLots.length > 0 ? cleanedLots : undefined,
      };
      const newDrug = cleanedLots.length > 0 ? recomputeDrugFromLots(baseDrug) : baseDrug;
      updateDrugsList([...drugs, newDrug]);
      showToast(`✓ เพิ่มรายการยา "${formName.trim()}" เรียบร้อยแล้ว`);
    }

    setShowAddModal(false);
  };

  // Requisition Workflow Helpers
  const handleCreateLowStockRequisition = async (submitNow: boolean) => {
    const lowDrugs = drugs.filter((d) => Number(d.remaining || 0) <= Number(d.minStock || 0));
    if (lowDrugs.length === 0) {
      showToast('ไม่มียาที่ต่ำกว่าเกณฑ์ Min Stock ในขณะนี้');
      return;
    }
    setIsReqBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const newReq: RestockRequisition = {
        id: `REQ-${Date.now()}`,
        channelId: activeChannelId || 'channel_master',
        targetCategory: activeTab,
        requestedBy: _currentUser?.name || 'พยาบาลวิสัญญี',
        requestedById: _currentUser?.id,
        status: submitNow ? 'pending' : 'draft',
        notes: `ขอเบิกยาต่ำกว่า Min Stock (${lowDrugs.length} รายการ)`,
        items: lowDrugs.map((d, idx) => ({
          no: idx + 1,
          drugId: d.id,
          name: d.name,
          neededQty: Math.max(1, Number(d.batchRequest || d.minStock || 5)),
          approvedQty: Math.max(1, Number(d.batchRequest || d.minStock || 5)),
          receivedQty: Math.max(1, Number(d.batchRequest || d.minStock || 5)),
          unit: d.unit || 'amp',
          reason: `คงเหลือ ${d.remaining} (Min: ${d.minStock})`,
        })),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await saveRestockRequisitionWorkflow(newReq);
      showToast(submitNow ? `✓ ส่งใบเบิก ${newReq.id} รออนุมัติแล้ว` : `✓ บันทึกฉบับร่าง ${newReq.id} แล้ว`);
    } finally {
      setIsReqBusy(false);
    }
  };

  const handleTransitionReq = async (req: RestockRequisition, nextStatus: 'pending' | 'approved' | 'rejected') => {
    setIsReqBusy(true);
    try {
      const res = await transitionRestockRequisitionStatus({
        channelId: activeChannelId || 'channel_master',
        reqId: req.id,
        nextStatus,
        actor: _currentUser,
        rejectedReason: nextStatus === 'rejected' ? 'ไม่ผ่านเกณฑ์การอนุมัติคลังยา' : undefined,
      });
      if (!res.ok) {
        showToast(`⚠️ ${res.error || 'ไม่สามารถอัปเดตสถานะได้'}`);
      } else {
        showToast(`✓ อัปเดตใบเบิก ${req.id} เป็นสถานะ "${nextStatus}" เรียบร้อย`);
      }
    } finally {
      setIsReqBusy(false);
    }
  };

  const handleAtomicReceiveReq = async (req: RestockRequisition) => {
    setIsReqBusy(true);
    try {
      const res = await receiveRestockRequisitionTransaction({
        channelId: activeChannelId || 'channel_master',
        reqId: req.id,
        receivedItems: req.items,
        currentDrugs: drugs,
        actor: _currentUser,
      });
      if (!res.ok) {
        showToast(`⚠️ ${res.error || 'รับเข้าคลังไม่สำเร็จ'}`);
      } else {
        updateDrugsList(res.updatedDrugs);
        showToast(`✓ รับเข้าคลังใบเบิก ${req.id} และบันทึก Lot/Audit สำเร็จ`);
      }
    } finally {
      setIsReqBusy(false);
    }
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-['TH_Sarabun_New','Sarabun',sans-serif]">
      {/* Toast Feedback Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-md text-xs md:text-sm flex items-center gap-2 border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar - Clean One UI Palette (Gemini Dark Surface in Dark Mode) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 dark:from-[#1E1F20] dark:via-[#1A1B1C] dark:to-[#131314] text-white p-4 rounded-3xl border border-blue-400/30 dark:border-white/10 shadow-md">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">
              ระบบคลังยาและสารน้ำ (Medicine Inventory)
            </h2>
            <p className="text-xs md:text-sm text-blue-100/90 dark:text-[#C4C7C5] font-medium">
              ตรวจสอบสต็อก ยอดคงเหลือ และวันหมดอายุคลังยาวิสัญญี
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setShowRequisitionsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
          >
            <ClipboardList className="w-4 h-4" />
            <span>ใบเบิกยา ({requisitions.filter((r) => r.status === 'pending' || r.status === 'approved').length})</span>
          </button>

          {onOpenPreview && (
            <button
              onClick={() => onOpenPreview(activeTab)}
              className="px-3.5 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs md:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>พิมพ์แบบฟอร์มรายงาน A4</span>
            </button>
          )}

          <button
            onClick={() => {
              setFormError('');
              handleOpenAdd();
            }}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มรายการยาใหม่</span>
          </button>
        </div>
      </div>

      {/* Category Tabs: Horizontal Scrollable Pill Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 text-xs md:text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2.5 rounded-2xl transition-colors duration-150 active:opacity-80 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'monthly'
              ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-sm font-extrabold'
              : 'bg-white dark:bg-[#1E1F20] text-slate-700 dark:text-[#C4C7C5] hover:bg-slate-50 dark:hover:bg-[#282A2C] border border-slate-200 dark:border-white/10'
          }`}
        >
          <span>💊 ยาและสารน้ำประจำเดือน</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quarterly')}
          className={`px-4 py-2.5 rounded-2xl transition-colors duration-150 active:opacity-80 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'quarterly'
              ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-sm font-extrabold'
              : 'bg-white dark:bg-[#1E1F20] text-slate-700 dark:text-[#C4C7C5] hover:bg-slate-50 dark:hover:bg-[#282A2C] border border-slate-200 dark:border-white/10'
          }`}
        >
          <span>🚨 ยาความเสี่ยงสูง/กู้ชีพ (3 เดือน)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('adhoc')}
          className={`px-4 py-2.5 rounded-2xl transition-colors duration-150 active:opacity-80 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'adhoc'
              ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-sm font-extrabold'
              : 'bg-white dark:bg-[#1E1F20] text-slate-700 dark:text-[#C4C7C5] hover:bg-slate-50 dark:hover:bg-[#282A2C] border border-slate-200 dark:border-white/10'
          }`}
        >
          <span>📦 ยาฉุกเฉินเฉพาะกิจ (ครั้งคราว)</span>
        </button>
      </div>

      {/* Search & Status Filter Control Bar */}
      <div className="p-3 bg-white dark:bg-[#1E1F20] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8E918F]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อยา, สารน้ำ, รหัสบาร์โค้ด..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#282A2C] border border-slate-200 dark:border-white/10 rounded-xl text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-[#A8C7FA]/25 font-medium text-slate-800 dark:text-[#E3E3E3]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-[#E3E3E3] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs md:text-sm">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-600 dark:bg-[#A8C7FA] text-white dark:text-[#131314] shadow-xs'
                  : 'bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] hover:bg-slate-200 dark:hover:bg-[#333537]'
              }`}
            >
              ทั้งหมด ({drugs.filter((d) => d.category === activeTab).length})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-orange-500/90 dark:bg-orange-500/25 text-white dark:text-orange-300 border border-transparent dark:border-orange-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] hover:bg-slate-200 dark:hover:bg-[#333537]'
              }`}
            >
              สต็อกต่ำ
            </button>
            <button
              onClick={() => setStatusFilter('expiring')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expiring'
                  ? 'bg-amber-500/90 dark:bg-amber-500/25 text-white dark:text-[#FDD663] border border-transparent dark:border-amber-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] hover:bg-slate-200 dark:hover:bg-[#333537]'
              }`}
            >
              ใกล้หมดอายุ
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === 'expired'
                  ? 'bg-rose-600 dark:bg-rose-500/25 text-white dark:text-[#F28B82] border border-transparent dark:border-rose-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-[#282A2C] text-slate-600 dark:text-[#C4C7C5] hover:bg-slate-200 dark:hover:bg-[#333537]'
              }`}
            >
              <span>หมดอายุ</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-3 text-xs md:text-sm">
          <span className="text-slate-500 dark:text-[#8E918F] font-medium tabular-nums">
            พบ <b className="text-slate-800 dark:text-[#E3E3E3]">{displayedDrugs.length}</b> รายการในหมวดนี้ • รวมทั้งหมด <b className="text-slate-800 dark:text-[#E3E3E3]">{drugs.length}</b> รายการ
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAllCategory}
              disabled={displayedDrugs.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-600 dark:text-[#F28B82] font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/30 disabled:opacity-30"
              title="ลบรายการทั้งหมดในหมวดนี้"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ลบทั้งหมด</span>
            </button>

            <button
              onClick={handleBatchCheckAll}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 dark:bg-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/30 text-white dark:text-[#81C995] border border-transparent dark:border-emerald-500/35 font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>บันทึกเช็คปกติ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clean Inventory List View */}
      {displayedDrugs.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-[#8E918F] text-xs md:text-sm">
          ไม่พบรายการยาที่ตรงกับเงื่อนไขการค้นหา
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {displayedDrugs.map((item, idx) => {
            const expInfo = getExpirationInfo(item.expDate);
            const isLowStock = Number(item.remaining) <= Number(item.minStock);
            const isExpired = expInfo.status === 'expired';
            const isExpiringSoon = expInfo.status === 'expiring';
            const isCurrentYear = isExpCurrentYear(item.expDate);

            return (
              <DrugItemCard
                key={`${item.id || 'drug'}__${idx}`}
                item={item}
                index={idx}
                isExpired={isExpired}
                isExpiringSoon={isExpiringSoon}
                isLowStock={isLowStock}
                isCurrentYear={isCurrentYear}
                onSelectDetail={setDetailItem}
                onDeltaQty={handleDeltaQty}
                onEdit={handleOpenEdit}
                onDelete={setItemToDelete}
              />
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

            {detailItem.lots && detailItem.lots.length > 0 && (
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1.5 text-xs">
                <div className="font-bold text-blue-900">รายการ Lot / Batch (เรียงตาม FEFO หมดอายุก่อนตัดก่อน)</div>
                <div className="space-y-1">
                  {detailItem.lots.map((l, lIdx) => (
                    <div key={lIdx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-blue-100 text-[11px]">
                      <span className="font-mono font-bold text-slate-800">{l.lotNumber}</span>
                      <span className="text-slate-600">EXP: {l.expiryDate || '-'}</span>
                      <span className="font-bold text-blue-700">{l.quantity} {detailItem.unit || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(detailItem.tmtCode || detailItem.hospitalDrugCode || detailItem.barcode) && (
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                {detailItem.tmtCode && <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">TMT: {detailItem.tmtCode}</span>}
                {detailItem.hospitalDrugCode && <span className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200">HIS: {detailItem.hospitalDrugCode}</span>}
                {detailItem.barcode && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">Barcode: {detailItem.barcode}</span>}
              </div>
            )}

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
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto relative font-sans">
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
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
                  {formError}
                </div>
              )}
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

              <div className="space-y-3">
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
                  <MinimalExpiryDatePicker
                    value={normalizeExpDateToIso(formExpDate)}
                    onChange={setFormExpDate}
                    onClear={() => setFormExpDate('')}
                    showQuickPresets={true}
                  />
                </div>
              </div>

              {/* Standard Drug Codes & Lot */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">รหัส TMT</label>
                  <input
                    type="text"
                    value={formTmtCode}
                    onChange={(e) => setFormTmtCode(e.target.value)}
                    placeholder="TMT-..."
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">รหัส HIS</label>
                  <input
                    type="text"
                    value={formHospitalDrugCode}
                    onChange={(e) => setFormHospitalDrugCode(e.target.value)}
                    placeholder="HOS-..."
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lot ปัจจุบัน</label>
                  <input
                    type="text"
                    value={formLotNumber}
                    onChange={(e) => setFormLotNumber(e.target.value)}
                    placeholder="LOT-..."
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Multi-Lot / Batch FEFO Section */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">จัดการหลาย Lot (FEFO หมดอายุก่อนตัดก่อน)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormLots((prev) => [
                        ...prev,
                        { lotNumber: '', expiryDate: formExpDate || '', quantity: 0, receivedDate: getBangkokTodayIso() },
                      ])
                    }
                    className="px-2 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] cursor-pointer"
                  >
                    + เพิ่ม Lot
                  </button>
                </div>
                {formLots.length === 0 ? (
                  <p className="text-[11px] text-slate-400">ยังไม่มี Lot ย่อย (ระบบจะใช้ยอดคงเหลือและ EXP หลักด้านบน)</p>
                ) : (
                  <div className="space-y-1.5">
                    {formLots.map((lot, lIdx) => (
                      <div key={lIdx} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          type="text"
                          value={lot.lotNumber}
                          onChange={(e) =>
                            setFormLots((prev) => prev.map((it, i) => (i === lIdx ? { ...it, lotNumber: e.target.value } : it)))
                          }
                          placeholder="Lot No."
                          className="col-span-4 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
                        />
                        <MinimalExpiryDatePicker
                          value={normalizeExpDateToIso(lot.expiryDate)}
                          onChange={(val) =>
                            setFormLots((prev) => prev.map((it, i) => (i === lIdx ? { ...it, expiryDate: val } : it)))
                          }
                          compact={true}
                          showQuickPresets={false}
                          placeholder="วันหมดอายุ"
                          className="col-span-5"
                        />
                        <input
                          type="number"
                          min={0}
                          value={lot.quantity}
                          onChange={(e) =>
                            setFormLots((prev) => prev.map((it, i) => (i === lIdx ? { ...it, quantity: Number(e.target.value) } : it)))
                          }
                          placeholder="จำนวน"
                          className="col-span-2 px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => setFormLots((prev) => prev.filter((_, i) => i !== lIdx))}
                          className="col-span-1 text-rose-500 hover:text-rose-700 font-bold text-center cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Bulk Clear Category Confirmation Modal */}
      {showClearCategoryConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 border border-rose-200 shadow-2xl font-sans text-xs">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>ยืนยันการลบรายการยาทั้งหมดในหมวด</span>
            </h3>
            <p className="text-slate-700">
              คุณต้องการลบรายการยาทั้งหมดในหมวด{' '}
              <b>"{activeTab === 'monthly' ? 'ประจำเดือน' : activeTab === 'quarterly' ? '3 เดือน' : 'ครั้งคราว'}"</b>{' '}
              ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearCategoryConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeClearAllCategory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs cursor-pointer"
              >
                ลบทั้งหมดในหมวด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Requisition Workflow Modal (Draft -> Pending -> Approved -> Received Transaction) */}
      {showRequisitionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto font-sans text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">ระบบใบเบิกยาและรับเข้าคลัง (Requisition Workflow)</h3>
                  <p className="text-[11px] text-slate-500">
                    สิทธิ์ปัจจุบัน: {_currentUser?.position || _currentUser?.role || 'เจ้าหน้าที่'} •{' '}
                    {canApprove ? 'สามารถอนุมัติใบเบิกได้' : 'ผู้ขอเบิก/รับของ (การอนุมัติต้องเป็นหัวหน้า/ผู้บริหาร)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRequisitionsModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isReqBusy}
                onClick={() => handleCreateLowStockRequisition(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer disabled:opacity-50"
              >
                + สร้างฉบับร่าง (จากยาสต็อกต่ำ)
              </button>
              <button
                type="button"
                disabled={isReqBusy}
                onClick={() => handleCreateLowStockRequisition(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                + ส่งใบเบิกขออนุมัติทันที
              </button>
            </div>

            {requisitions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400">
                ยังไม่มีใบเบิกยาในแชนเนลนี้
              </div>
            ) : (
              <div className="space-y-2.5">
                {requisitions.map((req) => {
                  const statusTone =
                    req.status === 'received'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : req.status === 'approved'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : req.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : req.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <div key={req.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{req.id}</span>
                          <span className="ml-2 text-slate-500">ผู้ขอ: {req.requestedBy}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusTone}`}>
                          {req.status}
                        </span>
                      </div>

                      {req.notes && <p className="text-[11px] text-slate-600">{req.notes}</p>}

                      <div className="space-y-1">
                        {req.items.slice(0, 6).map((it, i) => (
                          <div key={i} className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-100 text-[11px]">
                            <span className="truncate font-semibold text-slate-800">{it.name}</span>
                            <span className="font-bold text-blue-700 shrink-0 ml-2">
                              {it.neededQty} {it.unit || 'ชิ้น'}
                            </span>
                          </div>
                        ))}
                        {req.items.length > 6 && (
                          <div className="text-[10px] text-slate-400">และอีก {req.items.length - 6} รายการ...</div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                        {req.status === 'draft' && (
                          <button
                            type="button"
                            disabled={isReqBusy}
                            onClick={() => handleTransitionReq(req, 'pending')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer disabled:opacity-50"
                          >
                            ส่งรออนุมัติ
                          </button>
                        )}

                        {req.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={isReqBusy || !canApprove}
                              onClick={() => handleTransitionReq(req, 'approved')}
                              title={canApprove ? 'อนุมัติใบเบิก' : 'สงวนสิทธิ์เฉพาะหัวหน้างาน / Admin / ผู้บริหาร'}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>อนุมัติ</span>
                            </button>
                            <button
                              type="button"
                              disabled={isReqBusy || !canApprove}
                              onClick={() => handleTransitionReq(req, 'rejected')}
                              title={canApprove ? 'ไม่อนุมัติ' : 'สงวนสิทธิ์เฉพาะหัวหน้างาน / Admin / ผู้บริหาร'}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-40"
                            >
                              ไม่อนุมัติ
                            </button>
                          </>
                        )}

                        {req.status === 'approved' && (
                          <button
                            type="button"
                            disabled={isReqBusy}
                            onClick={() => handleAtomicReceiveReq(req)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isReqBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>รับเข้าคลัง (Atomic Stock + Audit)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
