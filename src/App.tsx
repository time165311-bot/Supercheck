import React, { useState, useMemo } from 'react';
import { ModernDashboard } from './components/ModernDashboard';
import { DrugInventoryView } from './components/DrugInventoryView';
import { BottomBar } from './components/BottomBar';
import { OfficialReportModal } from './components/OfficialReportModal';
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
import { INITIAL_DRUGS_DATA } from './constants/initialDrugs';
import { ROOMS } from './constants/initialData';
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

  // Selected Room ID for Room Check
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('or1');

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
      const nextResult = existing?.result === result ? '' : result;

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
      const roomName = roomObj ? roomObj.name : roomId;
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

      {/* MAIN VIEW CONTENT CONTAINER (Safe Area + Samsung One UI) */}
      <main 
        className="relative z-10 max-w-md mx-auto p-3 sm:p-4 pb-28"
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
            onOpenPreview={() => setIsOfficialReportOpen(true)}
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

        {/* 5. EQUIPMENT OVERVIEW (ภาพรวมครุภัณฑ์ห้องผ่าตัด) */}
        {currentView === 'eq_overview' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-[#181A20]/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-xl">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                &larr; กลับหน้าหลัก
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('room_check')}
                  className="px-3.5 py-2 rounded-2xl bg-[#3B82F6] text-white text-xs font-bold hover:bg-blue-600 transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  <MapPin size={14} />
                  <span>สลับดูผังห้องผ่าตัด</span>
                </button>
              </div>
            </div>

            <SwiperInspectionCarousel
              title="ภาพรวมครุภัณฑ์วิสัญญีประจำห้องผ่าตัด"
              subtitle="เลื่อนการ์ดเพื่อตรวจเช็กครุภัณฑ์วิสัญญีทุกห้องผ่าตัด"
              items={equipmentOverviewItems}
              checks={flattenedEquipmentChecks}
              onToggleCheck={(itemKey, result, itemName) => {
                const item = equipmentOverviewItems.find((i) => i.itemKey === itemKey);
                const roomId = item?.roomId || 'or1';
                handleToggleCheck(roomId, itemKey, result, itemName);
              }}
              onUpdateNote={(itemKey, note) => {
                const item = equipmentOverviewItems.find((i) => i.itemKey === itemKey);
                const roomId = item?.roomId || 'or1';
                handleUpdateNote(roomId, itemKey, note);
              }}
              onOpenBarcodeScan={() => setIsBarcodeScannerOpen(true)}
              onZoomImage={(imgUrl) => setZoomedImgUrl(imgUrl)}
            />
          </div>
        )}

        {/* 6. ROOM EQUIPMENT CHECK (ผังห้องผ่าตัด FLOOR MAP) */}
        {currentView === 'room_check' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-[#181A20]/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-xl">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                &larr; กลับหน้าหลัก
              </button>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
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
              onOpenReport={() => setIsOfficialReportOpen(true)}
            />
          </div>
        )}

        {/* 7. USER MANAGEMENT (เฉพาะ ADMIN) */}
        {currentView === 'users' && currentUser?.role === 'admin' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-[#181A20]/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-xl">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                &larr; กลับหน้าหลัก
              </button>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
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

      {/* 📂 SAMSUNG ONE UI BOTTOM SHEET DRAWER (ย้ายเมนูจากขวาบนลงมาไว้ตรงนี้) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className={`w-full max-w-md rounded-t-[2.5rem] p-6 space-y-4 border-t shadow-2xl transition-transform transform translate-y-0 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto no-scrollbar ${
              isDark ? 'bg-[#181A20] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* One UI Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-600/50 rounded-full mx-auto mb-1" />

            {/* Drawer Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3B82F6] text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {currentUser?.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <h3 className="text-base font-bold leading-none">{currentUser?.name || 'ผู้ใช้งาน'}</h3>
                  <span className="text-[11px] opacity-60">Anesthesia Care • Samsung One UI</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            {/* One UI Quick Actions Menu */}
            <div className="space-y-2.5 py-1">
              <button
                type="button"
                onClick={() => {
                  setIsOfficialReportOpen(true);
                  setIsDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 shadow-sm transition cursor-pointer"
              >
                <span className="text-lg">📊</span>
                <span>รายงานสรุปประจำวัน & พรีวิว PDF</span>
              </button>

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
                      : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  <span className="text-lg">⚙️</span>
                  <span>จัดการผู้ใช้ (Admin)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(true);
                  setIsDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 shadow-sm transition cursor-pointer"
              >
                <UserIcon size={18} className="text-blue-500" />
                <span>โปรไฟล์ผู้ใช้งาน</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPasswordOpen(true);
                  setIsDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 shadow-sm transition cursor-pointer"
              >
                <Lock size={18} className="text-amber-500" />
                <span>เปลี่ยนรหัสผ่าน</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 shadow-sm transition cursor-pointer"
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
        onOpenReport={() => setIsOfficialReportOpen(true)}
        onOpenGoogleSheet={() => {
          if (sheetUrl) window.open(sheetUrl, '_blank');
          else alert('ยังไม่ได้ตั้งค่า Google Sheet URL');
        }}
        onOpenDrawer={() => setIsDrawerOpen(true)}
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
              className="absolute -top-10 right-0 p-2 text-white bg-slate-800 rounded-full hover:bg-slate-700"
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
            setIsOfficialReportOpen(true);
          }}
        />
      )}

      {isProfileOpen && currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
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
