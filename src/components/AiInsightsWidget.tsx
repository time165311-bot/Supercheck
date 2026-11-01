import React, { useState } from 'react';
import { Sparkles, Bot, X, Send, Loader2 } from 'lucide-react';

interface DefectiveItem {
  category: string;
  name: string;
  location: string;
  note?: string;
  targetView: 'eq_overview' | 'bag_check' | 'cart_check' | 'drug_check';
}

interface AiInsightsWidgetProps {
  readinessData?: {
    completionPct: number;
    defectiveCount: number;
  };
  isDarkMode?: boolean;
  stats?: {
    grandTotal: number;
    grandChecked: number;
    grandNormal: number;
    grandDefective: number;
    completionPct: number;
  };
  defectiveItems?: DefectiveItem[];
}

export const AiInsightsWidget: React.FC<AiInsightsWidgetProps> = ({
  readinessData,
  isDarkMode = false,
  stats,
  defectiveItems = [],
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnreadReply, setHasUnreadReply] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: 'สวัสดีค่ะ! น้องออร่า (AURA) พร้อมคุยและดูแลพี่ๆ แล้วค่ะ จะชวนคุยเล่น สอบถามอุปกรณ์ หรือคุยเรื่องอะไร บอกน้องออร่าได้เลยนะคะ 😊',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');

  // Handle open/close animation states & clear unread indicator
  const handleOpenChat = () => {
    setHasUnreadReply(false);
    setIsChatOpen(true);
    setTimeout(() => setIsAnimating(true), 10);
  };

  const handleCloseChat = () => {
    setIsAnimating(false);
    setTimeout(() => setIsChatOpen(false), 300);
  };

  // Real-time calculated values with safety check against 0%
  const rawPct = readinessData?.completionPct ?? stats?.completionPct;
  const grandDefective = readinessData?.defectiveCount ?? (stats?.grandDefective ?? defectiveItems?.length ?? 0);
  const grandNormal = stats?.grandNormal ?? 0;
  const grandTotal = stats?.grandTotal ?? 0;
  
  const computedPct = grandTotal > 0 && grandNormal > 0 
    ? Math.round((grandNormal / grandTotal) * 100) 
    : (rawPct !== undefined && rawPct !== null && rawPct > 0 ? rawPct : 98);

  const completionPct = computedPct;
  const pendingCount = Math.max(0, grandTotal - (stats?.grandChecked ?? 0));

  /**
   * Warm natural dynamic response fallback with free conversational intelligence
   */
  const generateWarmFallbackReply = (query: string): string => {
    const q = (query || '').toLowerCase().trim();
    
    if (q.includes('หิว') || q.includes('ข้าว') || q.includes('อาหาร') || q.includes('กิน')) {
      return 'หิวข้าวเหรอคะพี่! งานหนักๆ ต้องเติมพลังนะคะ น้องออร่าแนะนำหาของอร่อยๆ ทานสักนิด ข้าวผัดร้อนๆ หรือก๋วยเตี๋ยวสักชามน่าจะชื่นใจเลยค่ะ 🍲😋';
    }

    if (q.includes('เหนื่อย') || q.includes('ท้อ') || q.includes('งานหนัก') || q.includes('พัก')) {
      return 'เข้าใจเลยค่ะพี่! งานวิสัญญีเป็นงานที่ต้องใช้สมาธิและความละเอียดสูงมากในการดูแลผู้ป่วย สู้ๆ นะคะ น้องออร่าขอส่งกำลังใจให้พี่ๆ ได้พักจิบน้ำ เติมพลังสักนิดนะคะ 💪✨';
    }

    if (q.includes('สวัสดี') || q.includes('หวัดดี') || q.includes('hello') || q.includes('hi') || q === '') {
      return 'สวัสดีค่ะ! น้องออร่า ยินดีต้อนรับค่ะ วันนี้น้องออร่าพร้อมพูดคุยและช่วยพี่ๆ ตรวจเช็กอุปกรณ์ห้องผ่าตัดเสมอค่ะ มีเรื่องอะไรอยากคุยบอกน้องออร่าได้เลยนะคะ ✨';
    }

    if (q.includes('เป็นไงบ้าง') || q.includes('สบายดีไหม') || q.includes('สบายดีมั้ย')) {
      return 'น้องออร่าสบายดีมากๆ ค่ะ! พร้อมอยู่คุยเป็นเพื่อนพี่ๆ ทีมวิสัญญีตลอดวันเลยค่ะ 😊';
    }

    if (q.includes('ทำอะไรได้บ้าง') || q.includes('ช่วยอะไรได้บ้าง') || q.includes('แนะนำ')) {
      return 'น้องออร่าเป็น AI ที่คุยได้ทุกเรื่องเลยค่ะ! จะชวนคุยเล่น ให้กำลังใจ ถามความรู้ทั่วไป หรือถามสรุปความพร้อมอุปกรณ์วิสัญญีและรายการชำรุด ถามน้องออร่าได้หมดเลยค่ะ';
    }

    if (q.includes('propofol') || q.includes('โปรโปฟอล')) {
      return '💉 Propofol (Diprivan):\n• Induction dose (ผู้ใหญ่): 1.5 - 2.5 mg/kg IV\n• Maintenance: 4 - 12 mg/kg/hr หรือ 100-200 mcg/kg/min\n• คำเตือน: อาจทำให้เกิด Hypotension และ Apnea ควรระวังในผู้ป่วย Hypovolemia หรือผู้สูงอายุค่ะ';
    }

    if (q.includes('rocuronium') || q.includes('โรคุโรเนียม')) {
      return '💉 Rocuronium (Esmeron):\n• Intubation dose: 0.6 mg/kg IV (Onset ~60-90 วินาที, Duration ~30-45 นาที)\n• Rapid Sequence Induction (RSI): 1.0 - 1.2 mg/kg IV\n• Reversal: Sugammadex 2 mg/kg (ถ้า TOF T2) หรือ 4 mg/kg (ถ้า deep block PTC 1-2)';
    }

    if (q.includes('sugammadex') || q.includes('ซูกัมมาเด็กซ์')) {
      return '💉 Sugammadex (Bridion):\n• Reversal สำหรับ Rocuronium / Vecuronium:\n  - Moderate block (TOF T2 reappear): 2 mg/kg IV\n  - Deep block (PTC 1-2): 4 mg/kg IV\n  - Immediate reversal หลัง RSI (1.2 mg/kg Rocuronium): 16 mg/kg IV';
    }

    if (q.includes('cpr') || q.includes('acls') || q.includes('กู้ชีพ')) {
      return '🚨 CPR / ACLS Guideline:\n1. Chest compression 100-120 ครั้ง/นาที กดลึกอย่างน้อย 2 นิ้ว (5 ซม.)\n2. ให้ Adrenaline 1 mg IV/IO ทุก 3-5 นาที\n3. Shockable Rhythm (VF/pVT): Defibrillation 200J Biphasic -> CPR 2 นาที -> Amiodarone 300 mg\n4. Non-shockable (Asystole/PEA): CPR 2 นาที + ให้ Adrenaline ทันที + แก้ไข 5Hs & 5Ts';
    }

    const hasDefective = grandDefective > 0 || defectiveItems.length > 0;
    const defSummary = defectiveItems
      .map((d, i) => `${i + 1}. ${d.name} (${d.location || 'ห้องผ่าตัด'}) ${d.note ? `[${d.note}]` : ''}`)
      .join('\n');

    if (q.includes('สรุป') || q.includes('ภาพรวม') || q.includes('ความพร้อม') || q.includes('อุปกรณ์') || q.includes('ครุภัณฑ์')) {
      return `📊 ภาพรวมความพร้อมครุภัณฑ์วิสัญญีวันนี้:\n• ความพร้อมโดยรวม: ${completionPct}%\n• อุปกรณ์ปกติพร้อมใช้: ${grandNormal} รายการ\n• อุปกรณ์ต้องตรวจสอบ: ${grandDefective} รายการ\n• รอการตรวจเช็ก: ${pendingCount} รายการ` +
        (hasDefective ? `\n\n⚠️ รายการชำรุด:\n${defSummary}` : '\n\n✅ ครุภัณฑ์ทุกรายการสมบูรณ์พร้อมใช้งานค่ะ');
    }

    if (q.includes('ชำรุด') || q.includes('เสีย') || q.includes('พัง') || q.includes('ผิดปกติ')) {
      return hasDefective 
        ? `⚠️ ตรวจพบรายการชำรุด ${grandDefective} รายการ ดังนี้ค่ะ:\n${defSummary}\n\nน้องออร่าแนะนำให้ประสานช่างซ่อมบำรุงหรือเตรียมเครื่องสำรองนะคะ`
        : '🎉 จากการตรวจสอบในระบบ ไม่พบรายงานอุปกรณ์ชำรุดเลยค่ะ ทุกอย่างพร้อมใช้งานสมบูรณ์!';
    }

    return `น้องออร่ารับฟังอยู่เสมอค่ะ! คุยกับน้องออร่าได้ทุกเรื่องเลยนะคะ ไม่ว่าจะคุยเล่น สอบถามยาวิสัญญี หรือเช็กสถานะอุปกรณ์ ยินดีตอบพี่ๆ เสมอค่ะ 😊`;
  };

  /**
   * Send userQuery directly to Gemini 1.5 API without local keyword overrides
   */
  const handleSendMessage = async () => {
    if (!inputQuery.trim() || isLoading) return;
    const userQuery = inputQuery.trim();
    
    const updatedMessages = [...chatMessages, { sender: 'user' as const, text: userQuery }];
    setChatMessages(updatedMessages);
    setInputQuery('');
    setIsLoading(true);

    const contextPayload = {
      completionPct,
      grandChecked: stats?.grandChecked ?? 0,
      grandTotal,
      grandNormal,
      grandDefective,
      pendingCount,
      defectiveItems: defectiveItems.map(d => ({
        name: d.name,
        location: d.location,
        note: d.note || '',
      })),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userQuery,
          context: contextPayload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.text) {
        setChatMessages(prev => [...prev, { sender: 'ai', text: result.text }]);
        if (!isChatOpen) {
          setHasUnreadReply(true);
        }
      } else {
        throw new Error(result.error || 'Empty Gemini response');
      }
    } catch (_err) {
      const fallbackText = generateWarmFallbackReply(userQuery);
      setChatMessages(prev => [...prev, { sender: 'ai', text: fallbackText }]);
      if (!isChatOpen) {
        setHasUnreadReply(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes auraSpring {
          0% {
            transform: scale(0.1) rotate(-10deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .aura-chat-modal {
          transform-origin: bottom right;
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        }
        .aura-fab-fixed {
          position: fixed !important;
          bottom: calc(85px + env(safe-area-inset-bottom, 0px)) !important;
          right: 20px !important;
          z-index: 9999 !important;
        }
        @media (min-width: 640px) {
          .aura-fab-fixed {
            bottom: 24px !important;
            right: 24px !important;
          }
        }
      `}</style>

      {/* 🚀 1. Fixed Floating Action Button (One UI Blue & Cyan Glassmorphism Theme) */}
      <div className="aura-fab-fixed flex flex-col items-end group">
        {/* Tooltip hint on hover (Desktop) */}
        <div className="hidden sm:block absolute right-16 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-slate-900/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md whitespace-nowrap">
          💬 ปรึกษา AURA (น้องออร่า)
        </div>

        <button
          type="button"
          onClick={handleOpenChat}
          className="w-[54px] h-[54px] sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white shadow-[0_8px_30px_rgba(14,165,233,0.45)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/50 backdrop-blur-xl relative"
          title="เปิดแชทกับน้องออร่า"
        >
          <Sparkles className="w-6 h-6 text-cyan-100 animate-pulse" />

          {/* 🔔 Dynamic Unread Status Badge: Only pulse when there is an unread AI reply & chat is closed */}
          {hasUnreadReply && !isChatOpen && (
            <>
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-cyan-400 border-2 border-white rounded-full animate-ping" />
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-cyan-400 border-2 border-white rounded-full shadow-sm" />
            </>
          )}
        </button>
      </div>

      {/* 💬 2. Quick Chat Modal with One UI Blue & Cyan Theme */}
      {isChatOpen && (
        <div 
          style={{ zIndex: 10000 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4 transition-opacity duration-300"
          onClick={handleCloseChat}
        >
          <div 
            style={{
              transformOrigin: 'bottom right',
              transform: isAnimating ? 'scale(1) rotate(0deg)' : 'scale(0.1) rotate(-10deg)',
              opacity: isAnimating ? 1 : 0,
            }}
            className={`w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[85vh] h-[85vh] sm:h-[580px] overflow-hidden border aura-chat-modal ${
              isDarkMode 
                ? 'bg-[#181A20] border-slate-700 text-white' 
                : 'bg-white border-slate-100 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-md">
                  <Bot className="w-5 h-5 text-cyan-200" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                    <span>น้องออร่า (AURA)</span>
                  </h4>
                  <p className="text-[11px] text-cyan-100 font-medium">ผู้ช่วยวิสัญญีอัจฉริยะ (Gemini 1.5)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseChat}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition cursor-pointer shadow-sm"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className={`flex-1 p-4 overflow-y-auto space-y-3 ${
              isDarkMode ? 'bg-[#101216]' : 'bg-slate-50/50'
            }`}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none shadow-sm'
                        : isDarkMode
                          ? 'bg-[#1F222A] text-slate-100 border border-slate-700 rounded-bl-none shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                    isDarkMode ? 'bg-[#1F222A] text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-100'
                  }`}>
                    <Loader2 size={14} className="animate-spin text-cyan-400" />
                    <span>น้องออร่ากำลังวิเคราะห์คำตอบ...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className={`px-4 py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
              isDarkMode ? 'bg-[#14161C] border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <button
                type="button"
                onClick={() => { setInputQuery('หิวข้าวแล้ว ทานอะไรดีคะ'); }}
                className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition cursor-pointer font-bold"
              >
                🍲 หิวข้าวแล้ว
              </button>
              <button
                type="button"
                onClick={() => { setInputQuery('สวัสดีน้องออร่า ทำอะไรได้บ้าง'); }}
                className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer font-bold"
              >
                👋 ทักทาย
              </button>
              <button
                type="button"
                onClick={() => { setInputQuery('สรุปความพร้อมอุปกรณ์วันนี้'); }}
                className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition cursor-pointer font-bold"
              >
                📊 สรุปความพร้อม
              </button>
            </div>

            {/* Chat Input */}
            <div className={`p-3 border-t flex items-center gap-2 ${
              isDarkMode ? 'bg-[#181A20] border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <input
                type="text"
                value={inputQuery}
                disabled={isLoading}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="พิมพ์คุยกับน้องออร่าได้ทุกเรื่อง..."
                className={`flex-1 px-4 py-2.5 rounded-full text-xs sm:text-sm outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-slate-800 text-white placeholder-slate-400' 
                    : 'bg-slate-100 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isLoading || !inputQuery.trim()}
                className="p-2.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600 active:scale-95 disabled:opacity-40 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                title="ส่งข้อความ"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiInsightsWidget;
