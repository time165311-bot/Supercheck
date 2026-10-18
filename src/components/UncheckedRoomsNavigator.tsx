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
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3.5 sm:p-4 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-xs oneui-card">
      {/* Header and Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
            ห้องที่ต้องตรวจเช็ค ({pendingRooms.length === 0 ? 'ครบทุกห้องแล้ว' : `ค้างอีก ${pendingRooms.length} ห้อง`})
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
              filterMode === 'pending'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            ค้างตรวจ ({pendingRooms.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
              filterMode === 'all'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            ทั้งหมด ({interactiveRooms.length})
          </button>
        </div>
      </div>

      {/* Room list chips */}
      {displayedRooms.length === 0 ? (
        <div className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>ตรวจเช็คครบทุกห้องเรียบร้อยแล้ว</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayedRooms.map(({ room, remaining, isCompleted }) => {
            const isActive = activeRoomId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={`px-3 py-1.5 rounded-xl border text-left transition flex items-center gap-1.5 cursor-pointer ios-touch text-xs ${
                  isActive
                    ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold'
                    : isCompleted
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-blue-300'
                }`}
              >
                <span className="font-semibold">{room.n}</span>
                {isCompleted ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-0.5">
                    <span>✓</span>
                    <span>ครบแล้ว</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                    เหลืออีก {remaining} รายการ
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
