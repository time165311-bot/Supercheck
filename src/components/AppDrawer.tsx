import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Search,
  Users,
  Sun,
  Moon,
  Key,
  ShieldCheck,
  Link,
  QrCode,
  Share2,
  Smartphone,
  FileSpreadsheet,
  FolderDown,
  FolderUp,
  ExternalLink,
  RefreshCw,
  Lock,
  Check,
  Download,
  Settings,
  UserCheck,
} from 'lucide-react';
import { User as UserType } from '../types';
import { formatRelativeActiveTime } from '../utils/timeFormat';
import { UserAvatarBadge } from './UserAvatarBadge';
import { downloadBackupFile, importFullBackup } from '../services/storage';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  allUsers?: UserType[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onGoHome: () => void;
  onOpenNotifications: () => void;
  onOpenProfile?: () => void;
  onOpenPasswordModal?: () => void;
  onLogout?: () => void;
  unreadCount?: number;
  isSyncing?: boolean;
  apiUrl?: string;
  sheetUrl?: string;
  accentColor?: string;
  onSaveSettings?: (newApiUrl: string, newSheetUrl: string, newTheme: 'light' | 'dark') => void;
  onSetAccentColor?: (color: string) => void;
  onManualSync?: () => Promise<boolean>;
  onPullFromGoogleSheets?: () => Promise<{ success: boolean; message: string }>;
  onRestoreBackup?: (backupData: any) => void;
  onChangePasswordSubmit?: (oldPw: string, newPw: string) => Promise<{ success: boolean; message: string }>;
  onNavigateToUsers?: () => void;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  theme = 'light',
  onToggleTheme,
  onGoHome,
  onOpenNotifications,
  onOpenProfile,
  onOpenPasswordModal,
  onLogout,
  unreadCount = 0,
  isSyncing = false,
  apiUrl,
  sheetUrl,
  accentColor,
  onSaveSettings,
  onSetAccentColor,
  onManualSync,
  onPullFromGoogleSheets,
  onRestoreBackup,
  onChangePasswordSubmit,
  onNavigateToUsers,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [menuView, setMenuView] = useState<'main' | 'friends' | 'settings' | 'security'>('main');
  const [friendsSearch, setFriendsSearch] = useState('');
  const [friendsTab, setFriendsTab] = useState<'all' | 'online' | 'admin'>('all');

  // Settings View States
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl || '');
  const [localSheetUrl, setLocalSheetUrl] = useState(sheetUrl || '');
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security View States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Sync local settings states when props change
  useEffect(() => {
    if (apiUrl) setLocalApiUrl(apiUrl);
    if (sheetUrl) setLocalSheetUrl(sheetUrl);
  }, [apiUrl, sheetUrl, isOpen]);

  // Reset drawer sub-view when closing drawer
  useEffect(() => {
    if (!isOpen) {
      setMenuView('main');
      setFriendsSearch('');
    }
  }, [isOpen]);

  // Compute online colleagues count
  const onlineCount = allUsers.filter((u) => {
    const status = formatRelativeActiveTime(u.last, u.id === currentUser?.id);
    return status.isOnline;
  }).length;

  // Filtered friends list for the slide-in sub-panel
  const filteredFriends = allUsers.filter((u) => {
    const dept = (u as any).department || '';
    const matchesSearch =
      u.name.toLowerCase().includes(friendsSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(friendsSearch.toLowerCase()) ||
      dept.toLowerCase().includes(friendsSearch.toLowerCase()) ||
      (u.position && u.position.toLowerCase().includes(friendsSearch.toLowerCase()));

    if (friendsTab === 'online') {
      const status = formatRelativeActiveTime(u.last, u.id === currentUser?.id);
      return matchesSearch && status.isOnline;
    }
    if (friendsTab === 'admin') {
      return matchesSearch && u.role === 'admin';
    }
    return matchesSearch;
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Slide-over Drawer Panel (Right Side, Native Mobile Feel) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 sm:w-88 backdrop-blur-md bg-white dark:bg-[#18191a] border-l border-[#E4E6EB] dark:border-[#3a3b3c] shadow-2xl flex flex-col transition-transform duration-300 ease-out select-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* VIEW 1: MAIN MENU */}
        {menuView === 'main' && (
          <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a]">
              <span className="font-extrabold text-sm text-[#050505] dark:text-white flex items-center gap-2">
                <Menu className="w-4 h-4 text-[#1877f2]" />
                <span>เมนูระบบ (Menu)</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
                title="ปิดเมนู"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {/* 1) Profile Card */}
              {currentUser && (
                <div
                  onClick={() => {
                    if (onOpenProfile) onOpenProfile();
                    onClose();
                  }}
                  className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-[#1877f2]/15 dark:to-purple-950/30 hover:bg-blue-100/70 dark:hover:bg-[#1877f2]/25 rounded-2xl border border-blue-100 dark:border-[#1877f2]/30 flex items-center justify-between gap-3 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatarBadge user={currentUser} size="md" />
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs sm:text-sm text-[#050505] dark:text-white truncate group-hover:text-[#1877f2] transition-colors">
                        {currentUser.name}
                      </div>
                      <p className="text-[11px] text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">
                        @{currentUser.username} ({currentUser.role === 'admin' ? 'Admin' : 'Staff'})
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-[#1877f2] text-white font-bold text-[11px] shrink-0 hover:bg-[#166fe5] transition shadow-2xs">
                    ดูโปรไฟล์
                  </span>
                </div>
              )}

              {/* 2) เพื่อนร่วมงาน (Colleagues List) */}
              <button
                type="button"
                onClick={() => setMenuView('friends')}
                className="w-full px-3 py-3 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center transition-colors group-hover:bg-[#d8dadf] dark:group-hover:bg-[#4e4f50]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-[#1877f2] transition-colors block">
                      เพื่อนร่วมงาน
                    </span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                      ดูสถานะและเพื่อนร่วมงาน
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    {onlineCount} Online
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8] group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* 3) จัดการผู้ใช้ (Admin Only) */}
              {isAdmin && onNavigateToUsers && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToUsers();
                    onClose();
                  }}
                  className="w-full px-3 py-3 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-[#E7F3FF] text-[#1877f2] flex items-center justify-center">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-[#1877f2] transition-colors block">
                        จัดการผู้ใช้ & สิทธิ์
                      </span>
                      <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                        เพิ่ม ลบ เปลี่ยนสิทธิ์ Staff / Admin
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8] group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* 4) ตั้งค่าระบบ (Settings Trigger) */}
              <button
                type="button"
                onClick={() => setMenuView('settings')}
                className="w-full px-3 py-3 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center transition-colors group-hover:bg-[#d8dadf] dark:group-hover:bg-[#4e4f50]">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-[#1877f2] transition-colors block">
                      ตั้งค่าระบบ
                    </span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                      Google Sheet, API URL, สำรองข้อมูล
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8] group-hover:translate-x-1 transition-transform" />
              </button>

              {/* 5) ความปลอดภัย & รหัสผ่าน (Security Trigger) */}
              <button
                type="button"
                onClick={() => setMenuView('security')}
                className="w-full px-3 py-3 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center transition-colors group-hover:bg-[#d8dadf] dark:group-hover:bg-[#4e4f50]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-[#1877f2] transition-colors block">
                      ความปลอดภัย & รหัสผ่าน
                    </span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                      เปลี่ยนรหัสผ่านส่วนตัว
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8] group-hover:translate-x-1 transition-transform" />
              </button>

              {/* 6) สลับโหมดกลางวัน/กลางคืน */}
              <div className="px-3 py-2.5 rounded-2xl bg-[#f0f2f5] dark:bg-[#242526] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#3a3b3c] flex items-center justify-center text-[#050505] dark:text-white shadow-2xs">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  </div>
                  <span className="text-xs font-bold text-[#050505] dark:text-[#e4e6eb]">
                    {theme === 'dark' ? 'โหมดกลางคืน (Dark)' : 'โหมดสว่าง (Light)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="px-3 py-1 rounded-xl bg-white dark:bg-[#3a3b3c] text-[11px] font-bold text-[#050505] dark:text-white shadow-2xs hover:bg-slate-100 dark:hover:bg-[#4e4f50] transition cursor-pointer"
                >
                  สลับ
                </button>
              </div>

              {/* 7) ปุ่มออกจากระบบ */}
              {onLogout && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="w-full px-3 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition active:scale-95 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: FRIENDS SUB-PANEL */}
        {menuView === 'friends' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a]">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-sm text-[#050505] dark:text-white">
                เพื่อนร่วมงาน ({allUsers.length})
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-[#e4e6eb] dark:border-[#3a3b3c] space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676b]" />
                <input
                  type="text"
                  value={friendsSearch}
                  onChange={(e) => setFriendsSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, แผนก, ตำแหน่ง..."
                  className="w-full pl-9 pr-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-transparent focus:border-[#1877f2] outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredFriends.map((user) => (
                <div
                  key={user.id}
                  className="p-2.5 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#242526] flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatarBadge user={user} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[#050505] dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-[10px] text-[#65676b] dark:text-[#b0b3b8] truncate">
                        {user.position || user.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatRelativeActiveTime(user.last, user.id === currentUser?.id).label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: SETTINGS SUB-PANEL */}
        {menuView === 'settings' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a]">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-sm text-[#050505] dark:text-white">
                ตั้งค่าระบบ
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#050505] dark:text-white block mb-1">
                  Google Sheet URL
                </label>
                <input
                  type="text"
                  value={localSheetUrl}
                  onChange={(e) => setLocalSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:border-[#1877f2]"
                />
              </div>

              <div>
                <label className="font-bold text-[#050505] dark:text-white block mb-1">
                  Google Apps Script (Web App URL)
                </label>
                <input
                  type="text"
                  value={localApiUrl}
                  onChange={(e) => setLocalApiUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:border-[#1877f2]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSettingsSaving(true);
                  if (onSaveSettings) onSaveSettings(localApiUrl, localSheetUrl, theme);
                  setTimeout(() => {
                    setIsSettingsSaving(false);
                    setMenuView('main');
                  }, 600);
                }}
                className="w-full py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{isSettingsSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
              </button>

              <hr className="border-[#e4e6eb] dark:border-[#3a3b3c]" />

              {/* สำรองข้อมูล JSON */}
              <div className="space-y-2">
                <label className="font-bold text-[#050505] dark:text-white block">
                  สำรองและกู้คืนข้อมูล
                </label>
                <button
                  type="button"
                  onClick={() => downloadBackupFile()}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#242526] hover:bg-slate-200 text-[#050505] dark:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (JSON)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: SECURITY SUB-PANEL */}
        {menuView === 'security' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a]">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-sm text-[#050505] dark:text-white">
                ความปลอดภัย & รหัสผ่าน
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    passwordStatus.ok
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {passwordStatus.msg}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#050505] dark:text-white block mb-1">
                  รหัสผ่านเดิม
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="รหัสผ่านปัจจุบัน"
                  className="w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:border-[#1877f2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#050505] dark:text-white block mb-1">
                  รหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)"
                  className="w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:border-[#1877f2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#050505] dark:text-white block mb-1">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="w-full px-3 py-2 bg-[#f0f2f5] dark:bg-[#242526] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:border-[#1877f2]"
                />
              </div>

              <button
                type="button"
                disabled={isPasswordChanging || !newPassword || newPassword !== confirmPassword}
                onClick={async () => {
                  if (!onChangePasswordSubmit) return;
                  setIsPasswordChanging(true);
                  setPasswordStatus(null);
                  try {
                    const res = await onChangePasswordSubmit(oldPassword, newPassword);
                    setPasswordStatus({ ok: res.success, msg: res.message });
                    if (res.success) {
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setTimeout(() => setMenuView('main'), 1500);
                    }
                  } catch (err: any) {
                    setPasswordStatus({ ok: false, msg: err.message || 'เกิดข้อผิดพลาด' });
                  } finally {
                    setIsPasswordChanging(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isPasswordChanging ? 'กำลังตรวจสอบ...' : 'เปลี่ยนรหัสผ่าน'}</span>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
