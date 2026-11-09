import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Sun,
  Moon,
  User as UserIcon,
  FileText,
  Search,
  X,
  RefreshCw,
  Home,
  ClipboardList,
  Package,
  ArrowRight,
  ShieldAlert,
  Truck,
  Stethoscope,
} from 'lucide-react';
import { CheckItemState, DrugItem, EquipmentItem, ExpiryAlertItem, ListConfig, User } from '../types';
import { categoryCovers } from '../assets/categoryCovers';
import operatingRoomBg from '../assets/images/modern_operating_room_1793107748862.jpg';
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
  lists: Record<'bag' | 'cart', ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  expiryAlerts: ExpiryAlertItem[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onNavigate: (view: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'users' | 'drug_check') => void;
  activeCategory?: 'equipment' | 'bag' | 'cart' | 'medicine';
  onSelectCategory?: (category: 'equipment' | 'bag' | 'cart' | 'medicine') => void;
  onSelectRoom?: (roomId: string) => void;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenDrawer?: () => void;
  onOpenMenu?: () => void;
  onOpenReport?: () => void;
  onOpenSheets?: () => void;
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

export const ModernDashboard: React.FC<ModernDashboardProps> = ({
  currentUser,
  drugs,
  equipment,
  lists,
  globalChecks,
  expiryAlerts: _expiryAlerts,
  theme,
  onToggleTheme,
  onNavigate,
  activeCategory = 'bag',
  onSelectCategory,
  onSelectRoom,
  onOpenNotifications,
  onOpenProfile,
  onOpenDrawer,
  onOpenMenu,
  onOpenReport,
  onOpenSheets,
  onOpenChannelSelector,
  overallStats,
}) => {
  const { activeChannel } = useDataContext();
  const isDarkMode = theme ? theme === 'dark' : true;
  const swiperRef = React.useRef<any>(null);
  const [dashSearchTerm, setDashSearchTerm] = useState('');

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


  // Helper to map category ID to Swiper slide index (in second cycle of looped categories)
  const getCategorySlideIndex = (catId?: string) => {
    if (catId === 'medicine') return 4;
    if (catId === 'equipment') return 5;
    if (catId === 'bag') return 6;
    if (catId === 'cart') return 7;
    return 6; // Default to Emergency Bag
  };

  const initialSlideIndex = useMemo(() => getCategorySlideIndex(activeCategory), [activeCategory]);

  React.useEffect(() => {
    if (swiperRef.current && activeCategory) {
      const idx = getCategorySlideIndex(activeCategory);
      try {
        swiperRef.current.slideTo(idx, 350);
      } catch (e) {
        // ignore
      }
    }
  }, [activeCategory]);

  // Detect touch capability to decouple mouse clicks on desktop from touch dragging on mobile
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
    window.addEventListener('resize', checkTouch, { passive: true });
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // Window Resize & Viewport Breakpoint Listener to re-calculate Swiper dimensions & reset layout
  useLayoutEffect(() => {
    const handleResize = () => {
      if (swiperRef.current) {
        try {
          swiperRef.current.update();
          swiperRef.current.updateSize();
          swiperRef.current.updateSlides();
          swiperRef.current.updateProgress();
        } catch (e) {
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

  // Strict Drag vs Click tracking with 5px distance threshold
  const pointerStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const isDragActionRef = React.useRef<boolean>(false);
  const dragSuppressionUntilRef = React.useRef<number>(0);
  const lastNavTimeRef = React.useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDragActionRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 5 || dy > 5) {
      isDragActionRef.current = true;
    }
  };

  const handleCategorySelect = (
    targetView: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'users' | 'drug_check'
  ) => {
    // [เงื่อนไขเด็ดขาด]: หากเพิ่งลากการ์ดมา (Drag-Release) หรือกำลังลากอยู่ ห้ามรันฟังก์ชันเปิดหน้าตรวจเช็กเด็ดขาด!
    if (Date.now() < dragSuppressionUntilRef.current || isDragActionRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastNavTimeRef.current < 250) return;
    lastNavTimeRef.current = now;

    if (onSelectCategory) {
      if (targetView === 'room_check' || targetView === 'eq_overview') onSelectCategory('equipment');
      else if (targetView === 'bag_check') onSelectCategory('bag');
      else if (targetView === 'cart_check') onSelectCategory('cart');
      else if (targetView === 'drug_check') onSelectCategory('medicine');
    }

    onNavigate(targetView);
  };

  const handlePointerUp = (e: React.PointerEvent | React.MouseEvent, targetView?: any) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    const movedOverThreshold = dx > 5 || dy > 5 || isDragActionRef.current;
    pointerStartRef.current = null;
    isDragActionRef.current = false;

    if (movedOverThreshold) {
      // [เงื่อนไขเด็ดขาด]: หากเมาส์ขยับเกิน 5px ➔ ถือเป็นการ "ลาก/เลื่อนการ์ด (Drag)" ห้ามรันฟังก์ชันเปิดหน้าตรวจเช็กเด็ดขาด!
      dragSuppressionUntilRef.current = Date.now() + 450;
      return;
    }

    // [เงื่อนไขเด็ดขาด]: หากเมาส์ขยับไม่เกิน 5px ➔ ถือเป็นการ "กดเลือก (Click)" ให้รันฟังก์ชันเปิดหน้าตรวจเช็กทันที
    if (targetView) {
      handleCategorySelect(targetView);
    }
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

  const stats = overallStats || {
    grandTotal: 0,
    grandChecked: 0,
    grandNormal: 0,
    grandDefective: 0,
    completionPct: 0,
  };

  const bagCount = Object.values(lists?.bag?.groups || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const cartCount = Object.values(lists?.cart?.groups || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const pendingCount = Math.max(0, stats.grandTotal - stats.grandChecked);

  const normalStroke = stats.grandTotal > 0 ? (stats.grandNormal / stats.grandTotal) * 100 : 0;
  const defectiveStroke = stats.grandTotal > 0 ? (stats.grandDefective / stats.grandTotal) * 100 : 0;

  // Defective items list
  const defectiveItems = useMemo<Array<{
    category: string;
    name: string;
    location: string;
    note?: string;
    targetView: 'eq_overview' | 'bag_check' | 'cart_check' | 'drug_check';
  }>>(() => {
    const list: Array<{
      category: string;
      name: string;
      location: string;
      note?: string;
      targetView: 'eq_overview' | 'bag_check' | 'cart_check' | 'drug_check';
    }> = [];

    // Equipment
    Object.entries(globalChecks || {}).forEach(([roomId, checks]) => {
      if (roomId === 'bag' || roomId === 'cart' || roomId === 'drugs') return;
      if (!checks || typeof checks !== 'object') return;
      Object.entries(checks).forEach(([key, val]) => {
        if (val && val.result === 'ผิดปกติ') {
          const parts = key.split('|');
          list.push({
            category: 'ครุภัณฑ์ห้องผ่าตัด',
            name: parts[1] || key,
            location: parts[0] || roomId,
            note: val.note,
            targetView: 'eq_overview',
          });
        }
      });
    });

    // Bag & Cart
    ['bag', 'cart'].forEach((cat) => {
      const checks = (globalChecks && globalChecks[cat]) || {};
      if (!checks || typeof checks !== 'object') return;
      Object.entries(checks).forEach(([key, val]) => {
        if (val && val.result === 'ผิดปกติ') {
          const parts = key.split('|');
          list.push({
            category: cat === 'bag' ? 'กระเป๋า Emergency' : 'รถเข็นฉุกเฉิน',
            name: parts[1] || key,
            location: parts[0] || cat,
            note: val.note,
            targetView: cat === 'bag' ? 'bag_check' : 'cart_check',
          });
        }
      });
    });

    // Drugs
    (drugs || []).forEach((d) => {
      if (d && d.remaining <= 0) {
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

  const dashSearchResults = useMemo(() => {
    const q = dashSearchTerm.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ name: string; location: string; targetView: 'home' | 'eq_overview' | 'room_check' | 'bag_check' | 'cart_check' | 'users' | 'drug_check' }> = [];

    (drugs || []).forEach((d: any) => {
      if (d && (d.name.toLowerCase().includes(q) || (d.barcode && String(d.barcode).toLowerCase().includes(q)))) {
        results.push({ name: d.name, location: 'คลังยา OR', targetView: 'drug_check' });
      }
    });

    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      (items || []).forEach((item) => {
        if (item && (item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q)))) {
          results.push({ name: item.name, location: `ห้องผ่าตัด ${roomId.toUpperCase()}`, targetView: 'room_check' });
        }
      });
    });

    ['bag', 'cart'].forEach((typeKey) => {
      const config = lists?.[typeKey as 'bag' | 'cart'];
      if (config && config.groups) {
        Object.entries(config.groups).forEach(([grp, items]) => {
          (items || []).forEach((it) => {
            if (it && (it.name.toLowerCase().includes(q) || (it.code && it.code.toLowerCase().includes(q)))) {
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

  const categories = [
    {
      id: 'medicine',
      title: 'คลังยา & สารน้ำฉุกเฉิน',
      count: `${drugs.length} รายการตรวจ`,
      icon: <Package className="w-4 h-4 text-emerald-400" />,
      bg: categoryCovers.drugs,
      targetView: 'drug_check' as const,
    },
    {
      id: 'equipment',
      title: 'ครุภัณฑ์ห้องผ่าตัด (OR)',
      count: `${stats.grandTotal} รายการตรวจ`,
      icon: <Stethoscope className="w-4 h-4 text-blue-400" />,
      bg: categoryCovers.equipment,
      targetView: 'room_check' as const,
    },
    {
      id: 'bag',
      title: 'กระเป๋าฉุกเฉิน (Emergency Bag)',
      count: `${bagCount} รายการตรวจ`,
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
      bg: categoryCovers.bag,
      targetView: 'bag_check' as const,
    },
    {
      id: 'cart',
      title: 'รถพยาบาลฉุกเฉิน (Ambulance)',
      count: `${cartCount} รายการตรวจ`,
      icon: <Truck className="w-4 h-4 text-purple-400" />,
      bg: categoryCovers.cart,
      targetView: 'cart_check' as const,
    },
  ];

  // Looped categories (12 items total: 3 cycles of the 4 categories)
  // Ensures seamless infinite looping in Swiper without edge snapping or boundaries.
  const loopedCategories = useMemo(() => {
    return [
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c1` })),
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c2` })),
      ...categories.map((c) => ({ ...c, uniqueId: `${c.id}-c3` })),
    ];
  }, [categories]);

  return (
    <div
      className={`w-full min-h-screen font-['TH_Sarabun_New','Sarabun',sans-serif] pb-28 overflow-x-hidden relative transition-colors duration-500 select-none ${
        isDarkMode ? 'bg-[#0E0F12] text-slate-100' : 'bg-[#F2F4F8] text-slate-900'
      }`}
    >
      <style>{`
        * { word-break: keep-all !important; letter-spacing: -0.2px; }
        .nowrap-unit { white-space: nowrap !important; }
        .font-valorant {
          font-family: 'Teko', sans-serif !important;
          text-transform: uppercase;
          line-height: 1 !important;
          letter-spacing: 1px !important;
        }
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

        /* 🌟 Focus Carousel: Center Active Card Scaled Up & Side Cards Dimmed + Blurred */
        .focus-carousel-swiper {
          overflow: visible !important;
          padding-top: 20px !important;
          padding-bottom: 34px !important;
        }
        .focus-carousel-swiper .swiper-wrapper {
          align-items: center !important;
        }
        .focus-carousel-swiper .swiper-slide {
          overflow: visible !important;
          transition: all 0.3s ease !important;
        }
        .focus-carousel-card {
          transition: transform 0.3s ease, opacity 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease !important;
          will-change: transform, opacity, filter, box-shadow;
        }
        .focus-carousel-swiper .swiper-slide-active {
          z-index: 30 !important;
        }
        .focus-carousel-swiper .swiper-slide-active .focus-carousel-card {
          transform: scale(1.08) !important;
          opacity: 1 !important;
          filter: blur(0px) !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25) !important;
          z-index: 30 !important;
        }
        .focus-carousel-swiper .swiper-slide:not(.swiper-slide-active) .focus-carousel-card {
          transform: scale(0.88) !important;
          opacity: 0.5 !important;
          filter: blur(2px) !important;
          box-shadow: none !important;
          z-index: 10 !important;
        }
      `}</style>

      {/* Background Video (Samsung One UI Softened Background) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={operatingRoomBg}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isDarkMode ? 'opacity-25 brightness-75 contrast-105' : 'opacity-15 brightness-100 contrast-95'
          }`}
        >
          <source
            src="https://assets.mixkit.co/videos/preview/mixkit-surgeons-during-an-operation-41539-large.mp4"
            type="video/mp4"
          />
        </video>
        <div
          className={`absolute inset-0 transition-colors duration-700 ${
            isDarkMode
              ? 'bg-gradient-to-b from-[#0E0F12]/80 via-[#0E0F12]/50 to-[#0E0F12]/95'
              : 'bg-gradient-to-b from-[#F2F4F8]/80 via-[#F2F4F8]/40 to-[#F2F4F8]/95'
          }`}
        />
      </div>

      {/* Main Container (Aligned Max-Width Container) */}
      <div className="p-3 sm:p-6 pt-3 space-y-5 relative z-10 w-full max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-6">
        
        {/* 📱 1. Samsung One UI Header Card & Weather Widget with Vibrant Royal Blue Gradient */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
          }}
          className="w-full p-4 sm:p-6 rounded-[2.2rem] border border-blue-400/40 shadow-2xl transition-all duration-300 space-y-5 lg:col-span-2 relative overflow-hidden backdrop-blur-2xl text-white"
        >
          {/* Subtle Ambient Pulse Light */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-blue-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />

          {/* ========================================================= */}
          {/* แถบที่ 1: Header บรรทัดบนสุด (ชื่อระบบ + Badge + เมนูคอม + ไอคอนโปรไฟล์/ธีม) */}
          {/* ========================================================= */}
          <div className="flex lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/15 relative z-10">
            
            {/* ฝั่งซ้าย: ชื่อระบบ + ปุ่ม Admin กดได้ (ย้ายจากขวามาซ้ายอันเดียวจบ) */}
            <div className="flex items-center justify-between lg:justify-start w-full lg:w-auto gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 font-valorant text-xl sm:text-3xl lg:text-4xl font-bold tracking-wider shrink-0">
                <span className="text-[#67e8f9] drop-shadow-[0_2px_8px_rgba(103,232,249,0.5)]">ANESTHESIA</span>
                <span className="text-white drop-shadow-sm">CARE</span>
              </div>

              {/* Mobile Header Icons: Theme & Notifications (Visible on Mobile Only) */}
              <div className="flex lg:hidden items-center gap-2">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="p-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition active:scale-90"
                    title={isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                  >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                )}
                {onOpenNotifications && (
                  <button
                    type="button"
                    onClick={onOpenNotifications}
                    className="relative p-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition active:scale-90"
                    title="การแจ้งเตือน"
                  >
                    <Bell size={18} />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
                  </button>
                )}
              </div>

              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => onNavigate('users')}
                  className="hidden lg:inline-block px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs font-semibold shadow-sm transition-all border border-white/20 whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  ผู้ดูแลระบบ (Admin)
                </button>
              )}

              {currentUser && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/30 bg-white/20 hover:bg-white/30 text-white transition active:scale-95 cursor-pointer shadow-sm backdrop-blur-md"
                  title="คลิกเพื่อแก้ไขโปรไฟล์และชื่อผู้ใช้งาน"
                >
                  <div className="w-5 h-5 rounded-full bg-cyan-400 text-blue-900 font-black flex items-center justify-center text-[10px] shadow-xs overflow-hidden shrink-0">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={effectiveDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      effectiveDisplayName ? effectiveDisplayName.charAt(0) : 'U'
                    )}
                  </div>
                  <span className="text-xs font-bold truncate max-w-[130px] text-white drop-shadow-xs whitespace-nowrap">
                    {effectiveDisplayName}
                  </span>
                </button>
              )}
            </div>

            {/* ฝั่งขวา (เฉพาะจอคอม mdขึ้นไป): เมนู 3 ปุ่ม [หน้าแรก] [รายงาน] [ชีต] */}
            <div className="hidden md:flex items-center gap-3">
              
              {/* แถบเมนู 3 ปุ่ม (จัด whitespace-nowrap ไม่ให้คำตัดบรรทัด) */}
              <nav className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCategory === 'bag' || activeCategory === 'cart' || activeCategory === 'equipment' || activeCategory === 'medicine'
                      ? 'text-white/90 hover:bg-white/10'
                      : 'bg-white text-blue-700 shadow-md'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>หน้าแรก</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('room_check')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCategory === 'equipment'
                      ? 'bg-white text-blue-700 shadow-md'
                      : 'text-white/90 hover:bg-white/10'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>รายงาน</span>
                </button>

                {onOpenReport && (
                  <button
                    type="button"
                    onClick={onOpenReport}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all text-white/90 hover:bg-white/10 cursor-pointer shrink-0"
                  >
                    <FileText className="w-4 h-4" />
                    <span>ชีต</span>
                  </button>
                )}
              </nav>

              {/* Controls Right: Notifications & Theme Toggle */}
              <div className="flex items-center gap-2 pl-2 shrink-0 border-l border-white/20">
                {onOpenNotifications && (
                  <button
                    type="button"
                    onClick={onOpenNotifications}
                    className="relative p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90 cursor-pointer shadow-sm backdrop-blur-md"
                    title="การแจ้งเตือน"
                  >
                    <Bell size={15} />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                  </button>
                )}

                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90 cursor-pointer shadow-sm backdrop-blur-md"
                    title={isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                  >
                    {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* แถบที่ 2: ช่องเลือก Channel / วอร์ด และสภาพอากาศด้านล่าง  */}
          {/* ========================================================= */}
          <div className="relative z-10 pt-1 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            
            {/* ข้อมูล Channel / วอร์ด */}
            <div className="flex items-center justify-between gap-3 w-full lg:w-auto bg-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[10px] sm:text-xs text-blue-100 opacity-80 uppercase font-bold">วอร์ด:</span>
                <span className="text-xs sm:text-sm font-bold text-white truncate">{activeChannel?.name || 'คลินิกวิสัญญี (Master)'}</span>
                {activeChannel?.isDefault && (
                  <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[9px] font-bold uppercase border border-white/20 shrink-0">
                    Master
                  </span>
                )}
              </div>

              {onOpenChannelSelector && (
                <button
                  type="button"
                  onClick={onOpenChannelSelector}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-900 text-[10px] font-black uppercase transition-all shrink-0 active:scale-95 cursor-pointer shadow-sm"
                >
                  สลับ
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 text-xs text-blue-100">
              <Sun className="w-4 h-4 text-amber-300" />
              <span className="font-bold text-white">31°C</span>
              <span className="opacity-80">กรุงเทพฯ (ท้องฟ้าโปร่ง)</span>
            </div>
          </div>

        </div>

        {/* 🔍 1.5 Samsung One UI Full-Width Search Bar */}
        <div className="lg:col-span-2 w-full space-y-2">
          <div className={`w-full rounded-2xl p-3 sm:p-3.5 border shadow-sm backdrop-blur-md flex items-center justify-between gap-3 transition-colors ${
            isDarkMode
              ? 'bg-[#14161D]/90 border-slate-800 text-white'
              : 'bg-white/95 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Search size={18} className="text-blue-500 shrink-0" />
              <input
                type="text"
                value={dashSearchTerm}
                onChange={(e) => setDashSearchTerm(e.target.value)}
                placeholder="ค้นหาอุปกรณ์, ยา, กระเป๋าฉุกเฉิน, รถฉุกเฉิน..."
                className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-medium placeholder:text-slate-400"
              />
              {dashSearchTerm && (
                <button
                  type="button"
                  onClick={() => setDashSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`text-xs font-bold px-3.5 py-1.5 rounded-full border ${
                isDarkMode
                  ? 'bg-blue-950/60 border-blue-800/60 text-blue-300'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {stats.grandTotal} รายการ
              </span>
            </div>
          </div>

          {/* Live Search Results Dropdown */}
          {dashSearchTerm.trim() !== '' && (
            <div className={`p-3.5 rounded-2xl border shadow-xl space-y-2 max-h-64 overflow-y-auto ${
              isDarkMode ? 'bg-[#181A20] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1 pb-1 border-b border-slate-700/20">
                <span>ผลการค้นหา ({dashSearchResults.length} รายการ)</span>
                <button onClick={() => setDashSearchTerm('')} className="text-xs text-blue-400 hover:underline cursor-pointer">ปิด</button>
              </div>
              {dashSearchResults.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">ไม่พบรายการที่ตรงกับคำค้นหา "{dashSearchTerm}"</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {dashSearchResults.map((resItem, i) => (
                    <div
                      key={`sr_${i}`}
                      onClick={() => {
                        onNavigate(resItem.targetView);
                        setDashSearchTerm('');
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer hover:border-blue-500 transition active:scale-98 ${
                        isDarkMode ? 'bg-[#101216] border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate text-xs">{resItem.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">📍 {resItem.location}</p>
                      </div>
                      <ChevronRight size={14} className="text-blue-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🤖 AI Summary consolidated into AuraAssistant floating button */}
        <div className="lg:col-span-2 invisible h-0 overflow-hidden">
          {/* AiInsightsWidget removed to avoid duplicate bots */}
        </div>

        {/* 🗂️ 2. หมวดหมู่ตรวจเช็ก (Large Responsive Category Cards with Header Arrow Navigation) */}
        <div className="space-y-6 lg:col-span-2 relative">
          <div className="flex justify-between items-end px-1">
            <div>
              <h2 className={`text-lg sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                <span>หมวดหมู่ตรวจเช็กหลัก</span>
              </h2>
              <p className={`text-xs mt-1 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>เลือกหมวดหมู่ที่ต้องการเริ่มทำการตรวจเช็กประเมินความพร้อม</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`text-[10px] sm:text-xs font-bold px-3.5 py-1 rounded-xl border whitespace-nowrap shadow-xs hidden lg:inline-block ${
                  isDarkMode
                    ? 'bg-blue-950/40 border-blue-800/40 text-blue-300'
                    : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}
              >
                4 หมวดหมู่พร้อมใช้งาน
              </span>
              
              {/* Carousel Arrows (Visible only on Desktop for layout reasons) */}
              <div className="hidden lg:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => swiperRef.current?.slidePrev()}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition active:scale-90 cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  } shadow-xs`}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => swiperRef.current?.slideNext()}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition active:scale-90 cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  } shadow-xs`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Swiper Carousel View for all screens */}
          <div className="relative w-full group">
            {/* Mobile-Only Edge Arrows */}
            <button
              onClick={() => swiperRef.current?.slidePrev()}
              className="lg:hidden absolute left-1 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-all border border-white/10 shadow-lg"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => swiperRef.current?.slideNext()}
              className="lg:hidden absolute right-1 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-all border border-white/10 shadow-lg"
            >
              <ChevronRight size={24} />
            </button>
            <Swiper
              onSwiper={(swiper) => (swiperRef.current = swiper)}
              onTouchStart={(_swiper, e) => handlePointerDown(e as any)}
              onTouchMove={(_swiper, e) => handlePointerMove(e as any)}
              onTouchEnd={(_swiper, e) => handlePointerUp(e as any)}
              modules={[EffectCoverflow, Pagination]}
              effect={'coverflow'}
              grabCursor={true}
              simulateTouch={true}
              allowTouchMove={true}
              slideToClickedSlide={true}
              loop={true}
              loopPreventsSliding={false}
              loopAdditionalSlides={4}
              initialSlide={initialSlideIndex}
              speed={450}
              resistance={true}
              resistanceRatio={0.82}
              touchRatio={1}
              touchAngle={45}
              longSwipes={true}
              longSwipesRatio={0.2}
              longSwipesMs={250}
              shortSwipes={true}
              followFinger={true}
              preventClicks={true}
              preventClicksPropagation={true}
              observer={true}
              observeParents={true}
              resizeObserver={true}
              threshold={5}
              breakpoints={{
                320: { slidesPerView: 1.15, spaceBetween: 14, centeredSlides: true },
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
              className="focus-carousel-swiper w-full px-6 sm:px-12 card-grab-cursor select-none"
            >
              {loopedCategories.map((item) => (
                <SwiperSlide key={item.uniqueId} className="select-none pointer-events-auto">
                  {({ isActive }) => (
                    <div
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={(e) => handlePointerUp(e, item.targetView)}
                      onClick={() => {
                        if (!isDragActionRef.current && Date.now() >= dragSuppressionUntilRef.current) {
                          handleCategorySelect(item.targetView);
                        }
                      }}
                      className={`focus-carousel-card card-grab-cursor relative h-72 sm:h-80 xl:h-96 rounded-[2.2rem] overflow-hidden select-none pointer-events-auto cursor-grab active:cursor-grabbing transition-all duration-300 ${
                        isActive ? 'scale-[1.08] opacity-100 blur-none ring-2 ring-white/40 shadow-2xl' : 'scale-[0.88] opacity-50 blur-[2px] shadow-none'
                      }`}
                    >
                      <img
                        src={item.bg}
                        alt={item.title}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

                      <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between z-10 pointer-events-none">
                        <span className="self-start bg-black/60 backdrop-blur-md text-white text-xs sm:text-sm px-4 py-2 rounded-full font-bold border border-white/20 shadow-md flex items-center gap-2">
                          {item.icon} {item.count}
                        </span>

                        <div className="space-y-4">
                          <h3 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-md">
                            {item.title}
                          </h3>
                          <button
                            type="button"
                            className="w-full bg-[#3B82F6] text-white font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 pointer-events-auto"
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

        {/* 📊 3. สถิติความพร้อมประจำวัน (Premium Minimal Clean Tone) */}
        <div
          className={`w-full max-w-full rounded-[2.2rem] p-6 sm:p-8 border shadow-sm space-y-5 transition-colors duration-500 lg:col-span-2 ${
            isDarkMode
              ? 'bg-[#181A20] border-white/5 text-white'
              : 'bg-white border-slate-100 text-slate-800'
          }`}
        >
          <div className="flex flex-col space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              สถิติความพร้อมประจำวัน
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
              สรุปสถานะความพร้อมอุปกรณ์และคลังยาภาพรวมประจำรอบ
            </p>
          </div>

          <div className="flex flex-row items-center justify-start gap-4 sm:gap-8 pt-2 overflow-x-hidden">
            {/* ฝั่งซ้าย: กราฟวงกลม SVG (Donut Chart) */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 filter drop-shadow-lg" viewBox="0 0 36 36">
                {/* Background Ring */}
                <circle
                  cx="18" cy="18" r="15.9155"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="3.2"
                  fill="none"
                  stroke="currentColor"
                />
                {/* Progress Ring (Success) */}
                <circle
                  cx="18" cy="18" r="15.9155"
                  className="text-blue-500"
                  strokeWidth="3.2"
                  strokeDasharray={`${stats.completionPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  stroke="currentColor"
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
                {/* Defective Marker (Small slice at the end) */}
                {stats.grandDefective > 0 && (
                  <circle
                    cx="18" cy="18" r="15.9155"
                    className="text-rose-500"
                    strokeWidth="3.2"
                    strokeDasharray={`${(stats.grandDefective / stats.grandTotal) * 100}, 100`}
                    strokeDashoffset={-stats.completionPct}
                    strokeLinecap="round"
                    fill="none"
                    stroke="currentColor"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">
                  {stats.completionPct}%
                </span>
                <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ready</span>
              </div>
            </div>

            {/* ฝั่งขวา: รายละเอียดสถิติ 3 บรรทัด */}
            <div className="flex-1 space-y-2.5">
              <div className={`flex justify-between items-center px-4 py-2.5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#101216] border-white/5 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ทั้งหมด</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{stats.grandTotal}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">รายการ</span>
                </div>
              </div>

              <div className={`flex justify-between items-center px-4 py-2.5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#101216] border-white/5 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>พร้อมใช้</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">{stats.grandNormal}</span>
                  <span className="text-[9px] text-blue-400 font-bold uppercase">รายการ</span>
                </div>
              </div>

              <div className={`flex justify-between items-center px-4 py-2.5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#101216] border-white/5 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>ชำรุด</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">{stats.grandDefective}</span>
                  <span className="text-[9px] text-rose-400 font-bold uppercase">รายการ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🚨 4. รายการข้อบกพร่องที่ต้องตรวจสอบด่วน */}
        {defectiveItems.length > 0 && (
          <div
            className={`rounded-[2rem] p-5 border shadow-xl space-y-3 transition-colors duration-500 lg:col-span-2 ${
              isDarkMode
                ? 'bg-[#181A20]/90 backdrop-blur-2xl border-slate-800 text-white'
                : 'bg-white/95 backdrop-blur-2xl border-rose-200 text-slate-800'
            }`}
          >
            <h3 className="text-sm font-bold text-rose-500 flex items-center gap-1.5">
              <AlertTriangle size={16} />
              <span>รายการที่ต้องตรวจสอบด่วน ({defectiveItems.length} รายการ)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {defectiveItems.slice(0, 6).map((item, idx) => (
                <div
                  key={`def_${idx}`}
                  onClick={() => onNavigate(item.targetView)}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 hover:border-rose-400 transition cursor-pointer active:scale-98 ${
                    isDarkMode
                      ? 'bg-[#101216] border-slate-800 text-white'
                      : 'bg-slate-50 border-rose-100 text-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      📍 {item.location} • {item.note || 'พบข้อบกพร่อง'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-rose-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
