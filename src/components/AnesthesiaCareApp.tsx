import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';

import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

export default function AnesthesiaCareApp() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const categories = [
    {
      id: 'medicine',
      title: 'คลังยา & สารน้ำ',
      count: '47 รายการ',
      icon: '💊',
      bg: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    },
    {
      id: 'equipment',
      title: 'ครุภัณฑ์ห้องผ่าตัด',
      count: '142 รายการ',
      icon: '🩺',
      bg: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800',
    },
    {
      id: 'bag',
      title: 'กระเป๋าฉุกเฉิน',
      count: '21 รายการ',
      icon: '🎒',
      bg: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800',
    },
    {
      id: 'cart',
      title: 'รถฉุกเฉิน (Crash Cart)',
      count: '44 รายการ',
      icon: '🛒',
      bg: 'https://images.unsplash.com/photo-1587745416684-47953f16f02f?w=800',
    },
  ];

  const medicineList = [
    { id: '1', name: 'Atropine sulfate 0.6 mg/ml', stock: 20, exp: '2027-08-31', status: 'low', cat: 'ยาฉุกเฉิน' },
    { id: '2', name: 'CPM (Chlorpheniramine) 10 mg/ml', stock: 20, exp: '2027-11-30', status: 'low', cat: 'ยาประจำเดือน' },
    { id: '3', name: 'Chloramphenicol ointment 1%', stock: 10, exp: '2027-05-31', status: 'low', cat: 'ยาประจำเดือน' },
    { id: '4', name: 'Desflurane liquid for inhalation', stock: 3, exp: '2028-01-31', status: 'low', cat: 'ยาดมสลบ' },
  ];

  return (
    <div className={`w-full min-h-screen font-['TH_Sarabun_New'] pb-24 overflow-x-hidden relative transition-colors duration-500 ${
      isDarkMode ? 'bg-[#06090E] text-white' : 'bg-[#F1F5F9] text-slate-900'
    }`}>
      <link href="https://fonts.googleapis.com/css2?family=Teko:wght@700&display=swap" rel="stylesheet" />

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

      {/* ฉากหลังวิดีโอผ่าตัด */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-all duration-700 ${
            isDarkMode ? 'opacity-40 brightness-75 contrast-110' : 'opacity-25 brightness-100 contrast-95'
          }`}
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-surgeons-during-an-operation-41539-large.mp4" type="video/mp4" />
        </video>
        <div className={`absolute inset-0 ${
          isDarkMode ? 'bg-gradient-to-b from-[#06090E]/90 via-[#06090E]/60 to-[#06090E]/95' : 'bg-gradient-to-b from-[#F1F5F9]/90 via-[#F1F5F9]/50 to-[#F1F5F9]/95'
        }`} />
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {!selectedCategory ? (
          <>
            <div className={`w-full p-4 rounded-3xl border shadow-xl transition-all duration-500 space-y-3 ${
              isDarkMode ? 'bg-[#0B111E]/90 backdrop-blur-xl border-slate-800 text-white' : 'bg-white/90 backdrop-blur-xl border-white/80 text-slate-900'
            }`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-700/30">
                <div className="flex items-center gap-1.5 font-valorant text-2xl font-bold tracking-wider">
                  <span className="text-[#1877F2] drop-shadow-sm">ANESTHESIA</span>
                  <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>CARE</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>Admin</span>
                  <button className={`relative p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    🔔
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  </button>
                </div>
              </div>

              <div className={`flex justify-between items-center p-2.5 rounded-2xl border ${isDarkMode ? 'bg-black/60 border-slate-800 text-slate-200' : 'bg-slate-50/80 border-slate-200/80 text-slate-800'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🌤️</span>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black leading-none nowrap-unit">28°C</span>
                      <span className="text-[11px] font-bold opacity-80">กรุงเทพฯ</span>
                    </div>
                    <span className="text-[10px] opacity-70 block leading-tight">ท้องฟ้าโปร่ง</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                  <div className="nowrap-unit">ความชื้น <b>79%</b></div>
                  <div className="border-l border-slate-500/30 pl-2 nowrap-unit">ลม <b>12 km/h</b></div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <h2 className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>หมวดหมู่ตรวจเช็ก</h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-600'}`}>4 หมวดหลัก</span>
              </div>

              <Swiper
                modules={[EffectCoverflow, Pagination]}
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={1.25}
                loop={true}
                speed={400}
                coverflowEffect={{ rotate: 0, stretch: -20, depth: 130, modifier: 1, slideShadows: false }}
                pagination={{ clickable: true, dynamicBullets: true }}
                className="w-full pb-8"
              >
                {categories.map((item) => (
                  <SwiperSlide key={item.id}>
                    {({ isActive }) => (
                      <div className={`relative h-60 rounded-3xl overflow-hidden transition-all duration-300 ${isActive ? 'scale-100 opacity-100 shadow-2xl z-20 border border-slate-500/40' : 'scale-85 opacity-40 blur-[0.3px] z-10'}`}>
                        <img src={item.bg} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                          <span className="self-start bg-black/60 text-white text-[11px] px-2.5 py-0.5 rounded-full font-semibold border border-slate-700">{item.icon} {item.count}</span>
                          <div className="space-y-2">
                            <h3 className="text-lg font-bold text-white leading-tight drop-shadow">{item.title}</h3>
                            <button onClick={() => setSelectedCategory(item.id)} className="w-full bg-[#1877F2] text-white font-bold text-xs py-2.5 rounded-xl shadow-lg transition">เข้าตรวจเช็ก &rarr;</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button onClick={() => setSelectedCategory(null)} className={`text-xs px-3.5 py-2 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>&larr; กลับหน้าหลัก</button>
              <button className="bg-[#1877F2] text-white text-xs font-bold px-3 py-2 rounded-xl">+ เพิ่มรายการใหม่</button>
            </div>

            {/* แท็บบอร์ดเลื่อนแนวนอน ไม่ซ้อนทับกัน */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              <button onClick={() => setActiveTab('all')} className={`text-xs px-3.5 py-2 rounded-xl font-bold whitespace-nowrap flex-shrink-0 ${activeTab === 'all' ? 'bg-[#1877F2] text-white' : isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400' : 'bg-white border border-slate-200 text-slate-700'}`}>ทั้งหมด (25)</button>
              <button onClick={() => setActiveTab('monthly')} className={`text-xs px-3.5 py-2 rounded-xl font-bold whitespace-nowrap flex-shrink-0 ${activeTab === 'monthly' ? 'bg-[#1877F2] text-white' : isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400' : 'bg-white border border-slate-200 text-slate-700'}`}>💊 ยาและสารน้ำประจำเดือน</button>
              <button onClick={() => setActiveTab('highrisk')} className={`text-xs px-3.5 py-2 rounded-xl font-bold whitespace-nowrap flex-shrink-0 ${activeTab === 'highrisk' ? 'bg-[#1877F2] text-white' : isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400' : 'bg-white border border-slate-200 text-slate-700'}`}>🚨 ยาความเสี่ยงสูง/กู้ชีพ</button>
            </div>

            {/* รายการยา คมชัด สว่าง อ่านออก 100% */}
            <div className="space-y-3">
              {medicineList.map((item) => (
                <div key={item.id} className={`p-4 rounded-2xl border shadow-lg space-y-3 ${isDarkMode ? 'bg-[#0B111E]/95 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white drop-shadow-sm">{item.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-300">
                        <span>คงเหลือ: <b className="text-emerald-400">{item.stock}</b></span>
                        <span>EXP: <b className="text-amber-400">{item.exp}</b></span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">สต็อกต่ำ</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* เมนูล่างพร้อมปุ่มสแกนสีฟ้า Facebook Blue เรืองแสงสวยงามตรงกลาง */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 px-6 py-2.5 flex justify-between items-center border-t backdrop-blur-xl ${isDarkMode ? 'bg-[#06090E]/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200 text-slate-800'}`}>
        <button onClick={() => setSelectedCategory(null)} className="flex flex-col items-center text-[#1877F2] font-bold">
          <span className="text-lg">🏠</span>
          <span className="text-[10px]">หน้าหลัก</span>
        </button>
        <button className="flex flex-col items-center opacity-60">
          <span className="text-lg">📊</span>
          <span className="text-[10px]">รายงาน</span>
        </button>
        <button className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-br from-[#1877F2] to-cyan-500 text-white rounded-full -mt-7 shadow-lg shadow-blue-500/50 ring-4 ring-blue-500/20 active:scale-95 transition">
          <span className="text-lg font-mono font-black leading-none">|||||</span>
          <span className="text-[9px] font-extrabold mt-0.5">สแกน</span>
        </button>
        <button className="flex flex-col items-center opacity-60">
          <span className="text-lg">📋</span>
          <span className="text-[10px]">ชีต</span>
        </button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col items-center opacity-70">
          <span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>
          <span className="text-[10px]">เมนู</span>
        </button>
      </div>
    </div>
  );
}
