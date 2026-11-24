import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ModernDashboard } from './components/ModernDashboard';
import { BottomBar } from './components/BottomBar';
import { OfficialReportModal, OfficialReportItemRow } from './components/OfficialReportModal';
import { ImageModal } from './components/ImageModal';
import { HaAuditReportModal } from './components/HaAuditReportModal';
import { logAuditEvent } from './services/auditLogger';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { NotificationModal } from './components/NotificationModal';
import { ProfileModal } from './components/ProfileModal';
import { FloorMap } from './components/FloorMap';
import {
  SwiperInspectionCarousel,
  InspectionSlideItem,
} from './components/SwiperInspectionCarousel';
import { EmergencyChecklistView } from './components/EmergencyChecklistView';
import { DrugInventoryView } from './components/DrugInventoryView';
import { GoogleSheetsSettings } from './components/GoogleSheetsSettings';
import { GlobalScrollButtons } from './components/GlobalScrollButtons';
import { AuraAssistant } from './components/AuraAssistant';
import { ChannelSelectorModal } from './components/ChannelSelectorModal';
import { useDataContext } from './context/DataContext';
import { getRealTargetCheckValue, parseExpDateObj } from './utils/itemUtils';
import { diffDaysFromBangkokToday, getBangkokTodayIso } from './utils/dateUtils';
import { getChannelStorageKeys } from './utils/helpers';
import { useChannelSync, persistClearedFlags } from './hooks/useChannelSync';
import { useAuth } from './hooks/useAuth';
import { useAuraActions, normalizeCheckResultStatus } from './hooks/useAuraActions';
import { useScanner } from './hooks/useScanner';
export { compressImageToBase64 } from './utils/imageCompressor';

import {
  STORAGE_KEYS,
  getStored,
  setStored,
  getStoredString,
  setStoredString,
  getInitialEquipment,
  getInitialLists,
  getChannelListsKey,
  getChannelChecksKey,
  getChannelWeekDatesKey,
  getBangkokPeriodKeys,
  getStoredCyclePeriods,
  setStoredCyclePeriods,
} from './services/storage';
import { sendInspectionToGas, testGasConnection } from './services/api';
import { authorizedFetch } from './services/aiService';
import { INITIAL_DRUGS_DATA } from './constants/initialDrugs';
import { GAS_SCRIPT_V5, ROOMS } from './constants/initialData';
import {
  AuraDataSnapshot,
  CheckItemState,
  DrugItem,
  EquipmentItem,
  ExpiryAlertItem,
  ListConfig,
  User,
  InspectionHistoryRecord,
} from './types';
import {
  BriefcaseMedical,
  Truck,
  Stethoscope,
  Pill,
  LayoutGrid,
  MapPin,
  Trash2,
  X,
  FileText,
  Home,
  User as UserIcon,
  Moon,
  Sun,
  ShieldCheck,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  Plus,
  Calendar,
  Check,
  RefreshCw,
  Code,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Package,
  Database,
  GitBranch,
  HardDrive,
  Image as ImageIcon,
  Cloud,
  ArrowLeft,
} from 'lucide-react';

import {
  saveEquipmentItemToFirebase,
  deleteEquipmentItemInFirebase,
  deleteChannelEquipmentItemInFirebase,
  clearChannelEquipmentInFirebase,
  saveChannelEquipmentItemToFirebase,
  saveChannelBatchEquipmentToFirebase,
  saveChannelBatchDrugsToFirebase,
  saveChannelDataToFirebase,
  saveChannelsToFirebase,
  clearChannelDrugsInFirebase,
  saveUserToFirebase,
  saveInspectionToFirebase,
  deleteInspectionFromFirebase,
  deleteBatchInspectionsFromFirebase,
  measureFirestoreUsageClient,
  testCloudConnectivity,
  type CloudConnectivityResult,
} from './services/firebase';

export default function App() {
  const {
    channels,
    activeChannelId,
    activeChannel,
    setActiveChannelId,
    addChannel,
    removeChannel,
    renameChannel,
    reRenderData,
  } = useDataContext();

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Navigation & Theme (Persisted across reloads/reopens)
  const [currentView, setCurrentView] = useState<
    'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'eq_overview'
  >(() => {
    try {
      const saved = sessionStorage.getItem('anesthesia_active_view');
      if (
        saved === 'home' ||
        saved === 'drug_check' ||
        saved === 'room_check' ||
        saved === 'bag_check' ||
        saved === 'cart_check' ||
        saved === 'ambulance_check' ||
        saved === 'eq_overview'
      ) {
        return saved;
      }
    } catch {}
    return 'home';
  });

  // Remember Active Selected Category ('bag' by default or last inspected)
  const CATEGORY_INDEX_MAP: Record<'medicine' | 'equipment' | 'bag' | 'ambulance' | 'cart', number> = {
    medicine: 0,
    equipment: 1,
    bag: 2,
    ambulance: 3,
    cart: 4,
  };
  const [activeCategory, setActiveCategory] = useState<'medicine' | 'equipment' | 'bag' | 'ambulance' | 'cart'>(() => {
    try {
      const saved = sessionStorage.getItem('anesthesia_active_category');
      if (saved === 'medicine' || saved === 'equipment' || saved === 'bag' || saved === 'ambulance' || saved === 'cart') {
        return saved;
      }
    } catch {}
    return 'bag';
  });

  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(() => {
    try {
      const savedIdx = sessionStorage.getItem('anesthesia_active_category_index');
      if (savedIdx !== null) {
        const parsed = Number(savedIdx);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed < 5) return parsed;
      }
      const savedCat = sessionStorage.getItem('anesthesia_active_category');
      if (savedCat === 'medicine' || savedCat === 'equipment' || savedCat === 'bag' || savedCat === 'ambulance' || savedCat === 'cart') {
        return CATEGORY_INDEX_MAP[savedCat];
      }
    } catch {}
    return 2;
  });

  const setCategoryAndIndex = useCallback(
    (cat: 'medicine' | 'equipment' | 'bag' | 'ambulance' | 'cart', idx?: number) => {
      setActiveCategory(cat);
      setActiveCategoryIndex(typeof idx === 'number' && idx >= 0 && idx < 5 ? idx : CATEGORY_INDEX_MAP[cat]);
    },
    []
  );

  // Game-style centered floating toast state (auto fade-out 1.8s)
  const [gameToast, setGameToast] = useState<{ id: number; message: string } | null>(null);
  const gameToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerGameToast = useCallback((message: string) => {
    if (gameToastTimerRef.current) {
      clearTimeout(gameToastTimerRef.current);
    }
    const toastId = Date.now();
    setGameToast({ id: toastId, message });
    gameToastTimerRef.current = setTimeout(() => {
      setGameToast((prev) => (prev?.id === toastId ? null : prev));
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (gameToastTimerRef.current) {
        clearTimeout(gameToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('anesthesia_active_view', currentView);
    } catch {}
  }, [currentView]);

  useEffect(() => {
    try {
      sessionStorage.setItem('anesthesia_active_category', activeCategory);
      sessionStorage.setItem('anesthesia_active_category_index', String(activeCategoryIndex));
    } catch {}
  }, [activeCategory, activeCategoryIndex]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem('anesthesia_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch {}
    return (getStoredString(STORAGE_KEYS.THEME, 'dark') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem('anesthesia_theme', theme);
    } catch {}
    setStoredString(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zoomedImgUrl, setZoomedImgUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    label?: string;
    images?: Array<{ url: string; label?: string }>;
    currentIndex?: number;
  } | null>(null);
  const [isAuraOpen, setIsAuraOpen] = useState(false);
  const [hasUnreadAuraMessage, setHasUnreadAuraMessage] = useState(false);

  // Default Open-Access Inspector Profile (Stored locally & editable anytime)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const sessionUser = getStored<User | null>(STORAGE_KEYS.SESSION, null);
    const savedDisplayName =
      typeof window !== 'undefined'
        ? (localStorage.getItem('user_display_name') || localStorage.getItem('user_name_default'))
        : null;
    const savedPosition =
      typeof window !== 'undefined'
        ? (localStorage.getItem('user_display_position') || localStorage.getItem('user_position_default'))
        : null;

    if (sessionUser) {
      return {
        ...sessionUser,
        name: savedDisplayName || sessionUser.name || 'เจ้าหน้าที่วิสัญญี',
        position: savedPosition || sessionUser.position || 'พยาบาลวิสัญญี',
      };
    }

    return {
      id: 'usr_staff_default',
      username: 'staff',
      name: savedDisplayName || 'เจ้าหน้าที่วิสัญญี',
      role: 'user',
      position: savedPosition || 'พยาบาลวิสัญญี',
      active: true,
      must: false,
      created: new Date().toISOString(),
      last: new Date().toISOString(),
    };
  });

  const {
    firebaseUser,
    authReady,
    isAuthenticated,
    isAdmin,
    authLoading,
    authError,
    signInWithGoogle,
    signOut,
  } = useAuth((syncedUser) => {
    setCurrentUser((prev) => ({
      ...prev,
      ...syncedUser,
    }));
  });

  // Listen for real-time user profile updates across components
  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setCurrentUser((prev) => {
          if (!prev) return detail;
          return {
            ...prev,
            name: detail.name || prev.name,
            position: detail.position || prev.position,
            avatar: detail.avatar !== undefined ? detail.avatar : prev.avatar,
            signature: detail.signature !== undefined ? detail.signature : prev.signature,
          };
        });
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('user_profile_updated', handleProfileUpdated);
  }, []);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [apiUrl, setApiUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.API_URL, ''));
  const [sheetUrl, setSheetUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.SHEET_URL, ''));

  // Main Data States
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [equipment, setEquipment] = useState<Record<string, EquipmentItem[]>>({});
  
  const { channelData, updateChannelData } = useDataContext();
  const { lists, globalChecks, emergencyWeekDates } = channelData;
  
  // Helper to update specific parts of channelData (functional updater prevents stale closures in loops)
  const setLists = (newLists: Record<'bag' | 'cart' | string, ListConfig> | ((prev: Record<'bag' | 'cart' | string, ListConfig>) => Record<'bag' | 'cart' | string, ListConfig>)) => {
    updateChannelData((prev) => ({
      lists: typeof newLists === 'function' ? newLists(prev.lists) : newLists,
    }));
  };
  const setGlobalChecks = (newChecks: Record<string, Record<string, CheckItemState>> | ((prev: Record<string, Record<string, CheckItemState>>) => Record<string, Record<string, CheckItemState>>)) => {
    updateChannelData((prev) => ({
      globalChecks: typeof newChecks === 'function' ? newChecks(prev.globalChecks || {}) : newChecks,
    }));
  };
  const setEmergencyWeekDates = (newDates: Record<string, Record<number, string>> | ((prev: Record<string, Record<number, string>>) => Record<string, Record<number, string>>)) => {
    updateChannelData((prev) => ({
      emergencyWeekDates: typeof newDates === 'function' ? newDates(prev.emergencyWeekDates || {}) : newDates,
    }));
  };

  const [historyRecords, setHistoryRecords] = useState<InspectionHistoryRecord[]>([]);
  const { isLoadingData } = useChannelSync({
    activeChannelId,
    authReady,
    isAuthenticated,
    setSheetUrl,
    setApiUrl,
    setTheme,
    setDrugs,
    setEquipment,
    setLists,
    setHistoryRecords,
  });

  // Modals
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [isHaAuditModalOpen, setIsHaAuditModalOpen] = useState(false);
  const [reportInitialWeek, setReportInitialWeek] = useState<number | undefined>(undefined);
  const [reportInitialWeekDates, setReportInitialWeekDates] = useState<Record<number, string> | undefined>(undefined);
  const [reportInitialRoundId, setReportInitialRoundId] = useState<string | undefined>(undefined);

  // Confirmation for AI Bulk Clear Inventory
  const [pendingClearCategory, setPendingClearCategory] = useState<string | null>(null);

  // Guest Mode Notice Banner
  const [isGuestBannerVisible, setIsGuestBannerVisible] = useState<boolean>(true);
  
  // Firebase Connectivity Test
  const [drawerView, setDrawerView] = useState<'main' | 'cloud'>('main');
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<CloudConnectivityResult | null>(null);

  interface StorageUsageResponse {
    firebase: {
      usedBytes?: number;
      usedKB?: number;
      usedMB: number;
      totalMB: number;
      percent: number;
      docCount: number;
      error?: string;
    };
    firebaseStorage: {
      usedBytes: number;
      usedKB: number;
      usedMB: number;
      totalMB: number;
      percent: number;
      fileCount: number;
      mode?: 'bucket' | 'inline';
      bucketAvailable?: boolean;
      error?: string;
    };
    github: {
      usedBytes?: number;
      usedKB?: number;
      usedMB: number;
      totalMB: number;
      percent: number;
      repoName: string;
      fetchedAt?: string;
      error?: string;
    };
  }

  const [storageUsage, setStorageUsage] = useState<StorageUsageResponse | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  const fetchStorageUsage = useCallback(async () => {
    setIsLoadingStorage(true);
    const STORAGE_QUOTA_MB = 1024;
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken().catch(() => '') : '';
      const channelIdsList = channels.map((c) => c.id).filter(Boolean);
      const channelsQuery = channelIdsList.length > 0 ? `&channels=${encodeURIComponent(channelIdsList.join(','))}` : '';

      const apiRes = await authorizedFetch(`/api/system/storage-usage?t=${Date.now()}${channelsQuery}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...(idToken ? { 'x-firebase-token': idToken } : {}),
        },
      }).catch(() => null);

      let serverData: (Omit<StorageUsageResponse, 'firebaseStorage'> & {
        embeddedMedia?: { usedBytes: number; usedKB: number; usedMB: number; fileCount: number };
      }) | null = null;
      if (apiRes && apiRes.ok) {
        serverData = await apiRes.json();
      }

      let firebaseMetric = serverData?.firebase || {
        usedBytes: 0,
        usedKB: 0,
        usedMB: 0,
        totalMB: 1024,
        percent: 0,
        docCount: 0,
        error: 'ไม่สามารถเชื่อมต่อเพื่อดึงข้อมูล Firebase Firestore ได้',
      };

      let embeddedMediaBytes = Number(serverData?.embeddedMedia?.usedBytes || 0);
      let embeddedMediaCount = Number(serverData?.embeddedMedia?.fileCount || 0);

      // Client-side fallback if server couldn't reach Firestore or found 0 docs while signed in
      if (firebaseUser && (firebaseMetric.error || (firebaseMetric.docCount === 0 && (firebaseMetric.usedBytes ?? 0) === 0))) {
        const clientStats = await measureFirestoreUsageClient(channelIdsList);
        if (!clientStats.error && clientStats.docCount > 0) {
          const totalBytes = 1024 * 1024 * 1024;
          firebaseMetric = {
            usedBytes: clientStats.usedBytes,
            usedKB: Number((clientStats.usedBytes / 1024).toFixed(2)),
            usedMB: Number((clientStats.usedBytes / (1024 * 1024)).toFixed(4)),
            totalMB: 1024,
            percent: Number(Math.min(100, (clientStats.usedBytes / totalBytes) * 100).toFixed(4)),
            docCount: clientStats.docCount,
          };
          embeddedMediaBytes = clientStats.embeddedMediaBytes;
          embeddedMediaCount = clientStats.embeddedMediaCount;
        }
      }

      const storageTotalBytes = STORAGE_QUOTA_MB * 1024 * 1024;
      const storageUsedBytes = Math.max(0, embeddedMediaBytes);
      const storageFileCount = Math.max(0, embeddedMediaCount);

      const firebaseStorageMetric: StorageUsageResponse['firebaseStorage'] = {
        usedBytes: storageUsedBytes,
        usedKB: Number((storageUsedBytes / 1024).toFixed(2)),
        usedMB: Number((storageUsedBytes / (1024 * 1024)).toFixed(4)),
        totalMB: STORAGE_QUOTA_MB,
        percent: storageUsedBytes > 0
          ? Number(Math.min(100, (storageUsedBytes / storageTotalBytes) * 100).toFixed(4))
          : 0,
        fileCount: storageFileCount,
        mode: 'inline',
        bucketAvailable: false,
      };

      const githubMetric = serverData?.github || {
        usedBytes: 0,
        usedKB: 0,
        usedMB: 0,
        totalMB: 1024,
        percent: 0,
        repoName: 'time165311-bot/checktest',
        error: 'ไม่สามารถดึงข้อมูล GitHub ได้',
      };

      setStorageUsage({
        firebase: firebaseMetric,
        firebaseStorage: firebaseStorageMetric,
        github: githubMetric,
      });
    } catch (err: any) {
      setStorageUsage({
        firebase: {
          usedBytes: 0,
          usedKB: 0,
          usedMB: 0,
          totalMB: 1024,
          percent: 0,
          docCount: 0,
          error: err?.message || 'ไม่สามารถเชื่อมต่อเพื่อดึงข้อมูล Firebase ได้',
        },
        firebaseStorage: {
          usedBytes: 0,
          usedKB: 0,
          usedMB: 0,
          totalMB: STORAGE_QUOTA_MB,
          percent: 0,
          fileCount: 0,
          mode: 'inline',
          bucketAvailable: false,
        },
        github: {
          usedBytes: 0,
          usedKB: 0,
          usedMB: 0,
          totalMB: 1024,
          percent: 0,
          repoName: 'time165311-bot/checktest',
          error: err?.message || 'ไม่สามารถดึงข้อมูล GitHub ได้',
        },
      });
    } finally {
      setIsLoadingStorage(false);
    }
  }, [firebaseUser, channels]);

  const handleTestFirebaseConnection = useCallback(async (): Promise<CloudConnectivityResult> => {
    setIsTestingFirebase(true);
    setFirebaseTestResult(null);
    let result: CloudConnectivityResult = { ok: false, status: 'error', msg: '' };
    try {
      result = await testCloudConnectivity();
      await fetchStorageUsage();
    } catch (error: any) {
      result = {
        ok: false,
        status: 'error',
        msg: `เกิดข้อผิดพลาด: ${error?.message || 'ไม่สามารถติดต่อ Firebase ได้'}`,
      };
    } finally {
      setFirebaseTestResult(result);
      setIsTestingFirebase(false);
    }
    return result;
  }, [fetchStorageUsage]);

  useEffect(() => {
    if (isDrawerOpen && drawerView === 'cloud') {
      void fetchStorageUsage();
    }
  }, [isDrawerOpen, drawerView, fetchStorageUsage]);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSheetsAccordionOpen, setIsSheetsAccordionOpen] = useState(false);
  const [isRoomDrawerOpen, setIsRoomDrawerOpen] = useState(false);

  // Scroll & Mobile History Management Refs
  const mainScrollRef = useRef<HTMLElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const scrollAnchorTopRef = useRef<number>(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyDepthRef = useRef<number>(0);

  const pushHistoryLayer = (payload: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ app: true, ...payload }, '');
      historyDepthRef.current += 1;
    }
  };

  const clearLingeringSubModals = () => {
    setIsRoomDrawerOpen(false);
    setIsDrawerOpen(false);
    setIsProfileOpen(false);
    setIsNotificationOpen(false);
    setIsChannelModalOpen(false);
    setIsBarcodeScannerOpen(false);
    setPendingClearCategory(null);
    setScannedItemResult(null);
    setZoomedImgUrl(null);
    setPreviewImage(null);
  };

  // 🧭 SPA Router & Multi-step History Back Handler
  const changeView = (newView: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'eq_overview') => {
    clearLingeringSubModals();
    setSelectedRoomId(null);
    if (newView !== currentView) {
      if (newView !== 'home') {
        pushHistoryLayer({ view: newView });
      }
      setCurrentView(newView);
      lastScrollTopRef.current = 0;
      scrollAnchorTopRef.current = 0;
      scrollDirectionRef.current = null;
      setIsBottomBarVisible(true);
      setIsTopHeaderVisible(true);
      try {
        sessionStorage.setItem(`anesthesia_scroll_${newView}`, '0');
      } catch {}
      requestAnimationFrame(() => {
        mainScrollRef.current?.scrollTo({ top: 0 });
      });
    }
  };

  const handleRoomDrawerOpenChange = (open: boolean) => {
    if (open && !isRoomDrawerOpen) {
      pushHistoryLayer({ view: currentView, roomDrawer: true });
    }
    setIsRoomDrawerOpen(open);
    if (!open) {
      setSelectedRoomId(null);
    }
    setIsBottomBarVisible(true);
    setIsTopHeaderVisible(true);
  };

  const handleUiBackToHome = () => {
    clearLingeringSubModals();
    setSelectedRoomId(null);
    setCurrentView('home');
    lastScrollTopRef.current = 0;
    scrollAnchorTopRef.current = 0;
    scrollDirectionRef.current = null;
    setIsBottomBarVisible(true);
    setIsTopHeaderVisible(true);
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0 });
    });
  };

  // Bottom Navigation Bar, Sticky Top Header, and Modal state management
  const [isBottomBarVisible, setIsBottomBarVisible] = useState<boolean>(true);
  const [isTopHeaderVisible, setIsTopHeaderVisible] = useState<boolean>(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [isExternalModalOpen, setIsExternalModalOpen] = useState<boolean>(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Restore saved scroll position on reopen/reload
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedScroll = Number(sessionStorage.getItem(`anesthesia_scroll_${currentView}`) || '0');
        if (savedScroll > 0 && mainScrollRef.current) {
          mainScrollRef.current.scrollTo({ top: savedScroll });
          lastScrollTopRef.current = savedScroll;
          scrollAnchorTopRef.current = savedScroll;
        }
      } catch {}
    }, 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;

    if (scrollRafRef.current === null) {
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (!el) return;

        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        const currentTop = Math.max(0, Math.min(el.scrollTop, maxScroll));
        const stepDelta = currentTop - lastScrollTopRef.current;
        lastScrollTopRef.current = currentTop;

        // Ignore elastic overscroll bounce at very bottom
        const isAtBottomBounce = maxScroll > 40 && currentTop >= maxScroll - 4;

        if (currentTop <= 16) {
          scrollAnchorTopRef.current = currentTop;
          scrollDirectionRef.current = null;
          setIsBottomBarVisible((prev) => (prev ? prev : true));
          setIsTopHeaderVisible((prev) => (prev ? prev : true));
        } else if (!isAtBottomBounce && Math.abs(stepDelta) > 0) {
          const dir: 'up' | 'down' = stepDelta > 0 ? 'down' : 'up';
          if (scrollDirectionRef.current !== dir) {
            scrollDirectionRef.current = dir;
            scrollAnchorTopRef.current = currentTop;
          }

          const cumulativeDelta = currentTop - scrollAnchorTopRef.current;
          const SCROLL_THRESHOLD = 18;

          if (dir === 'down' && cumulativeDelta >= SCROLL_THRESHOLD && currentTop > 32) {
            setIsTopHeaderVisible((prev) => (prev ? false : prev));
            setIsBottomBarVisible((prev) => (prev ? false : prev));
            scrollAnchorTopRef.current = currentTop;
          } else if (dir === 'up' && cumulativeDelta <= -SCROLL_THRESHOLD) {
            setIsBottomBarVisible((prev) => (prev ? prev : true));
            setIsTopHeaderVisible((prev) => (prev ? prev : true));
            scrollAnchorTopRef.current = currentTop;
          }
        }

        if (scrollStopTimerRef.current) {
          clearTimeout(scrollStopTimerRef.current);
        }
        scrollStopTimerRef.current = setTimeout(() => {
          try {
            sessionStorage.setItem(`anesthesia_scroll_${currentView}`, String(Math.round(el.scrollTop)));
          } catch {}
        }, 450);
      });
    }
  };

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, []);

  // Listen for modal state changes from child components
  useEffect(() => {
    const handleModalState = (e: any) => {
      const open = !!e.detail?.open;
      setIsExternalModalOpen(open);
      if (!open) setIsBottomBarVisible(true);
    };
    window.addEventListener('modal_state_change', handleModalState);
    return () => window.removeEventListener('modal_state_change', handleModalState);
  }, []);

  useEffect(() => {
    const handleFocusOut = () => {
      // Force reset keyboard state when input loses focus
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.tagName !== 'SELECT')) {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    window.addEventListener('focusout', handleFocusOut);
    return () => window.removeEventListener('focusout', handleFocusOut);
  }, []);

  // Selected Room ID for Room Check (cleared cleanly when drawer closes or leaving view)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('anesthesia_selected_room') || null;
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      if (selectedRoomId) {
        sessionStorage.setItem('anesthesia_selected_room', selectedRoomId);
      } else {
        sessionStorage.removeItem('anesthesia_selected_room');
      }
    } catch {}
  }, [selectedRoomId]);

  // Drawer Touch Drag Gesture Handler
  const [drawerDragY, setDrawerDragY] = useState<number>(0);
  const [isDrawerMounted, setIsDrawerMounted] = useState<boolean>(false);
  const touchStartYRef = React.useRef<number>(0);

  useEffect(() => {
    if (isDrawerOpen) {
      requestAnimationFrame(() => setIsDrawerMounted(true));
    } else {
      setIsDrawerMounted(false);
      setDrawerView('main');
    }
  }, [isDrawerOpen]);

  const handleTouchStartDrawer = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMoveDrawer = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStartYRef.current;
    if (diff > 0) {
      setDrawerDragY(diff);
    }
  };

  const handleTouchEndDrawer = () => {
    if (drawerDragY > 60) {
      setIsDrawerOpen(false);
    }
    setDrawerDragY(0);
  };

  // Mouse Drag Gesture Handler for PC
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const mouseStartYRef = React.useRef<number>(0);

  const handleMouseDownDrawer = (e: React.MouseEvent) => {
    setIsMouseDragging(true);
    mouseStartYRef.current = e.clientY;
  };

  const handleMouseMoveDrawer = (e: React.MouseEvent) => {
    if (!isMouseDragging) return;
    const diff = e.clientY - mouseStartYRef.current;
    if (diff > 0) {
      setDrawerDragY(diff);
    }
  };

  const handleMouseUpDrawer = () => {
    if (isMouseDragging) {
      setIsMouseDragging(false);
      if (drawerDragY > 60) {
        setIsDrawerOpen(false);
      }
      setDrawerDragY(0);
    }
  };

  // Toggle Theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleDrugsChange = async (nextDrugs: DrugItem[]) => {
    const channelId = activeChannelId || 'channel_master';
    const isMaster = channelId === 'channel_master';
    const chKeys = getChannelStorageKeys(channelId);

    setDrugs(nextDrugs);
    setStored(chKeys.DRUGS, nextDrugs);
    if (isMaster) {
      setStored(STORAGE_KEYS.DRUGS, nextDrugs);
    }
    try {
      if (nextDrugs.length === 0) {
        await clearChannelDrugsInFirebase(channelId);
        await persistClearedFlags({ drugsCleared: true }, channelId);
      } else {
        await persistClearedFlags({ drugsCleared: false }, channelId);
        await saveChannelBatchDrugsToFirebase(channelId, nextDrugs);
      }
    } catch (err) {
      console.warn('Failed to sync drugs to Cloud Firestore:', err);
    }
    logAuditEvent({
      action: 'UPDATE_DRUG_STOCK',
      targetCollection: 'drugs',
      targetId: channelId,
      details: { count: nextDrugs.length, channelId, reason: 'ปรับปรุงข้อมูลคลังยาและสารน้ำ' },
      currentUser,
    });
  };

  // Toggle Item Inspection Result ('ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ' | '')
  const handleToggleCheck = (
    categoryOrRoomId: string,
    itemKey: string,
    result: 'ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ' | '',
    _itemName: string,
    week?: number,
    isMassAction?: boolean,
    customValue?: string
  ) => {
    const isResetToUnchecked = (result as string) === '' || (isMassAction && customValue === '');
    const normalizedResult = isResetToUnchecked ? '' : normalizeCheckResultStatus(result);
    setGlobalChecks((prev) => {
      const currentCategory = prev[categoryOrRoomId] || {};
      const existing = currentCategory[itemKey] || { result: '', weekVals: {} };
      
      let nextResult: 'ปกติ' | 'ผิดปกติ' | '';
      if (isResetToUnchecked) {
        nextResult = '';
      } else if (isMassAction) {
        nextResult = normalizedResult as 'ปกติ' | 'ผิดปกติ';
      } else {
        nextResult = (existing?.result === normalizedResult ? '' : normalizedResult) as 'ปกติ' | 'ผิดปกติ' | '';
      }

      if (nextResult === 'ผิดปกติ') {
        logAuditEvent({
          action: 'DEFECTIVE_FLAG',
          targetCollection: categoryOrRoomId,
          targetId: itemKey,
          details: { itemName: _itemName, result: 'ผิดปกติ', week, customValue },
          currentUser,
        });
      }

      let nextWeekVals = { ...(existing.weekVals || {}) };
      if (week !== undefined) {
        if (isResetToUnchecked) {
          delete nextWeekVals[week];
          const remainingVals = Object.values(nextWeekVals).filter(
            (v) => v !== undefined && String(v).trim() !== ''
          );
          if (remainingVals.length === 0) {
            nextResult = '';
          } else {
            nextResult = remainingVals.some((v) => v === '0' || v === '✗') ? 'ผิดปกติ' : 'ปกติ';
          }
        } else if (customValue !== undefined) {
          if (String(customValue).trim() === '') {
            delete nextWeekVals[week];
          } else {
            nextWeekVals[week] = customValue;
          }
        } else {
          // If no custom value provided, attempt to find the item to get its real target quantity
          let targetVal = normalizedResult === 'ปกติ' ? '1' : '0';
          
          if (normalizedResult === 'ปกติ') {
            const config = lists[categoryOrRoomId as 'bag' | 'cart'];
            if (config && config.groups) {
              let foundItem: EquipmentItem | undefined;
              Object.entries(config.groups).forEach(([groupName, groupItems]) => {
                if (foundItem) return;
                const match = groupItems.find((it, idx) => 
                  it.id === itemKey || 
                  `${categoryOrRoomId}_${groupName}_${idx}` === itemKey ||
                  (it.category && `${categoryOrRoomId}_${it.category}_${idx}` === itemKey)
                );
                if (match) foundItem = match;
              });
              
              if (foundItem) {
                targetVal = getRealTargetCheckValue(foundItem);
              }
            } else if (equipment[categoryOrRoomId]) {
              const match = equipment[categoryOrRoomId].find(it => it.id === itemKey);
              if (match) targetVal = getRealTargetCheckValue(match);
            }
          }

          if (isMassAction) {
            nextWeekVals[week] = targetVal;
          } else {
            // Toggle logic for single clicks
            if (existing.weekVals?.[week] === targetVal) {
              delete nextWeekVals[week];
              const remainingVals = Object.values(nextWeekVals).filter(
                (v) => v !== undefined && String(v).trim() !== ''
              );
              nextResult = remainingVals.length === 0
                ? ''
                : remainingVals.some((v) => v === '0' || v === '✗')
                ? 'ผิดปกติ'
                : 'ปกติ';
            } else {
              nextWeekVals[week] = targetVal;
            }
          }
        }
      }

      const updatedItemState: CheckItemState = {
        ...existing,
        result: nextResult,
        weekVals: nextWeekVals,
      };
      if (isResetToUnchecked && nextResult === '') {
        updatedItemState.val = '';
        updatedItemState.note = '';
      }

      const updatedCategory = {
        ...currentCategory,
        [itemKey]: updatedItemState,
      };

      const updatedGlobal = {
        ...prev,
        [categoryOrRoomId]: updatedCategory,
      };

      setStored(getChannelChecksKey(activeChannelId), updatedGlobal);
      return updatedGlobal;
    });
  };

  // Atomic Clear All Checks for a specific week in Emergency Bag, Crash Cart, or Ambulance
  const handleClearEmergencyWeek = (type: 'bag' | 'cart' | 'ambulance' | string, week: number) => {
    setGlobalChecks((prev) => {
      const currentCategory = prev[type] || {};
      const clearedCategory: Record<string, CheckItemState> = {};

      Object.entries(currentCategory).forEach(([key, state]) => {
        if (!state) return;
        const nextWeekVals = { ...(state.weekVals || {}) };
        delete nextWeekVals[week];

        const remainingVals = Object.values(nextWeekVals).filter(
          (v) => v !== undefined && String(v).trim() !== ''
        );
        const nextResult: 'ปกติ' | 'ผิดปกติ' | '' =
          remainingVals.length === 0
            ? ''
            : remainingVals.some((v) => v === '0' || v === '✗')
            ? 'ผิดปกติ'
            : 'ปกติ';

        clearedCategory[key] = {
          ...state,
          result: nextResult,
          weekVals: nextWeekVals,
          ...(nextResult === '' ? { val: '', note: '' } : {}),
        };
      });

      const updatedGlobal = {
        ...prev,
        [type]: clearedCategory,
      };

      setStored(getChannelChecksKey(activeChannelId), updatedGlobal);
      return updatedGlobal;
    });
  };

  // AuraAssistant handlers extracted cleanly to src/hooks/useAuraActions.ts (initialized below after formattedBagItems/formattedCartItems)

  // Update Note for Defective Item
  const handleUpdateNote = (categoryOrRoomId: string, itemKey: string, note: string) => {
    setGlobalChecks((prev) => {
      const currentCategory = prev[categoryOrRoomId] || {};
      const existing = currentCategory[itemKey] || { result: '', weekVals: {} };

      let updatedItem = { ...existing };

      if (note.startsWith('EXP:')) {
        updatedItem.exp = note.replace('EXP:', '');
      } else if (note.startsWith('PSI:')) {
        const psiVal = note.replace('PSI:', '');
        updatedItem.val = psiVal;
      } else {
        updatedItem.note = note;
      }

      const updatedCategory = {
        ...currentCategory,
        [itemKey]: updatedItem,
      };

      const updatedGlobal = {
        ...prev,
        [categoryOrRoomId]: updatedCategory,
      };

      setStored(getChannelChecksKey(activeChannelId), updatedGlobal);
      return updatedGlobal;
    });
  };

  // Add New Item to Emergency Bag or Crash Cart Checklist
  const handleAddItem = async (
    type: 'bag' | 'cart' | 'ambulance' | string,
    newItem: {
      name: string;
      groupName: string;
      spec?: string;
      qty?: string;
      exp?: string;
      img?: string;
      checkType?: 'single' | 'sub_items';
      subItems?: string[];
      subItemQuantities?: number[];
      subExps?: Array<{ label?: string; exp?: string; qty?: number; hasNoExp?: boolean }>;
    }
  ) => {
    const itemKey = `${type}_${newItem.groupName}_${Date.now()}`;
    const itemObject: EquipmentItem = {
      id: itemKey,
      name: newItem.name,
      no: '1',
      code: `NEW-${Math.floor(1000 + Math.random() * 9000)}`,
      spec: newItem.spec || '',
      qty: newItem.qty || '1',
      location: newItem.groupName,
      category: newItem.groupName,
      exp: newItem.exp || '',
      img: newItem.img || '',
      type,
      ...(newItem.checkType ? { checkType: newItem.checkType } : {}),
      ...(newItem.subItems && newItem.subItems.length > 0 ? { subItems: newItem.subItems } : {}),
      ...(newItem.subItemQuantities && newItem.subItemQuantities.length > 0 ? { subItemQuantities: newItem.subItemQuantities } : {}),
      ...(newItem.subExps && newItem.subExps.length > 0 ? { subExps: newItem.subExps } : {}),
    };

    const saved = await saveEquipmentItemToFirebase(itemObject);
    const persistedItem = saved || itemObject;
    if (activeChannelId === 'channel_master') {
      persistClearedFlags(type === 'bag' ? { bagCleared: false } : { cartCleared: false }).catch(() => {});
    }

    logAuditEvent({
      action: 'ADD_EQUIPMENT',
      targetCollection: type,
      targetId: itemKey,
      details: { name: newItem.name, location: newItem.groupName, qty: newItem.qty },
      currentUser,
    });

    setLists((prev) => {
      const currentList = prev[type] || {
        title: type === 'bag' ? 'กระเป๋าฉุกเฉิน' : type === 'ambulance' ? 'รถพยาบาลฉุกเฉิน' : 'รถฉุกเฉิน',
        groups: {},
      };
      const groups = { ...(currentList.groups || {}) };
      const targetGroup = groups[newItem.groupName] ? [...groups[newItem.groupName]] : [];
      
      groups[newItem.groupName] = [...targetGroup, persistedItem];

      const updatedLists = { ...prev, [type]: { ...currentList, groups } };
      setStored(getChannelListsKey(activeChannelId), updatedLists);
      return updatedLists;
    });
  };

  // Delete Item from Emergency Bag or Crash Cart Checklist
  const handleDeleteItem = async (type: 'bag' | 'cart' | 'ambulance' | string, itemKey: string) => {
    const ok = await deleteEquipmentItemInFirebase(itemKey);
    if (!ok) return;

    logAuditEvent({
      action: 'DELETE_EQUIPMENT',
      targetCollection: type,
      targetId: itemKey,
      details: { type },
      currentUser,
    });

    setLists((prev) => {
      const currentList = prev[type];
      if (!currentList || !currentList.groups) return prev;

      const newGroups: Record<string, EquipmentItem[]> = {};
      Object.entries(currentList.groups).forEach(([groupName, items]) => {
        newGroups[groupName] = items.filter((it, idx) => {
          const currentKey = it.id || `${type}_${groupName}_${idx}`;
          return currentKey !== itemKey;
        });
      });

      const updatedLists = { ...prev, [type]: { ...currentList, groups: newGroups } };
      setStored(getChannelListsKey(activeChannelId), updatedLists);
      return updatedLists;
    });

    // Also clean up checks for this item
    setGlobalChecks((prev) => {
      const categoryChecks = prev[type];
      if (!categoryChecks || !categoryChecks[itemKey]) return prev;

      const newCategoryChecks = { ...categoryChecks };
      delete newCategoryChecks[itemKey];

      const updatedGlobal = { ...prev, [type]: newCategoryChecks };
      setStored(getChannelChecksKey(activeChannelId), updatedGlobal);
      return updatedGlobal;
    });
  };

  // Edit Item in Emergency Bag or Crash Cart Checklist (Instant Optimistic Sync to Lists & PDF)
  const handleEditItem = (type: 'bag' | 'cart' | 'ambulance' | string, updatedItem: EquipmentItem) => {
    const itemId = updatedItem.id || (updatedItem.code ? `${type}_${updatedItem.code}` : `eq_${Date.now()}`);
    const finalItem: EquipmentItem = {
      ...updatedItem,
      id: itemId,
      type,
    };

    // 1. Optimistically update local state immediately so PDF and Checklist reflect changes instantly!
    setLists((prev) => {
      const currentList = prev[type];
      if (!currentList || !currentList.groups) return prev;

      const newGroups: Record<string, EquipmentItem[]> = {};
      let itemReplaced = false;

      Object.entries(currentList.groups).forEach(([groupName, items]) => {
        newGroups[groupName] = items.map((it, idx) => {
          const itKey = it.id || `${type}_${groupName}_${idx}`;
          const isMatch =
            (it.id && it.id === finalItem.id) ||
            itKey === finalItem.id ||
            (it.code && finalItem.code && it.code === finalItem.code) ||
            (it.name === finalItem.name && (groupName === finalItem.category || !finalItem.category));

          if (isMatch && !itemReplaced) {
            itemReplaced = true;
            return finalItem;
          }
          return it;
        });
      });

      // If category changed, move item to new group
      const targetCategory = finalItem.category || finalItem.location;
      if (targetCategory) {
        let foundInOldGroup: string | null = null;
        Object.entries(newGroups).forEach(([g, items]) => {
          if (g !== targetCategory && items.some(it => it.id === finalItem.id || (it.code && it.code === finalItem.code))) {
            foundInOldGroup = g;
          }
        });

        if (foundInOldGroup && foundInOldGroup !== targetCategory) {
          newGroups[foundInOldGroup] = newGroups[foundInOldGroup].filter(
            it => it.id !== finalItem.id && (!finalItem.code || it.code !== finalItem.code)
          );
          if (!newGroups[targetCategory]) newGroups[targetCategory] = [];
          newGroups[targetCategory] = [...newGroups[targetCategory], finalItem];
        }
      }

      const updatedLists = { ...prev, [type]: { ...currentList, groups: newGroups } };
      setStored(getChannelListsKey(activeChannelId), updatedLists);
      return updatedLists;
    });

    // 2. Persist to Firebase in background without blocking state
    saveEquipmentItemToFirebase(finalItem).catch((err) =>
      console.warn('Firebase saveEquipmentItem error:', err)
    );
  };

  // Edit / Add / Move Room Equipment directly from FloorMap OR Drawer
  const handleEditRoomEquipment = (sourceRoomId: string, updatedItem: EquipmentItem) => {
    const targetRoomId = updatedItem.roomId || sourceRoomId;
    const itemId = updatedItem.id || `eq_${targetRoomId}_${Date.now()}`;
    const finalItem: EquipmentItem = {
      ...updatedItem,
      id: itemId,
      type: 'room',
      roomId: targetRoomId,
    };

    setEquipment((prev) => {
      const nextEq: Record<string, EquipmentItem[]> = { ...prev };

      // If moved to a different room, remove old copy from sourceRoomId
      if (sourceRoomId !== targetRoomId && Array.isArray(nextEq[sourceRoomId])) {
        nextEq[sourceRoomId] = nextEq[sourceRoomId].filter(
          (it, idx) =>
            it.id !== finalItem.id &&
            `${sourceRoomId}_${idx}` !== finalItem.id &&
            !(it.code && finalItem.code && it.code === finalItem.code)
        );
      }

      const targetList = Array.isArray(nextEq[targetRoomId]) ? [...nextEq[targetRoomId]] : [];
      let replaced = false;
      const updatedTargetList = targetList.map((it, idx) => {
        const itKey = it.id || `${targetRoomId}_${idx}`;
        const matches =
          (it.id && it.id === finalItem.id) ||
          itKey === finalItem.id ||
          (it.code && finalItem.code && it.code === finalItem.code);
        if (matches && !replaced) {
          replaced = true;
          return finalItem;
        }
        return it;
      });
      if (!replaced) {
        updatedTargetList.push(finalItem);
      }

      // Keep target room items sorted cleanly by orderNumber / no
      updatedTargetList.sort((a, b) => {
        const na = parseInt(String(a.orderNumber || a.no || '').replace(/\D/g, ''), 10);
        const nb = parseInt(String(b.orderNumber || b.no || '').replace(/\D/g, ''), 10);
        return (isNaN(na) ? 999999 : na) - (isNaN(nb) ? 999999 : nb);
      });

      nextEq[targetRoomId] = updatedTargetList;
      const chKeys = getChannelStorageKeys(activeChannelId || 'channel_master');
      setStored(chKeys.EQ, nextEq);
      if (!activeChannelId || activeChannelId === 'channel_master') {
        setStored(STORAGE_KEYS.EQ, nextEq);
      }
      return nextEq;
    });

    persistClearedFlags({ equipmentCleared: false }, activeChannelId).catch(() => {});
    saveChannelEquipmentItemToFirebase(activeChannelId || 'channel_master', finalItem).catch((err) =>
      console.warn('Firebase saveRoomEquipment error:', err)
    );
  };

  const handleSaveRotatedImage = async (newImageUrl: string) => {
    if (!zoomedImgUrl) return;
    const oldUrl = zoomedImgUrl;
    setZoomedImgUrl(newImageUrl);

    // 1. Check room equipment
    let foundEqItem: EquipmentItem | null = null;
    let foundRoomId: string | null = null;
    Object.entries(equipment).forEach(([rId, items]) => {
      items.forEach((it) => {
        if (it.img === oldUrl) {
          foundEqItem = it;
          foundRoomId = rId;
        }
      });
    });
    if (foundEqItem && foundRoomId) {
      handleEditRoomEquipment(foundRoomId, { ...(foundEqItem as EquipmentItem), img: newImageUrl });
      return;
    }

    // 2. Check lists (bag, cart, ambulance)
    for (const type of ['bag', 'cart', 'ambulance'] as const) {
      const currentList = lists[type];
      if (currentList?.groups) {
        for (const [, items] of Object.entries(currentList.groups)) {
          for (const it of items) {
            if (it.img === oldUrl) {
              handleEditItem(type, { ...it, img: newImageUrl });
              return;
            }
          }
        }
      }
    }

    // 3. Check drugs
    const foundDrug = drugs.find((d) => d.img === oldUrl);
    if (foundDrug) {
      handleDrugsChange(drugs.map((d) => (d.id === foundDrug.id ? { ...d, img: newImageUrl } : d)));
    }
  };

  const handleDeleteRoomEquipment = async (roomId: string, itemKeyOrId: string) => {
    const roomObj = ROOMS.find((r) => r.id === roomId);
    const roomName = roomObj?.n || roomId;

    const currentRoomItems = equipment[roomId] || [];
    const targetItem = currentRoomItems.find((it, idx) => {
      const k1 = it.id || `${roomId}_${idx}`;
      const k2 = `${roomName}|${it.name}|${it.code || ''}`;
      return it.id === itemKeyOrId || k1 === itemKeyOrId || k2 === itemKeyOrId;
    });

    const resolvedFirestoreId = targetItem?.id || (itemKeyOrId.includes('|') ? null : itemKeyOrId);

    setEquipment((prev) => {
      const list = prev[roomId] || [];
      const nextList = list.filter((it, idx) => {
        const k1 = it.id || `${roomId}_${idx}`;
        const k2 = `${roomName}|${it.name}|${it.code || ''}`;
        return it.id !== itemKeyOrId && k1 !== itemKeyOrId && k2 !== itemKeyOrId;
      });
      const nextEq = { ...prev, [roomId]: nextList };
      const chKeys = getChannelStorageKeys(activeChannelId || 'channel_master');
      setStored(chKeys.EQ, nextEq);
      if (!activeChannelId || activeChannelId === 'channel_master') {
        setStored(STORAGE_KEYS.EQ, nextEq);
      }
      return nextEq;
    });

    setGlobalChecks((prev) => {
      const rChecks = prev[roomId];
      if (!rChecks) return prev;
      const nextRChecks = { ...rChecks };
      delete nextRChecks[itemKeyOrId];
      if (targetItem) {
        if (targetItem.id) delete nextRChecks[targetItem.id];
        delete nextRChecks[`${roomName}|${targetItem.name}|${targetItem.code || ''}`];
      }
      const nextGlobal = { ...prev, [roomId]: nextRChecks };
      setStored(getChannelChecksKey(activeChannelId), nextGlobal);
      return nextGlobal;
    });

    if (resolvedFirestoreId) {
      await deleteChannelEquipmentItemInFirebase(activeChannelId || 'channel_master', resolvedFirestoreId).catch(() => {});
    }

    logAuditEvent({
      action: 'DELETE_EQUIPMENT',
      targetCollection: 'equipment',
      targetId: resolvedFirestoreId || itemKeyOrId,
      details: { roomId, name: targetItem?.name, channelId: activeChannelId || 'channel_master' },
      currentUser,
    });
  };

  // Calculate Expiry Alerts (Strict Asia/Bangkok UTC+7 + Buddhist Era normalization)
  const expiryAlerts = useMemo<ExpiryAlertItem[]>(() => {
    const alerts: ExpiryAlertItem[] = [];

    const checkListExp = (catKey: 'bag' | 'cart' | 'ambulance', config: ListConfig) => {
      if (!config || !config.groups) return;
      Object.entries(config.groups).forEach(([groupName, groupItems]) => {
        groupItems.forEach((item) => {
          if (!item.exp) return;
          const expDate = parseExpDateObj(item.exp);
          if (!expDate) return;
          const diffDays = diffDaysFromBangkokToday(item.exp);
          if (diffDays !== null && diffDays <= 90) {
            alerts.push({
              item,
              category: catKey,
              categoryTitle: config.title,
              groupName,
              daysRemaining: diffDays,
              status: diffDays < 0 ? 'expired' : diffDays <= 30 ? 'warning' : 'good',
            });
          }
        });
      });
    };

    checkListExp('bag', lists.bag);
    if (lists.ambulance) checkListExp('ambulance', lists.ambulance);
    checkListExp('cart', lists.cart);
    return alerts;
  }, [lists]);

  // Overall Statistics Calculation (Filters random test artifacts & matches ModernDashboard check resolution across all 5 categories)
  const overallStats = useMemo(() => {
    let grandTotal = 0;
    let grandChecked = 0;
    let grandNormal = 0;
    let grandDefective = 0;

    const isJunkTestItem = (name: string, id?: string) => {
      const n = String(name || '').trim();
      const rawId = String(id || '').trim();
      if (/^eq[\s_-]*17\d+/i.test(n) || /^eq[\s_-]*\d{8,}$/i.test(n)) return true;
      if (/^eq[\s_-]*17\d+/i.test(rawId) || /^eq[\s_-]*\d{8,}$/i.test(rawId)) return true;
      return !n;
    };

    // 1. Drugs & Fluids
    (drugs || []).forEach((d) => {
      if (!d || isJunkTestItem(d.name, d.id)) return;
      grandTotal++;
      if (Number(d.remaining) <= 0) {
        grandChecked++;
        grandDefective++;
      } else {
        grandChecked++;
        grandNormal++;
      }
    });

    // 2. Room Equipment
    Object.entries(equipment).forEach(([roomId, items]) => {
      const roomObj = ROOMS.find((r) => r.id === roomId);
      const roomName = roomObj?.n || roomId;
      const roomChecks = globalChecks[roomId] || {};
      items.forEach((item, idx) => {
        if (isJunkTestItem(item.name, item.id)) return;
        grandTotal++;
        const itemKey = item.id || `${roomId}_${idx}`;
        const altKey = `${roomName}|${item.name}|${item.code || ''}`;
        const state = roomChecks[itemKey] || roomChecks[altKey];
        if (state?.result === 'ปกติ') {
          grandChecked++;
          grandNormal++;
        } else if (state?.result === 'ผิดปกติ') {
          grandChecked++;
          grandDefective++;
        }
      });
    });

    // 3. Lists (Bag, Ambulance & Cart)
    (['bag', 'ambulance', 'cart'] as const).forEach((catKey) => {
      const config = lists[catKey];
      const catChecks = globalChecks[catKey] || {};
      if (config && config.groups) {
        Object.entries(config.groups).forEach(([gName, items]) => {
          items.forEach((item, idx) => {
            if (isJunkTestItem(item.name, item.id)) return;
            grandTotal++;
            const itemKey = item.id || `${catKey}_${gName}_${idx}`;
            const altKey = `${catKey}_${idx}`;
            const state = catChecks[itemKey] || catChecks[altKey];
            if (state?.result === 'ปกติ') {
              grandChecked++;
              grandNormal++;
            } else if (state?.result === 'ผิดปกติ') {
              grandChecked++;
              grandDefective++;
            }
          });
        });
      }
    });

    const completionPct = grandTotal > 0 ? Math.round((grandNormal / grandTotal) * 100) : 0;

    return {
      grandTotal,
      grandChecked,
      grandNormal,
      grandDefective,
      completionPct,
    };
  }, [drugs, equipment, lists, globalChecks]);

  // Transform Bag List for Swiper Inspection Carousel
  const bagInspectionItems = useMemo<InspectionSlideItem[]>(() => {
    const items: InspectionSlideItem[] = [];
    if (!lists.bag || !lists.bag.groups) return items;
    Object.entries(lists.bag.groups).forEach(([groupName, groupItems]) => {
      groupItems.forEach((item, idx) => {
        const itemKey = item.id || `bag_${groupName}_${idx}`;
        items.push({
          id: item.id || itemKey,
          name: item.name,
          no: item.no,
          code: item.code,
          spec: item.spec,
          location: item.location || groupName,
          img: item.img,
          category: 'bag',
          categoryName: `กระเป๋าฉุกเฉิน - ${groupName}`,
          exp: item.exp,
          note: item.note,
          itemKey: itemKey,
          rawItem: item,
        });
      });
    });
    return items;
  }, [lists.bag]);

  // Transform Cart List for Swiper Inspection Carousel
  const cartInspectionItems = useMemo<InspectionSlideItem[]>(() => {
    const items: InspectionSlideItem[] = [];
    if (!lists.cart || !lists.cart.groups) return items;
    Object.entries(lists.cart.groups).forEach(([groupName, groupItems]) => {
      groupItems.forEach((item, idx) => {
        const itemKey = item.id || `cart_${groupName}_${idx}`;
        items.push({
          id: item.id || itemKey,
          name: item.name,
          no: item.no,
          code: item.code,
          spec: item.spec,
          location: item.location || groupName,
          img: item.img,
          category: 'cart',
          categoryName: `รถฉุกเฉิน - ${groupName}`,
          exp: item.exp,
          note: item.note,
          itemKey: itemKey,
          rawItem: item,
        });
      });
    });
    return items;
  }, [lists.cart]);

  // Transform All Room Equipment for Swiper Inspection Carousel
  const equipmentOverviewItems = useMemo<InspectionSlideItem[]>(() => {
    const items: InspectionSlideItem[] = [];
    Object.entries(equipment).forEach(([roomId, roomList]) => {
      const roomObj = ROOMS.find((r) => r.id === roomId);
      const roomName = roomObj ? roomObj.n : roomId;
      roomList.forEach((eq, idx) => {
        const itemKey = eq.id || `${roomId}_${idx}`;
        items.push({
          id: eq.id || itemKey,
          name: eq.name,
          no: eq.no,
          code: eq.code,
          sap: eq.sap,
          spec: eq.spec,
          location: roomName,
          img: eq.img,
          category: 'equipment',
          categoryName: `ครุภัณฑ์ - ${roomName}`,
          exp: eq.exp,
          note: eq.note,
          itemKey: itemKey,
          rawItem: eq,
          roomId: roomId,
        });
      });
    });
    return items;
  }, [equipment]);

  // Flattened Equipment Checks for Carousel
  const flattenedEquipmentChecks = useMemo(() => {
    const merged: Record<string, CheckItemState> = {};
    Object.entries(globalChecks).forEach(([key, val]) => {
      if (key !== 'bag' && key !== 'cart' && key !== 'drugs') {
        if (val && typeof val === 'object') {
          Object.assign(merged, val);
        }
      }
    });
    return merged;
  }, [globalChecks]);

  // Report Initial Category
  const [reportCategory, setReportCategory] = useState<'eq' | 'bag' | 'cart' | 'drug' | 'ambulance'>('eq');

  // Format all equipment from all rooms for official report
  const formattedEqItems = useMemo<OfficialReportItemRow[]>(() => {
    const rows: OfficialReportItemRow[] = [];
    let count = 1;
    ROOMS.forEach((r) => {
      const roomItems = equipment[r.id] || [];
      const roomChecks = globalChecks[r.id] || {};
      roomItems.forEach((it, idx) => {
        const itemKey = it.id || `${r.id}_${idx}`;
        const altKey = `${r.n}|${it.name}|${it.code || ''}`;
        const st = roomChecks[itemKey] || roomChecks[altKey];

        let res = 'ใช้งานได้';
        if (st && st.result) {
          if (st.result === 'ผิดปกติ') {
            res = 'ใช้งานไม่ได้';
          } else if (st.result === 'ปกติ') {
            res = 'ใช้งานได้';
          }
        } else {
          res = 'ไม่พบรายการ';
        }

        rows.push({
          no: it.no || count++,
          code: it.code || '-',
          sap: it.sap || '-',
          name: it.name,
          spec: it.spec || '-',
          source: it.source || 'เงินบำรุง',
          date: it.date || '-',
          qty: it.qty || 1,
          unitText: it.unitText,
          tax: it.tax || 7,
          price: it.price || '-',
          location: r.n,
          res: res,
          note: st?.note || '',
        });
      });
    });
    return rows;
  }, [equipment, globalChecks]);

  // Format bag checklist for official report
  const formattedBagItems = useMemo<OfficialReportItemRow[]>(() => {
    const rows: OfficialReportItemRow[] = [];
    if (!lists.bag?.groups) return rows;
    const bagChecks = globalChecks['bag'] || {};
    let count = 1;
    Object.entries(lists.bag.groups).forEach(([groupName, groupList]) => {
      groupList.forEach((it, idx) => {
        const itemKey = it.id || `bag_${groupName}_${idx}`;
        const st = bagChecks[itemKey];
        const cleanWeekVals: { [w: number]: string } = {};
        if (st?.weekVals) {
          Object.entries(st.weekVals).forEach(([wk, v]) => {
            if (v !== undefined && String(v).trim() !== '') {
              cleanWeekVals[Number(wk)] = String(v);
            }
          });
        }
        const hasAnyWeekVal = Object.keys(cleanWeekVals).length > 0;
        const isBad = st?.result === 'ผิดปกติ';
        const isNormal = st?.result === 'ปกติ' || (!isBad && hasAnyWeekVal);
        const rowObj: OfficialReportItemRow = {
          no: count++,
          code: it.code || '',
          spec: it.spec || '',
          name: it.name,
          qty: it.qty || 1,
          unitText: it.unitText,
          exp: st?.exp || it.exp || '-',
          group: groupName,
          location: `กระเป๋าฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : isNormal ? 'ใช้งานได้' : '',
          note: st?.note || '',
          val: st?.val || (st?.result === 'ปกติ' ? getRealTargetCheckValue(it) : ''),
          weekVals: cleanWeekVals,
        };
        if (it.subItemQuantities && it.subItemQuantities.length > 0) {
          rowObj.subItemQuantities = it.subItemQuantities;
        }
        if (it.subExps && it.subExps.length > 0) {
          rowObj.subExps = it.subExps;
        }
        rows.push(rowObj);
      });
    });
    return rows;
  }, [lists.bag, globalChecks]);

  // Format cart checklist for official report
  const formattedCartItems = useMemo<OfficialReportItemRow[]>(() => {
    const rows: OfficialReportItemRow[] = [];
    if (!lists.cart?.groups) return rows;
    const cartChecks = globalChecks['cart'] || {};
    let count = 1;
    Object.entries(lists.cart.groups).forEach(([groupName, groupList]) => {
      groupList.forEach((it, idx) => {
        const itemKey = it.id || `cart_${groupName}_${idx}`;
        const st = cartChecks[itemKey];
        const cleanWeekVals: { [w: number]: string } = {};
        if (st?.weekVals) {
          Object.entries(st.weekVals).forEach(([wk, v]) => {
            if (v !== undefined && String(v).trim() !== '') {
              cleanWeekVals[Number(wk)] = String(v);
            }
          });
        }
        const hasAnyWeekVal = Object.keys(cleanWeekVals).length > 0;
        const isBad = st?.result === 'ผิดปกติ';
        const isNormal = st?.result === 'ปกติ' || (!isBad && hasAnyWeekVal);
        const rowObj: OfficialReportItemRow = {
          no: count++,
          code: it.code || '',
          spec: it.spec || '',
          name: it.name,
          qty: it.qty || 1,
          unitText: it.unitText,
          exp: st?.exp || it.exp || '-',
          group: groupName,
          location: `รถฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : isNormal ? 'ใช้งานได้' : '',
          note: st?.note || '',
          val: st?.val || (st?.result === 'ปกติ' ? getRealTargetCheckValue(it) : ''),
          weekVals: cleanWeekVals,
        };
        if (it.subItemQuantities && it.subItemQuantities.length > 0) {
          rowObj.subItemQuantities = it.subItemQuantities;
        }
        if (it.subExps && it.subExps.length > 0) {
          rowObj.subExps = it.subExps;
        }
        rows.push(rowObj);
      });
    });
    return rows;
  }, [lists.cart, globalChecks]);

  // Format ambulance checklist for official report
  const formattedAmbulanceItems = useMemo<OfficialReportItemRow[]>(() => {
    const rows: OfficialReportItemRow[] = [];
    if (!lists.ambulance?.groups) return rows;
    const ambulanceChecks = globalChecks['ambulance'] || {};
    let count = 1;
    Object.entries(lists.ambulance.groups).forEach(([groupName, groupList]) => {
      groupList.forEach((it, idx) => {
        const itemKey = it.id || `ambulance_${groupName}_${idx}`;
        const st = ambulanceChecks[itemKey];
        const cleanWeekVals: { [w: number]: string } = {};
        if (st?.weekVals) {
          Object.entries(st.weekVals).forEach(([wk, v]) => {
            if (v !== undefined && String(v).trim() !== '') {
              cleanWeekVals[Number(wk)] = String(v);
            }
          });
        }
        const hasAnyWeekVal = Object.keys(cleanWeekVals).length > 0;
        const isBad = st?.result === 'ผิดปกติ';
        const isNormal = st?.result === 'ปกติ' || (!isBad && hasAnyWeekVal);
        const rowObj: OfficialReportItemRow = {
          no: count++,
          code: it.code || '',
          spec: it.spec || '',
          name: it.name,
          qty: it.qty || 1,
          unitText: it.unitText,
          exp: st?.exp || it.exp || '-',
          group: groupName,
          location: `รถพยาบาลฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : isNormal ? 'ใช้งานได้' : '',
          note: st?.note || '',
          val: st?.val || (st?.result === 'ปกติ' ? getRealTargetCheckValue(it) : ''),
          weekVals: cleanWeekVals,
        };
        if (it.subItemQuantities && it.subItemQuantities.length > 0) {
          rowObj.subItemQuantities = it.subItemQuantities;
        }
        if (it.subExps && it.subExps.length > 0) {
          rowObj.subExps = it.subExps;
        }
        rows.push(rowObj);
      });
    });
    return rows;
  }, [lists.ambulance, globalChecks]);

  // Automatic Monthly Rollover (Bag & Cart: YYYY-MM) and Annual Rollover (OR Equipment: YYYY) locked to Asia/Bangkok
  const cycleRolloverProcessedRef = useRef<string>('');
  useEffect(() => {
    if (isLoadingData || !activeChannelId) return;

    const { monthKey, yearKey } = getBangkokPeriodKeys();
    const runKey = `${activeChannelId}|${monthKey}|${yearKey}`;
    if (cycleRolloverProcessedRef.current === runKey) return;
    cycleRolloverProcessedRef.current = runKey;

    const storedPeriods = getStoredCyclePeriods(activeChannelId);

    const inferOldMonthFromDates = (datesMap?: Record<number, string>): string | undefined => {
      if (!datesMap) return undefined;
      for (const raw of Object.values(datesMap)) {
        const match = String(raw || '').trim().match(/^(\d{4}-\d{2})-/);
        if (match && match[1] !== monthKey) {
          return match[1];
        }
      }
      return undefined;
    };

    const prevBagMonth = storedPeriods.bagMonth || inferOldMonthFromDates(emergencyWeekDates?.bag);
    const prevCartMonth = storedPeriods.cartMonth || inferOldMonthFromDates(emergencyWeekDates?.cart);
    const prevEqYear = storedPeriods.equipmentYear;

    const hasCategoryChecks = (cat: 'bag' | 'cart') =>
      Object.values(globalChecks?.[cat] || {}).some(
        (st) =>
          Boolean(st?.result) ||
          Boolean(st?.weekVals && Object.values(st.weekVals).some((v) => v !== undefined && String(v).trim() !== ''))
      );

    const hasRoomEquipmentChecks = () =>
      ROOMS.some((r) => Boolean(r.m && Object.values(globalChecks?.[r.id] || {}).some((st) => Boolean(st?.result))));

    const shouldRolloverBag = Boolean(prevBagMonth && prevBagMonth !== monthKey);
    const shouldRolloverCart = Boolean(prevCartMonth && prevCartMonth !== monthKey);
    const shouldRolloverEq = Boolean(prevEqYear && prevEqYear !== yearKey);

    if (shouldRolloverBag || shouldRolloverCart || shouldRolloverEq) {
      const todayIso = getBangkokTodayIso();
      const nowTh = new Date().toLocaleString('th-TH');
      const actorName = currentUser?.name || 'ระบบตัดรอบอัตโนมัติ';
      const recordsToArchive: InspectionHistoryRecord[] = [];

      if (shouldRolloverBag && hasCategoryChecks('bag')) {
        recordsToArchive.push({
          id: `bag_auto_${prevBagMonth}_${Date.now()}`,
          timestamp: nowTh,
          date: todayIso,
          type: 'bag',
          title: `แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency (ตัดรอบเดือน ${prevBagMonth})`,
          who: actorName,
          rows: formattedBagItems.map((it) => {
            const rowObj: any = {
              ...it,
              val: it.res === 'ใช้งานได้' ? getRealTargetCheckValue(it as any) : (it.res === 'ใช้งานไม่ได้' ? '✗' : ''),
              weekVals: it.weekVals || {},
            };
            if (rowObj.subItemQuantities === undefined) delete rowObj.subItemQuantities;
            if (rowObj.subExps === undefined) delete rowObj.subExps;
            return rowObj;
          }),
          weekDates: { ...(emergencyWeekDates?.bag || {}) },
        });
      }

      if (shouldRolloverCart && hasCategoryChecks('cart')) {
        recordsToArchive.push({
          id: `cart_auto_${prevCartMonth}_${Date.now() + 1}`,
          timestamp: nowTh,
          date: todayIso,
          type: 'cart',
          title: `แบบฟอร์มตรวจสอบความพร้อม รถ Emergency (ตัดรอบเดือน ${prevCartMonth})`,
          who: actorName,
          rows: formattedCartItems.map((it) => {
            const rowObj: any = {
              ...it,
              val: it.res === 'ใช้งานได้' ? getRealTargetCheckValue(it as any) : (it.res === 'ใช้งานไม่ได้' ? '✗' : ''),
              weekVals: it.weekVals || {},
            };
            if (rowObj.subItemQuantities === undefined) delete rowObj.subItemQuantities;
            if (rowObj.subExps === undefined) delete rowObj.subExps;
            return rowObj;
          }),
          weekDates: { ...(emergencyWeekDates?.cart || {}) },
        });
      }

      if (shouldRolloverEq && hasRoomEquipmentChecks()) {
        recordsToArchive.push({
          id: `eq_auto_${prevEqYear}_${Date.now() + 2}`,
          timestamp: nowTh,
          date: todayIso,
          type: 'eq',
          title: `ทะเบียนรายการครุภัณฑ์และอุปกรณ์ (ตัดรอบประจำปี ${prevEqYear})`,
          who: actorName,
          rows: formattedEqItems.map((row) => ({ ...row })),
        });
      }

      if (recordsToArchive.length > 0) {
        setHistoryRecords((prev) => {
          const existingIds = new Set(recordsToArchive.map((r) => r.id));
          return [...recordsToArchive, ...prev.filter((r) => !existingIds.has(r.id))].slice(0, 50);
        });
        recordsToArchive.forEach((rec) => {
          saveInspectionToFirebase(rec).catch(() => {});
        });
      }

      setGlobalChecks((prev) => {
        const nextGlobal = { ...prev };
        if (shouldRolloverBag) nextGlobal.bag = {};
        if (shouldRolloverCart) nextGlobal.cart = {};
        if (shouldRolloverEq) {
          ROOMS.forEach((r) => {
            if (r.m && nextGlobal[r.id]) {
              nextGlobal[r.id] = {};
            }
          });
        }
        setStored(getChannelChecksKey(activeChannelId), nextGlobal);
        return nextGlobal;
      });

      if (shouldRolloverBag || shouldRolloverCart) {
        setEmergencyWeekDates((prev) => {
          const nextDates = { ...prev };
          if (shouldRolloverBag) nextDates.bag = {};
          if (shouldRolloverCart) nextDates.cart = {};
          setStored(getChannelWeekDatesKey(activeChannelId), nextDates);
          return nextDates;
        });
      }
    }

    setStoredCyclePeriods(activeChannelId, {
      bagMonth: monthKey,
      cartMonth: monthKey,
      equipmentYear: yearKey,
    });
  }, [
    isLoadingData,
    activeChannelId,
    globalChecks,
    emergencyWeekDates,
    formattedBagItems,
    formattedCartItems,
    formattedEqItems,
    currentUser,
  ]);

  const {
    handleAuraBulkAutoCheck,
    handleAuraClearInventory,
    executeAuraClearInventory,
    executeDeleteAllEquipment,
    createAuraSnapshot,
    restoreAuraSnapshot,
    handleAuraDirectClear,
    handleAuraUpdateItem,
    handleAutoFillChecks,
    handleRestockRequest,
    handleAttachEquipmentPhotos,
    handleBulkImportEquipment,
  } = useAuraActions({
    activeChannelId,
    activeChannel,
    currentView,
    currentUser,
    apiUrl,
    drugs,
    setDrugs,
    equipment,
    setEquipment,
    lists,
    setLists,
    globalChecks,
    setGlobalChecks,
    emergencyWeekDates,
    setEmergencyWeekDates,
    formattedBagItems,
    formattedCartItems,
    setHistoryRecords,
    setPendingClearCategory,
    reRenderData,
  });

    const isSavingReportRef = useRef<boolean>(false);
    const [isSavingReport, setIsSavingReport] = useState<boolean>(false);

    // Submit equipment inspection to Google Apps Script and immediately open OfficialReportModal
    const handleSaveEquipmentAndPreview = async () => {
      if (isSavingReportRef.current) return;
      isSavingReportRef.current = true;
      setIsSavingReport(true);
      try {
        const now = new Date();
        const thaiYear = String(now.getFullYear() + 543);
        const day = ('0' + now.getDate()).slice(-2);
        const month = ('0' + (now.getMonth() + 1)).slice(-2);
        const dateFormatted = `${day}${month}${thaiYear}`;
        const uniqueSheet = `ครุภัณฑ์_ทุกห้อง_${dateFormatted}`;

        // 1. Send data to Google Apps Script Web App URL if configured
        if (apiUrl && apiUrl.trim()) {
          try {
            await sendInspectionToGas(apiUrl, {
              type: 'equipment',
              sheet: 'ครุภัณฑ์',
              sheetName: uniqueSheet,
              title: 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์',
              location: 'ทุกห้อง',
              date: now.toISOString().split('T')[0],
              who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
              user: currentUser?.username || 'admin',
              tax: '7',
              startNo: 1,
              rows: formattedEqItems.map((item, idx) => ({
                no: String(item.no || idx + 1),
                code: item.code || '-',
                sap: item.sap || '-',
                name: item.name,
                spec: item.spec || '-',
                source: item.source || '-',
                date: item.date || '-',
                qty: String(item.qty || '1'),
                tax: String(item.tax || '7'),
                price: String(item.price || '-'),
                location: item.location || '-',
                res: item.res,
                note: item.note || '',
              })),
            });
          } catch (err) {
            console.error('Failed to submit equipment inspection to GAS:', err);
          }
        }

        // 2. Save snapshot into inspection history (once)
        const newRecord: InspectionHistoryRecord = {
          id: `eq_${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          date: now.toISOString().split('T')[0],
          type: 'eq',
          title: 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์ (ภาพรวมทุกห้อง)',
          who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
          rows: formattedEqItems,
        };
        setHistoryRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)].slice(0, 50));
        await saveInspectionToFirebase(newRecord).catch(() => {});

        // 3. Open OfficialReportModal with 'eq' tab active and eqItems populated
        setReportInitialRoundId(newRecord.id);
        setReportCategory('eq');
        setIsOfficialReportOpen(true);
      } finally {
        isSavingReportRef.current = false;
        setIsSavingReport(false);
      }
    };

    // Preview-only completion handler (opens Report Preview with snapshot, does NOT auto-submit to GAS, resets equipment checks)
    const handleConfirmEquipmentPreviewAndReset = async () => {
      if (isSavingReportRef.current) return;
      isSavingReportRef.current = true;
      setIsSavingReport(true);
      try {
        const now = new Date();
        const snapshotRows = formattedEqItems.map((row) => ({ ...row }));
        const newRecord: InspectionHistoryRecord = {
          id: `eq_${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          date: now.toISOString().split('T')[0],
          type: 'eq',
          title: 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์ (ภาพรวมทุกห้อง)',
          who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
          rows: snapshotRows,
        };
        setHistoryRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)].slice(0, 50));
        await saveInspectionToFirebase(newRecord).catch(() => {});

        // Reset all room equipment check states back to unchecked ('') for the next round
        setGlobalChecks((prev) => {
          const nextGlobal = { ...prev };
          ROOMS.forEach((r) => {
            if (r.m && nextGlobal[r.id]) {
              const resetRoomChecks: Record<string, CheckItemState> = {};
              Object.entries(nextGlobal[r.id]).forEach(([k, val]) => {
                resetRoomChecks[k] = {
                  ...val,
                  result: '',
                  note: '',
                };
              });
              nextGlobal[r.id] = resetRoomChecks;
            }
          });
          setStored(getChannelChecksKey(activeChannelId), nextGlobal);
          return nextGlobal;
        });

        setIsRoomDrawerOpen(false);
        setReportInitialRoundId(newRecord.id);
        setReportCategory('eq');
        setIsOfficialReportOpen(true);
      } finally {
        isSavingReportRef.current = false;
        setIsSavingReport(false);
      }
    };

    const handleSaveEmergencyAndPreview = async (
      type: 'bag' | 'cart' | 'ambulance' | string,
      week: number,
      weekDatesFromComponent: Record<number, string>
    ) => {
      if (isSavingReportRef.current) return;
      isSavingReportRef.current = true;
      setIsSavingReport(true);
      try {
        const now = new Date();
        // Use the latest dates from the component (which should be synced to global anyway)
        const rawWeekDates = weekDatesFromComponent || emergencyWeekDates[type] || {};
        const finalWeekDates: Record<number, string> = {};
        [1, 2, 3, 4, 5].forEach((w) => {
          if (rawWeekDates[w] !== undefined && rawWeekDates[w] !== null && String(rawWeekDates[w]).trim() !== '') {
            finalWeekDates[w] = String(rawWeekDates[w]).trim();
          }
        });
        const items = type === 'bag'
          ? formattedBagItems
          : type === 'ambulance'
          ? formattedAmbulanceItems
          : formattedCartItems;
        const title = type === 'bag'
          ? 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency'
          : type === 'ambulance'
          ? 'แบบฟอร์มตรวจสอบความพร้อม รถพยาบาลฉุกเฉิน (Ambulance)'
          : 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';

        // 1. Save to History (strictly once per click, deduplicated)
        const newRecord: InspectionHistoryRecord = {
          id: `${type}_wk${week}_${Date.now()}`,
          timestamp: new Date().toLocaleString('th-TH'),
          date: now.toISOString().split('T')[0],
          type: type as any,
          title: `${title} (สัปดาห์ที่ ${week})`,
          who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
          rows: items.map(it => {
            const rowObj: any = {
              ...it,
              val: it.res === 'ใช้งานได้' ? getRealTargetCheckValue(it as any) : (it.res === 'ใช้งานไม่ได้' ? '✗' : ''),
              weekVals: it.weekVals || {} // Snapshot ALL weeks' values cleanly
            };
            if (rowObj.subItemQuantities === undefined) delete rowObj.subItemQuantities;
            if (rowObj.subExps === undefined) delete rowObj.subExps;
            return rowObj;
          }),
          weekDates: finalWeekDates,
        };

        setHistoryRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)].slice(0, 50));
        await saveInspectionToFirebase(newRecord).catch(() => {});

        // 2. Open Modal
        setReportInitialRoundId(newRecord.id);
        setReportInitialWeek(week);
        setReportInitialWeekDates(finalWeekDates);
        setReportCategory(type as any);
        setIsOfficialReportOpen(true);
      } finally {
        isSavingReportRef.current = false;
        setIsSavingReport(false);
      }
    };

  // Bottom Sheet Drawer States for Google Sheets Config
  const [drawerActiveTab, setDrawerActiveTab] = useState<'sheets' | 'menu'>('sheets');
  const [inputSheetUrl, setInputSheetUrl] = useState<string>(sheetUrl);
  const [inputApiUrl, setInputApiUrl] = useState<string>(apiUrl);
  const [copiedGasCode, setCopiedGasCode] = useState(false);
  const [isTestingGas, setIsTestingGas] = useState(false);
  const [gasTestResult, setGasTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedConfigMsg, setSavedConfigMsg] = useState(false);
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  useEffect(() => {
    setInputSheetUrl(sheetUrl);
    setInputApiUrl(apiUrl);
  }, [sheetUrl, apiUrl, isDrawerOpen]);

  const handleSaveSheetsConfig = () => {
    const trimmedSheet = inputSheetUrl.trim();
    const trimmedApi = inputApiUrl.trim();
    setSheetUrl(trimmedSheet);
    setStoredString(STORAGE_KEYS.SHEET_URL, trimmedSheet);
    setApiUrl(trimmedApi);
    setStoredString(STORAGE_KEYS.API_URL, trimmedApi);
    setSavedConfigMsg(true);
    setTimeout(() => setSavedConfigMsg(false), 3000);
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_V5);
      setCopiedGasCode(true);
      setTimeout(() => setCopiedGasCode(false), 4000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = GAS_SCRIPT_V5;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedGasCode(true);
      setTimeout(() => setCopiedGasCode(false), 4000);
    }
  };

  const handleTestGasConnection = async () => {
    if (!inputApiUrl.trim()) {
      setGasTestResult({ ok: false, msg: 'กรุณากรอก Web App URL ของ Google Apps Script ก่อนกดทดสอบ' });
      return;
    }
    setIsTestingGas(true);
    setGasTestResult(null);
    try {
      const res = await testGasConnection(inputApiUrl.trim());
      setGasTestResult({ ok: res.ok, msg: res.message });
    } catch (e: any) {
      setGasTestResult({ ok: false, msg: e?.message || 'ไม่สามารถทดสอบการเชื่อมต่อได้' });
    } finally {
      setIsTestingGas(false);
    }
  };

  // Barcode / TMT / HIS Code Scanner Hook
  const {
    isBarcodeScannerOpen,
    setIsBarcodeScannerOpen,
    scannedItemResult,
    setScannedItemResult,
    scannedDrugQty,
    setScannedDrugQty,
    scannedCheckResult,
    setScannedCheckResult,
    scannedNote,
    setScannedNote,
    handleScanSuccess,
    handleSaveScannedDrug,
    handleSaveScannedCheck,
  } = useScanner({
    drugs,
    equipment,
    lists,
    globalChecks,
    onDrugsChange: handleDrugsChange,
    onToggleCheck: handleToggleCheck,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (!window.history.state || !window.history.state.app)) {
      window.history.replaceState({ app: true, view: 'home' }, '');
    }

    const handlePopState = () => {
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
      setIsBottomBarVisible(true);

      if (previewImage) {
        setPreviewImage(null);
        return;
      }
      if (zoomedImgUrl) {
        setZoomedImgUrl(null);
        return;
      }
      if (scannedItemResult) {
        setScannedItemResult(null);
        return;
      }
      if (pendingClearCategory) {
        setPendingClearCategory(null);
        return;
      }
      if (isBarcodeScannerOpen) {
        setIsBarcodeScannerOpen(false);
        return;
      }
      if (isOfficialReportOpen) {
        setIsOfficialReportOpen(false);
        return;
      }
      if (isAuraOpen) {
        setIsAuraOpen(false);
        window.dispatchEvent(new Event('close_aura_chat'));
        return;
      }
      if (isProfileOpen) {
        setIsProfileOpen(false);
        return;
      }
      if (isNotificationOpen) {
        setIsNotificationOpen(false);
        return;
      }
      if (isHaAuditModalOpen) {
        setIsHaAuditModalOpen(false);
        return;
      }
      if (isChannelModalOpen) {
        setIsChannelModalOpen(false);
        return;
      }
      if (isDrawerOpen) {
        if (drawerView === 'cloud') {
          setDrawerView('main');
          return;
        }
        setIsDrawerOpen(false);
        return;
      }

      if ((currentView === 'room_check' || currentView === 'eq_overview') && isRoomDrawerOpen) {
        setIsRoomDrawerOpen(false);
        setSelectedRoomId(null);
        return;
      }

      if (currentView !== 'home') {
        setSelectedRoomId(null);
        setCurrentView('home');
      } else if (typeof window !== 'undefined') {
        window.history.replaceState({ app: true, view: 'home' }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    currentView,
    isRoomDrawerOpen,
    isAuraOpen,
    isOfficialReportOpen,
    isBarcodeScannerOpen,
    isProfileOpen,
    isNotificationOpen,
    isHaAuditModalOpen,
    isChannelModalOpen,
    isDrawerOpen,
    previewImage,
    zoomedImgUrl,
    scannedItemResult,
    pendingClearCategory,
  ]);

  useEffect(() => {
    if (!previewImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      } else if (
        previewImage.images &&
        previewImage.images.length > 1 &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const total = previewImage.images.length;
        const curr = previewImage.currentIndex ?? 0;
        const nextIdx = e.key === 'ArrowRight' ? (curr + 1) % total : (curr - 1 + total) % total;
        const nextImg = previewImage.images[nextIdx];
        setPreviewImage({
          ...previewImage,
          url: nextImg.url,
          label: nextImg.label,
          currentIndex: nextIdx,
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewImage]);

  const isTopLevelModalActive = Boolean(
    isOfficialReportOpen ||
    isNotificationOpen ||
    isProfileOpen ||
    isBarcodeScannerOpen ||
    isDrawerOpen ||
    previewImage ||
    zoomedImgUrl ||
    isChannelModalOpen ||
    isAuraOpen ||
    isHaAuditModalOpen ||
    scannedItemResult ||
    pendingClearCategory
  );

  const isAnyModalActive = Boolean(isTopLevelModalActive || isExternalModalOpen);

  const shouldShowBottomBar = isBottomBarVisible && !isAnyModalActive;

  const prevModalActiveRef = useRef<boolean>(false);
  useEffect(() => {
    if (!prevModalActiveRef.current && isTopLevelModalActive) {
      pushHistoryLayer({ view: currentView, modal: true });
    }
    prevModalActiveRef.current = isTopLevelModalActive;
  }, [isTopLevelModalActive, currentView]);

  const isDark = theme === 'dark';

  return (
    <div
      ref={contentRef}
      className={`h-dvh w-full max-w-full overflow-x-hidden font-['TH_Sarabun_New','Sarabun',sans-serif] relative transition-colors duration-500 overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0E0F12] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >

      <link
        href="https://fonts.googleapis.com/css2?family=Teko:wght@700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        * { word-break: keep-all !important; letter-spacing: -0.2px; }
        .nowrap-unit { white-space: nowrap !important; }
        .font-valorant {
          font-family: 'Teko', sans-serif !important;
          text-transform: uppercase;
          line-height: 1 !important;
          letter-spacing: 1px !important;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Background Video (Soft Ambient Layer) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover ${
            isDark ? 'opacity-20 brightness-75' : 'opacity-12 brightness-100'
          }`}
        >
          <source
            src="https://assets.mixkit.co/videos/preview/mixkit-surgeons-during-an-operation-41539-large.mp4"
            type="video/mp4"
          />
        </video>
        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-b from-[#0E0F12]/85 via-[#0E0F12]/60 to-[#0E0F12]/95'
              : 'bg-gradient-to-b from-[#F2F4F8]/85 via-[#F2F4F8]/55 to-[#F2F4F8]/95'
          }`}
        />
      </div>

      {/* MAIN VIEW CONTENT CONTAINER (Single Scroll Container with uniform px-4 & Safe Area bottom padding; omit z-10 so child modals escape cleanly above z-30 bars) */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="relative w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-10 py-4 lg:py-8 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Unified Single Back Button on All Sub-views (GPU transform-only auto-hide without layout shift) */}
        {currentView !== 'home' && (
          <div
            aria-hidden={!isTopHeaderVisible}
            style={{
              willChange: 'transform, opacity',
              contain: 'layout style',
              transform: isTopHeaderVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, calc(-100% - 20px), 0)',
              transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
            }}
            className={`sticky top-0 z-30 flex items-center justify-between bg-white/95 dark:bg-[#181A20]/95 px-4 py-2.5 mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transform-gpu ${
              isTopHeaderVisible
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={handleUiBackToHome}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm transition-colors cursor-pointer active:opacity-80 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
              <span>กลับหน้าหลัก</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 min-w-0 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span className="truncate">
                {currentView === 'drug_check' && '💊 คลังยาและสารน้ำ'}
                {currentView === 'room_check' && '🩺 ครุภัณฑ์ประจำห้องผ่าตัด'}
                {currentView === 'bag_check' && '🎒 ตรวจเช็กกระเป๋าฉุกเฉิน'}
                {currentView === 'ambulance_check' && '🚑 ตรวจเช็กรถพยาบาลฉุกเฉิน'}
                {currentView === 'cart_check' && '🛒 ตรวจเช็กรถฉุกเฉิน'}
                {currentView === 'eq_overview' && '📋 ภาพรวมครุภัณฑ์วิสัญญี'}
              </span>
            </div>
          </div>
        )}

        {/* 1. HOME DASHBOARD */}
        {currentView === 'home' && (
          <ModernDashboard
            currentUser={currentUser}
            drugs={drugs}
            equipment={equipment}
            lists={lists}
            globalChecks={globalChecks}
            expiryAlerts={expiryAlerts}
            theme={theme}
            onToggleTheme={toggleTheme}
            activeCategory={activeCategory}
            activeCategoryIndex={activeCategoryIndex}
            onSelectCategory={(cat, idx) => setCategoryAndIndex(cat, idx)}
            onOpenChannelSelector={() => setIsChannelModalOpen(true)}
            onNavigate={(view) => {
              if (view === 'drug_check') {
                setCategoryAndIndex('medicine', 0);
              } else if (view === 'room_check' || view === 'eq_overview') {
                setSelectedRoomId(null);
                setCategoryAndIndex('equipment', 1);
              } else if (view === 'bag_check') {
                setCategoryAndIndex('bag', 2);
              } else if (view === 'ambulance_check') {
                setCategoryAndIndex('ambulance', 3);
              } else if (view === 'cart_check') {
                setCategoryAndIndex('cart', 4);
              }
              changeView(view as any);
            }}
            onSelectRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setCategoryAndIndex('equipment', 1);
              setIsRoomDrawerOpen(true);
              pushHistoryLayer({ view: 'room_check', roomDrawer: true });
              setCurrentView('room_check');
            }}
            onOpenNotifications={() => setIsNotificationOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenReport={() => {
              setReportCategory('eq');
              setIsOfficialReportOpen(true);
            }}
            onOpenSheets={() => {
              setIsSheetsAccordionOpen(true);
              setIsDrawerOpen(true);
            }}
            onToggleCheck={handleToggleCheck}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            overallStats={overallStats}
          />
        )}

        {/* 2. DRUG & INVENTORY CHECK */}
        {currentView === 'drug_check' && (
          <DrugInventoryView
            currentUser={currentUser}
            onBack={handleUiBackToHome}
            sheetUrl={sheetUrl}
            apiUrl={apiUrl}
            drugs={drugs}
            onDrugsChange={handleDrugsChange}
            onOpenPreview={() => {
              setReportCategory('drug');
              setIsOfficialReportOpen(true);
            }}
          />
        )}

        {/* 3. EMERGENCY BAG CHECK (กระเป๋าฉุกเฉิน Checklist View) */}
        {currentView === 'bag_check' && (
          <EmergencyChecklistView
            type="bag"
            title="ตรวจเช็กกระเป๋าฉุกเฉิน (Emergency Bag)"
            subtitle="ตรวจสอบอุปกรณ์และยาฉุกเฉินประจำกระเป๋า"
            listConfig={lists.bag}
            checks={globalChecks['bag'] || {}}
            onToggleCheck={(itemKey, result, itemName, week, isMass, custom) =>
              handleToggleCheck('bag', itemKey, result, itemName, week, isMass, custom)
            }
            onUpdateNote={(itemKey, note) => handleUpdateNote('bag', itemKey, note)}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            onBack={handleUiBackToHome}
            onAddItem={(newItem) => handleAddItem('bag', newItem)}
            onDeleteItem={handleDeleteItem}
            onEditItem={(item) => handleEditItem('bag', item)}
            weekDates={emergencyWeekDates.bag}
            onWeekDatesChange={(dates) => {
              const updated = { ...emergencyWeekDates, bag: dates };
              setEmergencyWeekDates(updated);
              setStored(STORAGE_KEYS.EMER_WEEK_DATES, updated);
            }}
            onSaveByWeek={(week, dates) => handleSaveEmergencyAndPreview('bag', week, dates)}
            onClearWeekChecks={(week) => handleClearEmergencyWeek('bag', week)}
            isSavingReport={isSavingReport}
            onClearAll={handleAuraClearInventory}
            isVisible={isBottomBarVisible}
          />
        )}

        {/* 4. CRASH CART CHECK (รถฉุกเฉิน Checklist View) */}
        {currentView === 'cart_check' && (
          <EmergencyChecklistView
            type="cart"
            title="ตรวจเช็กรถฉุกเฉิน (Crash Cart)"
            subtitle="ตรวจสอบอุปกรณ์และยาประจำรถเข็นฉุกเฉินแต่ละชั้น"
            listConfig={lists.cart}
            checks={globalChecks['cart'] || {}}
            onToggleCheck={(itemKey, result, itemName, week, isMass, custom) =>
              handleToggleCheck('cart', itemKey, result, itemName, week, isMass, custom)
            }
            onUpdateNote={(itemKey, note) => handleUpdateNote('cart', itemKey, note)}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            onBack={handleUiBackToHome}
            onAddItem={(newItem) => handleAddItem('cart', newItem)}
            onDeleteItem={handleDeleteItem}
            onEditItem={(item) => handleEditItem('cart', item)}
            weekDates={emergencyWeekDates.cart}
            onWeekDatesChange={(dates) => {
              const updated = { ...emergencyWeekDates, cart: dates };
              setEmergencyWeekDates(updated);
              setStored(STORAGE_KEYS.EMER_WEEK_DATES, updated);
            }}
            onSaveByWeek={(week, dates) => handleSaveEmergencyAndPreview('cart', week, dates)}
            onClearWeekChecks={(week) => handleClearEmergencyWeek('cart', week)}
            isSavingReport={isSavingReport}
            onClearAll={handleAuraClearInventory}
            isVisible={isBottomBarVisible}
          />
        )}

        {/* 4.5. AMBULANCE CHECK (รถพยาบาลฉุกเฉิน Checklist View) */}
        {currentView === 'ambulance_check' && (
          <EmergencyChecklistView
            type="ambulance"
            title="ตรวจเช็กรถพยาบาลฉุกเฉิน (Ambulance)"
            subtitle="ตรวจสอบอุปกรณ์ช่วยหายใจ ออกซิเจน และเวชภัณฑ์บนรถพยาบาล"
            listConfig={lists.ambulance || lists.cart}
            checks={globalChecks['ambulance'] || {}}
            onToggleCheck={(itemKey, result, itemName, week, isMass, custom) =>
              handleToggleCheck('ambulance', itemKey, result, itemName, week, isMass, custom)
            }
            onUpdateNote={(itemKey, note) => handleUpdateNote('ambulance', itemKey, note)}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            onBack={handleUiBackToHome}
            onAddItem={(newItem) => handleAddItem('ambulance', newItem)}
            onDeleteItem={handleDeleteItem}
            onEditItem={(item) => handleEditItem('ambulance', item)}
            weekDates={emergencyWeekDates.ambulance}
            onWeekDatesChange={(dates) => {
              const updated = { ...emergencyWeekDates, ambulance: dates };
              setEmergencyWeekDates(updated);
              setStored(STORAGE_KEYS.EMER_WEEK_DATES, updated);
            }}
            onSaveByWeek={(week, dates) => handleSaveEmergencyAndPreview('ambulance', week, dates)}
            onClearWeekChecks={(week) => handleClearEmergencyWeek('ambulance', week)}
            isSavingReport={isSavingReport}
            onClearAll={handleAuraClearInventory}
            isVisible={isBottomBarVisible}
          />
        )}

        {/* 5. ROOM EQUIPMENT CHECK (ผังห้องผ่าตัด FLOOR MAP - Clean Unified Layout) */}
        {(currentView === 'room_check' || currentView === 'eq_overview') && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <FloorMap
              rooms={ROOMS}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(id) => setSelectedRoomId(id)}
              equipment={equipment}
              globalChecks={globalChecks}
              theme={theme}
              onToggleCheck={handleToggleCheck}
              onUpdateNote={handleUpdateNote}
              onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
              onOpenReport={handleSaveEquipmentAndPreview}
              onPreviewAndReset={handleConfirmEquipmentPreviewAndReset}
              isDrawerOpen={isRoomDrawerOpen}
              onDrawerOpenChange={handleRoomDrawerOpenChange}
              onEditEquipment={handleEditRoomEquipment}
              onDeleteEquipment={handleDeleteRoomEquipment}
              onClearAllEquipment={() => handleAuraClearInventory('ครุภัณฑ์')}
            />
          </div>
        )}
      </main>

      {/* 📂 SAMSUNG ONE UI DRAWER (Bottom Sheet on Mobile, Slide-in Right Drawer Panel on Desktop) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end bg-black/65 transition-opacity duration-200"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className={`w-full max-w-lg lg:max-w-[380px] lg:w-[360px] max-h-[85dvh] lg:max-h-full rounded-t-[2rem] lg:rounded-t-none lg:rounded-l-[2rem] flex flex-col border-t border-x lg:border-t-0 lg:border-l lg:border-y-0 shadow-xl overflow-hidden relative ${
              isDark
                ? 'bg-[#181A20] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
            style={{
              transform: drawerDragY > 0 ? `translateY(${drawerDragY}px)` : isDrawerMounted ? 'translate(0, 0)' : 'translateY(100%)',
              transition: drawerDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Bar for Mobile Only - Only this handle bar handles touch drag down */}
            <div
              className="lg:hidden w-full pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none flex-none"
              onTouchStart={handleTouchStartDrawer}
              onTouchMove={handleTouchMoveDrawer}
              onTouchEnd={handleTouchEndDrawer}
            >
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors" />
            </div>

            {/* Bottom Sheet Header - Fixed (flex-none) */}
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex-none">
              {drawerView === 'cloud' ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setDrawerView('main')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer active:scale-95 shrink-0"
                  >
                    <ArrowLeft size={15} />
                    <span>ย้อนกลับ</span>
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <Cloud size={17} className="text-blue-500 shrink-0" />
                    <h3 className="text-sm font-bold truncate dark:text-white">
                      ระบบ Cloud & การเชื่อมต่อ
                    </h3>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center gap-3 p-1.5 -m-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left group active:opacity-80"
                  title="คลิกเพื่อแก้ไขรูปโปรไฟล์และข้อมูลผู้ใช้"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#3B82F6] text-white font-bold flex items-center justify-center text-sm shadow-md group-hover:scale-105 transition-transform">
                      {currentUser?.name?.charAt(0) || 'A'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#181A20] rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-none group-hover:text-blue-500 transition-colors">
                      {currentUser?.name || 'ผู้ใช้งาน'}
                    </h3>
                    <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full font-bold inline-block mt-0.5">
                      แก้ไขโปรไฟล์
                    </span>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:opacity-80 transition cursor-pointer shrink-0"
                title="ปิด"
              >
                <X size={16} />
              </button>
            </div>

            {/* Menu Content - Scrollable Body (flex-1 overflow-y-auto overscroll-contain) */}
            {drawerView === 'main' ? (
              <div className="p-6 overflow-y-auto flex-1 overscroll-contain space-y-3.5">
                {/* 1. Accordion Toggle Button สำหรับ "ตั้งค่าการเชื่อมต่อ Google Sheets" */}
                <button
                  type="button"
                  onClick={() => setIsSheetsAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <FileSpreadsheet size={18} className="text-emerald-500" />
                    <span>ตั้งค่าการเชื่อมต่อ Google Sheets</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-200 ${
                      isSheetsAccordionOpen ? 'rotate-180 text-blue-500' : ''
                    }`}
                  />
                </button>

                {/* Accordion Collapsible Content */}
                {isSheetsAccordionOpen && (
                  <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-md">
                    <GoogleSheetsSettings
                      sheetUrl={sheetUrl}
                      apiUrl={apiUrl}
                      isDark={isDark}
                      onSave={(newApi: string, newSheet: string) => {
                        setSheetUrl(newSheet);
                        setStoredString(STORAGE_KEYS.SHEET_URL, newSheet);
                        setApiUrl(newApi);
                        setStoredString(STORAGE_KEYS.API_URL, newApi);
                        setInputSheetUrl(newSheet);
                        setInputApiUrl(newApi);
                      }}
                    />
                  </div>
                )}

                {/* 3. หัวข้อหลัก Cloud สำหรับกดเข้าไปดูรายละเอียด & เชื่อมต่อ */}
                <button
                  type="button"
                  onClick={() => {
                    setDrawerView('cloud');
                    if (firebaseUser && !firebaseTestResult) {
                      void handleTestFirebaseConnection();
                    } else {
                      void fetchStorageUsage();
                    }
                  }}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl text-sm font-bold bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/12 text-blue-500 shrink-0">
                      <Cloud size={18} />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="truncate">ระบบคลาวด์ (Cloud)</div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        ซิงค์ข้อมูล & พื้นที่จัดเก็บ
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        firebaseTestResult?.status === 'offline' || firebaseTestResult?.status === 'error'
                          ? 'bg-rose-500/15 text-rose-500'
                          : isAuthenticated
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {firebaseTestResult?.status === 'offline' || firebaseTestResult?.status === 'error'
                        ? 'Offline'
                        : isAuthenticated
                        ? 'Online'
                        : 'ยังไม่ล็อกอิน'}
                    </span>
                    <ChevronRight size={18} className="text-slate-400" />
                  </div>
                </button>

                {/* 4. สลับธีม */}
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    {isDark ? <Moon size={18} className="text-indigo-500" /> : <Sun size={18} className="text-amber-500" />}
                    <span>สลับธีม ({isDark ? 'โหมดมืด' : 'โหมดสว่าง'})</span>
                  </div>
                  <span className="text-xs text-[#3B82F6] font-bold">สลับ</span>
                </button>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto flex-1 overscroll-contain space-y-3.5 animate-in fade-in duration-200">
                <div className="px-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                    <span>Google Cloud Account & Sync</span>
                  </h4>
                </div>

                {/* Google Sign-In / Sign-Out Card */}
                <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  {isAuthenticated && firebaseUser ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {firebaseUser.photoURL ? (
                            <img
                              src={firebaseUser.photoURL}
                              alt={firebaseUser.displayName || 'Google Avatar'}
                              className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                              <ShieldCheck size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold dark:text-white truncate">
                              {firebaseUser.displayName || currentUser.name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {firebaseUser.email}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                          {isAdmin ? 'Admin' : 'Cloud'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={signOut}
                        className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? 'กำลังออกจากระบบ...' : 'ออกจากระบบบัญชี Google'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold dark:text-white">โหมดออฟไลน์</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            ล็อกอิน Google เพื่อซิงค์ Cloud
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={async () => {
                          const user = await signInWithGoogle();
                          if (user) {
                            await handleTestFirebaseConnection();
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
                      </button>
                    </div>
                  )}
                  {authError && (
                    <p className="mt-2 text-[10px] font-semibold text-rose-500">{authError}</p>
                  )}
                </div>

                {/* สถานะคลาวด์ & การซิงค์ข้อมูล */}
                <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-blue-50/40 border-blue-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                        <RefreshCw size={18} className={isTestingFirebase ? 'animate-spin' : ''} />
                      </div>
                      <div>
                        <p className="text-xs font-bold dark:text-white">สถานะคลาวด์</p>
                        <p className="text-[9px] text-slate-500">Firestore Sync</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        firebaseTestResult
                          ? firebaseTestResult.ok
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : firebaseTestResult.status === 'needs_auth'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                          : isAuthenticated
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}
                    >
                      {firebaseTestResult
                        ? firebaseTestResult.ok
                          ? 'Online'
                          : firebaseTestResult.status === 'needs_auth'
                          ? 'ยังไม่ล็อกอิน'
                          : 'Error'
                        : isAuthenticated
                        ? 'Online'
                        : 'Local'}
                    </span>
                  </div>

                  {firebaseTestResult && (
                    <div
                      className={`mb-2.5 p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 ${
                        firebaseTestResult.ok
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : firebaseTestResult.status === 'needs_auth'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {firebaseTestResult.ok ? (
                        <Check size={14} className="mt-0.5 shrink-0" />
                      ) : firebaseTestResult.status === 'needs_auth' ? (
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      ) : (
                        <X size={14} className="mt-0.5 shrink-0" />
                      )}
                      <span>{firebaseTestResult.msg}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isTestingFirebase}
                    onClick={handleTestFirebaseConnection}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={14} className={isTestingFirebase ? 'animate-spin' : ''} />
                    <span>{isTestingFirebase ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                  </button>

                  <a
                    href={`https://console.firebase.google.com/project/galvanic-crow-v83d0/firestore/databases/ai-studio-anesthesiacare-980ed80f-6020-4ed3-a9ce-1f56075434f1/data`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-[11px] font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>เปิด Firebase Console</span>
                  </a>
                </div>

                {/* พื้นที่จัดเก็บข้อมูล (Cloud Storage): Firebase Firestore, Storage & GitHub Repository */}
                <div className={`p-4 rounded-2xl border transition-colors space-y-3.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  {(() => {
                    const formatStorageUsed = (bytes?: number, fallbackMB = 0) => {
                      const safeBytes =
                        typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0
                          ? bytes
                          : Math.max(0, fallbackMB * 1024 * 1024);
                      if (safeBytes < 1024 * 1024) {
                        return `${(safeBytes / 1024).toFixed(2)} KB`;
                      }
                      return `${(safeBytes / (1024 * 1024)).toFixed(2)} MB`;
                    };

                    const formatPercent = (pct: number) => {
                      if (!pct || pct <= 0) return '0%';
                      if (pct < 0.01) return `${pct.toFixed(3)}%`;
                      return `${pct.toFixed(2)}%`;
                    };

                    const getBarColorClass = (pct: number, normalClass: string) => {
                      if (pct > 90) return 'bg-rose-500';
                      if (pct > 70) return 'bg-amber-500';
                      return normalClass;
                    };

                    const fb = storageUsage?.firebase || {
                      usedBytes: 0,
                      usedKB: 0,
                      usedMB: 0,
                      totalMB: 1024,
                      percent: 0,
                      docCount: 0,
                    };
                    const fbStorage = storageUsage?.firebaseStorage || {
                      usedBytes: 0,
                      usedKB: 0,
                      usedMB: 0,
                      totalMB: 5120,
                      percent: 0,
                      fileCount: 0,
                      mode: 'inline' as const,
                      bucketAvailable: false,
                    };
                    const gh = storageUsage?.github || {
                      usedBytes: 0,
                      usedKB: 0,
                      usedMB: 0,
                      totalMB: 1024,
                      percent: 0,
                      repoName: 'time165311-bot/checktest',
                    };

                    const fbBytes = fb.usedBytes ?? Math.round((fb.usedMB || 0) * 1024 * 1024);
                    const fbStorageBytes = fbStorage.usedBytes ?? Math.round((fbStorage.usedMB || 0) * 1024 * 1024);
                    const isBucketAvailable = fbStorage.mode === 'bucket' && fbStorage.bucketAvailable !== false;
                    const totalFirebaseBytes = isBucketAvailable ? fbBytes + fbStorageBytes : fbBytes;
                    const ghBytes = gh.usedBytes ?? Math.round((gh.usedMB || 0) * 1024 * 1024);

                    const fbBarColor = getBarColorClass(fb.percent, 'bg-emerald-500');
                    const fbStorageBarColor = getBarColorClass(fbStorage.percent, 'bg-violet-500');
                    const ghBarColor = getBarColorClass(gh.percent, 'bg-blue-500');

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                              <HardDrive size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold dark:text-white truncate">
                                พื้นที่จัดเก็บข้อมูล (Cloud Storage)
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {storageUsage
                                  ? `รวม Firebase: ${formatStorageUsed(totalFirebaseBytes)} • GitHub Repo`
                                  : 'Firebase Firestore, Storage & GitHub'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isLoadingStorage}
                            onClick={() => void fetchStorageUsage()}
                            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0 ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="รีเฟรชยอดความจุล่าสุด"
                          >
                            <RefreshCw size={13} className={isLoadingStorage ? 'animate-spin text-blue-500' : ''} />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Firebase Firestore Usage */}
                          <div className={`p-3 rounded-xl border space-y-1.5 ${isDark ? 'bg-[#13151A] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                                <Database size={13} className="text-emerald-500 shrink-0" />
                                <span>Firebase Firestore</span>
                              </span>
                              <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300 text-right">
                                {isLoadingStorage && !storageUsage
                                  ? 'กำลังคำนวณ...'
                                  : `${formatStorageUsed(fbBytes, fb.usedMB)} / ${fb.totalMB.toLocaleString()} MB (${formatPercent(fb.percent)})`}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${fbBarColor}`}
                                style={{ width: `${Math.min(100, Math.max(fbBytes > 0 ? 2 : 0, fb.percent))}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="tabular-nums">จำนวนข้อมูลทั้งหมด: {fb.docCount.toLocaleString()} รายการ</span>
                              <span>Spark Plan (1 GB)</span>
                            </div>
                            {fb.percent > 90 && (
                              <p className="text-[10px] font-bold text-rose-500">
                                ⚠️ พื้นที่ใกล้เต็ม แนะนำให้ลดขนาดรูปภาพที่เก็บในฐานข้อมูล
                              </p>
                            )}
                            {fb.error && (
                              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {fb.error}
                              </p>
                            )}
                          </div>

                          {/* Embedded Media Usage in Firestore */}
                          <div className={`p-3 rounded-xl border space-y-1.5 ${isDark ? 'bg-[#13151A] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                                <ImageIcon size={13} className="text-violet-500 shrink-0" />
                                <span>รูปภาพ & สื่อมีเดีย (Media)</span>
                              </span>
                              <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300 text-right">
                                {isLoadingStorage && !storageUsage
                                  ? 'กำลังคำนวณ...'
                                  : `${formatStorageUsed(fbStorageBytes, fbStorage.usedMB)} / ${fbStorage.totalMB.toLocaleString()} MB (${formatPercent(fbStorage.percent)})`}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${fbStorageBarColor}`}
                                style={{ width: `${Math.min(100, Math.max(fbStorageBytes > 0 ? 2 : 0, fbStorage.percent))}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="tabular-nums">ไฟล์รูปภาพ/สื่อทั้งหมด: {fbStorage.fileCount.toLocaleString()} ไฟล์</span>
                              <span>จัดเก็บใน Firestore</span>
                            </div>
                            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              ✓ จัดเก็บรูปและลายเซ็นใน Firestore
                            </p>
                          </div>

                          {/* GitHub Repository Usage */}
                          <div className={`p-3 rounded-xl border space-y-1.5 ${isDark ? 'bg-[#13151A] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100 truncate">
                                <GitBranch size={13} className="text-blue-500 shrink-0" />
                                <span className="truncate">GitHub Repository</span>
                              </span>
                              <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                                {isLoadingStorage && !storageUsage
                                  ? 'กำลังโหลด...'
                                  : `${formatStorageUsed(ghBytes, gh.usedMB)} / ${gh.totalMB.toLocaleString()} MB (${formatPercent(gh.percent)})`}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${ghBarColor}`}
                                style={{ width: `${Math.min(100, Math.max(ghBytes > 0 ? 2 : 0, gh.percent))}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="truncate">{gh.repoName}</span>
                              <span className="shrink-0">
                                {gh.fetchedAt
                                  ? `อัปเดต ${new Date(gh.fetchedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                                  : 'Limit 1 GB'}
                              </span>
                            </div>
                            {gh.percent > 90 && (
                              <p className="text-[10px] font-bold text-rose-500">
                                ⚠️ พื้นที่ GitHub ใกล้เกินขีดจำกัดแนะนำแล้วค่ะ
                              </p>
                            )}
                            {gh.error && (
                              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {gh.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONE UI BOTTOM NAVIGATION BAR */}
      <BottomBar
        currentView={currentView}
        theme={theme}
        sheetUrl={sheetUrl}
        onToggleTheme={toggleTheme}
        onNavigate={(view) => changeView(view as any)}
        onOpenReport={() => {
          setReportCategory('eq');
          setIsOfficialReportOpen(true);
        }}
        onOpenGoogleSheet={() => {
          setDrawerActiveTab('sheets');
          setIsSheetsAccordionOpen(true);
          setIsDrawerOpen(true);
        }}
        onOpenDrawer={() => {
          setDrawerActiveTab('menu');
          setIsDrawerOpen(true);
        }}
        onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
        isDrawerOpen={isDrawerOpen}
        isVisible={shouldShowBottomBar}
      />

      {/* FULLSCREEN IMAGE LIGHTBOX PREVIEW MODAL (Aura Chat & Staging Attachments) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top Bar: Counter / Label & Close X */}
          <div className="fixed top-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 max-w-[75vw]">
              {previewImage.images && previewImage.images.length > 1 && (
                <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold tabular-nums shrink-0">
                  รูปที่ {(previewImage.currentIndex ?? 0) + 1} / {previewImage.images.length}
                </span>
              )}
              {previewImage.label && (
                <span className="px-3 py-1.5 rounded-full bg-black/60 border border-white/15 text-slate-200 text-xs truncate">
                  {previewImage.label}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              className="pointer-events-auto p-2.5 rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 shadow-lg cursor-pointer transition active:scale-90"
              title="ปิดรูปภาพ"
            >
              <X size={20} />
            </button>
          </div>

          {/* Left Navigation Arrow */}
          {previewImage.images && previewImage.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const list = previewImage.images!;
                const curr = previewImage.currentIndex ?? 0;
                const prevIdx = (curr - 1 + list.length) % list.length;
                const prevItem = list[prevIdx];
                setPreviewImage({
                  ...previewImage,
                  url: prevItem.url,
                  label: prevItem.label,
                  currentIndex: prevIdx,
                });
              }}
              className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-2.5 sm:p-3 rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 shadow-xl cursor-pointer transition active:scale-90"
              title="รูปก่อนหน้า"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Full-resolution Image */}
          <img
            src={previewImage.url}
            alt={previewImage.label || 'Preview'}
            onClick={(e) => e.stopPropagation()}
            className="object-contain max-h-[85vh] max-w-[95vw] rounded-2xl shadow-2xl border border-white/10 select-none"
          />

          {/* Right Navigation Arrow */}
          {previewImage.images && previewImage.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const list = previewImage.images!;
                const curr = previewImage.currentIndex ?? 0;
                const nextIdx = (curr + 1) % list.length;
                const nextItem = list[nextIdx];
                setPreviewImage({
                  ...previewImage,
                  url: nextItem.url,
                  label: nextItem.label,
                  currentIndex: nextIdx,
                });
              }}
              className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-2.5 sm:p-3 rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 shadow-xl cursor-pointer transition active:scale-90"
              title="รูปถัดไป"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}

      {/* ZOOMED IMAGE PREVIEW MODAL WITH ROTATION AND SAVE */}
      {zoomedImgUrl && (
        <ImageModal
          isOpen={!!zoomedImgUrl}
          imageUrl={zoomedImgUrl}
          onClose={() => setZoomedImgUrl(null)}
          onSave={handleSaveRotatedImage}
        />
      )}

      {/* SYSTEM MODALS */}
      {isOfficialReportOpen && (
        <OfficialReportModal
          isOpen={isOfficialReportOpen}
          onClose={() => {
            setIsOfficialReportOpen(false);
            setReportInitialWeek(undefined);
            setReportInitialWeekDates(undefined);
            setReportInitialRoundId(undefined);
          }}
          initialCategory={reportCategory}
          initialRoundId={reportInitialRoundId}
          initialWeek={reportInitialWeek}
          initialWeekDates={reportInitialWeekDates}
          eqItems={formattedEqItems}
          bagItems={formattedBagItems}
          cartItems={formattedCartItems}
          ambulanceItems={formattedAmbulanceItems}
          items={formattedEqItems}
          drugs={drugs}
          apiUrl={apiUrl}
          sheetUrl={sheetUrl}
          currentUser={currentUser}
          historyRecords={historyRecords}
          onDeleteHistoryRecord={async (recId, recCategory) => {
            setHistoryRecords((prev) => prev.filter((r) => r.id !== recId));
            await deleteInspectionFromFirebase(recId);
            const targetCat = recCategory || reportCategory;
            setIsOfficialReportOpen(false);
            setReportInitialWeek(undefined);
            setReportInitialWeekDates(undefined);
            setReportInitialRoundId(undefined);
            if (targetCat === 'bag') {
              setCategoryAndIndex('bag', 2);
              changeView('bag_check');
            } else if (targetCat === 'ambulance') {
              setCategoryAndIndex('ambulance', 3);
              changeView('ambulance_check');
            } else if (targetCat === 'cart') {
              setCategoryAndIndex('cart', 4);
              changeView('cart_check');
            } else if (targetCat === 'drug') {
              setCategoryAndIndex('medicine', 0);
              changeView('drug_check');
            } else {
              setCategoryAndIndex('equipment', 1);
              changeView('room_check');
            }
            triggerGameToast('ลบประวัติเรียบร้อย!');
          }}
          onDeleteAllHistoryRecords={async (category, recordIds) => {
            if (!recordIds || recordIds.length === 0) return;
            const idSet = new Set(recordIds);
            setHistoryRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
            await deleteBatchInspectionsFromFirebase(recordIds);
            setIsOfficialReportOpen(false);
            setReportInitialWeek(undefined);
            setReportInitialWeekDates(undefined);
            setReportInitialRoundId(undefined);
            if (category === 'bag') {
              setCategoryAndIndex('bag', 2);
              changeView('bag_check');
            } else if (category === 'ambulance') {
              setCategoryAndIndex('ambulance', 3);
              changeView('ambulance_check');
            } else if (category === 'cart') {
              setCategoryAndIndex('cart', 4);
              changeView('cart_check');
            } else if (category === 'drug') {
              setCategoryAndIndex('medicine', 0);
              changeView('drug_check');
            } else {
              setCategoryAndIndex('equipment', 1);
              changeView('room_check');
            }
            triggerGameToast('ลบประวัติทั้งหมดเรียบร้อย!');
          }}
        />
      )}

      {/* HA / JCI AUDIT REPORT & ACTIVITY TRAIL MODAL */}
      <HaAuditReportModal
        isOpen={isHaAuditModalOpen}
        onClose={() => setIsHaAuditModalOpen(false)}
        currentUser={currentUser}
        drugs={drugs}
        equipment={equipment}
        activeChannelName={activeChannel?.name || 'ห้องผ่าตัด OR (Master)'}
      />

      {isBarcodeScannerOpen && (
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}

      {/* ⚠️ Bulk Clear Inventory Confirmation Modal */}
      {pendingClearCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#1E2024] rounded-3xl p-6 pb-7 shadow-2xl border border-rose-500/30 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 rounded-2xl bg-rose-500/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">ยืนยันการล้างข้อมูลยกชุด</h3>
                <p className="text-xs text-rose-500 font-semibold">การกระทำนี้จะลบข้อมูลและไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              น้องออร่าได้รับคำสั่งให้ล้างรายการทั้งหมดในหมวด <span className="font-bold text-rose-600 dark:text-rose-400">"{pendingClearCategory}"</span> คุณแน่ใจหรือไม่ว่าต้องการดำเนินการ? ข้อมูลจะถูกลบและบันทึกใน Audit Log
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPendingClearCategory(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => executeAuraClearInventory(pendingClearCategory)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 Barcode Quick Action Sheet Modal */}
      {scannedItemResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#1C1F26] rounded-3xl p-6 pb-7 shadow-2xl border border-blue-500/20 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
                  <Barcode className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {scannedItemResult.code}
                    </span>
                    {scannedItemResult.found ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> พบข้อมูล
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                        ไม่พบในระบบ
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    ผลการสแกนบาร์โค้ด
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setScannedItemResult(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content when Found */}
            {scannedItemResult.found ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      {scannedItemResult.type === 'drug' && '💊 คลังยาและสารน้ำ'}
                      {scannedItemResult.type === 'equipment' && `🩺 ครุภัณฑ์ประจำห้อง (${scannedItemResult.roomId?.toUpperCase()})`}
                      {scannedItemResult.type === 'bag' && '🎒 กระเป๋าฉุกเฉิน'}
                      {scannedItemResult.type === 'cart' && '🛒 รถฉุกเฉิน'}
                    </span>
                    {scannedItemResult.groupName && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        • {scannedItemResult.groupName}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    {scannedItemResult.item?.name}
                  </h4>
                  {scannedItemResult.item?.spec && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ขนาด/สเปก: {scannedItemResult.item.spec}
                    </p>
                  )}
                  {scannedItemResult.item?.exp && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                      วันหมดอายุ: {scannedItemResult.item.exp}
                    </p>
                  )}
                </div>

                {/* Drug Quick Stock Adjustment */}
                {scannedItemResult.type === 'drug' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        ปรับปรุงจำนวนคงเหลือ:
                      </span>
                      <span className="text-xs text-slate-400">
                        หน่วย: {scannedItemResult.item?.unit || 'ชิ้น'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-4 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                      <button
                        onClick={() => setScannedDrugQty((prev) => Math.max(0, prev - 1))}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xl flex items-center justify-center shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={scannedDrugQty}
                        onChange={(e) => setScannedDrugQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-24 text-center text-2xl font-black bg-transparent text-blue-600 dark:text-blue-400 focus:outline-none"
                      />
                      <button
                        onClick={() => setScannedDrugQty((prev) => prev + 1)}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xl flex items-center justify-center shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handleSaveScannedDrug();
                          changeView('drug_check');
                        }}
                        className="flex-1 py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" /> ดูในคลังยา
                      </button>
                      <button
                        onClick={handleSaveScannedDrug}
                        className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer"
                      >
                        บันทึกจำนวนคงเหลือ
                      </button>
                    </div>
                  </div>
                )}

                {/* Equipment / Bag / Cart Check Quick Action */}
                {scannedItemResult.type !== 'drug' && (
                  <div className="space-y-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      ลงผลการตรวจเช็ก:
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setScannedCheckResult('ปกติ')}
                        className={`py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition cursor-pointer ${
                          scannedCheckResult === 'ปกติ'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Check className="w-4 h-4" /> ปกติ
                      </button>
                      <button
                        onClick={() => setScannedCheckResult('ผิดปกติ')}
                        className={`py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition cursor-pointer ${
                          scannedCheckResult === 'ผิดปกติ'
                            ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <X className="w-4 h-4" /> ผิดปกติ
                      </button>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                        value={scannedNote}
                        onChange={(e) => setScannedNote(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSaveScannedCheck}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer"
                    >
                      บันทึกผลการตรวจสอบทันที
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Content when Not Found */
              <div className="space-y-4 py-2 text-center">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <Barcode className="w-8 h-8 opacity-60" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    ไม่พบรายการที่มีรหัสนี้ในระบบ
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    รหัสบาร์โค้ด: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{scannedItemResult.code}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => {
                      setScannedItemResult(null);
                      changeView('drug_check');
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    ➕ เพิ่มเข้าคลังยาใหม่
                  </button>
                  <button
                    onClick={() => {
                      setScannedItemResult(null);
                      setIsBarcodeScannerOpen(true);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                  >
                    🔄 ลองสแกนใหม่
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isNotificationOpen && (
        <NotificationModal
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          alerts={expiryAlerts}
          onOpenReport={() => {
            setIsNotificationOpen(false);
            setReportCategory('eq');
            setIsOfficialReportOpen(true);
          }}
        />
      )}

      {isProfileOpen && currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          historyRecords={historyRecords}
          onUpdateAvatar={(newAvatar) => {
            const updated = { ...currentUser, avatar: newAvatar };
            setCurrentUser(updated);
            setStored(STORAGE_KEYS.SESSION, updated);
            const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
            setAllUsers(nextUsers);
            setStored(STORAGE_KEYS.USERS, nextUsers);
          }}
          onUpdatePosition={(newPos) => {
            const updated = { ...currentUser, position: newPos };
            setCurrentUser(updated);
            setStored(STORAGE_KEYS.SESSION, updated);
            const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
            setAllUsers(nextUsers);
            setStored(STORAGE_KEYS.USERS, nextUsers);
          }}
          onUpdateSignature={(newSig) => {
            const updated = { ...currentUser, signature: newSig };
            setCurrentUser(updated);
            setStored(STORAGE_KEYS.SESSION, updated);
            const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
            setAllUsers(nextUsers);
            setStored(STORAGE_KEYS.USERS, nextUsers);
          }}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            setStored(STORAGE_KEYS.SESSION, updated);
            if (updated.name) {
              localStorage.setItem('user_display_name', updated.name);
            }
            if (updated.position) {
              localStorage.setItem('user_display_position', updated.position);
            }
            const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
            setAllUsers(nextUsers);
            setStored(STORAGE_KEYS.USERS, nextUsers);
            saveUserToFirebase(updated).catch((err) => console.warn('Firebase user sync:', err));
          }}
        />
      )}

      {/* 🌟 AI Assistant "AURA" Voice Chat & Function Calling */}
      <AuraAssistant
        equipment={equipment}
        drugs={drugs}
        lists={lists}
        globalChecks={globalChecks}
        stats={overallStats}
        currentView={currentView}
        onAddItem={(type, newItem) => handleAddItem(type, newItem)}
        onDeleteItem={(type, key) => handleDeleteItem(type, key)}
        onBulkAutoCheck={handleAuraBulkAutoCheck}
        onAutoFillChecks={handleAutoFillChecks}
        onRestockRequest={handleRestockRequest}
        onCaptureSnapshot={createAuraSnapshot}
        onRestoreSnapshot={restoreAuraSnapshot}
        onDirectClearInventory={handleAuraDirectClear}
        onDeleteAllEquipment={executeDeleteAllEquipment}
        onUpdateInventoryItem={handleAuraUpdateItem}
        onAttachEquipmentPhotos={handleAttachEquipmentPhotos}
        onBulkImportEquipment={handleBulkImportEquipment}
        onOpenReportModal={(category, week) => {
          const targetCat = category || 'bag';
          setReportCategory(targetCat);
          if (week) {
            setReportInitialWeek(week);
          }
          if (emergencyWeekDates[targetCat]) {
            setReportInitialWeekDates(emergencyWeekDates[targetCat]);
          }
          setIsOfficialReportOpen(true);
        }}
        onNavigate={(view, category) => {
          if (view === 'users') return;
          if (view === 'room_check') {
            setSelectedRoomId(null);
            setCategoryAndIndex('equipment', 1);
          } else if (view === 'bag_check') {
            setCategoryAndIndex('bag', 2);
          } else if (view === 'ambulance_check') {
            setCategoryAndIndex('ambulance', 3);
          } else if (view === 'cart_check') {
            setCategoryAndIndex('cart', 4);
          } else if (view === 'drug_check') {
            setCategoryAndIndex('medicine', 0);
          } else if (category) {
            setCategoryAndIndex(category);
          }
          changeView(view as any);
        }}
        isDarkMode={isDark}
        isBottomBarVisible={shouldShowBottomBar}
        isAnyModalOpen={isAnyModalActive || isKeyboardOpen}
        hasUnreadAuraMessage={hasUnreadAuraMessage}
        onUnreadMessage={() => setHasUnreadAuraMessage(true)}
        onOpenChange={(open) => {
          setIsAuraOpen(open);
          if (open) {
            setHasUnreadAuraMessage(false);
          }
        }}
        onClearTargetInventory={handleAuraClearInventory}
        onPreviewImage={(img) => setPreviewImage(img)}
      />

      {/* 📍 Channel Selector Modal */}
      <ChannelSelectorModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setIsChannelModalOpen(false);
        }}
        onCreateChannel={(name, duplicate) => {
          addChannel(name, duplicate);
        }}
        onRenameChannel={(id, newName) => {
          renameChannel(id, newName);
        }}
        onDeleteChannel={(id) => {
          removeChannel(id);
        }}
      />

      {/* 📍 Floating Quick Controls (Scroll to Top, Scroll to Bottom) */}
      <GlobalScrollButtons
        isBottomBarVisible={shouldShowBottomBar}
        isAnyModalOpen={isAnyModalActive}
        scrollContainerRef={mainScrollRef}
      />

      {/* 🎮 Game-style Centered Floating Toast */}
      {gameToast && (
        <div
          key={gameToast.id}
          className="fixed inset-0 z-[12000] pointer-events-none flex items-center justify-center px-4"
        >
          <div className="animate-game-toast flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-[#1E1F20]/95 text-white border border-emerald-400/40 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 flex items-center justify-center shrink-0">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap">
              {gameToast.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
