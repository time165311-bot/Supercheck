import React, { useState, useEffect } from 'react';
import {
  Bell,
  Menu,
  Settings,
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
} from 'lucide-react';
import { User as UserType } from '../types';
import { formatRelativeActiveTime } from '../utils/timeFormat';
import { getEffectiveAvatarRing, RING_CONFIGS } from '../utils/avatarRings';
import { UserAvatarBadge } from './UserAvatarBadge';
import { downloadBackupFile, importFullBackup } from '../services/storage';

interface HeaderProps {
  currentUser: UserType | null;
  allUsers?: UserType[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onGoHome: () => void;
  onOpenNotifications: () => void;
  onOpenProfile?: () => void;
  onOpenPasswordModal?: () => void;
  onLogout?: () => void;
  unreadCount: number;
  isSyncing?: boolean;
  isVisible?: boolean;
  
  // New props for integrated drawer sub-views
  apiUrl?: string;
  sheetUrl?: string;
  accentColor?: string;
  onSaveSettings?: (newApiUrl: string, newSheetUrl: string, newTheme: 'light' | 'dark') => void;
  onSetAccentColor?: (color: string) => void;
  onManualSync?: () => Promise<boolean>;
  onPullFromGoogleSheets?: () => Promise<{ success: boolean; message: string }>;
  onRestoreBackup?: (backupData: any) => void;
  onChangePasswordSubmit?: (oldPw: string, newPw: string) => Promise<{ success: boolean; message: string }>;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers = [],
  theme = 'light',
  onToggleTheme,
  onGoHome,
  onOpenNotifications,
  onOpenProfile,
  onOpenPasswordModal,
  onLogout,
  unreadCount,
  isSyncing = false,
  isVisible = true,
  apiUrl,
  sheetUrl,
  accentColor,
  onSaveSettings,
  onSetAccentColor,
  onManualSync,
  onPullFromGoogleSheets,
  onRestoreBackup,
  onChangePasswordSubmit,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'friends' | 'settings' | 'security'>('main');
  const [friendsSearch, setFriendsSearch] = useState('');
  const [friendsTab, setFriendsTab] = useState<'all' | 'online' | 'admin'>('all');
  
  // Settings View States
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl || '');
  const [localSheetUrl, setLocalSheetUrl] = useState(sheetUrl || '');
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
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
  }, [apiUrl, sheetUrl, isMenuOpen]);

  const [, setRingTrigger] = useState(0);

  // Reset drawer sub-view when closing drawer
  useEffect(() => {
    if (!isMenuOpen) {
      setMenuView('main');
      setFriendsSearch('');
    }
  }, [isMenuOpen]);

  // Listen for avatar ring updates in real-time
  useEffect(() => {
    const handleRingUpdate = () => setRingTrigger((prev) => prev + 1);
    window.addEventListener('user_avatar_ring_updated', handleRingUpdate);
    return () => window.removeEventListener('user_avatar_ring_updated', handleRingUpdate);
  }, []);

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

    const isCurrent = Boolean(currentUser && currentUser.username === u.username);
    const status = formatRelativeActiveTime(u.last, isCurrent);

    if (friendsTab === 'online') {
      return matchesSearch && status.isOnline;
    }
    if (friendsTab === 'admin') {
      return matchesSearch && u.role === 'admin';
    }
    return matchesSearch;
  });

  return (
    <>
      <header
        className={`bg-white dark:bg-[#242526] border-b border-[#e4e6eb] dark:border-[#3a3b3c] sticky top-0 z-30 transition-transform duration-300 ease-in-out shadow-2xs ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left Side: Brand Emblem & Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div
              onClick={() => {
                onGoHome();
                setIsMenuOpen(false);
              }}
              className="cursor-pointer select-none group flex items-center gap-2 sm:gap-2.5 active:scale-95 transition-transform min-w-0"
              title="กลับสู่หน้าหลัก"
            >
              {/* Facebook Blue Emblem */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-xs bg-accent hover:bg-accent-hover transition-colors relative overflow-hidden shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 relative z-10 text-white">
                  <path
                    d="M12 3L19 7V17L12 21L5 17V7L12 3Z"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="rgba(255,255,255,0.2)"
                  />
                  <path
                    d="M12 8v8m-4-4h8"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Title */}
              <span className="font-extrabold text-sm sm:text-base text-[#050505] dark:text-[#e4e6eb] tracking-tight truncate">
                Anesthesia Check
              </span>
            </div>
          </div>

          {/* Right Side Cluster: [ Admin/Staff Badge | 🔔 Notifications | ☰ Hamburger Menu ] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
            
            {/* 1. Admin / Staff Static Badge */}
            {currentUser && (
              <div
                title={isAdmin ? 'ระดับสิทธิ์: ผู้ดูแลระบบ (Admin)' : 'ระดับสิทธิ์: เจ้าหน้าที่ (Staff)'}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold select-none flex items-center gap-1.5 shrink-0 ${
                  isAdmin
                    ? 'bg-purple-600 dark:bg-purple-700 text-white shadow-xs'
                    : 'bg-accent-light text-accent'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{isAdmin ? 'Admin' : 'Staff'}</span>
              </div>
            )}

            {/* 2. Notification Bell */}
            <button
              onClick={() => {
                onOpenNotifications();
                setIsMenuOpen(false);
              }}
              type="button"
              title="การแจ้งเตือนและประวัติ"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
            >
              <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-[#e41e3f] text-[10px] sm:text-[11px] font-bold text-white shadow-xs border-2 border-white dark:border-[#242526]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* 3. Facebook Hamburger Menu ☰ Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              type="button"
              title="เปิดเมนูการใช้งาน"
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                isMenuOpen
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb]'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

          </div>
        </div>
      </header>

      {/* RIGHT SLIDE-OVER DRAWER BACKDROP */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* RIGHT SLIDE-OVER DRAWER PANEL (iOS/Android Native Style) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 sm:w-88 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-l border-white/20 dark:border-slate-800/60 shadow-2xl flex flex-col transition-transform duration-300 ease-out select-none ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* VIEW 1: MAIN HAMBURGER MENU */}
        {menuView === 'main' && (
          <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a]">
              <span className="font-extrabold text-sm text-[#050505] dark:text-white flex items-center gap-2">
                <Menu className="w-4 h-4 text-[#1877f2]" />
                <span>เมนูระบบ</span>
              </span>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition"
                title="ปิดเมนู"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              
              {/* 1) Profile Card */}
              {currentUser && (
                <div
                  onClick={() => {
                    if (onOpenProfile) onOpenProfile();
                    setIsMenuOpen(false);
                  }}
                  className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-[#1877f2]/15 dark:to-purple-950/30 hover:bg-blue-100/70 dark:hover:bg-[#1877f2]/25 rounded-2xl border border-blue-100 dark:border-[#1877f2]/30 flex items-center justify-between gap-3 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatarBadge user={currentUser} size="md" />
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs sm:text-sm text-[#050505] dark:text-white truncate group-hover:text-accent transition-colors">
                        {currentUser.name}
                      </div>
                      <p className="text-[11px] text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">
                        @{currentUser.username}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-accent text-white font-bold text-[11px] shrink-0 hover:bg-accent-hover transition shadow-2xs">
                    ดูโปรไฟล์
                  </span>
                </div>
              )}

              {/* 2) เพื่อน (Right Slide Sub-panel Trigger) */}
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
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-accent transition-colors block">
                      เพื่อน
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

              {/* 3) สวิตช์สลับโหมดการแสดงผล (Light / Dark Mode Switcher) */}
              {onToggleTheme && (
                <div className="px-3 py-3 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 transition-colors group">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center">
                      {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] block transition-colors group-hover:text-accent">
                        {theme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง'}
                      </span>
                      <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                        สลับธีมแอป
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-[#bcc0c4] dark:bg-accent"
                    title="สลับโหมดสว่าง/โหมดมืด"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    >
                      {theme === 'dark' ? <Moon className="w-3 h-3 text-accent" /> : <Sun className="w-3 h-3 text-amber-500" />}
                    </span>
                  </button>
                </div>
              )}

              {/* 4) การตั้งค่า */}
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
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-accent transition-colors block">
                      การตั้งค่า
                    </span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#b0b3b8]">
                      จัดการระบบและข้อมูล
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8] group-hover:translate-x-1 transition-transform" />
              </button>

              {/* 5) ตั้งค่าบัญชี */}
              <div className="pt-3.5 mt-1 border-t border-[#e4e6eb] dark:border-[#3a3b3c] space-y-1">
                <span className="text-[11px] font-extrabold text-[#65676b] dark:text-[#b0b3b8] px-4 mb-2 block uppercase tracking-wider">
                  ความปลอดภัย
                </span>

                {/* ความปลอดภัยและรหัสผ่าน */}
                <button
                  type="button"
                  onClick={() => setMenuView('security')}
                  className="w-full px-3 py-2.5 rounded-2xl hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center transition-colors group-hover:bg-[#d8dadf] dark:group-hover:bg-[#4e4f50]">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm text-[#050505] dark:text-[#e4e6eb] group-hover:text-accent transition-colors">
                      ความปลอดภัยและรหัสผ่าน
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#b0b3b8]" />
                </button>

                {/* ออกจากระบบ */}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#050505] dark:text-[#e4e6eb] flex items-center justify-between gap-3 text-left transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
                        ออกจากระบบ
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-400" />
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: FRIENDS RIGHT SLIDE-IN SUB-PANEL */}
        {menuView === 'friends' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out">
            {/* Sub-panel Header with < Back */}
            <div className="px-3 py-3 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a] shrink-0">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#e4e6eb] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] text-accent font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>

              <span className="font-extrabold text-xs text-[#050505] dark:text-white truncate">
                เพื่อน ({allUsers.length})
              </span>

              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition shrink-0"
                title="ปิดเมนู"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-panel Search & Filter Tabs */}
            <div className="p-3 space-y-2.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] shrink-0 bg-white dark:bg-[#242526]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#65676b] dark:text-[#b0b3b8]" />
                <input
                  type="text"
                  value={friendsSearch}
                  onChange={(e) => setFriendsSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, สังกัด, ตำแหน่ง..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] text-xs outline-none focus:ring-2 focus:ring-[#1877f2]"
                />
              </div>

              <div className="flex gap-1 p-1 bg-[#f0f2f5] dark:bg-[#18191a] rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFriendsTab('all')}
                  className={`flex-1 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                    friendsTab === 'all'
                      ? 'bg-white dark:bg-[#242526] text-accent shadow-2xs'
                      : 'text-[#65676b] dark:text-[#b0b3b8]'
                  }`}
                >
                  ทั้งหมด ({allUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFriendsTab('online')}
                  className={`flex-1 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                    friendsTab === 'online'
                      ? 'bg-white dark:bg-[#242526] text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-[#65676b] dark:text-[#b0b3b8]'
                  }`}
                >
                  Online 🟢 ({onlineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFriendsTab('admin')}
                  className={`flex-1 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                    friendsTab === 'admin'
                      ? 'bg-white dark:bg-[#242526] text-purple-600 dark:text-purple-400 shadow-2xs'
                      : 'text-[#65676b] dark:text-[#b0b3b8]'
                  }`}
                >
                  Admin 🟣
                </button>
              </div>
            </div>

            {/* Sub-panel Colleagues List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredFriends.length === 0 ? (
                <div className="py-12 text-center text-[#65676b] dark:text-[#b0b3b8] text-xs">
                  ไม่พบเพื่อนร่วมงานตรงตามคำค้นหา
                </div>
              ) : (
                filteredFriends.map((u) => {
                  const isCurrent = Boolean(currentUser && currentUser.username === u.username);
                  const status = formatRelativeActiveTime(u.last, isCurrent);
                  const avatarKey = getEffectiveAvatarRing(u);
                  const ringConfig = RING_CONFIGS[avatarKey] || RING_CONFIGS.slate;
                  const storedAvatar = localStorage.getItem(`user_avatar_${u.username}`);

                  return (
                    <div
                      key={u.id || u.username}
                      className="p-3 rounded-2xl bg-[#f0f2f5]/70 hover:bg-[#f0f2f5] dark:bg-[#18191a]/80 dark:hover:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-12 h-12 rounded-full p-0.5 ${ringConfig.ringClasses} flex items-center justify-center bg-white dark:bg-[#242526]`}>
                            {storedAvatar || u.avatar ? (
                              <img
                                src={storedAvatar || u.avatar}
                                alt={u.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                                <Users className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#242526] ${
                              status.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#050505] dark:text-[#e4e6eb] truncate flex items-center gap-1">
                            <span>{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-accent-light text-accent">
                                คุณ
                              </span>
                            )}
                            {u.role === 'admin' && (
                              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-600 text-white">
                                Admin
                              </span>
                            )}
                          </div>

                          <p className="text-[10.5px] text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">
                            {u.position || 'เจ้าหน้าที่'} {(u as any).department ? `• ${(u as any).department}` : ''}
                          </p>

                          <p className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${
                            status.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#65676b] dark:text-[#b0b3b8]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {status.label}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: SETTINGS RIGHT SLIDE-IN SUB-PANEL */}
        {menuView === 'settings' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out">
            <div className="px-3 py-3 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a] shrink-0">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#e4e6eb] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] text-accent font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <span className="font-extrabold text-xs text-[#050505] dark:text-white">การตั้งค่าระบบ</span>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Settings Form Items */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#65676b] dark:text-[#b0b3b8] px-1">
                    API URL (Google Apps Script)
                  </label>
                  <div className="relative">
                    <Link className="w-3.5 h-3.5 absolute left-3 top-3 text-[#65676b]" />
                    <input
                      type="url"
                      value={localApiUrl}
                      onChange={(e) => setLocalApiUrl(e.target.value)}
                      placeholder="https://script.google.com/..."
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f0f2f5] dark:bg-[#18191a] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#65676b] dark:text-[#b0b3b8] px-1">
                    Google Sheet URL
                  </label>
                  <div className="relative">
                    <FileSpreadsheet className="w-3.5 h-3.5 absolute left-3 top-3 text-[#65676b]" />
                    <input
                      type="url"
                      value={localSheetUrl}
                      onChange={(e) => setLocalSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/..."
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f0f2f5] dark:bg-[#18191a] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSettingsSaving}
                  onClick={() => {
                    if (onSaveSettings) {
                      setIsSettingsSaving(true);
                      onSaveSettings(localApiUrl, localSheetUrl, theme || 'light');
                      setTimeout(() => {
                        setIsSettingsSaving(false);
                        setMenuView('main');
                      }, 800);
                    }
                  }}
                  className="w-full py-3 rounded-2xl bg-accent hover:bg-accent-hover text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isSettingsSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isSettingsSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
                </button>
              </div>

              {/* Theme Accent Color Section */}
              <div className="pt-4 border-t border-[#e4e6eb] dark:border-[#3a3b3c] space-y-3">
                <span className="text-[11px] font-extrabold text-[#65676b] dark:text-[#b0b3b8] px-1 block uppercase tracking-wider">
                  โทนสีแอปพลิเคชัน (Theme Accent Color)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 px-1">
                  {[
                    { id: 'blue', color: '#1877F2', label: 'Facebook' },
                    { id: 'cyber', color: '#00D2FF', label: 'Cyber Ice' },
                    { id: 'mint', color: '#10B981', label: 'Mint' },
                    { id: 'iris', color: '#6366F1', label: 'Deep Iris' },
                    { id: 'rose', color: '#F43F5E', label: 'Soft Rose' },
                    { id: 'slate', color: '#334155', label: 'Slate Titanium' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSetAccentColor?.(c.id)}
                      className={`h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 border-2 relative ${
                        accentColor === c.id 
                          ? 'border-white dark:border-[#242526] ring-2 ring-accent ring-offset-2 dark:ring-offset-[#242526] shadow-lg' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    >
                      {accentColor === c.id && (
                        <div className="absolute inset-0 rounded-2xl bg-white/10 animate-pulse" />
                      )}
                      {accentColor === c.id && <Check className="w-5 h-5 text-white drop-shadow-md z-10" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Secondary Actions */}
              <div className="pt-4 border-t border-[#e4e6eb] dark:border-[#3a3b3c] space-y-3">
                <button
                  type="button"
                  onClick={() => onManualSync?.()}
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center gap-3 text-left transition"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">ซิงค์ข้อมูลเดี๋ยวนี้</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPullFromGoogleSheets?.()}
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center gap-3 text-left transition"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">ดึงข้อมูลจาก Google Sheets</span>
                </button>
              </div>

              {/* Admin-only Backup & Restore Section */}
              {isAdmin && (
                <div className="pt-4 border-t border-[#e4e6eb] dark:border-[#3a3b3c] space-y-3">
                  <span className="text-[11px] font-extrabold text-[#65676b] dark:text-[#b0b3b8] px-1 block uppercase tracking-wider">
                    การสำรองและย้ายฐานข้อมูล (Admin Only)
                  </span>
                  
                  {backupStatus && (
                    <div className={`p-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 ${backupStatus.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {backupStatus.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>{backupStatus.msg}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        downloadBackupFile();
                        setBackupStatus({ ok: true, msg: 'ดาวน์โหลดไฟล์สำรองสำเร็จ' });
                        setTimeout(() => setBackupStatus(null), 3000);
                      } catch (e) {
                        setBackupStatus({ ok: false, msg: 'เกิดข้อผิดพลาดในการสำรองข้อมูล' });
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center gap-3 text-left transition active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <FolderDown className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs">📥 ดาวน์โหลดไฟล์สำรองข้อมูล (Export JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-3 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center gap-3 text-left transition active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <FolderUp className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs">📤 นำเข้าข้อมูลสำรอง (Import Backup File)</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const content = evt.target?.result as string;
                        const result = importFullBackup(content);
                        if (result.success && result.data) {
                          setBackupStatus({ ok: true, msg: 'นำเข้าข้อมูลสำเร็จ ระบบกำลังอัปเดต...' });
                          if (onRestoreBackup) onRestoreBackup(result.data);
                          setTimeout(() => {
                            setBackupStatus(null);
                            setMenuView('main');
                          }, 1500);
                        } else {
                          setBackupStatus({ ok: false, msg: result.message });
                        }
                      };
                      reader.readAsText(file);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: SECURITY RIGHT SLIDE-IN SUB-PANEL */}
        {menuView === 'security' && (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out">
            <div className="px-3 py-3 border-b border-[#e4e6eb] dark:border-[#3a3b3c] flex items-center justify-between bg-[#f0f2f5] dark:bg-[#18191a] shrink-0">
              <button
                type="button"
                onClick={() => setMenuView('main')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#242526] hover:bg-[#e4e6eb] dark:hover:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#1877f2] dark:text-[#2d88ff] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <span className="font-extrabold text-xs text-[#050505] dark:text-white">ความปลอดภัย</span>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] text-[#050505] dark:text-white flex items-center justify-center cursor-pointer transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Profile Overview in Security */}
              <div className="flex items-center gap-3 p-3 bg-[#f0f2f5] dark:bg-[#18191a] rounded-2xl border border-[#e4e6eb] dark:border-[#3a3b3c]">
                <UserAvatarBadge user={currentUser} size="md" />
                <div className="min-w-0">
                  <div className="font-bold text-xs text-[#050505] dark:text-white truncate">{currentUser?.name}</div>
                  <div className="text-[10px] text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">@{currentUser?.username}</div>
                </div>
              </div>

              {/* Password Change Form */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#050505] dark:text-white px-1">เปลี่ยนรหัสผ่านใหม่</h4>
                
                {passwordStatus && (
                  <div className={`p-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 ${passwordStatus.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {passwordStatus.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span>{passwordStatus.msg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-[#65676b]" />
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="รหัสผ่านเดิม"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f0f2f5] dark:bg-[#18191a] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:ring-2 focus:ring-[#1877f2]"
                    />
                  </div>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 absolute left-3 top-3 text-[#65676b]" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="รหัสผ่านใหม่"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f0f2f5] dark:bg-[#18191a] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:ring-2 focus:ring-[#1877f2]"
                    />
                  </div>
                  <div className="relative">
                    <Check className="w-3.5 h-3.5 absolute left-3 top-3 text-[#65676b]" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่านใหม่"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#f0f2f5] dark:bg-[#18191a] text-xs rounded-xl border border-[#e4e6eb] dark:border-[#3a3b3c] outline-none focus:ring-2 focus:ring-[#1877f2]"
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
                          setTimeout(() => setMenuView('main'), 2000);
                        }
                      } catch (err) {
                        setPasswordStatus({ ok: false, msg: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
                      } finally {
                        setIsPasswordChanging(false);
                      }
                    }}
                    className="w-full py-3 rounded-2xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isPasswordChanging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{isPasswordChanging ? 'กำลังตรวจสอบ...' : 'เปลี่ยนรหัสผ่าน'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
