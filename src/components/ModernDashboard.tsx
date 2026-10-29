import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { CheckItemState, DrugItem, EquipmentItem, ExpiryAlertItem, ListConfig, User } from '../types';
import { categoryCovers } from '../assets/categoryCovers';
import operatingRoomBg from '../assets/images/modern_operating_room_1793107748862.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';

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
  onLogout?: () => void;
  onOpenNotifications?: () => void;
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
  onNavigate,
  onOpenNotifications,
  overallStats,
}) => {
  const isDarkMode = theme ? theme === 'dark' : true;

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
  const defectiveItems = useMemo(() => {
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
      targetView: 'eq_overview' as const,
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

      {/* Main Container */}
      <div className="p-4 pt-3 space-y-4 relative z-10 max-w-md mx-auto">
        {/* 📱 1. Samsung One UI Header Card & Weather Widget */}
        <div
          className={`w-full p-5 rounded-[2rem] border shadow-xl transition-all duration-300 space-y-4 ${
            isDarkMode
              ? 'bg-[#181A20]/90 backdrop-blur-2xl border-white/10 text-white shadow-black/40'
              : 'bg-white/90 backdrop-blur-2xl border-white/80 text-slate-900 shadow-slate-200/50'
          }`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 font-valorant text-2xl font-bold tracking-wider">
              <span className="text-[#3B82F6] drop-shadow-sm">ANESTHESIA</span>
              <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>CARE</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-bold border ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-[#E2E8F0]'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {currentUser?.role === 'admin' ? 'Admin' : 'Staff'}
              </span>

              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className={`relative p-2.5 rounded-full border transition active:scale-90 cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title="การแจ้งเตือน"
                >
                  <Bell size={16} />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
                </button>
              )}
            </div>
          </div>

          {/* Weather Squircle Widget (Fix Overflow & Clipping) */}
          <div
            className={`flex justify-between items-center px-3.5 py-3 rounded-[1.5rem] border gap-2 min-w-0 ${
              isDarkMode
                ? 'bg-[#101216]/80 border-white/5 text-slate-200'
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 shrink-0">
              <span className="text-2xl sm:text-3xl filter drop-shadow shrink-0">🌤️</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black leading-none nowrap-unit">
                    {weatherData.temp}°C
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold opacity-80 truncate max-w-[70px]">
                    {weatherData.locationName}
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] opacity-70 block leading-tight truncate">
                  {weatherData.condition}
                </span>
              </div>
            </div>

            <div
              className={`flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1.5 rounded-2xl border shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="nowrap-unit">
                ความชื้น <b>{weatherData.humidity}%</b>
              </div>
              <div className="border-l border-slate-500/30 pl-1.5 nowrap-unit">
                ลม <b>12 km/h</b>
              </div>
            </div>
          </div>
        </div>

        {/* 🗂️ 2. หมวดหมู่ตรวจเช็ก (Squircle Swiper Cards) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h2 className={`text-base font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              หมวดหมู่ตรวจเช็ก
            </h2>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              4 หมวดหลัก
            </span>
          </div>

          <Swiper
            modules={[EffectCoverflow, Pagination]}
            effect={'coverflow'}
            grabCursor={true}
            centeredSlides={true}
            slidesPerView={1.15}
            loop={true}
            speed={400}
            observer={true}
            observeParents={true}
            resizeObserver={true}
            coverflowEffect={{
              rotate: 0,
              stretch: -10,
              depth: 100,
              modifier: 1,
              slideShadows: false,
            }}
            pagination={{ clickable: true, dynamicBullets: true }}
            className="w-full pb-8 cursor-grab active:cursor-grabbing"
          >
            {categories.map((item) => (
              <SwiperSlide key={item.id}>
                {({ isActive }) => (
                  <div
                    className={`relative h-64 rounded-[2rem] overflow-hidden transition-all duration-300 ${
                      isActive
                        ? 'scale-100 opacity-100 shadow-2xl z-20 ring-1 ring-white/20'
                        : 'scale-90 opacity-50 blur-[0.3px] z-10'
                    }`}
                  >
                    <img src={item.bg} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
                      <span className="self-start bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-semibold border border-white/20">
                        {item.icon} {item.count}
                      </span>

                      <div className="space-y-3">
                        <h3 className="text-xl font-bold text-white leading-tight drop-shadow">{item.title}</h3>
                        <button
                          type="button"
                          onClick={() => onNavigate(item.targetView)}
                          className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs py-3 rounded-2xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
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

        {/* 📊 3. สถิติความพร้อมประจำวัน (One UI Widget Style) */}
        <div
          className={`w-full rounded-[2rem] p-5 border shadow-xl space-y-4 transition-colors duration-500 ${
            isDarkMode
              ? 'bg-[#181A20]/90 backdrop-blur-2xl border-white/10 text-white'
              : 'bg-white/90 backdrop-blur-2xl border-white/80 text-slate-800'
          }`}
        >
          <div className="flex justify-between items-center border-b pb-3 border-slate-700/30">
            <span className="text-sm font-bold">สถิติความพร้อมวันนี้</span>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-0.5 rounded-full font-bold">
              Real-time
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className={isDarkMode ? 'text-slate-800' : 'text-slate-200'}
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-400"
                  strokeDasharray={`${normalStroke}, 100`}
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {defectiveStroke > 0 && (
                  <path
                    className="text-rose-500"
                    strokeDasharray={`${defectiveStroke}, 100`}
                    strokeDashoffset={`-${normalStroke}`}
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                )}
              </svg>
              <span className="absolute text-lg font-black nowrap-unit">
                {stats.completionPct}%
              </span>
            </div>

            <div className="space-y-2 flex-1 ml-4">
              <div
                className={`flex justify-between items-center px-3 py-1.5 rounded-xl text-xs border ${
                  isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>ปกติพร้อมใช้</span>
                </span>
                <span className="font-black text-emerald-400">{stats.grandNormal}</span>
              </div>
              <div
                className={`flex justify-between items-center px-3 py-1.5 rounded-xl text-xs border ${
                  isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-bold flex items-center gap-1">
                  <XCircle size={13} className="text-rose-500" />
                  <span>ต้องตรวจสอบ</span>
                </span>
                <span className="font-black text-rose-500">{stats.grandDefective}</span>
              </div>
              <div
                className={`flex justify-between items-center px-3 py-1.5 rounded-xl text-xs border ${
                  isDarkMode ? 'bg-[#101216] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-bold flex items-center gap-1 opacity-80">
                  <Clock size={13} />
                  <span>รอตรวจเช็ก</span>
                </span>
                <span className="font-black opacity-80">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 🚨 4. รายการข้อบกพร่องที่ต้องตรวจสอบด่วน */}
        {defectiveItems.length > 0 && (
          <div
            className={`rounded-[2rem] p-5 border shadow-xl space-y-3 transition-colors duration-500 ${
              isDarkMode
                ? 'bg-[#181A20]/90 backdrop-blur-2xl border-slate-800 text-white'
                : 'bg-white/95 backdrop-blur-2xl border-rose-200 text-slate-800'
            }`}
          >
            <h3 className="text-sm font-bold text-rose-500 flex items-center gap-1.5">
              <AlertTriangle size={16} />
              <span>รายการที่ต้องตรวจสอบด่วน ({defectiveItems.length} รายการ)</span>
            </h3>
            <div className="space-y-2">
              {defectiveItems.slice(0, 3).map((item, idx) => (
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
