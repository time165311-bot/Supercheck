import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
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
  CheckCheck,
} from 'lucide-react';

import {
  AuditLogEntry,
  CheckItemRow,
  CheckItemState,
  DrugItem,
  EquipmentItem,
  ExpiryAlertItem,
  InspectionHistoryRecord,
  ListConfig,
  Role,
  RoomDef,
  ThemeMode,
  User,
} from './types';
import { DEFAULT_LISTS, ROOMS, INITIAL_MASTER_DATA } from './constants/initialData';
import {
  STORAGE_KEYS,
  addAuditLog,
  calculateExpirationStatus,
  getAllExpiryAlerts,
  getInitialDrugs,
  getInitialEquipment,
  getInitialLists,
  getLocalAuditLogs,
  getStored,
  getStoredString,
  setStored,
  setStoredString,
  updateUserAvatar,
} from './services/storage';
import { pullDataFromGoogleSheets, sendInspectionToGas } from './services/api';
import { useLocalStorage, useLocalStorageString } from './hooks/useLocalStorage';
import { fileToBase64 } from './services/media';
import { Header } from './components/Header';
import { ExpiryAlertBanner } from './components/ExpiryAlertBanner';
import { NotificationModal } from './components/NotificationModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { BottomBar } from './components/BottomBar';
import { OfficialReportModal } from './components/OfficialReportModal';
import { getWeekOfMonth } from './components/EmergencyChecklistReportPreview';
import { EquipmentDetailModal } from './components/EquipmentDetailModal';
import { ImageModal } from './components/ImageModal';
import { FloorMap } from './components/FloorMap';
import { UserManagement } from './components/UserManagement';
import { PasswordModal } from './components/PasswordModal';
import { DrugInventoryView } from './components/DrugInventoryView';
import { UncheckedRoomsNavigator } from './components/UncheckedRoomsNavigator';
import { SubmissionLoadingModal } from './components/SubmissionLoadingModal';
import { QuickReplaceModal } from './components/QuickReplaceModal';
import { GlobalScrollButtons } from './components/GlobalScrollButtons';
import { AccountSecurityModal } from './components/AccountSecurityModal';
import { FriendsModal } from './components/FriendsModal';
import { fetchLiveWeather, LiveWeatherData } from './services/weatherService';
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

export const ACCENT_COLORS = [
  { id: 'blue', label: 'Facebook', main: '#1877F2', hover: '#166FE5', light: 'rgba(24, 119, 242, 0.1)' },
  { id: 'cyber', label: 'Cyber Ice', main: '#00D2FF', hover: '#00B8E0', light: 'rgba(0, 210, 255, 0.1)' },
  { id: 'mint', label: 'Mint', main: '#10B981', hover: '#059669', light: 'rgba(16, 185, 129, 0.1)' },
  { id: 'iris', label: 'Deep Iris', main: '#6366F1', hover: '#4F46E5', light: 'rgba(99, 102, 241, 0.1)' },
  { id: 'rose', label: 'Soft Rose', main: '#F43F5E', hover: '#E11D48', light: 'rgba(244, 63, 94, 0.1)' },
  { id: 'slate', label: 'Slate Titanium', main: '#334155', hover: '#1E293B', light: 'rgba(51, 65, 85, 0.1)' },
];

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

const getShortGreetingMessage = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "สวัสดีตอนเช้า";
  } else if (hour >= 12 && hour < 17) {
    return "สวัสดีตอนบ่าย";
  } else if (hour >= 17 && hour < 20) {
    return "สวัสดียามเย็น";
  } else {
    return "สวัสดีตอนค่ำ";
  }
};

const getFormattedThaiDate = () => {
  const now = new Date();
  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const dayName = thaiDays[now.getDay()];
  const dateNum = now.getDate();
  const monthName = thaiMonths[now.getMonth()];
  const thaiYear = now.getFullYear() + 543;
  return `${dayName}ที่ ${dateNum} ${monthName} พ.ศ. ${thaiYear}`;
};

export default function App() {
  // Theme state backed by localStorage
  const [theme, setTheme] = useLocalStorageString(
    STORAGE_KEYS.THEME,
    INITIAL_MASTER_DATA?.settings?.theme || 'light'
  ) as [ThemeMode, (t: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => void];

  // URLs
  const [apiUrl, setApiUrl] = useLocalStorageString(
    STORAGE_KEYS.API_URL,
    INITIAL_MASTER_DATA?.settings?.apiUrl || ''
  );
  const [sheetUrl, setSheetUrl] = useLocalStorageString(
    STORAGE_KEYS.SHEET_URL,
    INITIAL_MASTER_DATA?.settings?.sheetUrl || ''
  );

  // Accent Color state
  const [accentColor, setAccentColor] = useLocalStorageString(
    STORAGE_KEYS.ACCENT_COLOR,
    'blue'
  );

  // Apply Accent Color to CSS Variables
  useEffect(() => {
    const config = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];
    const root = document.documentElement;
    root.style.setProperty('--app-accent', config.main);
    root.style.setProperty('--app-accent-hover', config.hover);
    root.style.setProperty('--app-accent-light', config.light);
  }, [accentColor]);

  // Auth & Users
  const [users, setUsers] = useLocalStorage<User[]>(
    STORAGE_KEYS.USERS,
    () => (INITIAL_MASTER_DATA?.users && Array.isArray(INITIAL_MASTER_DATA.users) ? INITIAL_MASTER_DATA.users : [])
  );
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

  // Domain Data backed by useLocalStorage (Synchronous real-time persistence)
  const [equipment, setEquipment] = useLocalStorage<Record<string, EquipmentItem[]>>(
    STORAGE_KEYS.EQ,
    () => getInitialEquipment()
  );
  const [lists, setLists] = useLocalStorage<Record<'bag' | 'cart', ListConfig>>(
    STORAGE_KEYS.CUSTOM_LISTS,
    () => getInitialLists()
  );
  const [drugs, setDrugs] = useLocalStorage<DrugItem[]>(
    STORAGE_KEYS.DRUGS,
    () => getInitialDrugs()
  );
  const [globalChecks, setGlobalChecks] = useLocalStorage<Record<string, Record<string, CheckItemState>>>(
    STORAGE_KEYS.GLOBAL_CHECKS,
    () => (INITIAL_MASTER_DATA?.globalChecks || {})
  );
  const [lastSubmitted, setLastSubmitted] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.LAST_SUBMITTED,
    () => (INITIAL_MASTER_DATA?.lastSubmitted || {})
  );
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditLogEntry[]>(
    STORAGE_KEYS.AUDIT_LOGS,
    () => getLocalAuditLogs()
  );

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [isPasswordForced, setIsPasswordForced] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalTitle, setReportModalTitle] = useState('คลินิกงานบริการผู้ป่วยในวิสัญญี');
  const [reportModalCategory, setReportModalCategory] = useState<'eq' | 'bag' | 'cart' | 'drug'>('eq');
  const [reportModalDrugSubCategory, setReportModalDrugSubCategory] = useState<'all' | 'monthly' | 'quarterly' | 'adhoc'>('monthly');
  const [reportModalRows, setReportModalRows] = useState<any[]>([]);
  const [inspectionHistory, setInspectionHistory] = useLocalStorage<InspectionHistoryRecord[]>(
    STORAGE_KEYS.HISTORY,
    () => (INITIAL_MASTER_DATA?.inspectionHistory || [])
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
  const [inspectorName, setInspectorName] = useLocalStorageString(STORAGE_KEYS.INSPECTOR, '');
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState<number>(() =>
    getWeekOfMonth(new Date().toISOString().split('T')[0])
  );
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
          const userAvatarKey = `user_avatar_${matched.username}`;
          const savedAvatar = getStoredString(userAvatarKey, matched.avatar || '');
          const finalMatched = savedAvatar ? { ...matched, avatar: savedAvatar } : matched;
          setCurrentUser(finalMatched);
          if (!inspectorName) {
            setInspectorName(finalMatched.name);
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
      if (
        serverData.lists &&
        serverData.lists.bag?.groups &&
        Object.keys(serverData.lists.bag.groups).length > 0
      ) {
        setLists(serverData.lists);
        setStored(STORAGE_KEYS.CUSTOM_LISTS, serverData.lists);
      }
      if (serverData.equipment && Object.keys(serverData.equipment).length > 0) {
        setEquipment(serverData.equipment);
        setStored(STORAGE_KEYS.EQ, serverData.equipment);
      }
      if (Array.isArray(serverData.drugs) && serverData.drugs.length > 0) {
        setDrugs(serverData.drugs);
        setStored(STORAGE_KEYS.DRUGS, serverData.drugs);
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

      // If server was completely empty or missing master modules, seed the server from local state:
      if (!serverData.apiUrl || !serverData.lists || !serverData.equipment || !serverData.drugs) {
        await pushServerSync({
          apiUrl: currentApi,
          sheetUrl: currentSheet,
          theme,
          users: getStored<User[]>(STORAGE_KEYS.USERS, users),
          equipment,
          lists,
          drugs,
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
    // Initial sync with server if available
    syncWithServer();

    // Subscribe to Firebase Cloud Firestore in real-time
    const unsubFirebaseHistory = subscribeInspectionHistory((records) => {
      if (records) {
        setInspectionHistory(records);
        setStored('inspection_history', records);
      }
    });

    const unsubFirebaseAudit = subscribeAuditLogs((logs) => {
      if (logs) {
        setAuditLogs(logs);
        setStored(STORAGE_KEYS.AUDIT_LOGS, logs);
      }
    });

    return () => {
      unsubFirebaseHistory();
      unsubFirebaseAudit();
    };
  }, []);

  // Fetch real-time live weather data
  useEffect(() => {
    let isMounted = true;
    async function loadRealTimeWeather() {
      const data = await fetchLiveWeather();
      if (isMounted) setWeather(data);
    }
    loadRealTimeWeather();
    // Refresh live weather every 10 minutes
    const weatherTimer = setInterval(loadRealTimeWeather, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(weatherTimer);
    };
  }, []);

  // Update current time every second (Real-time clock)
  useEffect(() => {
    const timeTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timeTimer);
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

  // Sync equipment, lists, drugs, checks to storage
  useEffect(() => {
    setStored(STORAGE_KEYS.EQ, equipment);
  }, [equipment]);

  useEffect(() => {
    setStored(STORAGE_KEYS.CUSTOM_LISTS, lists);
  }, [lists]);

  useEffect(() => {
    setStored(STORAGE_KEYS.DRUGS, drugs);
  }, [drugs]);

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
        drugs,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [globalChecks, lastSubmitted, equipment, lists, drugs]);

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

    const userAvatarKey = `user_avatar_${target.username}`;
    const savedAvatar = getStoredString(userAvatarKey, target.avatar || '');
    const finalTarget = savedAvatar ? { ...target, avatar: savedAvatar } : target;

    setCurrentUser(finalTarget);
    setStoredString(STORAGE_KEYS.SESSION, target.username);
    setInspectorName(finalTarget.name);
    setStoredString(STORAGE_KEYS.INSPECTOR, finalTarget.name);

    // Audit log
    const entry = addAuditLog(
      finalTarget,
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
    try {
      const userAvatarKey = `user_avatar_${currentUser.username}`;
      setStoredString(userAvatarKey, newAvatar);
    } catch (e) {}
    const updated = updateUserAvatar(currentUser.id, newAvatar);
    const finalUser = { ...(updated || currentUser), avatar: newAvatar };
    setCurrentUser(finalUser);
    const updatedList = users.map((u) => (u.id === finalUser.id ? finalUser : u));
    setUsers(updatedList);
    setStored(STORAGE_KEYS.USERS, updatedList);
    pushServerSync({ users: updatedList });
    syncUsersToFirebase(updatedList);
    const entry = addAuditLog(
      finalUser,
      'อัปเดตรูปโปรไฟล์',
      newAvatar ? 'เปลี่ยนรูปโปรไฟล์ใหม่' : 'ลบรูปโปรไฟล์ออก',
      'ระบบหลัก',
      apiUrl
    );
    setAuditLogs([entry, ...auditLogs]);
  };

  const handleUpdateSignature = (newSignature: string) => {
    if (!currentUser) return;
    try {
      localStorage.setItem(`user_signature_${currentUser.id}`, newSignature);
      localStorage.setItem('user_signature_default', newSignature);
    } catch (e) {}
    const finalUser = { ...currentUser, signature: newSignature };
    setCurrentUser(finalUser);
    const updatedList = users.map((u) => (u.id === finalUser.id ? finalUser : u));
    setUsers(updatedList);
    setStored(STORAGE_KEYS.USERS, updatedList);
    pushServerSync({ users: updatedList });
    syncUsersToFirebase(updatedList);
  };

  const handleUpdatePosition = (newPosition: string) => {
    if (!currentUser) return;
    try {
      localStorage.setItem(`user_position_${currentUser.id}`, newPosition);
    } catch (e) {}
    const finalUser = { ...currentUser, position: newPosition };
    setCurrentUser(finalUser);
    const updatedList = users.map((u) => (u.id === finalUser.id ? finalUser : u));
    setUsers(updatedList);
    setStored(STORAGE_KEYS.USERS, updatedList);
    pushServerSync({ users: updatedList });
    syncUsersToFirebase(updatedList);
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
    itemName: string,
    defaultVal?: string
  ) => {
    setGlobalChecks((prev) => {
      const currentContext = prev[contextKey] || {};
      const existing = currentContext[itemKey] || { result: '' as const };
      const nextResult: 'ปกติ' | 'ผิดปกติ' | '' = existing.result === resultVal ? '' : resultVal;

      const nextVal =
        nextResult === 'ปกติ'
          ? (existing.val && existing.val !== '✗' ? existing.val : (defaultVal || '✓'))
          : nextResult === 'ผิดปกติ'
          ? '✗'
          : '';

      const existingWeekVals = (existing as any).weekVals || {};
      const updatedContext: Record<string, any> = {
        ...currentContext,
        [itemKey]: {
          ...existing,
          result: nextResult,
          val: nextVal,
          weekVals: {
            ...existingWeekVals,
            [selectedWeek]: nextVal,
          },
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

  // Update custom value/count/pressure for check item
  const handleUpdateCheckValue = (
    contextKey: string,
    itemKey: string,
    value: string
  ) => {
    setGlobalChecks((prev) => {
      const currentContext = prev[contextKey] || {};
      const existing = currentContext[itemKey] || { result: '' as const };
      const nextResult: 'ปกติ' | 'ผิดปกติ' | '' = value.trim() ? (existing.result || 'ปกติ') : '';

      const existingWeekVals = (existing as any).weekVals || {};
      const updatedContext: Record<string, any> = {
        ...currentContext,
        [itemKey]: {
          ...existing,
          result: nextResult,
          val: value,
          weekVals: {
            ...existingWeekVals,
            [selectedWeek]: value,
          },
        },
      };

      const newGlobalChecks = {
        ...prev,
        [contextKey]: updatedContext,
      };

      setStored(STORAGE_KEYS.GLOBAL_CHECKS, newGlobalChecks);

      pushServerSync({
        globalChecks: newGlobalChecks,
      }).catch(() => {});

      return newGlobalChecks;
    });
  };

  // Batch check all normal for Bag or Cart
  const handleBatchCheckAllNormal = (catKey: 'bag' | 'cart') => {
    const cfg = lists[catKey];
    if (!cfg) return;
    setGlobalChecks((prev) => {
      const currentContext = { ...(prev[catKey] || {}) };
      Object.entries(cfg.groups).forEach(([gName, items]) => {
        items.forEach((item) => {
          const itemKey = `${catKey}|${item.name}|${item.code || ''}`;
          const existing = currentContext[itemKey] || { result: '' as const };
          const standardQty = item.qty || '✓';
          const existingWeekVals = (existing as any).weekVals || {};
          currentContext[itemKey] = {
            ...existing,
            result: 'ปกติ',
            val: standardQty,
            weekVals: {
              ...existingWeekVals,
              [selectedWeek]: standardQty,
            },
          };
        });
      });
      const newGlobalChecks = {
        ...prev,
        [catKey]: currentContext,
      };
      setStored(STORAGE_KEYS.GLOBAL_CHECKS, newGlobalChecks);
      pushServerSync({ globalChecks: newGlobalChecks }).catch(() => {});
      return newGlobalChecks;
    });

    const label = catKey === 'bag' ? 'กระเป๋า Emergency' : 'รถ Emergency';
    setResetToast(`✓ ติ๊กเช็คปกติครบทุกรายการใน ${label} (สัปดาห์ที่ ${selectedWeek}) เรียบร้อยแล้ว`);
    setTimeout(() => setResetToast(''), 3500);
  };

  // Batch check all normal for a specific room (Equipment)
  const handleBatchCheckRoomNormal = (roomId: string) => {
    const items = equipment[roomId] || [];
    if (items.length === 0) return;
    setGlobalChecks((prev) => {
      const currentContext = { ...(prev[roomId] || {}) };
      const roomObj = ROOMS.find((r) => r.id === roomId);
      const roomName = roomObj?.n || roomId;
      items.forEach((item) => {
        const itemKey = `${roomName}|${item.name}|${item.code || ''}`;
        const existing = currentContext[itemKey] || { result: '' as const };
        currentContext[itemKey] = {
          ...existing,
          result: 'ปกติ',
          val: 'ใช้งานได้',
        };
      });
      const newGlobalChecks = {
        ...prev,
        [roomId]: currentContext,
      };
      setStored(STORAGE_KEYS.GLOBAL_CHECKS, newGlobalChecks);
      pushServerSync({ globalChecks: newGlobalChecks }).catch(() => {});
      return newGlobalChecks;
    });
    setResetToast(`✓ ติ๊กเช็คปกติครบทุกรายการในห้องนี้เรียบร้อยแล้ว`);
    setTimeout(() => setResetToast(''), 3500);
  };

  // Update item note
  const handleUpdateItemNote = (contextKey: string, itemKey: string, noteText: string) => {
    const currentContext = globalChecks[contextKey] || {};
    const existing = currentContext[itemKey] || { result: '' as const };
    const updatedContext: Record<string, { result: 'ปกติ' | 'ผิดปกติ' | ''; note?: string; val?: string }> = {
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
    setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
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
      setStored(STORAGE_KEYS.EQ, updated);
      pushServerSync({ equipment: updated }).catch(() => {});

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

      const nextLists = {
        ...lists,
        [category]: updatedCategory,
      };

      setLists(nextLists);
      setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
      pushServerSync({ lists: nextLists }).catch(() => {});

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

  // Convert attached media file to compressed Base64 string for persistent storage
  const handleNewItemImageUpload = async (file: File) => {
    try {
      const base64 = await fileToBase64(file, { maxWidth: 900, maxHeight: 900, quality: 0.85 });
      setNewItemImg(base64);
    } catch (e) {
      console.error('Failed to convert image to Base64:', e);
      alert('ไม่สามารถโหลดรูปภาพได้ กรุณาตรวจสอบไฟล์รูปภาพ');
    }
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
      const nextEq = {
        ...equipment,
        [roomId]: updated,
      };
      setEquipment(nextEq);
      setStored(STORAGE_KEYS.EQ, nextEq);
      pushServerSync({ equipment: nextEq }).catch(() => {});

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
      const nextLists = {
        ...lists,
        [cat]: updatedList,
      };
      setLists(nextLists);
      setStored(STORAGE_KEYS.CUSTOM_LISTS, nextLists);
      pushServerSync({ lists: nextLists }).catch(() => {});

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
    setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);

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

  // Restore full system backup handler
  const handleRestoreBackup = (backup: any) => {
    if (!backup || typeof backup !== 'object') return;

    if (backup.settings) {
      if (backup.settings.apiUrl !== undefined) {
        setApiUrl(backup.settings.apiUrl);
        setStoredString(STORAGE_KEYS.API_URL, backup.settings.apiUrl);
      }
      if (backup.settings.sheetUrl !== undefined) {
        setSheetUrl(backup.settings.sheetUrl);
        setStoredString(STORAGE_KEYS.SHEET_URL, backup.settings.sheetUrl);
      }
      if (backup.settings.theme !== undefined) {
        setTheme(backup.settings.theme);
        setStoredString(STORAGE_KEYS.THEME, backup.settings.theme);
      }
      if (backup.settings.inspectorName !== undefined) {
        setInspectorName(backup.settings.inspectorName);
        setStoredString(STORAGE_KEYS.INSPECTOR, backup.settings.inspectorName);
      }
    }

    if (Array.isArray(backup.users) && backup.users.length > 0) {
      setUsers(backup.users);
      setStored(STORAGE_KEYS.USERS, backup.users);
    }

    if (backup.equipment && typeof backup.equipment === 'object') {
      setEquipment(backup.equipment);
      setStored(STORAGE_KEYS.EQ, backup.equipment);
    }

    if (backup.lists && typeof backup.lists === 'object') {
      setLists(backup.lists);
      setStored(STORAGE_KEYS.CUSTOM_LISTS, backup.lists);
    }

    if (Array.isArray(backup.drugs) && backup.drugs.length > 0) {
      setDrugs(backup.drugs);
      setStored(STORAGE_KEYS.DRUGS, backup.drugs);
    }

    if (backup.globalChecks && typeof backup.globalChecks === 'object') {
      setGlobalChecks(backup.globalChecks);
      setStored(STORAGE_KEYS.GLOBAL_CHECKS, backup.globalChecks);
    }

    if (backup.lastSubmitted && typeof backup.lastSubmitted === 'object') {
      setLastSubmitted(backup.lastSubmitted);
      setStored(STORAGE_KEYS.LAST_SUBMITTED, backup.lastSubmitted);
    }

    if (Array.isArray(backup.inspectionHistory)) {
      setInspectionHistory(backup.inspectionHistory);
      setStored(STORAGE_KEYS.HISTORY, backup.inspectionHistory);
    }

    if (Array.isArray(backup.auditLogs)) {
      setAuditLogs(backup.auditLogs);
      setStored(STORAGE_KEYS.AUDIT_LOGS, backup.auditLogs);
    }

    const logEntry = addAuditLog(
      currentUser,
      'ตั้งค่าระบบ',
      'กู้คืนข้อมูลระบบทั้งหมดจากไฟล์สำรอง JSON (Restore Complete Backup)',
      'ระบบหลัก',
      apiUrl
    );
    setAuditLogs((prev) => [logEntry, ...prev]);

    // Push restored state to server sync
    pushServerSync({
      apiUrl: backup.settings?.apiUrl || apiUrl,
      sheetUrl: backup.settings?.sheetUrl || sheetUrl,
      theme: backup.settings?.theme || theme,
      users: backup.users || users,
      equipment: backup.equipment || equipment,
      lists: backup.lists || lists,
      drugs: backup.drugs || drugs,
      globalChecks: backup.globalChecks || globalChecks,
      lastSubmitted: backup.lastSubmitted || lastSubmitted,
      inspectionHistory: backup.inspectionHistory || inspectionHistory,
      auditLogs: backup.auditLogs || auditLogs,
    }).catch(() => {});
  };

  // Bi-directional Google Sheets sync: Pull master data from Google Sheets into local state & storage
  const handlePullFromGoogleSheets = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await pullDataFromGoogleSheets(apiUrl, sheetUrl);
      if (!res.success) {
        return { success: false, message: res.message };
      }

      let count = 0;
      if (res.equipment && Object.keys(res.equipment).length > 0) {
        setEquipment(res.equipment);
        setStored(STORAGE_KEYS.EQ, res.equipment);
        count++;
      }

      if (res.lists && res.lists.bag?.groups) {
        setLists(res.lists);
        setStored(STORAGE_KEYS.CUSTOM_LISTS, res.lists);
        count++;
      }

      if (Array.isArray(res.drugs) && res.drugs.length > 0) {
        setDrugs(res.drugs);
        setStored(STORAGE_KEYS.DRUGS, res.drugs);
        count++;
      }

      if (Array.isArray(res.users) && res.users.length > 0) {
        setUsers(res.users);
        setStored(STORAGE_KEYS.USERS, res.users);
        count++;
      }

      const logEntry = addAuditLog(
        currentUser,
        'ตั้งค่าระบบ',
        'ดึงข้อมูลและอัปเดต Master Data จาก Google Sheets เรียบร้อยแล้ว',
        'ระบบหลัก',
        apiUrl
      );
      setAuditLogs((prev) => [logEntry, ...prev]);

      return {
        success: true,
        message: res.message || 'ซิงค์ข้อมูลจาก Google Sheets ลงระบบสำเร็จ',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets',
      };
    }
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
        const weekVals = (ch as any).weekVals || {};
        const currentWkVal = weekVals[selectedWeek] !== undefined ? weekVals[selectedWeek] : ch.val;
        const statusText =
          ch.result === 'ปกติ' || (currentWkVal && currentWkVal !== '✗')
            ? 'ใช้งานได้'
            : ch.result === 'ผิดปกติ' || currentWkVal === '✗'
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
          exp: o.exp || '',
          group: gName,
          val: currentWkVal || (ch.result === 'ปกติ' ? (o.qty || '✓') : ch.result === 'ผิดปกติ' ? '✗' : ''),
          weekVals: {
            ...weekVals,
            [selectedWeek]: currentWkVal || (ch.result === 'ปกติ' ? (o.qty || '✓') : ch.result === 'ผิดปกติ' ? '✗' : '-'),
          },
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

    // If successfully sent and it was a 100% full completion, celebrate!
    if (res.success) {
      const isFull = 
        (type === 'eq' && hospitalPct === 100) ||
        (type === 'bag' && bagPct === 100) ||
        (type === 'cart' && cartPct === 100);
      
      if (isFull) celebrateCompletion();
    }

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
      alert('ยังไม่ได้ระบุลิ้งค์ Google Sheet\nกรุณาวาง URL ของ Google Sheet ในช่อง "การตั้งค่า" เพื่อเปิดใช้งานปุ่มนี้');
    }
  };

  const handleDeleteHistoryRecord = async (recordId: string) => {
    const target = inspectionHistory.find((h) => h.id === recordId);
    const next = inspectionHistory.filter((h) => h.id !== recordId);
    setInspectionHistory(next);
    setStored('inspection_history', next);
    try {
      await deleteInspectionFromFirebase(recordId);
    } catch (e) {
      console.warn('Failed to delete inspection from Firebase:', e);
    }
    if (target) {
      const entry = addAuditLog(
        currentUser,
        'ลบรายการ',
        `ลบประวัติการตรวจรอบ "${target.title}" วันที่ ${target.date || target.timestamp}`,
        target.title,
        apiUrl
      );
      setAuditLogs([entry, ...auditLogs]);
      addAuditLogToFirebase(entry);
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

  const celebrateCompletion = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ACCENT_COLORS.map(c => c.main)
    });
    setResetToast('ตรวจเช็คเรียบร้อยแล้ว! 👏');
    setTimeout(() => setResetToast(''), 3000);
  };

  // Atmospheric Style computed based on time
  const atmosphere = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return {
        gradient: 'from-[#ffafbd] via-[#ffc3a0] to-[#ffafbd] dark:from-[#3a2d2d] dark:via-[#4a3b32] dark:to-[#3a2d2d]',
        animation: 'animate-sunrise',
        label: 'รับอรุณ / Sunrise'
      };
    }
    if (hour >= 12 && hour < 18) {
      return {
        gradient: 'from-[#2193b0] via-[#6dd5ed] to-[#2193b0] dark:from-[#1a2a3a] dark:via-[#1e3a4a] dark:to-[#1a2a3a]',
        animation: 'animate-drift-clouds',
        label: 'กลางวัน / Daylight'
      };
    }
    if (hour >= 18 && hour < 20) {
      return {
        gradient: 'from-[#834d9b] via-[#d04ed6] to-[#834d9b] dark:from-[#2d1b3d] dark:via-[#3d224d] dark:to-[#2d1b3d]',
        animation: 'animate-twilight',
        label: 'พลบค่ำ / Twilight'
      };
    }
    return {
      gradient: 'from-[#0f2027] via-[#203a43] to-[#2c5364] dark:from-[#050b10] dark:via-[#0a151d] dark:to-[#050b10]',
      animation: 'animate-twinkle',
      label: 'ราตรี / Midnight'
    };
  }, [currentTime]);

  // If not logged in, render clean modern login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-accent border border-white/20 flex items-center justify-center text-white mx-auto shadow-lg shadow-accent/25 text-2xl font-bold mb-3">
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
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold shadow-md shadow-accent/20 transition active:scale-95 disabled:opacity-50 text-xs flex items-center justify-center gap-2"
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
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setStoredString(STORAGE_KEYS.THEME, nextTheme);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 pb-28 transition-colors duration-200">
      {/* Header with auto-hide */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGoHome={() => {
          setCurrentView('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        isVisible={isNavVisible}
        unreadCount={
          currentUser?.role === 'admin'
            ? expiredCount + warningCount + auditLogs.length
            : expiredCount + warningCount
        }
        // New props for integrated drawer sub-views
        apiUrl={apiUrl}
        sheetUrl={sheetUrl}
        accentColor={accentColor}
        onSetAccentColor={(color) => setAccentColor(color)}
        onSaveSettings={(newApi, newSheet, newTheme) => {
          setApiUrl(newApi);
          setSheetUrl(newSheet);
          setTheme(newTheme);
          setStoredString(STORAGE_KEYS.API_URL, newApi);
          setStoredString(STORAGE_KEYS.SHEET_URL, newSheet);
          setStoredString(STORAGE_KEYS.THEME, newTheme);
          saveSettingsToFirebase({ sheetUrl: newSheet, theme: newTheme });
        }}
        onManualSync={syncWithServer}
        onPullFromGoogleSheets={async () => {
          try {
            const res = await pullDataFromGoogleSheets(apiUrl, sheetUrl);
            if (res.success) {
              if (res.equipment) setEquipment(res.equipment);
              if (res.drugs) setDrugs(res.drugs);
              if (res.lists) setLists(res.lists);
              return { success: true, message: 'ดึงข้อมูลสำเร็จ' };
            }
            return { success: false, message: res.message || 'ดึงข้อมูลไม่สำเร็จ' };
          } catch (e: any) {
            return { success: false, message: e.message || 'เกิดข้อผิดพลาด' };
          }
        }}
        onChangePasswordSubmit={handleChangeOwnPassword}
        onRestoreBackup={(data) => {
          // Update all React states to reflect the restored data immediately
          if (data.users) setUsers(data.users);
          if (data.drugs) setDrugs(data.drugs);
          if (data.equipment) setEquipment(data.equipment);
          if (data.lists) setLists(data.lists);
          if (data.globalChecks) setGlobalChecks(data.globalChecks);
          if (data.lastSubmitted) setLastSubmitted(data.lastSubmitted);
          if (data.inspectionHistory) setInspectionHistory(data.inspectionHistory);
          if (data.auditLogs) setAuditLogs(data.auditLogs);
          if (data.settings) {
            if (data.settings.apiUrl) setApiUrl(data.settings.apiUrl);
            if (data.settings.sheetUrl) setSheetUrl(data.settings.sheetUrl);
            if (data.settings.theme) setTheme(data.settings.theme);
            if (data.settings.inspectorName) setInspectorName(data.settings.inspectorName);
          }
          
          // Re-sync with Firebase if necessary
          if (data.users) syncUsersToFirebase(data.users);
        }}
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
            <div className="flex items-center gap-1.5 shrink-0 text-accent font-bold text-xs">
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
              className="bg-accent h-full rounded-full transition-all duration-300"
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
      <main className="max-w-4xl mx-auto px-4 pt-3 transition-all duration-300">
        {/* View Routing */}
        <div key={currentView} className="animate-in fade-in duration-300 transition-all">
        {currentView === 'home' && (
          <div className="space-y-3">
            {/* Dynamic Atmosphere Header Card */}
            <div
              style={{
                backgroundSize: '200% 200%',
                animation: 'ambientGlow 8s ease infinite',
              }}
              className={`bg-gradient-to-br ${atmosphere.gradient} text-white rounded-3xl p-5 shadow-lg border border-white/20 dark:border-neutral-700 relative overflow-hidden transition-all duration-700`}
            >
              {/* Floating Ambient Blobs */}
              <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-white/20 blur-2xl pointer-events-none animate-float-molecule" />
              <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-amber-300/20 blur-2xl pointer-events-none animate-float-molecule [animation-delay:2s]" />

              {/* Animation Layer */}
              <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-3xl z-0 opacity-40 ${atmosphere.animation}`} />

              {/* Extra Sparkles for Night */}
              {new Date().getHours() >= 20 || new Date().getHours() < 6 ? (
                <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
                  <div className="absolute top-4 left-10 w-1 h-1 bg-white rounded-full animate-twinkle" />
                  <div className="absolute top-12 right-20 w-1 h-1 bg-white rounded-full animate-twinkle [animation-delay:1s]" />
                  <div className="absolute bottom-10 left-1/2 w-1 h-1 bg-white rounded-full animate-twinkle [animation-delay:1.5s]" />
                </div>
              ) : null}

              {/* Content Layer */}
              <div className="relative z-10 flex items-center justify-between gap-4 w-full">
                {/* Left: Temp & Date */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-5xl font-bold tracking-tighter drop-shadow-sm">
                    {weather ? `${weather.temp}°` : '29°'}
                  </div>
                  <div className="text-sm font-medium text-white/90 drop-shadow-sm">
                    {getFormattedThaiDate()}
                  </div>
                </div>

                {/* Right: Icon, Condition & Time */}
                <div className="flex flex-col items-end gap-1">
                  <div className="text-4xl filter drop-shadow-md animate-bounce duration-1000">
                    {weather ? weather.icon3D : '☀️'}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                    {atmosphere.label}
                  </div>
                  <div className="text-xs font-mono text-white/70">
                    {currentTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Urgent Expiration Alert Banner - ONLY shown on Home */}
            <ExpiryAlertBanner
              alerts={expiryAlerts}
              onOpenAlertDetails={() => setIsNotificationsOpen(true)}
            />

            {/* Menu Cards (Facebook Feed Clean Style) */}
            <div className="space-y-2.5">
              {/* Drug Inventory Card */}
              <button
                onClick={() => setCurrentView('drug_check')}
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.08))',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  backgroundSize: '200% 200%',
                  animation: 'ambientGlow 8s ease infinite',
                }}
                className="relative overflow-hidden w-full text-left p-4 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 hover:opacity-95 rounded-2xl shadow-[0_8px_30px_rgba(59,130,246,0.08)] flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-95 duration-150"
              >
                <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-cyan-400/20 filter blur-xl pointer-events-none animate-float-molecule" />
                <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center text-xl shrink-0 group-hover:scale-110 active:scale-95 transition-transform duration-200 shadow-md">
                    💊
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                      ระบบตรวจเช็คคลังยาและสารน้ำ
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      จัดการคลังยา, สารน้ำ, และวันหมดอายุ
                    </p>
                  </div>
                </div>
              </button>

              {/* Equipment Card */}
              <button
                onClick={() => setCurrentView('eq_overview')}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  backgroundSize: '200% 200%',
                  animation: 'ambientGlow 8s ease infinite',
                }}
                className="relative overflow-hidden w-full text-left p-4 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 hover:opacity-95 rounded-2xl shadow-[0_8px_30px_rgba(99,102,241,0.08)] flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-95 duration-150"
              >
                <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-purple-400/20 filter blur-xl pointer-events-none animate-float-molecule [animation-delay:1s]" />
                <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shrink-0 group-hover:scale-110 active:scale-95 transition-transform duration-200 shadow-md">
                    🏥
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                      เช็คครุภัณฑ์วิสัญญี / ห้องผ่าตัด
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      ตรวจสอบความพร้อมอุปกรณ์ห้อง OR
                    </p>
                  </div>
                </div>
              </button>

              {/* Emergency Bag Card */}
              <button
                onClick={() => setCurrentView('bag_check')}
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(249, 115, 22, 0.08))',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  backgroundSize: '200% 200%',
                  animation: 'ambientGlow 8s ease infinite',
                }}
                className="relative overflow-hidden w-full text-left p-4 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 hover:opacity-95 rounded-2xl shadow-[0_8px_30px_rgba(245,158,11,0.08)] flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-95 duration-150"
              >
                <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-amber-400/20 filter blur-xl pointer-events-none animate-float-molecule [animation-delay:2s]" />
                <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 group-hover:scale-110 active:scale-95 transition-transform duration-200 shadow-md">
                    💼
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                        เช็คกระเป๋าอีเมอร์เจนซี่
                      </h3>
                      {expiryAlerts.filter((a) => a.category === 'bag').length > 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 animate-ping" title="มีรายการใกล้/หมดอายุ" />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      ตรวจสอบกระเป๋าฉุกเฉินและยาสำคัญ
                    </p>
                  </div>
                </div>
              </button>

              {/* Emergency Cart Card */}
              <button
                onClick={() => setCurrentView('cart_check')}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(20, 184, 166, 0.08))',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  backgroundSize: '200% 200%',
                  animation: 'ambientGlow 8s ease infinite',
                }}
                className="relative overflow-hidden w-full text-left p-4 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 hover:opacity-95 rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.08)] flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-95 duration-150"
              >
                <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-400/20 filter blur-xl pointer-events-none animate-float-molecule [animation-delay:3s]" />
                <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 group-hover:scale-110 active:scale-95 transition-transform duration-200 shadow-md">
                    🛒
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                        เช็ครถอีเมอร์เจนซี่
                      </h3>
                      {expiryAlerts.filter((a) => a.category === 'cart').length > 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 animate-ping" title="มีรายการใกล้/หมดอายุ" />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      ตรวจสอบรถเข็นช่วยชีวิตฉุกเฉิน
                    </p>
                  </div>
                </div>
              </button>

              {/* Manage Users Card - ONLY shown if Admin */}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('users')}
                  className="w-full text-left p-3.5 sm:p-4 bg-white dark:bg-[#242526] hover:bg-[#f2f3f5] dark:hover:bg-[#323436] rounded-2xl border border-[#e4e6eb] dark:border-[#3a3b3c] shadow-xs flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                      👥
                    </div>
                    <h3 className="text-sm font-bold text-[#050505] dark:text-[#e4e6eb] leading-normal truncate">
                      จัดการผู้ใช้งาน & กำหนดสิทธิ์
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-[#65676b] dark:text-[#b0b3b8] px-2.5 py-1 rounded-full bg-[#f0f2f5] dark:bg-[#3a3b3c] shrink-0 whitespace-nowrap">
                    {users.length} บัญชี
                  </span>
                </button>
              )}
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
                <span className="text-accent font-extrabold whitespace-nowrap">
                  {hospitalPct}% ({hospitalCheckedItems}/{hospitalTotalItems} รายการ)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="bg-accent h-full rounded-full transition-all duration-300"
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
                  className={`px-3 py-1 rounded-lg transition active:scale-95 ${
                    eqMode === 'explore'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  📋 สำรวจ / แก้ไข
                </button>
                <button
                  onClick={() => setEqMode('check')}
                  className={`px-3 py-1 rounded-lg transition active:scale-95 ${
                    eqMode === 'check'
                      ? 'bg-accent text-white shadow-xs'
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
                  <span className="text-accent">{roomPct}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-300"
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
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 transition active:scale-95"
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
                        if (e.target.files?.[0]) handleNewItemImageUpload(e.target.files[0]);
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
                  className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] text-xs whitespace-nowrap leading-normal"
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

                  {/* Weekly Selection & Batch Check Toolbar (Facebook Clean UI) */}
                  <div className="p-3.5 bg-white dark:bg-[#242526] rounded-2xl border border-[#e4e6eb] dark:border-[#3a3b3c] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                      <span className="text-xs font-semibold text-[#65676b] dark:text-[#b0b3b8] flex items-center gap-1 mr-1">
                        <Calendar className="w-3.5 h-3.5 text-[#1877f2]" />
                        <span>สัปดาห์ที่ตรวจ:</span>
                      </span>
                      {[1, 2, 3, 4, 5].map((wk) => (
                        <button
                          key={wk}
                          onClick={() => setSelectedWeek(wk)}
                          className={`px-3.5 py-2 min-h-[36px] rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap leading-normal ${
                            selectedWeek === wk
                              ? 'bg-[#1877f2] text-white shadow-xs'
                              : 'bg-[#f0f2f5] dark:bg-[#3a3b3c] text-[#65676b] dark:text-[#b0b3b8] hover:bg-[#e4e6eb] dark:hover:bg-[#4e4f50]'
                          }`}
                        >
                          สัปดาห์ที่ {wk}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleBatchCheckAllNormal(categoryKey)}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[40px] rounded-xl bg-[#00a400] hover:bg-[#008a00] text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs shrink-0 whitespace-nowrap leading-normal active:scale-95"
                      title="เติมค่ามาตรฐานและสถานะปกติให้ทุกรายการในสัปดาห์ที่เลือกอัตโนมัติ"
                    >
                      <span>✅ ติ๊กปกติทั้งหมด (สัปดาห์ที่ {selectedWeek})</span>
                    </button>
                  </div>

                  {/* Expiration Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="text-[#65676b] dark:text-[#b0b3b8] flex items-center gap-1 shrink-0 text-[11px] mr-1">
                      <Filter className="w-3 h-3" />
                      กรอง:
                    </span>
                    <button
                      onClick={() => setExpFilter('all')}
                      className={`px-3.5 py-1.5 min-h-[32px] rounded-xl font-medium shrink-0 transition cursor-pointer whitespace-nowrap leading-normal ${
                        expFilter === 'all'
                          ? 'bg-[#1877f2] text-white font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#242526] text-[#65676b] dark:text-[#b0b3b8] border border-[#e4e6eb] dark:border-[#3a3b3c] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c]'
                      }`}
                    >
                      ทั้งหมด ({catTotal})
                    </button>
                    <button
                      onClick={() => setExpFilter('expired')}
                      className={`px-3.5 py-1.5 min-h-[32px] rounded-xl font-medium shrink-0 transition cursor-pointer whitespace-nowrap leading-normal ${
                        expFilter === 'expired'
                          ? 'bg-[#e41e3f] text-white font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#242526] text-[#e41e3f] border border-rose-200 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                      }`}
                    >
                      หมดอายุแล้ว
                    </button>
                    <button
                      onClick={() => setExpFilter('warning')}
                      className={`px-3.5 py-1.5 min-h-[32px] rounded-xl font-medium shrink-0 transition cursor-pointer whitespace-nowrap leading-normal ${
                        expFilter === 'warning'
                          ? 'bg-amber-600 text-white font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#242526] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-950 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                      }`}
                    >
                      ใกล้หมดอายุ (&le; 30 วัน)
                    </button>
                    <button
                      onClick={() => setExpFilter('good')}
                      className={`px-3.5 py-1.5 min-h-[32px] rounded-xl font-medium shrink-0 transition cursor-pointer whitespace-nowrap leading-normal ${
                        expFilter === 'good'
                          ? 'bg-[#00a400] text-white font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#242526] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
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
                              <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-dashed border-neutral-300 dark:border-neutral-700 cursor-pointer text-neutral-600 dark:text-neutral-300 text-xs">
                                <Image className="w-3.5 h-3.5" />
                                <span>{newItemImg ? 'แนบรูปถ่ายแล้ว' : 'แนบรูปภาพ (ถ้ามี)'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleNewItemImageUpload(e.target.files[0]);
                                  }}
                                />
                              </label>
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
                                className="px-4 py-1 rounded-xl bg-neutral-900 text-white dark:bg-slate-800 dark:text-white font-semibold text-xs cursor-pointer"
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
                                  {item.img && (
                                    <img
                                      src={item.img}
                                      alt={item.name}
                                      onClick={() => setZoomedImageUrl(item.img!)}
                                      className="w-10 h-10 rounded-xl object-cover shrink-0 cursor-pointer border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                                      title="แตะดูภาพใหญ่"
                                    />
                                  )}
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

                                  {/* Minimalist Check Buttons & Custom Reading Input */}
                                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={currentCheck.val !== undefined ? currentCheck.val : ''}
                                        onChange={(e) =>
                                          handleUpdateCheckValue(categoryKey, itemKey, e.target.value)
                                        }
                                        placeholder={item.qty ? `${item.qty}` : 'ระบุค่า/จำนวน'}
                                        className="w-24 sm:w-28 h-8 px-2 text-xs rounded-xl font-medium text-center bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-2xs"
                                        title="ระบุจำนวนคงเหลือหรือค่าที่วัดได้จริง (เช่น 1, 2, 1400/1700 PSI หรือ ✓)"
                                      />
                                    </div>

                                    <button
                                      onClick={() =>
                                        handleToggleCheck(categoryKey, itemKey, 'ปกติ', item.name, item.qty || '✓')
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
                        className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] text-xs whitespace-nowrap leading-normal"
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
            onCelebrate={celebrateCompletion}
            onOpenPreview={(category) => handleOpenPrintReport('drug', category)}
            drugs={drugs}
            onDrugsChange={(updatedDrugs) => {
              setDrugs(updatedDrugs);
              setStored(STORAGE_KEYS.DRUGS, updatedDrugs);
            }}
          />
        )}
        </div>
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
        sheetUrl={sheetUrl}
        isVisible={isNavVisible}
      />

      {/* Profile Modal */}
      {/* Profile Modal is currently a modal, but user wants unified slide. 
          For now I'll keep it or move it later if requested. */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        currentUser={currentUser}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateAvatar={handleUpdateAvatar}
        onUpdateSignature={handleUpdateSignature}
        onUpdatePosition={handleUpdatePosition}
        onOpenPasswordModal={() => {
          setIsPasswordForced(false);
          setIsPasswordModalOpen(true);
        }}
        onLogout={handleLogout}
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

      {/* Global Scroll-to-Top and Bottom Floating Buttons */}
      <GlobalScrollButtons />
    </div>
  );
}
