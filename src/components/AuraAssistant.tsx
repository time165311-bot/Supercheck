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
import { normalizeExpDate } from '../utils/itemUtils';
import { useDataContext } from '../context/DataContext';
import { applyUserFiltering, parseAutoCheckIntent, normalizeText, resolveTargetCategory, clearChannelCategory } from '../services/aiEngine';

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
  } = useDataContext();
  const [isOpen, setIsOpen] = useState(false);

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
              handleClose(); // Auto-close chat after navigation
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
      // 1.2 CLEAR ALL ITEMS COMMAND (ลบของในเป๋า/รถทั้งหมด)
      // -------------------------------------------------------------
      const isClearAllCmd =
        (q.includes('ลบ') || q.includes('เคลียร์') || q.includes('clear')) &&
        (q.includes('ทั้งหมด') || q.includes('ตาราง') || q.includes('ทุกอย่าง') || q.includes('ยกชุด') || q.includes('หมด'));

      if (isClearAllCmd) {
        const resolvedTarget = resolveTargetCategory(query);
        let targetsToClear: ('bag' | 'cart')[] = [];
        if (resolvedTarget === 'both') {
          targetsToClear = ['bag', 'cart'];
        } else {
          targetsToClear = [resolvedTarget];
        }

        let totalCleared = 0;
        targetsToClear.forEach((cat) => {
          const { clearedCount } = clearChannelCategory(activeChannelId, cat);
          totalCleared += clearedCount;
        });

        reRenderData();

        const namesThai = targetsToClear
          .map((c) => (c === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'))
          .join(' และ ');

        addMessage(
          'ai',
          `🗑️ น้องออร่าทำการเคลียร์รายการอุปกรณ์ใน ${namesThai} ทั้งหมด (ลบออก ${totalCleared} รายการ) เพื่อให้พี่ๆ ตั้งต้นใหม่เรียบร้อยแล้วค่ะ! ✨`
        );

        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 1.5 SMART TRANSFER & DEDUPLICATION (ย้ายของ/สลับของ)
      // -------------------------------------------------------------
      const isTransferCmd =
        q.includes('ย้าย') ||
        q.includes('สลับ') ||
        q.includes('transfer') ||
        (q.includes('จาก') && (q.includes('ไป') || q.includes('เข้า'))) ||
        (q.includes('ไม่ใช่ใน') && (q.includes('แอด') || q.includes('เพิ่ม') || q.includes('ใส่')));

      if (isTransferCmd) {
        let sourceType: 'bag' | 'cart' = 'bag';
        let targetType: 'bag' | 'cart' = 'cart';

        if (
          q.includes('จากรถ') ||
          q.includes('จาก cart') ||
          q.includes('ในรถไม่ใช่') ||
          q.includes('รถไปกระเป๋า') ||
          q.includes('รถไปเป๋า')
        ) {
          sourceType = 'cart';
          targetType = 'bag';
        } else if (
          q.includes('จากกระเป๋า') ||
          q.includes('จากเป๋า') ||
          q.includes('จาก bag') ||
          q.includes('ในเป๋าไม่ใช่') ||
          q.includes('กระเป๋าไปรถ') ||
          q.includes('เป๋าไปรถ')
        ) {
          sourceType = 'bag';
          targetType = 'cart';
        } else {
          const resolvedTarget = resolveTargetCategory(query);
          if (resolvedTarget === 'cart') {
            sourceType = 'bag';
            targetType = 'cart';
          } else if (resolvedTarget === 'bag') {
            sourceType = 'cart';
            targetType = 'bag';
          }
        }

        const sourceName = sourceType === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน';
        const targetName = targetType === 'cart' ? 'รถฉุกเฉิน' : 'กระเป๋าฉุกเฉิน';

        // Search for item to transfer
        const found = findItemForAction(query);

        if (found) {
          const { item: sourceItem, itemKey: sourceKey, groupName: sourceGroupName } = found;

          // Check for duplicate item in target
          let duplicateInTarget: { item: any; groupName: string; itemKey: string } | null = null;
          if (lists[targetType]?.groups) {
            Object.entries(lists[targetType].groups as Record<string, any[]>).forEach(([gName, gItems]) => {
              gItems.forEach((tItem, idx) => {
                const tName = (tItem.name || '').toLowerCase().trim();
                const sName = (sourceItem.name || '').toLowerCase().trim();
                if (tName === sName || (tItem.code && sourceItem.code && tItem.code === sourceItem.code)) {
                  duplicateInTarget = {
                    item: tItem,
                    groupName: gName,
                    itemKey: tItem.id || `${targetType}_${gName}_${idx}`,
                  };
                }
              });
            });
          }

          const dupe = duplicateInTarget as { item: any; groupName: string; itemKey: string } | null;
          if (dupe) {
            const targetItem = dupe.item;
            const sourceExpStr = sourceItem.expDate || sourceItem.exp || '';
            const targetExpStr = targetItem.expDate || targetItem.exp || '';
            const sourceExpDate = new Date(sourceExpStr);
            const targetExpDate = new Date(targetExpStr);

            const isSourceNewer = !isNaN(sourceExpDate.getTime()) && !isNaN(targetExpDate.getTime())
              ? sourceExpDate > targetExpDate
              : sourceExpStr.localeCompare(targetExpStr) > 0;

            if (isSourceNewer) {
              // Replace target item with newer source item
              if (onDeleteItem) {
                await onDeleteItem(targetType, dupe.itemKey);
                await onDeleteItem(sourceType, sourceKey);
              }
              if (onAddItem) {
                await onAddItem(targetType, {
                  ...sourceItem,
                  groupName: dupe.groupName || sourceGroupName,
                });
              }

              reRenderData();

              addMessage(
                'ai',
                `✨ น้องออร่าทำการสลับนำ "${sourceItem.name}" (EXP ที่ใหม่กว่า: ${sourceExpStr || '-'}) เข้าไปไว้ใน${targetName} และคัดรายการเก่า (EXP: ${targetExpStr || '-'}) ออกเรียบร้อยค่ะ!`
              );
            } else {
              // Target item is newer or equal, delete item from source
              if (onDeleteItem) {
                await onDeleteItem(sourceType, sourceKey);
              }

              reRenderData();

              addMessage(
                'ai',
                `✨ น้องออร่าทำการตรวจสอบพบว่าใน${targetName} มี "${targetItem.name}" ชิ้นที่มี EXP ใหม่กว่า (EXP: ${targetExpStr || '-'}) อยู่แล้ว จึงคงรายการเดิมไว้ และลบรายการจาก${sourceName} เรียบร้อยแล้วค่ะ!`
              );
            }
          } else {
            // No duplicate, simple transfer
            if (onDeleteItem) {
              await onDeleteItem(sourceType, sourceKey);
            }
            if (onAddItem) {
              await onAddItem(targetType, {
                ...sourceItem,
                groupName: sourceGroupName || 'อุปกรณ์และเวชภัณฑ์ฉุกเฉิน',
              });
            }

            reRenderData();

            addMessage(
              'ai',
              `✨ น้องออร่าทำการย้าย "${sourceItem.name}" จาก${sourceName} ไปยัง${targetName} เรียบร้อยแล้วค่ะ!`
            );
          }
        } else {
          const rawItemName = query
            .replace(/(สลับของ|ย้ายของ|สลับ|ย้าย|จาก|ไป|ใน|ไม่ใช่|กระเป๋า|รถ|เป๋า|cart|bag|ออร่า|น้องออร่า)/gi, '')
            .trim();

          if (rawItemName.length > 1) {
            addMessage(
              'ai',
              `น้องออร่าค้นหารายการ "${rawItemName}" ใน${sourceName} ไม่พบค่ะ รบกวนระบุชื่ออุปกรณ์ให้ชัดเจนอีกครั้งนะคะ`
            );
          } else {
            addMessage(
              'ai',
              `✨ น้องออร่าพร้อมช่วยสลับของจาก${sourceName} ไป${targetName} ค่ะ รบกวนระบุชื่ออุปกรณ์ เช่น "ย้าย Atropine ไปกระเป๋า"`
            );
          }
        }

        setIsLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // 1.8 HYPER-INTELLIGENT SMART BULK AUTO-CHECK & DATED WEDNESDAYS
      // -------------------------------------------------------------
      const wedInfo = getWednesdaysInfoForMonth(new Date());
      const allAvailableWeeks = wedInfo.weeks;
      const totalWeeksInMonth = wedInfo.totalWednesdays;
      const currentWeekNumber = getWeekOfMonth(new Date());

      const autoCheckResult = parseAutoCheckIntent(query, currentWeekNumber, allAvailableWeeks);

      if (autoCheckResult.isAutoCheck && onBulkAutoCheck) {
        const targetCategories = autoCheckResult.categories;
        const targetWeeks = autoCheckResult.weeks.sort((a, b) => a - b);

        // Execute bulk auto check
        await onBulkAutoCheck({
          categories: targetCategories,
          weeks: targetWeeks,
        });

        // Format names and weeks for response
        const catNamesThai = targetCategories
          .map((c) => (c === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'))
          .join(' และ ');
        const primaryCat = targetCategories[0];
        const primaryWeek = targetWeeks[0];

        let responseText = '';
        if (autoCheckResult.isSingleWeek && targetWeeks.length === 1) {
          const singleWk = targetWeeks[0];
          const wedDate = wedInfo.dates[singleWk] || '-';
          responseText = `น้องออร่าทำการลงผลตรวจเช็ก สัปดาห์ที่ ${singleWk} (ตรงกับวันพุธที่ ${wedDate}) ให้เรียบร้อยแล้วค่ะ! ✨`;
        } else {
          const maxWk = totalWeeksInMonth;
          responseText = `น้องออร่าทำการลงผลตรวจเช็กครบทุกสัปดาห์ (W1-W${maxWk}) ประจำเดือนนี้ พร้อมลงวันที่วันพุธให้อัตโนมัติเรียบร้อยแล้วค่ะ! ✨`;
        }

        addMessage('ai', responseText, false, {
          label: `📄 เปิดดูรายงาน PDF (${catNamesThai})`,
          onClick: () => {
            if (onOpenReportModal) {
              onOpenReportModal(primaryCat, primaryWeek);
            }
            handleClose();
          },
        });

        // Automatically open PDF report modal & auto-close chat window
        if (onOpenReportModal) {
          onOpenReportModal(primaryCat, primaryWeek);
        }
        handleClose();

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
          handleClose(); // Auto-close chat after navigation
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
          handleClose(); // Auto-close chat after navigation
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
          handleClose(); // Auto-close chat after navigation
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
          handleClose(); // Auto-close chat after navigation
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
          handleClose(); // Auto-close chat after navigation
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
          className="fixed z-[9999] select-none pointer-events-auto"
          style={{
            right: '16px',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            zIndex: 9999,
          }}
        >
          <button
            type="button"
            onClick={handleOpen}
            className="w-13 h-13 flex items-center justify-center bg-gradient-to-br from-purple-500 to-cyan-400 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-white/30 ring-2 ring-purple-500/30"
            title="คุยกับน้องออร่า AI"
          >
            <Sparkles size={22} className="animate-pulse" />
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
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
                <div className="flex flex-col gap-2 bg-purple-50/80 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/60 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-purple-700 dark:text-purple-300">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="animate-spin text-purple-600 dark:text-purple-400" />
                      <span>
                        {scanProgress ? scanProgress.text : 'น้องออร่ากำลังประมวลผล...'}
                      </span>
                    </div>
                    {scanProgress && scanProgress.total > 0 && (
                      <span className="text-[11px] font-mono font-extrabold text-purple-600 dark:text-purple-300">
                        {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                      </span>
                    )}
                  </div>
                  {scanProgress && scanProgress.total > 0 && (
                    <div className="w-full h-2 bg-purple-200 dark:bg-purple-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 transition-all duration-300 rounded-full"
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
            <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-[2.5rem]">
              {/* Requirement 1: Multi-Image Staging Preview Area */}
              {stagedImages.length > 0 && (
                <div className="mb-3 p-2 bg-white dark:bg-slate-800 rounded-2xl border border-purple-200 dark:border-purple-900/50 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
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
                  multiple
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 hover:bg-purple-200 transition cursor-pointer flex items-center justify-center"
                  title="ถ่ายรูปหรือแนบภาพตารางอุปกรณ์หลายรูปพร้อมกัน (Multi-Image OCR)"
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
                  disabled={(inputMessage.trim() === '' && stagedImages.length === 0) || isLoading}
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
