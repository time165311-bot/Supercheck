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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const initialTouchDistanceRef = React.useRef<number | null>(null);
  const initialScaleRef = React.useRef<number>(1.0);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(Number((prev + 0.2).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(Number((prev - 0.2).toFixed(2)), 0.6));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  // Keyboard shortcut support: Ctrl + / Ctrl - / Ctrl 0
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
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

  // Wheel zoom when hovering over map container with Ctrl key
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else if (e.deltaY > 0) {
        handleZoomOut();
      }
    }
  };

  // Mobile pinch-to-zoom handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      initialTouchDistanceRef.current = dist;
      initialScaleRef.current = zoomScale;
    } else {
      initialTouchDistanceRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialTouchDistanceRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      if (initialTouchDistanceRef.current > 0) {
        const factor = dist / initialTouchDistanceRef.current;
        const newScale = Number((initialScaleRef.current * factor).toFixed(2));
        setZoomScale(Math.min(Math.max(newScale, 0.6), 3.0));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialTouchDistanceRef.current = null;
    }
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

  return (
    <div className="space-y-2.5">
      {/* Search Bar & Zoom Bar Header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขครุภัณฑ์, SAP, หรือชื่อเครื่อง..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-1 focus:ring-sky-500 transition"
          />
        </div>

        {/* Zoom Controls (แว่นขยาย ซูมเข้า/ออก ได้ทั้งในมือถือและคอม) */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shrink-0 shadow-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            title="ย่อแผนผัง"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-10 text-center select-none">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="ขยายแผนผัง (ซูมเข้า)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoomScale !== 1.0 && (
            <button
              type="button"
              onClick={handleResetZoom}
              title="รีเซ็ตขนาด 100%"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
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
                  </div>                </div>
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                  📍 {m.room.n}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Zoom scale indicator if scaled */}
      {zoomScale !== 1.0 && (
        <div className="flex justify-end text-[11px] text-sky-600 dark:text-sky-400 font-semibold px-1">
          <span>ขยาย {Math.round(zoomScale * 100)}%</span>
        </div>
      )}

      {/* Interactive Map Container with touch & desktop scroll support */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-3 border border-slate-200 dark:border-slate-800 overflow-auto max-h-[70vh] relative select-none touch-pan-x touch-pan-y"
      >
        <div
          className="transition-transform duration-150 origin-top-left"
          style={{
            transform: `scale(${zoomScale})`,
            width: zoomScale > 1 ? `${zoomScale * 100}%` : '100%',
          }}
        >
          <svg
            viewBox="80 480 1130 1330"
            className="w-full h-auto block select-none"
          >
            {/* Corridors */}
            <g className="fill-slate-100 dark:fill-slate-800/60 stroke-slate-200 dark:stroke-slate-700/80 stroke-1">
              {CORRIDORS.map((c, i) => (
                <rect key={i} x={c[0]} y={c[1]} width={c[2]} height={c[3]} rx={6} />
              ))}
            </g>

            {/* Labels */}
            {CORRIDOR_LABELS.map((c, i) => (
              <text
                key={i}
                x={c[1]}
                y={c[2]}
                className="fill-slate-400 dark:fill-slate-500 text-[12px] font-medium"
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
                  onClick={r.m ? () => onSelectRoom(r.id) : undefined}
                  className={r.m ? 'cursor-pointer hover:opacity-90 transition-opacity' : 'cursor-default'}
                >
                  <rect
                    x={r.x + 3}
                    y={r.y + 3}
                    width={r.w - 6}
                    height={r.h - 6}
                    rx={8}
                    fill={r.c}
                    fillOpacity={isHit ? 0.35 : r.m ? 0.16 : 0.08}
                    stroke={isHit ? '#ef4444' : isFullyChecked ? '#10b981' : r.c}
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
