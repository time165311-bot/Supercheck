import React, { useState, useMemo, useEffect } from 'react';
import { ModernDashboard } from './components/ModernDashboard';
import { DrugInventoryView } from './components/DrugInventoryView';
import { BottomBar } from './components/BottomBar';
import { OfficialReportModal, OfficialReportItemRow } from './components/OfficialReportModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { NotificationModal } from './components/NotificationModal';
import { ProfileModal } from './components/ProfileModal';
import { PasswordModal } from './components/PasswordModal';
import { UserManagement } from './components/UserManagement';
import { FloorMap } from './components/FloorMap';
import {
  SwiperInspectionCarousel,
  InspectionSlideItem,
} from './components/SwiperInspectionCarousel';
import { EmergencyChecklistView } from './components/EmergencyChecklistView';
import { GoogleSheetsSettings } from './components/GoogleSheetsSettings';
import { GlobalScrollButtons } from './components/GlobalScrollButtons';

import {
  STORAGE_KEYS,
  getStored,
  setStored,
  getStoredString,
  setStoredString,
  getInitialEquipment,
  getInitialLists,
} from './services/storage';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { sendInspectionToGas, testGasConnection } from './services/api';
import { INITIAL_DRUGS_DATA } from './constants/initialDrugs';
import { ROOMS, GAS_SCRIPT_V5 } from './constants/initialData';
import {
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
  X,
  FileText,
  Users as UsersIcon,
  Home,
  User as UserIcon,
  Lock,
  Moon,
  Sun,
  ShieldCheck,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Code,
  Sparkles,
  ChevronDown,
  Menu,
} from 'lucide-react';

import {
  fetchEquipmentFromFirebase,
  saveEquipmentItemToFirebase,
  deleteEquipmentItemInFirebase,
  fetchDrugsFromFirebase,
  saveDrugItemToFirebase,
  fetchUsersFromFirebase,
  saveUserToFirebase,
  loadSettingsFromFirebase,
  saveSettingsToFirebase,
  saveInspectionToFirebase,
  subscribeInspectionHistory,
  deleteInspectionFromFirebase,
} from './services/firebase';

export default function App() {
  // Navigation & Theme
  const [currentView, setCurrentView] = useState<
    'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'eq_overview' | 'users'
  >('home');

  // Remember Active Selected Category ('bag' by default or last inspected)
  const [activeCategory, setActiveCategory] = useState<'medicine' | 'equipment' | 'bag' | 'cart'>('bag');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (getStoredString(STORAGE_KEYS.THEME, 'dark') as 'light' | 'dark') || 'dark';
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zoomedImgUrl, setZoomedImgUrl] = useState<string | null>(null);

  // Current Logged-in User
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const sessionUser = getStored<User | null>(STORAGE_KEYS.SESSION, null);
    if (sessionUser) return sessionUser;
    return {
      id: 'usr_admin',
      username: 'admin',
      name: 'ผู้ดูแลระบบ (Admin)',
      role: 'admin',
      position: 'วิสัญญีแพทย์',
      active: true,
      salt: '',
      hash: '',
      must: false,
      created: new Date().toISOString(),
      last: new Date().toISOString(),
    };
  });

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [apiUrl, setApiUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.API_URL, ''));
  const [sheetUrl, setSheetUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.SHEET_URL, ''));

  // Main Data States
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [equipment, setEquipment] = useState<Record<string, EquipmentItem[]>>({});
  const [lists, setLists] = useState<Record<'bag' | 'cart', ListConfig>>({
    bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: {} },
    cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: {} },
  });

  const [globalChecks, setGlobalChecks] = useState<Record<string, Record<string, CheckItemState>>>(() => {
    return getStored<Record<string, Record<string, CheckItemState>>>(STORAGE_KEYS.GLOBAL_CHECKS, {});
  });

  const [historyRecords, setHistoryRecords] = useState<InspectionHistoryRecord[]>([]);

  const [emergencyWeekDates, setEmergencyWeekDates] = useState<Record<string, Record<number, string>>>(() => {
    const today = new Date().toISOString().split('T')[0];
    const initial = {
      bag: { 1: today, 2: today, 3: today, 4: today, 5: today },
      cart: { 1: today, 2: today, 3: today, 4: today, 5: today },
    };
    return getStored<Record<string, Record<number, string>>>(STORAGE_KEYS.EMER_WEEK_DATES, initial);
  });

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Connectivity Test & Auth Listener
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'settings', 'config'));
      } catch (error: any) {
        if (error?.message?.includes('offline')) {
          console.warn('Firebase is offline. Check configuration.');
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setAuthLoading(true);
      if (fbUser) {
        // Find or create user in Firestore
        const existingUsers = await fetchUsersFromFirebase();
        let userProfile = existingUsers.find(u => u.id === fbUser.uid);
        
        if (!userProfile) {
          userProfile = {
            id: fbUser.uid,
            username: fbUser.email?.split('@')[0] || 'user',
            name: fbUser.displayName || 'Anonymous User',
            role: existingUsers.length === 0 ? 'admin' : 'user', // First user is admin
            position: 'เจ้าหน้าที่',
            active: true,
            salt: '',
            hash: '',
            must: false,
            created: new Date().toISOString(),
            last: new Date().toISOString(),
            avatar: fbUser.photoURL || '',
          };
          await saveUserToFirebase(userProfile);
        } else {
          // Update last login
          userProfile.last = new Date().toISOString();
          await saveUserToFirebase(userProfile);
        }
        setCurrentUser(userProfile);
        setStored(STORAGE_KEYS.SESSION, userProfile);

        // Load Private Data
        setAllUsers(existingUsers);
        
        // Seed if Admin
        if (userProfile.role === 'admin') {
          const currentEq = await fetchEquipmentFromFirebase();
          if (currentEq.length === 0) {
            const initialEqMap = getInitialEquipment();
            const initialListsMap = getInitialLists();
            for (const [roomId, items] of Object.entries(initialEqMap)) {
              for (const item of items) {
                await saveEquipmentItemToFirebase({ ...item, type: 'room', roomId });
              }
            }
            for (const type of ['bag', 'cart'] as const) {
              const list = initialListsMap[type];
              for (const [groupName, items] of Object.entries(list.groups)) {
                for (const item of items) {
                  await saveEquipmentItemToFirebase({ ...item, type, category: groupName });
                }
              }
            }
          }

          const currentDrugs = await fetchDrugsFromFirebase();
          if (currentDrugs.length === 0) {
            for (const drug of INITIAL_DRUGS_DATA) {
              await saveDrugItemToFirebase(drug);
            }
          }
        }
        
        const fbSettings = await loadSettingsFromFirebase();
        if (fbSettings) {
          if (fbSettings.sheetUrl) setSheetUrl(fbSettings.sheetUrl);
          if (fbSettings.apiUrl) setApiUrl(fbSettings.apiUrl);
          if (fbSettings.theme) setTheme(fbSettings.theme);
        }

        // Subscribe to History
        const unsubscribeHistory = await subscribeInspectionHistory((records) => {
          setHistoryRecords(records);
        });
      } else {
        setCurrentUser(null);
        setStored(STORAGE_KEYS.SESSION, null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setStored(STORAGE_KEYS.SESSION, null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Initial Data Fetching from Firestore
  useEffect(() => {
    const initData = async () => {
      setIsLoadingData(true);
      try {
        // 1. Fetch Equipment (Public Read)
        const fbEquipment = await fetchEquipmentFromFirebase();
        processEquipment(fbEquipment);

        // 2. Fetch Drugs (Public Read)
        const fbDrugs = await fetchDrugsFromFirebase();
        setDrugs(fbDrugs);
      } catch (err) {
        console.error('Failed to initialize public data from Firebase:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    const processEquipment = (items: EquipmentItem[]) => {
      const roomEq: Record<string, EquipmentItem[]> = {};
      const bagGroups: Record<string, EquipmentItem[]> = {};
      const cartGroups: Record<string, EquipmentItem[]> = {};

      items.forEach((item) => {
        if (item.type === 'room' && item.roomId) {
          if (!roomEq[item.roomId]) roomEq[item.roomId] = [];
          roomEq[item.roomId].push(item);
        } else if (item.type === 'bag' && item.category) {
          if (!bagGroups[item.category]) bagGroups[item.category] = [];
          bagGroups[item.category].push(item);
        } else if (item.type === 'cart' && item.category) {
          if (!cartGroups[item.category]) cartGroups[item.category] = [];
          cartGroups[item.category].push(item);
        }
      });

      setEquipment(roomEq);
      setLists({
        bag: { title: 'กระเป๋าฉุกเฉิน', sheet: 'กระเป๋า Emergency', groups: bagGroups },
        cart: { title: 'รถฉุกเฉิน', sheet: 'รถ Emergency', groups: cartGroups },
      });
    };

    initData();
  }, []);

  // Modals
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [reportInitialWeek, setReportInitialWeek] = useState<number | undefined>(undefined);
  const [reportInitialWeekDates, setReportInitialWeekDates] = useState<Record<number, string> | undefined>(undefined);
  const [reportInitialRoundId, setReportInitialRoundId] = useState<string | undefined>(undefined);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  
  // Firebase Connectivity Test
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTestFirebaseConnection = async () => {
    setIsTestingFirebase(true);
    setFirebaseTestResult(null);
    try {
      // Test by attempting to get a doc from server
      await getDocFromServer(doc(db, 'settings', 'config'));
      setFirebaseTestResult({ ok: true, msg: 'เชื่อมต่อฐานข้อมูล Firebase สำเร็จ (Online)' });
    } catch (error: any) {
      console.error('Firebase test failed:', error);
      setFirebaseTestResult({ 
        ok: false, 
        msg: error?.message?.includes('offline') 
          ? 'ฐานข้อมูลอยู่ในโหมด Offline หรือไม่ได้เชื่อมต่ออินเทอร์เน็ต' 
          : `เกิดข้อผิดพลาด: ${error?.message || 'ไม่สามารถติดต่อ Firebase ได้'}`
      });
    } finally {
      setIsTestingFirebase(false);
    }
  };

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isSheetsAccordionOpen, setIsSheetsAccordionOpen] = useState(false);

  // Auto-hiding Bottom Navigation Bar on Scroll
  const [isBottomBarVisible, setIsBottomBarVisible] = useState<boolean>(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY <= 30) {
            setIsBottomBarVisible(true);
          } else if (currentScrollY > lastScrollY + 6) {
            setIsBottomBarVisible(false);
          } else if (currentScrollY < lastScrollY - 6) {
            setIsBottomBarVisible(true);
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Selected Room ID for Room Check
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('or1');

  // Drawer Touch Drag Gesture Handler
  const [drawerDragY, setDrawerDragY] = useState<number>(0);
  const [isDrawerMounted, setIsDrawerMounted] = useState<boolean>(false);
  const touchStartYRef = React.useRef<number>(0);

  useEffect(() => {
    if (isDrawerOpen) {
      requestAnimationFrame(() => setIsDrawerMounted(true));
    } else {
      setIsDrawerMounted(false);
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
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setStoredString(STORAGE_KEYS.THEME, nextTheme);
  };

  const handleDrugsChange = async (nextDrugs: DrugItem[]) => {
    setDrugs(nextDrugs);
    setStored(STORAGE_KEYS.DRUGS, nextDrugs);
    // Ideally we'd save each changed drug, but for now we'll just keep the local sync and assume individual updates happen elsewhere if needed.
    // However, the DrugInventoryView might need an onUpdateDrug prop.
  };

  // Toggle Item Inspection Result ('ปกติ' | 'ผิดปกติ')
  const handleToggleCheck = (
    categoryOrRoomId: string,
    itemKey: string,
    result: 'ปกติ' | 'ผิดปกติ',
    _itemName: string,
    week?: number,
    isMassAction?: boolean,
    customValue?: string
  ) => {
    setGlobalChecks((prev) => {
      const currentCategory = prev[categoryOrRoomId] || {};
      const existing = currentCategory[itemKey] || { result: '', weekVals: {} };
      
      let nextResult: 'ปกติ' | 'ผิดปกติ' | '';
      if (isMassAction) {
        nextResult = result;
      } else {
        nextResult = (existing?.result === result ? '' : result) as 'ปกติ' | 'ผิดปกติ' | '';
      }

      let nextWeekVals = { ...(existing.weekVals || {}) };
      if (week !== undefined) {
        if (customValue !== undefined) {
          nextWeekVals[week] = customValue;
        } else {
          const targetVal = result === 'ปกติ' ? '1' : '0';
          if (isMassAction) {
            nextWeekVals[week] = targetVal;
          } else {
            // Toggle logic for single clicks
            const newVal = (existing.weekVals?.[week] === targetVal) ? '' : targetVal;
            nextWeekVals[week] = newVal;
          }
        }
      }

      const updatedCategory = {
        ...currentCategory,
        [itemKey]: {
          ...existing,
          result: nextResult,
          weekVals: nextWeekVals,
        },
      };

      const updatedGlobal = {
        ...prev,
        [categoryOrRoomId]: updatedCategory,
      };

      setStored(STORAGE_KEYS.GLOBAL_CHECKS, updatedGlobal);
      return updatedGlobal;
    });
  };

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
        // Also update weekVals if we know which week is active (this is a bit tricky since week isn't passed here)
        // For simplicity, we'll let the checklist view handle the weekVals update via onToggleCheck
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

      setStored(STORAGE_KEYS.GLOBAL_CHECKS, updatedGlobal);
      return updatedGlobal;
    });
  };

  // Add New Item to Emergency Bag or Crash Cart Checklist
  const handleAddItem = async (
    type: 'bag' | 'cart',
    newItem: { name: string; groupName: string; spec?: string; qty?: string; exp?: string; img?: string }
  ) => {
    const itemKey = `${type}_${newItem.groupName}_${Date.now()}`;
    const itemObject: EquipmentItem = {
      id: itemKey,
      name: newItem.name,
      no: '1', // Will be re-indexed locally by the processEquipment logic if we were using it, but here we update state directly
      code: `NEW-${Math.floor(1000 + Math.random() * 9000)}`,
      spec: newItem.spec || '',
      qty: newItem.qty || '1',
      location: newItem.groupName,
      category: newItem.groupName,
      exp: newItem.exp || '',
      img: newItem.img || '',
      type,
    };

    const saved = await saveEquipmentItemToFirebase(itemObject);
    if (!saved) return;

    setLists((prev) => {
      const currentList = prev[type] || { title: type === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน', groups: {} };
      const groups = { ...(currentList.groups || {}) };
      const targetGroup = groups[newItem.groupName] ? [...groups[newItem.groupName]] : [];
      
      groups[newItem.groupName] = [...targetGroup, saved];

      const updatedLists = { ...prev, [type]: { ...currentList, groups } };
      setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      return updatedLists;
    });
  };

  // Delete Item from Emergency Bag or Crash Cart Checklist
  const handleDeleteItem = async (type: 'bag' | 'cart', itemKey: string) => {
    const ok = await deleteEquipmentItemInFirebase(itemKey);
    if (!ok) return;

    setLists((prev) => {
      const currentList = prev[type];
      if (!currentList || !currentList.groups) return prev;

      const newGroups: Record<string, EquipmentItem[]> = {};
      Object.entries(currentList.groups).forEach(([groupName, items]) => {
        newGroups[groupName] = items.filter((it) => it.id !== itemKey);
      });

      const updatedLists = { ...prev, [type]: { ...currentList, groups: newGroups } };
      setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      return updatedLists;
    });

    // Also clean up checks for this item
    setGlobalChecks((prev) => {
      const categoryChecks = prev[type];
      if (!categoryChecks || !categoryChecks[itemKey]) return prev;

      const newCategoryChecks = { ...categoryChecks };
      delete newCategoryChecks[itemKey];

      const updatedGlobal = { ...prev, [type]: newCategoryChecks };
      setStored(STORAGE_KEYS.GLOBAL_CHECKS, updatedGlobal);
      return updatedGlobal;
    });
  };

  // Edit Item in Emergency Bag or Crash Cart Checklist
  const handleEditItem = async (type: 'bag' | 'cart', updatedItem: EquipmentItem) => {
    const saved = await saveEquipmentItemToFirebase({ ...updatedItem, type });
    if (!saved) return;

    setLists((prev) => {
      const currentList = prev[type];
      if (!currentList || !currentList.groups) return prev;

      const newGroups: Record<string, EquipmentItem[]> = {};
      Object.entries(currentList.groups).forEach(([groupName, items]) => {
        newGroups[groupName] = items.map((it) => 
          (it.id === saved.id) ? saved : it
        );
      });

      // If category changed, move item to new group
      const oldGroup = Object.keys(currentList.groups).find(g => 
        currentList.groups[g].some(it => it.id === saved.id)
      );

      if (oldGroup && saved.category && oldGroup !== saved.category) {
        newGroups[oldGroup] = newGroups[oldGroup].filter(it => it.id !== saved.id);
        const targetGroup = newGroups[saved.category] || [];
        newGroups[saved.category] = [...targetGroup, saved];
      }

      const updatedLists = { ...prev, [type]: { ...currentList, groups: newGroups } };
      setStored(STORAGE_KEYS.CUSTOM_LISTS, updatedLists);
      return updatedLists;
    });
  };

  // Calculate Expiry Alerts
  const expiryAlerts = useMemo<ExpiryAlertItem[]>(() => {
    const alerts: ExpiryAlertItem[] = [];
    const now = new Date();

    const checkListExp = (catKey: 'bag' | 'cart', config: ListConfig) => {
      if (!config || !config.groups) return;
      Object.entries(config.groups).forEach(([groupName, groupItems]) => {
        groupItems.forEach((item) => {
          if (!item.exp) return;
          const expDate = new Date(item.exp);
          if (isNaN(expDate.getTime())) return;
          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 90) {
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
    checkListExp('cart', lists.cart);
    return alerts;
  }, [lists]);

  // Overall Statistics Calculation
  const overallStats = useMemo(() => {
    let grandTotal = 0;
    let grandChecked = 0;
    let grandNormal = 0;
    let grandDefective = 0;

    // Room Equipment
    Object.entries(equipment).forEach(([roomId, items]) => {
      const roomChecks = globalChecks[roomId] || {};
      items.forEach((item, idx) => {
        grandTotal++;
        const state = roomChecks[item.id || `${roomId}_${idx}`];
        if (state?.result === 'ปกติ') {
          grandChecked++;
          grandNormal++;
        } else if (state?.result === 'ผิดปกติ') {
          grandChecked++;
          grandDefective++;
        }
      });
    });

    // Lists (Bag & Cart)
    ['bag', 'cart'].forEach((catKey) => {
      const config = lists[catKey as 'bag' | 'cart'];
      const catChecks = globalChecks[catKey] || {};
      if (config && config.groups) {
        Object.entries(config.groups).forEach(([_gName, items]) => {
          items.forEach((item, idx) => {
            grandTotal++;
            const state = catChecks[item.id || `${catKey}_${idx}`];
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

    const completionPct = grandTotal > 0 ? Math.round((grandChecked / grandTotal) * 100) : 0;

    return {
      grandTotal,
      grandChecked,
      grandNormal,
      grandDefective,
      completionPct,
    };
  }, [equipment, lists, globalChecks]);

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
  const [reportCategory, setReportCategory] = useState<'eq' | 'bag' | 'cart' | 'drug'>('eq');

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
        const isBad = st?.result === 'ผิดปกติ';
        rows.push({
          no: count++,
          name: it.name,
          qty: it.qty || 1,
          exp: st?.exp || it.exp || '-',
          group: groupName,
          location: `กระเป๋าฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : 'ใช้งานได้',
          note: st?.note || '',
          val: st?.val || '',
          weekVals: st?.weekVals || {},
        });
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
        const isBad = st?.result === 'ผิดปกติ';
        rows.push({
          no: count++,
          name: it.name,
          qty: it.qty || 1,
          exp: st?.exp || it.exp || '-',
          group: groupName,
          location: `รถฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : 'ใช้งานได้',
          note: st?.note || '',
          val: st?.val || '',
          weekVals: st?.weekVals || {},
        });
      });
    });
    return rows;
  }, [lists.cart, globalChecks]);

    // Submit equipment inspection to Google Apps Script and immediately open OfficialReportModal
    const handleSaveEquipmentAndPreview = async () => {
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

      // 2. Save snapshot into inspection history
      const newRecord: InspectionHistoryRecord = {
        id: `eq_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: 'eq',
        title: 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์ (ภาพรวมทุกห้อง)',
        who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
        rows: formattedEqItems,
      };
      await saveInspectionToFirebase(newRecord);

      // 3. Open OfficialReportModal with 'eq' tab active and eqItems populated
      setReportInitialRoundId(newRecord.id);
      setReportCategory('eq');
      setIsOfficialReportOpen(true);
    };

    const handleSaveEmergencyAndPreview = async (
      type: 'bag' | 'cart',
      week: number,
      weekDatesFromComponent: Record<number, string>
    ) => {
      const now = new Date();
      // Use the latest dates from the component (which should be synced to global anyway)
      const finalWeekDates = weekDatesFromComponent || emergencyWeekDates[type];
      const items = type === 'bag' ? formattedBagItems : formattedCartItems;
      const title = type === 'bag' ? 'แบบฟอร์มตรวจสอบความพร้อม กระเป๋า Emergency' : 'แบบฟอร์มตรวจสอบความพร้อม รถ Emergency';

      // 1. Save to History
      const newRecord: InspectionHistoryRecord = {
        id: `${type}_wk${week}_${Date.now()}`,
        timestamp: new Date().toLocaleString('th-TH'),
        date: now.toISOString().split('T')[0],
        type: type,
        title: `${title} (สัปดาห์ที่ ${week})`,
        who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
        rows: items.map(it => ({
          ...it,
          val: it.res === 'ใช้งานได้' ? '✓' : '-',
          weekVals: it.weekVals || {} // Snapshot ALL weeks' values
        })),
        weekDates: finalWeekDates,
      };

      const nextHist = [newRecord, ...historyRecords].slice(0, 50);
      await saveInspectionToFirebase(newRecord);

      // 2. Open Modal
      setReportInitialRoundId(newRecord.id);
      setReportInitialWeek(week);
      setReportInitialWeekDates(finalWeekDates);
      setReportCategory(type);
      setIsOfficialReportOpen(true);
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

  // Barcode Scan Success Handler
  const handleScanSuccess = (decodedText: string) => {
    setIsBarcodeScannerOpen(false);
    alert(`สแกนบาร์โค้ดสำเร็จ: ${decodedText}`);
  };

  const isDark = theme === 'dark';

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0E0F12]' : 'bg-[#F2F4F8]'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-[#0E0F12]' : 'bg-[#F2F4F8]'}`}>
        {/* Background Video (Samsung One UI Soft Background) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video autoPlay loop muted playsInline className={`w-full h-full object-cover transition-all duration-700 ${isDark ? 'opacity-25' : 'opacity-15'}`}>
            <source src="https://assets.mixkit.co/videos/preview/mixkit-surgeons-during-an-operation-41539-large.mp4" type="video/mp4" />
          </video>
          <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-[#0E0F12]/80 via-[#0E0F12]/50 to-[#0E0F12]/95' : 'bg-gradient-to-b from-[#F2F4F8]/80 via-[#F2F4F8]/40 to-[#F2F4F8]/95'}`} />
        </div>

        <div className="relative z-10 w-full max-w-sm p-8 bg-white/10 dark:bg-black/40 backdrop-blur-2xl rounded-[3rem] border border-white/20 shadow-2xl space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <div className="font-valorant text-4xl font-bold tracking-widest">
              <span className="text-[#67e8f9] drop-shadow-[0_2px_8px_rgba(103,232,249,0.5)]">ANESTHESIA</span>
              <span className="text-white"> CARE</span>
            </div>
            <p className="text-slate-300 text-sm font-medium">ระบบจัดการและตรวจสอบครุภัณฑ์ทางการแพทย์</p>
          </div>

          <div className="py-4">
            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-lg shadow-blue-600/40 transform rotate-12">
              <BriefcaseMedical size={48} className="text-white -rotate-12" />
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl flex items-center justify-center gap-3 transition shadow-lg active:scale-95 cursor-pointer"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span>เข้าสู่ระบบด้วย Google</span>
          </button>
          
          <p className="text-[10px] text-slate-400 uppercase tracking-tighter">โรงพยาบาลวิสัญญีวิทยา • ระบบรักษาความปลอดภัย Firestore</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full font-['TH_Sarabun_New','Sarabun',sans-serif] relative transition-colors duration-500 overflow-x-hidden ${
        isDark ? 'bg-[#0E0F12] text-slate-100' : 'bg-[#F2F4F8] text-slate-900'
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

      {/* 🎬 Background Video (One UI Soft Background) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-all duration-700 ${
            isDark ? 'opacity-25 brightness-75 contrast-105' : 'opacity-15 brightness-100 contrast-95'
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
              ? 'bg-gradient-to-b from-[#0E0F12]/80 via-[#0E0F12]/50 to-[#0E0F12]/95'
              : 'bg-gradient-to-b from-[#F2F4F8]/80 via-[#F2F4F8]/40 to-[#F2F4F8]/95'
          }`}
        />
      </div>

      {/* Desktop Header removed as requested */}


      {/* MAIN VIEW CONTENT CONTAINER (Safe Area + Samsung One UI) */}
      <main 
        className="relative z-10 w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8 pb-28"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
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
            onSelectCategory={(cat) => setActiveCategory(cat)}
            onNavigate={(view) => {
              if (view === 'room_check') {
                setSelectedRoomId('or1');
                setActiveCategory('equipment');
              } else if (view === 'bag_check') {
                setActiveCategory('bag');
              } else if (view === 'cart_check') {
                setActiveCategory('cart');
              } else if (view === 'drug_check') {
                setActiveCategory('medicine');
              }
              setCurrentView(view as any);
            }}
            onSelectRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setActiveCategory('equipment');
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
            onLogout={handleLogout}
            onToggleCheck={handleToggleCheck}

            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            overallStats={overallStats}
          />
        )}

        {/* 2. DRUG & INVENTORY CHECK */}
        {currentView === 'drug_check' && (
          <DrugInventoryView
            currentUser={currentUser}
            onBack={() => setCurrentView('home')}
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
            onBack={() => setCurrentView('home')}
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
            onBack={() => setCurrentView('home')}
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
          />
        )}

        {/* 5. ROOM EQUIPMENT CHECK (ผังห้องผ่าตัด FLOOR MAP - Primary Equipment View) */}
        {(currentView === 'room_check' || currentView === 'eq_overview') && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className={`flex justify-between items-center backdrop-blur-2xl p-4 rounded-[2rem] border shadow-xl ${
              isDark ? 'bg-[#181A20]/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                &larr; กลับหน้าหลัก
              </button>
              <h2 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <MapPin size={16} className="text-[#3B82F6]" />
                <span>ผังห้องผ่าตัด (Floor Map)</span>
              </h2>
            </div>

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
            />
          </div>
        )}

        {/* 6. USER MANAGEMENT (เฉพาะ ADMIN) */}
        {currentView === 'users' && currentUser?.role === 'admin' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className={`flex justify-between items-center backdrop-blur-2xl p-4 rounded-[2rem] border shadow-xl ${
              isDark ? 'bg-[#181A20]/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                &larr; กลับหน้าหลัก
              </button>
              <h2 className={`text-base font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <UsersIcon size={18} className="text-purple-400" />
                <span>จัดการผู้ใช้งานระบบ</span>
              </h2>
            </div>

            <UserManagement
              currentUser={currentUser}
              users={allUsers}
              onUsersChange={(updatedUsers) => {
                setAllUsers(updatedUsers);
                setStored(STORAGE_KEYS.USERS, updatedUsers);
              }}
            />
          </div>
        )}
      </main>

      {/* 📂 SAMSUNG ONE UI DRAWER (Bottom Sheet on Mobile, Slide-in Right Drawer Panel on Desktop) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className={`w-full max-w-lg lg:max-w-[360px] lg:w-[350px] lg:h-full lg:max-h-full rounded-t-[2.5rem] lg:rounded-t-none lg:rounded-l-[2rem] p-6 pb-8 space-y-4 border-t border-x lg:border-t-0 lg:border-l lg:border-y-0 shadow-2xl overflow-y-auto no-scrollbar relative ${
              isDark
                ? 'bg-[#181A20] border-slate-700 text-white shadow-black/80'
                : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/80'
            }`}
            style={{
              transform: drawerDragY > 0 ? `translateY(${drawerDragY}px)` : isDrawerMounted ? 'translate(0, 0)' : 'translateY(100%)',
              transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStartDrawer}
            onTouchMove={handleTouchMoveDrawer}
            onTouchEnd={handleTouchEndDrawer}
            onMouseDown={handleMouseDownDrawer}
            onMouseMove={handleMouseMoveDrawer}
            onMouseUp={handleMouseUpDrawer}
          >
            {/* Drag Handle Bar for Mobile Only */}
            <div
              style={{ touchAction: 'none' }}
              className="lg:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
            />

            {/* Bottom Sheet / Right Drawer Header with Clickable User Profile & Close Button [✕] */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(true);
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 p-1.5 -m-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-left group active:scale-98"
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

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:opacity-80 transition cursor-pointer shrink-0"
                title="ปิด"
              >
                <X size={16} />
              </button>
            </div>

            {/* Menu Content */}
            <div className="space-y-3 py-1">
              {/* 1. รายงานสรุปประจำวัน & พรีวิว PDF (A4) */}
              <button
                type="button"
                onClick={() => {
                  setReportCategory('eq');
                  setIsOfficialReportOpen(true);
                  setIsDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-sm font-bold bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs transition cursor-pointer"
              >
                <span className="text-lg">📊</span>
                <span>รายงานสรุปประจำวัน & พรีวิว PDF (A4)</span>
              </button>

              {/* 2. จัดการผู้ใช้ (Admin) */}
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('users');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-sm font-bold transition cursor-pointer border ${
                    currentView === 'users'
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md'
                      : 'bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 shadow-xs'
                  }`}
                >
                  <span className="text-lg">⚙️</span>
                  <span>จัดการผู้ใช้ (Admin)</span>
                </button>
              )}

              {/* 3. Accordion Toggle Button สำหรับ "ตั้งค่าการเชื่อมต่อ Google Sheets" (วางใต้ปุ่ม จัดการผู้ใช้) */}
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

              {/* 3.1 Accordion Collapsible Content */}
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

              {/* 5. Firebase Cloud Sync Section */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="px-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <span>Firebase Cloud Storage</span>
                  </h4>
                </div>
                
                <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-blue-50/30 border-blue-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                        <RefreshCw size={18} className={isTestingFirebase ? 'animate-spin' : ''} />
                      </div>
                      <div>
                        <p className="text-xs font-bold dark:text-white">สถานะคลาวด์</p>
                        <p className="text-[9px] text-slate-500">Real-time Synchronization</p>
                      </div>
                    </div>
                    {firebaseTestResult && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${firebaseTestResult.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {firebaseTestResult.ok ? 'Online' : 'Error'}
                      </span>
                    )}
                  </div>

                  {firebaseTestResult && (
                    <div className={`mb-3 p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 ${firebaseTestResult.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {firebaseTestResult.ok ? <Check size={14} className="mt-0.5" /> : <X size={14} className="mt-0.5" />}
                      <span>{firebaseTestResult.msg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isTestingFirebase}
                      onClick={handleTestFirebaseConnection}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={14} className={isTestingFirebase ? 'animate-spin' : ''} />
                      <span>{isTestingFirebase ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                    </button>
                    
                    <a
                      href={`https://console.firebase.google.com/project/galvanic-crow-v83d0/firestore/databases/ai-studio-anesthesiacare-980ed80f-6020-4ed3-a9ce-1f56075434f1/data`}

                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-[11px] font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      <span>Console</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONE UI BOTTOM NAVIGATION BAR */}
      <BottomBar
        currentView={currentView}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={(view) => setCurrentView(view as any)}
        onOpenReport={() => {
          setReportCategory('eq');
          setIsOfficialReportOpen(true);
        }}
        onOpenGoogleSheet={() => {
          setDrawerActiveTab('sheets');
          setIsDrawerOpen(true);
        }}
        onOpenDrawer={() => {
          setDrawerActiveTab('menu');
          setIsDrawerOpen(true);
        }}
        onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
        isDrawerOpen={isDrawerOpen}
        isVisible={isBottomBarVisible}
      />

      {/* ZOOMED IMAGE PREVIEW OVERLAY MODAL */}
      {zoomedImgUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomedImgUrl(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomedImgUrl(null)}
              className="absolute -top-10 right-0 p-2 text-white bg-slate-800 rounded-full hover:bg-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>
            <img
              src={zoomedImgUrl}
              alt="Zoomed detail"
              className="max-w-full max-h-[80vh] object-contain rounded-3xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
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
          items={formattedEqItems}
          drugs={drugs}
          apiUrl={apiUrl}
          sheetUrl={sheetUrl}
          currentUser={currentUser}
          historyRecords={historyRecords}
          onDeleteHistoryRecord={(recId) => {
            const nextHist = historyRecords.filter((r) => r.id !== recId);
            setHistoryRecords(nextHist);
            setStored(STORAGE_KEYS.HISTORY, nextHist);
          }}
        />
      )}

      {isBarcodeScannerOpen && (
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
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
          onOpenPasswordModal={() => setIsPasswordOpen(true)}
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
            const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
            setAllUsers(nextUsers);
            setStored(STORAGE_KEYS.USERS, nextUsers);
          }}
        />
      )}

      {isPasswordOpen && currentUser && (
        <PasswordModal
          isOpen={isPasswordOpen}
          onClose={() => setIsPasswordOpen(false)}
          currentUser={currentUser}
        />
      )}

      {/* 📍 Floating Quick Controls (Scroll to Top, Scroll to Bottom, Back to Dashboard) */}
      <GlobalScrollButtons
        onNavigateHome={() => setCurrentView('home')}
        showHomeButton={currentView !== 'home'}
      />
    </div>
  );
}
