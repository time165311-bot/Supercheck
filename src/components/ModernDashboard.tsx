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
  Menu,
  User as UserIcon,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { CheckItemState, DrugItem, EquipmentItem, ExpiryAlertItem, ListConfig, User } from '../types';
import { categoryCovers } from '../assets/categoryCovers';
import operatingRoomBg from '../assets/images/modern_operating_room_1793107748862.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';
import AiInsightsWidget from './AiInsightsWidget';

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
  overallStats,
}) => {
  const isDarkMode = theme ? theme === 'dark' : true;
  const swiperRef = React.useRef<any>(null);

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

  // Map category ID to Swiper slide index (in second cycle of looped categories)
  const getCategorySlideIndex = (catId?: string) => {
    if (catId === 'medicine') return 4;
    if (catId === 'equipment') return 5;
    if (catId === 'bag') return 6;
    if (catId === 'cart') return 7;
    return 6; // Default to Emergency Bag
  };

  const initialSlideIndex = React.useMemo(() => getCategorySlideIndex(activeCategory), [activeCategory]);

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

  const categories = [
    {
      id: 'medicine',
      title: 'คลังยา & สารน้ำ',
      count: `${drugs.length} รายการ`,
      icon: '💊',
      bg: categoryCovers.drugs,
      targetView: 'drug_check' as const,
    },
    {
      id: 'equipment',
      title: 'ครุภัณฑ์ห้องผ่าตัด',
      count: `${stats.grandTotal} รายการ`,
      icon: '🩺',
      bg: categoryCovers.equipment,
      targetView: 'room_check' as const,
    },
    {
      id: 'bag',
      title: 'กระเป๋าฉุกเฉิน',
      count: `${bagCount} รายการ`,
      icon: '🎒',
      bg: categoryCovers.bag,
      targetView: 'bag_check' as const,
    },
    {
      id: 'cart',
      title: 'รถฉุกเฉิน (Crash Cart)',
      count: `${cartCount} รายการ`,
      icon: '🛒',
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

      {/* Main Container (Expanded 50% Wider Container Stretch) */}
      <div className="p-3 sm:p-6 pt-3 space-y-5 relative z-10 w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-[1680px] xl:max-w-[1760px] mx-auto lg:grid lg:grid-cols-2 lg:gap-6">
        
        {/* 📱 1. Samsung One UI Header Card & Weather Widget with Vibrant Royal Blue Gradient */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
          }}
          className="w-full p-4 sm:p-6 rounded-[2rem] border border-blue-400/40 shadow-2xl transition-all duration-300 space-y-4 lg:col-span-2 relative overflow-hidden backdrop-blur-2xl text-white"
        >
          {/* Subtle Ambient Pulse Light */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-blue-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />

          {/* Top Row: Title + User Profile + Menu + Notifications + Theme Toggle */}
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center relative z-10 gap-3">
            {/* Title / Brand & User Profile Badge */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 font-valorant text-2xl sm:text-3xl lg:text-4xl font-bold tracking-wider shrink-0">
                <span className="text-[#67e8f9] drop-shadow-[0_2px_8px_rgba(103,232,249,0.5)]">ANESTHESIA</span>
                <span className="text-white drop-shadow-sm">CARE</span>
              </div>

              {currentUser && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/30 bg-white/20 hover:bg-white/30 text-white transition active:scale-95 cursor-pointer shadow-sm backdrop-blur-md"
                  title="คลิกเพื่อแก้ไขโปรไฟล์และชื่อผู้ใช้งาน"
                >
                  <div className="w-5 h-5 rounded-full bg-cyan-400 text-blue-900 font-black flex items-center justify-center text-[10px] shadow-xs overflow-hidden shrink-0">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={effectiveDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      effectiveDisplayName ? effectiveDisplayName.charAt(0) : 'U'
                    )}
                  </div>
                  <span className="text-xs font-bold truncate max-w-[130px] text-white drop-shadow-xs">
                    {effectiveDisplayName}
                  </span>
                </button>
              )}
            </div>

            {/* Controls Right: 1. [ รายงาน ] 2. [ ชีต ] 3. [ เมนู ] */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* 1. รายงาน (Leftmost) */}
              <button
                type="button"
                onClick={onOpenReport || (() => onNavigate('room_check'))}
                title="เปิดรายงานสรุปประจำวัน & พรีวิว PDF"
                className="text-xs px-3.5 py-2 rounded-full font-bold border border-white/30 bg-white/20 hover:bg-white/30 text-white flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-sm backdrop-blur-md"
              >
                <FileText size={15} />
                <span>รายงาน</span>
              </button>

              {/* 2. ชีต (Next to รายงาน) */}
              <button
                type="button"
                onClick={onOpenSheets || onOpenDrawer || onOpenMenu}
                title="ตั้งค่าการเชื่อมต่อ Google Sheets"
                className="text-xs px-3.5 py-2 rounded-full font-bold border border-white/30 bg-white/20 hover:bg-white/30 text-white flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-sm backdrop-blur-md"
              >
                <FileSpreadsheet size={15} className="text-emerald-300" />
                <span>ชีต</span>
              </button>

              {/* 3. เมนู (Rightmost, next to ชีต) */}
              {(onOpenDrawer || onOpenMenu) && (
                <button
                  type="button"
                  onClick={onOpenMenu || onOpenDrawer}
                  title="เปิดเมนูตั้งค่าและจัดการ"
                  className="text-xs px-3.5 py-2 rounded-full font-bold border border-white/30 bg-white/20 hover:bg-white/30 text-white flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-sm backdrop-blur-md"
                >
                  <Menu size={16} />
                  <span>เมนู</span>
                </button>
              )}

              {/* Notifications Bell */}
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="relative p-2 rounded-full border border-white/30 bg-white/20 hover:bg-white/30 text-white transition active:scale-90 cursor-pointer shadow-sm backdrop-blur-md"
                  title="การแจ้งเตือน"
                >
                  <Bell size={15} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                </button>
              )}

              {/* Theme Toggle */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-2 rounded-full border border-white/30 bg-white/20 hover:bg-white/30 text-white transition active:scale-90 cursor-pointer shadow-sm backdrop-blur-md"
                  title={isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                >
                  {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              )}
            </div>
          </div>

          {/* Weather Squircle Widget (Pure White Text & Clean Backdrop) */}
          <div
            style={{
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
              padding: '12px 16px',
            }}
            className="rounded-[1.5rem] border border-white/20 bg-black/20 text-white backdrop-blur-md flex items-center justify-between gap-3 transition-all relative z-10 shadow-inner"
          >
            <div className="flex items-center gap-3 min-w-0 shrink">
              <span className="text-2xl sm:text-3xl filter drop-shadow shrink-0">🌤️</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black nowrap-unit text-white drop-shadow-sm">
                    {weatherData.temp}°C
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-cyan-100 truncate">
                    {weatherData.locationName}
                  </span>
                </div>
                <div className="text-[10px] sm:text-xs text-cyan-200/90 font-medium truncate">
                  {weatherData.condition}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] sm:text-xs px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 text-white shrink-0 overflow-hidden shadow-xs backdrop-blur-xs">
              <span className="nowrap-unit">ความชื้น {weatherData.humidity}%</span>
              <span className="border-l border-white/30 pl-2 nowrap-unit">ลม 12 km/h</span>
            </div>
          </div>
        </div>



        {/* 🤖 1.5 วิดเจ็ต AI สรุปความพร้อมประจำวัน (AiInsightsWidget) */}
        <div className="lg:col-span-2">
          <AiInsightsWidget
            readinessData={{
              completionPct: stats.completionPct,
              defectiveCount: stats.grandDefective,
            }}
            isDarkMode={isDarkMode}
            stats={stats}
            defectiveItems={defectiveItems}
          />
        </div>

        {/* 🗂️ 2. หมวดหมู่ตรวจเช็ก (Large Responsive Category Cards with Inset Arrow Navigation) */}
        <div className="space-y-3 lg:col-span-2 relative">
          <div className="flex justify-between items-center px-2">
            <h2 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              <span>หมวดหมู่ตรวจเช็ก</span>
            </h2>
            <span
              className={`text-xs sm:text-sm font-bold px-3.5 py-1 rounded-full border ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              4 หมวดหลัก
            </span>
          </div>

          {/* Carousel Wrapper with White Glassmorphic Side-by-Side Arrows */}
          <div className="relative w-full">
            {/* Left Arrow Button [<] */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                swiperRef.current?.slidePrev();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              }}
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full text-slate-800 hover:text-blue-600 hover:bg-white flex items-center justify-center transition active:scale-90 cursor-pointer hover:scale-110"
              title="เลื่อนซ้าย"
            >
              <ChevronLeft size={24} className="stroke-[2.5]" />
            </button>

            {/* Right Arrow Button [>] */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                swiperRef.current?.slideNext();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              }}
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full text-slate-800 hover:text-blue-600 hover:bg-white flex items-center justify-center transition active:scale-90 cursor-pointer hover:scale-110"
              title="เลื่อนขวา"
            >
              <ChevronRight size={24} className="stroke-[2.5]" />
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
              slideToClickedSlide={false}
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
                640: { slidesPerView: 2.1, spaceBetween: 16, centeredSlides: true },
                1024: { slidesPerView: 2.8, spaceBetween: 20, centeredSlides: true },
                1280: { slidesPerView: 3.4, spaceBetween: 22, centeredSlides: true },
                1600: { slidesPerView: 4, spaceBetween: 24, centeredSlides: false },
              }}
              coverflowEffect={{
                rotate: 0,
                stretch: 0,
                depth: 25,
                modifier: 1,
                slideShadows: false,
              }}
              pagination={{ clickable: true, dynamicBullets: true }}
              onClick={(_swiper, event) => {
                if (Date.now() < dragSuppressionUntilRef.current || isDragActionRef.current) return;
                const target = event.target as HTMLElement;
                if (!target) return;
                const cardEl = target.closest('[data-target-view]') as HTMLElement | null;
                if (cardEl) {
                  const view = cardEl.getAttribute('data-target-view') as any;
                  if (view) {
                    handleCategorySelect(view);
                  }
                }
              }}
              className="w-full pb-8 px-6 sm:px-12 card-grab-cursor select-none"
            >
              {loopedCategories.map((item) => (
                <SwiperSlide key={item.uniqueId} className="select-none pointer-events-auto">
                  {({ isActive }) => (
                    <div
                      data-target-view={item.targetView}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={(e) => handlePointerUp(e, item.targetView)}
                      onClick={(e) => {
                        // Only handle click if not dragging
                        if (!isDragActionRef.current && Date.now() >= dragSuppressionUntilRef.current) {
                          handleCategorySelect(item.targetView);
                        }
                      }}
                      style={{
                        pointerEvents: 'auto',
                        position: 'relative',
                        zIndex: isActive ? 30 : 20,
                        touchAction: 'pan-y pinch-zoom',
                      }}
                      className={`card-grab-cursor relative h-72 sm:h-80 lg:h-84 rounded-[2.2rem] overflow-hidden transition-all duration-300 group select-none pointer-events-auto cursor-grab active:cursor-grabbing ${
                        isActive
                          ? 'scale-100 opacity-100 shadow-2xl ring-2 ring-white/30 z-30'
                          : 'scale-95 opacity-85 blur-[0.2px] z-20'
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
                        <span className="self-start bg-black/60 backdrop-blur-md text-white text-xs sm:text-sm px-4 py-1.5 rounded-full font-bold border border-white/20 shadow-md pointer-events-none">
                          {item.icon} {item.count}
                        </span>

                        <div className="space-y-4 pointer-events-auto">
                          <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-md pointer-events-none">
                            {item.title}
                          </h3>
                          <button
                            type="button"
                            data-target-view={item.targetView}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              handlePointerUp(e, item.targetView);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategorySelect(item.targetView);
                            }}
                            style={{
                              pointerEvents: 'auto',
                              cursor: 'pointer',
                              position: 'relative',
                              zIndex: 40,
                            }}
                            className="carousel-action-btn w-full bg-[#3B82F6] hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 group-hover:bg-blue-600 relative z-40 pointer-events-auto"
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

        {/* 📊 3. สถิติความพร้อมประจำวัน (One UI Minimalist Blue-Cyan-Green-White Glassmorphic Theme) */}
        <div
          style={{ width: '100%' }}
          className={`w-full max-w-full rounded-[2.2rem] p-6 sm:p-8 border shadow-2xl space-y-5 transition-colors duration-500 lg:col-span-2 ${
            isDarkMode
              ? 'bg-[#14161D]/95 backdrop-blur-2xl border-white/10 text-white'
              : 'bg-white/95 backdrop-blur-2xl border-white/80 text-slate-800'
          }`}
        >
          <div className="flex justify-between items-center border-b pb-4 border-slate-700/30">
            <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
              <span className="text-cyan-400">📊</span>
              <span>สถิติความพร้อมประจำวัน</span>
            </h3>
            <span className="text-xs sm:text-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Real-time One UI
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-2">
            {/* Donut Progress Chart & Total (Spans 4 columns on large screens) */}
            <div
              onClick={() => onNavigate('room_check')}
              className={`lg:col-span-4 flex items-center justify-center sm:justify-start gap-5 p-5 sm:p-6 rounded-[1.8rem] border shadow-inner cursor-pointer hover:border-cyan-400/60 transition active:scale-98 ${
                isDarkMode ? 'bg-[#0D0F14] border-cyan-500/20' : 'bg-cyan-50/50 border-cyan-200'
              }`}
              title="คลิกเพื่อดูรายละเอียดผังห้องผ่าตัด"
            >
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Track */}
                  <path
                    className={isDarkMode ? 'text-slate-800/80' : 'text-slate-200'}
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Cyan-Mint Ready Stroke */}
                  <path
                    className="text-cyan-400"
                    strokeDasharray={`${normalStroke}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Deep Navy/Indigo Defective Stroke */}
                  {defectiveStroke > 0 && (
                    <path
                      className={isDarkMode ? 'text-slate-700' : 'text-indigo-950'}
                      strokeDasharray={`${defectiveStroke}, 100`}
                      strokeDashoffset={`-${normalStroke}`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                </svg>
                <span className="absolute text-2xl sm:text-3xl font-black tabular-nums text-cyan-400">
                  {stats.completionPct}%
                </span>
              </div>
              <div className="space-y-1.5 text-left">
                <p className="text-xs sm:text-sm font-bold text-slate-400">ระดับความพร้อมรวม</p>
                <p className="text-base sm:text-lg font-black text-cyan-400 tabular-nums">
                  {stats.grandNormal} / {stats.grandTotal} รายการ
                </p>
                <p className="text-xs text-slate-400">
                  {stats.grandDefective > 0 ? `พบข้อบกพร่อง ${stats.grandDefective} รายการ` : 'อุปกรณ์พร้อมใช้งานสมบูรณ์ 100%'}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown Horizontal Cards Grid (Spans 8 columns on large screens) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Card 1: Normal (Cyan/Mint) */}
              <div
                onClick={() => onNavigate('room_check')}
                className={`p-4 sm:p-5 rounded-[1.5rem] border flex flex-col justify-between gap-3 cursor-pointer hover:border-cyan-400/50 transition active:scale-98 ${
                  isDarkMode ? 'bg-[#101520] border-cyan-500/30' : 'bg-cyan-50/80 border-cyan-200'
                }`}
                title="ดูรายการครุภัณฑ์ปกติ"
              >
                <span className="font-bold text-xs sm:text-sm text-cyan-400 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-cyan-400" />
                  <span>ปกติพร้อมใช้</span>
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-black text-cyan-400 text-2xl sm:text-3xl tabular-nums">{stats.grandNormal}</span>
                  <span className="text-xs text-slate-400 font-medium">รายการ</span>
                </div>
              </div>

              {/* Card 2: Defective (Deep Navy / Indigo) */}
              <div
                onClick={() => onNavigate('eq_overview')}
                className={`p-4 sm:p-5 rounded-[1.5rem] border flex flex-col justify-between gap-3 cursor-pointer hover:border-indigo-400/50 transition active:scale-98 ${
                  isDarkMode ? 'bg-[#0F1322] border-indigo-900/50' : 'bg-slate-100/90 border-slate-300'
                }`}
                title="ดูรายการข้อบกพร่อง/ชำรุด"
              >
                <span className="font-bold text-xs sm:text-sm text-indigo-400 flex items-center gap-2">
                  <XCircle size={18} className="text-indigo-400" />
                  <span>ต้องตรวจสอบ</span>
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-black text-indigo-400 text-2xl sm:text-3xl tabular-nums">{stats.grandDefective}</span>
                  <span className="text-xs text-slate-400 font-medium">รายการ</span>
                </div>
              </div>

              {/* Card 3: Pending (Amber Accent) */}
              <div
                onClick={() => onNavigate('room_check')}
                className={`p-4 sm:p-5 rounded-[1.5rem] border flex flex-col justify-between gap-3 cursor-pointer hover:border-amber-400/50 transition active:scale-98 ${
                  isDarkMode ? 'bg-[#14161D] border-amber-500/30' : 'bg-amber-50/60 border-amber-200'
                }`}
                title="ดูรายการห้องค้างตรวจเช็ก"
              >
                <span className="font-bold text-xs sm:text-sm text-amber-400 flex items-center gap-2">
                  <Clock size={18} className="text-amber-400" />
                  <span>รอตรวจเช็ก</span>
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-black text-amber-400 text-2xl sm:text-3xl tabular-nums">{pendingCount}</span>
                  <span className="text-xs text-slate-400 font-medium">รายการ</span>
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
