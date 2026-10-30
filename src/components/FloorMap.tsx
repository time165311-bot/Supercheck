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
} from 'lucide-react';
import { EquipmentItem, RoomDef, CheckItemState } from '../types';
import { CORRIDOR_LABELS, CORRIDORS } from '../constants/initialData';

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
    result: 'ปกติ' | 'ผิดปกติ',
    itemName: string
  ) => void;
  onUpdateNote?: (categoryOrRoomId: string, itemKey: string, note: string) => void;
  onZoomImage?: (url: string) => void;
  onOpenReport?: () => void;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  rooms,
  equipment,
  globalChecks,
  selectedRoomId = 'or1',
  onSelectRoom,
  theme: _theme,
  onToggleCheck,
  onUpdateNote,
  onZoomImage,
  onOpenReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
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

  const activeRoomId = selectedRoomId || 'or1';

  // Auto scroll down to room checklist when room is selected
  useEffect(() => {
    if (activeRoomId && checklistPanelRef.current) {
      checklistPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeRoomId]);

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
    return rooms.find((r) => r.id === activeRoomId) || rooms[0];
  }, [rooms, activeRoomId]);

  const currentRoomItems = useMemo(() => {
    return equipment[activeRoomId] || [];
  }, [equipment, activeRoomId]);

  const currentRoomChecks = useMemo(() => {
    return globalChecks[activeRoomId] || {};
  }, [globalChecks, activeRoomId]);

  const currentRoomStat = roomStatsMap[activeRoomId];

  // Quick action: Mark all items in active room as Normal
  const handleMarkAllRoomNormal = () => {
    if (!onToggleCheck) return;
    currentRoomItems.forEach((eq, idx) => {
      const itemKey = eq.id || `${activeRoomId}_${idx}`;
      onToggleCheck(activeRoomId, itemKey, 'ปกติ', eq.name);
    });
  };

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
        if (
          it.name.toLowerCase().includes(q) ||
          (it.code && it.code.toLowerCase().includes(q)) ||
          (it.sap && it.sap.toLowerCase().includes(q))
        ) {
          matches.push({ room: r, item: it });
          hitRooms[r.id] = true;
        }
      });
    });
  }

  const handleRoomClick = (roomId: string) => {
    if (dragMovedRef.current) return;
    onSelectRoom(roomId);
  };

  return (
    <div className="space-y-4 font-['TH_Sarabun_New'] pb-32 text-slate-800" style={{ paddingBottom: '100px' }}>
      {/* 🚨 1. UNCHECKED ROOMS ALERT BANNER & NAVIGATOR (Samsung One UI Light Style) */}
      <div className="p-4 sm:p-5 rounded-3xl border border-slate-200/80 bg-white shadow-sm space-y-3 transition-colors duration-300">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-none">
                สถานะการตรวจเช็กห้องผ่าตัด
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingRooms.length === 0
                  ? '🎉 ตรวจเช็กครบถ้วนแล้วทุกห้องผ่าตัด!'
                  : `⚠️ มีห้องที่ยังไม่ได้ตรวจเช็กอีก ${pendingRooms.length} ห้อง`}
              </p>
            </div>
          </div>

          {/* Filter Pills: Pending / Defective / All */}
          <div className="flex items-center gap-1 p-1 rounded-2xl text-xs shrink-0 bg-slate-100 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setRoomFilterMode('pending')}
              className={`px-3 py-1.5 rounded-xl transition font-bold cursor-pointer active:scale-95 ${
                roomFilterMode === 'pending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              พบชำรุด ({defectiveRooms.length})
            </button>
            <button
              type="button"
              onClick={() => setRoomFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl transition font-bold cursor-pointer active:scale-95 ${
                roomFilterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({interactiveRooms.length})
            </button>
          </div>
        </div>

        {/* Room Chips Scroll / Grid */}
        {filteredNavigatorRooms.length === 0 ? (
          <div className="py-3 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ไม่มีห้องค้างตรวจเช็กในหมวดนี้</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar py-1">
            {filteredNavigatorRooms.map((r) => {
              const st = roomStatsMap[r.id];
              const isActive = activeRoomId === r.id;
              const isComp = st?.isCompleted;
              const hasDef = st?.hasDefect;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRoom(r.id)}
                  className={`px-3.5 py-2 rounded-2xl border text-left transition flex items-center gap-2 cursor-pointer text-xs active:scale-95 ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-md shadow-blue-500/20 ring-2 ring-blue-300'
                      : hasDef
                      ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : isComp
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-bold">{r.n}</span>
                  {hasDef ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold flex items-center gap-0.5">
                      <AlertCircle size={10} />
                      <span>ชำรุด {st?.defective}</span>
                    </span>
                  ) : isComp ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-0.5">
                      <span>✓ ครบ</span>
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      ค้าง {st?.remaining || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
              className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 rounded-xl border border-slate-200 focus:border-blue-600 text-xs outline-none focus:ring-1 focus:ring-blue-600 transition font-sans shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs shrink-0 shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              title="ย่อแผนผัง"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono font-bold text-slate-800 w-12 text-center select-none">
              {Math.round(zoomScale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              title="ขยายแผนผัง (ซูมเข้า)"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {(zoomScale !== 1.0 || pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={handleResetZoom}
                title="รีเซ็ตผัง"
                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">รีเซ็ต</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {searchTerm.trim() && (
          <div className="bg-white rounded-2xl border border-slate-200 p-2 max-h-48 overflow-y-auto space-y-1 text-xs shadow-lg">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">
                ไม่พบครุภัณฑ์ที่ค้นหา
              </div>
            ) : (
              matches.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectRoom(m.room.id)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 transition cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {m.item.no && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 mr-1.5 font-mono border border-blue-100">
                          #{m.item.no}
                        </span>
                      )}
                      {m.item.name}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 shrink-0">
                    📍 {m.room.n}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Map Viewport Container (Samsung One UI Light Style) */}
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
          className="bg-slate-50 rounded-3xl p-3 sm:p-4 border border-slate-200 overflow-hidden max-h-[65vh] min-h-[360px] sm:min-h-[440px] relative select-none flex items-center justify-center shadow-inner"
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
              {/* Corridors (Light clean slate) */}
              <g className="fill-[#e2e8f0] stroke-[#cbd5e1] stroke-1">
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
                  className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase font-bold"
                  textAnchor="middle"
                >
                  {c[0]}
                </text>
              ))}

              {/* Rooms SVG Elements (Clean One UI Light) */}
              {rooms.map((r) => {
                const lines = r.l.split('|');
                const cx = r.x + r.w / 2;
                const fs = 19;
                const st = roomStatsMap[r.id];
                const rCount = st?.total || 0;
                const isSelected = activeRoomId === r.id;

                const ty =
                  r.y +
                  r.h / 2 -
                  (lines.length - 1) * fs * 0.6 -
                  (r.m ? 8 : 0) +
                  fs * 0.35;

                const isHit = hitRooms[r.id];
                const isFullyChecked = st?.isCompleted;
                const hasDefect = st?.hasDefect;

                // Color stroke and fill based on status
                let strokeColor = '#94a3b8';
                let strokeWidth = 1.5;
                let fillColor = '#ffffff';
                let fillOpacity = 1;

                if (isSelected) {
                  strokeColor = '#2563eb';
                  strokeWidth = 4;
                  fillColor = '#eff6ff';
                } else if (hasDefect) {
                  strokeColor = '#ef4444';
                  strokeWidth = 3;
                  fillColor = '#fef2f2';
                } else if (isFullyChecked) {
                  strokeColor = '#10b981';
                  strokeWidth = 2.5;
                  fillColor = '#f0fdf4';
                } else if (isHit) {
                  strokeColor = '#3b82f6';
                  strokeWidth = 3.5;
                  fillColor = '#dbeafe';
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
                      className="fill-slate-900 font-bold pointer-events-none"
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
                              ? 'fill-rose-600 font-bold'
                              : isFullyChecked
                              ? 'fill-emerald-700 font-bold'
                              : 'fill-slate-500 font-semibold'
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

      {/* 📋 3. SELECTED ROOM EQUIPMENT CHECKLIST PANEL (Samsung One UI Light Style) */}
      <div
        ref={checklistPanelRef}
        className="p-4 sm:p-5 rounded-3xl border border-slate-200/80 bg-white shadow-md space-y-4 transition-all duration-300"
      >
        {/* Selected Room Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                📍 {currentRoomDef?.n || activeRoomId} ({currentRoomItems.length} รายการครุภัณฑ์)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              สถานะ: ตรวจแล้ว {currentRoomStat?.checked || 0}/{currentRoomItems.length} รายการ
              {currentRoomStat?.hasDefect && (
                <span className="text-rose-600 font-bold ml-2">
                  (⚠️ พบชำรุด {currentRoomStat.defective} รายการ)
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={handleMarkAllRoomNormal}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95 flex items-center gap-1.5"
            title="ทำเครื่องหมายปกติทุกรายการในห้องนี้"
          >
            <CheckCheck size={16} />
            <span>ตรวจผ่านทั้งหมดในห้องนี้</span>
          </button>
        </div>

        {/* Selected Room Equipment Cards List */}
        {currentRoomItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            ไม่พบรายการครุภัณฑ์ในห้องที่เลือก
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentRoomItems.map((item, idx) => {
              const itemKey = item.id || `${activeRoomId}_${idx}`;
              const altKey = `${currentRoomDef?.n || activeRoomId}|${item.name}|${item.code || ''}`;
              const check = currentRoomChecks[itemKey] || currentRoomChecks[altKey];

              const isOk = check?.result === 'ปกติ';
              const isBad = check?.result === 'ผิดปกติ';

              return (
                <div
                  key={itemKey}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isBad
                      ? 'bg-rose-50/70 border-rose-200 text-slate-900 shadow-xs'
                      : isOk
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-900 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {item.no && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 font-mono font-bold">
                              #{item.no}
                            </span>
                          )}
                          {item.code && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          {item.name}
                        </h4>
                        {item.spec && (
                          <p className="text-xs text-slate-500 line-clamp-1">{item.spec}</p>
                        )}
                      </div>

                      {item.img && (
                        <div
                          onClick={() => onZoomImage && onZoomImage(item.img!)}
                          className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer hover:opacity-85 transition relative"
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
                    </div>
                  </div>

                  {/* Inspection Status Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleCheck &&
                          onToggleCheck(activeRoomId, itemKey, 'ปกติ', item.name)
                        }
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                          isOk
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/60'
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
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                          isBad
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/60'
                        }`}
                      >
                        <X size={14} strokeWidth={2.5} />
                        <span>มีปัญหา</span>
                      </button>
                    </div>

                    {/* Defect note input */}
                    {isBad && (
                      <input
                        type="text"
                        value={check?.note || ''}
                        onChange={(e) =>
                          onUpdateNote && onUpdateNote(activeRoomId, itemKey, e.target.value)
                        }
                        placeholder="ระบุอาการเสีย หรือปัญหาที่พบ..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-white border border-rose-300 outline-none text-rose-900 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-500 shadow-xs"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 💾 Important Save & Report Button at bottom of Checklist */}
        {onOpenReport && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center">
            <button
              type="button"
              onClick={onOpenReport}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer active:scale-95 flex items-center justify-center gap-2.5"
            >
              <FileSpreadsheet size={18} />
              <span>💾 บันทึกข้อมูลเข้า Google Sheets & พรีวิวรายงาน</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
