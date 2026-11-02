import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Mic, MicOff, Sparkles, Volume2, VolumeX, Trash2, PlusCircle, CheckCircle2, Package, AlertCircle, Calendar, Pill, Wind, Syringe, ClipboardList, Clock, Info } from 'lucide-react';

interface AuraAssistantProps {
  equipment?: Record<string, any[]>;
  drugs?: any[];
  lists?: any;
  stats?: any;
  onAddItem?: (type: 'bag' | 'cart', item: any) => void;
  onDeleteItem?: (type: 'bag' | 'cart', itemKey: string) => void | Promise<void>;
  isDarkMode?: boolean;
}

type StepType = 'idle' | 'category' | 'quantity' | 'exp' | 'confirm_delete';

interface PendingAction {
  action: 'add' | 'delete';
  itemName: string;
  step: StepType;
  groupName?: string;
  qty?: string;
  exp?: string;
  targetType?: 'bag' | 'cart';
  targetKey?: string;
}

export const AuraAssistant: React.FC<AuraAssistantProps> = ({
  equipment = {},
  drugs = [],
  lists = {},
  stats = {},
  onAddItem,
  onDeleteItem,
  isDarkMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; timestamp: string; isCard?: boolean }>>([
    {
      sender: 'ai',
      text: 'สวัสดีค่ะ! น้องออร่า (AURA) พร้อมดูแลพี่ๆ แล้วค่ะ จะตรวจสต็อกยา Atropine, Transamin, O2 Tank, เช็กวันหมดอายุ หรือเตรียมเคสฉุกเฉิน บอกน้องออร่าได้เลยนะคะ 🎤✨',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'th-TH';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const speechText = event.results[0][0].transcript;
        setInputMessage('');
        setIsListening(false);
        processCommand(speechText);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [equipment, drugs, lists, pendingAction]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert('เบราว์เซอร์นี้ไม่รองรับระบบสั่งการด้วยเสียง (Speech Recognition)');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Speech recognition start error:', e);
        setIsListening(false);
      }
    }
  };

  const handleToggleVoice = () => {
    const nextState = !isVoiceEnabled;
    setIsVoiceEnabled(nextState);
    if (!nextState && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text: string) => {
    // [Mute logic]: Stop TTS completely if muted
    if (!isVoiceEnabled || !('speechSynthesis' in window)) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_💉📊🚨🎉💡⏳📦👶•]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.05;
      utterance.pitch = 1.2;
      // [CRITICAL UPDATE]: Set volume to 50%
      utterance.volume = 0.5;

      const thaiVoices = voices.filter((v) => v.lang.includes('th') || v.lang.includes('TH'));
      const femaleVoice = thaiVoices.find(
        (v) =>
          v.name.includes('Female') ||
          v.name.includes('Wan') ||
          v.name.includes('Kanya') ||
          v.name.includes('Google') ||
          v.name.includes('Prem') ||
          v.name.includes('หญิง') ||
          v.name.includes('Narisa')
      ) || thaiVoices[0];

      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const addMessage = (sender: 'ai' | 'user', text: string, isCard = false) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender, text, timestamp: timeStr, isCard }]);
    if (sender === 'ai' && !isCard) {
      speakText(text);
    }
  };

  const findRelevantKeywords = (query: string, items: string[]): string[] => {
    const q = query.toLowerCase();
    return items.filter(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.length <= 2) return false;
      // Use word boundaries or strict matching to avoid partial spills
      return q.includes(lowerItem);
    });
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  /**
   * Hyper-Intelligent Conversational Engine
   */
  const processCommand = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    addMessage('user', query);
    setInputMessage('');
    setIsLoading(true);

    try {
      const q = query.toLowerCase();

      // Multi-turn clarification handling
      if (pendingAction) {
        const action = { ...pendingAction };

        if (action.action === 'add') {
          if (action.step === 'category') {
            if (q.includes('ยา') || q.includes('สารน้ำ')) action.groupName = 'เวชภัณฑ์และสารน้ำ (Solutions & Dressing)';
            else if (q.includes('หายใจ') || q.includes('แอร์เวย์') || q.includes('airway')) action.groupName = 'อุปกรณ์ช่วยหายใจ (Airway)';
            else if (q.includes('ฉีดยา') || q.includes('iv')) action.groupName = 'อุปกรณ์ให้สารน้ำและฉีดยา (IV & Injection)';
            else if (q.includes('ครุภัณฑ์') || q.includes('ทั่วไป')) action.groupName = 'ครุภัณฑ์ทั่วไป';
            else action.groupName = query;

            action.step = 'quantity';
            setPendingAction(action);
            addMessage('ai', `บันทึกเข้าหมวด "${action.groupName}" นะคะ ต้องการจำนวนตั้งต้นกี่ชิ้นคะ?`);
            setIsLoading(false);
            return;
          }

          if (action.step === 'quantity') {
            const numMatch = q.match(/(\d+)/);
            action.qty = numMatch ? numMatch[1] : query;
            action.step = 'exp';
            setPendingAction(action);
            addMessage('ai', `จำนวน ${action.qty} ชิ้นค่ะ มีวันหมดอายุไหมคะ? เลือกจากปุ่มหรือบอกวันที่ได้เลยค่ะ`);
            setIsLoading(false);
            return;
          }

          if (action.step === 'exp') {
            let expDate = '-';
            if (q.includes('6 เดือน')) {
              const d = new Date();
              d.setMonth(d.getMonth() + 6);
              expDate = formatDate(d);
            } else if (q.includes('1 ปี')) {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              expDate = formatDate(d);
            } else if (q.includes('ไม่มี') || q.includes('no')) {
              expDate = '-';
            } else if (q.match(/\d{4}-\d{2}-\d{2}/)) {
              expDate = q;
            }

            if (onAddItem) {
              onAddItem(action.targetType || 'bag', {
                name: action.itemName,
                groupName: action.groupName || 'เวชภัณฑ์ทั่วไป',
                qty: action.qty || '1',
                exp: expDate,
                code: 'AURA-' + Math.floor(1000 + Math.random() * 9000),
              });
            }

            addMessage('ai', `✅ น้องออร่าบันทึกรายการ "${action.itemName}" เรียบร้อยแล้วค่ะ! ✨`);
            setPendingAction(null);
            setIsLoading(false);
            return;
          }
        }

        if (action.action === 'delete') {
          if (q.includes('ใช่') || q.includes('ยืนยัน') || q.includes('ลบ')) {
            if (onDeleteItem) {
              await onDeleteItem(action.targetType!, action.targetKey!);
            }
            addMessage('ai', `🗑️ ลบรายการ "${action.itemName}" จาก${action.targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋า'}เรียบร้อยแล้วค่ะ`);
          } else {
            addMessage('ai', 'ยกเลิกการลบรายการค่ะ มีอะไรให้ช่วยเพิ่มไหมคะ?');
          }
          setPendingAction(null);
          setIsLoading(false);
          return;
        }
      }

      // Intent: ADD
      if (q.includes('เพิ่ม') || q.includes('add') || q.includes('บันทึก')) {
        let name = query.replace(/(เพิ่มรายการ|เพิ่ม|add|บันทึก|ออร่า)/gi, '').trim();
        if (name.length < 2) {
          addMessage('ai', 'ต้องการเพิ่มรายการอะไรคะ? เช่น "เพิ่มรายการ Atropine"');
        } else {
          setPendingAction({
            action: 'add',
            itemName: name,
            step: 'category',
            targetType: q.includes('รถ') || q.includes('cart') ? 'cart' : 'bag',
          });
          addMessage('ai', `ได้เลยค่ะ จะเพิ่ม "${name}" นะคะ ต้องการบันทึกเข้าหมวดหมู่ไหนคะ?`);
        }
        setIsLoading(false);
        return;
      }

      // Intent: DELETE
      if (q.includes('ลบ') || q.includes('delete') || q.includes('เอาออก')) {
        const targetType: 'bag' | 'cart' = q.includes('รถ') || q.includes('cart') ? 'cart' : 'bag';
        const allItems: any[] = [];
        if (lists[targetType]?.groups) {
          Object.entries(lists[targetType].groups as Record<string, any[]>).forEach(([gName, gItems]) => {
            gItems.forEach((item, idx) => {
              allItems.push({ ...item, groupName: gName, index: idx });
            });
          });
        }

        const targetItem = allItems.find(item => item.name && q.includes(item.name.toLowerCase()) && item.name.length > 3);
        
        if (targetItem) {
          const itemKey = targetItem.id || `${targetType}_${targetItem.groupName}_${targetItem.index}`;
          setPendingAction({
            action: 'delete',
            itemName: targetItem.name,
            step: 'confirm_delete',
            targetType,
            targetKey: itemKey,
          });
          addMessage('ai', `⚠️ ยืนยันการลบ "${targetItem.name}" จาก${targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋า'} ใช่หรือไม่คะ?`);
        } else {
          addMessage('ai', 'ไม่พบรายการที่ต้องการลบในระบบค่ะ ลองบอกชื่อรายการให้ชัดเจนขึ้นนะคะ');
        }
        setIsLoading(false);
        return;
      }

      // Intent: QUERY STOCK / EXP
      const drugNames = drugs.map(d => d.name);
      const matchedDrugs = findRelevantKeywords(q, drugNames);

      if (matchedDrugs.length > 0 && (q.includes('สต็อก') || q.includes('เหลือ') || q.includes('เช็ก') || q.includes('มีไหม') || q.includes('หมดอายุ') || q.includes('exp'))) {
        let resultsText = '';
        matchedDrugs.forEach(name => {
          const d = drugs.find(item => item.name === name);
          if (d) {
            resultsText += `📦 ${d.name}\n• คงเหลือ: ${d.balance || d.qty || 0} ${d.unit || 'Amp'}\n• EXP: ${d.exp || 'ไม่ระบุ'}\n\n`;
          }
        });
        addMessage('ai', resultsText, true);
        setIsLoading(false);
        return;
      }

      // Intent: CASE PREP
      if (q.includes('เตรียมเคส') || q.includes('case') || q.includes('เคส')) {
        if (q.includes('เด็ก')) {
          addMessage('ai', `👶 **Checklist เตรียมเคสเด็ก**\n• Airway: Laryngoscope (0,1,2), ET Tube 3.0-4.5\n• Drugs: Atropine (0.02 mg/kg), Ketamine (1-2 mg/kg)\n\nมีอะไรให้ช่วยเตรียมเพิ่มไหมคะ?`, true);
        } else if (q.includes('ทราเคีย') || q.includes('airway') || q.includes('ยาก')) {
          addMessage('ai', `🚨 **Checklist Difficult Airway**\n• Airway: Video Laryngoscope, Stylet, Bougie\n• Supraglottic: i-gel/LMA (3,4,5)\n• Pressors: Adrenaline, Ephedrine`, true);
        } else {
          addMessage('ai', 'น้องออร่าช่วยเตรียม Checklist ได้ค่ะ ลองสั่ง "เตรียมเคสเด็ก" หรือ "เตรียมเคสทราเคีย" ได้นะคะ');
        }
        setIsLoading(false);
        return;
      }

      // Default: Backend AI
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            context: {
              completionPct: stats.completionPct || 98,
              grandChecked: stats.grandChecked || 0,
              grandTotal: stats.grandTotal || 0,
              grandNormal: stats.grandNormal || 0,
              grandDefective: stats.grandDefective || 0,
            },
          }),
        });
        const data = await res.json();
        if (data && data.success && data.text) {
          addMessage('ai', data.text);
        } else {
          addMessage('ai', `รับทราบค่ะ! มีอะไรให้น้องออร่าช่วยวิสัญญีอีกไหมคะ? 😊`);
        }
      } catch (err) {
        addMessage('ai', 'น้องออร่าพร้อมช่วยเหลือค่ะ! ถามข้อมูลยาหรืออุปกรณ์ได้เลยนะคะ');
      }
    } catch (err: any) {
      console.error('Command processing error:', err);
      addMessage('ai', 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล ลองใหม่อีกครั้งนะคะ 🙏');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => setIsAnimating(true), 10);

    let expiredCount = 0;
    let criticalStock: any[] = [];
    drugs.forEach((d: any) => {
      if (d.exp && new Date(d.exp) < new Date()) expiredCount++;
      const balance = Number(d.balance || d.qty || 0);
      if (balance > 0 && balance <= 2) criticalStock.push(d);
    });

    if (messages.length === 1) {
      if (expiredCount > 0 || criticalStock.length > 0) {
        const riskAlertText = `🚨 **แจ้งเตือนความเสี่ยง**\nพบของหมดอายุ ${expiredCount} รายการ และสต็อกวิกฤต ${criticalStock.length} รายการ (เช่น ${criticalStock.slice(0, 2).map(d => d.name).join(', ')}) ต้องการให้สรุปรายละเอียดไหมคะ?`;
        addMessage('ai', riskAlertText, true);
      } else {
        const greeting = 'สวัสดีค่ะ! วันนี้น้องออร่าตรวจสอบระบบแล้ว ทุกอย่างปกติค่ะ มีเคสไหนให้ช่วยเตรียมไหมคะ? 🎤✨';
        addMessage('ai', greeting);
      }
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 300);
  };

  const handleQuickChip = (value: string) => {
    processCommand(value);
  };

  const renderQuickChips = () => {
    if (!pendingAction) return null;

    let chips: Array<{ label: string; value: string; icon?: React.ReactNode }> = [];

    if (pendingAction.step === 'category') {
      chips = [
        { label: '🧪 ยาและสารน้ำ', value: 'ยาและสารน้ำ', icon: <Pill size={12} /> },
        { label: '🫁 อุปกรณ์ช่วยหายใจ', value: 'อุปกรณ์ช่วยหายใจ', icon: <Wind size={12} /> },
        { label: '💉 อุปกรณ์ฉีดยา', value: 'อุปกรณ์ฉีดยา', icon: <Syringe size={12} /> },
        { label: '🩺 ครุภัณฑ์', value: 'ครุภัณฑ์', icon: <Package size={12} /> },
      ];
    } else if (pendingAction.step === 'quantity') {
      chips = [
        { label: '1 ชิ้น', value: '1 ชิ้น' },
        { label: '2 ชิ้น', value: '2 ชิ้น' },
        { label: '5 ชิ้น', value: '5 ชิ้น' },
        { label: '10 ชิ้น', value: '10 ชิ้น' },
      ];
    } else if (pendingAction.step === 'exp') {
      chips = [
        { label: '⏳ +6 เดือน', value: 'บวก 6 เดือน', icon: <Clock size={12} /> },
        { label: '🗓️ +1 ปี', value: 'บวก 1 ปี', icon: <Calendar size={12} /> },
        { label: '❌ ไม่มีวันหมดอายุ', value: 'ไม่มีวันหมดอายุ' },
      ];
    } else if (pendingAction.step === 'confirm_delete') {
      chips = [
        { label: '✅ ใช่ ยืนยันการลบ', value: 'ใช่ ยืนยันการลบ' },
        { label: '❌ ไม่ ยกเลิก', value: 'ไม่ใช่ ยกเลิกก่อน' },
      ];
    }

    if (chips.length === 0) return null;

    return (
      <div className="px-4 py-3 bg-slate-50/80 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {chips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickChip(chip.value)}
              className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap hover:bg-purple-50 hover:border-purple-300 transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={handleOpen}
          className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-white/25"
        >
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
          </span>
          <Bot size={22} className="animate-bounce" />
          <span className="text-xs font-bold tracking-wide font-sans">น้องออร่า AI</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border transition-all duration-300 transform ${
              isAnimating ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95'
            } ${isDarkMode ? 'bg-[#181A20] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                  <Bot size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <span>น้องออร่า AI</span>
                    <Sparkles size={14} className="text-pink-500 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Hyper-Intelligent Conversational Engine</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                    isVoiceEnabled
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200'
                  }`}
                >
                  {isVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>{isVoiceEnabled ? '🔊 เปิดเสียง' : '🔇 ปิดเสียง'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    m.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white'
                  }`}>
                    {m.sender === 'user' ? <span className="text-[10px] font-bold">YOU</span> : <Bot size={16} />}
                  </div>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                    m.isCard ? 'bg-white dark:bg-slate-800 border-2 border-purple-100 dark:border-purple-900/50 shadow-lg font-bold' :
                    m.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                  }`}>
                    <p>{m.text}</p>
                    <span className={`block text-[9px] mt-1 text-right ${m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 animate-spin">
                    <Sparkles size={14} />
                  </div>
                  <span>น้องออร่ากำลังประมวลผล...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Contextual Chips */}
            {renderQuickChips()}

            {/* Input */}
            <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-[2.5rem]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  processCommand(inputMessage);
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`p-3 rounded-2xl transition cursor-pointer flex items-center justify-center ${
                    isListening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 hover:bg-purple-200'
                  }`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? '🎙️ กำลังฟัง...' : 'พิมพ์คำสั่ง หรือถามข้อมูล...'}
                  className={`flex-1 px-4 py-3 rounded-2xl text-xs font-sans border outline-none transition ${
                    isDarkMode ? 'bg-slate-800 border-white/10 text-white focus:border-purple-500' : 'bg-white border-slate-200 text-slate-900 focus:border-purple-500 shadow-inner'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition shadow-md cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
