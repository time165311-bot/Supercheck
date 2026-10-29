import React, { useEffect, useRef, useState, useMemo } from 'react';
import Swiper from 'swiper';
import { Navigation, Pagination, Keyboard, A11y, EffectCoverflow, FreeMode } from 'swiper/modules';
import {
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Camera,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Package,
  Layers,
  Sparkles,
  Stethoscope,
  Pill,
  BriefcaseMedical,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { CheckItemState, EquipmentItem } from '../types';
import { categoryCovers } from '../assets/categoryCovers';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow';

export interface InspectionSlideItem {
  id: string;
  name: string;
  no?: string;
  code?: string;
  sap?: string;
  spec?: string;
  location?: string;
  img?: string;
  coverImg?: string;
  category?: 'equipment' | 'drugs' | 'bag' | 'cart';
  categoryName?: string;
  exp?: string;
  note?: string;
  itemKey: string;
  rawItem: EquipmentItem | any;
  roomId?: string;
}

interface SwiperInspectionCarouselProps {
  title: string;
  subtitle?: string;
  items: InspectionSlideItem[];
  checks: Record<string, CheckItemState>;
  onToggleCheck: (itemKey: string, result: 'ปกติ' | 'ผิดปกติ', itemName: string) => void;
  onUpdateNote: (itemKey: string, note: string) => void;
  onOpenDetail?: (item: any, check?: CheckItemState) => void;
  onZoomImage?: (imgUrl: string) => void;
  onOpenBarcodeScan?: () => void;
}

export const SwiperInspectionCarousel: React.FC<SwiperInspectionCarouselProps> = ({
  title,
  subtitle,
  items,
  checks,
  onToggleCheck,
  onUpdateNote,
  onOpenDetail,
  onZoomImage,
  onOpenBarcodeScan,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swiperInstanceRef = useRef<Swiper | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'equipment' | 'drugs' | 'bag' | 'cart'>('all');

  // Filter items based on active category pill
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  // Helper to get fallback category cover if item doesn't have an explicit coverImg
  const getCoverImageForCategory = (category?: string) => {
    if (category === 'drugs') return categoryCovers.drugs;
    if (category === 'bag') return categoryCovers.bag;
    if (category === 'cart') return categoryCovers.cart;
    return categoryCovers.equipment;
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'drugs':
        return <Pill size={14} className="text-[#00A400]" />;
      case 'bag':
        return <BriefcaseMedical size={14} className="text-[#FA383E]" />;
      case 'cart':
        return <Truck size={14} className="text-[#F57C00]" />;
      default:
        return <Stethoscope size={14} className="text-[#1877F2]" />;
    }
  };

  // 2. Swiper 3D Coverflow & Free-Mode Momentum Setup according to specification:
  useEffect(() => {
    if (!containerRef.current || filteredItems.length === 0) return;

    if (swiperInstanceRef.current) {
      swiperInstanceRef.current.destroy(true, true);
    }

    const swiper = new Swiper(containerRef.current, {
      modules: [Navigation, Pagination, Keyboard, A11y, EffectCoverflow, FreeMode],
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      coverflowEffect: {
        rotate: 20,
        stretch: 0,
        depth: 120,
        modifier: 1,
        slideShadows: false,
      },
      freeMode: false,
      resistanceRatio: 0.85,
      touchRatio: 0.65,
      speed: 350,
      keyboard: { enabled: true },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
        dynamicBullets: true,
      },
      navigation: {
        nextEl: '.swiper-button-next-custom',
        prevEl: '.swiper-button-prev-custom',
      },
      on: {
        slideChange: (s) => {
          setActiveIndex(s.realIndex);
        },
      },
    });

    swiperInstanceRef.current = swiper;

    return () => {
      try {
        if (swiperInstanceRef.current) {
          swiperInstanceRef.current.destroy(true, true);
        }
      } catch (e) {
        // Safe cleanup fallback
      }
    };
  }, [filteredItems.length, categoryFilter]);

  const activeItem = filteredItems[activeIndex] || filteredItems[0];
  const activeCheck = activeItem ? checks[activeItem.itemKey] : undefined;
  const isOk = activeCheck?.result === 'ปกติ';
  const isBad = activeCheck?.result === 'ผิดปกติ';

  // Dynamic Ambient Mood Glow
  const getDynamicMoodColor = () => {
    if (isBad) return 'rgba(250, 56, 62, 0.14)';
    if (isOk) return 'rgba(0, 164, 0, 0.12)';
    return 'rgba(24, 119, 242, 0.14)';
  };

  const categories = [
    { key: 'all' as const, label: 'ทั้งหมด', count: items.length },
    { key: 'equipment' as const, label: 'ครุภัณฑ์ OR', count: items.filter((i) => i.category === 'equipment').length },
    { key: 'drugs' as const, label: 'คลังยา', count: items.filter((i) => i.category === 'drugs').length },
    { key: 'bag' as const, label: 'กระเป๋าฉุกเฉิน', count: items.filter((i) => i.category === 'bag').length },
    { key: 'cart' as const, label: 'รถเข็นฉุกเฉิน', count: items.filter((i) => i.category === 'cart').length },
  ];

  return (
    <div
      style={{
        fontFamily: "'Sarabun', 'Inter', sans-serif !important",
      }}
      className="relative py-2.5 transition-all duration-500 overflow-hidden rounded-3xl"
    >
      {/* Dynamic Atmospheric Background Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out -z-10 rounded-3xl"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${getDynamicMoodColor()} 0%, rgba(240, 242, 245, 0.4) 80%)`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />

      {/* Top Header & Fast Barcode Scan Action */}
      <div className="px-3 sm:px-4 mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2] animate-pulse" />
            <h3
              style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 700 }}
              className="text-base sm:text-lg text-[#050505] tracking-tight"
            >
              {title}
            </h3>
          </div>
          {subtitle && (
            <p
              style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 400 }}
              className="text-xs text-[#65676B] mt-0.5"
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {filteredItems.length > 0 && (
            <span
              style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 600 }}
              className="text-xs text-[#1877F2] bg-[#E7F3FF] px-2.5 py-1 rounded-full border border-[#1877F2]/20"
            >
              {Math.min(activeIndex + 1, filteredItems.length)} / {filteredItems.length}
            </span>
          )}
          {onOpenBarcodeScan && (
            <button
              onClick={onOpenBarcodeScan}
              type="button"
              className="p-2 rounded-xl bg-white border border-[#E4E6EB] text-[#1877F2] hover:bg-[#F0F2F5] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="สแกนบาร์โค้ดด่วน"
            >
              <Camera size={16} />
              <span className="text-xs font-semibold hidden sm:inline">สแกน</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills (Clean Sarabun Typography) */}
      <div className="px-3 sm:px-4 mb-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          if (cat.count === 0 && cat.key !== 'all') return null;
          const isActive = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setCategoryFilter(cat.key);
                setActiveIndex(0);
              }}
              style={{
                fontFamily: "'Sarabun', sans-serif !important",
                fontWeight: isActive ? 600 : 500,
              }}
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'bg-white text-[#65676B] border border-[#E4E6EB] hover:bg-[#F0F2F5]'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-[#F0F2F5] text-[#65676B]'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Swiper 3D Coverflow Container */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-[#E4E6EB] text-sm text-[#65676B] mx-3">
          ไม่พบรายการในหมวดที่เลือก
        </div>
      ) : (
        <div className="swiper swiper-cards main-swiper px-2" ref={containerRef}>
          <div className="swiper-wrapper">
            {filteredItems.map((item, idx) => {
              const check = checks[item.itemKey];
              const itemIsOk = check?.result === 'ปกติ';
              const itemIsBad = check?.result === 'ผิดปกติ';
              const isCurrentActive = idx === activeIndex;
              const coverImgSrc = item.coverImg || getCoverImageForCategory(item.category);

              const slideKey = item.id
                ? `slide_${item.id}_${idx}`
                : `slide_${item.itemKey || 'item'}_${idx}`;

              return (
                <div key={slideKey} className="swiper-slide h-auto">
                  <div
                    style={{
                      fontFamily: "'Sarabun', sans-serif !important",
                      backgroundColor: '#FFFFFF',
                      borderRadius: '24px',
                      border: itemIsBad
                        ? '2px solid #FA383E'
                        : itemIsOk
                        ? '2px solid #00A400'
                        : isCurrentActive
                        ? '2px solid #1877F2'
                        : '1px solid #E4E6EB',
                      boxShadow: isCurrentActive
                        ? '0 20px 40px -10px rgba(24, 119, 242, 0.22), 0 2px 6px rgba(0, 0, 0, 0.04)'
                        : '0 4px 16px rgba(0, 0, 0, 0.06)',
                    }}
                    className="flex flex-col justify-between h-full bg-white transition-all duration-300 relative select-none overflow-hidden"
                  >
                    {/* 3. Cover Banner (Cinematic Deep Blue Medical with Frosted Glass Badge Overlay) */}
                    <div className="relative w-full h-32 sm:h-36 overflow-hidden bg-slate-900 shrink-0">
                      <img
                        src={coverImgSrc}
                        alt={item.categoryName || 'Medical Cover'}
                        className="w-full h-full object-cover opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

                      {/* Translucent Glass Pill on Cover Banner */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                        <div
                          style={{
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            backgroundColor: 'rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.6)',
                          }}
                          className="px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs"
                        >
                          {getCategoryIcon(item.category)}
                          <span
                            style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 600 }}
                            className="text-[11px] text-[#050505] tracking-tight"
                          >
                            {item.categoryName || 'อุปกรณ์วิสัญญี'}
                          </span>
                        </div>

                        {/* Status Chip on Cover */}
                        <span
                          style={{
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            fontFamily: "'Sarabun', sans-serif !important",
                            fontWeight: 600,
                          }}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${
                            itemIsOk
                              ? 'bg-emerald-500/90 text-white'
                              : itemIsBad
                              ? 'bg-rose-500/90 text-white'
                              : 'bg-white/85 text-slate-700'
                          }`}
                        >
                          {itemIsOk && <CheckCircle2 size={12} />}
                          {itemIsBad && <AlertTriangle size={12} />}
                          <span>{itemIsOk ? 'ปกติ' : itemIsBad ? 'มีปัญหา' : 'รอตรวจ'}</span>
                        </span>
                      </div>

                      {/* Item No / Code Badges floating at bottom of Cover banner */}
                      <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 flex-wrap">
                        {item.no && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1877F2] text-white font-semibold shadow-xs">
                            #{item.no}
                          </span>
                        )}
                        {item.code && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/90 text-[#050505] font-mono shadow-xs">
                            {item.code}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content Body (Clean Sarabun Typography) */}
                    <div className="p-4 flex flex-col justify-between flex-1">
                      <div>
                        {/* Title & Item Photo Thumbnail if specific image exists */}
                        <div className="flex items-start gap-3 mb-2.5">
                          {item.img && (
                            <div className="relative group shrink-0">
                              <img
                                src={item.img}
                                alt={item.name}
                                onClick={() => onZoomImage && onZoomImage(item.img!)}
                                className="w-14 h-14 rounded-xl object-cover border border-[#E4E6EB] cursor-pointer hover:opacity-90 transition shadow-xs"
                              />
                              <button
                                type="button"
                                onClick={() => onZoomImage && onZoomImage(item.img!)}
                                className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <Maximize2 size={10} />
                              </button>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h4
                              style={{
                                fontFamily: "'Sarabun', sans-serif !important",
                                fontWeight: 600,
                              }}
                              className="text-sm sm:text-base text-[#050505] line-clamp-2 leading-snug"
                            >
                              {item.name}
                            </h4>
                            {item.spec && (
                              <p
                                style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 400 }}
                                className="text-xs text-[#65676B] line-clamp-1 mt-0.5"
                              >
                                {item.spec}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Location and Expiration meta tags */}
                        <div className="space-y-1 mb-3 pt-1">
                          {item.location && (
                            <div className="flex items-center gap-1.5 text-xs text-[#1877F2]">
                              <span className="shrink-0">📍</span>
                              <span
                                style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 500 }}
                                className="truncate"
                              >
                                {item.location}
                              </span>
                            </div>
                          )}

                          {item.exp && (
                            <div className="flex items-center gap-1.5 text-xs text-[#FA383E]">
                              <span className="shrink-0">⏳</span>
                              <span
                                style={{ fontFamily: "'Sarabun', sans-serif !important", fontWeight: 500 }}
                              >
                                หมดอายุ: {item.exp}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. Action Buttons on Active Card */}
                      <div className="space-y-2 pt-2 border-t border-[#F0ECE1]">
                        {item.category === 'drugs' ? (
                          /* Quick Adjust for Drugs */
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                               <button 
                                 onClick={() => {
                                   const newQty = Math.max(0, (item.rawItem.remaining || 0) - 1);
                                   onToggleCheck(item.itemKey, 'ปกติ', `${item.name} (${newQty})`); // Hack to update
                                 }}
                                 className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 text-slate-700 font-bold active:scale-95"
                               >–</button>
                               <span className="font-bold text-slate-900">{item.rawItem.remaining} {item.rawItem.unit}</span>
                               <button 
                                 onClick={() => {
                                   const newQty = (item.rawItem.remaining || 0) + 1;
                                   onToggleCheck(item.itemKey, 'ปกติ', `${item.name} (${newQty})`);
                                 }}
                                 className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 text-slate-700 font-bold active:scale-95"
                               >+</button>
                             </div>
                             <button
                               onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name)}
                               className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                             >
                               <Check size={16} /> <span>✓ บันทึกเช็ค</span>
                             </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {/* Button: ปกติ */}
                            <button
                              type="button"
                              onClick={() => onToggleCheck(item.itemKey, 'ปกติ', item.name)}
                              style={{
                                fontFamily: "'Sarabun', sans-serif !important",
                                fontWeight: 600,
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                itemIsOk
                                  ? 'bg-[#00A400] text-white shadow-md shadow-[#00A400]/30 border border-[#00A400]'
                                  : 'bg-[#F0F2F5] text-[#050505] hover:bg-emerald-50 hover:text-emerald-700 border border-[#E4E6EB]'
                              }`}
                            >
                              <Check size={16} strokeWidth={2.5} />
                              <span>ปกติ</span>
                            </button>
                            {/* Button: มีปัญหา */}
                            <button
                              type="button"
                              onClick={() => onToggleCheck(item.itemKey, 'ผิดปกติ', item.name)}
                              style={{
                                fontFamily: "'Sarabun', sans-serif !important",
                                fontWeight: 600,
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                itemIsBad
                                  ? 'bg-[#FA383E] text-white shadow-md shadow-[#FA383E]/30 border border-[#FA383E]'
                                  : 'bg-[#F0F2F5] text-[#050505] hover:bg-rose-50 hover:text-rose-700 border border-[#E4E6EB]'
                              }`}
                            >
                              <X size={16} strokeWidth={2.5} />
                              <span>มีปัญหา</span>
                            </button>
                            {/* Details Button */}
                            {onOpenDetail && (
                              <button
                                type="button"
                                onClick={() => onOpenDetail(item.rawItem, check)}
                                className="p-2.5 rounded-xl bg-[#F0F2F5] text-[#65676B] hover:text-[#050505] hover:bg-[#E4E6EB] transition shrink-0 cursor-pointer"
                                title="ดูรายละเอียดเพิ่มเติม"
                              >
                                <MoreVertical size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Defect Note Input (if marked defective) */}
                        {itemIsBad && (
                          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <input
                              type="text"
                              value={check?.note || ''}
                              onChange={(e) => onUpdateNote(item.itemKey, e.target.value)}
                              placeholder="ระบุอาการเสีย หรือปัญหาที่พบ..."
                              style={{ fontFamily: "'Sarabun', sans-serif !important" }}
                              className="w-full px-3 py-1.5 text-xs rounded-xl bg-rose-50 border border-rose-300 outline-none text-rose-900 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Carousel Navigation Arrows & Pagination Dots */}
          <div className="flex items-center justify-between mt-3 px-2">
            <button
              type="button"
              className="swiper-button-prev-custom w-9 h-9 rounded-full bg-white border border-[#E4E6EB] text-[#050505] hover:bg-[#F0F2F5] flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition"
              title="ก่อนหน้า"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="swiper-pagination relative !bottom-0 flex justify-center !w-auto" />

            <button
              type="button"
              className="swiper-button-next-custom w-9 h-9 rounded-full bg-white border border-[#E4E6EB] text-[#050505] hover:bg-[#F0F2F5] flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition"
              title="ถัดไป"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
