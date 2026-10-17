import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, MapPin } from 'lucide-react';
import { EquipmentItem, RoomDef } from '../types';

interface UncheckedRoomsNavigatorProps {
  rooms: RoomDef[];
  equipment: Record<string, EquipmentItem[]>;
  globalChecks: Record<string, Record<string, { result: string }>>;
  onSelectRoom: (roomId: string) => void;
  activeRoomId?: string;
}

export const UncheckedRoomsNavigator: React.FC<UncheckedRoomsNavigatorProps> = ({
  rooms,
  equipment,
  globalChecks,
  onSelectRoom,
  activeRoomId,
}) => {
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');

  const interactiveRooms = rooms.filter((r) => {
    if (!r.m) return false;
    const list = equipment[r.id] || [];
    return list.length > 0;
  });

  const roomStats = interactiveRooms.map((r) => {
    const list = equipment[r.id] || [];
    const rTotal = list.length;
    const rMap = globalChecks[r.id] || {};
    let checked = 0;
    list.forEach((it) => {
      const k = `${r.n}|${it.name}|${it.code || ''}`;
      if (rMap[k] && rMap[k].result) checked++;
    });
    const remaining = rTotal - checked;
    const isCompleted = rTotal > 0 && remaining === 0;

    return {
      room: r,
      total: rTotal,
      checked,
      remaining,
      isCompleted,
    };
  });

  const pendingRooms = roomStats.filter((s) => !s.isCompleted);
  const completedRooms = roomStats.filter((s) => s.isCompleted);

  const displayedRooms = filterMode === 'pending' ? pendingRooms : roomStats;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 text-xs">
      {/* Header and Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
            นำทางตรวจเช็คห้อง ({pendingRooms.length === 0 ? 'ครบทุกห้องแล้ว' : `ยังค้างอีก ${pendingRooms.length} ห้อง`})
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-2 py-0.5 rounded-md transition ${
              filterMode === 'pending'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ค้างตรวจ ({pendingRooms.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2 py-0.5 rounded-md transition ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ทุกห้อง ({interactiveRooms.length})
          </button>
        </div>
      </div>

      {/* Room list chips */}
      {displayedRooms.length === 0 ? (
        <div className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>ยอดเยี่ยม! คุณตรวจเช็คครุภัณฑ์ครบทุกห้องเรียบร้อยแล้ว</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayedRooms.map(({ room, total, checked, remaining, isCompleted }) => {
            const isActive = activeRoomId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={`px-2.5 py-1.5 rounded-xl border text-left transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-50 dark:bg-sky-950/60'
                    : isCompleted
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="font-semibold">{room.n}</span>
                {isCompleted ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                    ✓ ครบ
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300 font-bold">
                    เหลือ {remaining}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
