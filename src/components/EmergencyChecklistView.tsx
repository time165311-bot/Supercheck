import React, { useState, useMemo, useRef } from 'react';
import {
  BriefcaseMedical,
  Truck,
  Check,
  X,
  AlertTriangle,
  CheckCheck,
  Search,
  Maximize2,
  ArrowLeft,
  MoreVertical,
  Calendar,
  Plus,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
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
  onAddItem?: (newItem: {
    name: string;
    groupName: string;
    spec?: string;
    qty?: string;
    exp?: string;
    img?: string;
  }) => void;
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
  onAddItem,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);

  // Week Selection State (สัปดาห์ที่ 1 - 4)
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Add Item Modal State
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemGroup, setNewItemGroup] = useState<string>('');
  const [customGroup, setCustomGroup] = useState<string>('');
  const [newItemSpec, setNewItemSpec] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemExp, setNewItemExp] = useState<string>('');
  const [newItemImgUrl, setNewItemImgUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      qty?: string;
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
          qty: item.qty,
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

  // Mark all items in active view as Normal for selected week
  const handleMarkAllNormal = () => {
    filteredItems.forEach((item) => {
      onToggleCheck(item.itemKey, 'ปกติ', item.name);
    });
  };

  // Local File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์รูปภาพเกิน 5MB กรุณาเลือกไฟล์ขนาดเล็กกว่านี้');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Str = event.target?.result as string;
        if (base64Str) {
          setNewItemImgUrl(base64Str);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle submit new item
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      alert('กรุณากรอกชื่อรายการอุปกรณ์');
      return;
    }

    const finalGroup = newItemGroup === '__custom__' ? customGroup.trim() : newItemGroup || (groups[0] || 'ทั่วไป');
    if (!finalGroup) {
      alert('กรุณาเลือกหรือกรอกหมวดหมู่/ตำแหน่ง');
      return;
    }

    if (onAddItem) {
      onAddItem({
        name: newItemName.trim(),
        groupName: finalGroup,
        spec: newItemSpec.trim(),
        qty: newItemQty.trim() || '1',
        exp: newItemExp.trim(),
        img: newItemImgUrl.trim(),
      });
    }

    // Reset Form
    setNewItemName('');
    setNewItemSpec('');
    setNewItemQty('1');
    setNewItemExp('');
    setNewItemImgUrl('');
    setIsAddItemModalOpen(false);
  };

  return (
    <div className="space-y-3.5 font-['TH_Sarabun_New','Sarabun',sans-serif] pb-28 animate-in fade-in duration-300 text-slate-800">
      
      {/* 🌟 Clean One UI Royal Blue Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white p-3.5 sm:p-4 rounded-[1.8rem] border border-blue-400/30 shadow-md flex justify-between items-center flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold transition cursor-pointer active:scale-95 border border-white/20 flex items-center justify-center"
            title="ย้อนกลับ"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 leading-tight">
              {type === 'bag' ? (
                <BriefcaseMedical size={20} className="text-amber-200 shrink-0" />
              ) : (
                <Truck size={20} className="text-cyan-200 shrink-0" />
              )}
              <span>{title}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ปุ่ม + เพิ่มรายการ (ถอดไอคอนปุ่มกล้องสแกนซ้ำซ้อนออกถาวร) */}
          <button
            type="button"
            onClick={() => {
              setNewItemGroup(groups[0] || 'ทั่วไป');
              setIsAddItemModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
            title="เพิ่มรายการอุปกรณ์ใหม่"
          >
            <Plus size={15} className="stroke-[2.5]" />
            <span>+ เพิ่มรายการ</span>
          </button>

          <button
            type="button"
            onClick={handleMarkAllNormal}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
            title={`กดตรวจผ่านปกติทุกรายการประจำสัปดาห์ที่ ${selectedWeek}`}
          >
            <CheckCheck size={15} />
            <span>ตรวจผ่านทั้งหมด (สัปดาห์ที่ {selectedWeek})</span>
          </button>
        </div>
      </div>

      {/* 📅 Week Selector Bar (สัปดาห์ที่ 1 - 4) */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Calendar size={16} className="text-blue-600" />
          <span>รอบสัปดาห์ที่ตรวจ:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[1, 2, 3, 4].map((wk) => (
            <button
              key={wk}
              type="button"
              onClick={() => setSelectedWeek(wk)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                selectedWeek === wk
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
              }`}
            >
              <span>สัปดาห์ที่ {wk}</span>
              {selectedWeek === wk && <CheckCircle2 size={12} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Progress & Summary Badge Bar */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <span>ความพร้อม (สัปดาห์ที่ {selectedWeek}):</span>
          <span className="text-blue-600 font-extrabold">
            {checkedCount} / {totalCount}
          </span>
          <span className="text-slate-500 font-normal">
            ({Math.round(totalCount > 0 ? (checkedCount / totalCount) * 100 : 0)}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            ✓ ปกติ {normalCount}
          </span>
          {defectiveCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>มีปัญหา {defectiveCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Group Selector Pills & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่ออุปกรณ์, รหัส, ตำแหน่ง..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition placeholder:text-slate-400 font-sans shadow-xs"
          />
        </div>

        {groups.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedGroup === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 flex items-center gap-1 ${
                    selectedGroup === grp
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isGrpDone
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{grp}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {grpChecked}/{grpCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 📋 Minimalist Clean Checklist Cards */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs shadow-xs">
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
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 space-y-2.5 ${
                  isBad
                    ? 'bg-rose-50/70 border-rose-300 shadow-xs text-slate-900'
                    : isOk
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-xs text-slate-900'
                    : 'bg-white border-slate-200 shadow-xs text-slate-900 hover:border-blue-200'
                }`}
              >
                {/* Minimal Header Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          {item.groupName}
                        </span>
                        {item.no && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold">
                            #{item.no}
                          </span>
                        )}
                        {item.code && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200">
                            {item.code}
                          </span>
                        )}
                      </div>

                      {/* 3-Dots Menu Button [⋮] */}
                      <button
                        type="button"
                        onClick={() => setActiveMenuKey(activeMenuKey === item.itemKey ? null : item.itemKey)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="ตัวเลือกเพิ่มเติม"
                      >
                        <MoreVertical size={15} />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {item.name}
                    </h3>

                    {item.spec && (
                      <p className="text-xs text-slate-500 line-clamp-1 font-sans">{item.spec}</p>
                    )}

                    {item.exp && (
                      <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                        <span>⏳ EXP:</span>
                        <span>{item.exp}</span>
                      </p>
                    )}
                  </div>

                  {item.img && (
                    <div
                      onClick={() => onZoomImage && onZoomImage(item.img!)}
                      className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition relative shadow-xs"
                    >
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                      <Maximize2
                        size={10}
                        className="absolute bottom-1 right-1 text-white bg-black/60 rounded p-0.5"
                      />
                    </div>
                  )}
                </div>

                {/* 3-Dots Dropdown Detail Menu */}
                {activeMenuKey === item.itemKey && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 animate-in zoom-in-95">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1 font-bold text-slate-800">
                      <span>รายละเอียดอุปกรณ์</span>
                      <button
                        type="button"
                        onClick={() => setActiveMenuKey(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-slate-700"><b>ชื่อ:</b> {item.name}</p>
                    {item.code && <p className="text-slate-700"><b>รหัส:</b> {item.code}</p>}
                    {item.spec && <p className="text-slate-700"><b>คุณลักษณะ:</b> {item.spec}</p>}
                    {item.location && <p className="text-slate-700"><b>ตำแหน่ง:</b> {item.location}</p>}
                    {item.exp && <p className="text-rose-600 font-bold"><b>วันหมดอายุ:</b> {item.exp}</p>}
                  </div>
                )}

                {/* Compact Touch Check Buttons */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                        isOk
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                      }`}
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>ปกติ (พร้อมใช้)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleCheck(item.itemKey, 'ผิดปกติ', item.name)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                        isBad
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80'
                      }`}
                    >
                      <X size={16} strokeWidth={2.5} />
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
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-rose-50 border border-rose-300 outline-none text-rose-900 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-300 font-sans"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ➕ Modal เพิ่มรายการอุปกรณ์ใหม่ */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-blue-600" />
                <span>เพิ่มรายการอุปกรณ์ ({type === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'})</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ชื่อรายการอุปกรณ์ <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="เช่น Laryngoscope set, Ambu bag, 0.9% NSS"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">หมวดหมู่ / ชั้นวาง <span className="text-rose-500">*</span></label>
                <select
                  value={newItemGroup}
                  onChange={(e) => setNewItemGroup(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="__custom__">+ สร้างหมวดหมู่ใหม่...</option>
                </select>
                {newItemGroup === '__custom__' && (
                  <input
                    type="text"
                    value={customGroup}
                    onChange={(e) => setCustomGroup(e.target.value)}
                    placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..."
                    className="w-full mt-2 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">จำนวนตั้งต้น</label>
                  <input
                    type="text"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="เช่น 1 หรือ 1, 1"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">วันหมดอายุ (EXP)</label>
                  <input
                    type="text"
                    value={newItemExp}
                    onChange={(e) => setNewItemExp(e.target.value)}
                    placeholder="เช่น 31/12/2026"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">คุณลักษณะ / สเปกเพิ่มเติม</label>
                <input
                  type="text"
                  value={newItemSpec}
                  onChange={(e) => setNewItemSpec(e.target.value)}
                  placeholder="เช่น ขนาด No. 3, 4 หรือ ชนิดพร้อมใช้"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* 📷 รูปภาพอุปกรณ์ + Local File Upload */}
              <div className="space-y-1 pt-1">
                <label className="block text-slate-700 font-bold">รูปภาพอุปกรณ์</label>
                
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newItemImgUrl}
                      onChange={(e) => setNewItemImgUrl(e.target.value)}
                      placeholder="วาง URL รูปภาพ..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:border-blue-500"
                    />
                    <ImageIcon size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Local File Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 flex items-center gap-1 shrink-0 transition cursor-pointer"
                    title="เลือกไฟล์รูปภาพจากเครื่องมือถือหรือคอมพิวเตอร์"
                  >
                    <Upload size={14} />
                    <span>อัปโหลด</span>
                  </button>
                </div>

                {newItemImgUrl && (
                  <div className="mt-2 flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <img src={newItemImgUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-300" />
                    <span className="text-[11px] text-emerald-700 font-bold">✓ โหลดรูปภาพสำเร็จ</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
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

    </div>
  );
};
