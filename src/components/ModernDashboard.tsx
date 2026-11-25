import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Bell,
  Sun,
  Moon,
  Search,
  X,
  Package,
  ShieldAlert,
  Truck,
  Stethoscope,
  ScanLine,
  FileText,
  FileSpreadsheet,
  Menu,
} from 'lucide-react';
import { CheckItemState, DrugItem, EquipmentItem, ExpiryAlertItem, ListConfig, User } from '../types';
import {
  ALERTS_UPDATED_EVENT,
  DISMISSED_ALERTS_STORAGE_KEY,
  getDismissedAlertKeys,
  getVisibleExpiryAlerts,
} from '../utils/alertUtils';
import { categoryCovers } from '../assets/categoryCovers';
import {
  calculateOverallInventoryStats,
  isValidInventoryItem,
} from '../utils/inventoryStats';
import { ROOMS } from '../constants/initialData';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';
import { useDataContext } from '../context/DataContext';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

interface ModernDashboardProps {
  currentUser: User | null;
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<string, ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  expiryAlerts: ExpiryAlertItem[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onNavigate: (view: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'users' | 'drug_check') => void;
  activeCategory?: 'equipment' | 'bag' | 'ambulance' | 'cart' | 'medicine';
  activeCategoryIndex?: number;
  onSelectCategory?: (category: 'equipment' | 'bag' | 'ambulance' | 'cart' | 'medicine', index?: number) => void;
  onSelectRoom?: (roomId: string) => void;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenDrawer?: () => void;
  onOpenMenu?: () => void;
  onOpenReport?: () => void;
  onOpenSheets?: () => void;
  sheetUrl?: string;
  onOpenChannelSelector?: () => void;
  onToggleCheck?: (categoryOrRoomId: string, itemKey: string, result: 'ปกติ' | 'ผิดปกติ', itemName: string) => void;
  onUpdateNote?: (categoryOrRoomId: string, itemKey: string, note: string) => void;
  onZoomImage?: (url: string) => void;
  onOpenBarcodeScan?: () => void;
  overallStats: {
    grandTotal: number;
    grandChecked: number;
    grandNormal: number;
    grandDefective: number;
    completionPct: number;
  };
}

const CATEGORY_ORDER: Array<'medicine' | 'equipment' | 'bag' | 'cart'> = [
  'medicine',
  'equipment',
  'bag',
  'cart',
];
const CATEGORY_COUNT = CATEGORY_ORDER.length;

export const ModernDashboard: React.FC<ModernDashboardProps> = ({
  currentUser,
  drugs,
  equipment,
  lists,
  globalChecks,
  expiryAlerts,
  theme,
  onNavigate,
  activeCategory = 'bag',
  activeCategoryIndex,
  onSelectCategory,
  onOpenNotifications,
  onOpenProfile,
  onOpenDrawer,
  onOpenMenu,
  onOpenReport,
  onOpenSheets,
  sheetUrl = '',
  onOpenChannelSelector,
  overallStats,
}) => {
  const { activeChannel } = useDataContext();
  const isDarkMode = theme ? theme === 'dark' : true;
  const swiperRef = React.useRef<any>(null);
  const [dashSearchTerm, setDashSearchTerm] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [coverFallbackMap, setCoverFallbackMap] = useState<Record<string, boolean>>({});

  // Listen for user profile updates in real-time
  const [, setProfileTrigger] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setProfileTrigger((prev) => prev + 1);
    window.addEventListener('user_profile_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('user_profile_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const effectiveDisplayName = (typeof window !== 'undefined' ? localStorage.getItem('user_display_name') : null) || currentUser?.name || 'สาธิต';

  // Helper to map category ID / index to Swiper slide index (center cycle of 15-item loopedCategories)
  const resolvedCategoryIndex = useMemo(() => {
    if (typeof activeCategoryIndex === 'number' && activeCategoryIndex >= 0 && activeCategoryIndex < CATEGORY_COUNT) {
      return activeCategoryIndex;
    }
    const found = CATEGORY_ORDER.indexOf(activeCategory as any);
    return found >= 0 ? found : 2;
  }, [activeCategory, activeCategoryIndex]);

  const initialSlideIndex = useMemo(() => CATEGORY_COUNT + resolvedCategoryIndex, [resolvedCategoryIndex]);
  const lastSlideModRef = React.useRef<number>(resolvedCategoryIndex);

  React.useEffect(() => {
    if (!swiperRef.current) return;
    if (lastSlideModRef.current === resolvedCategoryIndex) return;
    const currentRealMod = ((swiperRef.current.realIndex ?? 0) % CATEGORY_COUNT + CATEGORY_COUNT) % CATEGORY_COUNT;
    if (currentRealMod !== resolvedCategoryIndex) {
      try {
        lastSlideModRef.current = resolvedCategoryIndex;
        swiperRef.current.slideTo(CATEGORY_COUNT + resolvedCategoryIndex, 300);
      } catch {
        // ignore
      }
    }
  }, [resolvedCategoryIndex]);

  // Window Resize & Viewport Breakpoint Listener to re-calculate Swiper dimensions & reset layout
  useLayoutEffect(() => {
    const handleResize = () => {
      if (swiperRef.current) {
        try {
          swiperRef.current.update();
          swiperRef.current.updateSize();
          swiperRef.current.updateSlides();
          swiperRef.current.updateProgress();
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    const timer = setTimeout(handleResize, 120);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Smooth Gesture vs Click separation using Swiper sliderMove + pointer delta
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isDragActionRef = React.useRef<boolean>(false);
  const dragSuppressionUntilRef = React.useRef<number>(0);
  const lastNavTimeRef = React.useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    isDragActionRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 8 || dy > 8) {
      isDragActionRef.current = true;
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
    if (isDragActionRef.current) {
      dragSuppressionUntilRef.current = Date.now() + 240;
      isDragActionRef.current = false;
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    isDragActionRef.current = false;
  };

  const handleCategorySelect = (
    targetView: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'users' | 'drug_check'
  ) => {
    if (Date.now() < dragSuppressionUntilRef.current || isDragActionRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastNavTimeRef.current < 220) return;
    lastNavTimeRef.current = now;

    if (onSelectCategory) {
      if (targetView === 'drug_check') onSelectCategory('medicine', 0);
      else if (targetView === 'room_check' || targetView === 'eq_overview') onSelectCategory('equipment', 1);
      else if (targetView === 'bag_check') onSelectCategory('bag', 2);
      else if (targetView === 'cart_check') onSelectCategory('cart', 3);
    }

    onNavigate(targetView);
  };

  // Weather State
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    humidity: number;
    condition: string;
    locationName: string;
  }>({
    temp: 26,
    humidity: 82,
    condition: 'ปลอดโปร่ง',
    locationName: 'กรุงเทพฯ',
  });

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async (lat = 13.7563, lon = 100.5018) => {
      try {
        const res = await fetch(`/api/weather?latitude=${lat}&longitude=${lon}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.current) {
            setWeatherData({
              temp: Math.round(data.current.temperature_2m || 26),
              humidity: data.current.relative_humidity_2m || 82,
              condition: data.current.is_day ? 'ท้องฟ้าโปร่ง' : 'ปลอดโปร่ง',
              locationName: 'กรุงเทพฯ',
            });
          }
        }
      } catch (e) {
        // Fallback
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather()
      );
    } else {
      fetchWeather();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const computedStats = useMemo(
    () =>
      calculateOverallInventoryStats({
        drugs: drugs || [],
        equipment: equipment || {},
        lists: lists || {},
        globalChecks: globalChecks || {},
        rooms: ROOMS,
      }),
    [drugs, equipment, lists, globalChecks]
  );

  const stats = overallStats && overallStats.grandTotal === computedStats.grandTotal
    ? overallStats
    : computedStats;

  const { drugsCount, equipmentCount, bagCount, cartCount } = computedStats;
  const totalInventoryCount = computedStats.grandTotal;

  // Defective items list (Strictly matched against existing valid inventory items)
  const defectiveItems = useMemo<Array<{
    category: string;
    name: string;
    location: string;
    note?: string;
    targetView: 'eq_overview' | 'bag_check' | 'ambulance_check' | 'cart_check' | 'drug_check';
  }>>(() => {
    const list: Array<{
      category: string;
      name: string;
      location: string;
      note?: string;
      targetView: 'eq_overview' | 'bag_check' | 'ambulance_check' | 'cart_check' | 'drug_check';
    }> = [];

    // 1. Equipment (validate against actual equipment items in each room)
    Object.entries(equipment || {}).forEach(([roomId, roomItems]) => {
      const checks = (globalChecks && globalChecks[roomId]) || {};
      if (!checks || typeof checks !== 'object' || !Array.isArray(roomItems) || roomItems.length === 0) return;

      roomItems.forEach((eq, idx) => {
        if (!isValidInventoryItem(eq)) return;
        const itemKey = eq.id || `${roomId}_${idx}`;
        const val = checks[itemKey];
        if (val && val.result === 'ผิดปกติ') {
          list.push({
            category: 'ครุภัณฑ์ห้องผ่าตัด',
            name: eq.name,
            location: roomId.toUpperCase(),
            note: val.note,
            targetView: 'eq_overview',
          });
        }
      });
    });

    // 2. Bag & Cart (validate against actual existing items in lists)
    (['bag', 'cart'] as const).forEach((cat) => {
      const checks = (globalChecks && globalChecks[cat]) || {};
      const groups = lists?.[cat]?.groups || {};
      if (!checks || typeof checks !== 'object') return;

      Object.entries(groups).forEach(([groupName, groupItems]) => {
        (groupItems || []).forEach((it, idx) => {
          if (!isValidInventoryItem(it)) return;
          const itemKey = it.id || `${cat}_${groupName}_${idx}`;
          const altKey = `${cat}_${idx}`;
          const val = checks[itemKey] || checks[altKey];
          if (val && val.result === 'ผิดปกติ') {
            list.push({
              category: cat === 'bag' ? 'กระเป๋า Emergency' : 'รถเข็นฉุกเฉิน',
              name: it.name,
              location: groupName || cat,
              note: val.note,
              targetView: cat === 'bag' ? 'bag_check' : 'cart_check',
            });
          }
        });
      });
    });

    // 3. Drugs out of stock
    (drugs || []).forEach((d) => {
      if (isValidInventoryItem(d) && Number(d.remaining) <= 0) {
        list.push({
          category: 'คลังยาและสารน้ำ',
          name: d.name,
          location: 'คลังยา OR',
          note: 'ยาหมดสต็อก (0 หน่วย)',
          targetView: 'drug_check',
        });
      }
    });

    return list;
  }, [equipment, globalChecks, lists, drugs]);

  const syncedDefectiveCount = defectiveItems.length;

  const dashSearchResults = useMemo(() => {
    const q = dashSearchTerm.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ name: string; location: string; targetView: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'users' | 'drug_check' }> = [];

    (drugs || []).forEach((d: any) => {
      if (isValidInventoryItem(d) && (d.name.toLowerCase().includes(q) || (d.barcode && String(d.barcode).toLowerCase().includes(q)))) {
        results.push({ name: d.name, location: 'คลังยา OR', targetView: 'drug_check' });
      }
    });

    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      (items || []).forEach((item) => {
        if (isValidInventoryItem(item) && (item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q)))) {
          results.push({ name: item.name, location: `ห้องผ่าตัด ${roomId.toUpperCase()}`, targetView: 'room_check' });
        }
      });
    });

    (['bag', 'cart'] as const).forEach((typeKey) => {
      const config = lists?.[typeKey];
      if (config && config.groups) {
        Object.entries(config.groups).forEach(([, items]) => {
          (items || []).forEach((it) => {
            if (isValidInventoryItem(it) && (it.name.toLowerCase().includes(q) || (it.code && it.code.toLowerCase().includes(q)))) {
              results.push({
                name: it.name,
                location: typeKey === 'bag' ? 'กระเป๋า Emergency' : 'รถเข็นฉุกเฉิน',
                targetView: typeKey === 'bag' ? 'bag_check' : 'cart_check',
              });
            }
          });
        });
      }
    });

    return results.slice(0, 10);
  }, [dashSearchTerm, drugs, equipment, lists]);

  const categories = useMemo(() => [
    {
      id: 'medicine',
      title: 'คลังยา & สารน้ำฉุกเฉิน',
      count: `${drugsCount} รายการ`,
      icon: <Package className="w-4 h-4 text-emerald-400 shrink-0" />,
      bg: categoryCovers.drugs,
      targetView: 'drug_check' as const,
    },
    {
      id: 'equipment',
      title: 'ครุภัณฑ์ห้องผ่าตัด (OR)',
      count: `${equipmentCount} รายการ`,
      icon: <Stethoscope className="w-4 h-4 text-blue-400 shrink-0" />,
      bg: categoryCovers.equipment,
      targetView: 'room_check' as const,
    },
    {
      id: 'bag',
      title: 'กระเป๋าฉุกเฉิน (Emergency Bag)',
      count: `${bagCount} รายการ`,
      icon: <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />,
      bg: categoryCovers.bag,
      targetView: 'bag_check' as const,
    },
    {
      id: 'cart',
      title: 'รถฉุกเฉิน (Crash Cart)',
      count: `${cartCount} รายการ`,
      icon: <Truck className="w-4 h-4 text-indigo-400 shrink-0" />,
      bg: categoryCovers.cart,
      targetView: 'cart_check' as const,
    },
  ], [drugsCount, equipmentCount, bagCount, cartCount]);

  // Looped categories (12 items total: 3 cycles of the 4 categories)
  const loopedCategories = useMemo(() => {
    return [
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c1` })),
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c2` })),
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c3` })),
    ];
  }, [categories]);

  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<string[]>(() =>
    getDismissedAlertKeys()
  );

  useEffect(() => {
    const syncDismissed = () => setDismissedAlertKeys(getDismissedAlertKeys());
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === DISMISSED_ALERTS_STORAGE_KEY) syncDismissed();
    };
    window.addEventListener(ALERTS_UPDATED_EVENT, syncDismissed);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(ALERTS_UPDATED_EVENT, syncDismissed);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const visibleExpiryAlerts = useMemo(
    () => getVisibleExpiryAlerts(expiryAlerts || [], dismissedAlertKeys),
    [expiryAlerts, dismissedAlertKeys]
  );

  const bellBadgeCount = visibleExpiryAlerts.length;

  const expiryWarningCount = useMemo(
    () => visibleExpiryAlerts.filter((a) => a.status === 'expired' || a.status === 'warning').length,
    [visibleExpiryAlerts]
  );

  const totalAlertCount = defectiveItems.length + expiryWarningCount;

  return (
    <div className="w-full max-w-full overflow-x-hidden relative select-none">
      <style>{`
        .swiper-pagination-bullet-active {
          background: #3B82F6 !important;
          width: 22px !important;
          border-radius: 6px !important;
        }
        .card-grab-cursor,
        .swiper,
        .swiper-slide {
          cursor: grab !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .card-grab-cursor:active,
        .swiper:active,
        .swiper.swiper-grabbing,
        .swiper.swiper-grabbing *,
        .swiper-slide:active {
          cursor: grabbing !important;
        }
        .carousel-action-btn {
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        .swiper-slide {
          pointer-events: auto !important;
        }
        .swiper-slide img {
          -webkit-user-drag: none;
          user-drag: none;
          pointer-events: none;
        }

        /* Focus Carousel: Smooth horizontal touch swipe + GPU transform & opacity */
        .focus-carousel-swiper {
          overflow: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          padding-top: 16px !important;
          padding-bottom: 30px !important;
          touch-action: pan-y !important;
        }
        .focus-carousel-swiper .swiper-wrapper {
          align-items: center !important;
        }
        .focus-carousel-swiper .swiper-slide {
          overflow: visible !important;
          min-width: 0 !important;
          flex-shrink: 0 !important;
        }
        .focus-carousel-card {
          transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease !important;
          will-change: transform, opacity;
        }
        .focus-carousel-swiper .swiper-slide-active {
          z-index: 30 !important;
        }
        .focus-carousel-swiper .swiper-slide-active .focus-carousel-card {
          transform: scale(1.03) translateZ(0) !important;
          opacity: 1 !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2) !important;
          z-index: 30 !important;
        }
        .focus-carousel-swiper .swiper-slide:not(.swiper-slide-active) .focus-carousel-card {
          transform: scale(0.92) translateZ(0) !important;
          opacity: 0.62 !important;
          box-shadow: none !important;
          z-index: 10 !important;
        }
      `}</style>

      {/* Main Container (Uniform grid gap without double padding or horizontal bleed) */}
      <div className="space-y-5 relative z-10 w-full max-w-7xl mx-auto overflow-x-hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        
        {/* 1. Unified Header Card & Live Ward Weather */}
        <div
          className={`w-full min-w-0 p-4 sm:p-6 lg:p-7 rounded-[2rem] border shadow-sm space-y-4 lg:col-span-2 relative overflow-hidden text-white ${
            isDarkMode
              ? 'bg-[#1E1F20] border-white/10'
              : 'bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 border-blue-400/40'
          }`}
        >
          {/* Top Bar: Brand + Desktop Quick Actions (PDF, Google Sheets, Profile, Bell, Menu Drawer) */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/15 relative z-10">
            <div className="flex items-center gap-2 sm:gap-2.5 font-valorant text-2xl sm:text-3xl lg:text-4xl font-bold tracking-wider whitespace-nowrap shrink-0">
              <span className={isDarkMode ? 'text-[#A8C7FA]' : 'text-sky-200'}>ANESTHESIA</span>
              <span className="text-white">CARE</span>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-2.5 lg:gap-3 shrink-0">
              {/* Desktop Quick Action: PDF Report Preview */}
              {onOpenReport && (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs lg:text-sm font-bold transition-colors active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                  title="พรีวิวรายงานและพิมพ์เอกสาร (PDF)"
                >
                  <FileText size={16} className="shrink-0" />
                  <span>พรีวิวรายงาน (PDF)</span>
                </button>
              )}

              {/* Desktop Quick Action: Open Google Sheets */}
              {sheetUrl?.trim() ? (
                <a
                  href={sheetUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-300/35 text-white text-xs lg:text-sm font-bold transition-colors active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                  title="เปิด Google Sheets"
                >
                  <FileSpreadsheet size={16} className="shrink-0 text-emerald-200" />
                  <span>เปิด Google Sheets</span>
                </a>
              ) : onOpenSheets ? (
                <button
                  type="button"
                  onClick={onOpenSheets}
                  className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs lg:text-sm font-bold transition-colors active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                  title="ตั้งค่าและเปิด Google Sheets"
                >
                  <FileSpreadsheet size={16} className="shrink-0 text-emerald-200" />
                  <span>เปิด Google Sheets</span>
                </button>
              ) : null}

              {/* User Profile */}
              {currentUser && onOpenProfile && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-full border border-white/30 bg-white/15 hover:bg-white/25 text-white transition-colors active:opacity-80 cursor-pointer shrink-0"
                  title="คลิกเพื่อแก้ไขโปรไฟล์และชื่อผู้ตรวจ"
                >
                  <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-cyan-400 text-blue-900 font-black flex items-center justify-center text-[10px] lg:text-xs overflow-hidden shrink-0">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={effectiveDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      effectiveDisplayName ? effectiveDisplayName.charAt(0) : 'U'
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs lg:text-sm font-bold truncate max-w-[72px] sm:max-w-[140px] text-white whitespace-nowrap">
                    {effectiveDisplayName}
                  </span>
                </button>
              )}

              {/* Notification Bell */}
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="relative p-2 sm:p-2.5 lg:w-10 lg:h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
                  title="การแจ้งเตือน"
                >
                  <Bell size={18} />
                  {bellBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs border border-white/50">
                      {bellBadgeCount > 99 ? '99+' : bellBadgeCount}
                    </span>
                  )}
                </button>
              )}

              {/* Far-Right Slide-over Menu Drawer Trigger */}
              {(onOpenMenu || onOpenDrawer) && (
                <button
                  type="button"
                  onClick={onOpenMenu || onOpenDrawer}
                  className="hidden md:flex w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
                  title="เปิดเมนูระบบและตั้งค่า"
                  aria-label="เปิดเมนูระบบ"
                >
                  <Menu size={19} />
                </button>
              )}
            </div>
          </div>

          {/* Ward / Channel Selector & Live Weather */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center justify-between gap-3 w-full md:w-auto bg-white/15 px-3.5 lg:px-5 py-2 lg:py-2.5 rounded-2xl border border-white/20 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] sm:text-xs lg:text-sm text-blue-100 opacity-90 uppercase font-bold shrink-0">วอร์ด:</span>
                <span className="text-xs sm:text-sm lg:text-base font-bold text-white truncate">
                  {activeChannel?.name || 'คลินิกวิสัญญี (Master)'}
                </span>
                {activeChannel?.isDefault && (
                  <span className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] lg:text-xs font-bold uppercase border border-white/20 shrink-0">
                    Master
                  </span>
                )}
              </div>

              {onOpenChannelSelector && (
                <button
                  type="button"
                  onClick={onOpenChannelSelector}
                  className="px-2.5 lg:px-3.5 py-1 lg:py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 keep-dark-text text-[11px] lg:text-xs font-bold uppercase transition-colors shrink-0 active:opacity-80 cursor-pointer whitespace-nowrap"
                >
                  สลับ
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2.5 bg-white/15 px-4 lg:px-5 py-2 lg:py-2.5 rounded-2xl border border-white/15 text-xs lg:text-sm text-blue-100 shrink-0">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-amber-300 shrink-0" />
                <span className="font-bold text-white tabular-nums lg:text-base">{weatherData.temp}°C</span>
                <span className="opacity-95 truncate lg:text-sm">
                  {weatherData.locationName} ({weatherData.condition})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Search Bar (Gemini Minimalist Charcoal Dark Mode) */}
        <div className="lg:col-span-2 w-full min-w-0 space-y-2">
          <div className={`w-full rounded-2xl p-3 sm:p-3.5 lg:px-5 lg:h-14 border shadow-xs flex items-center justify-between gap-3 transition-colors ${
            isDarkMode
              ? 'bg-[#1E1F20] border-white/10 text-[#E3E3E3]'
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Search size={19} className={isDarkMode ? 'text-[#A8C7FA] shrink-0' : 'text-blue-500 shrink-0'} />
              <input
                type="text"
                value={dashSearchTerm}
                onChange={(e) => setDashSearchTerm(e.target.value)}
                placeholder="ค้นหาอุปกรณ์, ยา, กระเป๋าฉุกเฉิน, รถฉุกเฉิน..."
                className="search-transparent w-full bg-transparent border-0 outline-none text-xs sm:text-sm lg:text-base font-medium placeholder:text-slate-400 dark:placeholder:text-[#8E918F]"
              />
              {dashSearchTerm && (
                <button
                  type="button"
                  onClick={() => setDashSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="shrink-0">
              <span className={`text-xs lg:text-sm font-bold px-3 lg:px-4 py-1.5 rounded-full border tabular-nums whitespace-nowrap ${
                isDarkMode
                  ? 'bg-[#282A2C] border-white/10 text-[#A8C7FA]'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {totalInventoryCount} รายการ
              </span>
            </div>
          </div>

          {dashSearchTerm.trim() !== '' && (
            <div className={`p-3.5 rounded-2xl border shadow-sm space-y-2 max-h-64 overflow-y-auto overscroll-contain ${
              isDarkMode ? 'bg-[#1E1F20] border-white/10 text-[#E3E3E3]' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1 pb-1 border-b border-slate-700/20">
                <span className="tabular-nums">ผลการค้นหา ({dashSearchResults.length} รายการ)</span>
                <button type="button" onClick={() => setDashSearchTerm('')} className="text-xs text-blue-400 hover:underline cursor-pointer">
                  ปิด
                </button>
              </div>
              {dashSearchResults.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">ไม่พบรายการที่ตรงกับคำค้นหา "{dashSearchTerm}"</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {dashSearchResults.map((resItem, i) => (
                    <button
                      type="button"
                      key={`sr_${i}`}
                      onClick={() => {
                        onNavigate(resItem.targetView);
                        setDashSearchTerm('');
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs text-left cursor-pointer hover:border-blue-500 transition-colors active:opacity-80 ${
                        isDarkMode ? 'bg-[#131314] border-white/10 text-[#E3E3E3]' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate text-xs">{resItem.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">📍 {resItem.location}</p>
                      </div>
                      <ChevronRight size={14} className="text-blue-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Main Category Cards: Mobile Carousel + Desktop 4-Column Full Grid */}
        <div className="space-y-4 lg:col-span-2 relative w-full min-w-0 max-w-full overflow-hidden">
          <div className="flex justify-between items-end px-1">
            <div className="min-w-0">
              <h2 className={`text-lg sm:text-2xl lg:text-[26px] font-extrabold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                หมวดหมู่ตรวจเช็กหลัก
              </h2>
              <p className={`text-xs lg:text-sm mt-0.5 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                เลือกหมวดหมู่ที่ต้องการเริ่มทำการตรวจเช็กประเมินความพร้อม
              </p>
            </div>
          </div>

          {/* Desktop 4-Column Full Grid (No clipped side cards or < > arrows) */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-5">
            {categories.map((item) => (
              <div
                key={`desktop_${item.id}`}
                onClick={() => handleCategorySelect(item.targetView)}
                className="group relative h-80 xl:h-[22rem] rounded-[2rem] overflow-hidden cursor-pointer bg-slate-900 border border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {!coverFallbackMap[item.id] ? (
                  <img
                    src={item.bg}
                    alt={item.title}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    onError={() =>
                      setCoverFallbackMap((prev) =>
                        prev[item.id] ? prev : { ...prev, [item.id]: true }
                      )
                    }
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none"
                  />
                ) : (
                  <img
                    src={categoryCovers.operatingRoom}
                    alt={item.title}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover opacity-85 select-none"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

                <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                  <span className="self-start bg-black/75 text-white text-xs xl:text-sm px-3.5 py-1.5 rounded-full font-bold border border-white/20 shadow-xs flex items-center gap-2 tabular-nums whitespace-nowrap">
                    {item.icon} {item.count}
                  </span>

                  <div className="space-y-3.5">
                    <h3 className="text-xl xl:text-2xl font-extrabold text-white leading-snug drop-shadow-sm">
                      {item.title}
                    </h3>
                    <button
                      type="button"
                      className="w-full bg-[#3B82F6] hover:bg-blue-500 text-white font-bold text-sm xl:text-base py-3 px-5 rounded-2xl shadow-sm transition-colors active:opacity-80 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>เข้าตรวจเช็ก &rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile & Tablet Horizontal Swiper Carousel */}
          <div className="lg:hidden relative w-full max-w-full overflow-hidden group">
            {/* Mobile-Only Edge Arrows (No backdrop-blur) */}
            <button
              type="button"
              onClick={() => swiperRef.current?.slidePrev()}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-slate-900/70 text-white flex items-center justify-center active:opacity-80 transition-opacity border border-white/15 shadow-sm cursor-pointer"
              aria-label="หมวดหมู่ก่อนหน้า"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => swiperRef.current?.slideNext()}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-slate-900/70 text-white flex items-center justify-center active:opacity-80 transition-opacity border border-white/15 shadow-sm cursor-pointer"
              aria-label="หมวดหมู่ถัดไป"
            >
              <ChevronRight size={22} />
            </button>
            <Swiper
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
              }}
              onAfterInit={(swiper) => {
                setTimeout(() => {
                  try {
                    swiper.update();
                  } catch {
                    // ignore
                  }
                }, 40);
              }}
              onSlideChange={(swiper) => {
                const modIdx = ((swiper.realIndex ?? 0) % CATEGORY_COUNT + CATEGORY_COUNT) % CATEGORY_COUNT;
                lastSlideModRef.current = modIdx;
                const catId = CATEGORY_ORDER[modIdx];
                if (catId && onSelectCategory) {
                  onSelectCategory(catId, modIdx);
                }
              }}
              onSliderMove={() => {
                isDragActionRef.current = true;
              }}
              onTouchEnd={() => {
                if (isDragActionRef.current) {
                  dragSuppressionUntilRef.current = Date.now() + 240;
                  isDragActionRef.current = false;
                }
              }}
              modules={[EffectCoverflow, Pagination]}
              effect={'coverflow'}
              grabCursor={true}
              simulateTouch={true}
              allowTouchMove={true}
              touchStartPreventDefault={false}
              slideToClickedSlide={true}
              loop={true}
              loopPreventsSliding={false}
              loopAdditionalSlides={4}
              initialSlide={initialSlideIndex}
              speed={300}
              resistance={true}
              resistanceRatio={0.7}
              touchRatio={1}
              touchAngle={45}
              longSwipes={true}
              longSwipesRatio={0.2}
              longSwipesMs={220}
              shortSwipes={true}
              followFinger={true}
              preventClicks={false}
              preventClicksPropagation={false}
              observer={true}
              observeParents={true}
              resizeObserver={true}
              threshold={6}
              breakpoints={{
                320: { slidesPerView: 1.08, spaceBetween: 12, centeredSlides: true },
                640: { slidesPerView: 1.8, spaceBetween: 18, centeredSlides: true },
                1024: { slidesPerView: 2.2, spaceBetween: 30, centeredSlides: true },
              }}
              coverflowEffect={{
                rotate: 0,
                stretch: 0,
                depth: 0,
                modifier: 1,
                slideShadows: false,
              }}
              pagination={{ clickable: true, dynamicBullets: true }}
              className="focus-carousel-swiper w-full max-w-full px-2 sm:px-6 card-grab-cursor select-none overflow-hidden"
            >
              {loopedCategories.map((item) => (
                <SwiperSlide key={item.uniqueId} className="select-none pointer-events-auto min-w-0 flex-shrink-0">
                  {({ isActive }) => (
                    <div
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      onClick={() => {
                        if (!isDragActionRef.current && Date.now() >= dragSuppressionUntilRef.current) {
                          handleCategorySelect(item.targetView);
                        }
                      }}
                      className={`w-full focus-carousel-card card-grab-cursor relative h-72 sm:h-80 rounded-[2rem] overflow-hidden select-none pointer-events-auto cursor-grab active:cursor-grabbing bg-slate-900 ${
                        isActive ? 'ring-2 ring-white/40' : ''
                      }`}
                    >
                      {!coverFallbackMap[item.id] ? (
                        <img
                          src={item.bg}
                          alt={item.title}
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          onError={() =>
                            setCoverFallbackMap((prev) =>
                              prev[item.id] ? prev : { ...prev, [item.id]: true }
                            )
                          }
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                        />
                      ) : (
                        <img
                          src={categoryCovers.operatingRoom}
                          alt={item.title}
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none opacity-85"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent pointer-events-none" />

                      <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-between z-10 pointer-events-none">
                        <span className="self-start bg-black/75 text-white text-xs sm:text-sm px-3.5 py-1.5 rounded-full font-bold border border-white/20 shadow-xs flex items-center gap-2 tabular-nums">
                          {item.icon} {item.count}
                        </span>

                        <div className="space-y-3.5">
                          <h3 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-sm">
                            {item.title}
                          </h3>
                          <button
                            type="button"
                            className="w-full bg-[#3B82F6] hover:bg-blue-500 text-white font-bold text-sm sm:text-base py-3 px-6 rounded-2xl shadow-sm transition-colors active:opacity-80 flex items-center justify-center gap-2 pointer-events-auto"
                          >
                            <span>เข้าตรวจเช็ก &rarr;</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        {/* 4. Readiness Statistics */}
        <div
          className={`w-full min-w-0 max-w-full rounded-[2rem] p-5 sm:p-7 border shadow-xs space-y-5 lg:col-span-2 overflow-hidden ${
            isDarkMode
              ? 'bg-[#181A20] border-slate-800 text-white'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex flex-col space-y-0.5">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              สถิติความพร้อมประจำวัน
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              สรุปสถานะความพร้อมอุปกรณ์และคลังยาภาพรวมประจำรอบ
            </p>
          </div>

          <div className="flex flex-row items-center justify-start gap-4 sm:gap-8 pt-1 overflow-x-hidden">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15.9155"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="3.2"
                  fill="none"
                  stroke="currentColor"
                />
                <circle
                  cx="18" cy="18" r="15.9155"
                  className="text-blue-500"
                  strokeWidth="3.2"
                  strokeDasharray={`${stats.completionPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  stroke="currentColor"
                />
                {syncedDefectiveCount > 0 && stats.grandTotal > 0 && (
                  <circle
                    cx="18" cy="18" r="15.9155"
                    className="text-rose-500"
                    strokeWidth="3.2"
                    strokeDasharray={`${Math.min(100, (syncedDefectiveCount / stats.grandTotal) * 100)}, 100`}
                    strokeDashoffset={-stats.completionPct}
                    strokeLinecap="round"
                    fill="none"
                    stroke="currentColor"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 leading-none tabular-nums">
                  {stats.completionPct}%
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ready</span>
              </div>
            </div>

            <div className="flex-1 space-y-2 min-w-0">
              <div className={`flex justify-between items-center px-3.5 py-2.5 rounded-2xl border transition-colors ${
                isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ทั้งหมด</span>
                <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
                  <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{stats.grandTotal}</span>
                  <span className="text-[10px] text-slate-400 font-bold">รายการ</span>
                </div>
              </div>

              <div className={`flex justify-between items-center px-3.5 py-2.5 rounded-2xl border transition-colors ${
                isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>พร้อมใช้</span>
                <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
                  <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">{stats.grandNormal}</span>
                  <span className="text-[10px] text-blue-400 font-bold">รายการ</span>
                </div>
              </div>

              <div className={`flex justify-between items-center px-3.5 py-2.5 rounded-2xl border transition-colors ${
                isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>ชำรุด</span>
                <div className="flex items-baseline gap-1 shrink-0 tabular-nums">
                  <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">{syncedDefectiveCount}</span>
                  <span className="text-[10px] text-rose-400 font-bold">รายการ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Collapsible Urgent Alerts & Expiry Banner (Collapsed by default for clean viewport) */}
        {totalAlertCount > 0 && (
          <div
            className={`w-full min-w-0 max-w-full rounded-3xl p-4 sm:p-5 border shadow-xs lg:col-span-2 overflow-hidden ${
              isDarkMode
                ? 'bg-[#181A20] border-slate-800 text-white'
                : 'bg-white border-rose-200 text-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowAlerts((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 cursor-pointer active:opacity-80 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-rose-500 truncate tabular-nums">
                    พบ {totalAlertCount} รายการต้องเฝ้าระวัง / ชำรุด
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {defectiveItems.length > 0 ? `ชำรุด/หมดสต็อก ${defectiveItems.length}` : ''}
                    {defectiveItems.length > 0 && expiryWarningCount > 0 ? ' • ' : ''}
                    {expiryWarningCount > 0 ? `ใกล้หมดอายุ/หมดอายุ ${expiryWarningCount}` : ''}
                    {' • แตะเพื่อดูรายละเอียด'}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span>{showAlerts ? 'ซ่อน' : 'ดูรายการ'}</span>
                {showAlerts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>

            {showAlerts && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-4 mt-3 border-t border-slate-200 dark:border-slate-800">
                {defectiveItems.slice(0, 6).map((item, idx) => (
                  <button
                    type="button"
                    key={`def_${idx}`}
                    onClick={() => onNavigate(item.targetView)}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-left hover:border-rose-400 transition-colors cursor-pointer active:opacity-80 ${
                      isDarkMode
                        ? 'bg-[#101216] border-slate-800 text-white'
                        : 'bg-slate-50 border-rose-100 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        📍 {item.location} • {item.note || 'พบข้อบกพร่อง'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-rose-400 shrink-0" />
                  </button>
                ))}
                {visibleExpiryAlerts
                  .filter((a) => a.status === 'expired' || a.status === 'warning')
                  .slice(0, 3)
                  .map((alertItem, idx) => (
                    <button
                      type="button"
                      key={`exp_${idx}`}
                      onClick={() =>
                        onNavigate(
                          alertItem.category === 'bag'
                            ? 'bag_check'
                            : alertItem.category === 'ambulance'
                            ? 'ambulance_check'
                            : 'cart_check'
                        )
                      }
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-left hover:border-amber-400 transition-colors cursor-pointer active:opacity-80 ${
                        isDarkMode
                          ? 'bg-[#101216] border-slate-800 text-white'
                          : 'bg-amber-50/80 border-amber-200 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{alertItem.item.name}</p>
                        <p className="text-[11px] text-amber-500 truncate tabular-nums">
                          ⏳ EXP: {alertItem.item.exp || '-'} • {alertItem.categoryTitle} ({alertItem.groupName})
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-amber-500 shrink-0" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
