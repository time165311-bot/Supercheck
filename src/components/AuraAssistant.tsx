import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  X,
  Send,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  Package,
  Calendar,
  Pill,
  Wind,
  Syringe,
  Clock,
  Compass,
  FileText,
  CheckCheck,
  Camera,
} from 'lucide-react';
import { speakWithAura, stopSpeech } from '../utils/textToSpeech';
import { getWednesdaysInfoForMonth, getWeekOfMonth } from '../utils/wednesdayUtils';
import { useDataContext } from '../context/DataContext';
import { applyUserFiltering } from '../services/aiEngine';

interface AuraAssistantProps {
  equipment?: Record<string, any[]>;
  drugs?: any[];
  lists?: any;
  stats?: any;
  onAddItem?: (type: 'bag' | 'cart', item: any) => void;
  onDeleteItem?: (type: 'bag' | 'cart', itemKey: string) => void | Promise<void>;
  onNavigate?: (
    view: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'eq_overview' | 'users',
    category?: 'medicine' | 'equipment' | 'bag' | 'cart'
  ) => void;
  onBulkAutoCheck?: (params: {
    categories: ('bag' | 'cart')[];
    weeks: number[];
  }) => Promise<{
    success: boolean;
    categories: string[];
    weeks: number[];
    datesFormatted: Record<number, string>;
    totalItemsChecked: number;
    primaryCategory?: 'bag' | 'cart';
    primaryWeek?: number;
  }>;
  onOpenReportModal?: (category?: 'bag' | 'cart' | 'eq' | 'drug', week?: number) => void;
  isDarkMode?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
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
  beforeCount?: number;
  afterCount?: number;
}

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isCard?: boolean;
  actionBtn?: {
    label: string;
    onClick: () => void;
  };
}

export const AuraAssistant: React.FC<AuraAssistantProps> = ({
  equipment = {},
  drugs = [],
  lists = {},
  stats = {},
  onAddItem,
  onDeleteItem,
  onNavigate,
  onBulkAutoCheck,
  onOpenReportModal,
  isDarkMode = false,
  isBottomBarVisible = true,
  isAnyModalOpen = false,
}) => {
  const {
    channels,
    activeChannelId,
    activeChannel,
    setActiveChannelId,
    addChannel,
    batchAddItems,
    addBatchItemsToChannel,
    reRenderData,
  } = useDataContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedImage, setStagedImage] = useState<{
    file: File;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'สวัสดีค่ะ! น้องออร่า (AURA) พร้อมดูแลพี่ๆ แล้วค่ะ จะตรวจสต็อกยา Atropine, Transamin, O2 Tank, เช็กวันหมดอายุ หรือสั่งเปิดหน้าตรวจเช็ค บอกน้องออร่าได้เลยนะคะ ✨',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Load available voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Stop speech when assistant unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Listen to Escape key to close modal & stop speech
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    if (!nextState) {
      stopSpeech();
    }
  };

  const speakText = (text: string) => {
    if (!isVoiceEnabled) {
      stopSpeech();
      return;
    }
    speakWithAura(text, voices);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setStagedImage({ file, previewUrl, name: file.name });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcessImageWithFilter = async (file: File, userInstruction: string) => {
    setIsLoading(true);
    const promptText = userInstruction.trim();
    const userDisplayMsg = promptText
      ? `📸 แนบรูปตารางอุปกรณ์: "${promptText}"`
      : '📸 แนบรูปภาพตารางอุปกรณ์ไปให้ช่วยวิเคราะห์...';

    addMessage('user', userDisplayMsg);

    const formData = new FormData();
    formData.append('image', file);
    if (promptText) {
      formData.append('prompt', promptText);
      formData.append('filterInstructions', promptText);
    }

    try {
      const response = await fetch('/api/ai/vision', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      let extractedItems = data.items || [];
      if (promptText && extractedItems.length > 0) {
        extractedItems = applyUserFiltering(extractedItems, promptText);
      }

      if (data.success && extractedItems.length > 0) {
        // 1. Explicitly save to channel state and LocalStorage
        addBatchItemsToChannel(activeChannelId, extractedItems, 'bag');

        // 2. Trigger instant reactive UI re-render
        reRenderData();

        // 3. Immediately switch view to bag_check so the cards render right away
        if (onNavigate) {
          onNavigate('bag_check', 'bag');
        }

        const note = data.isQuotaExceeded ? `\n(${data.message})` : '';
        addMessage(
          'ai',
          `✨ น้องออร่าทำการคัดกรองและเพิ่มรายการอุปกรณ์ให้ครบถ้วน ${extractedItems.length} รายการ ใน Channel [${activeChannel.name}] เรียบร้อยแล้วค่ะ!${note} ✨`,
          false,
          {
            label: `💼 เปิดดูรายการในกระเป๋าฉุกเฉิน (${extractedItems.length} รายการ)`,
            onClick: () => {
              if (onNavigate) onNavigate('bag_check', 'bag');
              handleClose();
            },
          }
        );
      } else {
        addMessage('ai', 'น้องออร่าพยายามอ่านรูปภาพแล้ว แต่ไม่พบรายการอุปกรณ์ที่ตรงตามเงื่อนไขค่ะ รบกวนถ่ายรูปใหม่หรือปรับเปลี่ยนเงื่อนไขนะคะ');
      }
    } catch (err) {
      console.warn('Vision analysis client warning:', err);
      addMessage('ai', 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพค่ะ');
    } finally {
      setIsLoading(false);
      if (stagedImage?.previewUrl) {
        URL.revokeObjectURL(stagedImage.previewUrl);
      }
      setStagedImage(null);
    }
  };

  const addMessage = (
    sender: 'ai' | 'user',
    text: string,
    isCard = false,
    actionBtn?: { label: string; onClick: () => void }
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender, text, timestamp: timeStr, isCard, actionBtn }]);
    if (sender === 'ai' && !isCard) {
      speakText(text);
    }
  };

  const findRelevantKeywords = (queryStr: string, items: string[]): string[] => {
    const q = queryStr.toLowerCase();
    return items.filter((item) => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.length <= 2) return false;
      return q.includes(lowerItem);
    });
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  /**
   * Helper to find item across cart, bag, and equipment
   */
  const findItemForAction = (queryStr: string) => {
    const q = queryStr.toLowerCase();
    const candidateItems: Array<{
      item: any;
      targetType: 'bag' | 'cart';
      groupName: string;
      index: number;
      itemKey: string;
      groupCount: number;
    }> = [];

    (['cart', 'bag'] as const).forEach((targetType) => {
      if (lists[targetType]?.groups) {
        Object.entries(lists[targetType].groups as Record<string, any[]>).forEach(([gName, gItems]) => {
          gItems.forEach((item, idx) => {
            const itemKey = item.id || `${targetType}_${gName}_${idx}`;
            candidateItems.push({
              item,
              targetType,
              groupName: gName,
              index: idx,
              itemKey,
              groupCount: gItems.length,
            });
          });
        });
      }
    });

    // Score candidates by name length and matching
    const matches = candidateItems.filter((cand) => {
      const name = (cand.item.name || '').toLowerCase();
      return name && (q.includes(name) || name.includes(q.replace(/(ลบรายการ|ลบ|เอาออก|delete|ออร่า)/gi, '').trim()));
    });

    if (matches.length > 0) {
      // Pick best matching candidate (e.g. longest name match)
      matches.sort((a, b) => (b.item.name || '').length - (a.item.name || '').length);
      return matches[0];
    }
    return null;
  };

  /**
   * Hyper-Intelligent Conversational Engine with Auto-Navigation & Smart Delete Summary
   */
  const processCommand = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    const q = query.toLowerCase();

    addMessage('user', query);
    setInputMessage('');
    setIsLoading(true);

    try {
      // -------------------------------------------------------------
      // 0. CHANNEL / WARD SWITCHING AND CREATION COMMANDS
      // -------------------------------------------------------------
      if (q.includes('channel') || q.includes('แชนแนล') || q.includes('วอร์ด')) {
        if (q.includes('สลับ') || q.includes('เลือก') || q.includes('เปลี่ยน') || q.includes('ไป')) {
          const matched = channels.find((c) =>
            q.includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(q.replace(/(สลับไป|สลับ|เปลี่ยนไป|เปลี่ยน|เลือก|channel|แชนแนล|วอร์ด|น้องออร่า)/gi, '').trim())
          );
          if (matched) {
            setActiveChannelId(matched.id);
            addMessage('ai', `✨ น้องออร่าสลับไปยัง Channel "${matched.name}" เรียบร้อยแล้วค่ะ! ข้อมูลการตรวจเช็กและตารางจะปรับเป็นของวอร์ดนี้ทันทีค่ะ 🏥`);
            setIsLoading(false);
            return;
          }
        }

        if (q.includes('สร้าง') || q.includes('เพิ่ม')) {
          const rawName = query.replace(/(น้องออร่า|สร้าง|เพิ่ม|channel|แชนแนล|วอร์ด|ใหม่|ชื่อ)/gi, '').trim();
          if (rawName) {
            const created = addChannel(rawName, true);
            addMessage('ai', `✨ น้องออร่าสร้าง Channel "${created.name}" เรียบร้อยแล้วค่ะ! พร้อมเปิดใช้งานและตรวจเช็กวอร์ดนี้ได้ทันทีค่ะ 🎉`);
            setIsLoading(false);
            return;
          }
        }
      }

      // -------------------------------------------------------------
      // 1. MULTI-TURN CLARIFICATION (ADDING / DELETING CONFIRMATION)
      // -------------------------------------------------------------
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

            const targetType = action.targetType || 'bag';
            if (onAddItem) {
              onAddItem(targetType, {
                name: action.itemName,
                groupName: action.groupName || 'เวชภัณฑ์ทั่วไป',
                qty: action.qty || '1',
                exp: expDate,
                code: 'AURA-' + Math.floor(1000 + Math.random() * 9000),
              });
            }

            // Smart Auto Navigation on Add
            if (onNavigate) {
              if (targetType === 'cart') {
                onNavigate('cart_check', 'cart');
              } else {
                onNavigate('bag_check', 'bag');
              }
            }

            const targetName = targetType === 'cart' ? 'รถฉุกเฉิน (Crash Cart)' : 'กระเป๋าฉุกเฉิน (Emergency Bag)';
            addMessage(
              'ai',
              `✅ น้องออร่าบันทึกรายการ "${action.itemName}" เข้า${targetName} เรียบร้อยแล้วค่ะ และนำทางมาที่หน้านี้ให้ทันทีแล้วค่ะ! ✨`
            );
            setPendingAction(null);
            setIsLoading(false);
            return;
          }
        }

        if (action.action === 'delete') {
          if (q.includes('ใช่') || q.includes('ยืนยัน') || q.includes('ลบ')) {
            if (onDeleteItem && action.targetType && action.targetKey) {
              await onDeleteItem(action.targetType, action.targetKey);
            }
            // Smart Delete Summary: DO NOT navigate away, report proactive count summary
            const targetGroupName = action.groupName || 'หมวดหมู่อุปกรณ์';
            const before = action.beforeCount !== undefined ? action.beforeCount : 1;
            const after = action.afterCount !== undefined ? action.afterCount : Math.max(0, before - 1);

            addMessage(
              'ai',
              `🗑️ ลบรายการ "${action.itemName}" ออกจากหมวด "${targetGroupName}" เรียบร้อยแล้วค่ะ (จากเดิมมี ${before} รายการ ตอนนี้ในหมวดเหลือ ${after} รายการค่ะ)`
            );
          } else {
            addMessage('ai', 'ยกเลิกการลบรายการค่ะ มีอะไรให้ช่วยเพิ่มเติมไหมคะ? 😊');
          }
          setPendingAction(null);
          setIsLoading(false);
          return;
        }
      }

      // -------------------------------------------------------------
      // 1.8 HYPER-INTELLIGENT SMART BULK AUTO-CHECK & DATED WEDNESDAYS
      // -------------------------------------------------------------
      const isAutoCheck =
        q.includes('ตรวจผ่าน') ||
        q.includes('เช็กผ่าน') ||
        q.includes('เช็คผ่าน') ||
        q.includes('auto-check') ||
        q.includes('auto check') ||
        (
          (q.includes('ตรวจ') || q.includes('เช็ก') || q.includes('เช็ค')) &&
          (
            q.includes('ให้หน่อย') ||
            q.includes('ให้ที') ||
            q.includes('ให้หมด') ||
            q.includes('ทั้งหมด') ||
            q.includes('สัปดาห์') ||
            q.includes('อาทิตย์') ||
            q.includes('เดือนนี้') ||
            q.includes('ปกติทุกรายการ') ||
            q.includes('ผ่านทั้งหมด')
          ) &&
          !q.includes('เปิดหน้า') &&
          !q.includes('ไปที่') &&
          !q.includes('ไปหน้า') &&
          !q.includes('เพิ่ม') &&
          !q.includes('ลบ')
        );

      if (isAutoCheck && onBulkAutoCheck) {
        // 1. Determine categories
        const hasBag = q.includes('กระเป๋า') || q.includes('bag');
        const hasCart = q.includes('รถ') || q.includes('cart');
        const hasAllCats =
          q.includes('ทั้งหมด') ||
          q.includes('ทุกหมวด') ||
          q.includes('ทุกอย่าง') ||
          (!hasBag && !hasCart);

        let targetCategories: ('bag' | 'cart')[] = [];
        if (hasAllCats || (hasBag && hasCart)) {
          targetCategories = ['bag', 'cart'];
        } else if (hasBag) {
          targetCategories = ['bag'];
        } else if (hasCart) {
          targetCategories = ['cart'];
        } else {
          targetCategories = ['bag', 'cart'];
        }

        // 2. Determine target weeks & wednesdays
        const wedInfo = getWednesdaysInfoForMonth(new Date());
        const allAvailableWeeks = wedInfo.weeks;
        const currentWeekNumber = getWeekOfMonth(new Date());

        let targetWeeks: number[] = [];

        if (
          q.includes('เดือนนี้') ||
          q.includes('ทั้งเดือน') ||
          q.includes('ทุกสัปดาห์') ||
          q.includes('ทั้งหมดของเดือน') ||
          q.includes('ครบทุกสัปดาห์')
        ) {
          targetWeeks = [...allAvailableWeeks];
        } else if (q.includes('สัปดาห์นี้') || q.includes('อาทิตย์นี้') || q.includes('week นี้')) {
          const safeWk = Math.min(currentWeekNumber, wedInfo.totalWednesdays);
          targetWeeks = [safeWk];
        } else {
          const weekMatches: number[] = [];
          const weekRegex = /(?:สัปดาห์ที่|สัปดาห์|week|อาทิตย์ที่|ที่)\s*(\d+)/gi;
          let m;
          while ((m = weekRegex.exec(q)) !== null) {
            const wNum = parseInt(m[1], 10);
            if (wNum >= 1 && wNum <= 5 && !weekMatches.includes(wNum)) {
              weekMatches.push(wNum);
            }
          }
          if (weekMatches.length === 0) {
            [1, 2, 3, 4, 5].forEach((w) => {
              if (q.includes(`ที่ ${w}`) || q.includes(`ที่${w}`) || q.includes(`w${w}`)) {
                weekMatches.push(w);
              }
            });
          }
          if (weekMatches.length > 0) {
            targetWeeks = weekMatches;
          } else {
            const safeWk = Math.min(currentWeekNumber, wedInfo.totalWednesdays);
            targetWeeks = [safeWk];
          }
        }

        targetWeeks.sort((a, b) => a - b);

        // Execute bulk auto check
        await onBulkAutoCheck({
          categories: targetCategories,
          weeks: targetWeeks,
        });

        // Format names and weeks for response
        const catNamesThai = targetCategories
          .map((c) => (c === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'))
          .join(' และ ');
        const weekStr = targetWeeks.map((w) => `สัปดาห์ที่ ${w}`).join(', ');
        const primaryCat = targetCategories[0];
        const primaryWeek = targetWeeks[0];

        const datesDesc = targetWeeks
          .map((w) => `W${w}: ${wedInfo.dates[w] || '-'}`)
          .join(', ');

        const spokenResponse = `น้องออร่าทำการตรวจผ่านอุปกรณ์ทุกรายการใน ${catNamesThai} ประจำ${weekStr} เรียบร้อยแล้วค่ะ! พร้อมลงวันที่วันพุธประจำสัปดาห์ (${datesDesc}) ครบถ้วน พี่สามารถกดเปิดดูรายงาน PDF ได้เลยนะคะ ✨`;

        addMessage('ai', spokenResponse, false, {
          label: `📄 เปิดดูรายงาน PDF (${catNamesThai} ${weekStr})`,
          onClick: () => {
            if (onOpenReportModal) {
              onOpenReportModal(primaryCat, primaryWeek);
            }
            handleClose();
          },
        });

        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 2. SMART AUTO NAVIGATION COMMANDS
      // -------------------------------------------------------------
      // Crash Cart navigation
      if (
        q.includes('เปิดหน้าเช็ครถ') ||
        q.includes('เปิดเช็ครถ') ||
        q.includes('เปิดรถฉุกเฉิน') ||
        q.includes('ไปที่รถ') ||
        q.includes('ไปหน้ารถ') ||
        q.includes('เปิด cart') ||
        q.includes('ตรวจเช็ครถ') ||
        (q.includes('เช็ครถ') && !q.includes('ลบ') && !q.includes('เพิ่ม'))
      ) {
        if (onNavigate) {
          onNavigate('cart_check', 'cart');
        }
        addMessage(
          'ai',
          '🚗 น้องออร่านำทางมาที่หน้าตรวจเช็ครถ Emergency ให้เรียบร้อยแล้วค่ะ ✨ สามารถตรวจเช็คอุปกรณ์แต่ละชั้นได้ทันทีนะคะ'
        );
        setIsLoading(false);
        return;
      }

      // Emergency Bag navigation
      if (
        q.includes('เปิดเช็กกระเป๋า') ||
        q.includes('เปิดเช็คกระเป๋า') ||
        q.includes('เปิดหน้ากระเป๋า') ||
        q.includes('เปิดกระเป๋าฉุกเฉิน') ||
        q.includes('ไปที่กระเป๋า') ||
        q.includes('ไปหน้ากระเป๋า') ||
        q.includes('เปิด bag') ||
        q.includes('ตรวจเช็กกระเป๋า') ||
        (q.includes('เช็กกระเป๋า') && !q.includes('ลบ') && !q.includes('เพิ่ม'))
      ) {
        if (onNavigate) {
          onNavigate('bag_check', 'bag');
        }
        addMessage(
          'ai',
          '💼 น้องออร่านำทางมาที่หน้าตรวจเช็กกระเป๋า Emergency ให้เรียบร้อยแล้วค่ะ ✨ สามารถตรวจสอบยาและเวชภัณฑ์ฉุกเฉินได้เลยนะคะ'
        );
        setIsLoading(false);
        return;
      }

      // Drug Inventory navigation
      if (
        q.includes('เปิดคลังยา') ||
        q.includes('เปิดสต็อกยา') ||
        q.includes('ไปที่คลังยา') ||
        q.includes('ไปหน้ายา') ||
        q.includes('เปิดหน้ายา') ||
        q.includes('ตรวจสต็อกยา') ||
        q.includes('หน้าคลังยา')
      ) {
        if (onNavigate) {
          onNavigate('drug_check', 'medicine');
        }
        addMessage(
          'ai',
          '💊 น้องออร่านำทางมาที่หน้าคลังยาและสารน้ำให้เรียบร้อยแล้วค่ะ ✨ สามารถตรวจนับยอดคงเหลือและเบิกจ่ายได้เลยนะคะ'
        );
        setIsLoading(false);
        return;
      }

      // Room equipment / OR navigation
      if (
        q.includes('เปิดห้องผ่าตัด') ||
        q.includes('เปิดหน้าครุภัณฑ์') ||
        q.includes('ไปห้องผ่าตัด') ||
        q.includes('เช็คครุภัณฑ์') ||
        q.includes('ตรวจห้องผ่าตัด') ||
        q.includes('หน้าครุภัณฑ์')
      ) {
        if (onNavigate) {
          onNavigate('room_check', 'equipment');
        }
        addMessage(
          'ai',
          '🩺 น้องออร่านำทางมาที่หน้าตรวจเช็คครุภัณฑ์ห้องผ่าตัดให้เรียบร้อยแล้วค่ะ ✨'
        );
        setIsLoading(false);
        return;
      }

      // Home / Dashboard navigation
      if (
        q.includes('กลับหน้าหลัก') ||
        q.includes('เปิดหน้าหลัก') ||
        q.includes('ไปหน้าหลัก') ||
        q.includes('กลับหน้าแรก') ||
        q.includes('ไปหน้าแรก') ||
        q.includes('dashboard')
      ) {
        if (onNavigate) {
          onNavigate('home');
        }
        addMessage(
          'ai',
          '🏠 น้องออร่านำทางกลับสู่หน้าหลัก Dashboard ให้เรียบร้อยแล้วค่ะ ✨'
        );
        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 3. INTENT: DELETE (SMART DELETE SUMMARY RESPONSE)
      // -------------------------------------------------------------
      if (q.includes('ลบ') || q.includes('delete') || q.includes('เอาออก')) {
        const found = findItemForAction(query);

        if (found) {
          const { item, targetType, groupName, itemKey, groupCount } = found;
          const beforeCount = groupCount;
          const afterCount = Math.max(0, beforeCount - 1);

          // Proactive immediate execution or confirmation
          if (onDeleteItem) {
            await onDeleteItem(targetType, itemKey);
          }

          // Exact requested format:
          // "ลบรายการ [ชื่ออุปกรณ์] ออกจาก [ชื่อหมวด] เรียบร้อยแล้วค่ะ (จากเดิมมี X รายการ ตอนนี้ในหมวดเหลือ Y รายการค่ะ)"
          // Do NOT navigate away!
          addMessage(
            'ai',
            `🗑️ ลบรายการ "${item.name}" ออกจากหมวด "${groupName}" เรียบร้อยแล้วค่ะ (จากเดิมมี ${beforeCount} รายการ ตอนนี้ในหมวดเหลือ ${afterCount} รายการค่ะ)`
          );
        } else {
          // If item name was not clearly found, ask user
          const cleanedName = query.replace(/(ลบรายการ|ลบ|เอาออก|delete|ออร่า)/gi, '').trim();
          if (cleanedName.length > 1) {
            addMessage(
              'ai',
              `น้องออร่าค้นหารายการ "${cleanedName}" ในกระเป๋าหรือรถฉุกเฉินไม่พบค่ะ รบกวนระบุชื่ออุปกรณ์ให้ชัดเจนอีกครั้งนะคะ`
            );
          } else {
            addMessage('ai', 'ต้องการให้ลบรายการอะไรคะ? เช่น "ลบรายการ Atropine"');
          }
        }
        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 4. INTENT: ADD
      // -------------------------------------------------------------
      if (q.includes('เพิ่ม') || q.includes('add') || q.includes('บันทึก')) {
        const name = query.replace(/(เพิ่มรายการ|เพิ่ม|add|บันทึก|ออร่า)/gi, '').trim();
        if (name.length < 2) {
          addMessage('ai', 'ต้องการเพิ่มรายการอะไรคะ? เช่น "เพิ่มรายการ Atropine"');
        } else {
          const targetType: 'bag' | 'cart' = q.includes('รถ') || q.includes('cart') ? 'cart' : 'bag';
          setPendingAction({
            action: 'add',
            itemName: name,
            step: 'category',
            targetType,
          });
          addMessage(
            'ai',
            `ได้เลยค่ะ จะเพิ่ม "${name}" เข้า${targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋าฉุกเฉิน'} นะคะ ต้องการบันทึกเข้าหมวดหมู่ไหนคะ?`
          );
        }
        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 5. INTENT: QUERY STOCK / EXP
      // -------------------------------------------------------------
      const drugNames = drugs.map((d) => d.name);
      const matchedDrugs = findRelevantKeywords(q, drugNames);

      if (
        matchedDrugs.length > 0 &&
        (q.includes('สต็อก') ||
          q.includes('เหลือ') ||
          q.includes('เช็ก') ||
          q.includes('มีไหม') ||
          q.includes('หมดอายุ') ||
          q.includes('exp'))
      ) {
        let resultsText = '';
        matchedDrugs.forEach((name) => {
          const d = drugs.find((item) => item.name === name);
          if (d) {
            resultsText += `📦 ${d.name}\n• คงเหลือ: ${d.remaining || d.qty || 0} ${d.unit || 'Amp'}\n• EXP: ${d.expDate || d.exp || 'ไม่ระบุ'}\n\n`;
          }
        });
        addMessage('ai', resultsText.trim(), true);
        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 6. INTENT: CASE PREP
      // -------------------------------------------------------------
      if (q.includes('เตรียมเคส') || q.includes('case') || q.includes('เคส')) {
        if (q.includes('เด็ก')) {
          addMessage(
            'ai',
            `👶 **Checklist เตรียมเคสเด็ก**\n• Airway: Laryngoscope (0,1,2), ET Tube 3.0-4.5\n• Drugs: Atropine (0.02 mg/kg), Ketamine (1-2 mg/kg)\n\nมีอะไรให้ช่วยเตรียมเพิ่มไหมคะ?`,
            true
          );
        } else if (q.includes('ทราเคีย') || q.includes('airway') || q.includes('ยาก')) {
          addMessage(
            'ai',
            `🚨 **Checklist Difficult Airway**\n• Airway: Video Laryngoscope, Stylet, Bougie\n• Supraglottic: i-gel/LMA (3,4,5)\n• Pressors: Adrenaline, Ephedrine`,
            true
          );
        } else {
          addMessage(
            'ai',
            'น้องออร่าช่วยเตรียม Checklist ได้ค่ะ ลองสั่ง "เตรียมเคสเด็ก" หรือ "เตรียมเคสทราเคีย" ได้นะคะ'
          );
        }
        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 7. DEFAULT: BACKEND AI PROXY
      // -------------------------------------------------------------
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
          addMessage('ai', 'รับทราบค่ะ! มีอะไรให้น้องออร่าช่วยตรวจเช็คอีกไหมคะ? ✨');
        }
      } catch (err) {
        addMessage('ai', 'น้องออร่าพร้อมช่วยเหลือค่ะ! ถามข้อมูลยา สั่งเปิดหน้าตรวจเช็ค หรือบอกให้ลบ/เพิ่มรายการได้เลยนะคะ');
      }
    } catch (err: any) {
      console.error('Command processing error:', err);
      addMessage('ai', 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล ลองใหม่อีกครั้งนะคะ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => setIsAnimating(true), 10);

    let expiredCount = 0;
    const criticalStock: any[] = [];
    drugs.forEach((d: any) => {
      const exp = d.expDate || d.exp;
      if (exp && new Date(exp) < new Date()) expiredCount++;
      const balance = Number(d.remaining || d.qty || 0);
      if (balance > 0 && balance <= 2) criticalStock.push(d);
    });

    if (messages.length === 1) {
      if (expiredCount > 0 || criticalStock.length > 0) {
        const riskAlertText = `🚨 **แจ้งเตือนความเสี่ยง**\nพบของหมดอายุ ${expiredCount} รายการ และสต็อกวิกฤต ${criticalStock.length} รายการ (เช่น ${criticalStock.slice(0, 2).map((d) => d.name).join(', ')}) ต้องการให้สรุปรายละเอียดไหมคะ?`;
        addMessage('ai', riskAlertText, true);
      } else {
        const greeting =
          'สวัสดีค่ะ! วันนี้น้องออร่าตรวจสอบระบบแล้ว ทุกอย่างพร้อมใช้งานค่ะ มีเคสไหนให้ช่วยเตรียม หรือจะให้เปิดหน้าตรวจเช็คไหมคะ? ✨';
        addMessage('ai', greeting);
      }
    }
  };

  // Requirement 2: Stop speech immediately when chat is closed
  const handleClose = () => {
    stopSpeech();
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 300);
  };

  const handleQuickChip = (value: string) => {
    processCommand(value);
  };

  const renderQuickChips = () => {
    if (!pendingAction) {
      // Default navigation helper chips
      return (
        <div className="px-4 py-2 bg-slate-50/80 dark:bg-white/5 border-t border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { label: '🚗 หน้ารถฉุกเฉิน', value: 'เปิดหน้าเช็ครถ' },
              { label: '💼 หน้ากระเป๋า', value: 'เปิดเช็กกระเป๋า' },
              { label: '💊 หน้าคลังยา', value: 'เปิดคลังยา' },
              { label: '🩺 ห้องผ่าตัด', value: 'เปิดห้องผ่าตัด' },
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickChip(chip.value)}
                className="px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap hover:bg-purple-50 hover:border-purple-300 transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Compass size={11} className="text-purple-600" />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

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
      {!isOpen && !isAnyModalOpen && (
        <div
          className="fixed z-[99] select-none"
          style={{ right: '16px', bottom: '140px' }}
        >
          <button
            type="button"
            onClick={handleOpen}
            className="w-13 h-13 flex items-center justify-center bg-gradient-to-br from-purple-500 to-cyan-400 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-white/20"
            title="คุยกับน้องออร่า AI"
          >
            <Sparkles size={22} className="animate-pulse" />
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div
            className={`w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border transition-all duration-300 origin-bottom-right ${
              isAnimating ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            } ${isDarkMode ? 'bg-[#181A20] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            onClick={(e) => e.stopPropagation()}
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
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Smart Voice & Auto-Navigation Engine
                  </p>
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
                  title={isVoiceEnabled ? 'ปิดเสียงพูด' : 'เปิดเสียงพูด'}
                >
                  {isVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>{isVoiceEnabled ? '🔊 เปิดเสียง' : '🔇 ปิดเสียง'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                  title="ปิดหน้าต่างแชท (หยุดเสียงพูดทันที)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white'
                    }`}
                  >
                    {m.sender === 'user' ? <span className="text-[10px] font-bold">YOU</span> : <Bot size={16} />}
                  </div>
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                      m.isCard
                        ? 'bg-white dark:bg-slate-800 border-2 border-purple-100 dark:border-purple-900/50 shadow-lg font-bold'
                        : m.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                    }`}
                  >
                    <p>{m.text}</p>
                    {m.actionBtn && (
                      <button
                        type="button"
                        onClick={m.actionBtn.onClick}
                        className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>{m.actionBtn.label}</span>
                      </button>
                    )}
                    <span
                      className={`block text-[9px] mt-1 text-right ${
                        m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
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

            {/* Input Form */}
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
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-lg'
                      : 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 hover:bg-purple-200'
                  }`}
                  title={isListening ? 'หยุดฟัง' : 'สั่งการด้วยเสียง'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 hover:bg-purple-200 transition cursor-pointer flex items-center justify-center"
                  title="ถ่ายรูปหรือแนบภาพตารางอุปกรณ์ (OCR Vision)"
                >
                  <Camera size={18} />
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? '🎙️ กำลังฟัง...' : 'พิมพ์คำสั่ง เช่น "เปิดเช็ครถ", "ลบ Atropine"...'}
                  className={`flex-1 px-4 py-3 rounded-2xl text-xs font-sans border outline-none transition ${
                    isDarkMode
                      ? 'bg-slate-800 border-white/10 text-white focus:border-purple-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-purple-500 shadow-inner'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition shadow-md cursor-pointer"
                  title="ส่งข้อความ"
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
