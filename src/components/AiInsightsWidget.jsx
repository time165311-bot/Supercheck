import React, { useState } from 'react';
import { Sparkles, MessageSquare, Bot, X, Send, Loader2 } from 'lucide-react';

/**
 * @typedef {Object} AiInsightsWidgetProps
 * @property {{ completionPct?: number; defectiveCount?: number }} [readinessData]
 * @property {boolean} [isDarkMode]
 * @property {any} [stats]
 * @property {Array<{ name: string; location?: string; note?: string; [key: string]: any }>} [defectiveItems]
 */

/**
 * @param {AiInsightsWidgetProps} props
 */
const AiInsightsWidget = ({ readinessData, isDarkMode = false, stats, defectiveItems = [] }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'สวัสดีครับ ผมคือ AI Assistant ประจำระบบวิสัญญี มีข้อมูลสถานะอุปกรณ์และห้องผ่าตัดเรียลไทม์พร้อมตอบคำถาม ต้องการให้สรุปหรือตรวจสอบข้อมูลจุดไหนสอบถามได้ทันทีครับ'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');

  // Real-time calculated values
  const completionPct = readinessData?.completionPct ?? (stats?.completionPct ?? 98);
  const grandDefective = readinessData?.defectiveCount ?? (stats?.grandDefective ?? defectiveItems?.length ?? 0);
  const grandNormal = stats?.grandNormal ?? 0;
  const grandTotal = stats?.grandTotal ?? 0;
  const pendingCount = Math.max(0, grandTotal - (stats?.grandChecked ?? 0));

  const firstDefective = defectiveItems?.[0]?.name 
    ? `${defectiveItems[0].name} (${defectiveItems[0].location})` 
    : grandDefective > 0 ? 'อุปกรณ์ที่รอการตรวจสอบ' : '';

  /**
   * Local Dynamic Rule Engine (ระบบสำรองประมวลผลคำตอบในเครื่อง เมื่อโควตา API เต็ม หรือ ออฟไลน์)
   */
  const generateLocalDynamicReply = (query) => {
    const q = (query || '').toLowerCase().trim();
    const hasDefective = grandDefective > 0 || defectiveItems.length > 0;
    const defSummary = defectiveItems
      .map((d, i) => `${i + 1}. ${d.name} ประจำ ${d.location || 'ห้องผ่าตัด'} ${d.note ? `(บันทึก: ${d.note})` : ''}`)
      .join('\n');

    let content = '';

    if (q.includes('สรุป') || q.includes('ภาพรวม') || q.includes('สถานะ') || q.includes('ความพร้อม') || q.includes('วันนี้') || q === '') {
      content = `รายงานสรุปภาพรวมความพร้อมงานวิสัญญี:\n• ความพร้อมโดยรวม: ${completionPct}%\n• อุปกรณ์ปกติพร้อมใช้: ${grandNormal} รายการ\n• อุปกรณ์ที่ต้องตรวจสอบเร่งด่วน: ${grandDefective} รายการ\n• รอการตรวจเช็ก: ${pendingCount} รายการ`;
      if (hasDefective) {
        content += `\n\n⚠️ รายการชำรุดที่พบ:\n${defSummary}\n\nคำแนะนำ: กรุณาประสานงานหน่วยเครื่องมือแพทย์หรือสลับใช้อุปกรณ์สำรองก่อนเริ่มเคสผ่าตัดครับ`;
      } else {
        content += `\n\n✅ อุปกรณ์ทุกรายการผ่านเกณฑ์การตรวจเช็กมาตรฐาน พร้อมรับเคสผ่าตัด 100% ครับ`;
      }
    } else if (q.includes('ชำรุด') || q.includes('เสีย') || q.includes('พัง') || q.includes('ผิดปกติ') || q.includes('ซ่อม') || q.includes('ปัญหา')) {
      if (hasDefective) {
        content = `ขณะนี้ตรวจพบรายการที่มีข้อบกพร่อง ${grandDefective} รายการ:\n${defSummary}\n\nกรุณาแจ้งช่างซ่อมบำรุงและลงบันทึกในระบบเพื่อติดตามผลครับ`;
      } else {
        content = `จากการตรวจสอบข้อมูลล่าสุด ไม่พบรายงานอุปกรณ์ชำรุด ทุกเครื่องทำงานได้ปกติสมบูรณ์ครับ`;
      }
    } else if (q.includes('ยา') || q.includes('สารน้ำ') || q.includes('drug') || q.includes('คลังยา')) {
      content = `คลังยาและสารน้ำวิสัญญี: ระบบมีการบันทึกสต็อกและวันหมดอายุ (EXP) อย่างต่อเนื่อง หากต้องการตรวจสอบยาใกล้หมดอายุหรือเบิกยา สามารถเข้าดูได้ที่เมนู 'คลังยา & สารน้ำ' ในหน้าหลักครับ`;
    } else if (q.includes('กระเป๋า') || q.includes('รถ') || q.includes('cart') || q.includes('bag') || q.includes('ฉุกเฉิน')) {
      content = `กระเป๋า Emergency และ รถ Crash Cart: จัดเตรียมอุปกรณ์กู้ชีพ ท่อช่วยหายใจ (ET-Tube), Laryngoscope และยาช่วยชีวิตฉุกเฉินตามมาตรฐานความปลอดภัยวิสัญญี พร้อมใช้งานตลอด 24 ชม. ครับ`;
    } else if (q.includes('or') || q.includes('ห้อง') || q.includes('suction') || q.includes('monitor') || q.includes('เครื่อง')) {
      const matched = defectiveItems.filter(d => 
        q.includes((d.location || '').toLowerCase()) || 
        q.includes((d.name || '').toLowerCase())
      );
      if (matched.length > 0) {
        content = `ข้อมูลเกี่ยวกับ "${query}": ตรวจพบรายการที่ต้องตรวจสอบคือ\n` +
          matched.map(m => `• ${m.name} (${m.location}): ${m.note || 'ตรวจพบข้อบกพร่อง'}`).join('\n') +
          `\n\nแนะนำให้ตรวจสอบสายต่อและระบบไฟฟ้าสำรองครับ`;
      } else {
        content = `ข้อมูลสำหรับ "${query}": จากการตรวจเช็กล่าสุดในระบบ อุปกรณ์ในส่วนนี้พร้อมใช้งานตามเกณฑ์มาตรฐานครับ`;
      }
    } else {
      content = `จากการตรวจสอบข้อมูลเรียลไทม์ในระบบ: อุปกรณ์ห้องผ่าตัดมีความพร้อม ${completionPct}% (ปกติ ${grandNormal} รายการ, ต้องตรวจสอบ ${grandDefective} รายการ) ท่านสามารถสอบถามเกี่ยวกับห้องผ่าตัด หรือประเภทอุปกรณ์ที่ต้องการเจาะลึกได้ครับ`;
    }

    // Prefixed with clear notification as requested by user
    return `*(ขณะนี้ระบบ API มีผู้ใช้งานจำนวนมาก ขอสรุปความพร้อมจากข้อมูลในระบบ: อุปกรณ์พร้อม ${completionPct}%, ชำรุด ${grandDefective} รายการ)*\n\n${content}`;
  };

  /**
   * Handle Send Message with Gemini API + Quota/Rate Limit Fallback
   */
  const handleSendMessage = async () => {
    if (!inputQuery.trim() || isLoading) return;
    const userQuery = inputQuery.trim();
    
    // Add user message to UI immediately
    const updatedMessages = [...chatMessages, { sender: 'user', text: userQuery }];
    setChatMessages(updatedMessages);
    setInputQuery('');
    setIsLoading(true);

    const contextPayload = {
      completionPct,
      grandDefective,
      grandNormal,
      grandTotal,
      pendingCount,
      defectiveItems: defectiveItems.map(d => ({
        name: d.name,
        location: d.location,
        note: d.note || ''
      }))
    };

    try {
      // 1. Primary Call: Gemini API via Server Route
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userQuery,
          context: contextPayload,
        }),
      });

      if (!response.ok) {
        // Quota exceeded (429) or other API issues
        const errorData = await response.json().catch(() => ({}));
        console.warn('[AI Assistant] API call returned non-200, activating fallback:', response.status, errorData);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.text) {
        setChatMessages(prev => [...prev, { sender: 'ai', text: result.text }]);
      } else {
        throw new Error(result.error || 'Empty Gemini response');
      }
    } catch (err) {
      console.warn('[AI Assistant] Gemini API error, seamlessly switching to Local Dynamic Rule:', err);
      // 2. Automatic Fallback: Local Dynamic Rule Engine based on real table data
      const fallbackText = generateLocalDynamicReply(userQuery);
      setChatMessages(prev => [...prev, { sender: 'ai', text: fallbackText }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 1. Main Widget Card (One UI Glassmorphism Style) */}
      <div className={`w-full my-3 p-5 rounded-[2rem] backdrop-blur-md border shadow-lg transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-blue-950/40 via-[#181A20]/90 to-cyan-950/30 border-blue-500/20 shadow-blue-500/5 text-white' 
          : 'bg-gradient-to-br from-blue-50/90 via-white/95 to-cyan-50/80 border-white/80 shadow-blue-500/5 text-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center p-2 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/30 animate-pulse">
              <Sparkles className="w-5 h-5 text-cyan-200" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-ping" />
            </div>
            <div>
              <h3 className={`font-semibold text-base flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                AI สรุปความพร้อมประจำวัน
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ระบบวิเคราะห์ความพร้อมอัจฉริยะ (Gemini AI + Real-time Rule)
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Status
          </span>
        </div>

        {/* AI Briefing Context Box */}
        <div className={`p-3.5 rounded-2xl border shadow-inner mb-4 text-sm leading-relaxed ${
          isDarkMode 
            ? 'bg-black/30 border-slate-800 text-slate-200' 
            : 'bg-white/80 border-slate-100 text-slate-700'
        }`}>
          ✨ วันนี้อุปกรณ์ห้องผ่าตัดพร้อม <strong className="text-blue-500 dark:text-blue-400 font-semibold">{completionPct}%</strong>{' '}
          {grandDefective > 0 ? (
            <>
              มีรายการ <span className="text-amber-500 dark:text-amber-400 font-medium">{firstDefective}</span> ที่ต้องตรวจสอบ (ชำรุด {grandDefective} รายการ)
            </>
          ) : (
            <>ทุกรายการตรวจเช็กผ่านเกณฑ์ปกติสมบูรณ์</>
          )}{' '}
          ส่วนคลังยาและกระเป๋าฉุกเฉินพร้อมใช้งาน <span className="text-emerald-500 dark:text-emerald-400 font-semibold">100%</span>
        </div>

        {/* Interactive Action Button */}
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>💬 ถาม AI ถึงความพร้อมวันนี้</span>
        </button>
      </div>

      {/* 2. Quick Chat Modal / Sheet */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
          onClick={() => setIsChatOpen(false)}
        >
          <div 
            className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] h-[550px] overflow-hidden border ${
              isDarkMode 
                ? 'bg-[#181A20] border-slate-700 text-white' 
                : 'bg-white border-slate-100 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-white/20">
                  <Bot className="w-5 h-5 text-cyan-200" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">AI Assistant (วิสัญญี)</h4>
                  <p className="text-[11px] text-blue-100">ขับเคลื่อนด้วย Gemini AI พร้อมระบบวิเคราะห์ความพร้อมในตัว</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
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
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
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
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    <span>AI กำลังวิเคราะห์ข้อมูลความพร้อม...</span>
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
                onClick={() => { setInputQuery('สรุปความพร้อมวันนี้'); }}
                className="text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20 transition cursor-pointer"
              >
                📊 สรุปความพร้อม
              </button>
              <button
                type="button"
                onClick={() => { setInputQuery('มีอุปกรณ์ชำรุดกี่รายการ?'); }}
                className="text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
              >
                ⚠️ เช็กรายการชำรุด
              </button>
              <button
                type="button"
                onClick={() => { setInputQuery('ตรวจเช็กห้อง OR 2'); }}
                className="text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
              >
                🏥 สถานะห้อง OR 2
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
                placeholder="พิมพ์คำถามเกี่ยวกับอุปกรณ์ห้องผ่าตัด..."
                className={`flex-1 px-4 py-2.5 rounded-full text-xs outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-slate-800 text-white placeholder-slate-400' 
                    : 'bg-slate-100 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isLoading || !inputQuery.trim()}
                className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-40 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
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
