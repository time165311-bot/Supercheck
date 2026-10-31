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

import {
  STORAGE_KEYS,
  getStored,
  setStored,
  getStoredString,
  setStoredString,
  getInitialEquipment,
  getInitialLists,
} from './services/storage';
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

export default function App() {
  // Navigation & Theme
  const [currentView, setCurrentView] = useState<
    'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'eq_overview' | 'users'
  >('home');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (getStoredString(STORAGE_KEYS.THEME, 'dark') as 'light' | 'dark') || 'dark';
  });

  // Drawer menu open state (Samsung One UI Bottom Sheet Drawer)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Zoomed Image Modal State
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

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const users = getStored<User[]>(STORAGE_KEYS.USERS, []);
    if (users.length > 0) return users;
    return currentUser ? [currentUser] : [];
  });

  // App Settings
  const [apiUrl, setApiUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.API_URL, ''));
  const [sheetUrl, setSheetUrl] = useState<string>(() => getStoredString(STORAGE_KEYS.SHEET_URL, ''));

  // Main Data States
  const [drugs, setDrugs] = useState<DrugItem[]>(() => {
    return getStored<DrugItem[]>(STORAGE_KEYS.DRUGS, INITIAL_DRUGS_DATA);
  });

  const [equipment, setEquipment] = useState<Record<string, EquipmentItem[]>>(() => {
    return getInitialEquipment();
  });

  const [lists, setLists] = useState<Record<'bag' | 'cart', ListConfig>>(() => {
    return getInitialLists();
  });

  const [globalChecks, setGlobalChecks] = useState<Record<string, Record<string, CheckItemState>>>(() => {
    return getStored<Record<string, Record<string, CheckItemState>>>(STORAGE_KEYS.GLOBAL_CHECKS, {});
  });

  const [historyRecords, setHistoryRecords] = useState<InspectionHistoryRecord[]>(() => {
    return getStored<InspectionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
  });

  // Modals
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isSheetsAccordionOpen, setIsSheetsAccordionOpen] = useState(false);

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

  const handleDrugsChange = (nextDrugs: DrugItem[]) => {
    setDrugs(nextDrugs);
    setStored(STORAGE_KEYS.DRUGS, nextDrugs);
  };

  // Toggle Item Inspection Result ('ปกติ' | 'ผิดปกติ')
  const handleToggleCheck = (
    categoryOrRoomId: string,
    itemKey: string,
    result: 'ปกติ' | 'ผิดปกติ',
    _itemName: string
  ) => {
    setGlobalChecks((prev) => {
      const currentCategory = prev[categoryOrRoomId] || {};
      const existing = currentCategory[itemKey];
      const nextResult: 'ปกติ' | 'ผิดปกติ' | '' = (existing?.result === result ? '' : result) as 'ปกติ' | 'ผิดปกติ' | '';

      const updatedCategory = {
        ...currentCategory,
        [itemKey]: {
          ...existing,
          result: nextResult,
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
      const existing = currentCategory[itemKey] || { result: 'ผิดปกติ' };

      const updatedCategory = {
        ...currentCategory,
        [itemKey]: {
          ...existing,
          note,
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
          exp: it.exp || '-',
          group: groupName,
          location: `กระเป๋าฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : 'ใช้งานได้',
          note: st?.note || '',
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
          exp: it.exp || '-',
          group: groupName,
          location: `รถฉุกเฉิน (${groupName})`,
          res: isBad ? 'ใช้งานไม่ได้' : 'ใช้งานได้',
          note: st?.note || '',
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
          type: 'eq',
          sheet: 'ครุภัณฑ์',
          sheetName: uniqueSheet,
          title: 'ทะเบียนรายการครุภัณฑ์และอุปกรณ์',
          date: now.toISOString().split('T')[0],
          who: currentUser?.name || 'ผู้ดูแลระบบ (Admin)',
          user: currentUser?.username || 'admin',
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
    const nextHist = [newRecord, ...historyRecords.filter((r) => r.id !== newRecord.id)].slice(0, 50);
    setHistoryRecords(nextHist);
    setStored(STORAGE_KEYS.HISTORY, nextHist);

    // 3. Open OfficialReportModal with 'eq' tab active and eqItems populated
    setReportCategory('eq');
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
        className="relative z-10 max-w-md lg:max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8 pb-28"
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
            onNavigate={(view) => {
              if (view === 'room_check') setSelectedRoomId('or1');
              setCurrentView(view as any);
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
            onToggleCheck={(itemKey, result, itemName) =>
              handleToggleCheck('bag', itemKey, result, itemName)
            }
            onUpdateNote={(itemKey, note) => handleUpdateNote('bag', itemKey, note)}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            onBack={() => setCurrentView('home')}
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
            onToggleCheck={(itemKey, result, itemName) =>
              handleToggleCheck('cart', itemKey, result, itemName)
            }
            onUpdateNote={(itemKey, note) => handleUpdateNote('cart', itemKey, note)}
            onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
            onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            onBack={() => setCurrentView('home')}
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
                <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <FileSpreadsheet size={16} />
                      <span>Google Sheets & GAS V5</span>
                    </span>
                    {inputSheetUrl && (
                      <a
                        href={inputSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>เปิดดูชีตจริง</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {/* Sheet URL Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      URL ลิงก์ Google Sheets:
                    </label>
                    <input
                      type="url"
                      value={inputSheetUrl}
                      onChange={(e) => setInputSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner font-mono"
                    />
                  </div>

                  {/* Script URL Input & Test Connection */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Google Apps Script Web App URL:
                      </label>
                      <button
                        type="button"
                        onClick={handleTestGasConnection}
                        disabled={isTestingGas || !inputApiUrl.trim()}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        {isTestingGas ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            <span>กำลังทดสอบ...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} />
                            <span>ทดสอบการเชื่อมต่อ</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="url"
                      value={inputApiUrl}
                      onChange={(e) => setInputApiUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner font-mono"
                    />
                    {gasTestResult && (
                      <div
                        className={`p-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 ${
                          gasTestResult.ok
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}
                      >
                        {gasTestResult.ok ? <Check size={13} /> : <X size={13} />}
                        <span>{gasTestResult.msg}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleSaveSheetsConfig}
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Check size={15} />
                      <span>{savedConfigMsg ? '✓ บันทึกแล้ว!' : '💾 บันทึกการตั้งค่าชีต'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyGasCode}
                      className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      {copiedGasCode ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                      <span>{copiedGasCode ? '✓ คัดลอกแล้ว' : 'คัดลอกโค้ด V5'}</span>
                    </button>
                  </div>

                  {/* Script Code Preview Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowScriptPreview(!showScriptPreview)}
                      className="text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showScriptPreview ? 'ซ่อนตัวอย่างโค้ด Google Apps Script' : 'แสดงตัวอย่างโค้ด Google Apps Script V5'}</span>
                    </button>
                    {showScriptPreview && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-emerald-400 text-[10px] font-mono max-h-32 overflow-y-auto border border-slate-800">
                        <pre className="whitespace-pre-wrap">{GAS_SCRIPT_V5.slice(0, 600)}... (กดปุ่มคัดลอกด้านบนเพื่อนำไปวางฉบับสมบูรณ์)</pre>
                      </div>
                    )}
                  </div>
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
          onClose={() => setIsOfficialReportOpen(false)}
          initialCategory={reportCategory}
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
    </div>
  );
}
