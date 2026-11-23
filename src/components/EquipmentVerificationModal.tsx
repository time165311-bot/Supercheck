import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { BulkEquipmentImportRow } from '../hooks/useAuraActions';

export interface VerificationEquipmentRow extends BulkEquipmentImportRow {
  _rowId: string;
  _selected: boolean;
  _pageIndex: number;
  seq: string;
  asset_number: string;
  sap_code: string;
  name: string;
  brand_model: string;
  source_budget: string;
  acquired_date: string;
  quantity: string;
  price: string;
  location_official: string;
  handwritten_note: string;
  is_marked_x: boolean;
  status: string;
}

export interface VerificationPageImage {
  pageIndex: number;
  fileName: string;
  previewUrl: string;
  rotatedDegrees?: number;
}

interface EquipmentVerificationModalProps {
  isOpen: boolean;
  initialRows: VerificationEquipmentRow[];
  pageImages: VerificationPageImage[];
  isDarkMode?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onRowsChange?: (rows: VerificationEquipmentRow[]) => void;
  onConfirmImport: (selectedRows: VerificationEquipmentRow[]) => Promise<void>;
}

const STATUS_OPTIONS = ['ปกติ', 'ส่งคืน', 'ชำรุด', 'เก็บสำรอง', 'ให้ยืม'];

type FilterMode = 'all' | 'sap_warning' | 'flagged' | 'selected';

const hasRowSapWarning = (row: VerificationEquipmentRow): boolean => {
  const raw = (row.sap_code || '').trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length !== 12;
};

export const EquipmentVerificationModal: React.FC<EquipmentVerificationModalProps> = ({
  isOpen,
  initialRows,
  pageImages,
  isSaving = false,
  onClose,
  onRowsChange,
  onConfirmImport,
}) => {
  const [rows, setRows] = useState<VerificationEquipmentRow[]>(initialRows);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [showImagePane, setShowImagePane] = useState<boolean>(pageImages.length > 0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [viewerRotationMap, setViewerRotationMap] = useState<Record<number, number>>({});
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showHelpTip, setShowHelpTip] = useState<boolean>(false);

  const lastEmittedRowsRef = useRef<VerificationEquipmentRow[] | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);
  const imageScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened) {
      setShowImagePane(pageImages.length > 0);
      setFilterMode('all');
      setShowHelpTip(false);
    } else if (pageImages.length === 0) {
      setShowImagePane(false);
    }

    if (initialRows !== lastEmittedRowsRef.current) {
      setRows(initialRows);
      if (justOpened && initialRows.length > 0) {
        const firstRowPage = initialRows[0]._pageIndex ?? 0;
        const matchedPg =
          pageImages.find((p) => p.pageIndex === firstRowPage) || pageImages[0];
        setActivePageIndex(matchedPg ? matchedPg.pageIndex : firstRowPage);
        setActiveRowId(initialRows[0]._rowId);
      }
    } else if (justOpened && initialRows.length > 0) {
      const firstRowPage = initialRows[0]._pageIndex ?? 0;
      const matchedPg =
        pageImages.find((p) => p.pageIndex === firstRowPage) || pageImages[0];
      setActivePageIndex(matchedPg ? matchedPg.pageIndex : firstRowPage);
      setActiveRowId(initialRows[0]._rowId);
    }
  }, [isOpen, initialRows, pageImages]);

  useEffect(() => {
    if (imageScrollRef.current) {
      imageScrollRef.current.scrollTo({ top: 0, left: 0 });
    }
  }, [activePageIndex]);

  const updateRows = (
    updater: (prev: VerificationEquipmentRow[]) => VerificationEquipmentRow[]
  ) => {
    setRows((prev) => {
      const next = updater(prev);
      lastEmittedRowsRef.current = next;
      onRowsChange?.(next);
      return next;
    });
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const selected = rows.filter((r) => r._selected).length;
    const flagged = rows.filter(
      (r) => Boolean(r.handwritten_note?.trim()) || Boolean(r.is_marked_x)
    ).length;
    const markedXCount = rows.filter((r) => r.is_marked_x).length;
    const sapWarningCount = rows.filter(hasRowSapWarning).length;
    return { total, selected, flagged, markedXCount, sapWarningCount };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filterMode === 'sap_warning') {
      return rows.filter(hasRowSapWarning);
    }
    if (filterMode === 'flagged') {
      return rows.filter((r) => Boolean(r.handwritten_note?.trim()) || Boolean(r.is_marked_x));
    }
    if (filterMode === 'selected') {
      return rows.filter((r) => r._selected);
    }
    return rows;
  }, [rows, filterMode]);

  const activeImage = useMemo(() => {
    if (pageImages.length === 0) return null;
    return pageImages.find((p) => p.pageIndex === activePageIndex) || pageImages[0];
  }, [pageImages, activePageIndex]);

  if (!isOpen) return null;

  const handleFieldChange = (
    rowId: string,
    field: keyof VerificationEquipmentRow,
    value: string | boolean
  ) => {
    updateRows((prev) =>
      prev.map((row) => {
        if (row._rowId !== rowId) return row;
        const updated: VerificationEquipmentRow = {
          ...row,
          [field]: value,
        };
        if (field === 'seq') updated.orderNumber = String(value);
        if (field === 'asset_number') updated.assetCode = String(value);
        if (field === 'sap_code') updated.sapCode = String(value);
        if (field === 'brand_model') updated.brandModel = String(value);
        if (field === 'source_budget') updated.source = String(value);
        if (field === 'acquired_date') updated.date = String(value);
        if (field === 'quantity') updated.qty = String(value);
        if (field === 'location_official') updated.location = String(value);
        if (field === 'handwritten_note') {
          updated.note = String(value);
          updated.isMarked = Boolean(String(value).trim()) || updated.is_marked_x;
        }
        if (field === 'is_marked_x') {
          updated.isMarked = Boolean(value) || Boolean(updated.handwritten_note?.trim());
        }
        return updated;
      })
    );
  };

  const handleSelectAll = (checked: boolean) => {
    updateRows((prev) => prev.map((r) => ({ ...r, _selected: checked })));
  };

  const handleUncheckMarkedX = () => {
    updateRows((prev) =>
      prev.map((r) => (r.is_marked_x ? { ...r, _selected: false } : r))
    );
  };

  const handleAddRow = () => {
    const newRowId = `manual_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextSeqNum = rows.length + 1;
    const newRow: VerificationEquipmentRow = {
      _rowId: newRowId,
      _selected: true,
      _pageIndex: activePageIndex,
      seq: String(nextSeqNum),
      orderNumber: String(nextSeqNum),
      asset_number: '',
      assetCode: '',
      sap_code: '',
      sapCode: '',
      name: '',
      brand_model: '',
      brandModel: '',
      source_budget: '',
      source: '',
      acquired_date: '',
      date: '',
      quantity: '1',
      qty: '1',
      price: '',
      location_official: '',
      location: '',
      handwritten_note: '',
      note: '',
      is_marked_x: false,
      isMarked: false,
      status: 'ปกติ',
    };
    updateRows((prev) => [...prev, newRow]);
    setActiveRowId(newRowId);
    setFilterMode('all');
  };

  const handleDeleteRow = (rowId: string) => {
    updateRows((prev) => prev.filter((r) => r._rowId !== rowId));
  };

  const jumpToRowPage = (pageIdx: number, forceShowImage?: boolean) => {
    if (pageImages.length === 0) return;
    const matched = pageImages.find((p) => p.pageIndex === pageIdx) || pageImages[0];
    if (matched) {
      setActivePageIndex(matched.pageIndex);
      if (forceShowImage) {
        setShowImagePane(true);
      }
    }
  };

  const selectedRows = rows.filter((r) => r._selected && r.name.trim().length > 0);
  const currentViewerRotation = viewerRotationMap[activePageIndex] || 0;
  const allSelected = stats.total > 0 && stats.selected === stats.total;

  return (
    <div
      className="fixed inset-0 z-[70] w-screen h-dvh flex flex-col bg-slate-100 dark:bg-[#0F1115] overflow-hidden"
      style={{ width: '100vw', height: '100dvh' }}
    >
      {/* Layer 1: Single-line Compact Top Bar */}
      <header className="relative shrink-0 h-12 px-3 sm:px-4 bg-white dark:bg-[#181A20] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
            ตรวจสอบครุภัณฑ์ ({stats.total})
          </h2>
          <button
            type="button"
            onClick={() => setShowHelpTip((prev) => !prev)}
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
              showHelpTip
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
            title="คำแนะนำการใช้งาน"
            aria-label="คำแนะนำการใช้งาน"
          >
            <HelpCircle size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pageImages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImagePane((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                showImagePane
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title={showImagePane ? 'ซ่อนรูปภาพต้นฉบับ' : 'แสดงรูปภาพต้นฉบับ'}
            >
              {showImagePane ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showImagePane ? 'ซ่อนรูปภาพ' : 'แสดงรูปภาพ'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 flex items-center justify-center transition cursor-pointer disabled:opacity-40"
            title="ปิดหน้าต่าง"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={17} />
          </button>
        </div>

        {/* Help Popover */}
        {showHelpTip && (
          <div className="absolute top-full left-3 right-3 sm:right-auto sm:max-w-md mt-1.5 z-50 p-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl border border-slate-700 flex items-start justify-between gap-2">
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold text-amber-300">วิธีตรวจสอบและแก้ไขข้อมูล</p>
              <p className="text-slate-200">
                • แตะที่ช่องใดก็ได้เพื่อพิมพ์แก้ไขข้อความ
              </p>
              <p className="text-slate-200">
                • แถวสีเหลืองคือรายการที่มีลายมือเขียนทับ หรือมีเครื่องหมายกากบาท X
              </p>
              <p className="text-slate-200">
                • แตะป้าย &ldquo;แผ่น X&rdquo; ใต้เลขลำดับเพื่อสลับไปดูรูปภาพต้นฉบับแผ่นนั้นได้ทันที
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpTip(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </header>

      {/* Layer 2: Single-line Horizontal Scrollable Filter & Quick Actions Strip */}
      <div className="shrink-0 px-3 sm:px-4 py-1.5 bg-slate-50 dark:bg-[#14161B] border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
            filterMode === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
          }`}
        >
          ทั้งหมด {stats.total}
        </button>

        {stats.sapWarningCount > 0 && (
          <button
            type="button"
            onClick={() =>
              setFilterMode((prev) => (prev === 'sap_warning' ? 'all' : 'sap_warning'))
            }
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
              filterMode === 'sap_warning'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border border-orange-300 dark:border-orange-800'
            }`}
          >
            ⚠️ SAP ไม่ครบ ({stats.sapWarningCount})
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            setFilterMode((prev) => (prev === 'flagged' ? 'all' : 'flagged'))
          }
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
            filterMode === 'flagged'
              ? 'bg-amber-500 text-white'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
          }`}
        >
          ✍️ มีลายมือ/X ({stats.flagged})
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterMode((prev) => (prev === 'selected' ? 'all' : 'selected'))
          }
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
            filterMode === 'selected'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}
        >
          ✅ เลือกแล้ว ({stats.selected})
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 shrink-0 mx-0.5" />

        <button
          type="button"
          onClick={() => handleSelectAll(!allSelected)}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          {allSelected ? (
            <>
              <Square size={12} className="text-slate-400" />
              <span>เอาติ๊กออก</span>
            </>
          ) : (
            <>
              <CheckSquare size={12} className="text-emerald-600" />
              <span>ติ๊กทั้งหมด</span>
            </>
          )}
        </button>

        {stats.markedXCount > 0 && (
          <button
            type="button"
            onClick={handleUncheckMarkedX}
            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            ข้ามมี X ({stats.markedXCount})
          </button>
        )}

        <button
          type="button"
          onClick={handleAddRow}
          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Plus size={12} />
          <span>เพิ่มแถว</span>
        </button>
      </div>

      {/* Main Split-View Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Compact Reference Photo Viewer Pane (24dvh on mobile) with floating bottom translucent bar */}
        {showImagePane && pageImages.length > 0 && (
          <section className="relative w-full lg:w-[40%] h-[24dvh] lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
            {/* Scrollable & Zoomable Photo Canvas */}
            <div
              ref={imageScrollRef}
              className="w-full h-full overflow-auto p-2 pb-12 flex items-start justify-start bg-slate-950"
            >
              {activeImage ? (
                <div
                  className="origin-top-left transition-transform duration-150"
                  style={{
                    width: `${Math.round(imageZoom * 100)}%`,
                    minWidth: `${Math.round(imageZoom * 100)}%`,
                  }}
                >
                  <img
                    src={activeImage.previewUrl}
                    alt={activeImage.fileName || `แผ่นที่ ${activePageIndex + 1}`}
                    className="w-full h-auto rounded-lg shadow-lg select-none"
                    style={{
                      transform:
                        currentViewerRotation !== 0
                          ? `rotate(${currentViewerRotation}deg)`
                          : undefined,
                    }}
                  />
                </div>
              ) : (
                <div className="m-auto text-xs text-slate-400">ไม่มีภาพต้นฉบับ</div>
              )}
            </div>

            {/* Translucent Floating Toolbar at Bottom Edge */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 px-2 py-1 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/15 shadow-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                {pageImages.map((pg, idx) => {
                  const displaySheetNum =
                    typeof pg.pageIndex === 'number' ? pg.pageIndex + 1 : idx + 1;
                  const isActivePg = activeImage?.pageIndex === pg.pageIndex;
                  return (
                    <button
                      key={`${pg.pageIndex}-${idx}`}
                      type="button"
                      onClick={() => setActivePageIndex(pg.pageIndex)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        isActivePg
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white/10 text-slate-200 hover:bg-white/20'
                      }`}
                    >
                      แผ่น {displaySheetNum}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-0.5 shrink-0 border-l border-white/15 pl-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setImageZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))
                  }
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="ย่อภาพ"
                  aria-label="ย่อภาพ"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-100 min-w-[34px] text-center">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setImageZoom((z) => Math.min(2.75, +(z + 0.25).toFixed(2)))
                  }
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="ขยายภาพ"
                  aria-label="ขยายภาพ"
                >
                  <ZoomIn size={12} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setViewerRotationMap((prev) => ({
                      ...prev,
                      [activePageIndex]: ((prev[activePageIndex] || 0) + 90) % 360,
                    }))
                  }
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white cursor-pointer ml-0.5"
                  title="หมุนภาพ 90°"
                  aria-label="หมุนภาพ"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Inline Editable Table */}
        <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#16181E]">
          <div className="flex-1 overflow-auto overscroll-contain">
            <table className="w-full border-collapse text-xs min-w-[1260px]">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#1E2028] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 shadow-xs">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-100 dark:bg-[#1E2028] px-2.5 py-2 text-center w-12 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    เลือก
                  </th>
                  <th className="px-2 py-2 text-center w-20 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    ลำดับ / X
                  </th>
                  <th className="px-2.5 py-2 text-left w-64 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    รายการ
                  </th>
                  <th className="px-2.5 py-2 text-left w-48 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    หมายเลขพัสดุ
                  </th>
                  <th className="px-2.5 py-2 text-left w-40 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    รหัส SAP 12 หลัก
                  </th>
                  <th className="px-2.5 py-2 text-left w-48 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    ยี่ห้อ / รุ่น / S/N
                  </th>
                  <th className="px-2.5 py-2 text-left w-36 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    แหล่งเงิน
                  </th>
                  <th className="px-2.5 py-2 text-left w-28 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    ว/ด/ป ได้มา
                  </th>
                  <th className="px-2 py-2 text-center w-20 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    จำนวน
                  </th>
                  <th className="px-2.5 py-2 text-right w-28 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    ราคา
                  </th>
                  <th className="px-2.5 py-2 text-left w-48 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    สถานที่ตั้งตามพิมพ์
                  </th>
                  <th className="px-2.5 py-2 text-left w-48 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    ลายมือปากกา
                  </th>
                  <th className="px-2.5 py-2 text-left w-32 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    สถานะ
                  </th>
                  <th className="px-2 py-2 text-center w-12 whitespace-nowrap">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="py-12 text-center text-sm text-slate-400 font-medium"
                    >
                      ไม่พบรายการในตัวกรองนี้
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const hasHandwriting = Boolean(row.handwritten_note?.trim());
                    const isFlagged = hasHandwriting || row.is_marked_x;
                    const sapDigits = (row.sap_code || '').replace(/\D/g, '');
                    const hasSapWarning = hasRowSapWarning(row);
                    const isActive = activeRowId === row._rowId;
                    const matchedPage =
                      pageImages.find((p) => p.pageIndex === row._pageIndex) ||
                      pageImages[row._pageIndex];
                    const pageDisplayNum =
                      (matchedPage ? matchedPage.pageIndex : row._pageIndex) + 1;

                    const rowBgClass = isFlagged
                      ? 'bg-amber-50/90 hover:bg-amber-100/70 dark:bg-amber-950/35 dark:hover:bg-amber-950/50'
                      : 'bg-white hover:bg-slate-50 dark:bg-[#16181E] dark:hover:bg-slate-800/40';

                    const stickyBgClass = isFlagged
                      ? 'bg-amber-50 dark:bg-[#2A2212]'
                      : 'bg-white dark:bg-[#16181E]';

                    return (
                      <tr
                        key={row._rowId}
                        onClick={() => {
                          setActiveRowId(row._rowId);
                          jumpToRowPage(row._pageIndex, false);
                        }}
                        className={`${rowBgClass} ${
                          isFlagged ? 'border-l-4 border-l-amber-400' : ''
                        } ${isActive ? 'ring-1 ring-inset ring-blue-400/60' : ''} ${
                          !row._selected ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className={`sticky left-0 z-10 ${stickyBgClass} px-2.5 py-2 text-center border-r border-slate-200 dark:border-slate-800`}
                        >
                          <input
                            type="checkbox"
                            checked={row._selected}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, '_selected', e.target.checked)
                            }
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            title="เลือกนำเข้ารายการนี้"
                          />
                        </td>

                        {/* Seq + X badge + Matched Page Badge */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={row.seq}
                              onChange={(e) =>
                                handleFieldChange(row._rowId, 'seq', e.target.value)
                              }
                              className="w-11 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-center font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFieldChange(row._rowId, 'is_marked_x', !row.is_marked_x);
                              }}
                              className={`px-1.5 py-1 rounded text-[10px] font-black cursor-pointer transition ${
                                row.is_marked_x
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                              }`}
                              title="สลับสถานะกากบาท (X)"
                            >
                              X
                            </button>
                          </div>
                          {pageImages.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRowId(row._rowId);
                                jumpToRowPage(row._pageIndex, true);
                              }}
                              className={`mt-0.5 w-full rounded px-1 py-0.5 text-[9px] font-bold text-center cursor-pointer transition ${
                                activePageIndex ===
                                (matchedPage ? matchedPage.pageIndex : row._pageIndex)
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title={
                                matchedPage?.fileName
                                  ? `เปิดดูรูปต้นฉบับ: ${matchedPage.fileName}`
                                  : `เปิดดูรูปแผ่นที่ ${pageDisplayNum}`
                              }
                            >
                              แผ่น {pageDisplayNum}
                            </button>
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'name', e.target.value)
                            }
                            placeholder="ชื่อรายการครุภัณฑ์..."
                            className={`w-full px-2 py-1 rounded border bg-white/80 dark:bg-slate-900 font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 ${
                              !row.name.trim()
                                ? 'border-rose-400'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          />
                        </td>

                        {/* Asset Number */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.asset_number}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'asset_number', e.target.value)
                            }
                            placeholder="หมายเลขพัสดุ..."
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* SAP 12 digits */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.sap_code}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'sap_code', e.target.value)
                            }
                            placeholder="12 หลัก..."
                            className={`w-full px-2 py-1 rounded border bg-white/80 dark:bg-slate-900 font-mono text-[11px] outline-none focus:border-blue-500 ${
                              hasSapWarning
                                ? 'border-orange-400 text-orange-800 dark:text-orange-200'
                                : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          />
                          {hasSapWarning && (
                            <div className="text-[9px] text-orange-600 font-bold mt-0.5">
                              พบ {sapDigits.length} หลัก (ควรมี 12)
                            </div>
                          )}
                        </td>

                        {/* Brand / Model / S/N */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.brand_model}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'brand_model', e.target.value)
                            }
                            placeholder="ยี่ห้อ / รุ่น / S/N..."
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Source budget */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.source_budget}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'source_budget', e.target.value)
                            }
                            placeholder="แหล่งเงิน..."
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Acquired Date */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.acquired_date}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'acquired_date', e.target.value)
                            }
                            placeholder="ว/ด/ป..."
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.quantity}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'quantity', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-center text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Price */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.price}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'price', e.target.value)
                            }
                            placeholder="0"
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-right font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Location Official */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.location_official}
                            onChange={(e) =>
                              handleFieldChange(
                                row._rowId,
                                'location_official',
                                e.target.value
                              )
                            }
                            placeholder="สถานที่ตั้ง..."
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Handwritten Note */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.handwritten_note}
                            onChange={(e) =>
                              handleFieldChange(
                                row._rowId,
                                'handwritten_note',
                                e.target.value
                              )
                            }
                            placeholder="ลายมือ เช่น OR1, ส่งคืน..."
                            className={`w-full px-2 py-1 rounded border outline-none focus:border-blue-500 font-semibold ${
                              hasHandwriting
                                ? 'border-amber-400 bg-amber-100/70 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100'
                                : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                            }`}
                          />
                        </td>

                        {/* Status */}
                        <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-800">
                          <select
                            value={row.status}
                            onChange={(e) =>
                              handleFieldChange(row._rowId, 'status', e.target.value)
                            }
                            className={`w-full px-2 py-1 rounded border font-bold outline-none focus:border-blue-500 ${
                              row.status === 'ชำรุด' || row.status === 'ส่งคืน'
                                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                                : row.status === 'เก็บสำรอง' || row.status === 'ให้ยืม'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Delete Row */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRow(row._rowId);
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Compact Sticky Bottom Footer */}
      <footer
        className="shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-[#181A20] border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2"
        style={{
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button
          type="button"
          disabled={isSaving}
          onClick={onClose}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          พักไว้ก่อน
        </button>

        <button
          type="button"
          disabled={isSaving || selectedRows.length === 0}
          onClick={() => onConfirmImport(selectedRows)}
          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs sm:text-sm font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition whitespace-nowrap"
        >
          {isSaving ? (
            <>
              <Loader2 size={15} className="animate-spin shrink-0" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} className="shrink-0" />
              <span>
                {selectedRows.length === rows.length
                  ? `บันทึกลงฐานข้อมูล (${selectedRows.length} รายการ)`
                  : `บันทึกรายการที่เลือก (${selectedRows.length}/${rows.length} รายการ)`}
              </span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};
