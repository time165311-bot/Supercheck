import React, { useState, useMemo } from 'react';
import {
  Bell,
  Box,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Stethoscope,
  Check,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronRight,
  TrendingUp,
  Filter,
  ArrowRight,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { CheckItemState, DrugItem, EquipmentItem, ExpiryAlertItem, ListConfig, User } from '../types';
import { DashboardChart } from './DashboardChart';
import { categoryCovers } from '../assets/categoryCovers';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, EffectCoverflow } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow';

interface ModernDashboardProps {
  currentUser: User | null;
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<'bag' | 'cart', ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  expiryAlerts: ExpiryAlertItem[];
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
  expiryAlerts,
  onNavigate,
  onLogout,
  onOpenNotifications,
  onToggleCheck,
  onUpdateNote,
  onZoomImage,
  onOpenBarcodeScan,
  overallStats,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'defective'>('all');

  const fbCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E4E6EB',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  };

  // Thai Date Formatter
  const getFormattedThaiDate = () => {
    const now = new Date();
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];
    return `วัน${thaiDays[now.getDay()]}ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
  };

  // Defective items list for rapid resolution
  const defectiveItems = useMemo(() => {
    const list: Array<{
      category: string;
      name: string;
      location: string;
      note?: string;
      targetView: 'eq_overview' | 'bag_check' | 'cart_check' | 'drug_check';
    }> = [];

    // 1. Equipment rooms
    Object.entries(globalChecks).forEach(([roomId, checks]) => {
      if (roomId === 'bag' || roomId === 'cart' || roomId === 'drugs') return;
      Object.entries(checks).forEach(([key, val]) => {
        if (val.result === 'ผิดปกติ') {
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

    // 2. Bags & Carts
    ['bag', 'cart'].forEach((cat) => {
      const checks = globalChecks[cat] || {};
      Object.entries(checks).forEach(([key, val]) => {
        if (val.result === 'ผิดปกติ') {
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

    // 3. Drugs (out of stock or defective)
    drugs.forEach((d) => {
      if (d.remaining <= 0) {
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



  const statCards = [
    {
      title: 'รายการทั้งหมด',
      value: overallStats.grandTotal,
      icon: LayoutDashboard,
      iconColor: '#1877F2',
      iconBg: '#E7F3FF',
      badge: 'ทั้งหมด',
      filterKey: 'all' as const,
    },
    {
      title: 'ตรวจเช็คแล้ว',
      value: overallStats.grandChecked,
      icon: Check,
      iconColor: '#00A400',
      iconBg: '#EAF8EA',
      badge: `${overallStats.completionPct}%`,
      filterKey: 'all' as const,
    },
    {
      title: 'สถานะปกติ',
      value: overallStats.grandNormal,
      icon: CheckCircle2,
      iconColor: '#1877F2',
      iconBg: '#E7F3FF',
      badge: 'พร้อมใช้',
      filterKey: 'normal' as const,
    },
    {
      title: 'ต้องตรวจสอบ',
      value: overallStats.grandDefective,
      icon: AlertTriangle,
      iconColor: '#FA383E',
      iconBg: '#FFEBEB',
      badge: overallStats.grandDefective > 0 ? 'รอแก้ไข' : 'ปกติ',
      filterKey: 'defective' as const,
      isPulse: overallStats.grandDefective > 0,
    },
  ];

  const quickMenuItems = [
    {
      id: 'drug',
      icon: Package,
      label: 'คลังยา & สารน้ำ',
      sub: `${drugs.length} รายการ`,
      view: 'drug_check' as const,
      color: '#1877F2',
      bg: '#E7F3FF',
      status: 'normal',
    },
    {
      id: 'eq',
      icon: Stethoscope,
      label: 'ครุภัณฑ์ห้องผ่าตัด',
      sub: 'ประจำห้อง OR',
      view: 'eq_overview' as const,
      color: '#00A400',
      bg: '#EAF8EA',
      status: 'normal',
    },
    {
      id: 'bag',
      icon: Box,
      label: 'กระเป๋าฉุกเฉิน',
      sub: 'Emergency Bag',
      view: 'bag_check' as const,
      color: '#FA383E',
      bg: '#FFEBEB',
      status: 'normal',
    },
    {
      id: 'cart',
      icon: ShoppingCart,
      label: 'รถเข็นฉุกเฉิน',
      sub: 'Emergency Cart',
      view: 'cart_check' as const,
      color: '#F57C00',
      bg: '#FFF3E0',
      status: 'normal',
    },
  ];

  // Filter categories based on search
  const filteredQuickMenu = quickMenuItems.filter((item) => {
    return (
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sub.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div
      className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans pb-12 overflow-x-hidden relative"
    >
      {/* 1. Vibrant Gradient Header - Full Bleed */}
      <div className="w-full bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-400 pt-8 pb-16 px-6 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-5 w-32 h-32 bg-emerald-300/30 rounded-full blur-xl pointer-events-none" />

        <div className="flex justify-between items-center relative z-10">
          <div>
            <span className="text-[11px] text-blue-100 font-medium tracking-wide">ยินดีต้อนรับ</span>
            <h1 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 900 }} className="text-xl font-black text-white tracking-tight drop-shadow-sm">
              Anesthesia Care
            </h1>
          </div>
          <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] px-3 py-1 rounded-full font-bold shadow-sm">
            {currentUser?.role === 'admin' ? 'Admin Mode' : 'Staff Mode'}
          </div>
        </div>
      </div>

      <div className="px-5 -mt-10 space-y-6 relative z-20">
        {/* 2. Medical Readiness Minimal Donut Chart */}
        <DashboardChart
          drugs={drugs}
          equipment={equipment}
          lists={lists}
          globalChecks={globalChecks}
          overallStats={overallStats}
        />

        {/* 3. Category Swiper (TikTok Style Scale with Vibrant UI) */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <h2 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-base text-slate-800">
              หมวดหมู่ตรวจเช็ก
            </h2>
            <span style={{ fontFamily: "'Sarabun', sans-serif" }} className="text-xs text-blue-600 font-semibold">
              4 หมวดหลัก
            </span>
          </div>
          
          <Swiper
            modules={[Pagination]}
            slidesPerView={1.2}
            centeredSlides={true}
            spaceBetween={12}
            loop={true}
            touchRatio={0.75}
            speed={380}
            pagination={{ 
              clickable: true,
              dynamicBullets: true,
            }}
            className="w-full pb-7"
          >
            {/* Slide 1: คลังยา */}
            <SwiperSlide>
              {({ isActive }) => (
                <div
                  onClick={() => onNavigate('drug_check')}
                  className={`relative h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100 shadow-xl shadow-blue-500/15 ring-2 ring-blue-500/40' : 'scale-95 opacity-55 shadow-sm'
                  }`}
                >
                  <img src={categoryCovers.drugs} alt="คลังยา" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <span className="self-start bg-black/40 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                      💊 {drugs.length} รายการ
                    </span>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Medicine & Drugs</span>
                        <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-base text-white leading-tight">
                          เช็คคลังยา
                        </h3>
                      </div>
                      <button
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        เข้าตรวจเช็ก &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>

            {/* Slide 2: ครุภัณฑ์ */}
            <SwiperSlide>
              {({ isActive }) => (
                <div
                  onClick={() => onNavigate('eq_overview')}
                  className={`relative h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100 shadow-xl shadow-blue-500/15 ring-2 ring-blue-500/40' : 'scale-95 opacity-55 shadow-sm'
                  }`}
                >
                  <img src={categoryCovers.equipment} alt="ครุภัณฑ์" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <span className="self-start bg-black/40 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                      🩺 {overallStats.grandTotal} รายการ
                    </span>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Medical Devices</span>
                        <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-base text-white leading-tight">
                          เช็คครุภัณฑ์
                        </h3>
                      </div>
                      <button
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        เข้าตรวจเช็ก &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>

            {/* Slide 3: กระเป๋าฉุกเฉิน */}
            <SwiperSlide>
              {({ isActive }) => (
                <div
                  onClick={() => onNavigate('bag_check')}
                  className={`relative h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100 shadow-xl shadow-blue-500/15 ring-2 ring-blue-500/40' : 'scale-95 opacity-55 shadow-sm'
                  }`}
                >
                  <img src={categoryCovers.bag} alt="กระเป๋า" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <span className="self-start bg-black/40 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                      🎒 {Object.values(lists.bag?.groups || {}).reduce((acc, arr) => acc + arr.length, 0)} รายการ
                    </span>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Emergency Bag</span>
                        <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-base text-white leading-tight">
                          เช็คกระเป๋าฉุกเฉิน
                        </h3>
                      </div>
                      <button
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        เข้าตรวจเช็ก &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>

            {/* Slide 4: รถฉุกเฉิน */}
            <SwiperSlide>
              {({ isActive }) => (
                <div
                  onClick={() => onNavigate('cart_check')}
                  className={`relative h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100 shadow-xl shadow-blue-500/15 ring-2 ring-blue-500/40' : 'scale-95 opacity-55 shadow-sm'
                  }`}
                >
                  <img src={categoryCovers.cart} alt="รถฉุกเฉิน" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <span className="self-start bg-black/40 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                      🛒 {Object.values(lists.cart?.groups || {}).reduce((acc, arr) => acc + arr.length, 0)} รายการ
                    </span>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Crash Cart</span>
                        <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-base text-white leading-tight">
                          เช็กรถฉุกเฉิน
                        </h3>
                      </div>
                      <button
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        เข้าตรวจเช็ก &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>
          </Swiper>
        </div>

        {/* 4. Urgent Defective Items (Simplified) */}
        {statusFilter === 'defective' && defectiveItems.length > 0 && (
          <div className="bg-[#FFF5F5] rounded-2xl p-4 border border-rose-100 shadow-sm">
            <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }} className="text-xs text-rose-600 mb-3 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              รายการที่ต้องตรวจสอบด่วน ({defectiveItems.length})
            </h3>
            <div className="space-y-2">
              {defectiveItems.slice(0, 3).map((item, idx) => (
                <div
                  key={`def_${idx}`}
                  onClick={() => onNavigate(item.targetView)}
                  className="bg-white p-3 rounded-xl border border-rose-50 flex items-center justify-between gap-3 active:scale-98 transition"
                >
                  <div className="min-w-0">
                    <p style={{ fontFamily: "'Sarabun', sans-serif", fontWeight: 600 }} className="text-[11px] text-slate-900 truncate">{item.name}</p>
                    <p className="text-[9px] text-slate-400">📍 {item.location}</p>
                  </div>
                  <ChevronRight size={14} className="text-rose-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
