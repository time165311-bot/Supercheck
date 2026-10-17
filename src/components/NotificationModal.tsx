import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AuditLogEntry, ExpiryAlertItem, User } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  currentUser?: User | null;
  onClose: () => void;
  expiryAlerts: ExpiryAlertItem[];
  auditLogs: AuditLogEntry[];
  onNavigateToCategory: (category: 'bag' | 'cart') => void;
  onOpenQuickReplace?: (alert: ExpiryAlertItem) => void;
  onClearLogs?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  expiryAlerts,
  auditLogs,
  onNavigateToCategory,
  onOpenQuickReplace,
  onClearLogs,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const expiredCount = expiryAlerts.filter((a) => a.status === 'expired').length;
  const warningCount = expiryAlerts.filter((a) => a.status === 'warning').length;

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.name.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      (log.location && log.location.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAdmin ? 'การแจ้งเตือนและประวัติ (Admin)' : 'รายการยา/เวชภัณฑ์หมดอายุและใกล้หมด'}
            </h2>
            {isAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold">
                แอดมินเห็นทั้งหมด
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        {isAdmin ? (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`py-2.5 font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'alerts'
                  ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>ของหมดอายุ</span>
              {expiryAlerts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  {expiryAlerts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-2.5 font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>ประวัติการทำงานทั้งหมด ({auditLogs.length})</span>
            </button>
          </div>
        ) : (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 py-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>รายการเตือนยา/เวชภัณฑ์ในรถและกระเป๋า Emer ({expiryAlerts.length} รายการ)</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'alerts' ? (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span>
                  หมดอายุแล้ว: <b className="text-red-600 dark:text-red-400">{expiredCount}</b> | ใกล้หมดอายุ: <b className="text-amber-600 dark:text-amber-400">{warningCount}</b>
                </span>
                <span className="text-[11px] text-slate-400">รถ & กระเป๋า Emer</span>
              </div>

              {expiryAlerts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ไม่มีรายการหมดอายุ
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    อุปกรณ์และยาทั้งหมดอยู่ในเกณฑ์ปกติ
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {expiryAlerts.map((alert, idx) => {
                    const isExpired = alert.status === 'expired';
                    return (
                      <div
                        key={idx}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          {/* Verbose category description removed as requested */}
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {alert.item.name}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400">
                              หมดอายุ: {alert.item.exp || '-'}
                            </span>
                            <span
                              className={`font-semibold ${
                                isExpired
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              ({isExpired
                                ? `เกินกำหนด ${Math.abs(alert.daysRemaining)} วัน`
                                : `เหลืออีก ${alert.daysRemaining} วัน`})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onOpenQuickReplace && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenQuickReplace(alert);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="เปลี่ยนของใหม่จากคลังยาและตั้งวันหมดอายุใหม่"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>เปลี่ยนของใหม่</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              onClose();
                              onNavigateToCategory(alert.category);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>ตรวจ</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="ค้นหาชื่อผู้ทำ, การกระทำ..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
                {onClearLogs && (
                  <button
                    onClick={onClearLogs}
                    title="ล้างประวัติ"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  ไม่มีประวัติการทำงาน
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.name} <span className="text-[10px] font-normal text-slate-400">(@{log.user})</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {log.action}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                        {log.details}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>📍 {log.location || 'ระบบทั่วไป'}</span>
                        <span>{log.time || log.timestamp || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
