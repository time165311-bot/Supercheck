import React, { useState, useMemo } from 'react';
import {
  BriefcaseMedical,
  Truck,
  Check,
  X,
  AlertTriangle,
  CheckCheck,
  Camera,
  Search,
  Maximize2,
} from 'lucide-react';
import { CheckItemState, ListConfig } from '../types';

export interface EmergencyChecklistProps {
  type: 'bag' | 'cart';
  title: string;
  subtitle: string;
  listConfig: ListConfig;
  checks: Record<string, CheckItemState>;
  onToggleCheck: (itemKey: string, result: 'ปกติ' | 'ผิดปกติ', itemName: string) => void;
  onUpdateNote: (itemKey: string, note: string) => void;
  onOpenBarcodeScan?: () => void;
  onZoomImage?: (imgUrl: string) => void;
  onBack: () => void;
}

export const EmergencyChecklistView: React.FC<EmergencyChecklistProps> = ({
  type,
  title,
  subtitle,
  listConfig,
  checks,
  onToggleCheck,
  onUpdateNote,
  onOpenBarcodeScan,
  onZoomImage,
  onBack,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const groups = useMemo(() => {
    if (!listConfig || !listConfig.groups) return [];
    return Object.keys(listConfig.groups);
  }, [listConfig]);

  // Flattened items list
  const allItems = useMemo(() => {
    const itemsList: Array<{
      itemKey: string;
      id: string;
      name: string;
      no?: string;
      code?: string;
      spec?: string;
      location?: string;
      exp?: string;
      img?: string;
      groupName: string;
    }> = [];

    if (!listConfig || !listConfig.groups) return itemsList;

    Object.entries(listConfig.groups).forEach(([groupName, groupItems]) => {
      groupItems.forEach((item, idx) => {
        const itemKey = item.id || `${type}_${groupName}_${idx}`;
        itemsList.push({
          itemKey,
          id: item.id || itemKey,
          name: item.name,
          no: item.no,
          code: item.code,
          spec: item.spec,
          location: item.location || groupName,
          exp: item.exp,
          img: item.img,
          groupName,
        });
      });
    });

    return itemsList;
  }, [listConfig, type]);

  // Filtered Items based on group filter and search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesGroup = selectedGroup === 'all' || item.groupName === selectedGroup;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.spec && item.spec.toLowerCase().includes(q)) ||
        item.groupName.toLowerCase().includes(q);

      return matchesGroup && matchesSearch;
    });
  }, [allItems, selectedGroup, searchQuery]);

  // Summary statistics
  const totalCount = allItems.length;
  const checkedCount = allItems.filter((i) => checks[i.itemKey]?.result).length;
  const normalCount = allItems.filter((i) => checks[i.itemKey]?.result === 'ปกติ').length;
  const defectiveCount = allItems.filter((i) => checks[i.itemKey]?.result === 'ผิดปกติ').length;

  // Mark all items in active view as Normal
  const handleMarkAllNormal = () => {
    filteredItems.forEach((item) => {
      onToggleCheck(item.itemKey, 'ปกติ', item.name);
    });
  };

  return (
    <div className="space-y-4 font-['TH_Sarabun_New','Sarabun',sans-serif] pb-28 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-[#181A20] backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-xl flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-[#F8FAFC] font-bold text-xs transition cursor-pointer active:scale-95 border border-slate-700"
          >
            &larr; กลับ
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              {type === 'bag' ? (
                <BriefcaseMedical size={20} className="text-rose-400" />
              ) : (
                <Truck size={20} className="text-amber-400" />
              )}
              <span>{title}</span>
            </h2>
            <p className="text-xs text-[#E2E8F0] mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBarcodeScan && (
            <button
              type="button"
              onClick={onOpenBarcodeScan}
              className="p-2.5 rounded-2xl bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Camera size={16} />
              <span>สแกนบาร์โค้ด</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkAllNormal}
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="กดตรวจผ่านปกติทุกรายการในหมวดนี้"
          >
            <CheckCheck size={16} />
            <span>ตรวจผ่านทั้งหมด</span>
          </button>
        </div>
      </div>

      {/* Progress & Summary Badge Bar */}
      <div className="p-4 rounded-[1.8rem] bg-[#181A20] border border-white/10 shadow-lg flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#F8FAFC]">
          <span>ความพร้อมใช้งาน:</span>
          <span className="text-[#3B82F6] text-sm font-black">
            {checkedCount} / {totalCount}
          </span>
          <span className="text-[#E2E8F0]">รายการ ({Math.round(totalCount > 0 ? (checkedCount / totalCount) * 100 : 0)}%)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            ✓ ปกติ {normalCount}
          </span>
          {defectiveCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>ชำรุด {defectiveCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Group Selector Pills & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-[#E2E8F0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่ออุปกรณ์, เลขโค้ด, หรือตำแหน่ง..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#101216] border border-slate-700 text-[#F8FAFC] text-xs outline-none focus:border-[#3B82F6] transition placeholder:text-[#E2E8F0]/50 font-sans"
          />
        </div>

        {groups.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedGroup === 'all'
                  ? 'bg-[#3B82F6] text-white shadow-md'
                  : 'bg-[#181A20] text-[#E2E8F0] border border-slate-700 hover:bg-slate-800'
              }`}
            >
              ทั้งหมด ({allItems.length})
            </button>
            {groups.map((grp) => {
              const grpCount = allItems.filter((i) => i.groupName === grp).length;
              const grpChecked = allItems.filter(
                (i) => i.groupName === grp && checks[i.itemKey]?.result
              ).length;
              const isGrpDone = grpCount > 0 && grpChecked >= grpCount;

              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    selectedGroup === grp
                      ? 'bg-[#3B82F6] text-white shadow-md'
                      : isGrpDone
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                      : 'bg-[#181A20] text-[#E2E8F0] border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{grp}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 opacity-80">
                    {grpChecked}/{grpCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Clean High-Contrast Checklist Cards (Single-Column Checklist View) */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-[#181A20] rounded-[2rem] border border-slate-800 text-[#E2E8F0] text-xs">
            ไม่พบรายการอุปกรณ์ตรงตามคำค้นหา
          </div>
        ) : (
          filteredItems.map((item) => {
            const check = checks[item.itemKey];
            const isOk = check?.result === 'ปกติ';
            const isBad = check?.result === 'ผิดปกติ';

            return (
              <div
                key={item.itemKey}
                className={`p-4 rounded-[1.8rem] border transition-all duration-200 space-y-3 ${
                  isBad
                    ? 'bg-rose-950/30 border-rose-500/50 text-[#F8FAFC]'
                    : isOk
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-[#F8FAFC]'
                    : 'bg-[#181A20] border-slate-800 text-[#F8FAFC]'
                }`}
              >
                {/* Header & Meta Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-[#E2E8F0] font-bold border border-slate-700">
                        {item.groupName}
                      </span>
                      {item.no && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6] text-white font-mono font-bold">
                          #{item.no}
                        </span>
                      )}
                      {item.code && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-[#F8FAFC] font-mono">
                          {item.code}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-[#F8FAFC] leading-snug">
                      {item.name}
                    </h3>

                    {item.spec && (
                      <p className="text-xs text-[#E2E8F0] line-clamp-1">{item.spec}</p>
                    )}

                    {item.exp && (
                      <p className="text-xs text-rose-400 font-bold flex items-center gap-1">
                        <span>⏳ วันหมดอายุ (EXP):</span>
                        <span>{item.exp}</span>
                      </p>
                    )}
                  </div>

                  {item.img && (
                    <div
                      onClick={() => onZoomImage && onZoomImage(item.img!)}
                      className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-700 shrink-0 cursor-pointer hover:opacity-80 transition relative"
                    >
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      <Maximize2
                        size={10}
                        className="absolute bottom-1 right-1 text-white bg-black/60 rounded p-0.5"
                      />
                    </div>
                  )}
                </div>

                {/* Big Touch Buttons: [✓ ปกติ] [✕ มีปัญหา] */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name)}
                      className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
                        isOk
                          ? 'bg-[#00A400] text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-slate-800/90 text-[#F8FAFC] hover:bg-emerald-950/40 hover:text-emerald-400 border border-slate-700'
                      }`}
                    >
                      <Check size={18} strokeWidth={2.5} />
                      <span>ปกติ (พร้อมใช้)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleCheck(item.itemKey, 'ผิดปกติ', item.name)}
                      className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
                        isBad
                          ? 'bg-[#FA383E] text-white shadow-lg shadow-rose-600/30'
                          : 'bg-slate-800/90 text-[#F8FAFC] hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700'
                      }`}
                    >
                      <X size={18} strokeWidth={2.5} />
                      <span>มีปัญหา</span>
                    </button>
                  </div>

                  {/* Defect note input when marked defective */}
                  {isBad && (
                    <input
                      type="text"
                      value={check?.note || ''}
                      onChange={(e) => onUpdateNote(item.itemKey, e.target.value)}
                      placeholder="ระบุอาการเสีย หรือปัญหาที่พบ..."
                      className="w-full px-3.5 py-2 text-xs rounded-2xl bg-rose-950/40 border border-rose-500/50 outline-none text-rose-200 placeholder:text-rose-400/60 focus:ring-1 focus:ring-rose-500 font-sans"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
