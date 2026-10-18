import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DrugCategory, DrugItem, User } from '../types';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';

interface DrugInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const DrugInventoryModal: React.FC<DrugInventoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
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
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
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

  if (!isOpen) return null;

  // Filtered lists
  const currentTabDrugs = useMemo(() => {
    return drugs.filter((d) => d.category === activeTab);
  }, [drugs, activeTab]);

  const displayedDrugs = useMemo(() => {
    return currentTabDrugs.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (d.note && d.note.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      const isLowStock = d.remaining <= d.minStock;
      const matchesFilter = filterLowStockOnly ? isLowStock : true;

      return matchesSearch && matchesFilter;
    });
  }, [currentTabDrugs, searchTerm, filterLowStockOnly]);

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

  // Export to Excel (.xlsx) using SheetJS
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const categoryNames: Record<DrugCategory, string> = {
      monthly: 'ยาในคลังเดือน',
      quarterly: 'ยาเบิกทุก 3 เดือน',
      adhoc: 'ยาเบิกเป็นครั้งๆ-ตามงบ',
    };

    (['monthly', 'quarterly', 'adhoc'] as DrugCategory[]).forEach((cat) => {
      const catDrugs = drugs.filter((d) => d.category === cat);
      const rows = catDrugs.map((d, idx) => ({
        ลำดับ: idx + 1,
        'ชนิดยา/สารน้ำ': d.name,
        คงเหลือ: d.remaining,
        วันที่รับ: d.receivedDate || '-',
        จำนวนที่รับ: d.receivedQty,
        รวม: d.remaining + d.receivedQty,
        'ยอดต่ำสุด (Min Stock)': d.minStock,
        เบิกครั้งละ: d.batchRequest || '-',
        'วันหมดอายุ (Exp Date)': d.expDate || '-',
        สถานะ: d.remaining <= d.minStock ? 'ต่ำกว่าเกณฑ์ (ต้องเบิก)' : 'ปกติ',
        หมายเหตุ: d.note || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 10 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 20 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, categoryNames[cat]);
    });

    const nowStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `รายงานคลังยาและสารน้ำ_วิสัญญี_${nowStr}.xlsx`);
  };

  // Print A4 Form
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none drug-inventory-modal-overlay">
      <div className="bg-white dark:bg-[#0c121d] rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden relative drug-inventory-modal-container">
        {/* Header Bar */}
        <div className="no-print px-4 py-3 sm:px-6 bg-neutral-100/90 dark:bg-[#111927] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <span className="text-xl">💊</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  ระบบตรวจเช็คคลังยาและสารน้ำ
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Anesthesia Drug Inventory
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                คลินิกงานบริการผู้ป่วยในวิสัญญี | ผู้ตรวจ:{' '}
                {currentUser?.name || 'ผู้ดูแลระบบ'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มรายการยา</span>
            </button>

            <button
              type="button"
              onClick={handleSaveData}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>บันทึก</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="ส่งออกไฟล์ Excel (.xlsx) ครบทั้ง 3 Tab"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="พิมพ์ฟอร์ม A4 แนวนอน"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="ปิดหน้าต่างคลังยา"
              className="p-1.5 rounded-xl bg-neutral-200/80 hover:bg-neutral-300 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Tab Selection Bar & Search Bar */}
        <div className="no-print px-4 py-2.5 sm:px-6 bg-white dark:bg-[#0c121d] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
          {/* 3 Main Tabs */}
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-2xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700'
              }`}
            >
              <span>📅 ยาในคลังเดือน</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
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
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'quarterly'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700'
              }`}
            >
              <span>📦 ยาเบิกทุก 3 เดือน</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
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
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'adhoc'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700'
              }`}
            >
              <span>⚡ ยาเบิกเป็นครั้งๆ / ตามงบ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {adhocCount}
              </span>
              {lowStockAdhoc > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                  ⚠️ {lowStockAdhoc}
                </span>
              )}
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อยาหรือสารน้ำ..."
                className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 border border-transparent"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                filterLowStockOnly
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
              }`}
              title="กรองเฉพาะยาที่คงเหลือ ≤ ยอดต่ำสุด"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>เตือนเบิกยา</span>
            </button>
          </div>
        </div>

        {/* Printable/Responsive Table Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-neutral-100/60 dark:bg-neutral-950">
          <div
            id="printable-drug-inventory-doc"
            className="bg-white dark:bg-[#101724] text-neutral-900 dark:text-neutral-100 p-4 sm:p-6 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800"
          >
            {/* Table Header Details for Official Printing */}
            <div className="mb-4 text-center">
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ
              </h1>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-0.5">
                หมวดหมู่:{' '}
                {activeTab === 'monthly'
                  ? 'ยาในคลังเดือน (เบิกและเช็ครายเดือน)'
                  : activeTab === 'quarterly'
                  ? 'ยาเบิกทุก 3 เดือน (เบิกรายไตรมาส)'
                  : 'ยาเบิกเป็นครั้งๆ / ยาตามงบประมาณ'}{' '}
                | ข้อมูล ณ วันที่{' '}
                {new Date().toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* Main Inventory Table (Exact 100% Column Structure) */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs border border-neutral-300 dark:border-neutral-700 min-w-[950px]">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800/90 text-neutral-900 dark:text-neutral-100 font-bold border-b border-neutral-300 dark:border-neutral-700 text-center">
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-10">
                      ลำดับ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 text-left min-w-[180px]">
                      ชนิดยา/สารน้ำ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-20 bg-blue-50/50 dark:bg-blue-950/30">
                      คงเหลือ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-32">
                      วันที่รับ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-24">
                      จำนวนที่รับ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-20 bg-emerald-50/50 dark:bg-emerald-950/30 font-extrabold text-emerald-800 dark:text-emerald-300">
                      รวม
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-24">
                      ยอดต่ำสุด (Min)
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-24">
                      เบิกครั้งละ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-32">
                      วันหมดอายุ (Exp)
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 min-w-[120px]">
                      หมายเหตุ
                    </th>
                    <th className="p-2 border border-neutral-300 dark:border-neutral-700 w-16 no-print">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDrugs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="p-8 text-center text-neutral-400 dark:text-neutral-500"
                      >
                        ไม่พบรายการยาหรือสารน้ำในหมวดนี้
                      </td>
                    </tr>
                  ) : (
                    displayedDrugs.map((item, idx) => {
                      const totalQty = item.remaining + item.receivedQty;
                      const isLowStock = item.remaining <= item.minStock;

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-neutral-200 dark:border-neutral-800 transition-colors ${
                            isLowStock
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 font-medium'
                              : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          {/* 1. ลำดับ */}
                          <td className="p-2 border border-neutral-300 dark:border-neutral-700 text-center text-neutral-500 font-mono">
                            {idx + 1}
                          </td>

                          {/* 2. ชนิดยา/สารน้ำ */}
                          <td className="p-2 border border-neutral-300 dark:border-neutral-700 text-left font-semibold">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-neutral-900 dark:text-neutral-100">
                                {item.name}
                              </span>
                              {isLowStock && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 whitespace-nowrap">
                                  ⚠️ สต็อกต่ำ
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. คงเหลือ (Editable) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center bg-blue-50/30 dark:bg-blue-950/20">
                            <input
                              type="number"
                              min="0"
                              value={item.remaining}
                              onChange={(e) =>
                                handleUpdateField(
                                  item.id,
                                  'remaining',
                                  Number(e.target.value) || 0
                                )
                              }
                              className={`w-full py-1 px-1.5 text-center font-bold rounded-lg border outline-none text-xs ${
                                isLowStock
                                  ? 'text-rose-700 dark:text-rose-300 border-rose-400 bg-rose-50 dark:bg-rose-950/50'
                                  : 'text-neutral-900 dark:text-neutral-100 border-transparent hover:border-neutral-300 focus:border-blue-500 bg-transparent'
                              }`}
                            />
                          </td>

                          {/* 4. วันที่รับ (Picker) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center">
                            <input
                              type="date"
                              value={item.receivedDate || ''}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'receivedDate', e.target.value)
                              }
                              className="w-full py-1 px-1 text-center rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-[11px] outline-none"
                            />
                          </td>

                          {/* 5. จำนวนที่รับ (Editable) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.receivedQty}
                              onChange={(e) =>
                                handleUpdateField(
                                  item.id,
                                  'receivedQty',
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-full py-1 px-1.5 text-center font-semibold rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-xs outline-none"
                            />
                          </td>

                          {/* 6. รวม (คำนวณอัตโนมัติ: คงเหลือ + จำนวนที่รับ) */}
                          <td className="p-2 border border-neutral-300 dark:border-neutral-700 text-center font-extrabold bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300">
                            {totalQty}
                          </td>

                          {/* 7. ยอดต่ำสุด (Min Stock) (Editable) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.minStock}
                              onChange={(e) =>
                                handleUpdateField(
                                  item.id,
                                  'minStock',
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-full py-1 px-1.5 text-center text-neutral-700 dark:text-neutral-300 rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-xs outline-none"
                            />
                          </td>

                          {/* 8. เบิกครั้งละ (Editable) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center">
                            <input
                              type="text"
                              value={item.batchRequest || ''}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'batchRequest', e.target.value)
                              }
                              placeholder="เช่น 10"
                              className="w-full py-1 px-1 text-center text-neutral-700 dark:text-neutral-300 rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-xs outline-none"
                            />
                          </td>

                          {/* 9. วันหมดอายุ (Exp Date) (Picker) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center">
                            <input
                              type="date"
                              value={item.expDate || ''}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'expDate', e.target.value)
                              }
                              className="w-full py-1 px-1 text-center rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-[11px] outline-none"
                            />
                          </td>

                          {/* 10. หมายเหตุ (Editable) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700">
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) =>
                                handleUpdateField(item.id, 'note', e.target.value)
                              }
                              placeholder="ระบุหมายเหตุ..."
                              className="w-full py-1 px-2 text-neutral-700 dark:text-neutral-300 rounded-lg border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 focus:border-blue-500 bg-transparent text-xs outline-none"
                            />
                          </td>

                          {/* 11. การจัดการ (ลบรายการ) */}
                          <td className="p-1 border border-neutral-300 dark:border-neutral-700 text-center no-print">
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              title="ลบรายการยา"
                              className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Signature Lines for Print */}
            <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <p>ลงชื่อ .................................................... ผู้ตรวจสอบ</p>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  ( {currentUser?.name || 'ผู้ดูแลระบบ'} )
                </p>
              </div>
              <div>
                <p>ลงชื่อ .................................................... หัวหน้างาน</p>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  ( .................................................... )
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-500">
            <span>
              รวม {displayedDrugs.length} รายการ (ในหน้านี้) | สีแดง = สต็อกต่ำกว่าเกณฑ์
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 font-medium cursor-pointer"
            >
              รีเซ็ตค่าเริ่มต้น
            </button>
            <button
              type="button"
              onClick={handleSaveData}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </div>
      </div>

      {/* Modal: เพิ่มรายการยาใหม่ */}
      {showAddModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-white">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>
                  เพิ่มรายการยาใหม่ (
                  {activeTab === 'monthly'
                    ? 'คลังเดือน'
                    : activeTab === 'quarterly'
                    ? 'เบิกทุก 3 เดือน'
                    : 'เบิกเป็นครั้งๆ'}
                  )
                </span>
              </div>
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
                <label className="block font-semibold mb-1">ชนิดยา/สารน้ำ *</label>
                <input
                  type="text"
                  required
                  value={newDrugName}
                  onChange={(e) => setNewDrugName(e.target.value)}
                  placeholder="เช่น Propofol 1% 20 mL"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">คงเหลือ</label>
                  <input
                    type="number"
                    min="0"
                    value={newRemaining}
                    onChange={(e) => setNewRemaining(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">ยอดต่ำสุด (Min)</label>
                  <input
                    type="number"
                    min="0"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">วันที่รับ</label>
                  <input
                    type="date"
                    value={newReceivedDate}
                    onChange={(e) => setNewReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">จำนวนที่รับ</label>
                  <input
                    type="number"
                    min="0"
                    value={newReceivedQty}
                    onChange={(e) => setNewReceivedQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">เบิกครั้งละ</label>
                  <input
                    type="text"
                    value={newBatchRequest}
                    onChange={(e) => setNewBatchRequest(e.target.value)}
                    placeholder="เช่น 10 vial"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">วันหมดอายุ (Exp)</label>
                  <input
                    type="date"
                    value={newExpDate}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="เช่น ยาแช่เย็น, ยาเสพติด"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ยืนยันการลบรายการยา */}
      {itemToDelete && (
        <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                ยืนยันการลบรายการยา?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                คุณต้องการลบรายการ{' '}
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  "{itemToDelete.name}"
                </span>{' '}
                ออกจากคลังยาใช่หรือไม่?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
