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
  onDeleteSingleLog?: (logId: string) => void;
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
  onDeleteSingleLog,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');
  const [searchFilter, setSearchFilter] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<string[]>([]);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartXRef = React.useRef<number>(0);

  if (!isOpen) return null;

  const expiredCount = expiryAlerts.filter((a) => a.status === 'expired').length;
  const warningCount = expiryAlerts.filter((a) => a.status === 'warning').length;

  const filteredLogs = auditLogs.filter((log) => {
    if (dismissingIds.includes(log.id)) return false;
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

  const handleDismissSingle = (logId: string) => {
    setDismissingIds((prev) => [...prev, logId]);
    setTimeout(() => {
      if (onDeleteSingleLog) {
        onDeleteSingleLog(logId);
      }
      setDismissingIds((prev) => prev.filter((id) => id !== logId));
    }, 320);
  };

  const handleConfirmClearAll = () => {
    // Samsung-style cascade slide-out animation for all logs
    const allIds = auditLogs.map((l) => l.id);
    setDismissingIds(allIds);
    setTimeout(() => {
      if (onClearLogs) {
        onClearLogs();
      }
      setDismissingIds([]);
      setShowClearConfirm(false);
    }, 350);
  };

  // Touch Swipe handlers for Samsung-like swipe to dismiss
  const handleItemTouchStart = (logId: string, e: React.TouchEvent) => {
    setSwipingId(logId);
    touchStartXRef.current = e.touches[0].clientX;
    setSwipeOffset(0);
  };

  const handleItemTouchMove = (e: React.TouchEvent) => {
    if (!swipingId) return;
    const diff = e.touches[0].clientX - touchStartXRef.current;
    // Allow dragging rightwards or leftwards up to 200px
    setSwipeOffset(diff);
  };

  const handleItemTouchEnd = (logId: string) => {
    if (Math.abs(swipeOffset) > 85) {
      // Swiped past threshold -> trigger dismiss slide
      handleDismissSingle(logId);
    }
    setSwipingId(null);
    setSwipeOffset(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAdmin ? 'การแจ้งเตือนและประวัติ (Admin)' : 'รายการยา/เวชภัณฑ์หมดอายุและใกล้หมด'}
            </h2>
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
              <span>ประวัติการทำงาน ({auditLogs.length})</span>
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
              {/* Search & Actions Bar */}
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

                {onClearLogs && auditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    title="ลบประวัติการทำงานทั้งหมดจนเคลียร์ว่างเปล่า"
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างทั้งหมด</span>
                  </button>
                )}
              </div>

              {/* In-app Clear All Confirmation Card */}
              {showClearConfirm && (
                <div className="mb-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>ยืนยันลบประวัติการทำงานทั้งหมด?</span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    ประวัติทั้งหมด {auditLogs.length} รายการจะถูกล้างจนว่างเปล่า
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClearAll}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      ยืนยันลบจนหมด
                    </button>
                  </div>
                </div>
              )}

              {/* Helper text for Samsung swipe gesture */}
              {filteredLogs.length > 0 && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 flex items-center justify-between px-1">
                  <span>📱 เลื่อนสไลด์ปัดรายการออกเพื่อลบ (Swipe to delete)</span>
                  <span>{filteredLogs.length} รายการ</span>
                </div>
              )}

              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ไม่มีประวัติการทำงาน
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ประวัติถูกล้างเคลียร์ว่างเปล่าแล้ว
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredLogs.map((log) => {
                    const isBeingDismissed = dismissingIds.includes(log.id);
                    const isCurrentSwiping = swipingId === log.id;
                    const offset = isCurrentSwiping ? swipeOffset : 0;

                    return (
                      <div
                        key={log.id}
                        onTouchStart={(e) => handleItemTouchStart(log.id, e)}
                        onTouchMove={handleItemTouchMove}
                        onTouchEnd={() => handleItemTouchEnd(log.id)}
                        style={{
                          transform: isBeingDismissed
                            ? 'translateX(110%)'
                            : `translateX(${offset}px)`,
                          opacity: isBeingDismissed ? 0 : 1 - Math.min(Math.abs(offset) / 180, 0.7),
                        }}
                        className={`p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all duration-300 relative group overflow-hidden ${
                          isBeingDismissed ? 'max-h-0 py-0 my-0 border-none opacity-0' : ''
                        }`}
                      >
                        {/* Background swipe red action highlight */}
                        {isCurrentSwiping && Math.abs(offset) > 20 && (
                          <div
                            className={`absolute inset-0 bg-rose-500/15 flex items-center px-4 ${
                              offset > 0 ? 'justify-start' : 'justify-end'
                            }`}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 relative z-10">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.name} <span className="text-[10px] font-normal text-slate-400">(@{log.user})</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {log.action}
                            </span>
                            {/* Quick Delete button */}
                            <button
                              type="button"
                              onClick={() => handleDismissSingle(log.id)}
                              title="ลบรายการนี้"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-slate-600 dark:text-slate-300 mt-1 text-xs relative z-10">
                          {log.details}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 relative z-10">
                          <span>📍 {log.location || 'ระบบทั่วไป'}</span>
                          <span>{log.time || log.timestamp || ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
