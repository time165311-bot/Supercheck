import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  CheckCheck,
  Maximize2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  ArrowLeft,
  Pencil,
  Trash2,
  Save,
  Eye,
  FileText,
  Plus,
} from 'lucide-react';
import { EquipmentItem, RoomDef, CheckItemState } from '../types';
import { CORRIDOR_LABELS, CORRIDORS } from '../constants/initialData';
import { EquipmentDetailModal } from './EquipmentDetailModal';

interface FloorMapProps {
  rooms: RoomDef[];
  equipment: Record<string, EquipmentItem[]>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  selectedRoomId?: string | null;
  onSelectRoom: (roomId: string) => void;
  theme?: 'light' | 'dark';
  onToggleCheck?: (
    categoryOrRoomId: string,
    itemKey: string,
    result: 'ปกติ' | 'ผิดปกติ' | '',
    itemName: string,
    week?: number,
    isMassAction?: boolean,
    customValue?: string
  ) => void;
  onUpdateNote?: (categoryOrRoomId: string, itemKey: string, note: string) => void;
  onZoomImage?: (url: string) => void;
  onOpenReport?: () => Promise<void> | void;
  onPreviewAndReset?: () => Promise<void> | void;
  isDrawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  onEditEquipment?: (roomId: string, updatedItem: EquipmentItem) => void;
  onDeleteEquipment?: (roomId: string, itemId: string) => void;
  onClearAllEquipment?: () => void;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  rooms,
  equipment,
  globalChecks,
  selectedRoomId = null,
  onSelectRoom,
  theme = 'light',
  onToggleCheck,
  onUpdateNote,
  onZoomImage,
  onOpenReport,
  onPreviewAndReset,
  isDrawerOpen: controlledDrawerOpen,
  onDrawerOpenChange,
  onEditEquipment,
  onDeleteEquipment,
  onClearAllEquipment: _onClearAllEquipment,
}) => {
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [roomFilterMode, setRoomFilterMode] = useState<'pending' | 'defective' | 'all'>('pending');

  const containerRef = useRef<HTMLDivElement>(null);
  const checklistPanelRef = useRef<HTMLDivElement>(null);
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1.0);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMovedRef = useRef<boolean>(false);

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomScaleRef = useRef(zoomScale);
  zoomScaleRef.current = zoomScale;
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const activeRoomId = selectedRoomId || '';

  // Right Slide-Over Inspection Drawer State (supports controlled state for history Back navigation)
  const [internalDrawerOpen, setInternalDrawerOpen] = useState<boolean>(false);
  const isInspectionDrawerOpen =
    controlledDrawerOpen !== undefined ? controlledDrawerOpen : internalDrawerOpen;

  const setDrawerOpen = (open: boolean) => {
    if (onDrawerOpenChange) {
      onDrawerOpenChange(open);
    } else {
      setInternalDrawerOpen(open);
    }
  };

  // Room Equipment Edit & Delete Modals (all 12 fields supported)
  const [editingEq, setEditingEq] = useState<EquipmentItem | null>(null);
  const [editEqName, setEditEqName] = useState('');
  const [editEqNo, setEditEqNo] = useState('');
  const [editEqCode, setEditEqCode] = useState('');
  const [editEqSap, setEditEqSap] = useState('');
  const [editEqSpec, setEditEqSpec] = useState('');
  const [editEqSource, setEditEqSource] = useState('');
  const [editEqDate, setEditEqDate] = useState('');
  const [editEqQty, setEditEqQty] = useState('1');
  const [editEqTax, setEditEqTax] = useState('');
  const [editEqPrice, setEditEqPrice] = useState('');
  const [editEqRoomId, setEditEqRoomId] = useState('');
  const [editEqStatus, setEditEqStatus] = useState('ปกติ');
  const [editEqError, setEditEqError] = useState('');
  const [eqToDelete, setEqToDelete] = useState<{ item: EquipmentItem; key: string } | null>(null);

  // Equipment Detail Modal state
  const [viewingDetailItem, setViewingDetailItem] = useState<{
    item: EquipmentItem;
    result?: string;
    note?: string;
  } | null>(null);

  // Drawer Search Term
  const [drawerSearchTerm, setDrawerSearchTerm] = useState('');

  // Add Missing Sequence Mode
  const [isAddingMissing, setIsAddingMissing] = useState(false);

  // 100% Completion alert modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isConfirmingPreview, setIsConfirmingPreview] = useState(false);

  // Notify App.tsx when any FloorMap modal is active so floating bars hide cleanly
  useEffect(() => {
    const anyModal = Boolean(editingEq || eqToDelete || viewingDetailItem || showCompletionModal);
    window.dispatchEvent(new CustomEvent('modal_state_change', { detail: { open: anyModal } }));
  }, [editingEq, eqToDelete, viewingDetailItem, showCompletionModal]);

  // Clear lingering sub-modals and drawer search whenever the inspection drawer closes
  useEffect(() => {
    if (!isInspectionDrawerOpen) {
      setViewingDetailItem(null);
      setEditingEq(null);
      setEqToDelete(null);
      setIsAddingMissing(false);
      setDrawerSearchTerm('');
    }
  }, [isInspectionDrawerOpen]);

  const openEditEqModal = (item: EquipmentItem) => {
    setIsAddingMissing(false);
    setEditingEq(item);
    setEditEqName(item.name || '');
    setEditEqNo(item.no || item.orderNumber || '');
    setEditEqCode(item.code || item.assetCode || '');
    setEditEqSap(item.sap || item.sapCode || '');
    setEditEqSpec(item.spec || '');
    setEditEqSource(item.source || '');
    setEditEqDate(item.date || '');
    setEditEqQty(String(item.qty || '1'));
    setEditEqTax(String(item.tax || ''));
    setEditEqPrice(String(item.price || ''));
    setEditEqRoomId(item.roomId || activeRoomId);

    const itemKey = item.id || `${activeRoomId}_${item.no || ''}`;
    const altKey = `${currentRoomDef?.n || activeRoomId}|${item.name}|${item.code || ''}`;
    const check = currentRoomChecks[itemKey] || currentRoomChecks[altKey];
    setEditEqStatus(check?.result || item.status || 'ปกติ');
    setEditEqError('');
  };

  const openAddMissingModal = (prefillOrderNum?: number) => {
    const orderStr = prefillOrderNum ? String(prefillOrderNum) : '';
    const defaultRoom = rooms.find((r) => r.m && r.id === activeRoomId)?.id || rooms.find((r) => r.m)?.id || 'anes';
    setIsAddingMissing(true);
    setEditingEq({
      id: orderStr ? `eq_reg_${orderStr.padStart(4, '0')}` : `eq_manual_${Date.now()}`,
      name: '',
      no: orderStr,
      orderNumber: orderStr,
      code: '',
      sap: '',
      spec: '',
      source: 'เงินบำรุง',
      date: '',
      qty: '1',
      tax: '7',
      price: '',
      roomId: defaultRoom,
      type: 'room',
      status: 'ปกติ',
    });
    setEditEqName('');
    setEditEqNo(orderStr);
    setEditEqCode('');
    setEditEqSap('');
    setEditEqSpec('');
    setEditEqSource('เงินบำรุง');
    setEditEqDate('');
    setEditEqQty('1');
    setEditEqTax('7');
    setEditEqPrice('');
    setEditEqRoomId(defaultRoom);
    setEditEqStatus('ปกติ');
    setEditEqError('');
  };

  const handleSaveEqEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEq) return;
    if (!editEqName.trim()) {
      setEditEqError('กรุณากรอกชื่อครุภัณฑ์');
      return;
    }
    const targetRoomId = editEqRoomId || activeRoomId;
    const targetRoomDef = rooms.find((r) => r.id === targetRoomId) || currentRoomDef;
    const numericOrder = parseInt(editEqNo.trim().replace(/\D/g, ''), 10);
    const resolvedId = isAddingMissing
      ? !isNaN(numericOrder)
        ? `eq_reg_${String(numericOrder).padStart(4, '0')}`
        : `eq_manual_${Date.now()}`
      : editingEq.id || `${targetRoomId}_${editEqNo.trim() || Date.now()}`;

    const updated: EquipmentItem = {
      ...editingEq,
      id: resolvedId,
      name: editEqName.trim(),
      no: editEqNo.trim(),
      orderNumber: editEqNo.trim(),
      code: editEqCode.trim(),
      assetCode: editEqCode.trim(),
      sap: editEqSap.trim(),
      sapCode: editEqSap.trim(),
      spec: editEqSpec.trim(),
      source: editEqSource.trim(),
      date: editEqDate.trim(),
      qty: editEqQty.trim() || '1',
      tax: editEqTax.trim(),
      price: editEqPrice.trim(),
      roomId: targetRoomId,
      location: targetRoomDef?.n || targetRoomId,
      status: editEqStatus,
      type: 'room',
    };
    onEditEquipment?.(isAddingMissing ? targetRoomId : activeRoomId, updated);

    // Sync inspection check state if applicable
    if (onToggleCheck && editEqStatus && (editEqStatus === 'ปกติ' || editEqStatus === 'ผิดปกติ')) {
      onToggleCheck(
        targetRoomId,
        resolvedId,
        editEqStatus as 'ปกติ' | 'ผิดปกติ',
        updated.name,
        undefined,
        true
      );
    }

    setEditingEq(null);
    setIsAddingMissing(false);
  };

  const handleConfirmDeleteEq = () => {
    if (!eqToDelete) return;
    onDeleteEquipment?.(activeRoomId, eqToDelete.key);
    setEqToDelete(null);
  };

  const handleOpenRoomDrawer = (roomId: string) => {
    onSelectRoom(roomId);
    setDrawerOpen(true);
  };

  const handleCloseRoomDrawer = () => {
    setDrawerOpen(false);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 3.5));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.25));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Compute room inspection statistics
  const interactiveRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (!r.m) return false;
      const list = equipment[r.id] || [];
      return list.length > 0;
    });
  }, [rooms, equipment]);

  const roomStatsMap = useMemo(() => {
    const stats: Record<
      string,
      {
        room: RoomDef;
        total: number;
        checked: number;
        normal: number;
        defective: number;
        remaining: number;
        isCompleted: boolean;
        hasDefect: boolean;
      }
    > = {};

    interactiveRooms.forEach((r) => {
      const list = equipment[r.id] || [];
      const rTotal = list.length;
      const rChecks = globalChecks[r.id] || {};
      let checked = 0;
      let normal = 0;
      let defective = 0;

      list.forEach((it, idx) => {
        const itemKey = it.id || `${r.id}_${idx}`;
        const altKey = `${r.n}|${it.name}|${it.code || ''}`;
        const st = rChecks[itemKey] || rChecks[altKey];

        if (st && st.result) {
          checked++;
          if (st.result === 'ปกติ') normal++;
          if (st.result === 'ผิดปกติ') defective++;
        }
      });

      const remaining = Math.max(0, rTotal - checked);
      const isCompleted = rTotal > 0 && remaining === 0;
      const hasDefect = defective > 0;

      stats[r.id] = {
        room: r,
        total: rTotal,
        checked,
        normal,
        defective,
        remaining,
        isCompleted,
        hasDefect,
      };
    });

    return stats;
  }, [interactiveRooms, equipment, globalChecks]);

  // Rooms that miss or need inspection
  const pendingRooms = useMemo(() => {
    return interactiveRooms.filter((r) => {
      const st = roomStatsMap[r.id];
      return st && !st.isCompleted;
    });
  }, [interactiveRooms, roomStatsMap]);

  const defectiveRooms = useMemo(() => {
    return interactiveRooms.filter((r) => {
      const st = roomStatsMap[r.id];
      return st && st.hasDefect;
    });
  }, [interactiveRooms, roomStatsMap]);

  // Filtered rooms display chips
  const filteredNavigatorRooms = useMemo(() => {
    if (roomFilterMode === 'pending') return pendingRooms;
    if (roomFilterMode === 'defective') return defectiveRooms;
    return interactiveRooms;
  }, [roomFilterMode, pendingRooms, defectiveRooms, interactiveRooms]);

  // Selected Room Data & Items
  const currentRoomDef = useMemo(() => {
    if (!activeRoomId) return null;
    return rooms.find((r) => r.id === activeRoomId) || null;
  }, [rooms, activeRoomId]);

  const currentRoomItems = useMemo(() => {
    if (!activeRoomId) return [];
    return equipment[activeRoomId] || [];
  }, [equipment, activeRoomId]);

  const currentRoomChecks = useMemo(() => {
    if (!activeRoomId) return {};
    return globalChecks[activeRoomId] || {};
  }, [globalChecks, activeRoomId]);

  const currentRoomStat = activeRoomId ? roomStatsMap[activeRoomId] : undefined;

  // Quick action: 3-State Toggle Mark All Items in Active Room (Toggle between All Normal and Reset)
  const isRoomAllPassed = useMemo(() => {
    if (currentRoomItems.length === 0) return false;
    return currentRoomItems.every((item, idx) => {
      const itemKey = item.id || `${activeRoomId}_${idx}`;
      const altKey = `${currentRoomDef?.n || activeRoomId}|${item.name}|${item.code || ''}`;
      const check = currentRoomChecks[itemKey] || currentRoomChecks[altKey];
      return check?.result === 'ปกติ';
    });
  }, [currentRoomItems, currentRoomChecks, activeRoomId, currentRoomDef]);

  const handleToggleMarkAllRoom = () => {
    if (!onToggleCheck) return;
    if (isRoomAllPassed) {
      currentRoomItems.forEach((eq, idx) => {
        const itemKey = eq.id || `${activeRoomId}_${idx}`;
        onToggleCheck(activeRoomId, itemKey, '', eq.name, undefined, true, '');
      });
    } else {
      currentRoomItems.forEach((eq, idx) => {
        const itemKey = eq.id || `${activeRoomId}_${idx}`;
        onToggleCheck(activeRoomId, itemKey, 'ปกติ', eq.name, undefined, true);
      });
    }
  };

  // Detect 100% completion across all interactive rooms and prompt for Preview
  const overallEquipmentStats = useMemo(() => {
    let total = 0;
    let checked = 0;
    interactiveRooms.forEach((r) => {
      const st = roomStatsMap[r.id];
      if (st) {
        total += st.total;
        checked += st.checked;
      }
    });
    return { total, checked };
  }, [interactiveRooms, roomStatsMap]);

  const prevAllCheckedRef = useRef<boolean>(false);
  useEffect(() => {
    const isNowAllChecked =
      overallEquipmentStats.total > 0 &&
      overallEquipmentStats.checked === overallEquipmentStats.total;
    if (!prevAllCheckedRef.current && isNowAllChecked) {
      setShowCompletionModal(true);
    }
    prevAllCheckedRef.current = isNowAllChecked;
  }, [overallEquipmentStats.total, overallEquipmentStats.checked]);

  // Missing Sequence Detector across all equipment items
  const missingSequenceInfo = useMemo(() => {
    const nums: number[] = [];
    Object.values(equipment).forEach((roomList) => {
      if (!Array.isArray(roomList)) return;
      roomList.forEach((it) => {
        const raw = String(it.orderNumber || it.no || '').trim();
        const parsed = parseInt(raw.replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 5000) {
          nums.push(parsed);
        }
      });
    });
    if (nums.length === 0) {
      return { maxOrder: 0, totalItems: 0, missingNumbers: [] as number[] };
    }
    const maxOrder = Math.max(...nums);
    const existingSet = new Set(nums);
    const missingNumbers: number[] = [];
    for (let i = 1; i <= maxOrder; i++) {
      if (!existingSet.has(i)) {
        missingNumbers.push(i);
      }
    }
    return { maxOrder, totalItems: nums.length, missingNumbers };
  }, [equipment]);

  const displayedDrawerItems = useMemo(() => {
    if (!drawerSearchTerm.trim()) return currentRoomItems;
    const q = drawerSearchTerm.trim().toLowerCase();
    return currentRoomItems.filter((it) => {
      const name = (it.name || '').toLowerCase();
      const no = String(it.no || it.orderNumber || '').toLowerCase();
      const code = (it.code || it.assetCode || '').toLowerCase();
      const sap = (it.sap || it.sapCode || '').toLowerCase();
      const spec = (it.spec || '').toLowerCase();
      return name.includes(q) || no.includes(q) || code.includes(q) || sap.includes(q) || spec.includes(q);
    });
  }, [currentRoomItems, drawerSearchTerm]);

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=' || e.key === 'Add') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleResetZoom();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Map touch & wheel listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      setZoomScale((prev) => {
        const step = delta < 0 ? 0.12 : -0.12;
        return Number(Math.min(Math.max(prev + step, 0.25), 3.0).toFixed(2));
      });
    };

    const handleTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        setIsDragging(true);
        dragMovedRef.current = false;
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        panStartRef.current = { ...panRef.current };
        initialTouchDistanceRef.current = null;
      } else if (e.touches.length === 2) {
        setIsDragging(false);
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );
        initialTouchDistanceRef.current = dist;
        initialScaleRef.current = zoomScaleRef.current;
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1 && isDraggingRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        if (Math.hypot(dx, dy) > 4) {
          dragMovedRef.current = true;
        }
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
      } else if (e.touches.length === 2 && initialTouchDistanceRef.current !== null) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );
        if (initialTouchDistanceRef.current > 0) {
          const factor = dist / initialTouchDistanceRef.current;
          const newScale = Number((initialScaleRef.current * factor).toFixed(2));
          setZoomScale(Math.min(Math.max(newScale, 0.25), 3.0));
        }
      }
    };

    const handleTouchEndNative = () => {
      setIsDragging(false);
      initialTouchDistanceRef.current = null;
    };

    el.addEventListener('wheel', handleWheelEvent, { passive: false });
    el.addEventListener('touchstart', handleTouchStartNative, { passive: false });
    el.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    el.addEventListener('touchend', handleTouchEndNative, { passive: false });
    el.addEventListener('touchcancel', handleTouchEndNative, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheelEvent);
      el.removeEventListener('touchstart', handleTouchStartNative);
      el.removeEventListener('touchmove', handleTouchMoveNative);
      el.removeEventListener('touchend', handleTouchEndNative);
      el.removeEventListener('touchcancel', handleTouchEndNative);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      dragMovedRef.current = true;
    }
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Search matches
  const matches: Array<{ room: RoomDef; item: EquipmentItem }> = [];
  const hitRooms: Record<string, boolean> = {};

  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    rooms.forEach((r) => {
      if (!r.m) return;
      const rEq = equipment[r.id] || [];
      rEq.forEach((it) => {
        const name = (it.name || '').toLowerCase();
        const no = String(it.no || it.orderNumber || '').toLowerCase();
        const code = (it.code || it.assetCode || '').toLowerCase();
        const sap = (it.sap || it.sapCode || '').toLowerCase();
        const spec = (it.spec || '').toLowerCase();
        if (
          name.includes(q) ||
          no.includes(q) ||
          code.includes(q) ||
          sap.includes(q) ||
          spec.includes(q)
        ) {
          matches.push({ room: r, item: it });
          hitRooms[r.id] = true;
        }
      });
    });
  }

  const handleRoomClick = (roomId: string) => {
    if (dragMovedRef.current) return;
    handleOpenRoomDrawer(roomId);
  };

  return (
    <div className="relative z-0 space-y-4 font-['TH_Sarabun_New'] pb-28 text-slate-800 dark:text-slate-100">
      {/* 🚨 1. UNCHECKED ROOMS ALERT BANNER & NAVIGATOR */}
      <div className="p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-sm space-y-3 transition-colors duration-300">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-none">
                สถานะการตรวจเช็กห้องผ่าตัด
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {pendingRooms.length === 0
                  ? '🎉 ตรวจเช็กครบถ้วนแล้วทุกห้องผ่าตัด!'
                  : `⚠️ มีห้องที่ยังไม่ได้ตรวจเช็กอีก ${pendingRooms.length} ห้อง`}
              </p>
            </div>
          </div>

          {/* Filter Pills: Pending / Defective / All */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-2xl text-xs shrink-0 bg-slate-100 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRoomFilterMode('pending')}
                className={`px-3 py-1.5 rounded-xl transition font-bold cursor-pointer active:scale-95 ${
                  roomFilterMode === 'pending'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ค้างตรวจ ({pendingRooms.length})
              </button>
              <button
                type="button"
                onClick={() => setRoomFilterMode('defective')}
                className={`px-3 py-1.5 rounded-xl transition font-bold cursor-pointer active:scale-95 ${
                  roomFilterMode === 'defective'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                พบชำรุด ({defectiveRooms.length})
              </button>
              <button
                type="button"
                onClick={() => setRoomFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl transition font-bold cursor-pointer active:scale-95 ${
                  roomFilterMode === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ทั้งหมด ({interactiveRooms.length})
              </button>
            </div>
          </div>
        </div>

        {/* Room Chips Scroll / Grid */}
        {filteredNavigatorRooms.length === 0 ? (
          <div className="py-3 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>ไม่มีห้องค้างตรวจเช็กในหมวดนี้</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar py-1">
            {filteredNavigatorRooms.map((r) => {
              const st = roomStatsMap[r.id];
              const isActive = isInspectionDrawerOpen && activeRoomId === r.id;
              const isComp = st?.isCompleted;
              const hasDef = st?.hasDefect;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleOpenRoomDrawer(r.id)}
                  className={`px-3.5 py-2 rounded-2xl border text-left transition flex items-center gap-2 cursor-pointer text-xs active:scale-95 ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-md shadow-blue-500/20 ring-2 ring-blue-300'
                      : hasDef
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/80 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                      : isComp
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      : 'bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <span className="font-bold">{r.n}</span>
                  {hasDef ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold flex items-center gap-0.5">
                      <AlertCircle size={10} />
                      <span>ชำรุด {st?.defective}</span>
                    </span>
                  ) : isComp ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-0.5">
                      <span>✓ ครบ</span>
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
                      ค้าง {st?.remaining || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔍 MISSING SEQUENCE DETECTOR BANNER */}
      {missingSequenceInfo.missingNumbers.length > 0 && (
        <div className="p-4 rounded-3xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/30 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200 leading-snug">
                  พบเลขลำดับที่ขาดหาย: ลำดับที่{' '}
                  {missingSequenceInfo.missingNumbers.slice(0, 12).join(', ')}
                  {missingSequenceInfo.missingNumbers.length > 12 &&
                    ` และอีก ${missingSequenceInfo.missingNumbers.length - 12} ลำดับ`}
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-300/90">
                  มีทั้งหมด {missingSequenceInfo.totalItems} รายการจากลำดับ 1–{missingSequenceInfo.maxOrder} (ขาด {missingSequenceInfo.missingNumbers.length} ลำดับ)
                </p>
              </div>
            </div>

            {onEditEquipment && (
              <button
                type="button"
                onClick={() => openAddMissingModal(missingSequenceInfo.missingNumbers[0])}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
              >
                <Plus size={14} />
                <span>เพิ่มรายการแทรกตามลำดับ</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {missingSequenceInfo.missingNumbers.slice(0, 20).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onEditEquipment && openAddMissingModal(num)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-[11px] font-mono font-bold hover:bg-amber-100 transition cursor-pointer active:scale-95"
                title={`คลิกเพื่อเพิ่มครุภัณฑ์ลำดับที่ ${num}`}
              >
                + #{num}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🗺️ 2. INTERACTIVE SVG FLOOR MAP (Samsung One UI Light Style) */}
      <div className="space-y-3">
        {/* Search Bar & Zoom Controls Header */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขครุภัณฑ์, SAP, หรือชื่อเครื่องมือ..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-600 text-xs outline-none focus:ring-1 focus:ring-blue-600 transition font-sans shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0 shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              title="ย่อแผนผัง"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 w-12 text-center select-none">
              {Math.round(zoomScale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              title="ขยายแผนผัง (ซูมเข้า)"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {(zoomScale !== 1.0 || pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={handleResetZoom}
                title="รีเซ็ตผัง"
                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">รีเซ็ต</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {searchTerm.trim() && (
          <div className="bg-white dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 max-h-48 overflow-y-auto space-y-1 text-xs shadow-lg">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">
                ไม่พบครุภัณฑ์ที่ค้นหา
              </div>
            ) : (
              matches.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenRoomDrawer(m.room.id)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/70 flex items-center justify-between gap-2 transition cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {m.item.no && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 mr-1.5 font-mono border border-blue-100 dark:border-blue-800">
                          #{m.item.no}
                        </span>
                      )}
                      {m.item.name}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                    📍 {m.room.n}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Map Viewport Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            touchAction: 'none',
            overscrollBehavior: 'contain',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          className="bg-slate-50 dark:bg-slate-900/90 rounded-3xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[65vh] min-h-[360px] sm:min-h-[440px] relative select-none flex items-center justify-center shadow-inner"
        >
          <div
            className="transition-transform duration-75 origin-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              width: '100%',
              maxWidth: '1200px',
            }}
          >
            <svg viewBox="80 480 1130 1330" className="w-full h-auto block select-none">
              {/* Corridors */}
              <g className={isDark ? 'fill-slate-800/80 stroke-slate-700 stroke-1' : 'fill-[#e2e8f0] stroke-[#cbd5e1] stroke-1'}>
                {CORRIDORS.map((c, i) => (
                  <rect key={i} x={c[0]} y={c[1]} width={c[2]} height={c[3]} rx={6} />
                ))}
              </g>

              {/* Corridor Labels */}
              {CORRIDOR_LABELS.map((c, i) => (
                <text
                  key={i}
                  x={c[1]}
                  y={c[2]}
                  className={`${isDark ? 'fill-slate-400' : 'fill-slate-600'} text-[11px] font-mono tracking-wider uppercase font-bold`}
                  textAnchor="middle"
                >
                  {c[0]}
                </text>
              ))}

              {/* Rooms SVG Elements */}
              {rooms.map((r) => {
                const lines = r.l.split('|');
                const cx = r.x + r.w / 2;
                const fs = 19;
                const st = roomStatsMap[r.id];
                const rCount = st?.total || 0;
                const isSelected = isInspectionDrawerOpen && activeRoomId === r.id;

                const ty =
                  r.y +
                  r.h / 2 -
                  (lines.length - 1) * fs * 0.6 -
                  (r.m ? 8 : 0) +
                  fs * 0.35;

                const isHit = hitRooms[r.id];
                const isFullyChecked = st?.isCompleted;
                const hasDefect = st?.hasDefect;

                let strokeColor = isDark ? '#475569' : '#94a3b8';
                let strokeWidth = 1.25;
                let fillColor = isDark ? '#1e293b' : '#ffffff';
                const fillOpacity = 1;

                if (isSelected) {
                  strokeColor = isDark ? '#60a5fa' : '#2563eb';
                  strokeWidth = 2.5;
                  fillColor = isDark ? '#1e3a8a' : '#eff6ff';
                } else if (hasDefect) {
                  strokeColor = isDark ? '#f87171' : '#ef4444';
                  strokeWidth = 2;
                  fillColor = isDark ? '#450a0a' : '#fef2f2';
                } else if (isFullyChecked) {
                  strokeColor = isDark ? '#34d399' : '#10b981';
                  strokeWidth = 1.75;
                  fillColor = isDark ? '#064e3b' : '#f0fdf4';
                } else if (isHit) {
                  strokeColor = isDark ? '#60a5fa' : '#3b82f6';
                  strokeWidth = 2.25;
                  fillColor = isDark ? '#172554' : '#dbeafe';
                }

                return (
                  <g
                    key={r.id}
                    onClick={r.m ? () => handleRoomClick(r.id) : undefined}
                    className={
                      r.m
                        ? 'cursor-pointer hover:opacity-95 transition-opacity group'
                        : 'cursor-default'
                    }
                  >
                    <rect
                      x={r.x + 3}
                      y={r.y + 3}
                      width={r.w - 6}
                      height={r.h - 6}
                      rx={8}
                      fill={fillColor}
                      fillOpacity={fillOpacity}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />

                    <text
                      fontSize={fs}
                      className={`${isDark ? 'fill-slate-100' : 'fill-slate-900'} font-bold pointer-events-none`}
                      textAnchor="middle"
                    >
                      {lines.map((t, idx) => (
                        <tspan key={idx} x={cx} y={ty + idx * fs * 1.25}>
                          {t}
                        </tspan>
                      ))}
                    </text>

                    {r.m && (
                      <text fontSize={11} className="pointer-events-none" textAnchor="middle">
                        <tspan
                          x={cx}
                          y={ty + lines.length * fs * 1.25 + 4}
                          className={
                            hasDefect
                              ? (isDark ? 'fill-rose-300 font-bold' : 'fill-rose-600 font-bold')
                              : isFullyChecked
                              ? (isDark ? 'fill-emerald-300 font-bold' : 'fill-emerald-700 font-bold')
                              : (isDark ? 'fill-slate-300 font-semibold' : 'fill-slate-500 font-semibold')
                          }
                        >
                          {hasDefect
                            ? `⚠️ ชำรุด (${st?.defective})`
                            : isFullyChecked
                            ? `✓ ครบ (${rCount})`
                            : `${st?.checked || 0}/${rCount}`}
                        </tspan>
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* 📱 3. RIGHT SLIDE-OVER INSPECTION PANEL (Side Sheet Drawer) */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 ${
          isInspectionDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCloseRoomDrawer}
      />

      {/* Slide-Over Side Sheet Container */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:max-w-xl md:max-w-2xl bg-white dark:bg-[#181A20] text-slate-900 dark:text-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isInspectionDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Drawer Header with Single Back Button & Quick Pass All */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181A20] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleCloseRoomDrawer}
              className="px-3 py-2 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
              title="กลับไปผังห้องผ่าตัด"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden xs:inline">ผังห้อง</span>
            </button>

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <span>📍 {currentRoomDef?.n || activeRoomId}</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({currentRoomItems.length})
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                ตรวจแล้ว {currentRoomStat?.checked || 0}/{currentRoomItems.length} รายการ
                {currentRoomStat?.hasDefect && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold ml-1.5">
                    (⚠️ ชำรุด {currentRoomStat.defective})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleMarkAllRoom}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                isRoomAllPassed
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={
                isRoomAllPassed
                  ? 'ยกเลิกการตรวจทั้งหมดในห้องนี้ (รีเซ็ตกลับเป็นยังไม่ตรวจ)'
                  : 'ทำเครื่องหมายปกติทุกรายการในห้องนี้'
              }
            >
              {isRoomAllPassed ? <RotateCcw size={15} /> : <CheckCheck size={15} />}
              <span>{isRoomAllPassed ? 'ยกเลิกตรวจ' : 'ผ่านหมด'}</span>
            </button>

            <button
              type="button"
              onClick={handleCloseRoomDrawer}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer active:scale-90"
              title="ปิดแผงตรวจเช็ก"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 🔍 Search Input inside Room Drawer */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={drawerSearchTerm}
              onChange={(e) => setDrawerSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อเครื่อง, ลำดับ (#), หรือรหัสพัสดุในห้องนี้..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-blue-500 shadow-xs"
            />
            {drawerSearchTerm && (
              <button
                type="button"
                onClick={() => setDrawerSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body - Equipment List Immediately Visible */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 pb-24">
          {displayedDrawerItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {drawerSearchTerm.trim()
                ? `ไม่พบรายการครุภัณฑ์ที่ตรงกับ "${drawerSearchTerm}"`
                : 'ไม่พบรายการครุภัณฑ์ในห้องนี้'}
            </div>
          ) : (
            displayedDrawerItems.map((item, idx) => {
              const itemKey = item.id || `${activeRoomId}_${idx}`;
              const altKey = `${currentRoomDef?.n || activeRoomId}|${item.name}|${item.code || ''}`;
              const check = currentRoomChecks[itemKey] || currentRoomChecks[altKey];

              const isOk = check?.result === 'ปกติ';
              const isBad = check?.result === 'ผิดปกติ';

              return (
                <div
                  key={itemKey}
                  className={`p-3.5 rounded-2xl border transition-colors duration-150 card-perf flex flex-col justify-between space-y-3 ${
                    isBad
                      ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-slate-900 dark:text-white shadow-xs'
                      : isOk
                      ? 'bg-emerald-50/85 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() =>
                          setViewingDetailItem({
                            item,
                            result: check?.result,
                            note: check?.note,
                          })
                        }
                      >
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {item.no && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono font-bold">
                              #{item.no}
                            </span>
                          )}
                          {item.code && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-mono">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug hover:text-blue-600 transition-colors">
                          {item.name}
                        </h4>
                        {item.spec && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.spec}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.img && (
                          <div
                            onClick={() => onZoomImage && onZoomImage(item.img!)}
                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition relative"
                          >
                            <img
                              src={item.img}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            <Maximize2
                              size={10}
                              className="absolute bottom-1 right-1 text-white bg-black/60 rounded p-0.5"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingDetailItem({
                              item,
                              result: check?.result,
                              note: check?.note,
                            });
                          }}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 dark:bg-slate-700/70 dark:text-slate-300 dark:hover:text-blue-400 transition cursor-pointer active:scale-90"
                          title="ดูรายละเอียดทะเบียนครุภัณฑ์"
                        >
                          <Eye size={14} />
                        </button>

                        {onEditEquipment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEqModal(item);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 dark:bg-slate-700/70 dark:text-slate-300 dark:hover:text-blue-400 transition cursor-pointer active:scale-90"
                            title="แก้ไขครุภัณฑ์"
                          >
                            <Pencil size={14} />
                          </button>
                        )}

                        {onDeleteEquipment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEqToDelete({ item, key: itemKey });
                            }}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 transition cursor-pointer active:scale-90"
                            title="ลบครุภัณฑ์รายการนี้"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inspection Status Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleCheck &&
                          onToggleCheck(activeRoomId, itemKey, 'ปกติ', item.name)
                        }
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isOk
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 border border-slate-200/60 dark:border-slate-600'
                        }`}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span>ปกติ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onToggleCheck &&
                          onToggleCheck(activeRoomId, itemKey, 'ผิดปกติ', item.name)
                        }
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isBad
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700 border border-slate-200/60 dark:border-slate-600'
                        }`}
                      >
                        <X size={14} strokeWidth={2.5} />
                        <span>มีปัญหา</span>
                      </button>
                    </div>

                    {/* Defect Note Input */}
                    {isBad && (
                      <input
                        type="text"
                        value={check?.note || ''}
                        onChange={(e) =>
                          onUpdateNote && onUpdateNote(activeRoomId, itemKey, e.target.value)
                        }
                        placeholder="ระบุอาการเสีย หรือปัญหาที่พบ..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 outline-none text-rose-900 dark:text-rose-200 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-500 shadow-xs"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer Sticky Save Button */}
        {onOpenReport && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181A20] shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsSubmitting(true);
                  await onOpenReport();
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูลเข้า Google Sheets...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={18} />
                  <span>💾 บันทึกเข้า Sheets & พรีวิวรายงาน A4</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Edit / Add 12-Field Room Equipment Modal */}
      {editingEq && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setEditingEq(null);
            setIsAddingMissing(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-[#1E2024] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 font-sans text-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isAddingMissing ? (
                  <Plus className="w-4 h-4 text-amber-600" />
                ) : (
                  <Pencil className="w-4 h-4 text-blue-600" />
                )}
                <span>
                  {isAddingMissing
                    ? `เพิ่มครุภัณฑ์แทรกตามลำดับ ${editEqNo ? `(#${editEqNo})` : ''}`
                    : `แก้ไขครุภัณฑ์ (${currentRoomDef?.n || activeRoomId})`}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingEq(null);
                  setIsAddingMissing(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEqEdit} className="flex-1 overflow-y-auto p-4 sm:p-5 pb-6 space-y-3">
              {editEqError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  {editEqError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    ลำดับที่ (#)
                  </label>
                  <input
                    type="text"
                    value={editEqNo}
                    onChange={(e) => setEditEqNo(e.target.value)}
                    placeholder="เช่น 23"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    จำนวน
                  </label>
                  <input
                    type="text"
                    value={editEqQty}
                    onChange={(e) => setEditEqQty(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  ชื่อรายการครุภัณฑ์ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editEqName}
                  onChange={(e) => setEditEqName(e.target.value)}
                  placeholder="ระบุชื่อครุภัณฑ์"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    หมายเลขพัสดุ
                  </label>
                  <input
                    type="text"
                    value={editEqCode}
                    onChange={(e) => setEditEqCode(e.target.value)}
                    placeholder="6515-xxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    รหัส SAP
                  </label>
                  <input
                    type="text"
                    value={editEqSap}
                    onChange={(e) => setEditEqSap(e.target.value)}
                    placeholder="เช่น 10000xxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  มาตรฐาน / รายละเอียด (Spec)
                </label>
                <input
                  type="text"
                  value={editEqSpec}
                  onChange={(e) => setEditEqSpec(e.target.value)}
                  placeholder="ยี่ห้อ / รุ่น / S/N"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    แหล่งเงินที่ได้มา
                  </label>
                  <input
                    type="text"
                    value={editEqSource}
                    onChange={(e) => setEditEqSource(e.target.value)}
                    placeholder="เช่น เงินบำรุง / งบประมาณ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    ว/ด/ป ที่ได้มา
                  </label>
                  <input
                    type="text"
                    value={editEqDate}
                    onChange={(e) => setEditEqDate(e.target.value)}
                    placeholder="เช่น 15/05/2565"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    อัตราภาษี (%)
                  </label>
                  <input
                    type="text"
                    value={editEqTax}
                    onChange={(e) => setEditEqTax(e.target.value)}
                    placeholder="7"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    ราคา (รวมภาษี)
                  </label>
                  <input
                    type="text"
                    value={editEqPrice}
                    onChange={(e) => setEditEqPrice(e.target.value)}
                    placeholder="เช่น 125000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    สถานที่ตั้ง / ห้อง
                  </label>
                  <select
                    value={editEqRoomId}
                    onChange={(e) => setEditEqRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    {rooms
                      .filter((r) => r.m)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.n}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    สถานะ / ผลการตรวจสอบ
                  </label>
                  <select
                    value={editEqStatus}
                    onChange={(e) => setEditEqStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="ปกติ">ปกติ (ใช้งานได้)</option>
                    <option value="ผิดปกติ">ชำรุด / ผิดปกติ</option>
                    <option value="ส่งคืน">ส่งคืน</option>
                    <option value="เก็บสำรอง">เก็บสำรอง</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 pb-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingEq(null);
                    setIsAddingMissing(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isAddingMissing ? 'เพิ่มรายการ' : 'บันทึก'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Room Equipment Confirmation Modal */}
      {eqToDelete && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setEqToDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E2024] rounded-3xl p-5 pb-6 shadow-2xl border border-rose-200 dark:border-rose-900/50 space-y-3 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>ยืนยันการลบครุภัณฑ์</span>
            </h3>
            <p className="text-slate-700 dark:text-slate-300">
              คุณต้องการลบรายการ <b>"{eqToDelete.item.name}"</b> ออกจากห้อง {currentRoomDef?.n || activeRoomId} ใช่หรือไม่?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEqToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEq}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-sm"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12-Field Equipment Detail Modal */}
      <EquipmentDetailModal
        isOpen={Boolean(viewingDetailItem)}
        item={viewingDetailItem?.item || null}
        result={viewingDetailItem?.result}
        note={viewingDetailItem?.note}
        onClose={() => setViewingDetailItem(null)}
        onEdit={(it) => openEditEqModal(it)}
        onZoomImage={onZoomImage}
      />

      {/* 🎉 100% Inspection Complete Centered Popup (Preview Only, No Auto GAS Submit) */}
      {showCompletionModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isConfirmingPreview && setShowCompletionModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1E2024] rounded-3xl p-6 pb-7 shadow-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-4 font-sans text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                ตรวจเช็กครุภัณฑ์ครบ 100% แล้ว
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                คุณตรวจเช็กครบทุกรายการแล้ว ต้องการกดยืนยันเพื่อส่งข้อมูลเข้าหน้ารายงาน (Preview) หรือไม่?
              </p>
              <p className="text-[11px] text-slate-400">
                (ระบบจะเปิดหน้ารายงานตัวอย่างเพื่อตรวจสอบ/พิมพ์ PDF และรีเซ็ตการติ๊กเป็นรอบใหม่ โดยยังไม่ส่งเข้า Google Sheets อัตโนมัติ)
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isConfirmingPreview}
                onClick={() => setShowCompletionModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer hover:bg-slate-200 transition"
              >
                ตรวจเช็กต่อ
              </button>
              <button
                type="button"
                disabled={isConfirmingPreview}
                onClick={async () => {
                  try {
                    setIsConfirmingPreview(true);
                    setShowCompletionModal(false);
                    if (onPreviewAndReset) {
                      await onPreviewAndReset();
                    } else if (onOpenReport) {
                      await onOpenReport();
                    }
                  } finally {
                    setIsConfirmingPreview(false);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition disabled:opacity-60"
              >
                <FileText className="w-4 h-4" />
                <span>ยืนยัน (Preview รายงาน)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
