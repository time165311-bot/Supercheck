import React, { useState } from 'react';
import { RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { EquipmentItem, RoomDef } from '../types';
import { CORRIDOR_LABELS, CORRIDORS } from '../constants/initialData';

interface FloorMapProps {
  rooms: RoomDef[];
  equipment: Record<string, EquipmentItem[]>;
  globalChecks: Record<string, Record<string, { result: string }>>;
  onSelectRoom: (roomId: string) => void;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  rooms,
  equipment,
  globalChecks,
  onSelectRoom,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const initialTouchDistanceRef = React.useRef<number | null>(null);
  const initialScaleRef = React.useRef<number>(1.0);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMovedRef = React.useRef<boolean>(false);

  const panRef = React.useRef(pan);
  panRef.current = pan;
  const zoomScaleRef = React.useRef(zoomScale);
  zoomScaleRef.current = zoomScale;
  const isDraggingRef = React.useRef(isDragging);
  isDraggingRef.current = isDragging;

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

  // Keyboard shortcut support: Ctrl + / Ctrl - / Ctrl 0
  React.useEffect(() => {
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

  // Isolate Zoom & Pan: non-passive wheel & touch listeners so the webpage never scrolls or zooms
  React.useEffect(() => {
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
      // Prevent browser default page scroll and page pinch-to-zoom
      if (e.cancelable) {
        e.preventDefault();
      }
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

  // Mouse drag handlers for desktop
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
    // If the user was dragging/panning the map, do not trigger room selection
    if (dragMovedRef.current) return;
    onSelectRoom(roomId);
  };

  return (
    <div className="space-y-2.5">
      {/* Search Bar & Zoom Bar Header */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขครุภัณฑ์, SAP, หรือชื่อเครื่อง..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-xl border border-transparent focus:border-accent focus:bg-white dark:focus:bg-neutral-900 text-xs outline-none focus:ring-2 focus:ring-accent/20 transition font-sans"
          />
        </div>

        {/* Zoom Controls (Direct Drag, Free Zoom) */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#101822] p-1 rounded-xl border border-neutral-200 dark:border-[#223142] text-xs shrink-0 shadow-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            title="ย่อแผนผัง"
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#152230] transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-300 w-12 text-center select-none">
            {Math.round(zoomScale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            title="ขยายแผนผัง (ซูมเข้า)"
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#152230] transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {(zoomScale !== 1.0 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              onClick={handleResetZoom}
              title="รีเซ็ตตำแหน่งและขนาดกลับสู่ 100%"
              className="p-1.5 rounded-lg text-accent hover:text-accent-hover dark:text-accent hover:bg-accent-light dark:hover:bg-accent/20 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold active:scale-95"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">รีเซ็ต</span>
            </button>
          )}
        </div>
      </div>

      {/* Search results dropdown */}
      {searchTerm.trim() && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 max-h-44 overflow-y-auto space-y-1 text-xs">
          {matches.length === 0 ? (
            <div className="p-3 text-center text-slate-400 text-xs">
              ไม่พบครุภัณฑ์ที่ค้นหา
            </div>
          ) : (
            matches.map((m, idx) => (
              <button
                key={idx}
                onClick={() => onSelectRoom(m.room.id)}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between gap-2 transition"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {m.item.no && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 mr-1.5 font-bold">
                        #{m.item.no}
                      </span>
                    )}
                    {m.item.name}
                  </div>
                </div>
                <span className="text-xs font-semibold text-accent shrink-0">
                  📍 {m.room.n}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Map Drag & Zoom Indicator & Helper */}
      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
        <span>💡 ใช้นิ้วหรือเมาส์ลากเลื่อนผังได้โดยตรง | จีบนิ้วเข้า-ออกเพื่อซูมอิสระ</span>
        <span className="text-accent font-semibold font-mono">
          {Math.round(zoomScale * 100)}%
        </span>
      </div>

      {/* Interactive Map Container with Direct Touch & Drag */}
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
        className="bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-3 border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[70vh] min-h-[380px] sm:min-h-[460px] relative select-none flex items-center justify-center"
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
          <svg
            viewBox="80 480 1130 1330"
            className="w-full h-auto block select-none"
          >
            {/* Corridors */}
            <g className="fill-neutral-100 dark:fill-[#0c141d] stroke-neutral-200 dark:stroke-[#1d2a38] stroke-1">
              {CORRIDORS.map((c, i) => (
                <rect key={i} x={c[0]} y={c[1]} width={c[2]} height={c[3]} rx={4} />
              ))}
            </g>

            {/* Labels */}
            {CORRIDOR_LABELS.map((c, i) => (
              <text
                key={i}
                x={c[1]}
                y={c[2]}
                className="fill-neutral-400 dark:fill-neutral-500 text-[11px] font-mono tracking-wider uppercase font-semibold"
                textAnchor="middle"
              >
                {c[0]}
              </text>
            ))}

            {/* Rooms */}
            {rooms.map((r) => {
              const lines = r.l.split('|');
              const cx = r.x + r.w / 2;
              const fs = 19;
              const eqList = r.m ? equipment[r.id] || [] : [];
              const rCount = eqList.length;
              const ty =
                r.y +
                r.h / 2 -
                (lines.length - 1) * fs * 0.6 -
                (r.m ? 8 : 0) +
                fs * 0.35;

              const isHit = hitRooms[r.id];

              const rMap = globalChecks[r.id] || {};
              let checkedInRoom = 0;
              eqList.forEach((it) => {
                const k = `${r.n}|${it.name}|${it.code || ''}`;
                if (rMap[k] && rMap[k].result) checkedInRoom++;
              });
              const isFullyChecked = rCount > 0 && checkedInRoom >= rCount;

              return (
                <g
                  key={r.id}
                  onClick={r.m ? () => handleRoomClick(r.id) : undefined}
                  className={r.m ? 'cursor-pointer hover:opacity-95 transition-opacity group' : 'cursor-default'}
                >
                  <rect
                    x={r.x + 3}
                    y={r.y + 3}
                    width={r.w - 6}
                    height={r.h - 6}
                    rx={6}
                    fill={r.c}
                    fillOpacity={isHit ? 0.35 : r.m ? 0.18 : 0.08}
                    stroke={isHit ? '#0071e3' : isFullyChecked ? '#10b981' : r.c}
                    strokeWidth={isHit ? 3.5 : isFullyChecked ? 2.5 : 1.5}
                  />

                  <text
                    fontSize={fs}
                    className="fill-slate-800 dark:fill-slate-100 font-bold pointer-events-none"
                    textAnchor="middle"
                  >
                    {lines.map((t, idx) => (
                      <tspan key={idx} x={cx} y={ty + idx * fs * 1.25}>
                        {t}
                      </tspan>
                    ))}
                  </text>

                  {r.m && (
                    <text
                      fontSize={11}
                      className="pointer-events-none"
                      textAnchor="middle"
                    >
                      <tspan
                        x={cx}
                        y={ty + lines.length * fs * 1.25 + 4}
                        className={
                          isFullyChecked
                            ? 'fill-emerald-600 dark:fill-emerald-400 font-semibold'
                            : 'fill-slate-500 dark:fill-slate-400'
                        }
                      >
                        {isFullyChecked
                          ? `✓ ครบ (${rCount})`
                          : `${checkedInRoom}/${rCount}`}
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
  );
};
