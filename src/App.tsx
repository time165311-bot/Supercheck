import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Image,
  Key,
  Layers,
  Lock,
  LogOut,
  MapPin,
  MoreVertical,
  Moon,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Sun,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import {
  AuditLogEntry,
  CheckItemRow,
  EquipmentItem,
  ExpiryAlertItem,
  InspectionHistoryRecord,
  ListConfig,
  Role,
  RoomDef,
  ThemeMode,
  User,
} from './types';
import { DEFAULT_LISTS, ROOMS } from './constants/initialData';
import {
  STORAGE_KEYS,
  addAuditLog,
  calculateExpirationStatus,
  getAllExpiryAlerts,
  getInitialEquipment,
  getInitialLists,
  getLocalAuditLogs,
  getStored,
  getStoredString,
  setStored,
  setStoredString,
  updateUserAvatar,
} from './services/storage';
import { sendInspectionToGas } from './services/api';
import { Header } from './components/Header';
import { ExpiryAlertBanner } from './components/ExpiryAlertBanner';
import { NotificationModal } from './components/NotificationModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { BottomBar } from './components/BottomBar';
import { OfficialReportModal } from './components/OfficialReportModal';
import { EquipmentDetailModal } from './components/EquipmentDetailModal';
import { ImageModal } from './components/ImageModal';
import { FloorMap } from './components/FloorMap';
import { UserManagement } from './components/UserManagement';
import { PasswordModal } from './components/PasswordModal';
import { DrugInventoryView } from './components/DrugInventoryView';
import { UncheckedRoomsNavigator } from './components/UncheckedRoomsNavigator';
import { SubmissionLoadingModal } from './components/SubmissionLoadingModal';
import { QuickReplaceModal } from './components/QuickReplaceModal';
import { checkUrlSyncPayload, fetchServerSync, pushServerSync } from './services/syncService';
import {
  saveInspectionToFirebase,
  deleteInspectionFromFirebase,
  subscribeInspectionHistory,
  subscribeAuditLogs,
  addAuditLogToFirebase,
  deleteAuditLogInFirebase,
  clearAllAuditLogsInFirebase,
  saveSettingsToFirebase,
  syncUsersToFirebase,
} from './services/firebase';

// Cryptography helpers for client-side password hashing
async function hashPassword(salt: string, pw: string): Promise<string> {
  const str = salt + ':' + pw;
  try {
    if (window.crypto && crypto.subtle) {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buffer))
        .map((b) => ('0' + b.toString(16)).slice(-2))
        .join('');
    }
  } catch (e) {}
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return 'x' + (h >>> 0).toString(16);
}

function generateSalt(): string {
  const a = new Uint8Array(8);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a)
    .map((b) => ('0' + b.toString(16)).slice(-2))
    .join('');
}

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (getStoredString(STORAGE_KEYS.THEME, 'light') as ThemeMode) || 'light';
  });

  // URLs
  const [apiUrl, setApiUrl] = useState(() => getStoredString(STORAGE_KEYS.API_URL, ''));
  const [sheetUrl, setSheetUrl] = useState(() => getStoredString(STORAGE_KEYS.SHEET_URL, ''));

  // Auth & Users
  const [users, setUsers] = useState<User[]>(() => getStored<User[]>(STORAGE_KEYS.USERS, []));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // App Navigation
  // Views: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'users' | 'drug_check'
  const [currentView, setCurrentView] = useState<'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'users' | 'drug_check'>('home');
  const [activeRoomId, setActiveRoomId] = useState<string>('or1');
  const [eqMode, setEqMode] = useState<'explore' | 'check'>('check');

  // Domain Data
  const [equipment, setEquipment] = useState<Record<string, EquipmentItem[]>>(() => getInitialEquipment());
  const [lists, setLists] = useState<Record<'bag' | 'cart', ListConfig>>(() => getInitialLists());
  const [globalChecks, setGlobalChecks] = useState<Record<string, Record<string, { result: 'ปกติ' | 'ผิดปกติ' | ''; note?: string }>>>(
    () => getStored(STORAGE_KEYS.GLOBAL_CHECKS, {})
  );
  const [lastSubmitted, setLastSubmitted] = useState<Record<string, string>>(() =>
    getStored(STORAGE_KEYS.LAST_SUBMITTED, {})
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getLocalAuditLogs());

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordForced, setIsPasswordForced] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalTitle, setReportModalTitle] = useState('คลินิกงานบริการผู้ป่วยในวิสัญญี');
  const [reportModalCategory, setReportModalCategory] = useState<'eq' | 'bag' | 'cart' | 'drug'>('eq');
  const [reportModalDrugSubCategory, setReportModalDrugSubCategory] = useState<'all' | 'monthly' | 'quarterly' | 'adhoc'>('monthly');
  const [reportModalRows, setReportModalRows] = useState<any[]>([]);
  const [inspectionHistory, setInspectionHistory] = useState<InspectionHistoryRecord[]>(() =>
    getStored<InspectionHistoryRecord[]>('inspection_history', [])
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [quickReplaceTarget, setQuickReplaceTarget] = useState<{
    item: EquipmentItem;
    category: 'bag' | 'cart';
    groupName: string;
    itemIndex: number;
  } | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState<{ item: EquipmentItem; result?: string; note?: string } | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Check form state (for currently active screen)
  const [inspectorName, setInspectorName] = useState(() => getStoredString(STORAGE_KEYS.INSPECTOR, ''));
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [generalNote, setGeneralNote] = useState('');
  const [submissionFeedback, setSubmissionFeedback] = useState<{ success: boolean; msg: string; rows: any[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [submissionStatusText, setSubmissionStatusText] = useState('');

  // Reset round modal & feedback state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetToast, setResetToast] = useState('');

  // Filter for expiry in Bag/Cart checks
  const [expFilter, setExpFilter] = useState<'all' | 'expired' | 'warning' | 'good'>('all');

  // New item input states
  const [addingGroupIdx, setAddingGroupIdx] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemSap, setNewItemSap] = useState('');
  const [newItemSpec, setNewItemSpec] = useState('');
  const [newItemSource, setNewItemSource] = useState('เงินงบประมาณ');
  const [newItemDate, setNewItemDate] = useState('7 ก.พ. 68');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemNo, setNewItemNo] = useState('');
  const [newItemExp, setNewItemExp] = useState('');
  const [newItemImg, setNewItemImg] = useState('');

  // Sync theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setStoredString(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // Initial user check
  useEffect(() => {
    async function initUsers() {
      let uList = getStored<User[]>(STORAGE_KEYS.USERS, []);
      if (!uList || uList.length === 0) {
        const salt = generateSalt();
        const hash = await hashPassword(salt, 'test');
        const defaultAdmin: User = {
          id: 'u_admin_1',
          username: 'test',
          name: 'ผู้ดูแลระบบ',
          role: 'admin',
          active: true,
          salt,
          hash,
          must: false,
          created: new Date().toLocaleString('th-TH'),
          last: '',
        };
        uList = [defaultAdmin];
        setStored(STORAGE_KEYS.USERS, uList);
        setUsers(uList);
      } else {
        setUsers(uList);
      }

      // Check existing session
      const sessUser = getStoredString(STORAGE_KEYS.SESSION, '');
      if (sessUser) {
        const matched = uList.find((x) => x.username === sessUser && x.active);
        if (matched) {
          setCurrentUser(matched);
          if (!inspectorName) {
            setInspectorName(matched.name);
          }
        }
      }
    }
    initUsers();
  }, []);

  // Cross-device synchronization with server
  const syncWithServer = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      // 1. Check if URL has ?sync= parameter (from QR code or mobile share link)
      const urlSync = checkUrlSyncPayload();
      let currentApi = apiUrl;
      let currentSheet = sheetUrl;
      if (urlSync) {
        if (urlSync.apiUrl) {
          currentApi = urlSync.apiUrl;
          setApiUrl(urlSync.apiUrl);
          setStoredString(STORAGE_KEYS.API_URL, urlSync.apiUrl);
        }
        if (urlSync.sheetUrl) {
          currentSheet = urlSync.sheetUrl;
          setSheetUrl(urlSync.sheetUrl);
          setStoredString(STORAGE_KEYS.SHEET_URL, urlSync.sheetUrl);
        }
      }

      // 2. Fetch server state
      const serverData = await fetchServerSync();
      if (!serverData) return false;

      // Merge server settings to local
      if (serverData.apiUrl && (!currentApi || currentApi !== serverData.apiUrl)) {
        setApiUrl(serverData.apiUrl);
        setStoredString(STORAGE_KEYS.API_URL, serverData.apiUrl);
        currentApi = serverData.apiUrl;
      }
      if (serverData.sheetUrl && (!currentSheet || currentSheet !== serverData.sheetUrl)) {
        setSheetUrl(serverData.sheetUrl);
        setStoredString(STORAGE_KEYS.SHEET_URL, serverData.sheetUrl);
        currentSheet = serverData.sheetUrl;
      }
      if (serverData.theme && serverData.theme !== theme) {
        setTheme(serverData.theme);
        setStoredString(STORAGE_KEYS.THEME, serverData.theme);
      }
      if (serverData.users && serverData.users.length > 0) {
        setUsers(serverData.users);
        setStored(STORAGE_KEYS.USERS, serverData.users);
      }
      if (serverData.lists) {
        setLists(serverData.lists);
        setStored(STORAGE_KEYS.CUSTOM_LISTS, serverData.lists);
      }
      if (serverData.equipment && Object.keys(serverData.equipment).length > 0) {
        setEquipment(serverData.equipment);
        setStored(STORAGE_KEYS.EQ, serverData.equipment);
      }
      if (serverData.globalChecks) {
        setGlobalChecks((prev) => {
          const merged = { ...serverData.globalChecks };
          // Preserve local checks if any
          for (const k of Object.keys(prev)) {
            if (!merged[k]) {
              merged[k] = prev[k];
            } else {
              merged[k] = { ...merged[k], ...prev[k] };
            }
          }
          setStored(STORAGE_KEYS.GLOBAL_CHECKS, merged);
          return merged;
        });
      }
      if (serverData.lastSubmitted) {
        setLastSubmitted(serverData.lastSubmitted);
        setStored(STORAGE_KEYS.LAST_SUBMITTED, serverData.lastSubmitted);
      }
      if (serverData.auditLogs && serverData.auditLogs.length > 0) {
        setAuditLogs(serverData.auditLogs);
        setStored(STORAGE_KEYS.AUDIT_LOGS, serverData.auditLogs);
      }

      // If server was completely empty but this client already has apiUrl or sheetUrl configured:
      if (!serverData.apiUrl && currentApi) {
        await pushServerSync({
          apiUrl: currentApi,
          sheetUrl: currentSheet,
          theme,
          users: getStored<User[]>(STORAGE_KEYS.USERS, users),
          equipment,
          lists,
          globalChecks,
          lastSubmitted,
          auditLogs,
        });
      }

      return true;
    } catch (e) {
      console.warn('Cross-device sync error:', e);
      return false;
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 500);
    }
  };

  useEffect(() => {
    syncWithServer();

    // Auto-sync when returning to tab/app (e.g. mobile unlock or tab switch)
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    };
    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    // Auto-sync interval: automatically poll server every 3.5 seconds for real-time cross-device sync
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    }, 3500);

    // Subscribe to Firebase Cloud Firestore in real-time
    const unsubFirebaseHistory = subscribeInspectionHistory((records) => {
      if (records && records.length > 0) {
        setInspectionHistory(records);
        setStored('inspection_history', records);
      }
    });

    const unsubFirebaseAudit = subscribeAuditLogs((logs) => {
      if (logs && logs.length > 0) {
        setAuditLogs(logs);
      }
    });

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      clearInterval(intervalId);
      unsubFirebaseHistory();
      unsubFirebaseAudit();
    };
  }, []);

  // Auto-hide navigation on scroll down, show on scroll up for wide view
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = React.useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 15) {
        setIsNavVisible(true);
      } else if (currentScrollY > lastScrollY.current + 8) {
        // Scrolling down -> hide navigation for wide view
        setIsNavVisible(false);
      } else if (currentScrollY < lastScrollY.current - 8) {
        // Scrolling up -> show navigation
        setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync equipment, lists, checks to storage
  useEffect(() => {
    setStored(STORAGE_KEYS.EQ, equipment);
  }, [equipment]);

  useEffect(() => {
    setStored(STORAGE_KEYS.CUSTOM_LISTS, lists);
  }, [lists]);

  useEffect(() => {
    setStored(STORAGE_KEYS.GLOBAL_CHECKS, globalChecks);
  }, [globalChecks]);

  useEffect(() => {
    setStored(STORAGE_KEYS.LAST_SUBMITTED, lastSubmitted);
  }, [lastSubmitted]);

  // Debounced auto-push to server so PC and Mobile stay synchronized automatically
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      pushServerSync({
        globalChecks,
        lastSubmitted,
        equipment,
        lists,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [globalChecks, lastSubmitted, equipment, lists]);

  // Compute expiration alerts
  const expiryAlerts: ExpiryAlertItem[] = getAllExpiryAlerts(lists);
  const expiredCount = expiryAlerts.filter((a) => a.status === 'expired').length;
  const warningCount = expiryAlerts.filter((a) => a.status === 'warning').length;

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoginLoading(true);
    const target = users.find((u) => u.username === loginUsername.trim().toLowerCase());
    if (!target) {
      setLoginLoading(false);
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    const hash = await hashPassword(target.salt, loginPassword);
    if (hash !== target.hash) {
      setLoginLoading(false);
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    if (!target.active) {
      setLoginLoading(false);
      setLoginError('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      return;
    }

    // Update last login
    const updatedUsers = users.map((u) =>
      u.id === target.id ? { ...u, last: new Date().toLocaleString('th-TH') } : u
    );
    setUsers(updatedUsers);
    setStored(STORAGE_KEYS.USERS, updatedUsers);

    setCurrentUser(target);
    setStoredString(STORAGE_KEYS.SESSION, target.username);
    setInspectorName(target.name);
    setStoredString(STORAGE_KEYS.INSPECTOR, target.name);

    // Audit log
    const entry = addAuditLog(
      target,
      'เข้าสู่ระบบ',
      `เข้าสู่ระบบด้วยบัญชี @${target.username} (${target.role})`,
      'ระบบหลัก',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);

    setLoginLoading(false);

    if (target.must) {
      setIsPasswordForced(true);
      setIsPasswordModalOpen(true);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      const entry = addAuditLog(
        currentUser,
        'ออกจากระบบ',
        `ออกจากระบบ @${currentUser.username}`,
        'ระบบหลัก',
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    }
    setCurrentUser(null);
    setStoredString(STORAGE_KEYS.SESSION, '');
    setCurrentView('home');
  };

  const handleUpdateAvatar = (newAvatar: string) => {
    if (!currentUser) return;
    const updated = updateUserAvatar(currentUser.id, newAvatar);
    if (updated) {
      setCurrentUser(updated);
      const updatedList = users.map((u) => (u.id === updated.id ? updated : u));
      setUsers(updatedList);
      pushServerSync({ users: updatedList });
      syncUsersToFirebase(updatedList);
      const entry = addAuditLog(
        updated,
        'อัปเดตรูปโปรไฟล์',
        newAvatar ? 'เปลี่ยนรูปโปรไฟล์ใหม่' : 'ลบรูปโปรไฟล์ออก',
        'ระบบหลัก',
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    }
  };

  // User Management Handlers
  const handleAddUser = async (uName: string, fName: string, pw: string, role: Role) => {
    if (users.some((u) => u.username === uName.toLowerCase())) {
      return { success: false, message: 'ชื่อผู้ใช้นี้มีในระบบแล้ว' };
    }
    const salt = generateSalt();
    const hash = await hashPassword(salt, pw);
    const newUser: User = {
      id: 'u_' + Date.now(),
      username: uName.toLowerCase(),
      name: fName,
      role,
      active: true,
      salt,
      hash,
      must: true,
      created: new Date().toLocaleString('th-TH'),
      last: '',
    };
    const updated = [...users, newUser];
    setUsers(updated);
    setStored(STORAGE_KEYS.USERS, updated);
    pushServerSync({ users: updated });

    const entry = addAuditLog(
      currentUser,
      'เพิ่มรายการ',
      `สร้างบัญชีผู้ใช้ใหม่ @${newUser.username} (${newUser.name}, สิทธิ์: ${role})`,
      'จัดการผู้ใช้',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);

    return { success: true, message: 'เพิ่มผู้ใช้สำเร็จ' };
  };

  const handleUpdateRole = (userId: string, newRole: Role) => {
    const updated = users.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
    setUsers(updated);
    setStored(STORAGE_KEYS.USERS, updated);
    pushServerSync({ users: updated });
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({ ...currentUser, role: newRole });
    }
    const target = users.find((u) => u.id === userId);
    const entry = addAuditLog(
      currentUser,
      'เปลี่ยนสิทธิ์ผู้ใช้',
      `เปลี่ยนสิทธิ์ @${target?.username} เป็น ${newRole === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}`,
      'จัดการผู้ใช้',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  const handleToggleActive = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.role === 'admin' && target.active) {
      const activeAdmins = users.filter((u) => u.role === 'admin' && u.active && u.id !== userId);
      if (activeAdmins.length === 0) {
        alert('ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน');
        return;
      }
    }
    const updated = users.map((u) => (u.id === userId ? { ...u, active: !u.active } : u));
    setUsers(updated);
    setStored(STORAGE_KEYS.USERS, updated);
    pushServerSync({ users: updated });
    if (currentUser?.id === userId && target.active) {
      handleLogout();
      return;
    }
    const entry = addAuditLog(
      currentUser,
      'เปลี่ยนสิทธิ์ผู้ใช้',
      `${target.active ? 'ระงับ' : 'เปิดใช้งาน'} บัญชี @${target.username}`,
      'จัดการผู้ใช้',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  const handleResetPassword = async (userId: string, newPw: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const salt = generateSalt();
    const hash = await hashPassword(salt, newPw);
    const updated = users.map((u) =>
      u.id === userId ? { ...u, salt, hash, must: true } : u
    );
    setUsers(updated);
    setStored(STORAGE_KEYS.USERS, updated);
    pushServerSync({ users: updated });
    const entry = addAuditLog(
      currentUser,
      'เปลี่ยนรหัสผ่าน',
      `รีเซ็ตรหัสผ่านให้ @${target.username} (ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ)`,
      'จัดการผู้ใช้',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (currentUser?.id === userId) {
      alert('ไม่สามารถลบบัญชีของตนเองได้');
      return;
    }
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    setStored(STORAGE_KEYS.USERS, updated);
    pushServerSync({ users: updated });
    const entry = addAuditLog(
      currentUser,
      'ลบรายการ',
      `ลบบัญชีผู้ใช้ @${target.username} (${target.name}) ออกจากระบบ`,
      'จัดการผู้ใช้',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  const handleChangeOwnPassword = async (oldPw: string, newPw: string) => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบก่อน' };
    const oldHash = await hashPassword(currentUser.salt, oldPw);
    if (oldHash !== currentUser.hash) {
      return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    }
    const newSalt = generateSalt();
    const newHash = await hashPassword(newSalt, newPw);
    const updatedUser: User = {
      ...currentUser,
      salt: newSalt,
      hash: newHash,
      must: false,
    };
    const updatedUsers = users.map((u) => (u.id === currentUser.id ? updatedUser : u));
    setUsers(updatedUsers);
    setStored(STORAGE_KEYS.USERS, updatedUsers);
    pushServerSync({ users: updatedUsers });
    setCurrentUser(updatedUser);

    const entry = addAuditLog(
      currentUser,
      'เปลี่ยนรหัสผ่าน',
      `เปลี่ยนรหัสผ่านของตนเองสำเร็จ (@${currentUser.username})`,
      'ข้อมูลส่วนตัว',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  };

  // Equipment checking calculation for current room
  const activeRoom = ROOMS.find((r) => r.id === activeRoomId) || ROOMS[0];
  const activeRoomEquipment = equipment[activeRoomId] || [];
  const activeRoomChecks = globalChecks[activeRoomId] || {};

  let roomCheckedCount = 0;
  activeRoomEquipment.forEach((it) => {
    const k = `${activeRoom.n}|${it.name}|${it.code || ''}`;
    if (activeRoomChecks[k] && activeRoomChecks[k].result) {
      roomCheckedCount++;
    }
  });
  const roomTotal = activeRoomEquipment.length;
  const roomPct = roomTotal > 0 ? Math.round((roomCheckedCount / roomTotal) * 100) : 0;

  // Hospital-wide equipment stats
  let hospitalTotalItems = 0;
  let hospitalCheckedItems = 0;
  ROOMS.forEach((r) => {
    if (r.m && equipment[r.id]) {
      hospitalTotalItems += equipment[r.id].length;
      const rChecks = globalChecks[r.id] || {};
      equipment[r.id].forEach((it) => {
        const k = `${r.n}|${it.name}|${it.code || ''}`;
        if (rChecks[k] && rChecks[k].result) hospitalCheckedItems++;
      });
    }
  });
  const hospitalPct = hospitalTotalItems > 0 ? Math.round((hospitalCheckedItems / hospitalTotalItems) * 100) : 0;

  // Emergency Bag items check stats
  const bagItems: EquipmentItem[] = [];
  Object.values(lists.bag.groups).forEach((arr) => bagItems.push(...arr));
  const bagChecks = globalChecks['bag'] || {};
  let bagCheckedCount = 0;
  bagItems.forEach((it) => {
    const k = `bag|${it.name}|${it.code || ''}`;
    if (bagChecks[k] && bagChecks[k].result) bagCheckedCount++;
  });
  const bagPct = bagItems.length > 0 ? Math.round((bagCheckedCount / bagItems.length) * 100) : 0;

  // Emergency Cart items check stats
  const cartItems: EquipmentItem[] = [];
  Object.values(lists.cart.groups).forEach((arr) => cartItems.push(...arr));
  const cartChecks = globalChecks['cart'] || {};
  let cartCheckedCount = 0;
  cartItems.forEach((it) => {
    const k = `cart|${it.name}|${it.code || ''}`;
    if (cartChecks[k] && cartChecks[k].result) cartCheckedCount++;
  });
  const cartPct = cartItems.length > 0 ? Math.round((cartCheckedCount / cartItems.length) * 100) : 0;

  // Toggle item check status
  const handleToggleCheck = (
    contextKey: string,
    itemKey: string,
    resultVal: 'ปกติ' | 'ผิดปกติ',
    itemName: string
  ) => {
    setGlobalChecks((prev) => {
      const currentContext = prev[contextKey] || {};
      const existing = currentContext[itemKey] || { result: '' as const };
      const nextResult: 'ปกติ' | 'ผิดปกติ' | '' = existing.result === resultVal ? '' : resultVal;

      const updatedContext: Record<string, { result: 'ปกติ' | 'ผิดปกติ' | ''; note?: string }> = {
        ...currentContext,
        [itemKey]: {
          ...existing,
          result: nextResult,
        },
      };

      const newGlobalChecks = {
        ...prev,
        [contextKey]: updatedContext,
      };

      setStored(STORAGE_KEYS.GLOBAL_CHECKS, newGlobalChecks);

      // Immediately push to server in background so sync is instant and doesn't get overwritten by polling
      pushServerSync({
        globalChecks: newGlobalChecks,
      }).catch(() => {});

      return newGlobalChecks;
    });
  };

  // Update item note
  const handleUpdateItemNote = (contextKey: string, itemKey: string, noteText: string) => {
    const currentContext = globalChecks[contextKey] || {};
    const existing = currentContext[itemKey] || { result: '' as const };
    const updatedContext: Record<string, { result: 'ปกติ' | 'ผิดปกติ' | ''; note?: string }> = {
      ...currentContext,
      [itemKey]: {
        ...existing,
        note: noteText,
      },
    };
    setGlobalChecks((prev) => ({
      ...prev,
      [contextKey]: updatedContext,
    }));
  };

  // Update expiration date for supply
  const handleUpdateExpDate = (category: 'bag' | 'cart', groupName: string, itemIdx: number, newExp: string) => {
    const targetItem = lists[category].groups[groupName][itemIdx];
    const oldExp = targetItem.exp || 'ไม่ได้ระบุ';
    const updatedLists = { ...lists };
    updatedLists[category].groups[groupName][itemIdx].exp = newExp;
    setLists(updatedLists);
    pushServerSync({ lists: updatedLists });

    const entry = addAuditLog(
      currentUser,
      'แก้ไขรายการ',
      `ปรับปรุงวันหมดอายุ "${targetItem.name}" จาก [${oldExp}] เป็น [${newExp}]`,
      lists[category].title,
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  // Add Item to Room or List
  const handleAddItem = (groupNameOrRoomId: string, isEquipment: boolean, category?: 'bag' | 'cart') => {
    if (!newItemName.trim()) {
      alert('กรุณากรอกชื่อรายการ');
      return;
    }

    if (isEquipment) {
      const roomEq = equipment[groupNameOrRoomId] || [];
      const nextNo = newItemNo.trim() || String(roomEq.length + 1);
      const targetRoom = ROOMS.find((r) => r.id === groupNameOrRoomId);
      const newItem: EquipmentItem = {
        name: newItemName.trim(),
        code: newItemCode.trim(),
        sap: newItemSap.trim() || '432028000370',
        spec: newItemSpec.trim() || 'มาตรฐานโรงพยาบาลทั่วไป',
        source: newItemSource.trim() || 'เงินงบประมาณ',
        date: newItemDate.trim() || '7 ก.พ. 68',
        qty: newItemQty.trim() || '1',
        price: newItemPrice.trim() || '250,000.00',
        no: nextNo,
        img: newItemImg,
        location: targetRoom ? targetRoom.n : groupNameOrRoomId,
      };

      const updated = {
        ...equipment,
        [groupNameOrRoomId]: [...roomEq, newItem],
      };
      setEquipment(updated);

      const entry = addAuditLog(
        currentUser,
        'เพิ่มรายการ',
        `เพิ่มครุภัณฑ์ใหม่ "${newItem.name}" (${newItem.code || 'ไม่มีรหัส'})`,
        targetRoom?.n || groupNameOrRoomId,
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    } else if (category) {
      const currentGroups = lists[category].groups;
      const groupItems = currentGroups[groupNameOrRoomId] || [];
      const nextNo = newItemNo.trim() || String(groupItems.length + 1);

      const newItem: EquipmentItem = {
        name: newItemName.trim(),
        code: newItemCode.trim() || '-',
        sap: newItemSap.trim() || '-',
        spec: newItemSpec.trim() || '-',
        source: newItemSource.trim() || 'คลังยา/เวชภัณฑ์',
        date: newItemDate.trim() || '-',
        qty: newItemQty.trim() || '1',
        price: newItemPrice.trim() || '-',
        no: nextNo,
        exp: newItemExp.trim(),
        img: newItemImg,
        location: lists[category].title,
      };

      const updatedCategory = {
        ...lists[category],
        groups: {
          ...currentGroups,
          [groupNameOrRoomId]: [...groupItems, newItem],
        },
      };

      setLists({
        ...lists,
        [category]: updatedCategory,
      });

      const entry = addAuditLog(
        currentUser,
        'เพิ่มรายการ',
        `เพิ่มอุปกรณ์/ยา "${newItem.name}" ในกลุ่ม [${groupNameOrRoomId}]`,
        lists[category].title,
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    }

    // Reset inputs
    setNewItemName('');
    setNewItemCode('');
    setNewItemSap('');
    setNewItemSpec('');
    setNewItemPrice('');
    setNewItemNo('');
    setNewItemExp('');
    setNewItemImg('');
    setAddingGroupIdx(null);
  };

  // Delete item
  const handleDeleteItem = (
    contextKey: string,
    item: EquipmentItem,
    groupName?: string,
    itemIdx?: number
  ) => {
    if (!confirm(`ยืนยันการลบ "${item.name}" ออกจากระบบ?`)) return;

    if (contextKey === 'eq' || ROOMS.some((r) => r.id === contextKey)) {
      const roomId = contextKey;
      const roomEq = equipment[roomId] || [];
      const updated = roomEq.filter((it) => it !== item);
      setEquipment({
        ...equipment,
        [roomId]: updated,
      });
      const roomName = ROOMS.find((r) => r.id === roomId)?.n || roomId;
      const entry = addAuditLog(
        currentUser,
        'ลบรายการ',
        `ลบครุภัณฑ์ "${item.name}" (${item.code || '-'}) ออกจาก ${roomName}`,
        roomName,
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    } else if ((contextKey === 'bag' || contextKey === 'cart') && groupName !== undefined && itemIdx !== undefined) {
      const cat = contextKey as 'bag' | 'cart';
      const updatedList = { ...lists[cat] };
      updatedList.groups[groupName].splice(itemIdx, 1);
      setLists({
        ...lists,
        [cat]: updatedList,
      });
      const entry = addAuditLog(
        currentUser,
        'ลบรายการ',
        `ลบรายการ "${item.name}" ออกจาก [${groupName}]`,
        lists[cat].title,
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
    }
  };

  // Quick Replace item expiry handler
  const handleConfirmQuickReplace = (
    category: 'bag' | 'cart',
    groupName: string,
    itemIndex: number,
    newExp: string
  ) => {
    const cat = lists[category];
    if (!cat || !cat.groups[groupName]) return;
    const items = [...cat.groups[groupName]];
    if (!items[itemIndex]) return;

    const oldItem = items[itemIndex];
    items[itemIndex] = {
      ...oldItem,
      exp: newExp,
    };

    const updatedLists = {
      ...lists,
      [category]: {
        ...cat,
        groups: {
          ...cat.groups,
          [groupName]: items,
        },
      },
    };

    setLists(updatedLists);

    const entry = addAuditLog(
      currentUser,
      'แก้ไขรายการ',
      `เปลี่ยนของใหม่ "${oldItem.name}" ใน [${cat.title} - ${groupName}] กำหนดวันหมดอายุใหม่เป็น ${newExp}`,
      cat.title,
      apiUrl
    );
    const updatedAudit = [entry, ...auditLogs];
    setAuditLogs(updatedAudit);

    pushServerSync({
      lists: updatedLists,
      auditLogs: updatedAudit,
    });
  };

  // Helper row builders for all 3 categories (Eq, Bag, Cart)
  const buildEqReportRows = () => {
    const rows: any[] = [];
    ROOMS.forEach((r) => {
      if (r.m && equipment[r.id]) {
        const rChecks = globalChecks[r.id] || {};
        equipment[r.id].forEach((o) => {
          const k = `${r.n}|${o.name}|${o.code || ''}`;
          const ch = rChecks[k] || { result: '' };
          const statusText =
            ch.result === 'ปกติ'
              ? 'ใช้งานได้'
              : ch.result === 'ผิดปกติ'
              ? 'ใช้งานไม่ได้'
              : 'ไม่พบรายการ';
          rows.push({
            no: o.no || '-',
            code: o.code || '-',
            sap: o.sap || '-',
            name: o.name,
            spec: o.spec || '-',
            source: o.source || '-',
            date: o.date || '-',
            qty: o.qty || '1',
            tax: o.tax || '7',
            price: o.price || '-',
            location: r.n,
            res: statusText,
            note: ch.note || '',
          });
        });
      }
    });
    return rows;
  };

  const buildCategoryReportRows = (type: 'bag' | 'cart') => {
    const rows: any[] = [];
    const cfg = lists[type];
    const catChecks = globalChecks[type] || {};
    Object.entries(cfg.groups).forEach(([gName, items]) => {
      items.forEach((o, idx) => {
        const k = `${type}|${o.name}|${o.code || ''}`;
        const ch = catChecks[k] || { result: '' };
        const statusText =
          ch.result === 'ปกติ'
            ? 'ใช้งานได้'
            : ch.result === 'ผิดปกติ'
            ? 'ใช้งานไม่ได้'
            : 'ไม่พบรายการ';
        rows.push({
          no: String(idx + 1),
          code: o.code || '-',
          sap: o.sap || '-',
          name: o.name,
          spec: o.spec || '-',
          source: o.source || '-',
          date: o.date || '-',
          qty: o.qty || '1',
          tax: '7',
          price: o.price || '-',
          location: `${cfg.title} (${gName})`,
          res: statusText,
          note: ch.note || '',
        });
      });
    });
    return rows;
  };

  // Open Printable Report Modal anytime with selected category
  const handleOpenPrintReport = (
    type: 'eq' | 'bag' | 'cart' | 'drug',
    drugSub?: 'all' | 'monthly' | 'quarterly' | 'adhoc'
  ) => {
    setReportModalCategory(type);
    if (drugSub) {
      setReportModalDrugSubCategory(drugSub);
    }
    let titleStr = '';
    let rows: any[] = [];
    if (type === 'eq') {
      titleStr = 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
      rows = buildEqReportRows();
    } else if (type === 'bag' || type === 'cart') {
      titleStr = lists[type].title;
      rows = buildCategoryReportRows(type);
    } else {
      titleStr = 'แบบฟอร์มตรวจสอบและเบิกจ่ายคลังยาและสารน้ำ';
      rows = [];
    }
    setReportModalTitle(titleStr);
    setReportModalRows(rows);
    setIsReportModalOpen(true);
  };

  // Submit Inspection Handler (writes to partitioned Google Sheet & Audit Log)
  const handleSubmitInspection = async (type: 'eq' | 'bag' | 'cart') => {
    if (!inspectorName.trim()) {
      alert('กรุณากรอกชื่อผู้ตรวจสอบ');
      return;
    }

    const nowFormatted = new Date().toLocaleString('th-TH');
    const submissionRows: any[] = [];
    let titleStr = '';
    let sheetBaseName = '';

    if (type === 'eq') {
      titleStr = 'คลินิกงานบริการผู้ป่วยในวิสัญญี';
      sheetBaseName = 'ครุภัณฑ์';

      // Gather from all rooms
      ROOMS.forEach((r) => {
        if (r.m && equipment[r.id]) {
          const rChecks = globalChecks[r.id] || {};
          equipment[r.id].forEach((o) => {
            const k = `${r.n}|${o.name}|${o.code || ''}`;
            const ch = rChecks[k] || { result: '' };
            const statusText =
              ch.result === 'ปกติ'
                ? 'ใช้งานได้'
                : ch.result === 'ผิดปกติ'
                ? 'ใช้งานไม่ได้'
                : 'ไม่พบรายการ';

            submissionRows.push({
              no: o.no || '-',
              code: o.code || '-',
              sap: o.sap || '-',
              name: o.name,
              spec: o.spec || '-',
              source: o.source || '-',
              date: o.date || '-',
              qty: o.qty || '1',
              tax: o.tax || '7',
              price: o.price || '-',
              location: r.n,
              res: statusText,
              note: ch.note || '',
            });
          });
        }
      });
    } else {
      const cfg = lists[type];
      titleStr = cfg.title;
      sheetBaseName = cfg.sheet;
      const catChecks = globalChecks[type] || {};

      Object.entries(cfg.groups).forEach(([gName, items]) => {
        items.forEach((o) => {
          const k = `${type}|${o.name}|${o.code || ''}`;
          const ch = catChecks[k] || { result: '' };
          const statusText =
            ch.result === 'ปกติ'
              ? 'ใช้งานได้'
              : ch.result === 'ผิดปกติ'
              ? 'ใช้งานไม่ได้'
              : 'ไม่พบรายการ';

          submissionRows.push({
            no: o.no || '-',
            code: o.code || '-',
            sap: o.sap || '-',
            name: o.name,
            spec: o.spec || '-',
            source: o.source || '-',
            date: o.date || '-',
            qty: o.qty || '1',
            tax: '7',
            price: o.price || '-',
            location: `${titleStr} (${gName})`,
            res: statusText,
            note: ch.note || '',
          });
        });
      });
    }

    // Update last submitted
    const updatedLastSubmitted = {
      ...lastSubmitted,
      [type === 'eq' ? 'eq_all' : type]: nowFormatted,
    };
    if (type === 'eq') {
      ROOMS.forEach((r) => {
        updatedLastSubmitted[`room_${r.id}`] = nowFormatted;
      });
    }
    setLastSubmitted(updatedLastSubmitted);

    setIsSubmitting(true);
    setSubmissionProgress(15);
    setSubmissionStatusText('กำลังรวบรวมข้อมูลรายการทั้งหมด...');
    await new Promise((r) => setTimeout(r, 200));

    setSubmissionProgress(45);
    setSubmissionStatusText('กำลังจัดรูปแบบตารางทางการ 14 คอลัมน์...');
    await new Promise((r) => setTimeout(r, 250));

    setSubmissionProgress(75);
    setSubmissionStatusText('กำลังส่งข้อมูลและสร้างชีตรอบใหม่ใน Google Sheets...');

    // คำนวณชื่อชีตมาตรฐาน Smart Naming Standard: [หมวด]_[สถานที่/ห้อง]_[วันที่] เช่น ครุภัณฑ์_OR3_22102569
    const dParts = (checkDate || '').split('-');
    const cYear = dParts[0] || new Date().getFullYear().toString();
    const cMonth = dParts[1] || ('0' + (new Date().getMonth() + 1)).slice(-2);
    const cDay = dParts[2] || ('0' + new Date().getDate()).slice(-2);
    const thaiYear = String(parseInt(cYear, 10) + 543);
    const dateFormatted = `${cDay}${cMonth}${thaiYear}`;

    let locCode = 'ทุกห้อง';
    if (activeRoomId && currentView === 'room_check') {
      const roomObj = ROOMS.find((r) => r.id === activeRoomId);
      if (roomObj) {
        locCode = roomObj.n.replace(/\s+/g, '');
      }
    }

    const uniqueSheetName =
      type === 'eq'
        ? `ครุภัณฑ์_${locCode}_${dateFormatted}`
        : type === 'bag'
        ? `กระเป๋า_EMER_${dateFormatted}`
        : `รถ_EMER_${dateFormatted}`;

    // Send to GAS
    const res = await sendInspectionToGas(apiUrl, {
      type,
      sheet: sheetBaseName,
      sheetName: uniqueSheetName,
      title: titleStr,
      date: checkDate,
      who: inspectorName,
      user: currentUser?.username || 'user',
      note: generalNote,
      rows: submissionRows,
    });

    setSubmissionProgress(95);
    setSubmissionStatusText('บันทึกและซิงค์ข้อมูลเรียบร้อยแล้ว');
    await new Promise((r) => setTimeout(r, 200));

    setSubmissionProgress(100);
    await new Promise((r) => setTimeout(r, 150));
    setIsSubmitting(false);

    // Record audit log
    const entry = addAuditLog(
      currentUser,
      'บันทึกผลการตรวจสอบ',
      `ส่งผลตรวจเช็ค ${titleStr} (${submissionRows.length} รายการ) ลง Google Sheet`,
      titleStr,
      apiUrl
    );
    const updatedAudit = [entry, ...auditLogs];
    setAuditLogs(updatedAudit);

    // Save to server database immediately so mobile and other computers have the updated submission
    pushServerSync({
      apiUrl,
      sheetUrl,
      lastSubmitted: updatedLastSubmitted,
      globalChecks,
      equipment,
      lists,
      auditLogs: updatedAudit,
    });

    // Save to inspection history for easy review and selective printing
    const newRecord: InspectionHistoryRecord = {
      id: `hist_${Date.now()}`,
      timestamp: nowFormatted,
      date: checkDate,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      who: inspectorName,
      type,
      title: titleStr,
      rows: submissionRows,
    };
    const updatedHistory = [newRecord, ...inspectionHistory.slice(0, 49)];
    setInspectionHistory(updatedHistory);
    setStored('inspection_history', updatedHistory);

    // Save to Firebase Cloud Firestore database
    saveInspectionToFirebase(newRecord);
    addAuditLogToFirebase(entry);

    setReportModalTitle(titleStr);
    setReportModalRows(submissionRows);

    setSubmissionFeedback({
      success: res.success,
      msg: res.message,
      rows: submissionRows,
    });
    setIsReportModalOpen(true);
  };

  // Google Sheet DM Navigation Handler
  const handleOpenGoogleSheet = () => {
    if (sheetUrl && sheetUrl.trim()) {
      window.open(sheetUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      setIsSettingsOpen(true);
      alert('ยังไม่ได้ระบุลิ้งค์ Google Sheet\nกรุณาวาง URL ของ Google Sheet ในช่อง "ลิ้งค์เปิด Google Sheet โดยตรง" เพื่อเปิดใช้งานปุ่มนี้');
    }
  };

  const handleDeleteHistoryRecord = async (recordId: string) => {
    const isAdmin = !currentUser || currentUser.role === 'admin';
    if (!isAdmin) {
      alert('เฉพาะแอดมินผู้ดูแลระบบเท่านั้นที่สามารถลบประวัติรอบตรวจได้');
      return;
    }
    const next = inspectionHistory.filter((h) => h.id !== recordId);
    setInspectionHistory(next);
    setStored('inspection_history', next);
    try {
      await deleteInspectionFromFirebase(recordId);
    } catch (e) {
      console.warn('Failed to delete inspection from Firebase:', e);
    }
  };

  // Image upload handler
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewItemImg(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Reset full cycle (opens in-app confirmation modal)
  const handleResetHospitalCycle = () => {
    setIsResetConfirmOpen(true);
  };

  const handleExecuteResetRound = () => {
    // Reset all checks in memory and persistent storage
    setGlobalChecks({});
    setStored(STORAGE_KEYS.GLOBAL_CHECKS, {});

    const updatedSubmitted = {};
    setLastSubmitted(updatedSubmitted);
    setStored(STORAGE_KEYS.LAST_SUBMITTED, updatedSubmitted);

    setCheckDate(new Date().toISOString().split('T')[0]);

    const entry = addAuditLog(
      currentUser,
      'บันทึกผลการตรวจสอบ',
      'เริ่มรอบตรวจเช็คใหม่ (รีเซ็ตสถานะผลการตรวจทุกห้องและหมวดหมู่)',
      'ระบบหลัก',
      apiUrl
    );
    const updatedAudit = [entry, ...auditLogs];
    setAuditLogs(updatedAudit);

    pushServerSync({
      globalChecks: {},
      lastSubmitted: updatedSubmitted,
      auditLogs: updatedAudit,
    }).catch(() => {});

    setIsResetConfirmOpen(false);
    setResetToast('✓ เริ่มต้นรอบตรวจใหม่สำเร็จ! รายการตรวจเช็คทุกห้องถูกรีเซ็ตพร้อมตรวจแล้ว');
    setTimeout(() => setResetToast(''), 4500);
  };

  // If not logged in, render clean modern login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 border border-blue-400/40 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-600/25 text-2xl font-bold mb-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white">
                <path
                  d="M12 3L19 7V17L12 21L5 17V7L12 3Z"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  fill="rgba(255,255,255,0.18)"
                />
                <path
                  d="M12 7v10m-5-5h10"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Anesthesia Check
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="เช่น test"
                autoCapitalize="none"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="เช่น test"
                  autoComplete="current-password"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-red-500 dark:text-red-400 font-medium text-xs">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-md shadow-sky-600/20 transition disabled:opacity-50 text-xs flex items-center justify-center gap-2"
            >
              {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>เข้าสู่ระบบ</span>
            </button>

            {/* Shortcut Login for fast access */}
            <button
              type="button"
              onClick={() => {
                setLoginUsername('test');
                setLoginPassword('test');
                setTimeout(() => {
                  const event = new Event('submit', { bubbles: true, cancelable: true });
                  document.querySelector('form')?.dispatchEvent(event);
                }, 100);
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>ทางลัดเข้าสู่ระบบ (ทดสอบ)</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[11px] text-slate-400">
              ทดสอบเข้าสู่ระบบ: บัญชี <b>test</b> / รหัสผ่าน <b>test</b>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 pb-28 transition-colors duration-200">
      {/* Header with auto-hide */}
      <Header
        currentUser={currentUser}
        onGoHome={() => {
          setCurrentView('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenDrugInventory={() => setCurrentView('drug_check')}
        isSyncing={isSyncing}
        isVisible={isNavVisible}
        unreadCount={
          currentUser?.role === 'admin'
            ? expiredCount + warningCount + auditLogs.length
            : expiredCount + warningCount
        }
      />

      {/* Sticky Top Progress Bar on scroll */}
      {currentView !== 'home' && currentView !== 'users' && currentView !== 'drug_check' && (
        <div
          className={`sticky ${
            isNavVisible ? 'top-[53px]' : 'top-0'
          } z-20 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/80 py-1.5 px-4 shadow-xs transition-all duration-300`}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between text-xs font-semibold text-neutral-800 dark:text-neutral-200 gap-2">
            <span className="truncate max-w-[55%] sm:max-w-none text-neutral-900 dark:text-white font-medium">
              {currentView === 'eq_overview'
                ? 'แผนผังและรายการครุภัณฑ์'
                : currentView === 'room_check'
                ? activeRoom.n
                : currentView === 'bag_check'
                ? 'กระเป๋า Emergency'
                : 'รถ Emergency'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 text-blue-600 dark:text-blue-400 font-bold text-xs">
              <span>
                {currentView === 'eq_overview'
                  ? `${hospitalPct}%`
                  : currentView === 'room_check'
                  ? `${roomPct}%`
                  : currentView === 'bag_check'
                  ? `${bagPct}%`
                  : `${cartPct}%`}
              </span>
              {(currentView === 'eq_overview' || currentView === 'room_check') && (
                <span className="text-[11px] font-normal text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                  {currentView === 'eq_overview'
                    ? `(${hospitalCheckedItems}/${hospitalTotalItems})`
                    : `(${roomCheckedCount}/${roomTotal})`}
                </span>
              )}
            </div>
          </div>
          <div className="max-w-4xl mx-auto w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  currentView === 'eq_overview'
                    ? hospitalPct
                    : currentView === 'room_check'
                    ? roomPct
                    : currentView === 'bag_check'
                    ? bagPct
                    : cartPct
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-3">
        {/* View Routing */}
        {currentView === 'home' && (
          <div className="space-y-3">
            {/* Urgent Expiration Alert Banner - ONLY shown on Home */}
            <ExpiryAlertBanner
              alerts={expiryAlerts}
              onOpenAlertDetails={() => setIsNotificationsOpen(true)}
            />

            {/* Menu Cards (Apple / Samsung One UI Style) */}
            <div className="space-y-3">
              {/* Drug Inventory Card - Clean Minimalist Style */}
              <button
                onClick={() => setCurrentView('drug_check')}
                className="w-full text-left p-4 bg-white dark:bg-[#161822] hover:bg-neutral-50 dark:hover:bg-[#1c1f2c] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex items-center gap-3.5 transition-all cursor-pointer group oneui-card"
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  💊
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      ระบบตรวจเช็คคลังยาและสารน้ำ
                    </h3>
                  </div>
                </div>
              </button>

              {/* Equipment Card */}
              <button
                onClick={() => setCurrentView('eq_overview')}
                className="w-full text-left p-4 bg-white dark:bg-[#161822] hover:bg-neutral-50 dark:hover:bg-[#1c1f2c] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex items-center gap-3.5 transition-all cursor-pointer group oneui-card"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/60 dark:to-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  🏥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      เช็คครุภัณฑ์วิสัญญี / ห้องผ่าตัด
                    </h3>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60">
                      {hospitalPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                    <span>ตรวจแล้ว {hospitalCheckedItems}/{hospitalTotalItems} รายการ</span>
                    <span>·</span>
                    <span>ล่าสุด: {lastSubmitted['eq_all'] || '-'}</span>
                  </div>
                </div>
              </button>

              {/* Emergency Bag Card */}
              <button
                onClick={() => setCurrentView('bag_check')}
                className="w-full text-left p-4 bg-white dark:bg-[#161822] hover:bg-neutral-50 dark:hover:bg-[#1c1f2c] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex items-center gap-3.5 transition-all cursor-pointer group oneui-card"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/60 dark:to-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  💼
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      เช็คกระเป๋าอีเมอร์เจนซี่
                    </h3>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60">
                      {bagPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                    <span>ส่งข้อมูล: {lastSubmitted['bag'] || '-'}</span>
                    {expiryAlerts.filter((a) => a.category === 'bag').length > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        · มีรายการใกล้/หมดอายุ
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Emergency Cart Card */}
              <button
                onClick={() => setCurrentView('cart_check')}
                className="w-full text-left p-4 bg-white dark:bg-[#161822] hover:bg-neutral-50 dark:hover:bg-[#1c1f2c] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex items-center gap-3.5 transition-all cursor-pointer group oneui-card"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  🛒
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      เช็ครถอีเมอร์เจนซี่
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60">
                      {cartPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                    <span>ส่งข้อมูล: {lastSubmitted['cart'] || '-'}</span>
                    {expiryAlerts.filter((a) => a.category === 'cart').length > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        · มีรายการใกล้/หมดอายุ
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Manage Users Card */}
              <button
                onClick={() => setCurrentView('users')}
                className="w-full text-left p-4 bg-white dark:bg-[#161822] hover:bg-neutral-50 dark:hover:bg-[#1c1f2c] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs flex items-center gap-3.5 transition-all cursor-pointer group oneui-card"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/60 dark:to-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  👥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      จัดการผู้ใช้งาน & กำหนดสิทธิ์
                    </h3>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                      {users.length} บัญชี
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    รายชื่อเจ้าหน้าที่ เพิ่มผู้ใช้ หรือตั้งค่าระดับสิทธิ์การตรวจเช็ค
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* View: Equipment Overview (Hospital Floor Plan) */}
        {currentView === 'eq_overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentView('home')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับหน้าหลัก</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Official 14-column report preview & Print */}
                <button
                  onClick={() => handleOpenPrintReport('eq')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition shadow-xs cursor-pointer"
                  title="พิมพ์แบบฟอร์ม 14 คอลัมน์ทางการ (Ctrl + P)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ พิมพ์แบบฟอร์ม A4 (Ctrl+P)</span>
                </button>

                <button
                  onClick={handleResetHospitalCycle}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  title="เริ่มรอบตรวจเช็คใหม่"
                >
                  🔄 เริ่มรอบใหม่
                </button>
              </div>
            </div>

            {/* Hospital Progress Bar */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 gap-1.5 leading-normal">
                <span>ความคืบหน้าการเช็คครุภัณฑ์ทั้งโรงพยาบาล</span>
                <span className="text-sky-600 dark:text-sky-400 font-extrabold whitespace-nowrap">
                  {hospitalPct}% ({hospitalCheckedItems}/{hospitalTotalItems} รายการ)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${hospitalPct}%` }}
                />
              </div>
            </div>

            {/* Unchecked Rooms Navigation (นำทางว่ายังไม่ได้ติ๊กห้องไหน แต่ละห้องเหลือเท่าไร) */}
            <UncheckedRoomsNavigator
              rooms={ROOMS}
              equipment={equipment}
              globalChecks={globalChecks}
              onSelectRoom={(rId) => {
                setActiveRoomId(rId);
                setCurrentView('room_check');
              }}
            />

            {/* Interactive Floor Map */}
            <FloorMap
              rooms={ROOMS}
              equipment={equipment}
              globalChecks={globalChecks}
              onSelectRoom={(rId) => {
                setActiveRoomId(rId);
                setCurrentView('room_check');
              }}
            />
          </div>
        )}

        {/* View: Room Check (Specific OR Room) */}
        {currentView === 'room_check' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentView('eq_overview')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับแผนผังห้อง</span>
              </button>

              {/* Mode switch */}
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setEqMode('explore')}
                  className={`px-3 py-1 rounded-lg transition ${
                    eqMode === 'explore'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  📋 สำรวจ / แก้ไข
                </button>
                <button
                  onClick={() => setEqMode('check')}
                  className={`px-3 py-1 rounded-lg transition ${
                    eqMode === 'check'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  🔍 เริ่มตรวจเช็ค
                </button>
              </div>
            </div>

            {/* Room Header & Progress */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📍 {activeRoom.n}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                    {roomTotal} รายการ
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ตรวจเช็คความพร้อมเครื่องดมยาและครุภัณฑ์ประจำห้อง
                </p>
              </div>

              <div className="w-full sm:w-60">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span>ความคืบหน้าห้องนี้</span>
                  <span className="text-sky-600 dark:text-sky-400">{roomPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${roomPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick navigator for other pending rooms */}
            <UncheckedRoomsNavigator
              rooms={ROOMS}
              equipment={equipment}
              globalChecks={globalChecks}
              onSelectRoom={(rId) => {
                setActiveRoomId(rId);
                setCurrentView('room_check');
              }}
              activeRoomId={activeRoomId}
            />

            {/* Add Item Trigger */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                รายการครุภัณฑ์ ({activeRoomEquipment.length})
              </span>
              <button
                onClick={() => setAddingGroupIdx(addingGroupIdx === 0 ? null : 0)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มครุภัณฑ์ในห้องนี้</span>
              </button>
            </div>

            {/* Add Item Form Drawer */}
            {addingGroupIdx === 0 && (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  + เพิ่มรายการครุภัณฑ์ใหม่ใน {activeRoom.n}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="ชื่อเครื่อง / อุปกรณ์ *"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  <input
                    type="text"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    placeholder="หมายเลขพัสดุ (เช่น 432028000360)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  <input
                    type="text"
                    value={newItemSap}
                    onChange={(e) => setNewItemSap(e.target.value)}
                    placeholder="รหัสสินทรัพย์ SAP"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  <input
                    type="text"
                    value={newItemSpec}
                    onChange={(e) => setNewItemSpec(e.target.value)}
                    placeholder="มาตรฐานและคุณลักษณะเฉพาะ"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  <input
                    type="text"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="ราคา (รวมภาษี)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer text-slate-600 dark:text-slate-300">
                    <Image className="w-3.5 h-3.5" />
                    <span>{newItemImg ? 'มีรูปภาพแล้ว' : 'แนบรูปภาพ'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setAddingGroupIdx(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleAddItem(activeRoomId, true)}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 text-white font-semibold"
                  >
                    บันทึกรายการ
                  </button>
                </div>
              </div>
            )}

            {/* List of items */}
            {activeRoomEquipment.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                ยังไม่มีครุภัณฑ์ในห้องนี้ กดปุ่ม "+ เพิ่มครุภัณฑ์ในห้องนี้" ด้านบน
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeRoomEquipment.map((item, idx) => {
                  const itemKey = `${activeRoom.n}|${item.name}|${item.code || ''}`;
                  const currentCheck = activeRoomChecks[itemKey] || { result: '' };
                  const isOk = currentCheck.result === 'ปกติ';
                  const isBad = currentCheck.result === 'ผิดปกติ';

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs ${
                        isBad
                          ? 'border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/10'
                          : isOk
                          ? 'border-emerald-300 dark:border-emerald-900/50'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {item.img && (
                          <img
                            src={item.img}
                            alt={item.name}
                            onClick={() => setZoomedImageUrl(item.img!)}
                            className="w-11 h-11 rounded-xl object-cover shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="แตะดูภาพใหญ่"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.no && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                                #{item.no}
                              </span>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.name}
                            </h4>
                          </div>
                        </div>

                        {/* Check status buttons */}
                        {eqMode === 'check' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() =>
                                handleToggleCheck(activeRoomId, itemKey, 'ปกติ', item.name)
                              }
                              className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition border ${
                                isOk
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                              }`}
                              title="ใช้งานได้ปกติ"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() =>
                                handleToggleCheck(activeRoomId, itemKey, 'ผิดปกติ', item.name)
                              }
                              className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition border ${
                                isBad
                                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-red-50'
                              }`}
                              title="ใช้งานไม่ได้ / มีปัญหา"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* Detail modal button & Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              setSelectedItemDetail({
                                item,
                                result: currentCheck.result,
                                note: currentCheck.note,
                              })
                            }
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
                            title="ดูรายละเอียดทะเบียนครุภัณฑ์"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {eqMode === 'explore' && (
                            <button
                              onClick={() => handleDeleteItem(activeRoomId, item)}
                              className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-xs"
                              title="ลบครุภัณฑ์"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Detail note input for defective items */}
                      {isBad && (
                        <div className="mt-2.5 pt-2 border-t border-red-200 dark:border-red-900/40">
                          <input
                            type="text"
                            value={currentCheck.note || ''}
                            onChange={(e) =>
                              handleUpdateItemNote(activeRoomId, itemKey, e.target.value)
                            }
                            placeholder="ระบุรายละเอียดอาการเสีย หรือปัญหาที่พบ..."
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-red-300 dark:border-red-800 outline-none text-red-900 dark:text-red-200 placeholder:text-red-300"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submission card */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                ข้อมูลการตรวจสอบ & ส่งรายงาน Google Sheet
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    วันที่ตรวจเช็ค
                  </label>
                  <input
                    type="date"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    ชื่อผู้ตรวจสอบ (กรรมการตรวจ)
                  </label>
                  <input
                    type="text"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="ระบุชื่อ-นามสกุล"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={generalNote}
                  onChange={(e) => setGeneralNote(e.target.value)}
                  placeholder="เช่น ตรวจสอบประจำปี 2569 ครบทุกห้อง"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {hospitalPct < 100
                    ? `⚠️ ตรวจเช็คทั้งโรงพยาบาลได้ ${hospitalPct}% (สามารถบันทึกและส่งรายงานได้ตลอดเวลา)`
                    : '🎉 ตรวจเช็คครุภัณฑ์ครบ 100% แล้ว'}
                </span>

                <button
                  onClick={() => handleSubmitInspection('eq')}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ios-touch text-xs"
                >
                  <Send className="w-4 h-4 transform -rotate-45" />
                  <span>บันทึกผลและส่งรายงานเข้า Google Sheets</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View: Emergency Bag / Emergency Cart Check */}
        {(currentView === 'bag_check' || currentView === 'cart_check') && (
          <div className="space-y-4">
            {(() => {
              const categoryKey = currentView === 'bag_check' ? 'bag' : 'cart';
              const cfg = lists[categoryKey];
              const catChecks = globalChecks[categoryKey] || {};

              // Calculate items count
              let catTotal = 0;
              let catChecked = 0;
              Object.values(cfg.groups).forEach((arr) => {
                catTotal += arr.length;
                arr.forEach((it) => {
                  const k = `${categoryKey}|${it.name}|${it.code || ''}`;
                  if (catChecks[k] && catChecks[k].result) catChecked++;
                });
              });
              const pct = catTotal > 0 ? Math.round((catChecked / catTotal) * 100) : 0;

              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => setCurrentView('home')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-2xs cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>กลับหน้าหลัก</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenPrintReport(categoryKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shadow-2xs cursor-pointer"
                        title="ดูแบบฟอร์มรายงานและพิมพ์ A4"
                      >
                        <Printer className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                        <span>แบบฟอร์มรายงาน A4</span>
                      </button>

                      {sheetUrl && (
                        <button
                          onClick={handleOpenGoogleSheet}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-xs font-semibold cursor-pointer shadow-2xs"
                        >
                          <Send className="w-3 h-3 transform -rotate-45" />
                          <span>Google Sheet</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Header & Progress (Minimalist & Clean) */}
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                        {cfg.title}
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        ตรวจเช็คความพร้อมยาและเวชภัณฑ์ประจำ{categoryKey === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'} (รอบ 1 เดือน)
                      </p>
                    </div>

                    <div className="w-full sm:w-56">
                      <div className="flex justify-between items-center text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                        <span>ความคืบหน้า</span>
                        <span className="font-bold text-neutral-900 dark:text-white">{pct}% ({catChecked}/{catTotal})</span>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                        <div
                          className="bg-neutral-900 dark:bg-white h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expiration Filter Pills (Minimalist Segmented Controls) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="text-neutral-400 flex items-center gap-1 shrink-0 text-[11px] mr-1">
                      <Filter className="w-3 h-3" />
                      กรอง:
                    </span>
                    <button
                      onClick={() => setExpFilter('all')}
                      className={`px-3 py-1 rounded-lg font-medium shrink-0 transition cursor-pointer ${
                        expFilter === 'all'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                          : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      ทั้งหมด ({catTotal})
                    </button>
                    <button
                      onClick={() => setExpFilter('expired')}
                      className={`px-3 py-1 rounded-lg font-medium shrink-0 transition cursor-pointer ${
                        expFilter === 'expired'
                          ? 'bg-rose-600 text-white font-semibold'
                          : 'bg-white dark:bg-neutral-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                      }`}
                    >
                      หมดอายุแล้ว
                    </button>
                    <button
                      onClick={() => setExpFilter('warning')}
                      className={`px-3 py-1 rounded-lg font-medium shrink-0 transition cursor-pointer ${
                        expFilter === 'warning'
                          ? 'bg-amber-600 text-white font-semibold'
                          : 'bg-white dark:bg-neutral-900 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-950 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                      }`}
                    >
                      ใกล้หมดอายุ (&le; 30 วัน)
                    </button>
                    <button
                      onClick={() => setExpFilter('good')}
                      className={`px-3 py-1 rounded-lg font-medium shrink-0 transition cursor-pointer ${
                        expFilter === 'good'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                      }`}
                    >
                      ปกติ
                    </button>
                  </div>

                  {/* Groups and Items */}
                  {Object.entries(cfg.groups).map(([groupName, items], gIdx) => {
                    // Filter items by expiration filter if selected
                    const displayedItems = items.filter((it) => {
                      if (expFilter === 'all') return true;
                      const { status } = calculateExpirationStatus(it.exp);
                      return status === expFilter;
                    });

                    if (displayedItems.length === 0 && expFilter !== 'all') {
                      return null;
                    }

                    return (
                      <div key={groupName} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 tracking-wide flex items-center gap-1.5">
                            <span>{groupName}</span>
                            <span className="text-[10px] font-normal text-neutral-400">({items.length})</span>
                          </h3>
                          <button
                            onClick={() => setAddingGroupIdx(addingGroupIdx === gIdx ? null : gIdx)}
                            className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>เพิ่มรายการ</span>
                          </button>
                        </div>

                        {/* Add Item to Group Drawer */}
                        {addingGroupIdx === gIdx && (
                          <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-2.5 text-xs">
                            <h4 className="font-bold text-neutral-800 dark:text-neutral-200">
                              + เพิ่มรายการในกลุ่ม: {groupName}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="ชื่ออุปกรณ์ / ยา *"
                                className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 outline-none text-xs"
                              />
                              <input
                                type="text"
                                value={newItemCode}
                                onChange={(e) => setNewItemCode(e.target.value)}
                                placeholder="รหัสพัสดุ / รหัสยา (ถ้ามี)"
                                className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 outline-none text-xs"
                              />
                              <div>
                                <label className="block text-[10px] text-neutral-400 mb-0.5">วันหมดอายุ (ถ้ามี)</label>
                                <input
                                  type="date"
                                  value={newItemExp}
                                  onChange={(e) => setNewItemExp(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 outline-none text-xs"
                                />
                              </div>
                              <input
                                type="text"
                                value={newItemQty}
                                onChange={(e) => setNewItemQty(e.target.value)}
                                placeholder="จำนวน (เช่น 2 หลอด)"
                                className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 outline-none text-xs"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setAddingGroupIdx(null)}
                                className="px-3 py-1 rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 text-xs cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                              <button
                                onClick={() => handleAddItem(groupName, false, categoryKey)}
                                className="px-4 py-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold text-xs cursor-pointer"
                              >
                                บันทึกรายการ
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Items in this group */}
                        <div className="space-y-2">
                          {displayedItems.map((item, itemIdx) => {
                            const originalIdx = items.indexOf(item);
                            const itemKey = `${categoryKey}|${item.name}|${item.code || ''}`;
                            const currentCheck = catChecks[itemKey] || { result: '' };
                            const isOk = currentCheck.result === 'ปกติ';
                            const isBad = currentCheck.result === 'ผิดปกติ';

                            const { daysRemaining, status: expStatus } = calculateExpirationStatus(item.exp);
                            const isExpired = expStatus === 'expired';
                            const isWarning = expStatus === 'warning';

                            return (
                              <div
                                key={originalIdx}
                                className={`p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border transition-all duration-150 shadow-2xs ${
                                  isBad
                                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/15 dark:bg-rose-950/10'
                                    : isOk
                                    ? 'border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-950/5'
                                    : 'border-neutral-200 dark:border-neutral-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {item.no && (
                                        <span className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-600 dark:bg-blue-500 text-white font-bold shadow-xs shrink-0">
                                          #{item.no}
                                        </span>
                                      )}
                                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                                        {item.name}
                                      </h4>

                                      {/* Expiration Tag (Clean, Non-blinking Minimalist Tag) */}
                                      {item.exp && (
                                        <span
                                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                            isExpired
                                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'
                                              : isWarning
                                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                          }`}
                                        >
                                          {isExpired
                                            ? `หมดอายุแล้ว (${Math.abs(daysRemaining)} วัน)`
                                            : isWarning
                                            ? `ใกล้หมดอายุ (${daysRemaining} วัน)`
                                            : 'ปกติ'}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                                      <label className="flex items-center gap-1.5 text-[11px] font-medium">
                                        <Calendar className="w-3 h-3 text-neutral-400" />
                                        <span>วันหมดอายุ:</span>
                                        <input
                                          type="date"
                                          value={item.exp || ''}
                                          onChange={(e) =>
                                            handleUpdateExpDate(categoryKey, groupName, originalIdx, e.target.value)
                                          }
                                          className="px-2 py-0.5 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs outline-none cursor-pointer"
                                        />
                                      </label>
                                    </div>
                                  </div>

                                  {/* Minimalist Check Buttons */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() =>
                                        handleToggleCheck(categoryKey, itemKey, 'ปกติ', item.name)
                                      }
                                      className={`h-8 px-2.5 rounded-xl font-semibold text-xs flex items-center gap-1 transition border cursor-pointer ${
                                        isOk
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700'
                                      }`}
                                      title="ใช้งานได้ปกติ"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">ปกติ</span>
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleToggleCheck(categoryKey, itemKey, 'ผิดปกติ', item.name)
                                      }
                                      className={`h-8 px-2.5 rounded-xl font-semibold text-xs flex items-center gap-1 transition border cursor-pointer ${
                                        isBad
                                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700'
                                      }`}
                                      title="ใช้งานไม่ได้ / มีปัญหา"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">ผิดปกติ</span>
                                    </button>

                                    {/* Delete item button (Eye icon removed completely) */}
                                    <button
                                      onClick={() =>
                                        handleDeleteItem(categoryKey, item, groupName, originalIdx)
                                      }
                                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-xs cursor-pointer ml-0.5"
                                      title="ลบรายการ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isBad && (
                                  <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/40">
                                    <input
                                      type="text"
                                      value={currentCheck.note || ''}
                                      onChange={(e) =>
                                        handleUpdateItemNote(categoryKey, itemKey, e.target.value)
                                      }
                                      placeholder="ระบุรายละเอียดปัญหา เช่น ยาขาด, ไฟไม่ติด, ชำรุด..."
                                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-rose-300 dark:border-rose-800 outline-none text-rose-900 dark:text-rose-200"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Submission Form */}
                  <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">
                      ส่งข้อมูลการตรวจสอบเข้า Google Sheet (แยกตามเดือนและปี)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          วันที่ตรวจเช็ค (จะถูกนำไปตั้งชื่อชีตรายเดือนและรายปี)
                        </label>
                        <input
                          type="date"
                          value={checkDate}
                          onChange={(e) => setCheckDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          ชื่อผู้ตรวจสอบ
                        </label>
                        <input
                          type="text"
                          value={inspectorName}
                          onChange={(e) => setInspectorName(e.target.value)}
                          placeholder="ระบุชื่อ-นามสกุล"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        หมายเหตุเพิ่มเติม
                      </label>
                      <input
                        type="text"
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder="เช่น เติมยาครบแล้ว ซีลล็อกพร้อมใช้งาน"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-400">
                        {pct < 100
                          ? `ตรวจเช็คแล้ว ${pct}% (${catChecked}/${catTotal})`
                          : '🎉 ตรวจเช็คครบ 100% แล้ว'}
                      </span>

                      <button
                        onClick={() => handleSubmitInspection(categoryKey)}
                        className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ios-touch text-xs"
                      >
                        <Send className="w-4 h-4 transform -rotate-45" />
                        <span>บันทึกผลและส่งเข้า Google Sheet</span>
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* View: User Management (Admin only) */}
        {currentView === 'users' && currentUser.role === 'admin' && (
          <UserManagement
            currentUser={currentUser}
            users={users}
            onBack={() => setCurrentView('home')}
            onAddUser={handleAddUser}
            onUpdateRole={handleUpdateRole}
            onToggleActive={handleToggleActive}
            onResetPassword={handleResetPassword}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {/* View: Drug Inventory */}
        {currentView === 'drug_check' && (
          <DrugInventoryView
            currentUser={currentUser}
            onBack={() => setCurrentView('home')}
            sheetUrl={sheetUrl}
            apiUrl={apiUrl}
            onOpenPreview={(category) => handleOpenPrintReport('drug', category)}
          />
        )}
      </main>

      {/* Bottom Navigation Bar with auto-hide on scroll */}
      <BottomBar
        currentView={currentView}
        currentUser={currentUser}
        onGoHome={() => {
          setCurrentView('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenReport={() => {
          if (currentView === 'bag_check') handleOpenPrintReport('bag');
          else if (currentView === 'cart_check') handleOpenPrintReport('cart');
          else if (currentView === 'drug_check') handleOpenPrintReport('drug');
          else handleOpenPrintReport('eq');
        }}
        onOpenGoogleSheet={handleOpenGoogleSheet}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenDrugInventory={() => setCurrentView('drug_check')}
        sheetUrl={sheetUrl}
        isVisible={isNavVisible}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        currentUser={currentUser}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateAvatar={handleUpdateAvatar}
        onOpenPasswordModal={() => {
          setIsPasswordForced(false);
          setIsPasswordModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentUser={currentUser}
        onClose={() => setIsSettingsOpen(false)}
        apiUrl={apiUrl}
        sheetUrl={sheetUrl}
        theme={theme}
        onSave={(newApi, newSheet, newTheme) => {
          setApiUrl(newApi);
          setSheetUrl(newSheet);
          setTheme(newTheme);
          setStoredString(STORAGE_KEYS.API_URL, newApi);
          setStoredString(STORAGE_KEYS.SHEET_URL, newSheet);
          setStoredString(STORAGE_KEYS.THEME, newTheme);
          const entry = addAuditLog(
            currentUser,
            'ตั้งค่าระบบ',
            'อัปเดตการตั้งค่า Google Apps Script Web App URL และ Google Sheet URL',
            'ระบบหลัก',
            newApi
          );
          const nextLogs = [entry, ...auditLogs];
          setAuditLogs(nextLogs);

          // Push settings to server for automatic cross-device sync
          pushServerSync({
            apiUrl: newApi,
            sheetUrl: newSheet,
            theme: newTheme,
            users,
            equipment,
            lists,
            globalChecks,
            lastSubmitted,
            auditLogs: nextLogs,
          });

          // Save settings to Firebase Cloud Firestore
          saveSettingsToFirebase({ sheetUrl: newSheet, theme: newTheme });
        }}
        onOpenPasswordModal={() => {
          setIsPasswordForced(false);
          setIsPasswordModalOpen(true);
        }}
        onLogout={handleLogout}
        onManualSync={syncWithServer}
      />

      {/* Submission Loading & Percent Progress Modal */}
      <SubmissionLoadingModal
        isOpen={isSubmitting}
        progressPercent={submissionProgress}
        statusText={submissionStatusText}
      />

      {/* Notifications & Audit Log Modal (Bell) */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        currentUser={currentUser}
        onClose={() => setIsNotificationsOpen(false)}
        expiryAlerts={expiryAlerts}
        auditLogs={auditLogs}
        onNavigateToCategory={(cat) => setCurrentView(cat === 'bag' ? 'bag_check' : 'cart_check')}
        onOpenQuickReplace={(alert) => {
          const cat = lists[alert.category];
          if (cat) {
            const gFound = alert.groupName;
            const groupItems = cat.groups[gFound] || [];
            const idxFound = groupItems.findIndex((it) => it.name === alert.item.name);
            setQuickReplaceTarget({
              item: alert.item,
              category: alert.category,
              groupName: gFound || Object.keys(cat.groups)[0] || '',
              itemIndex: idxFound > -1 ? idxFound : 0,
            });
            setIsNotificationsOpen(false);
          }
        }}
        onClearLogs={() => {
          setAuditLogs([]);
          setStored(STORAGE_KEYS.AUDIT_LOGS, []);
          clearAllAuditLogsInFirebase();
        }}
        onDeleteSingleLog={(id: string) => {
          const updated = auditLogs.filter((l) => l.id !== id);
          setAuditLogs(updated);
          setStored(STORAGE_KEYS.AUDIT_LOGS, updated);
          deleteAuditLogInFirebase(id);
        }}
      />

      {/* Quick Replace Item Modal */}
      <QuickReplaceModal
        isOpen={!!quickReplaceTarget}
        item={quickReplaceTarget?.item || null}
        category={quickReplaceTarget?.category || 'bag'}
        groupName={quickReplaceTarget?.groupName || ''}
        itemIndex={quickReplaceTarget?.itemIndex || 0}
        onClose={() => setQuickReplaceTarget(null)}
        onConfirm={handleConfirmQuickReplace}
      />

      {/* Password Change Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        forced={isPasswordForced}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handleChangeOwnPassword}
      />

      {/* Official 14-Column Report Modal (Exact Google Sheet View & Instant Print) */}
      <OfficialReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialCategory={reportModalCategory}
        initialDrugSubCategory={reportModalDrugSubCategory}
        title={reportModalTitle}
        date={checkDate}
        inspector={inspectorName}
        items={reportModalRows.length > 0 ? reportModalRows : (submissionFeedback?.rows || [])}
        eqItems={buildEqReportRows()}
        bagItems={buildCategoryReportRows('bag')}
        cartItems={buildCategoryReportRows('cart')}
        sheetUrl={sheetUrl}
        apiUrl={apiUrl}
        historyRecords={inspectionHistory}
        currentUser={currentUser}
        onDeleteHistoryRecord={handleDeleteHistoryRecord}
      />

      {/* Equipment Detail Modal */}
      <EquipmentDetailModal
        isOpen={!!selectedItemDetail}
        item={selectedItemDetail?.item || null}
        result={selectedItemDetail?.result}
        note={selectedItemDetail?.note}
        onClose={() => setSelectedItemDetail(null)}
        onZoomImage={(url) => setZoomedImageUrl(url)}
      />

      {/* Image Zoom Modal */}
      <ImageModal
        isOpen={!!zoomedImageUrl}
        imageUrl={zoomedImageUrl || ''}
        onClose={() => setZoomedImageUrl(null)}
      />

      {/* Start New Round Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-xl">
              🔄
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                ยืนยันการเริ่มรอบตรวจใหม่?
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                การเริ่มรอบใหม่จะรีเซ็ตผลการตรวจเช็คเดิมของทุกห้อง ให้กลับเป็นสถานะ <span className="font-semibold text-neutral-900 dark:text-neutral-200">"รอการตรวจ"</span> เพื่อให้พยาบาลและเจ้าหน้าที่สามารถเริ่มตรวจรอบใหม่ได้ทันที
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteResetRound}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>🔄 ยืนยันเริ่มรอบใหม่</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Toast Banner */}
      {resetToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2 text-xs font-semibold animate-in slide-in-from-top-4">
          <span>{resetToast}</span>
          <button onClick={() => setResetToast('')} className="text-emerald-200 hover:text-white p-0.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
