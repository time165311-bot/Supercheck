import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Layers,
  Copy,
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { WardChannel } from '../types';
import { DEFAULT_WARD_ID, isValidWardCodeInput } from '../utils/wardUtils';

export interface ChannelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: WardChannel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (name: string, duplicateFromMaster: boolean, customCode?: string) => void;
  onJoinWardCode?: (wardCode: string) => Promise<{ ok: boolean; error?: string }>;
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
  onJoinWardCode,
  onRenameChannel,
  onDeleteChannel,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newWardCode, setNewWardCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [duplicateOption, setDuplicateOption] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<WardChannel | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setConfirmDeleteChannel(null);
      setEditingChannelId(null);
      setJoinCodeInput('');
      setNewWardCode('');
      setCopiedId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectChannelImmediate = (channelId: string) => {
    if (editingChannelId === channelId) return;
    onSelectChannel(channelId);
    onClose();
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setFormError('กรุณาระบุรหัสห้องวอร์ดที่ต้องการเชื่อมต่อ เช่น ANES-MASTER หรือ OR-2');
      return;
    }
    if (!isValidWardCodeInput(code)) {
      setFormError('รหัสห้องวอร์ดต้องมี 2–48 ตัวอักษร (ใช้ A-Z, 0-9, _ หรือ - เท่านั้น)');
      return;
    }
    setFormError('');
    if (onJoinWardCode) {
      setJoinLoading(true);
      const res = await onJoinWardCode(code);
      setJoinLoading(false);
      if (res.ok) {
        setJoinCodeInput('');
        onClose();
      } else {
        setFormError(res.error || 'ไม่สามารถเชื่อมต่อรหัสห้องวอร์ดได้');
      }
    } else {
      onSelectChannel(code);
      onClose();
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      setFormError('กรุณาระบุชื่อวอร์ด/หน่วยงาน');
      return;
    }
    const trimmedCode = newWardCode.trim().toUpperCase();
    if (trimmedCode && !isValidWardCodeInput(trimmedCode)) {
      setFormError('รหัสห้องวอร์ดต้องมี 2–48 ตัวอักษร (ใช้ A-Z, 0-9, _ หรือ - เท่านั้น)');
      return;
    }
    setFormError('');
    onCreateChannel(newChannelName.trim(), duplicateOption, trimmedCode || undefined);
    setNewChannelName('');
    setNewWardCode('');
    setIsAdding(false);
  };

  const handleRenameSubmit = (channelId: string) => {
    if (!editingName.trim()) {
      setFormError('กรุณาระบุชื่อวอร์ดใหม่');
      return;
    }
    setFormError('');
    onRenameChannel(channelId, editingName.trim());
    setEditingChannelId(null);
  };

  const handleCopyCode = async (e: React.MouseEvent, wardId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(wardId);
      setCopiedId(wardId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#181A20] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                รหัสห้องวอร์ดกลาง (Shared Ward Workspace)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เชื่อมคอมพิวเตอร์ มือถือ และ Incognito เข้าห้องวอร์ดเดียวกันแบบ Real-time
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
          {formError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
              <span>{formError}</span>
              <button type="button" onClick={() => setFormError('')} className="p-1 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Join / Switch Ward by Code */}
          <form
            onSubmit={handleJoinSubmit}
            className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-500/30 space-y-2"
          >
            <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Link2 size={14} />
              <span>เชื่อมต่อด้วยรหัสห้องวอร์ด (Ward Code)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="เช่น ANES-MASTER, OR-2, ICU-1"
                className="flex-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-500/40 bg-white dark:bg-black/30 font-mono text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 uppercase"
              />
              <button
                type="submit"
                disabled={joinLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap cursor-pointer transition shadow-xs"
              >
                {joinLoading ? 'กำลังเชื่อม...' : 'เชื่อมต่อ'}
              </button>
            </div>
          </form>

          {/* In-UI Delete Confirmation Banner */}
          {confirmDeleteChannel && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-100">
                    ยืนยันการลบวอร์ด &ldquo;{confirmDeleteChannel.name}&rdquo; ({confirmDeleteChannel.id})?
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                    ข้อมูลการตรวจเช็กของวอร์ดนี้จะถูกลบออกอย่างถาวร (ไม่สามารถกู้คืนได้)
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteChannel(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteChannel(confirmDeleteChannel.id);
                    setConfirmDeleteChannel(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  ยืนยันลบถาวร
                </button>
              </div>
            </div>
          )}

          {/* Ward List */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              ห้องวอร์ดบนอุปกรณ์นี้ ({channels.length})
            </label>

            {channels.map((channel) => {
              const isActive = channel.id === activeChannelId;
              const isEditing = editingChannelId === channel.id;

              return (
                <div
                  key={channel.id}
                  onClick={() => handleSelectChannelImmediate(channel.id)}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                    isActive
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-blue-400 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isActive && <Check size={12} strokeWidth={3} />}
                    </div>

                    {isEditing ? (
                      <div
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-blue-500 bg-white dark:bg-black/40 text-xs font-bold text-slate-900 dark:text-white outline-none shadow-sm"
                          autoFocus
                          placeholder="ชื่อวอร์ด/หน่วยงาน..."
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRenameSubmit(channel.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm whitespace-nowrap"
                          >
                            บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingChannelId(null);
                              setFormError('');
                            }}
                            className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm whitespace-nowrap"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm truncate">{channel.name}</span>
                          {(channel.isDefault || channel.id === DEFAULT_WARD_ID) && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                              <ShieldCheck size={10} /> Default
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold shrink-0">
                              กำลังเชื่อมต่อ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            รหัส: {channel.id}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => void handleCopyCode(e, channel.id)}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 cursor-pointer"
                          >
                            {copiedId === channel.id ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manage Actions (Rename / Delete) */}
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
                          setFormError('');
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
                        title="เปลี่ยนชื่อวอร์ด"
                      >
                        <Edit3 size={15} />
                      </button>

                      {!channel.isDefault && channel.id !== DEFAULT_WARD_ID && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteChannel(channel)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="ลบวอร์ดนี้"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create New Ward Section */}
          {isAdding ? (
            <form
              onSubmit={handleCreateSubmit}
              className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-blue-200 dark:border-blue-500/30 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Plus size={14} />
                  <span>สร้างห้องวอร์ดใหม่</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setFormError('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อวอร์ด / หน่วยงาน
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="เช่น ห้องผ่าตัด OR 2, ICU ศัลยกรรม"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสห้องวอร์ดสำหรับใช้เชื่อมข้ามเครื่อง (ไม่บังคับ — A-Z, 0-9, _ หรือ -)
                </label>
                <input
                  type="text"
                  value={newWardCode}
                  onChange={(e) => setNewWardCode(e.target.value.toUpperCase())}
                  placeholder="เช่น OR-2 (เว้นว่างให้ระบบสร้างรหัสอัตโนมัติ)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 font-mono text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 uppercase"
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
                      <span>คัดลอก ANES-MASTER</span>
                    </div>
                    <p className={`text-[10px] ${duplicateOption ? 'text-blue-100' : 'text-slate-500'}`}>
                      ดึงโครงสร้างอุปกรณ์ตั้งต้นจากวอร์ดกลาง
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateOption(false)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
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
                      สร้างห้องวอร์ดใหม่โดยไม่มีรายการตั้งต้น
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>สร้างห้องวอร์ดนี้</span>
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
              <span>+ สร้างห้องวอร์ดใหม่</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            * ใช้รหัสห้องวอร์ดเดียวกันเพื่อซิงค์ข้อมูลสดข้ามเครื่องทันที
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-bold rounded-xl cursor-pointer transition active:scale-95"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
