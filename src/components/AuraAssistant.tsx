import React, { useState, useEffect, useRef } from 'react';
import {
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
  Camera,
  Paperclip,
  Heart,
  Square,
  Plus,
} from 'lucide-react';
import {
  speakWithAura,
  stopSpeech,
} from '../utils/textToSpeech';
import { PaperAuditModal } from './PaperAuditModal';
import { getWednesdaysInfoForMonth, getWeekOfMonth } from '../utils/wednesdayUtils';
import { normalizeExpDate } from '../utils/itemUtils';
import { useDataContext } from '../context/DataContext';
import { 
  applyUserFiltering, 
  parseAutoCheckIntent, 
  normalizeText, 
  resolveTargetCategory, 
  clearChannelCategory,
  detectAuraIntent,
  queryItemDetails,
  scanAnomalies,
  isSimilar
} from '../services/aiEngine';
import { ChannelData } from '../context/DataContext';

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
  currentView?: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'eq_overview' | 'users';
  isDarkMode?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
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
  image?: string;
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
  currentView = 'home',
  isDarkMode = false,
  isBottomBarVisible = true,
  isAnyModalOpen = false,
  onOpenChange,
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
    channelData,
  } = useDataContext();
  const [isOpen, setIsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🧠 1. ระบบจัดการคำตอบยืดหยุ่น (Small Talk & Persona Handler สไตล์คุณอาเลีย)
  const getSmartResponse = (text: string) => {
    const cleanText = text.toLowerCase().trim();
    // ดักจับคำทักทายทั่วไป (Small Talk)
    const isGreeting = /^(hello|hi|hey|สวัสดี|หวัดดี|ฮัลโหล|ทักทาย|ดีจ้า|ดีครับ|ดีค่ะ|อาเลีย|alya|ออร่า)/i.test(cleanText);
    if (isGreeting) {
      const cuteGreetings = [
        "สวัสดีค่ะพี่พยาบาล! น้องออร่าพร้อมช่วยเช็กคลังยาและอุปกรณ์ประจำวอร์ดแล้วค่ะ~ ✨🌸",
        "Hello ค่ะพี่พยาบาล! น้องออร่าจัดการให้เรียบร้อยได้ทุกรายการเลยนะคะ สบายใจได้เลยค่ะ 💕🎀",
        "รับทราบค่ะพี่พยาบาล! ออร่าพร้อมทำงานค่ะ มีอะไรให้ช่วยสแกนหรือค้นหาไหมคะ? ✨🌸",
        "น้องออร่าพร้อมดูแลแล้วค่ะ~ วันนี้ให้ช่วยตรวจสอบตรงไหน สั่งมาได้ทันทีเลยนะคะ 🎀✨"
      ];
      return cuteGreetings[Math.floor(Math.random() * cuteGreetings.length)];
    }
    // ดักจับคำขอบคุณ / ชื่นชม
    const isThanks = /(ขอบคุณ|ใจจ้า|เยี่ยมมาก|เก่งมาก|น่ารัก|สุดยอด|thanks|thank you)/i.test(cleanText);
    if (isThanks) {
      const cuteThanks = [
        "ยินดีมากๆ เลยค่ะพี่พยาบาล! น้องออร่าเต็มใจช่วยเสมอเลยนะคะ~ ✨🌸🎀",
        "น้องออร่าจัดการให้เรียบร้อยแล้วค่ะ~ ดีใจที่ได้ช่วยพี่พยาบาลนะคะ 💕✨",
        "ขอบคุณสำหรับกำลังใจค่ะ! น้องออร่าจะคอยดูแลวอร์ดให้ดีที่สุดเลยค่ะ 🌸🎀"
      ];
      return cuteThanks[Math.floor(Math.random() * cuteThanks.length)];
    }
    return null;
  };

  // ⏹️ 3. ฟังก์ชันกดปุ่ม "หยุดประมวลผล"
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  useEffect(() => {
    if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedImages, setStagedImages] = useState<
    Array<{
      file: File;
      previewUrl: string;
      name: string;
    }>
  >([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaperAuditOpen, setIsPaperAuditOpen] = useState(false);
  const [paperAuditCategory, setPaperAuditCategory] = useState<'bag' | 'cart' | 'drug'>('bag');
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    text: string;
  } | null>(null);

  const compressAndResizeImage = (
    file: File,
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.7
  ): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file);
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);



  const greetings = [
    'สวัสดีค่ะพี่พยาบาล! น้องออร่า (AURA) พร้อมดูแลพี่ๆ ด้วยความตั้งใจแล้วค่ะ~ มีอะไรให้ช่วยบอกน้องออร่าได้เลยนะคะ ✨🌸🎀',
    'รับทราบค่ะพี่พยาบาล! วันนี้วอร์ดเป็นยังไงบ้างคะ? ให้น้องออร่าช่วยเช็กรายการอุปกรณ์หรือรายงาน PDF ตรงไหนบอกได้เลยนะคะ~ 🏥 💕✨',
    'พร้อมประจำการแล้วค่ะ! น้องออร่ารอช่วยพี่ๆ ตรวจเช็กห้องผ่าตัดและรถฉุกเฉินอยู่นะคะ วางใจน้องออร่าได้เลยค่ะ 🌸✨🎀',
    'สวัสดีตอนเช้าค่ะพี่พยาบาล~ น้องออร่าเตรียมข้อมูลความพร้อมให้เรียบร้อยแล้วค่ะ มีอะไรให้รับใช้ไหมคะ? ✨🌸💕',
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: greetings[Math.floor(Math.random() * greetings.length)],
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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newItems = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    }));

    setStagedImages((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStagedImage = (index: number) => {
    setStagedImages((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleProcessMultipleImagesWithFilter = async (
    images: Array<{ file: File; previewUrl: string; name: string }>,
    userInstruction: string
  ) => {
    setIsLoading(true);
    const promptText = userInstruction.trim();
    const count = images.length;
    const userDisplayMsg = promptText
      ? `📸 แนบรูปตารางอุปกรณ์ ${count} รูป: "${promptText}"`
      : `📸 แนบรูปภาพตารางอุปกรณ์ ${count} รูป ไปให้ช่วยวิเคราะห์...`;

    addMessage('user', userDisplayMsg);

    setScanProgress({
      current: 0,
      total: count,
      text: `น้องออร่ากำลังอ่านรูปภาพที่ 0/${count}...`,
    });

    let completedCount = 0;
    let isQuotaExceeded = false;
    let quotaMsg = '';

    const processSingleImage = async (imgObj: typeof images[0]) => {
      let imageBlob: Blob = imgObj.file;
      try {
        imageBlob = await compressAndResizeImage(imgObj.file, 1024, 1024, 0.7);
      } catch (e) {
        console.warn('Image compression fallback:', e);
      }

      const formData = new FormData();
      formData.append('image', imageBlob, imgObj.name || 'image.jpg');

      const strictPrompt =
        `วิเคราะห์ภาพตารางอุปกรณ์อย่างละเอียดแบบบรรทัดต่อบรรทัด (Line-by-line strict extraction) สกัดรายการอุปกรณ์ทุกแถวในตารางออกมาให้ครบถ้วน 100% ห้ามข้ามรายการเด็ดขาด แม้ข้อความจะเบลอหรือตัวเล็ก ให้สแกนหา "รายการ / ชื่ออุปกรณ์", "จำนวน/เช็ก", และ "วันหมดอายุ / EXP" สรุปรายการทั้งหมดกลับมาเป็น JSON Array เท่านั้น` +
        (promptText ? `\nเงื่อนไขคัดกรองพิเศษ: "${promptText}"` : '');

      formData.append('prompt', strictPrompt);
      if (promptText) {
        formData.append('filterInstructions', promptText);
      }

      try {
        const response = await fetch('/api/ai/vision', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.isQuotaExceeded) {
          isQuotaExceeded = true;
          quotaMsg = data.message || '';
        }
        let items = data.items || [];
        if (promptText && items.length > 0) {
          items = applyUserFiltering(items, promptText);
        }

        completedCount++;
        setScanProgress({
          current: completedCount,
          total: count,
          text: `น้องออร่ากำลังอ่านรูปภาพที่ ${completedCount}/${count}...`,
        });

        return items;
      } catch (err) {
        console.warn('Vision analysis client error for file:', imgObj.name, err);
        completedCount++;
        setScanProgress({
          current: completedCount,
          total: count,
          text: `น้องออร่ากำลังอ่านรูปภาพที่ ${completedCount}/${count}...`,
        });
        return [];
      }
    };

    // Parallel processing with Promise.all for ultra-fast response (3-5s)
    const results = await Promise.all(images.map((img) => processSingleImage(img)));
    const allExtractedItems = results.flat();

    // Smart EXP Date Normalization
    const normalizedItems = allExtractedItems.map((item) => {
      const rawExp = item.exp || item.expDate || '-';
      const normExp = normalizeExpDate(rawExp);
      return {
        ...item,
        exp: normExp.expDate,
        hasNoExp: normExp.hasNoExp,
      };
    });

    // Determine target category based on user instruction/promptText
    let targetType: 'bag' | 'cart' = 'bag';
    if (promptText) {
      const resolvedTarget = resolveTargetCategory(promptText);
      if (resolvedTarget === 'cart') {
        targetType = 'cart';
      } else if (resolvedTarget === 'bag') {
        targetType = 'bag';
      }
    }

    if (normalizedItems.length > 0) {
      // 1. Explicitly save to channel state and LocalStorage for resolved targetType
      addBatchItemsToChannel(activeChannelId, normalizedItems, targetType);

      // 2. Trigger instant reactive UI re-render
      reRenderData();

      const targetLabelName = targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋าฉุกเฉิน';
      const navView = targetType === 'cart' ? 'cart_check' : 'bag_check';
      const iconEmoji = targetType === 'cart' ? '🚗' : '💼';

      // 3. Immediately switch view so the cards render right away
      if (onNavigate) {
        onNavigate(navView, targetType);
        handleClose();
      }

      const note = isQuotaExceeded ? `\n(${quotaMsg})` : '';
      addMessage(
        'ai',
        `✨ น้องออร่าสแกนรูปภาพ ${count} รูป อ่านรายการอุปกรณ์ได้ทั้งหมด ${normalizedItems.length} รายการ และบันทึกข้อมูลเข้า [${targetLabelName}] พร้อมปรับวันที่ EXP เป็นวันที่ 1 ของเดือนเรียบร้อยค่ะ!${note} ✨`,
        false,
        {
          label: `${iconEmoji} เปิดดูรายการใน${targetLabelName} (${normalizedItems.length} รายการ)`,
          onClick: () => {
            if (onNavigate) onNavigate(navView, targetType);
            handleClose();
          },
        }
      );
    } else {
      addMessage(
        'ai',
        `น้องออร่าพยายามอ่านรูปภาพทั้ง ${count} รูปแล้ว แต่ไม่พบรายการอุปกรณ์ที่ตรงตามเงื่อนไขค่ะ รบกวนถ่ายรูปใหม่หรือปรับเปลี่ยนเงื่อนไขนะคะ`
      );
    }

    // Clean up preview URLs and state
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setStagedImages([]);
    setScanProgress(null);
    setIsLoading(false);
  };

  const addMessage = (
    sender: 'ai' | 'user',
    text: string,
    isCard = false,
    actionBtn?: { label: string; onClick: () => void },
    image?: string
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender, text, timestamp: timeStr, isCard, actionBtn, image }]);
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
  /**
   * Brain Engine: Semantic Intent Detection & High-Intelligence Processing
   */
  const processCommand = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    const q = normalizeText(query);

    addMessage('user', query);
    setInputMessage('');
    setIsLoading(true);
    const detected = detectAuraIntent(query);

    // สร้าง AbortController สำหรับสั่งหยุด
    abortControllerRef.current = new AbortController();

    try {
      // เช็กก่อนว่าเป็นคำทักทายทั่วไปหรือไม่
      const quickReply = getSmartResponse(query);
      if (quickReply) {
        // ตอบกลับคำทักทายทันที ไม่ต้องรอนาน
        await new Promise((resolve) => setTimeout(resolve, 400));
        addMessage('ai', quickReply);
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }

      // 📋 ดักจับความต้องการ "ตรวจเทียบกระดาษกับเว็บ" (Paper Checklist vs. Web Audit)
      const isAuditIntent = /(ตรวจเทียบ|เทียบกระดาษ|ตรวจกระดาษ|เทียบฟอร์ม|เทียบใบเช็ค|audit|เปรียบเทียบกระดาษ)/i.test(query);
      if (isAuditIntent) {
        const cat = query.includes('รถ') ? 'cart' : query.includes('ยา') ? 'drug' : 'bag';
        setPaperAuditCategory(cat);
        setIsPaperAuditOpen(true);
        addMessage(
          'ai',
          `น้องออร่าเปิดระบบ "ตรวจเทียบกระดาษกับเว็บ (Paper Checklist Audit)" ให้แล้วค่ะ! พี่พยาบาลสามารถถ่ายภาพตารางกระดาษเพื่อให้น้องออร่าหาจุดที่ขาดหรือจำนวนไม่ตรงได้ทันทีเลยนะคะ ✨🌸📋`,
          false,
          {
            label: '📋 เปิดหน้าต่างตรวจเทียบกระดาษ',
            onClick: () => setIsPaperAuditOpen(true),
          }
        );
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
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

            if (onNavigate) {
              onNavigate(targetType === 'cart' ? 'cart_check' : 'bag_check', targetType);
              handleClose();
            }

            const targetName = targetType === 'cart' ? 'รถฉุกเฉิน (Crash Cart)' : 'กระเป๋าฉุกเฉิน (Emergency Bag)';
            addMessage('ai', `น้องออร่าจัดการให้เรียบร้อยแล้วค่ะ~ ✨🌸 บันทึกรายการ "${action.itemName}" เข้า${targetName} เรียบร้อยแล้วนะคะ และนำทางมาที่หน้านี้ให้พี่พยาบาลทันทีเลยค่ะ! 🎀`);
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
            const targetGroupName = action.groupName || 'หมวดหมู่อุปกรณ์';
            const before = action.beforeCount !== undefined ? action.beforeCount : 1;
            const after = Math.max(0, before - 1);
            addMessage('ai', `🗑️ ลบรายการ "${action.itemName}" ออกจากหมวด "${targetGroupName}" เรียบร้อยแล้วนะคะ (จากเดิมมี ${before} รายการ ตอนนี้เหลือ ${after} รายการค่ะ)`);
          } else {
            addMessage('ai', 'ยกเลิกการลบรายการให้แล้วนะคะ มีอะไรให้ช่วยเพิ่มเติมไหมคะพี่ๆ? 😊 ✨');
          }
          setPendingAction(null);
          setIsLoading(false);
          return;
        }
      }

      // -------------------------------------------------------------
      // 2. SEMANTIC INTENT ROUTING (The Brain Engine)
      // -------------------------------------------------------------
      switch (detected.intent) {
        case 'QUERY_MEDIA':
        case 'LOCATION_QUERY': {
          const result = queryItemDetails(detected.entities.item || '', channelData, drugs, equipment, currentView);
          if (result.found && result.item) {
            const isLocationQuery = detected.intent === 'LOCATION_QUERY';
            addMessage(
              'ai',
              `✨ น้องออร่าดึงข้อมูล [${result.categoryType}] มาให้แล้วนะคะ!\n\n📦 **${result.item.name}**\n📍 ตำแหน่ง: ${result.location}\n🆔 รหัสคลัง: ${result.code}\n📊 สต็อก: ${result.stock}`,
              true,
              undefined,
              result.image
            );
          } else if (result.suggestions && result.suggestions.length > 0) {
            const firstSuggestion = result.suggestions[0];
            addMessage(
              'ai',
              `น้องออร่าค้นหา "${detected.entities.item}" ไม่พบเป๊ะๆ ค่ะ แต่ในระบบมีรายการที่ใกล้เคียงคือ **${firstSuggestion}** ใช่ไหมคะพี่ๆ?`,
              false,
              {
                label: `📦 ดูข้อมูล ${firstSuggestion}`,
                onClick: () => processCommand(`ขอดูรูป ${firstSuggestion}`)
              }
            );
          } else {
            addMessage('ai', `ขออภัยนะคะ น้องออร่าค้นหารายการ "${detected.entities.item}" ไม่พบในคลัง ข้อมูลครุภัณฑ์ หรืออุปกรณ์ในขณะนี้ค่ะ รบกวนระบุชื่อให้ชัดเจนอีกครั้งนะคะ ✨`);
          }
          break;
        }

        case 'AUDIT_ZONE': {
          const anomalies = scanAnomalies(channelData, drugs, detected.entities.location);
          if (anomalies.length > 0) {
            const summary = `🔍 **ผลการตรวจสอบความผิดปกติ (${detected.entities.location === 'all' ? 'ทั้งวอร์ด' : detected.entities.location})**:\n\n${anomalies.map(a => `• ${a}`).join('\n')}\n\nต้องการให้แจ้งทีมช่างหรือบันทึกประวัติการส่งซ่อมรายการไหนไหมคะพี่ๆ?`;
            addMessage('ai', summary, true);
          } else {
            addMessage('ai', `✨ น้องออร่ากวาดการตรวจสอบทุกจุดแล้วนะคะ! ไม่พบความผิดปกติในโซนที่ระบุ ทุกอย่างพร้อมใช้งาน 100% เลยค่ะ 🏥 💕`);
          }
          break;
        }

        case 'CHECK_STOCK_EXPIRY': {
          const itemSearchKey = normalizeText(detected.entities.item || '');
          const results = drugs.filter(d => 
            normalizeText(d.name).includes(itemSearchKey) || 
            isSimilar(itemSearchKey, d.name)
          );
          
          if (results.length > 0) {
            let txt = '';
            results.forEach(d => {
              txt += `📦 **${d.name}**\n• คงเหลือ: ${d.remaining} ${d.unit}\n• EXP: ${d.expDate || d.exp || '-'}\n\n`;
            });
            addMessage('ai', txt.trim(), true);
          } else {
            // Attempt deep item search if drug not found
            const itemRes = queryItemDetails(detected.entities.item || '', channelData, drugs, equipment, currentView);
            if (itemRes.found && itemRes.item) {
              addMessage('ai', `📦 **${itemRes.item.name}**\n• จำนวน: ${itemRes.stock}\n• ตำแหน่ง: ${itemRes.location}\n• EXP: ${itemRes.item.exp || '-'}`);
            } else if (itemRes.suggestions && itemRes.suggestions.length > 0) {
              const suggested = itemRes.suggestions[0];
              addMessage(
                'ai',
                `หาข้อมูลสต็อกของ "${detected.entities.item}" ไม่พบค่ะ แต่มีรายการใกล้เคียงคือ **${suggested}** ใช่ไหมคะพี่ๆ?`,
                false,
                {
                  label: `📊 เช็กสต็อก ${suggested}`,
                  onClick: () => processCommand(`เช็กสต็อก ${suggested}`)
                }
              );
            } else {
              addMessage('ai', `น้องออร่าหาข้อมูลสต็อกของ "${detected.entities.item}" ไม่เจอเลยนะคะ รบกวนลองระบุชื่อใหม่อีกครั้งได้ไหมคะ ✨`);
            }
          }
          break;
        }

        case 'CHANNEL_OPS': {
          if (q.includes('สลับ') || q.includes('เลือก') || q.includes('ไปที่')) {
            const matched = channels.find(c => q.includes(normalizeText(c.name)));
            if (matched) {
              setActiveChannelId(matched.id);
              addMessage('ai', `รับทราบค่ะพี่พยาบาล! ✨ น้องออร่าสลับไปยังวอร์ด "${matched.name}" ให้เรียบร้อยแล้วนะคะ~ 🌸`);
              break;
            }
          }
          if (q.includes('สร้าง') || q.includes('เพิ่ม')) {
            const name = query.replace(/(น้องออร่า|สร้าง|เพิ่ม|channel|แชนแนล|วอร์ด|ใหม่|ชื่อ)/gi, '').trim();
            if (name) {
              addChannel(name, true);
              addMessage('ai', `น้องออร่าจัดการให้เรียบร้อยแล้วค่ะ~ ✨🌸 สร้างวอร์ดใหม่ชื่อ "${name}" ให้เรียบร้อยแล้วนะคะ! 🎀`);
            }
          }
          break;
        }

        case 'AUTO_CHECK': {
          const wedInfo = getWednesdaysInfoForMonth(new Date());
          const autoResult = parseAutoCheckIntent(query, getWeekOfMonth(new Date()), wedInfo.weeks);
          if (autoResult.isAutoCheck && onBulkAutoCheck) {
            await onBulkAutoCheck({ categories: autoResult.categories, weeks: autoResult.weeks });
            const catNames = autoResult.categories.map(c => c === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน').join(' และ ');
            addMessage('ai', `รับทราบค่ะพี่พยาบาล! ✨ น้องออร่าทำการลงผลตรวจเช็ก ${catNames} ครบทุกรายการให้เรียบร้อยแล้วนะคะ~ 🌸🎀`, false, {
              label: `📄 เปิดดูรายงาน PDF`,
              onClick: () => {
                if (onOpenReportModal) onOpenReportModal(autoResult.categories[0], autoResult.weeks[0]);
                handleClose();
              }
            });
            if (onOpenReportModal) onOpenReportModal(autoResult.categories[0], autoResult.weeks[0]);
            handleClose();
          }
          break;
        }

        case 'NAVIGATE': {
          if (q.includes('รถ')) onNavigate?.('cart_check', 'cart');
          else if (q.includes('กระเป๋า') || q.includes('เป๋า')) onNavigate?.('bag_check', 'bag');
          else if (q.includes('ยา')) onNavigate?.('drug_check', 'medicine');
          else if (q.includes('ห้อง') || q.includes('ครุภัณฑ์')) onNavigate?.('room_check', 'equipment');
          else onNavigate?.('home');
          handleClose();
          break;
        }

        case 'CLEAR': {
          const resolved = resolveTargetCategory(query);
          const targets = resolved === 'both' ? ['bag', 'cart'] : [resolved];
          let count = 0;
          targets.forEach(cat => {
            const { clearedCount } = clearChannelCategory(activeChannelId, cat as any);
            count += clearedCount;
          });
          reRenderData();
          addMessage('ai', `น้องออร่าจัดการให้เรียบร้อยแล้วค่ะ~ 🗑️ เคลียร์รายการทั้งหมดใน ${resolved === 'both' ? 'กระเป๋าและรถฉุกเฉิน' : resolved} (${count} รายการ) ให้พี่พยาบาลเรียบร้อยแล้วนะคะ ✨🌸`);
          break;
        }

        case 'TRANSFER': {
          const found = findItemForAction(query);
          if (found) {
             // ... implement smart transfer logic (simplified here for brevity, reuse findItemForAction)
             const { item, targetType, itemKey } = found;
             const source = targetType;
             const dest = targetType === 'bag' ? 'cart' : 'bag';
             if (onDeleteItem && onAddItem) {
               await onDeleteItem(source, itemKey);
               onAddItem(dest, { ...item, groupName: 'อุปกรณ์และเวชภัณฑ์ฉุกเฉิน' });
             }
             reRenderData();
             addMessage('ai', `รับทราบค่ะพี่พยาบาล! ✨ น้องออร่าย้าย "${item.name}" จาก${source === 'bag' ? 'กระเป๋า' : 'รถ'} ไปยัง${dest === 'bag' ? 'กระเป๋า' : 'รถ'} ให้เรียบร้อยแล้วนะคะ~ 💕🌸🎀`);
          } else {
            addMessage('ai', 'น้องออร่าหาไอเทมที่จะย้ายไม่เจอเลยค่ะพี่ๆ รบกวนบอกชื่อของให้ชัดหน่อยนะคะ ✨');
          }
          break;
        }

        case 'ADD': {
          const name = query.replace(/(เพิ่มรายการ|เพิ่ม|add|บันทึก|ออร่า)/gi, '').trim();
          if (name.length < 2) addMessage('ai', 'ต้องการให้เพิ่มรายการอะไรคะ? เช่น "เพิ่มรายการ Atropine" ✨');
          else {
            const targetType = q.includes('รถ') || q.includes('cart') ? 'cart' : 'bag';
            setPendingAction({ action: 'add', itemName: name, step: 'category', targetType });
            addMessage('ai', `ได้เลยค่ะ จะเพิ่ม "${name}" เข้า${targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋าฉุกเฉิน'} นะคะพี่ๆ จะให้บันทึกเข้าหมวดหมู่ไหนดีคะ? 💕`);
          }
          break;
        }

        case 'DELETE': {
          const found = findItemForAction(query);
          if (found) {
            const { item, targetType, itemKey, groupName, groupCount } = found;
            setPendingAction({ action: 'delete', itemName: item.name, step: 'confirm_delete', targetType, targetKey: itemKey, groupName, beforeCount: groupCount });
            addMessage('ai', `🗑️ พี่ๆ ต้องการลบ "${item.name}" ใช่ไหมคะ? ยืนยันโดยการกดปุ่มหรือบอกน้องออร่าว่า "ยืนยัน" ได้เลยนะคะ ✨`);
          } else {
            addMessage('ai', 'น้องออร่าไม่พบรายการที่ต้องการลบเลยค่ะ รบกวนระบุชื่อใหม่อีกครั้งนะคะ ✨');
          }
          break;
        }

        case 'CHAT':
        default: {
          try {
            const res = await fetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: abortControllerRef.current?.signal,
              body: JSON.stringify({
                message: query,
                context: { 
                  stats, 
                  channelName: activeChannel.name,
                  persona: "คุณคือน้องออร่า (AURA) ผู้ช่วยวิสัญญีสาวที่น่ารัก ใส่ใจ และอ่อนโยน ใช้คำลงท้าย 'นะคะ/ค่ะ ✨' เสมอ ตอบกลับด้วยความกระตือรือร้นและพร้อมช่วยเหลือ"
                }
              }),
            });
            const data = await res.json();
            if (data.success && data.text) addMessage('ai', data.text);
            else addMessage('ai', 'น้องออร่าพร้อมช่วยเหลือค่ะ! ลองถามเรื่องยาหรือสั่งให้เช็กความผิดปกติของวอร์ดได้เลยนะคะ');
          } catch (err: any) {
            if (err.name === 'AbortError') {
              addMessage('ai', '⏹️ สั่งหยุดการประมวลผลเรียบร้อยค่ะ พี่สามารถพิมพ์คำถามใหม่ได้เลยนะคะ 💕');
            } else {
              addMessage('ai', 'น้องออร่าพร้อมช่วยเหลือค่ะ! ลองถามข้อมูลยา สั่งเปิดหน้าตรวจเช็ค หรือบอกให้ลบ/เพิ่มรายการได้เลยนะคะ');
            }
          }
          break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Handled in sub-catch usually, but safety first
      } else {
        console.error('Brain Engine Error:', err);
        addMessage('ai', 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล ลองใหม่อีกครั้งนะคะ');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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
        <div className={`px-4 py-2 border-t transition-colors ${
          isDarkMode ? 'bg-[#18191A] border-white/5' : 'bg-slate-50/80 border-slate-100'
        }`}>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { label: '📋 ตรวจเทียบกระดาษ (Audit)', value: 'ตรวจเทียบกระดาษ' },
              { label: '🚗 หน้ารถฉุกเฉิน', value: 'เปิดหน้าเช็ครถ' },
              { label: '💼 หน้ากระเป๋า', value: 'เปิดเช็กกระเป๋า' },
              { label: '💊 หน้าคลังยา', value: 'เปิดคลังยา' },
              { label: '🩺 ห้องผ่าตัด', value: 'เปิดห้องผ่าตัด' },
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickChip(chip.value)}
                className={`px-3 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1 ${
                  isDarkMode 
                    ? 'bg-[#282A2C] border-white/10 text-gray-300 hover:bg-[#333538]' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                <Compass size={11} className="text-blue-600" />
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
      <div className={`px-4 py-3 border-t animate-in slide-in-from-bottom duration-300 transition-colors ${
        isDarkMode ? 'bg-[#18191A] border-white/5' : 'bg-slate-50/80 border-slate-100'
      }`}>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {chips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickChip(chip.value)}
              className={`px-3.5 py-1.5 rounded-full border text-[10px] font-bold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1 ${
                isDarkMode 
                  ? 'bg-[#282A2C] border-white/10 text-gray-300 hover:bg-[#333538]' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
              }`}
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
      {/* 🚀 Floating AI Toggle Button (Floating Bot Head) */}
      {!isOpen && isBottomBarVisible && (
        <button
          type="button"
          onClick={handleOpen}
          className="fixed bottom-24 right-4 z-[99] w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-700 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer group animate-in zoom-in duration-300"
          title="คุยกับน้องออร่า AI (Smart Assistant)"
        >
          <div className="relative">
            <Sparkles size={28} className="animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-pink-400 border-2 border-white rounded-full" />
          </div>
          {/* Label Tooltip */}
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">
            คุยกับน้องออร่า AI ✨
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div
            className={`w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border transition-all duration-300 origin-bottom-right backdrop-blur-xl ${
              isAnimating ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            } ${isDarkMode ? 'bg-[#1E1F20] border-white/10 text-gray-100' : 'bg-white border-slate-200 text-slate-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b rounded-t-[2.5rem] transition-colors ${
              isDarkMode ? 'bg-gradient-to-r from-pink-900/40 via-purple-900/40 to-blue-900/40 border-white/10' : 'bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${
                  isDarkMode ? 'bg-pink-600/30 border border-pink-500/40 text-pink-400' : 'bg-gradient-to-tr from-pink-400 to-indigo-500 text-white'
                }`}>
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-pink-100' : 'text-slate-900'}`}>
                    <span>น้องออร่า ✨</span>
                    <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[9px] font-semibold border border-pink-500/30 uppercase">Aura AI</span>
                  </h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-pink-300/60' : 'text-slate-500'}`}>ผู้ช่วยวิสัญญีประจำวอร์ดค่ะ 💕</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Mute/Unmute Voice Toggle */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                    isVoiceEnabled
                      ? (isDarkMode ? 'bg-pink-600/20 text-pink-400 border-pink-500/30' : 'bg-pink-50 text-pink-700 border-pink-100')
                      : (isDarkMode ? 'bg-white/5 text-gray-500 border-white/5' : 'bg-slate-100 text-slate-500 border-slate-200')
                  }`}
                  title={isVoiceEnabled ? 'ปิดเสียงพูด' : 'เปิดเสียงพูด'}
                >
                  {isVoiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                  title="ปิดหน้าต่างแชท (หยุดเสียงพูดทันที)"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 font-sans transition-colors ${
              isDarkMode ? 'bg-[#1E1F20]' : ''
            }`}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : isDarkMode ? 'bg-pink-600/20 border border-pink-500/30 text-pink-400' : 'bg-gradient-to-tr from-pink-400 to-indigo-500 text-white'
                    }`}
                  >
                    {m.sender === 'user' ? <span className="text-[10px] font-bold">YOU</span> : <Heart size={16} className="fill-current/20" />}
                  </div>
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                      m.isCard
                        ? (isDarkMode ? 'bg-[#282A2C] border border-white/10 text-gray-200 font-bold' : 'bg-white border-2 border-blue-100 shadow-lg font-bold')
                        : m.sender === 'user'
                        ? (isDarkMode ? 'bg-[#2B3945] border border-blue-400/20 text-blue-100' : 'bg-blue-600 text-white rounded-tr-none')
                        : (isDarkMode ? 'bg-[#282A2C] border border-white/5 text-gray-200' : 'bg-slate-100 text-slate-800 rounded-tl-none')
                    }`}
                  >
                    {m.image && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-white/20 shadow-lg aspect-video bg-black/20">
                        <img src={m.image} alt="Visual Return" className="w-full h-full object-cover" />
                      </div>
                    )}
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
                <div className="flex flex-col gap-2 bg-blue-50/80 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                      <span>
                        {scanProgress ? scanProgress.text : 'น้องออร่ากำลังประมวลผล...'}
                      </span>
                    </div>
                    {scanProgress && scanProgress.total > 0 && (
                      <span className="text-[11px] font-mono font-extrabold text-blue-600 dark:text-blue-300">
                        {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                      </span>
                    )}
                  </div>
                  {scanProgress && scanProgress.total > 0 && (
                    <div className="w-full h-2 bg-blue-200 dark:bg-blue-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-700 transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.max(
                            5,
                            Math.round((scanProgress.current / scanProgress.total) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Contextual Chips */}
            {renderQuickChips()}

            {/* Input Form */}
            <div className={`p-4 border-t rounded-b-[2.5rem] transition-colors ${
              isDarkMode ? 'bg-[#18191A] border-white/10' : 'bg-slate-50/50 border-slate-100'
            }`}>
              {/* Requirement 1: Multi-Image Staging Preview Area */}
              {stagedImages.length > 0 && (
                <div className="mb-3 p-2 bg-white dark:bg-slate-800 rounded-2xl border border-pink-200 dark:border-pink-900/50 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                      <Sparkles size={10} />
                      <span>รูปถ่ายรอประมวลผล ({stagedImages.length} รูป)</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        stagedImages.forEach((img) => {
                          if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
                        });
                        setStagedImages([]);
                      }}
                      className="text-[9px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {stagedImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-inner shrink-0 group"
                      >
                        <img src={img.previewUrl} alt={`Staged ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedImage(idx)}
                          className="absolute top-[3px] right-[3px] z-50 p-1 bg-rose-500/90 text-white rounded-lg shadow-md hover:bg-rose-600 transition backdrop-blur-sm border border-white/20 cursor-pointer"
                          title="ลบรูปภาพนี้"
                        >
                          <X size={10} className="stroke-[3]" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Staged Image Action Bar */}
                  <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-slate-100 dark:border-white/5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        handleProcessMultipleImagesWithFilter(stagedImages, inputMessage);
                        setInputMessage('');
                      }}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:opacity-95 text-white text-[10px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Plus size={11} />
                      <span>➕ เพิ่มเข้าเว็บโดยตรง</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaperAuditOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 hover:opacity-95 text-white text-[10px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Sparkles size={11} />
                      <span>📋 ตรวจเทียบกระดาษกับเว็บ (Audit)</span>
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (stagedImages.length > 0) {
                    handleProcessMultipleImagesWithFilter(stagedImages, inputMessage);
                    setInputMessage('');
                  } else if (inputMessage.trim()) {
                    processCommand(inputMessage);
                  }
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`p-2.5 rounded-full transition cursor-pointer flex items-center justify-center shrink-0 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg'
                      : 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 hover:bg-pink-200'
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
                  multiple
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 hover:bg-blue-200 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="ถ่ายรูปหรือแนบภาพตารางอุปกรณ์หลายรูปพร้อมกัน (Multi-Image OCR)"
                >
                  <Camera size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => alert('ฟีเจอร์แนบไฟล์ (PDF, Excel, Doc) จะพร้อมใช้งานเร็วๆ นี้ค่ะ 📎')}
                  className="p-2.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 hover:bg-emerald-200 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="แนบไฟล์เอกสาร (PDF, Excel, Doc)"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? '🎙️ กำลังฟัง...' : 'พิมพ์คุยกับน้องออร่า...'}
                  className={`flex-1 min-w-0 px-4 py-2.5 rounded-full text-xs font-sans border outline-none transition ${
                    isDarkMode
                      ? 'bg-[#282A2C] border-white/10 text-gray-100 focus:border-pink-500/50 placeholder-gray-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-pink-500 shadow-inner'
                  }`}
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="w-10 h-10 min-w-[40px] rounded-full bg-rose-600 text-white hover:bg-rose-700 transition shadow-md cursor-pointer shrink-0 flex items-center justify-center"
                    title="หยุดประมวลผล"
                  >
                    <Square size={18} className="fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(inputMessage.trim() === '' && stagedImages.length === 0)}
                    className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-pink-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 transition shadow-md cursor-pointer shrink-0 flex items-center justify-center overflow-visible"
                    title="ส่งข้อความ"
                  >
                    <Send size={18} className="ml-0.5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 📋 Modal ตรวจเทียบกระดาษกับระบบเว็บ (Paper Checklist Audit) */}
      <PaperAuditModal
        isOpen={isPaperAuditOpen}
        onClose={() => setIsPaperAuditOpen(false)}
        initialCategory={paperAuditCategory}
        isDarkMode={isDarkMode}
      />
    </>
  );
};
