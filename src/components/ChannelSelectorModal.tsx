import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Check, Layers, Copy, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { WardChannel } from '../types';

export interface ChannelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: WardChannel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (name: string, duplicateFromMaster: boolean) => void;
  onRenameChannel: (channelId: string, newName: string) => void;
  onDeleteChannel: (channelId: string) => void;
}

export const ChannelSelectorModal: React.FC<ChannelSelectorModalProps> = ({
  isOpen,
  onClose,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(activeChannelId);
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [duplicateOption, setDuplicateOption] = useState<boolean>(true);

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Keep local selection in sync with activeChannelId prop
  useEffect(() => {
    setSelectedChannelId(activeChannelId);
  }, [activeChannelId, isOpen]);

  if (!isOpen) return null;

  const handleSelectChannel = (channelId: string) => {
    if (editingChannelId === channelId) return;
    setSelectedChannelId(channelId);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      alert('กรุณาระบุชื่อ Channel หรือชื่อวอร์ด/หน่วยงาน');
      return;
    }
    onCreateChannel(newChannelName.trim(), duplicateOption);
    setNewChannelName('');
    setIsAdding(false);
  };

  const handleRenameSubmit = (channelId: string) => {
    if (!editingName.trim()) {
      alert('กรุณาระบุชื่อวอร์ดใหม่');
      return;
    }
    onRenameChannel(channelId, editingName.trim());
    setEditingChannelId(null);
  };

  const handleConfirmAndClose = () => {
    onSelectChannel(selectedChannelId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#181A20] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                เลือกและจัดการ Channel / วอร์ด
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                สลับวอร์ดเพื่อตรวจเช็กหรือพิมพ์ฟอร์มแยกอิสระ 100%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Channel List */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              รายการ Channel / วอร์ดทั้งหมด ({channels.length})
            </label>

            {channels.map((channel) => {
              const isActive = channel.id === selectedChannelId;
              const isEditing = editingChannelId === channel.id;

              return (
                <div
                  key={channel.id}
                  onClick={() => handleSelectChannel(channel.id)}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer active:scale-98 ${
                    isActive
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-blue-400 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectChannel(channel.id);
                      }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isActive && <Check size={12} strokeWidth={3} />}
                    </button>

                    {isEditing ? (
                      <div
                        className="flex items-center gap-2 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl border border-blue-500 bg-white dark:bg-black/40 text-xs font-bold text-slate-900 dark:text-white outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSubmit(channel.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingChannelId(null)}
                          className="px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm truncate">{channel.name}</span>
                          {channel.isDefault && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                              <ShieldCheck size={10} /> Master
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold shrink-0 animate-in fade-in">
                              ✓ กำลังใช้งาน
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions for Non-editing state */}
                  {!isEditing && (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingChannelId(channel.id);
                          setEditingName(channel.name);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
                        title="เปลี่ยนชื่อ Channel"
                      >
                        <Edit3 size={14} />
                      </button>

                      {!channel.isDefault && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`คุณต้องการลบ Channel "${channel.name}" ใช่หรือไม่?`)) {
                              onDeleteChannel(channel.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="ลบ Channel นี้"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create New Channel Section */}
          {isAdding ? (
            <form onSubmit={handleCreateSubmit} className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-blue-200 dark:border-blue-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Plus size={14} />
                  <span>สร้าง Channel / วอร์ดใหม่</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ Channel / วอร์ด
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="เช่น วอร์ด OPD, วอร์ด IPD 1, ห้องผ่าตัด OR 2"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  รูปแบบโครงสร้างรายการตั้งต้น
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateOption(true)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      duplicateOption
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
                      <Copy size={13} />
                      <span>คัดลอก Master</span>
                    </div>
                    <p className={`text-[10px] ${duplicateOption ? 'text-blue-100' : 'text-slate-500'}`}>
                      ดึงรายการอุปกรณ์ตั้งต้นทั้งหมดจาก Master
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateOption(false)}
                    className={`!cursor-pointer p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      !duplicateOption
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
                      <FileText size={13} />
                      <span>โครงสร้างว่างเปล่า</span>
                    </div>
                    <p className={`text-[10px] ${!duplicateOption ? 'text-blue-100' : 'text-slate-500'}`}>
                      สร้างเป็น Channel ใหม่โดยไม่มีรายการตั้งต้น
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>สร้าง Channel นี้</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-blue-500 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-blue-600 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>+ เพิ่ม Channel / วอร์ดใหม่</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            * ข้อมูลของแต่ละ Channel จะถูกแยกเก็บเป็นอิสระ 100%
          </p>
          <button
            type="button"
            onClick={handleConfirmAndClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition active:scale-95"
          >
            ตกลง / เลือกใช้วอร์ดนี้
          </button>
        </div>
      </div>
    </div>
  );
};
