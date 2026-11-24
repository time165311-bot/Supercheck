import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Square,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Copy,
  Check,
  Undo2,
  Tag,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  speakWithAura,
  stopSpeech,
} from '../utils/textToSpeech';
import {
  normalizeExpDate,
  parseExpDateObj,
  matchMedicalItemName,
  findBestMedicalMatches,
  findFuzzyDrugOrItemMatches,
  extractSignificantNumbers,
} from '../utils/itemUtils';
import { useDataContext } from '../context/DataContext';
import { clearChannelCategory } from '../services/aiEngine';
import { rotateImageDegrees } from '../utils/imageUtils';
import {
  compressImageToBase64,
  prepareAttachmentForAura,
  preprocessTableImageForOcr,
} from '../utils/imageCompressor';
import { authorizedFetch } from '../services/aiService';
import {
  readPaperChecklistOnly,
  smartVisionScan,
  LabelScanItem,
} from '../services/auraService';
import {
  EquipmentVerificationModal,
  VerificationEquipmentRow,
  VerificationPageImage,
} from './EquipmentVerificationModal';
import { AuraDataSnapshot } from '../types';
import { getChannelStorageKeys, buildAuraLiveContext } from '../utils/helpers';
import {
  AuraPendingPhotoUploadMetadata,
  getPendingPhotoMetadata,
  getFullPendingPhotoSession,
  savePendingPhotoSession,
  clearPendingPhotoSession,
  executePhotoMatchBatchWithRetry,
} from '../services/aiVision';

const LEGACY_AURA_CHAT_SESSION_KEY = 'aura_chat_history_v1';

const isJunkEquipmentRecord = (name?: string, id?: string): boolean => {
  const n = (name || '').trim();
  const i = (id || '').trim();
  if (!n) return true;
  if (/^eq[\s_-]*17\d+/i.test(n) || /^eq[\s_-]*17\d+/i.test(i)) return true;
  if (/^eq[\s_-]*\d{8,}$/i.test(n) || /^eq[\s_-]*\d{8,}$/i.test(i)) return true;
  if (/^test[\s_-]*\d*$/i.test(n)) return true;
  return false;
};

const sleepInterruptible = (ms: number, shouldStop: () => boolean): Promise<void> =>
  new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (shouldStop() || Date.now() - start >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });

const renderFormattedChatText = (raw: string): React.ReactNode => {
  if (!raw) return null;
  const parts = raw.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part.includes('**') ? part.replace(/\*\*/g, '') : part;
  });
};

interface AuraAssistantProps {
  equipment?: Record<string, any[]>;
  drugs?: any[];
  lists?: any;
  globalChecks?: Record<string, any>;
  stats?: any;
  onAddItem?: (type: 'bag' | 'cart' | 'ambulance' | string, item: any) => void;
  onDeleteItem?: (type: 'bag' | 'cart' | 'ambulance' | string, itemKey: string) => void | Promise<void>;
  onNavigate?: (
    view: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'eq_overview' | 'users',
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
  onAutoFillChecks?: (params: {
    items: any[];
    targetCategory?: 'bag' | 'cart' | 'drug';
    week?: number;
    onlyDiffs?: boolean;
    syncSheets?: boolean;
  }) => Promise<{
    updatedCount: number;
    normalCount?: number;
    abnormalCount?: number;
    expiredCount?: number;
    lowStockCount?: number;
    summaryText?: string;
    targetCat?: string;
    week?: number;
  }>;
  onRestockRequest?: (params: {
    items: any[];
    targetCategory?: string;
    notes?: string;
  }) => Promise<{ success: boolean; count: number; requisitionId?: string }>;
  onCaptureSnapshot?: (label: string) => AuraDataSnapshot;
  onRestoreSnapshot?: (snapshot: AuraDataSnapshot) => Promise<boolean>;
  onDirectClearInventory?: (targetCategory: string) => Promise<AuraDataSnapshot>;
  onDeleteAllEquipment?: () => Promise<{
    success: boolean;
    deletedCount: number;
    syncedToCloud: boolean;
    error?: string;
    snapshot?: AuraDataSnapshot;
  }>;
  onUpdateInventoryItem?: (params: {
    targetType: 'drug' | 'bag' | 'cart' | 'room';
    itemId: string;
    roomId?: string;
    newExp?: string;
    lotNumber?: string;
    newQty?: string | number;
    newStatus?: 'ปกติ' | 'ผิดปกติ' | 'ไม่ปกติ';
    note?: string;
  }) => Promise<{ success: boolean; updatedName: string }>;
  onAttachEquipmentPhotos?: (params: {
    mappings: Array<{
      imageIndex: number;
      equipmentId: string;
      detectedNumber?: string;
      equipmentName?: string;
    }>;
    attachments: Array<{ index: number; dataUrl: string; fileName?: string }>;
  }) => Promise<{
    updatedItems: Array<{
      roomId: string;
      equipmentId: string;
      equipmentName: string;
      detectedNumber: string;
      imageIndex: number;
    }>;
    failedItems: Array<{
      imageIndex: number;
      detectedNumber?: string;
      equipmentName?: string;
      reason: string;
    }>;
  }>;
  onBulkImportEquipment?: (
    items: Array<{
      orderNumber: string;
      assetCode?: string;
      sapCode?: string;
      name: string;
      brandModel?: string;
      price?: string | number;
      location?: string;
      status?: string;
      note?: string;
      isMarked?: boolean;
    }>
  ) => Promise<{
    importedCount: number;
    minOrder: string;
    maxOrder: string;
    markedItems: Array<{
      orderNumber: string;
      name: string;
      location?: string;
      status?: string;
      note?: string;
      isMarked?: boolean;
    }>;
    roomCounts: Record<string, number>;
  }>;
  onOpenReportModal?: (category?: 'bag' | 'cart' | 'ambulance' | 'eq' | 'drug', week?: number) => void;
  currentView?: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'ambulance_check' | 'eq_overview' | 'users';
  isDarkMode?: boolean;
  isBottomBarVisible?: boolean;
  isAnyModalOpen?: boolean;
  hasUnreadAuraMessage?: boolean;
  onUnreadMessage?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  onClearTargetInventory?: (category: string) => void | Promise<void>;
  onPreviewImage?: (preview: {
    url: string;
    label?: string;
    images?: Array<{ url: string; label?: string }>;
    currentIndex?: number;
  }) => void;
}

interface PendingAttachmentItem {
  index: number;
  fileName: string;
  mimeType: string;
  base64: string;
  dataUrl: string;
  previewUrl: string;
  isPdf: boolean;
  sizeBytes: number;
}

interface ActionMeta {
  type: 'navigate' | 'open_file_picker' | 'open_report' | 'send_command';
  label: string;
  view?: 'home' | 'drug_check' | 'room_check' | 'bag_check' | 'cart_check' | 'eq_overview' | 'users';
  category?: 'medicine' | 'equipment' | 'bag' | 'cart';
  reportCategory?: 'bag' | 'cart' | 'eq' | 'drug';
  reportWeek?: number;
  command?: string;
}

interface LabelScanCandidate {
  targetType: 'drug' | 'bag' | 'cart' | 'room';
  itemId: string;
  roomId?: string;
  displayName: string;
  locationLabel: string;
  currentExp: string;
  score?: number;
  matchedBy?: 'code' | 'exact' | 'alias' | 'fuzzy';
}

interface LabelScanEntry {
  scanned: LabelScanItem;
  candidates: LabelScanCandidate[];
  selectedCandidateIdx: number;
  editedExp: string;
  editedLot: string;
  nurseConfirmed?: boolean;
}

interface ChatMessage {
  id?: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isCard?: boolean;
  image?: string;
  images?: string[];
  attachmentName?: string;
  isPdfAttachment?: boolean;
  actionBtn?: {
    label: string;
    onClick: () => void;
  };
  actionMeta?: ActionMeta;
  suggestedChoices?: string[];
  extractedItems?: any[];
  parsedItems?: any[];
  diffSummary?: {
    total: number;
    completeCount: number;
    diffCount: number;
    restockCount: number;
  };
  diffItems?: any[];
  restockItems?: any[];
  autoFillApplied?: boolean;
  restockApplied?: boolean;
  diffMode?: 'diff_only' | 'all';
  targetCategory?: 'bag' | 'cart' | 'drug';
  targetLocation?: string;
  targetName?: string;
  isConfirmationCard?: boolean;
  confirmationData?: {
    title: string;
    description: string;
    targetCat: string;
    status: 'pending' | 'confirmed' | 'cancelled';
    actionKind?: 'clear_inventory' | 'delete_all_equipment';
    itemCount?: number;
  };
  handoverText?: string;
  undoSnapshot?: AuraDataSnapshot;
  undoApplied?: boolean;
  labelScanData?: {
    items: LabelScanEntry[];
    applied: boolean;
  };
  equipmentVerificationData?: {
    rows: VerificationEquipmentRow[];
    pageImages: VerificationPageImage[];
    applied: boolean;
    importedSummary?: {
      importedCount: number;
      minOrder: string;
      maxOrder: string;
    };
  };
  sources?: Array<{ title?: string; url: string }>;
}

export const AuraAssistant: React.FC<AuraAssistantProps> = ({
  equipment = {},
  drugs = [],
  lists = {},
  globalChecks = {},
  stats = {},
  onAddItem,
  onDeleteItem,
  onNavigate,
  onBulkAutoCheck,
  onAutoFillChecks,
  onRestockRequest,
  onCaptureSnapshot,
  onRestoreSnapshot,
  onDirectClearInventory,
  onDeleteAllEquipment,
  onUpdateInventoryItem,
  onAttachEquipmentPhotos,
  onBulkImportEquipment,
  onOpenReportModal,
  currentView = 'home',
  isDarkMode = false,
  isBottomBarVisible = true,
  isAnyModalOpen = false,
  hasUnreadAuraMessage = false,
  onUnreadMessage,
  onOpenChange,
  onClearTargetInventory,
  onPreviewImage,
}) => {
  const {
    activeChannelId,
    activeChannel,
    reRenderData,
  } = useDataContext();
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  const isUserStoppedRef = useRef(false);

  const notifyUnreadIfClosed = () => {
    if (!isOpenRef.current) {
      onUnreadMessage?.();
    }
  };

  // ⏹️ ปุ่ม "หยุดประมวลผล"
  const handleStop = () => {
    isUserStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeControllersRef.current.forEach((c) => {
      try {
        c.abort();
      } catch {}
    });
    activeControllersRef.current.clear();
    setIsLoading(false);
    setScanProgress(null);
  };

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  const [isAnimating, setIsAnimating] = useState(false);
  const [viewportMetrics, setViewportMetrics] = useState<{ height: number; offsetTop: number } | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentItem[]>([]);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    text: string;
  } | null>(null);
  const [dbActionStatus, setDbActionStatus] = useState<string | null>(null);
  const [copiedHandoverIdx, setCopiedHandoverIdx] = useState<number | null>(null);
  const [pendingScanMode, setPendingScanMode] = useState<
    'auto' | 'label' | 'audit-paper' | 'match-photos' | 'bulk-import'
  >('auto');
  const [pendingPhotoMatchSession, setPendingPhotoMatchSession] = useState<{
    totalImages: number;
    matched: Array<{
      imageIndex: number;
      orderNumber: string;
      detectedNumber: string;
      equipmentId: string;
      equipmentName: string;
      roomId: string;
      dataUrl: string;
      fileName?: string;
      unmatched?: boolean;
    }>;
    unmatched: Array<{
      imageIndex: number;
      orderNumber?: string;
      detectedNumber?: string;
      equipmentId?: string;
      equipmentName?: string;
      roomId?: string;
      dataUrl: string;
      fileName?: string;
      reason?: string;
    }>;
    allAttachments: Array<{ index: number; dataUrl: string; fileName?: string }>;
    snapshot?: any;
  } | null>(null);
  const [pendingUploadRecovery, setPendingUploadRecovery] = useState<AuraPendingPhotoUploadMetadata | null>(null);
  const [isResumingPendingUpload, setIsResumingPendingUpload] = useState<boolean>(false);
  const [verificationModalState, setVerificationModalState] = useState<{
    isOpen: boolean;
    messageId: string | null;
    rows: VerificationEquipmentRow[];
    pageImages: VerificationPageImage[];
  }>({
    isOpen: false,
    messageId: null,
    rows: [],
    pageImages: [],
  });
  const [isSavingVerifiedImport, setIsSavingVerifiedImport] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setViewportMetrics(null);
      return;
    }
    const updateViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setViewportMetrics({
        height: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
      });
    };
    updateViewport();
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, [isOpen]);

  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const hasBriefedRef = useRef(false);

  const greetings = [
    'สวัสดีค่ะ น้องออร่าพร้อมช่วยเช็กสต็อก อ่านใบตรวจ หรือสแกนวันหมดอายุยา เลือกคำสั่งด้านล่างหรือส่งรูปได้เลยค่ะ',
  ];

  // 🌟 Concise Proactive Shift Briefing (ไม่กินพื้นที่หน้าจอ)
  const generateProactiveBriefing = (): { text: string; choices: string[] } => {
    const now = new Date();
    let expiringCount = 0;
    let lowStockCount = 0;

    (drugs || []).forEach((d: any) => {
      const expDate = d.expDate || d.exp;
      if (expDate && expDate !== '-') {
        const dObj = parseExpDateObj(expDate);
        if (dObj && Math.ceil((dObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 30) {
          expiringCount++;
        }
      }
      const currentQty = d.remaining ?? d.totalQty ?? 0;
      const minStock = d.minStock ?? 0;
      if (currentQty <= minStock && minStock > 0) {
        lowStockCount++;
      }
    });

    if (expiringCount > 0 || lowStockCount > 0) {
      return {
        text: `สวัสดีค่ะ น้องออร่าตรวจพบยาใกล้หมดอายุ ${expiringCount} รายการ และต่ำกว่าเกณฑ์ ${lowStockCount} รายการ เลือกคำสั่งด้านล่างหรือส่งรูปได้เลยค่ะ`,
        choices: ['เช็กของใกล้หมด', 'สรุปส่งเวร'],
      };
    }

    return {
      text: greetings[0],
      choices: ['สรุปส่งเวร', 'เช็กของใกล้หมด'],
    };
  };

  const channelChatKey = getChannelStorageKeys(activeChannelId).CHAT_HISTORY;
  const prevChannelIdRef = useRef<string>(activeChannelId);

  const loadChatHistoryForKey = (storageKey: string): ChatMessage[] => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved =
          window.sessionStorage.getItem(storageKey) ||
          (activeChannelId === 'master' ? window.sessionStorage.getItem(LEGACY_AURA_CHAT_SESSION_KEY) : null);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasBriefedRef.current = parsed.length > 1;
            return parsed;
          }
        }
      }
    } catch {
      // Ignore corrupt sessionStorage
    }
    hasBriefedRef.current = false;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [
      {
        sender: 'ai',
        text: greetings[0],
        timestamp: timeStr,
      },
    ];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistoryForKey(channelChatKey));

  // 🔄 Switch Aura chat thread cleanly when activeChannelId changes (strict ward isolation)
  useEffect(() => {
    if (prevChannelIdRef.current !== activeChannelId) {
      prevChannelIdRef.current = activeChannelId;
      setPendingAttachments([]);
      setMessages(loadChatHistoryForKey(getChannelStorageKeys(activeChannelId).CHAT_HISTORY));
    }
  }, [activeChannelId]);

  // 💾 Persist Aura Chat History per channel into sessionStorage so switching wards preserves separate threads
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const key = getChannelStorageKeys(activeChannelId).CHAT_HISTORY;
      const serializable = messages.slice(-40).map((m) => {
        const { actionBtn, ...rest } = m;
        return rest;
      });
      try {
        window.sessionStorage.setItem(key, JSON.stringify(serializable));
      } catch {
        // QuotaExceededError fallback: strip heavy base64 images & keep latest undo snapshots
        const slim = serializable.map((m, idx) => ({
          ...m,
          image: undefined,
          images: undefined,
          equipmentVerificationData: m.equipmentVerificationData
            ? { ...m.equipmentVerificationData, pageImages: [] }
            : undefined,
          undoSnapshot: idx >= serializable.length - 3 ? m.undoSnapshot : undefined,
        }));
        window.sessionStorage.setItem(key, JSON.stringify(slim));
      }
    } catch {
      // Ignore storage failures
    }
  }, [messages, activeChannelId]);

  // อัปเดตข้อความทักทายแบบแจ้งเตือนเชิงรุกเมื่อเปิดระบบ (เฉพาะเมื่อยังไม่เคยมีประวัติแชตในเซสชันนี้)
  useEffect(() => {
    if (isOpen && !hasBriefedRef.current && messages.length <= 1 && (drugs.length > 0 || Object.keys(equipment).length > 0)) {
      hasBriefedRef.current = true;
      const briefing = generateProactiveBriefing();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([
        {
          sender: 'ai',
          text: briefing.text,
          timestamp: timeStr,
          suggestedChoices: briefing.choices,
        },
      ]);
    }
  }, [isOpen, drugs, equipment, messages.length]);

  // 🛡️ Human-in-the-Loop Confirmation Card Helper
  const addConfirmationCard = (
    title: string,
    description: string,
    targetCat: string,
    options?: {
      actionKind?: 'clear_inventory' | 'delete_all_equipment';
      itemCount?: number;
    }
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        sender: 'ai',
        text: description,
        timestamp: timeStr,
        isConfirmationCard: true,
        confirmationData: {
          title,
          description,
          targetCat,
          status: 'pending',
          actionKind: options?.actionKind || 'clear_inventory',
          itemCount: options?.itemCount,
        },
      },
    ]);
    notifyUnreadIfClosed();
    speakText(
      options?.actionKind === 'delete_all_equipment'
        ? `น้องออร่าขอทวนคำสั่งก่อนลบจริงนะคะ ต้องการลบครุภัณฑ์ทั้งหมด ${options.itemCount ?? 0} รายการออกจากฐานข้อมูลใช่ไหมคะ?`
        : `น้องออร่าขอทวนคำสั่งก่อนทำจริงนะคะ พี่พยาบาลต้องการล้างข้อมูลในหมวด ${targetCat} ใช่ไหมคะ?`
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom of chat only when user is near bottom (eliminates scroll jumping when reading past messages)
  useEffect(() => {
    const container = chatBodyRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom || messages.length <= 2) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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

  // Check for pending photo upload recovery on modal open
  useEffect(() => {
    if (isOpen) {
      const meta = getPendingPhotoMetadata();
      if (meta && meta.completedCount < meta.totalImages) {
        setPendingUploadRecovery(meta);
      } else {
        setPendingUploadRecovery(null);
      }
    }
  }, [isOpen]);

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
  }, [equipment, drugs, lists]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setUiNotice('เบราว์เซอร์นี้ไม่รองรับระบบสั่งการด้วยเสียง (Speech Recognition)');
      setTimeout(() => setUiNotice(null), 3500);
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
    void handleAttachFileSelect(event);
  };

  const handleAttachFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    if (isLoading || dbActionStatus || isProcessingAttachment) return;

    const supportedFiles = files.filter((file) => {
      const mime = (file.type || '').toLowerCase();
      return (
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        /\.(jpe?g|png|webp|heic|heif|bmp|gif|pdf)$/i.test(file.name || '')
      );
    });

    if (supportedFiles.length === 0) {
      setUiNotice('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP) และเอกสาร PDF เท่านั้นค่ะ');
      setTimeout(() => setUiNotice(null), 4000);
      return;
    }

    const MAX_ATTACHMENTS = 100;
    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - pendingAttachments.length);
    if (remainingSlots === 0) {
      setUiNotice(`แนบไฟล์ได้สูงสุดครั้งละ ${MAX_ATTACHMENTS} ไฟล์นะคะ`);
      setTimeout(() => setUiNotice(null), 4000);
      return;
    }

    const filesToProcess = supportedFiles.slice(0, remainingSlots);
    setIsProcessingAttachment(true);
    try {
      const newlyPrepared: PendingAttachmentItem[] = [];
      for (const file of filesToProcess) {
        // Optimize resolution: 1100px with 0.82 quality is sharp for handwritten order numbers while keeping base64 compact
        const prepared = await prepareAttachmentForAura(file, 1100, 0.82);
        newlyPrepared.push({
          index: pendingAttachments.length + newlyPrepared.length,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          base64: prepared.base64,
          dataUrl: prepared.dataUrl,
          previewUrl: prepared.isPdf ? '' : prepared.dataUrl,
          isPdf: prepared.isPdf,
          sizeBytes: file.size,
        });
      }

      setPendingAttachments((prev) => {
        const combined = [...prev, ...newlyPrepared].slice(0, MAX_ATTACHMENTS);
        return combined.map((item, idx) => ({ ...item, index: idx }));
      });
    } catch (err: any) {
      console.error('Attachment preparation error:', err);
      setUiNotice('ไม่สามารถเตรียมไฟล์แนบได้ กรุณาลองเลือกไฟล์ใหม่อีกครั้งค่ะ');
      setTimeout(() => setUiNotice(null), 4000);
    } finally {
      setIsProcessingAttachment(false);
    }
  };

  const handleClearPendingAttachments = () => {
    setPendingAttachments([]);
  };

  const handleRemovePendingAttachment = (indexToRemove: number) => {
    setPendingAttachments((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((item, idx) => ({ ...item, index: idx }))
    );
  };

  const renderPhotoMatchConfirmationCard = () => {
    if (!pendingPhotoMatchSession) return null;

    return (
      <div className="mx-3 my-2 p-3.5 rounded-2xl bg-white dark:bg-[#1E1F20] border-2 border-blue-400 dark:border-blue-500/50 shadow-lg animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                📸 ตรวจพบและจับคู่รูปภาพครุภัณฑ์
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                จับคู่สำเร็จ {pendingPhotoMatchSession.matched.length} จาก {pendingPhotoMatchSession.totalImages} รูป
                {pendingPhotoMatchSession.unmatched.length > 0 && (
                  <span className="text-amber-500 font-bold ml-1">
                    (รอระบุลำดับ {pendingPhotoMatchSession.unmatched.length} รูป)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingPhotoMatchSession(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            title="ปิด"
          >
            <X size={16} />
          </button>
        </div>

        {/* Unmatched photos alert & dropdown selection */}
        {pendingPhotoMatchSession.unmatched.length > 0 && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 mb-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                มี {pendingPhotoMatchSession.unmatched.length} รูปที่อ่านตัวเลขไม่ชัดเจน โปรดเลือกลำดับครุภัณฑ์:
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pendingPhotoMatchSession.unmatched.map((unm, uIdx) => (
                <div
                  key={`unm_${unm.imageIndex}_${uIdx}`}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-[#131314] border border-amber-200/80 dark:border-amber-900/40"
                >
                  <img
                    src={unm.dataUrl}
                    alt="unmatched"
                    onClick={() =>
                      onPreviewImage?.({
                        url: unm.dataUrl,
                        label: `รูปที่ #${unm.imageIndex + 1} (${unm.fileName || 'ไม่ทราบเลข'})`,
                      })
                    }
                    className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                      รูป #{unm.imageIndex + 1} {unm.fileName ? `(${unm.fileName})` : ''}
                    </div>
                    <select
                      value={unm.equipmentId || ''}
                      onChange={(e) => {
                        const selId = e.target.value;
                        const foundEq = allEquipmentOptions.find((o: any) => o.id === selId);
                        if (foundEq) {
                          setPendingPhotoMatchSession((prev) => {
                            if (!prev) return null;
                            const newlyMatched = {
                              imageIndex: unm.imageIndex,
                              equipmentId: foundEq.id,
                              equipmentName: foundEq.name,
                              orderNumber: foundEq.no,
                              detectedNumber: foundEq.no,
                              roomId: foundEq.roomId,
                              dataUrl: unm.dataUrl,
                              fileName: unm.fileName,
                              unmatched: false,
                            };
                            return {
                              ...prev,
                              matched: [...prev.matched, newlyMatched],
                              unmatched: prev.unmatched.filter((_, idx) => idx !== uIdx),
                            };
                          });
                        }
                      }}
                      className="mt-1 w-full text-[11px] px-2 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#1E1F20] text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- แตะเพื่อเลือกลำดับครุภัณฑ์ --</option>
                      {allEquipmentOptions.map((opt: any) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matched photos list */}
        {pendingPhotoMatchSession.matched.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-1.5">
              <CheckCircle2 size={13} />
              <span>รายการที่จับคู่เรียบร้อย ({pendingPhotoMatchSession.matched.length} รูป):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {pendingPhotoMatchSession.matched.map((mItem, mIdx) => (
                <div
                  key={`matched_${mItem.imageIndex}_${mIdx}`}
                  className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-[#131314] border border-slate-200 dark:border-white/10 text-xs"
                >
                  <img
                    src={mItem.dataUrl}
                    alt={mItem.equipmentName}
                    onClick={() =>
                      onPreviewImage?.({
                        url: mItem.dataUrl,
                        label: `${mItem.orderNumber}: ${mItem.equipmentName}`,
                      })
                    }
                    className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                        #{mItem.orderNumber || mItem.detectedNumber || '-'}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">[{mItem.roomId}]</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                      {mItem.equipmentName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPendingPhotoMatchSession(null)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={pendingPhotoMatchSession.matched.length === 0 || Boolean(dbActionStatus)}
            onClick={handleConfirmPhotoMatch}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Check size={14} />
            <span>ยืนยันบันทึกรูปภาพ ({pendingPhotoMatchSession.matched.length} รายการ)</span>
          </button>
        </div>
      </div>
    );
  };

  const handleResumePendingUpload = async () => {
    if (isResumingPendingUpload) return;
    setIsResumingPendingUpload(true);
    try {
      const session = await getFullPendingPhotoSession();
      if (!session || !session.attachments || session.attachments.length === 0) {
        setPendingUploadRecovery(null);
        setIsResumingPendingUpload(false);
        return;
      }

      const totalImages = session.totalImages;
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(totalImages / BATCH_SIZE);
      const collectedMappings = [...(session.collectedMappings || [])];
      const resumeStartBatch = Math.min(totalBatches, session.completedBatches || 0);

      const progressMsgId = `photo_match_resume_${Date.now()}`;
      const progressTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages((prev) => [
        ...prev,
        {
          id: progressMsgId,
          sender: 'ai',
          text: `⏳ กำลังดำเนินการต่อจากชุดที่ ${resumeStartBatch + 1}/${totalBatches} (${totalImages} รูป)...`,
          timestamp: progressTime,
        },
      ]);

      const updateProgressBubble = (newText: string, extra?: Partial<ChatMessage>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === progressMsgId ? { ...m, text: newText, ...extra } : m))
        );
      };

      const compactAppContext = {
        currentRoute: currentView,
        activeChannel: activeChannel?.name || 'คลินิกวิสัญญี (Master)',
        emergencySummary: {
          bagCount: lists?.bag?.groups ? Object.values(lists.bag.groups).flat().length : 0,
          cartCount: lists?.cart?.groups ? Object.values(lists.cart.groups).flat().length : 0,
          ambulanceCount: lists?.ambulance?.groups ? Object.values(lists.ambulance.groups).flat().length : 0,
        },
      };
      const requestContext = buildAuraLiveContext(drugs, equipment, lists, globalChecks);

      for (let b = resumeStartBatch; b < totalBatches; b++) {
        if (isUserStoppedRef.current) break;
        const bStart = b * BATCH_SIZE;
        const bEnd = Math.min(totalImages, (b + 1) * BATCH_SIZE);
        const batchItems = session.attachments.slice(bStart, bEnd);

        setScanProgress({
          current: b + 1,
          total: totalBatches,
          text: `กำลังวิเคราะห์รูปภาพชุดที่ ${b + 1}/${totalBatches} (รูปที่ ${bStart + 1}-${bEnd} จาก ${totalImages} รูป)...`,
        });
        updateProgressBubble(
          `⏳ กำลังวิเคราะห์รูปภาพชุดที่ ${b + 1}/${totalBatches} (รูปที่ ${bStart + 1}-${bEnd} จาก ${totalImages} รูป)...`
        );

        const batchResult = await executePhotoMatchBatchWithRetry(
          batchItems,
          bStart,
          session.query || 'วิเคราะห์และจับคู่รูปภาพครุภัณฑ์ตามหมายเลขกำกับ',
          compactAppContext,
          requestContext,
          activeChannel?.name || 'คลินิกวิสัญญี (Master)'
        );

        collectedMappings.push(...batchResult.mappings);

        await savePendingPhotoSession(
          {
            sessionId: session.sessionId,
            timestamp: Date.now(),
            query: session.query,
            totalImages,
            completedBatches: b + 1,
            totalBatches,
            completedCount: bEnd,
            collectedMappings,
            itemsMeta: session.attachments.map((att, idx) => ({
              index: idx,
              fileName: att.fileName,
              completed: idx < bEnd,
            })),
          },
          session.attachments
        );
      }

      const mappingByIndex = new Map<number, any>();
      collectedMappings.forEach((m) => {
        mappingByIndex.set(Number(m.imageIndex), m);
      });

      const matchedList: any[] = [];
      const unmatchedList: any[] = [];

      session.attachments.forEach((att, idx) => {
        const m = mappingByIndex.get(idx);
        const targetNum = String(m?.orderNumber || m?.detectedNumber || '').trim();
        const targetNumInt = parseInt(targetNum, 10);
        const targetId = String(m?.equipmentId || '').trim();

        let foundEq: any = null;
        let foundRoom = '';

        if (targetId) {
          for (const [rId, rItems] of Object.entries(equipment || {})) {
            const match = ((rItems as any[]) || []).find((it: any) => it.id === targetId);
            if (match) {
              foundEq = match;
              foundRoom = rId;
              break;
            }
          }
        }

        if (!foundEq && targetNum) {
          for (const [rId, rItems] of Object.entries(equipment || {})) {
            const match = ((rItems as any[]) || []).find((it: any) => {
              const itNo = String(it.no ?? '').trim();
              const itOrder = String(it.orderNumber ?? '').trim();
              const itCode = String(it.code || it.assetCode || '').trim();
              const itSap = String(it.sap || it.sapCode || '').trim();
              if (itOrder === targetNum || itNo === targetNum || itCode === targetNum || itSap === targetNum) {
                return true;
              }
              if (!Number.isNaN(targetNumInt) && targetNumInt > 0) {
                return parseInt(itNo, 10) === targetNumInt || parseInt(itOrder, 10) === targetNumInt;
              }
              return false;
            });
            if (match) {
              foundEq = match;
              foundRoom = rId;
              break;
            }
          }
        }

        if (foundEq && !m?.unmatched) {
          matchedList.push({
            imageIndex: idx,
            orderNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
            detectedNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
            equipmentId: foundEq.id,
            equipmentName: foundEq.name,
            roomId: foundRoom,
            dataUrl: att.dataUrl || `data:${att.mimeType};base64,${att.base64}`,
            fileName: att.fileName,
            unmatched: false,
          });
        } else {
          unmatchedList.push({
            imageIndex: idx,
            orderNumber: targetNum || '',
            detectedNumber: targetNum || '',
            equipmentId: '',
            equipmentName: '',
            roomId: '',
            dataUrl: att.dataUrl || `data:${att.mimeType};base64,${att.base64}`,
            fileName: att.fileName,
            reason: m?.reason || 'อ่านตัวเลขไม่ชัดเจนหรือไม่พบในระบบ',
          });
        }
      });

      setPendingPhotoMatchSession({
        totalImages,
        matched: matchedList,
        unmatched: unmatchedList,
        allAttachments: session.attachments.map((att, idx) => ({
          index: idx,
          dataUrl: att.dataUrl || `data:${att.mimeType};base64,${att.base64}`,
          fileName: att.fileName,
        })),
      });

      updateProgressBubble(
        `📸 ดำเนินการต่อครบทั้ง ${totalImages} รูปภาพเรียบร้อยแล้วค่ะ! ✨🌸\n` +
          `• ตรวจพบและจับคู่สำเร็จ: ${matchedList.length}/${totalImages} รายการ\n` +
          (unmatchedList.length > 0 ? `• ต้องระบุลำดับเอง: ${unmatchedList.length} รูป\n` : '') +
          `\nโปรดตรวจสอบรายการในกล่องยืนยันด้านล่างนะคะ 🎀`
      );

      await clearPendingPhotoSession();
      setPendingUploadRecovery(null);
    } catch (err: any) {
      console.error('[Aura] Resume pending upload error:', err);
    } finally {
      setIsResumingPendingUpload(false);
      setIsLoading(false);
      setScanProgress(null);
    }
  };

  const renderPendingUploadRecoveryCard = () => {
    if (!pendingUploadRecovery) return null;

    return (
      <div className="mx-3 my-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-[#1E1F20] border-2 border-amber-400 dark:border-amber-500/50 shadow-md animate-in fade-in">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Camera size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                📋 มีงานวิเคราะห์รูปภาพค้างอยู่
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                ประมวลผลแล้ว {pendingUploadRecovery.completedCount} จากทั้งหมด {pendingUploadRecovery.totalImages} รูป
                ({pendingUploadRecovery.totalImages - pendingUploadRecovery.completedCount} รูปที่เหลือ)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await clearPendingPhotoSession();
              setPendingUploadRecovery(null);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
            title="ยกเลิกงานนี้"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={isResumingPendingUpload}
            onClick={handleResumePendingUpload}
            className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isResumingPendingUpload ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>กำลังดำเนินการต่อ...</span>
              </>
            ) : (
              <>
                <RotateCw size={14} />
                <span>ดำเนินการต่อจากรูปที่ค้างอยู่</span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={isResumingPendingUpload}
            onClick={async () => {
              await clearPendingPhotoSession();
              setPendingUploadRecovery(null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  };

  const handleRotatePendingAttachment = async (targetIdx: number) => {
    const target = pendingAttachments[targetIdx];
    if (!target || target.isPdf || isProcessingAttachment || isLoading || dbActionStatus) return;
    setIsProcessingAttachment(true);
    try {
      const rotatedDataUrl = await rotateImageDegrees(target.dataUrl, 90);
      const rotatedBase64 = rotatedDataUrl.replace(/^data:[^;]+;base64,/i, '');
      setPendingAttachments((prev) =>
        prev.map((item, idx) =>
          idx === targetIdx
            ? {
                ...item,
                mimeType: 'image/jpeg',
                base64: rotatedBase64,
                dataUrl: rotatedDataUrl,
                previewUrl: rotatedDataUrl,
              }
            : item
        )
      );
    } catch (err) {
      console.warn('Pending attachment rotate error:', err);
      setUiNotice('ไม่สามารถหมุนรูปภาพได้ กรุณาลองใหม่อีกครั้งค่ะ');
      setTimeout(() => setUiNotice(null), 3500);
    } finally {
      setIsProcessingAttachment(false);
    }
  };

  const buildUnifiedCatalog = () => {
    const entries: Array<{
      targetType: 'drug' | 'bag' | 'cart' | 'room';
      itemId: string;
      roomId?: string;
      name: string;
      spec: string;
      qtyText: string;
      unit: string;
      exp: string;
      note: string;
      locationLabel: string;
      status?: string;
      codes?: string[];
    }> = [];

    (drugs || []).forEach((d: any) => {
      if (!d?.name) return;
      entries.push({
        targetType: 'drug',
        itemId: d.id,
        name: d.name,
        spec: d.spec || '',
        qtyText: String(d.remaining ?? d.totalQty ?? 0),
        unit: d.unit || 'Amp/ขวด',
        exp: d.expDate || d.exp || '-',
        note: d.note || '',
        locationLabel: 'คลังยาวิสัญญี',
        codes: [d.tmtCode, d.hospitalDrugCode, d.barcode, d.id].filter(Boolean),
      });
    });

    (['bag', 'cart'] as const).forEach((cat) => {
      const catChecks = globalChecks?.[cat] || {};
      const groups = lists?.[cat]?.groups || {};
      Object.entries(groups).forEach(([gName, gItems]: [string, any]) => {
        (gItems || []).forEach((it: any, idx: number) => {
          if (isJunkEquipmentRecord(it.name, it.id)) return;
          const itemKey = it.id || `${cat}_${gName}_${idx}`;
          const chk = catChecks[itemKey] || {};
          entries.push({
            targetType: cat,
            itemId: itemKey,
            name: it.name,
            spec: it.spec || '',
            qtyText: String(it.unitText || it.qty || '1'),
            unit: '',
            exp: chk.exp || it.exp || '-',
            note: chk.note || it.note || '',
            locationLabel: `${cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'} (${gName})`,
            status: chk.result || 'รอตรวจ',
          });
        });
      });
    });

    Object.entries(equipment || {}).forEach(([roomId, roomItems]) => {
      const roomChecks = globalChecks?.[roomId] || {};
      (roomItems || []).forEach((eq: any, idx: number) => {
        if (isJunkEquipmentRecord(eq.name, eq.id)) return;
        const itemKey = eq.id || `${roomId}_${idx}`;
        const chk = roomChecks[itemKey] || {};
        entries.push({
          targetType: 'room',
          itemId: itemKey,
          roomId,
          name: eq.name,
          spec: eq.spec || '',
          qtyText: String(eq.unitText || eq.qty || '1'),
          unit: '',
          exp: chk.exp || eq.exp || '-',
          note: chk.note || eq.note || '',
          locationLabel: `ห้องผ่าตัด ${roomId.toUpperCase()}`,
          status: chk.result || 'รอตรวจ',
        });
      });
    });

    return entries;
  };

  const buildLabelScanData = (scannedItems: LabelScanItem[]) => {
    const catalog = buildUnifiedCatalog();
    const mapped: LabelScanEntry[] = scannedItems.map((sc) => {
      const searchStr = `${sc.itemName || ''} ${sc.sizeOrSpec || ''}`.trim();
      const fuzzyMatches = findFuzzyDrugOrItemMatches(searchStr, catalog, {
        getName: (c) => c.name,
        getSpec: (c) => c.spec,
        getCodes: (c) => c.codes || [],
        minScore: 40,
      });

      const candidates: LabelScanCandidate[] =
        fuzzyMatches.length > 0
          ? fuzzyMatches.slice(0, 6).map((res) => ({
              targetType: res.item.targetType,
              itemId: res.item.itemId,
              roomId: res.item.roomId,
              displayName: `${res.item.name}${res.item.spec ? ` (${res.item.spec})` : ''}`,
              locationLabel: res.item.locationLabel,
              currentExp: res.item.exp || '-',
              score: res.score,
              matchedBy: res.matchedBy,
            }))
          : findBestMedicalMatches(searchStr, catalog, (c) => c.name, (c) => c.spec)
              .slice(0, 6)
              .map((m) => ({
                targetType: m.targetType,
                itemId: m.itemId,
                roomId: m.roomId,
                displayName: `${m.name}${m.spec ? ` (${m.spec})` : ''}`,
                locationLabel: m.locationLabel,
                currentExp: m.exp || '-',
                score: 65,
                matchedBy: 'fuzzy',
              }));

      const normalized = sc.expDate && sc.expDate !== '-' ? normalizeExpDate(sc.expDate).expDate : '';
      return {
        scanned: sc,
        candidates,
        selectedCandidateIdx: 0,
        editedExp: sc.expDate && /^\d{4}-\d{2}-\d{2}$/.test(sc.expDate) ? sc.expDate : normalized || '',
        editedLot: sc.lotNumber || '',
        nurseConfirmed: false,
      };
    });
    return { items: mapped, applied: false };
  };

  const handleSendImageMessage = async (
    imageFile: File,
    userInstruction?: string,
    scanModeArg: boolean | 'auto' | 'label' | 'audit-paper' = 'auto'
  ) => {
    if (isLoading || dbActionStatus) return;

    const resolvedMode: 'auto' | 'audit-paper' | 'scan-label' =
      scanModeArg === true || scanModeArg === 'label'
        ? 'scan-label'
        : scanModeArg === 'audit-paper'
        ? 'audit-paper'
        : 'auto';

    setIsLoading(true);
    setScanProgress({
      current: 15,
      total: 100,
      text: '1/2 กำลังปรับความคมชัดและย่อขนาดไฟล์...',
    });

    const isPdfFile =
      imageFile.type === 'application/pdf' || /\.pdf$/i.test(imageFile.name || '');
    let preparedDataUrl = '';
    try {
      if (isPdfFile) {
        const prep = await prepareAttachmentForAura(imageFile, 1600, 0.85);
        preparedDataUrl = prep.dataUrl;
      } else {
        preparedDataUrl = await compressImageToBase64(imageFile, 1600, 0.85);
      }
    } catch (e) {
      console.error('Compression error:', e);
      preparedDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onload = () => resolve(reader.result as string);
      });
    }

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: userInstruction
          ? `${resolvedMode === 'scan-label' ? 'ส่งฉลากยา' : 'ส่งไฟล์'}: "${userInstruction}"`
          : isPdfFile
          ? `ส่งไฟล์ PDF: ${imageFile.name}`
          : resolvedMode === 'scan-label'
          ? 'ส่งรูปฉลากยาเพื่อเช็กวันหมดอายุ'
          : resolvedMode === 'audit-paper'
          ? 'ส่งรูปใบตรวจเช็กเพื่ออ่านข้อมูล'
          : 'ส่งรูปภาพให้น้องออร่าตรวจสอบ',
        timestamp: userTime,
        image: isPdfFile ? undefined : preparedDataUrl,
        attachmentName: isPdfFile ? imageFile.name : undefined,
        isPdfAttachment: isPdfFile,
      },
    ]);

    setScanProgress({
      current: 45,
      total: 100,
      text: '2/2 น้องออร่ากำลังอ่านข้อมูลและจับคู่รายการ...',
    });

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        const next = Math.min(92, (prev?.current || 45) + 7);
        return {
          current: next,
          total: 100,
          text: `2/2 น้องออร่ากำลังอ่านข้อมูลและจับคู่รายการ... (${next}%)`,
        };
      });
    }, 400);

    try {
      const catalog = buildUnifiedCatalog();
      const visionResult = await smartVisionScan(preparedDataUrl, resolvedMode, catalog);

      if (visionResult.success && visionResult.items.length > 0) {
        clearInterval(progressTimer);
        setScanProgress({
          current: 100,
          total: 100,
          text: 'อ่านข้อมูลสำเร็จเรียบร้อยแล้วค่ะ',
        });

        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (visionResult.detectedType === 'drug_label') {
          const mappedLabelItems: LabelScanItem[] = visionResult.items.map((it) => ({
            itemName: it.name,
            expDate: it.expiryDate || '-',
            lotNumber: it.lotNumber || '',
            confidenceNote: it.note || '',
          }));
          const labelScanData = buildLabelScanData(mappedLabelItems);
          setMessages((prev) => [
            ...prev,
            {
              sender: 'ai',
              text: visionResult.summaryMessage,
              timestamp: replyTime,
              isCard: true,
              labelScanData,
            },
          ]);
          notifyUnreadIfClosed();
          speakText('น้องออร่าสแกนฉลากและวันหมดอายุเรียบร้อยแล้วค่ะ กดอัปเดตลงตารางได้เลยนะคะ');
          return;
        }

        // Map checklist_table items to Auto-Fill preview card
        const mappedParsedItems = visionResult.items.map((it) => ({
          name: it.name,
          expected: String(it.quantity ?? 1),
          actual: it.status === 'ready' ? String(it.quantity ?? 1) : '0',
          exp: it.expiryDate || undefined,
          status:
            it.status === 'expired'
              ? ('EXPIRED' as const)
              : it.status === 'low' || it.status === 'damaged'
              ? ('INCOMPLETE' as const)
              : ('COMPLETE' as const),
          issue: it.note || undefined,
        }));

        const completeCount = mappedParsedItems.filter((i) => i.status === 'COMPLETE').length;
        const diffItems = mappedParsedItems.filter((i) => i.status !== 'COMPLETE');

        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: visionResult.summaryMessage,
            timestamp: replyTime,
            isCard: true,
            parsedItems: mappedParsedItems,
            diffSummary: {
              total: mappedParsedItems.length,
              completeCount,
              diffCount: diffItems.length,
              restockCount: diffItems.length,
            },
            diffItems,
            restockItems: diffItems,
          },
        ]);
        notifyUnreadIfClosed();
        speakText('น้องออร่าอ่านใบตรวจเช็กเรียบร้อยแล้วค่ะ สามารถกดยืนยันลงข้อมูลเข้าเว็บได้เลยนะคะ');
        return;
      }

      // Fallback for dense handwritten checklist tables if unified schema returned empty (images only)
      if (!isPdfFile && (resolvedMode === 'audit-paper' || resolvedMode === 'auto')) {
        const extractedResult = await readPaperChecklistOnly(preparedDataUrl);
        if (extractedResult.parsedItems && extractedResult.parsedItems.length > 0) {
          clearInterval(progressTimer);
          setScanProgress({
            current: 100,
            total: 100,
            text: 'อ่านข้อมูลตารางในรูปกระดาษเรียบร้อยแล้วค่ะ',
          });
          const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages((prev) => [
            ...prev,
            {
              sender: 'ai',
              text: extractedResult.text || 'อ่านข้อมูลในตารางเรียบร้อยแล้วค่ะ',
              timestamp: replyTime,
              isCard: true,
              parsedItems: extractedResult.parsedItems,
              targetLocation: extractedResult.targetLocation,
              targetName: extractedResult.targetName,
              diffSummary: extractedResult.diffSummary,
              diffItems: extractedResult.diffItems,
              restockItems: extractedResult.restockItems,
            },
          ]);
          notifyUnreadIfClosed();
          return;
        }
      }

      clearInterval(progressTimer);
      addMessage(
        'ai',
        visionResult.error || 'อ่านรูปภาพไม่พบรายการที่ชัดเจน กรุณาลองถ่ายใหม่อีกครั้งให้เห็นตัวหนังสือชัดขึ้นนะคะ'
      );
    } catch (error: any) {
      clearInterval(progressTimer);
      console.error('OCR Error:', error);
      const errTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'เกิดข้อผิดพลาดในการอ่านไฟล์ภาพ กรุณาลองถ่ายใหม่อีกครั้งในที่ที่มีแสงสว่างชัดเจนค่ะ',
          timestamp: errTime,
        },
      ]);
      notifyUnreadIfClosed();
    } finally {
      clearInterval(progressTimer);
      setIsLoading(false);
      setScanProgress(null);
    }
  };

  // หมุนภาพของผู้ใช้เพิ่มเติม (180° หรือ 90°) และสแกนใหม่ทันที
  const handleRotateUserImage = async (msgIndex: number, degrees: number) => {
    if (isLoading || dbActionStatus) return;
    const targetMsg = messages[msgIndex];
    if (!targetMsg || !targetMsg.image) return;

    setIsLoading(true);
    setScanProgress({
      current: 15,
      total: 100,
      text: `🔄 กำลังหมุนภาพ ${degrees}° และสแกนใหม่...`,
    });

    try {
      const newRotated = await rotateImageDegrees(targetMsg.image, degrees);
      setMessages((prev) => {
        const next = [...prev];
        next[msgIndex] = {
          ...next[msgIndex],
          image: newRotated,
        };
        return next;
      });

      const extractedResult = await readPaperChecklistOnly(newRotated);
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: extractedResult.text || 'หมุนภาพและอ่านข้อมูลตารางใหม่เรียบร้อยแล้วค่ะ ✨🌸',
          timestamp: replyTime,
          isCard: true,
          parsedItems: extractedResult.parsedItems,
          targetLocation: extractedResult.targetLocation,
          targetName: extractedResult.targetName,
          diffSummary: extractedResult.diffSummary,
          diffItems: extractedResult.diffItems,
          restockItems: extractedResult.restockItems,
        },
      ]);
      notifyUnreadIfClosed();
      speakText('น้องออร่าหมุนภาพและสแกนตารางใหม่เรียบร้อยแล้วค่ะ');
    } catch (e) {
      console.warn('Manual rotate error:', e);
    } finally {
      setIsLoading(false);
      setScanProgress(null);
    }
  };

  const addMessage = (
    sender: 'ai' | 'user',
    text: string,
    isCard = false,
    actionBtn?: { label: string; onClick: () => void },
    image?: string,
    suggestedChoices?: string[],
    extra?: Partial<ChatMessage>
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { sender, text, timestamp: timeStr, isCard, actionBtn, image, suggestedChoices, ...extra },
    ]);
    if (sender === 'ai') {
      notifyUnreadIfClosed();
      if (!isCard) {
        speakText(text);
      }
    }
  };

  const handleActionMetaClick = (meta: ActionMeta) => {
    if (meta.type === 'navigate' && meta.view) {
      onNavigate?.(meta.view, meta.category);
      handleClose();
    } else if (meta.type === 'open_file_picker') {
      fileInputRef.current?.click();
    } else if (meta.type === 'open_report') {
      onOpenReportModal?.(meta.reportCategory || 'bag', meta.reportWeek);
      handleClose();
    } else if (meta.type === 'send_command' && meta.command) {
      processCommand(meta.command);
    }
  };

  const handleCopyHandover = async (text: string, msgIdx: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedHandoverIdx(msgIdx);
    setTimeout(() => setCopiedHandoverIdx((prev) => (prev === msgIdx ? null : prev)), 2500);
  };

  const handleUndoSnapshot = async (msgIdx: number) => {
    const targetMsg = messages[msgIdx];
    const snap = targetMsg?.undoSnapshot;
    if (!snap || targetMsg.undoApplied || !onRestoreSnapshot || dbActionStatus) return;

    setDbActionStatus('กำลังดำเนินการ...');
    try {
      const ok = await onRestoreSnapshot(snap);
      if (ok) {
        setMessages((prev) => {
          const next = [...prev];
          next[msgIdx] = { ...next[msgIdx], undoApplied: true };
          return next;
        });
        addMessage(
          'ai',
          `↩️ ย้อนกลับข้อมูล (${snap.label}) เรียบร้อยแล้วค่ะ ข้อมูลกลับสู่สถานะเดิมก่อนแก้ไขและบันทึกลง Cloud แล้วค่ะ ✨🌸`
        );
      } else {
        addMessage('ai', '❌ ไม่สามารถย้อนกลับข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งนะคะ');
      }
    } finally {
      setDbActionStatus(null);
    }
  };

  // 📋 1-Tap Shift Handover Summary Generator (สรุปส่งเวรพยาบาลวิสัญญี)
  const buildShiftHandoverReport = (): string => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeLabel = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const nurseName =
      (typeof window !== 'undefined' && localStorage.getItem('user_display_name')) || 'พยาบาลวิสัญญีเวรปัจจุบัน';

    // 1. อุปกรณ์ชำรุด / ผิดปกติ (ทุกห้อง OR, กระเป๋า, รถฉุกเฉิน - กรองข้อมูลขยะทดสอบ)
    const defectiveItems: string[] = [];
    Object.entries(equipment || {}).forEach(([roomId, roomList]) => {
      const roomChecks = globalChecks?.[roomId] || {};
      (roomList || []).forEach((eq: any, idx: number) => {
        if (isJunkEquipmentRecord(eq.name, eq.id)) return;
        const itemKey = eq.id || `${roomId}_${idx}`;
        const chk = roomChecks[itemKey];
        if (chk?.result === 'ผิดปกติ') {
          defectiveItems.push(
            `• ${eq.name} [ห้อง ${roomId.toUpperCase()}]${chk.note ? ` — ${chk.note}` : ''}`
          );
        }
      });
    });

    (['bag', 'cart'] as const).forEach((cat) => {
      const catLabel = cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน';
      const catChecks = globalChecks?.[cat] || {};
      Object.entries(lists?.[cat]?.groups || {}).forEach(([gName, gItems]: [string, any]) => {
        (gItems || []).forEach((it: any, idx: number) => {
          if (isJunkEquipmentRecord(it.name, it.id)) return;
          const itemKey = it.id || `${cat}_${gName}_${idx}`;
          const chk = catChecks[itemKey];
          if (chk?.result === 'ผิดปกติ') {
            defectiveItems.push(`• ${it.name} [${catLabel}]${chk.note ? ` — ${chk.note}` : ''}`);
          }
        });
      });
    });

    // 2. รายการยังไม่ครบ / รอตรวจเช็กในกระเป๋า & รถฉุกเฉิน
    const uncheckedSummary: string[] = [];
    (['bag', 'cart'] as const).forEach((cat) => {
      const catLabel = cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน';
      const catChecks = globalChecks?.[cat] || {};
      let total = 0;
      let checkedOk = 0;
      const missingNames: string[] = [];
      Object.entries(lists?.[cat]?.groups || {}).forEach(([gName, gItems]: [string, any]) => {
        (gItems || []).forEach((it: any, idx: number) => {
          if (isJunkEquipmentRecord(it.name, it.id)) return;
          total++;
          const itemKey = it.id || `${cat}_${gName}_${idx}`;
          const chk = catChecks[itemKey];
          if (chk?.result === 'ปกติ') {
            checkedOk++;
          } else {
            missingNames.push(it.name);
          }
        });
      });
      if (total > 0 && checkedOk < total) {
        const sample = missingNames.slice(0, 3).join(', ');
        uncheckedSummary.push(
          `• ${catLabel}: ตรวจปกติ ${checkedOk}/${total} รายการ (ขาด/รอตรวจ ${total - checkedOk} รายการ${
            sample ? `: ${sample}${missingNames.length > 3 ? '...' : ''}` : ''
          })`
        );
      } else if (total > 0) {
        uncheckedSummary.push(`• ${catLabel}: ครบพร้อมใช้งาน (${checkedOk}/${total} รายการ ✅)`);
      }
    });

    // 3. ยาใกล้หมดอายุ (<= 30 วัน) และยาต่ำกว่า Min Stock
    const expiringDrugs: string[] = [];
    const lowStockDrugs: string[] = [];
    (drugs || []).forEach((d: any) => {
      const expStr = d.expDate || d.exp;
      if (expStr && expStr !== '-') {
        const dObj = parseExpDateObj(expStr);
        if (dObj) {
          const diffDays = Math.ceil((dObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) {
            expiringDrugs.push(
              `• ${d.name}: EXP ${expStr} (${diffDays <= 0 ? 'หมดอายุแล้ว!' : `อีก ${diffDays} วัน`})`
            );
          }
        }
      }
      const qty = Number(d.remaining ?? d.totalQty ?? 0);
      const min = Number(d.minStock ?? 0);
      if (min > 0 && qty <= min) {
        lowStockDrugs.push(`• ${d.name}: เหลือ ${qty} ${d.unit || 'ชิ้น'} (Min: ${min})`);
      }
    });

    const lines: string[] = [
      `📋 สรุปส่งเวรงานวิสัญญี (${activeChannel?.name || 'OR Master'})`,
      `🗓️ ${dateLabel} เวลา ${timeLabel} น. | ผู้สรุป: ${nurseName}`,
      ``,
      `1) 🔧 อุปกรณ์ชำรุด / ผิดปกติ (${defectiveItems.length} รายการ):`,
      defectiveItems.length > 0 ? defectiveItems.join('\n') : '• ไม่มีรายการชำรุด ✅',
      ``,
      `2) 🎒 สถานะกระเป๋า & รถฉุกเฉิน:`,
      uncheckedSummary.length > 0 ? uncheckedSummary.join('\n') : '• ไม่มีข้อมูลรายการ',
      ``,
      `3) ⚠️ ยาหมดอายุ / ใกล้หมดอายุ ≤ 30 วัน (${expiringDrugs.length} รายการ):`,
      expiringDrugs.length > 0 ? expiringDrugs.join('\n') : '• ไม่มียาใกล้หมดอายุ ✅',
      ``,
      `4) 📉 ยาต่ำกว่าเกณฑ์ Min Stock (${lowStockDrugs.length} รายการ):`,
      lowStockDrugs.length > 0 ? lowStockDrugs.join('\n') : '• สต็อกยาเพียงพอทุกรายการ ✅',
    ];

    return lines.join('\n');
  };

  const handleGenerateShiftHandover = () => {
    if (isLoading || dbActionStatus) return;
    const handoverText = buildShiftHandoverReport();
    addMessage(
      'ai',
      handoverText,
      true,
      undefined,
      undefined,
      ['💊 ตรวจสอบยาใกล้หมดอายุ', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน'],
      { handoverText }
    );
    speakText('น้องออร่าสรุปข้อมูลส่งเวรเรียบร้อยแล้วค่ะ สามารถกดคัดลอกข้อความเพื่อวางในแชตกลุ่มได้เลยนะคะ');
  };

  /**
   * Pure LLM Brain Engine: Sends 100% of user text/voice/multi-attachments directly
   * to /api/ai/chat with full inventory context (drugs, equipment, bags, carts) — ZERO regex/rule interceptors.
   */
  const buildFullChatInventoryContext = () => {
    const compactDrugs = (drugs || []).map((d: any) => ({
      id: String(d.id || ''),
      name: String(d.name || ''),
      spec: String(d.spec || ''),
      remaining: d.remaining ?? d.totalQty ?? 0,
      minStock: d.minStock ?? 0,
      unit: String(d.unit || 'ชิ้น'),
      expDate: String(d.expDate || d.exp || '-'),
      location: 'คลังยาวิสัญญี',
      note: String(d.note || '').slice(0, 120),
    }));

    const compactEquipment: Record<string, any[]> = {};
    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      const roomChecks = globalChecks?.[roomId] || {};
      const cleaned = (items || [])
        .filter((eq: any) => !isJunkEquipmentRecord(eq?.name, eq?.id))
        .map((eq: any, idx: number) => {
          const itemKey = eq.id || `${roomId}_${idx}`;
          const chk = roomChecks[itemKey] || {};
          return {
            id: itemKey,
            no: String(eq.no ?? idx + 1),
            code: String(eq.code || ''),
            sap: String(eq.sap || ''),
            name: String(eq.name || ''),
            location: String(eq.location || `ห้อง ${roomId.toUpperCase()}`),
            roomId,
            qty: eq.unitText || eq.qty || '1',
            exp: String(chk.exp || eq.exp || '-'),
            status: String(chk.result || 'รอตรวจ'),
            note: String(chk.note || eq.note || '').slice(0, 120),
          };
        });
      if (cleaned.length > 0) {
        compactEquipment[roomId] = cleaned;
      }
    });

    const buildEmergencyList = (cat: 'bag' | 'cart') => {
      const catChecks = globalChecks?.[cat] || {};
      const rows: any[] = [];
      Object.entries(lists?.[cat]?.groups || {}).forEach(([gName, gItems]: [string, any]) => {
        (gItems || []).forEach((it: any, idx: number) => {
          if (isJunkEquipmentRecord(it?.name, it?.id)) return;
          const itemKey = it.id || `${cat}_${gName}_${idx}`;
          const chk = catChecks[itemKey] || {};
          rows.push({
            id: itemKey,
            name: String(it.name || ''),
            spec: String(it.spec || ''),
            qty: String(it.unitText || it.qty || '1'),
            exp: String(chk.exp || it.exp || '-'),
            location: `${cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : 'รถฉุกเฉิน'} (${gName})`,
            status: String(chk.result || 'รอตรวจ'),
            note: String(chk.note || it.note || '').slice(0, 120),
          });
        });
      });
      return rows;
    };

    const bags = buildEmergencyList('bag');
    const carts = buildEmergencyList('cart');

    return {
      ...buildAuraLiveContext(drugs, equipment, lists, globalChecks),
      drugs: compactDrugs,
      equipment: compactEquipment,
      bags,
      carts,
      currentView,
      grandTotal: stats?.grandTotal ?? 0,
      grandDefective: stats?.grandDefective ?? 0,
    };
  };

  const buildCompactAppContext = () => {
    const eqSummary: Array<{
      id: string;
      orderNumber: string;
      name: string;
      room: string;
      status: string;
      hasImage: boolean;
    }> = [];
    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      ((items as any[]) || []).forEach((it: any) => {
        if (it && it.name) {
          eqSummary.push({
            id: it.id || '',
            orderNumber: String(it.orderNumber ?? it.no ?? '').trim(),
            name: String(it.name).trim(),
            room: roomId,
            status: String(it.status || 'ปกติ').trim(),
            hasImage: Boolean(it.img),
          });
        }
      });
    });

    const expiringDrugs = (drugs || []).filter((d: any) => {
      const exp = d?.expDate || d?.exp;
      if (!exp || exp === '-') return false;
      const dExp = new Date(exp).getTime();
      const diffDays = (dExp - Date.now()) / (1000 * 60 * 60 * 24);
      return diffDays <= 90;
    });

    const lowDrugs = (drugs || []).filter((d: any) => {
      const rem = d?.remaining ?? d?.totalQty ?? 0;
      const min = d?.minStock ?? 5;
      return rem <= min;
    });

    return {
      currentRoute: currentView,
      equipmentSummary: eqSummary.slice(0, 300),
      alertSummary: {
        expiringDrugsCount: expiringDrugs.length,
        lowStockDrugsCount: lowDrugs.length,
        uncheckedRoomsCount: Math.max(0, 10 - Object.keys(globalChecks || {}).length),
        totalRoomsCount: 10,
      },
    };
  };

  const allEquipmentOptions = useMemo(() => {
    const list: Array<{ id: string; no: string; name: string; roomId: string; label: string }> = [];
    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      ((items as any[]) || []).forEach((it: any) => {
        if (it && it.name) {
          const noStr = String(it.orderNumber ?? it.no ?? '').trim();
          list.push({
            id: it.id || '',
            no: noStr,
            name: String(it.name).trim(),
            roomId,
            label: `${noStr ? `[ลำดับ ${noStr}] ` : ''}${it.name} (${roomId.toUpperCase()})`,
          });
        }
      });
    });
    return list.sort((a, b) => {
      const na = parseInt(a.no, 10);
      const nb = parseInt(b.no, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.name.localeCompare(b.name, 'th');
    });
  }, [equipment]);

  const handleConfirmPhotoMatch = async () => {
    if (!pendingPhotoMatchSession || pendingPhotoMatchSession.matched.length === 0) return;
    const session = pendingPhotoMatchSession;
    setPendingPhotoMatchSession(null);
    setDbActionStatus('กำลังบันทึกรูปภาพเข้าครุภัณฑ์...');

    try {
      const snap = session.snapshot || onCaptureSnapshot?.('ก่อนแนบรูปภาพเข้าครุภัณฑ์');
      const attachRes = await onAttachEquipmentPhotos!({
        mappings: session.matched.map((m) => ({
          imageIndex: m.imageIndex,
          equipmentId: m.equipmentId,
          orderNumber: m.orderNumber,
          detectedNumber: m.detectedNumber,
          equipmentName: m.equipmentName,
        })),
        attachments: session.allAttachments,
      });

      const updatedCount = attachRes.updatedItems.length;
      const successLines: string[] = [
        `📸 บันทึกรูปภาพเข้าครุภัณฑ์สำเร็จ ${updatedCount} รายการ (บันทึกลง Cloud แล้วค่ะ ✨🌸):`,
      ];
      attachRes.updatedItems.forEach((u) => {
        successLines.push(
          `• รูป #${u.imageIndex + 1} (เลข ${u.detectedNumber}) ➔ **${u.equipmentName}** [${u.roomId.toUpperCase()}]`
        );
      });

      addMessage(
        'ai',
        successLines.join('\n'),
        true,
        undefined,
        undefined,
        ['🏥 เปิดดูหน้าครุภัณฑ์', '🔍 เช็กครุภัณฑ์ที่ยังขาดรูป', '📋 สรุปส่งเวร (Shift Handover)'],
        { undoSnapshot: snap }
      );

      setUiNotice(`📸 บันทึกรูปภาพเข้าครุภัณฑ์สำเร็จ ${updatedCount} รายการ`);
      setTimeout(() => setUiNotice(null), 3500);
    } catch (err: any) {
      console.error('Attach photos commit error:', err);
      setUiNotice('เกิดข้อผิดพลาดในการบันทึกรูปภาพ');
      setTimeout(() => setUiNotice(null), 4000);
    } finally {
      setDbActionStatus(null);
    }
  };

  const handleCheckMissingEquipmentImages = () => {
    const roomMissingMap: Record<string, Array<{ no: string; name: string }>> = {};
    let totalMissing = 0;
    let totalEquipment = 0;

    Object.entries(equipment || {}).forEach(([roomId, items]) => {
      ((items as any[]) || []).forEach((it: any) => {
        if (it && it.name) {
          totalEquipment++;
          if (!it.img || !it.img.trim()) {
            totalMissing++;
            if (!roomMissingMap[roomId]) roomMissingMap[roomId] = [];
            roomMissingMap[roomId].push({
              no: String(it.orderNumber ?? it.no ?? '-').trim(),
              name: it.name,
            });
          }
        }
      });
    });

    if (totalMissing === 0) {
      addMessage(
        'ai',
        `🎉 ยอดเยี่ยมมากค่ะ! ครุภัณฑ์ทั้งหมด ${totalEquipment} รายการมีรูปภาพครบถ้วน 100% แล้วนะคะ ✨🌸`,
        false,
        undefined,
        undefined,
        ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)']
      );
      return;
    }

    const lines: string[] = [
      `🔍 **สรุปรายการครุภัณฑ์ที่ยังไม่มีรูปภาพ (ขาด ${totalMissing} จาก ${totalEquipment} รายการ):**`,
    ];
    Object.entries(roomMissingMap).forEach(([roomId, items]) => {
      const numbers = items
        .map((i) => (i.no !== '-' ? `ลำดับ ${i.no}` : i.name))
        .slice(0, 10)
        .join(', ');
      const more = items.length > 10 ? ` และอีก ${items.length - 10} รายการ` : '';
      lines.push(`• **ห้อง ${roomId.toUpperCase()}** (${items.length} รายการ): ${numbers}${more}`);
    });
    lines.push(
      `\n💡 **คำแนะนำ:** พี่พยาบาลสามารถถ่ายรูปเครื่องมือที่เขียนลำดับกำกับไว้ แล้วกดปุ่ม **[📸 ใส่รูปครุภัณฑ์ตามเลขในภาพ]** ด้านล่าง น้องออร่าจะจับคู่และใส่รูปภาพให้อัตโนมัติค่ะ ✨🌸`
    );

    addMessage(
      'ai',
      lines.join('\n'),
      false,
      undefined,
      undefined,
      ['📸 ใส่รูปครุภัณฑ์ตามเลขในภาพ', '🏥 เปิดดูหน้าครุภัณฑ์']
    );
  };

  const processCommand = async (rawQuery: string) => {
    const activeAttachments = [...pendingAttachments];
    const trimmedInput = rawQuery.trim();
    const query =
      trimmedInput ||
      (activeAttachments.length === 1
        ? `ช่วยอ่านและวิเคราะห์ไฟล์ ${activeAttachments[0].fileName} นี้ให้หน่อยค่ะ`
        : activeAttachments.length > 1
        ? `ช่วยวิเคราะห์รูปภาพที่แนบมาทั้ง ${activeAttachments.length} รูปนี้ให้หน่อยค่ะ`
        : '');
    if (!query) return;

    // 🔒 Double-send lock: block overlapping submissions while loading or writing DB
    if (isLoading || dbActionStatus || isProcessingAttachment) return;

    const imageUrls = activeAttachments.filter((a) => !a.isPdf).map((a) => a.dataUrl);
    const pdfAtt = activeAttachments.find((a) => a.isPdf);

    addMessage(
      'user',
      query,
      false,
      undefined,
      imageUrls.length === 1 ? imageUrls[0] : undefined,
      undefined,
      {
        ...(imageUrls.length > 1 ? { images: imageUrls } : {}),
        ...(pdfAtt ? { attachmentName: pdfAtt.fileName, isPdfAttachment: true } : {}),
      }
    );

    setInputMessage('');
    if (activeAttachments.length > 0) {
      setPendingAttachments([]);
    }
    setIsLoading(true);

    isUserStoppedRef.current = false;

    const isPhotoAttachIntent =
      pendingScanMode === 'match-photos' ||
      /ตามเลข|ตามหมายเลข|ตามรหัส|ใส่รูป|อัปเดตรูป|แนบรูปตัวเครื่อง|แปะรูป|ตัวเลขในภาพ|ตัวเลขบนรูป|ตามลำดับที่ทราบ|รูปพวกนี้ใส่ในครุ|รูปเครื่องมือ|ภาพเครื่องมือ|แอดรูป/i.test(
        query
      );
    const isChecklistOrLabelIntent =
      /ใบตรวจ|เช็กยอด|เช็กลิส|กระเป๋าฉุกเฉิน|รถฉุกเฉิน|ฉลากยา|วันหมดอายุ|\bexp\b/i.test(query);
    const isBulkEquipmentTable =
      activeAttachments.length > 0 &&
      !isPhotoAttachIntent &&
      !isChecklistOrLabelIntent &&
      (pendingScanMode === 'bulk-import' ||
        ((/ตาราง|ทะเบียน/i.test(query) ||
          query.includes('ทะเบียนครุภัณฑ์') ||
          query.includes('ตารางครุภัณฑ์')) &&
          (/ครุภัณฑ์|นำเข้า|แอดเข้า/i.test(query))));

    const fullInventoryContext = buildFullChatInventoryContext();
    const compactAppContext = buildCompactAppContext();

    const requestContext = isBulkEquipmentTable
      ? {
          channelName: activeChannel?.name || 'คลินิกวิสัญญี (Master)',
          modeHint: 'BULK_IMPORT_EQUIPMENT',
          ...compactAppContext,
        }
      : isPhotoAttachIntent
      ? {
          channelName: activeChannel?.name || 'คลินิกวิสัญญี (Master)',
          modeHint: 'MATCH_EQUIPMENT_PHOTOS',
          ...fullInventoryContext,
          ...compactAppContext,
        }
      : {
          ...fullInventoryContext,
          ...compactAppContext,
        };

    // Helper to convert AI OCR row (13-field schema or legacy alias) into VerificationEquipmentRow
    const normalizeToVerificationRow = (
      raw: any,
      pageIndex: number,
      rowIdx: number
    ): VerificationEquipmentRow => {
      const seqVal = String(raw?.seq ?? raw?.orderNumber ?? raw?.no ?? rowIdx + 1).trim();
      const assetVal = String(raw?.asset_number ?? raw?.assetCode ?? raw?.code ?? '').trim();
      const sapVal = String(raw?.sap_code ?? raw?.sapCode ?? raw?.sap ?? '').trim();
      const brandVal = String(raw?.brand_model ?? raw?.brandModel ?? raw?.spec ?? '').trim();
      const sourceVal = String(raw?.source_budget ?? raw?.source ?? '').trim();
      const dateVal = String(raw?.acquired_date ?? raw?.date ?? '').trim();
      const qtyVal = String(raw?.quantity ?? raw?.qty ?? '1').trim() || '1';
      const priceVal = String(raw?.price ?? '').replace(/,/g, '').trim();
      const locOfficialVal = String(raw?.location_official ?? raw?.location ?? '').trim();
      const handwrittenVal = String(raw?.handwritten_note ?? raw?.note ?? '').trim();
      const isMarkedXVal = Boolean(raw?.is_marked_x ?? raw?.isMarked);
      const statusVal = String(raw?.status || 'ปกติ').trim() || 'ปกติ';

      return {
        _rowId: `eq_ver_${Date.now()}_p${pageIndex}_r${rowIdx}_${Math.random().toString(36).slice(2, 6)}`,
        _selected: true,
        _pageIndex: pageIndex,
        seq: seqVal,
        orderNumber: seqVal,
        asset_number: assetVal,
        assetCode: assetVal,
        sap_code: sapVal,
        sapCode: sapVal,
        name: String(raw?.name || '').trim(),
        brand_model: brandVal,
        brandModel: brandVal,
        source_budget: sourceVal,
        source: sourceVal,
        acquired_date: dateVal,
        date: dateVal,
        quantity: qtyVal,
        qty: qtyVal,
        price: priceVal,
        location_official: locOfficialVal,
        location: locOfficialVal,
        handwritten_note: handwrittenVal,
        note: handwrittenVal,
        is_marked_x: isMarkedXVal,
        isMarked: isMarkedXVal || Boolean(handwrittenVal),
        status: statusVal,
      };
    };

    // Auto-Orientation & Contrast Enhancement for Equipment Registry Table Images
    let processedAttachments = activeAttachments;
    const verificationPageImages: VerificationPageImage[] = [];
    if (isBulkEquipmentTable && activeAttachments.length > 0) {
      setScanProgress({
        current: 0,
        total: activeAttachments.length,
        text: `กำลังปรับทิศทางภาพและความคมชัด (${activeAttachments.length} แผ่น)...`,
      });
      const enhancedList: PendingAttachmentItem[] = [];
      for (let i = 0; i < activeAttachments.length; i++) {
        const att = activeAttachments[i];
        if (att.isPdf) {
          enhancedList.push(att);
          continue;
        }
        try {
          const enhanced = await preprocessTableImageForOcr(att.dataUrl);
          enhancedList.push({
            ...att,
            base64: enhanced.base64,
            dataUrl: enhanced.dataUrl,
            previewUrl: enhanced.dataUrl,
            mimeType: enhanced.mimeType,
          });
          verificationPageImages.push({
            pageIndex: i,
            fileName: att.fileName,
            previewUrl: enhanced.dataUrl,
            rotatedDegrees: enhanced.rotatedDegrees,
          });
        } catch {
          enhancedList.push(att);
          verificationPageImages.push({
            pageIndex: i,
            fileName: att.fileName,
            previewUrl: att.previewUrl || att.dataUrl,
            rotatedDegrees: 0,
          });
        }
      }
      processedAttachments = enhancedList;
    }

    // 📸 Dedicated Photo-Matching Mode with Background Sub-Batching (10 images per batch)
    if (isPhotoAttachIntent && processedAttachments.length > 0) {
      const totalImages = processedAttachments.length;
      const queueSnap = onCaptureSnapshot?.('ก่อนแนบรูปภาพเข้าครุภัณฑ์');
      const progressMsgId = `photo_match_progress_${Date.now()}`;
      const progressTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages((prev) => [
        ...prev,
        {
          id: progressMsgId,
          sender: 'ai',
          text: `⏳ กำลังวิเคราะห์รูปภาพเครื่องมือแพทย์ (${totalImages} รูป)...`,
          timestamp: progressTime,
        },
      ]);

      const updateProgressBubble = (newText: string, extra?: Partial<ChatMessage>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === progressMsgId ? { ...m, text: newText, ...extra } : m))
        );
      };

      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(totalImages / BATCH_SIZE);
      const collectedMappings: any[] = [];

      const uploadSessionId = `session_${Date.now()}`;
      for (let b = 0; b < totalBatches; b++) {
        if (isUserStoppedRef.current) break;
        const bStart = b * BATCH_SIZE;
        const bEnd = Math.min(totalImages, (b + 1) * BATCH_SIZE);
        const batchItems = processedAttachments.slice(bStart, bEnd);

        setScanProgress({
          current: b + 1,
          total: totalBatches,
          text: `กำลังวิเคราะห์รูปภาพชุดที่ ${b + 1}/${totalBatches} (รูปที่ ${bStart + 1}-${bEnd} จาก ${totalImages} รูป)...`,
        });
        updateProgressBubble(
          `⏳ กำลังวิเคราะห์รูปภาพชุดที่ ${b + 1}/${totalBatches} (รูปที่ ${bStart + 1}-${bEnd} จาก ${totalImages} รูป)...`
        );

        const batchResult = await executePhotoMatchBatchWithRetry(
          batchItems,
          bStart,
          query,
          compactAppContext,
          requestContext,
          activeChannel?.name || 'คลินิกวิสัญญี (Master)'
        );

        collectedMappings.push(...batchResult.mappings);

        await savePendingPhotoSession(
          {
            sessionId: uploadSessionId,
            timestamp: Date.now(),
            query,
            totalImages,
            completedBatches: b + 1,
            totalBatches,
            completedCount: bEnd,
            collectedMappings,
            itemsMeta: processedAttachments.map((att, idx) => ({
              index: idx,
              fileName: att.fileName,
              completed: idx < bEnd,
            })),
          },
          processedAttachments
        );
      }

      await clearPendingPhotoSession();
      setPendingUploadRecovery(null);

      // Match collected numbers against existing equipment records
      const mappingByIndex = new Map<number, any>();
      collectedMappings.forEach((m) => {
        mappingByIndex.set(Number(m.imageIndex), m);
      });

      const matchedList: any[] = [];
      const unmatchedList: any[] = [];

      processedAttachments.forEach((att, idx) => {
        const m = mappingByIndex.get(idx);
        const targetNum = String(m?.orderNumber || m?.detectedNumber || '').trim();
        const targetNumInt = parseInt(targetNum, 10);
        const targetId = String(m?.equipmentId || '').trim();

        let foundEq: any = null;
        let foundRoom = '';

        // Match by equipment ID
        if (targetId) {
          for (const [rId, rItems] of Object.entries(equipment || {})) {
            const match = ((rItems as any[]) || []).find((it: any) => it.id === targetId);
            if (match) {
              foundEq = match;
              foundRoom = rId;
              break;
            }
          }
        }

        // Match by orderNumber / no / code / sap
        if (!foundEq && targetNum) {
          for (const [rId, rItems] of Object.entries(equipment || {})) {
            const match = ((rItems as any[]) || []).find((it: any) => {
              const itNo = String(it.no ?? '').trim();
              const itOrder = String(it.orderNumber ?? '').trim();
              const itCode = String(it.code || it.assetCode || '').trim();
              const itSap = String(it.sap || it.sapCode || '').trim();
              if (
                itOrder === targetNum ||
                itNo === targetNum ||
                itCode === targetNum ||
                itSap === targetNum
              ) {
                return true;
              }
              if (!Number.isNaN(targetNumInt) && targetNumInt > 0) {
                return parseInt(itNo, 10) === targetNumInt || parseInt(itOrder, 10) === targetNumInt;
              }
              return false;
            });
            if (match) {
              foundEq = match;
              foundRoom = rId;
              break;
            }
          }
        }

        if (foundEq && !m?.unmatched) {
          matchedList.push({
            imageIndex: idx,
            orderNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
            detectedNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
            equipmentId: foundEq.id,
            equipmentName: foundEq.name,
            roomId: foundRoom,
            dataUrl: att.dataUrl,
            fileName: att.fileName,
            unmatched: false,
          });
        } else {
          unmatchedList.push({
            imageIndex: idx,
            orderNumber: targetNum || '',
            detectedNumber: targetNum || '',
            equipmentId: '',
            equipmentName: '',
            roomId: '',
            dataUrl: att.dataUrl,
            fileName: att.fileName,
            reason: m?.reason || 'อ่านตัวเลขไม่ชัดเจนหรือไม่พบในระบบ',
          });
        }
      });

      setPendingPhotoMatchSession({
        totalImages,
        matched: matchedList,
        unmatched: unmatchedList,
        allAttachments: processedAttachments.map((att, idx) => ({
          index: idx,
          dataUrl: att.dataUrl,
          fileName: att.fileName,
        })),
        snapshot: queueSnap,
      });

      updateProgressBubble(
        `📸 วิเคราะห์ครบทั้ง ${totalImages} รูปภาพเรียบร้อยแล้วค่ะ! ✨🌸\n` +
          `• ตรวจพบและจับคู่สำเร็จ: ${matchedList.length}/${totalImages} รายการ\n` +
          (unmatchedList.length > 0 ? `• ต้องระบุลำดับเอง: ${unmatchedList.length} รูป\n` : '') +
          `\nโปรดตรวจสอบรายการในกล่องยืนยันด้านล่างนะคะ 🎀`
      );

      setIsLoading(false);
      setScanProgress(null);
      setPendingScanMode('auto');
      return;
    }

    // 🔁 Sequential Batch Processing: when >1 attachment is queued, process 1 image per request in order with progress updates
    if (processedAttachments.length > 1) {
      const totalPages = processedAttachments.length;
      const queueSnap = onCaptureSnapshot?.('ก่อนนำเข้าข้อมูลหลายรูปภาพ');
      const progressMsgId = `queue_progress_${Date.now()}`;
      const progressTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages((prev) => [
        ...prev,
        {
          id: progressMsgId,
          sender: 'ai',
          text: `⏳ กำลังอ่านแผ่นที่ 1/${totalPages}...`,
          timestamp: progressTime,
        },
      ]);

      const updateProgressBubble = (newText: string, extra?: Partial<ChatMessage>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === progressMsgId ? { ...m, text: newText, ...extra } : m))
        );
      };

      const historySlice = isBulkEquipmentTable
        ? []
        : messages.slice(-6).map((msg) => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          }));

      const pageStatusLogs: string[] = [];
      const collectedEquipmentRows: VerificationEquipmentRow[] = [];
      const attachUpdatedTotal: Array<{
        roomId: string;
        equipmentId: string;
        equipmentName: string;
        detectedNumber: string;
        imageIndex: number;
      }> = [];
      const attachFailedTotal: Array<{
        imageIndex: number;
        detectedNumber?: string;
        equipmentName?: string;
        reason: string;
      }> = [];
      const autoFillItemsTotal: any[] = [];
      let autoFillCat: 'bag' | 'cart' | 'drug' = 'bag';
      let autoFillLocation = 'กระเป๋าฉุกเฉิน';
      const generalReplies: string[] = [];
      let latestChoices: string[] | undefined;
      const allSources: Array<{ title?: string; url: string }> = [];
      let successPagesCount = 0;
      let failedPagesCount = 0;
      let wasAbortedByUser = false;

      // 🔋 Request Screen Wake Lock while processing multi-page queue to prevent mobile sleep / connection drop
      let wakeLockSentinel: any = null;
      try {
        if (
          typeof navigator !== 'undefined' &&
          'wakeLock' in navigator &&
          (navigator as any).wakeLock?.request
        ) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Ignore if Wake Lock is unsupported or denied
      }

      const MAX_RETRIES = 1;
      const REQUEST_TIMEOUT_MS = 45000;

      let saveLock = Promise.resolve();
      const safeAttachPhotos = (arg: any) => {
        return new Promise<any>((resolve, reject) => {
          saveLock = saveLock.then(async () => {
            try {
              const res = await onAttachEquipmentPhotos!(arg);
              resolve(res);
            } catch (err) {
              reject(err);
            }
          });
        });
      };

      let completedSheetsCount = 0;

      const updateLiveProgress = (activeIdx?: number) => {
        const recentLogs = pageStatusLogs.slice(-3);
        const logSuffix = recentLogs.length > 0 ? `\n${recentLogs.join('\n')}` : '';
        const itemCounter =
          collectedEquipmentRows.length > 0
            ? ` (อ่านได้แล้ว ${collectedEquipmentRows.length} รายการ)`
            : '';
        const currentSheetLabel =
          typeof activeIdx === 'number' && activeIdx < totalPages
            ? `⏳ กำลังอ่านแผ่นที่ ${activeIdx + 1}/${totalPages}...`
            : `✅ ประมวลผลครบ ${completedSheetsCount}/${totalPages} แผ่น`;
        updateProgressBubble(
          `${currentSheetLabel}\n✅ สำเร็จแล้ว ${completedSheetsCount}/${totalPages} แผ่น${itemCounter}${logSuffix}`
        );
      };

      const processSheet = async (att: PendingAttachmentItem, sheetIndex: number) => {
        if (isUserStoppedRef.current) return;

        setScanProgress({
          current: sheetIndex,
          total: totalPages,
          text: `กำลังอ่านแผ่นที่ ${sheetIndex + 1}/${totalPages}...`,
        });
        updateLiveProgress(sheetIndex);

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (isUserStoppedRef.current) return;

          const pageController = new AbortController();
          activeControllersRef.current.add(pageController);
          const perPageTimer = setTimeout(() => {
            if (!isUserStoppedRef.current) {
              pageController.abort('TIMEOUT');
            }
          }, REQUEST_TIMEOUT_MS);

          try {
            const res = await authorizedFetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: pageController.signal,
              body: JSON.stringify({
                message: query,
                channelName: activeChannel?.name || 'คลินิกวิสัญญี (Master)',
                history: historySlice,
                liveContext: requestContext,
                context: requestContext,
                attachments: [
                  {
                    index: 0,
                    base64: att.base64,
                    mimeType: att.mimeType,
                    fileName: att.fileName,
                  },
                ],
              }),
            });

            clearTimeout(perPageTimer);
            activeControllersRef.current.delete(pageController);

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              const err: any = new Error(errData?.message || `HTTP ${res.status}`);
              err.httpStatus = res.status;
              throw err;
            }

            const data = await res.json();
            if (!data.success && data.isTimeout) {
              const timeoutErr: any = new Error('Server timeout (45s)');
              timeoutErr.isServerTimeout = true;
              throw timeoutErr;
            }

            if (Array.isArray(data.sources) && data.sources.length > 0) {
              allSources.push(...data.sources);
            }
            if (Array.isArray(data.suggestedChoices) && data.suggestedChoices.length > 0) {
              latestChoices = data.suggestedChoices;
            }

            let stepSummary = '';

            if (data.action?.type === 'BULK_IMPORT_EQUIPMENT') {
              const eqItems = Array.isArray(data.action.equipmentItems)
                ? data.action.equipmentItems
                : [];
              if (eqItems.length > 0) {
                eqItems.forEach((rawIt: any, rIdx: number) => {
                  if (rawIt && String(rawIt.name || '').trim()) {
                    collectedEquipmentRows.push(
                      normalizeToVerificationRow(rawIt, sheetIndex, rIdx)
                    );
                  }
                });
                successPagesCount++;
                stepSummary = `✅ แผ่นที่ ${sheetIndex + 1} อ่านได้ ${eqItems.length} รายการ`;
              } else {
                failedPagesCount++;
                stepSummary = `⚠️ แผ่นที่ ${sheetIndex + 1} ไม่พบรายการครุภัณฑ์ในภาพ`;
              }
            } else if (data.action?.type === 'ATTACH_EQUIPMENT_PHOTOS') {
              const mappings = Array.isArray(data.action.mappings) ? data.action.mappings : [];
              if (mappings.length > 0 && onAttachEquipmentPhotos) {
                const attachRes = await safeAttachPhotos({
                  mappings,
                  attachments: [
                    {
                      index: 0,
                      dataUrl: att.dataUrl,
                      fileName: att.fileName,
                    },
                  ],
                });

                attachUpdatedTotal.push(
                  ...attachRes.updatedItems.map((u: any) => ({ ...u, imageIndex: sheetIndex }))
                );
                attachFailedTotal.push(
                  ...attachRes.failedItems.map((f: any) => ({ ...f, imageIndex: sheetIndex }))
                );
                successPagesCount++;
                stepSummary = `✅ แผ่นที่ ${sheetIndex + 1} สำเร็จ (จับคู่รูป ${attachRes.updatedItems.length} รายการ)`;
              } else {
                failedPagesCount++;
                attachFailedTotal.push({
                  imageIndex: sheetIndex,
                  reason: 'ไม่พบเลขครุภัณฑ์ที่ตรงกันในระบบ',
                });
                stepSummary = `⚠️ แผ่นที่ ${sheetIndex + 1} ไม่พบเลขครุภัณฑ์ที่ตรงกัน`;
              }
            } else if (data.action?.type === 'AUTO_FILL_CHECKS') {
              const rawChecklist = Array.isArray(data.action.checklistItems)
                ? data.action.checklistItems
                : [];
              if (rawChecklist.length > 0) {
                const mappedParsedItems = rawChecklist.map((it: any) => ({
                  name: String(it?.name || '').trim(),
                  expected: String(it?.expected ?? '1').trim(),
                  actual: String(it?.actual ?? '1').trim(),
                  exp: it?.exp && it.exp !== '-' ? String(it.exp).trim() : undefined,
                  status:
                    it?.status === 'EXPIRED'
                      ? ('EXPIRED' as const)
                      : it?.status === 'INCOMPLETE'
                      ? ('INCOMPLETE' as const)
                      : ('COMPLETE' as const),
                  issue: it?.issue ? String(it.issue).trim() : undefined,
                }));
                autoFillItemsTotal.push(...mappedParsedItems);
                if (
                  data.action.targetCategory === 'cart' ||
                  data.action.targetCategory === 'drug' ||
                  data.action.targetCategory === 'bag'
                ) {
                  autoFillCat = data.action.targetCategory;
                }
                if (data.action.targetLocation) {
                  autoFillLocation = data.action.targetLocation;
                }
                successPagesCount++;
                stepSummary = `✅ แผ่นที่ ${sheetIndex + 1} อ่านใบตรวจสำเร็จ (${mappedParsedItems.length} รายการ)`;
              } else {
                failedPagesCount++;
                stepSummary = `⚠️ แผ่นที่ ${sheetIndex + 1} ไม่พบรายการตรวจเช็ก`;
              }
            } else if (data.success && data.text) {
              generalReplies.push(
                `**[แผ่นที่ ${sheetIndex + 1}/${totalPages}: ${att.fileName}]**\n${data.text}`
              );
              successPagesCount++;
              stepSummary = `✅ แผ่นที่ ${sheetIndex + 1} วิเคราะห์สำเร็จ`;
            } else {
              failedPagesCount++;
              stepSummary = `⚠️ แผ่นที่ ${sheetIndex + 1} ข้ามชั่วคราว (${data?.message || 'อ่านภาพไม่สำเร็จ'})`;
            }

            completedSheetsCount++;
            pageStatusLogs.push(stepSummary);
            setScanProgress({
              current: completedSheetsCount,
              total: totalPages,
              text:
                completedSheetsCount < totalPages
                  ? `อ่านสำเร็จ ${completedSheetsCount}/${totalPages} แผ่น — กำลังเตรียมแผ่นถัดไป...`
                  : `อ่านข้อมูลครบ ${totalPages}/${totalPages} แผ่นแล้วค่ะ`,
            });
            updateLiveProgress(sheetIndex + 1);
            return;
          } catch (pageErr: any) {
            clearTimeout(perPageTimer);
            activeControllersRef.current.delete(pageController);

            if (isUserStoppedRef.current && pageErr?.name === 'AbortError') {
              wasAbortedByUser = true;
              return;
            }

            const msgStr = String(pageErr?.message || '');
            const isTimeoutErr =
              pageErr?.isServerTimeout ||
              pageErr?.name === 'AbortError' ||
              pageController.signal?.reason === 'TIMEOUT' ||
              /timeout/i.test(msgStr);
            const isNetworkErr =
              pageErr?.name === 'TypeError' ||
              /failed to fetch|network|load failed|fetch/i.test(msgStr) ||
              pageErr?.httpStatus === 429 ||
              (typeof pageErr?.httpStatus === 'number' && pageErr.httpStatus >= 500);

            if ((isTimeoutErr || isNetworkErr) && attempt < MAX_RETRIES) {
              pageStatusLogs.push(
                `🔄 แผ่นที่ ${sheetIndex + 1} ${isTimeoutErr ? 'ใช้เวลานาน' : 'เน็ตสะดุด'} กำลังลองใหม่ครั้งที่ 1/1...`
              );
              updateLiveProgress(sheetIndex);
              await sleepInterruptible(1500, () => isUserStoppedRef.current);
              if (isUserStoppedRef.current) {
                wasAbortedByUser = true;
                return;
              }
              continue;
            }

            failedPagesCount++;
            completedSheetsCount++;
            const reasonText = isTimeoutErr
              ? 'ใช้เวลานานเกินกำหนด (Timeout 45s)'
              : msgStr || 'Failed to fetch';
            pageStatusLogs.push(`⚠️ แผ่นที่ ${sheetIndex + 1} ไม่สำเร็จหลังลองซ้ำ (${reasonText})`);
            updateLiveProgress(sheetIndex + 1);
            return;
          }
        }
      };

      try {
        // Sequential Batch Processing (1 sheet at a time to prevent token limit truncation)
        for (let i = 0; i < totalPages; i++) {
          if (isUserStoppedRef.current) {
            wasAbortedByUser = true;
            break;
          }
          await processSheet(processedAttachments[i], i);
          if (isUserStoppedRef.current) {
            wasAbortedByUser = true;
            break;
          }
        }

        setDbActionStatus(null);

        if (wasAbortedByUser) {
          const abortLines = [
            `⏹️ สั่งหยุดการประมวลผลเรียบร้อยค่ะ (อ่านแล้ว ${successPagesCount}/${totalPages} แผ่น${collectedEquipmentRows.length > 0 ? ` • อ่านได้ ${collectedEquipmentRows.length} รายการ` : ''})`,
          ];
          if (pageStatusLogs.length > 0) {
            abortLines.push(`\n${pageStatusLogs.join('\n')}`);
          }
          updateProgressBubble(abortLines.join('\n'), {
            isCard: collectedEquipmentRows.length > 0 || attachUpdatedTotal.length > 0,
            ...(collectedEquipmentRows.length > 0
              ? {
                  equipmentVerificationData: {
                    rows: collectedEquipmentRows,
                    pageImages: verificationPageImages,
                    applied: false,
                  },
                }
              : {}),
            undoSnapshot: attachUpdatedTotal.length > 0 ? queueSnap : undefined,
            suggestedChoices: ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
          });
          notifyUnreadIfClosed();
          return;
        }

        if (collectedEquipmentRows.length > 0) {
          const sortedCollected = [...collectedEquipmentRows].sort((a, b) => {
            const na = parseInt(String(a.seq || '').replace(/\D/g, ''), 10);
            const nb = parseInt(String(b.seq || '').replace(/\D/g, ''), 10);
            if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
            return a._pageIndex - b._pageIndex;
          });
          const flaggedCount = sortedCollected.filter(
            (r) => Boolean(r.handwritten_note?.trim()) || r.is_marked_x
          ).length;

          const summaryLines: string[] = [
            `📋 อ่านตารางทะเบียนครุภัณฑ์สำเร็จ ${successPagesCount}/${totalPages} แผ่น รวม ${sortedCollected.length} รายการ ค่ะ ✨🌸`,
          ];
          if (flaggedCount > 0) {
            summaryLines.push(
              `🟡 พบรายการที่มีลายมือเขียนทับ หรือเครื่องหมายกากบาท (X) จำนวน ${flaggedCount} รายการ (ไฮไลต์สีเหลืองไว้ให้ตรวจสอบแล้วค่ะ)`
            );
          }
          if (failedPagesCount > 0) {
            const failedLogs = pageStatusLogs.filter((l) => l.startsWith('⚠️'));
            summaryLines.push(
              `\n⚠️ แผ่นที่อ่านไม่สำเร็จ (${failedPagesCount} แผ่น — สามารถส่งเฉพาะแผ่นที่ตกหล่นซ้ำได้ค่ะ):\n${failedLogs.join('\n')}`
            );
          }

          updateProgressBubble(summaryLines.join('\n'), {
            isCard: true,
            equipmentVerificationData: {
              rows: sortedCollected,
              pageImages: verificationPageImages,
              applied: false,
            },
            suggestedChoices: ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
          });
          notifyUnreadIfClosed();

          setVerificationModalState({
            isOpen: true,
            messageId: progressMsgId,
            rows: sortedCollected,
            pageImages: verificationPageImages,
          });
          speakText(
            `น้องออร่าอ่านทะเบียนครุภัณฑ์ได้ทั้งหมด ${sortedCollected.length} รายการแล้วค่ะ รบกวนพี่พยาบาลตรวจสอบตารางและกดยืนยันบันทึกนะคะ`
          );
          return;
        }

        if (attachUpdatedTotal.length > 0 || attachFailedTotal.length > 0) {
          const lines: string[] = [];
          if (attachUpdatedTotal.length > 0) {
            lines.push(
              `📸 บันทึกรูปภาพเข้าครุภัณฑ์สำเร็จ ${attachUpdatedTotal.length} รายการ (บันทึกลง Cloud แล้วค่ะ ✨🌸):`
            );
            attachUpdatedTotal.forEach((u) => {
              lines.push(
                `• รูป #${u.imageIndex + 1} (เลข ${u.detectedNumber}) ➔ **${u.equipmentName}** [${u.roomId.toUpperCase()}]`
              );
            });
          }
          if (attachFailedTotal.length > 0) {
            lines.push(
              `\n⚠️ รูปที่ไม่พบรายการที่ตรงกัน (${attachFailedTotal.length} รูป):`
            );
            attachFailedTotal.forEach((f) => {
              lines.push(`• รูป #${f.imageIndex + 1}: ${f.reason}`);
            });
          }
          updateProgressBubble(lines.join('\n'), {
            isCard: true,
            undoSnapshot: attachUpdatedTotal.length > 0 ? queueSnap : undefined,
            suggestedChoices: latestChoices || ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
            actionMeta: {
              type: 'navigate',
              label: '🏥 เปิดหน้าครุภัณฑ์ห้องผ่าตัด',
              view: 'room_check',
              category: 'equipment',
            },
          });
          notifyUnreadIfClosed();
          return;
        }

        if (autoFillItemsTotal.length > 0) {
          const completeCount = autoFillItemsTotal.filter((i: any) => i.status === 'COMPLETE').length;
          const diffItems = autoFillItemsTotal.filter((i: any) => i.status !== 'COMPLETE');
          updateProgressBubble(
            `อ่านใบตรวจเช็กครบ ${successPagesCount}/${totalPages} แผ่นเรียบร้อยแล้วค่ะ (ทั้งหมด ${autoFillItemsTotal.length} รายการ) สามารถกดยืนยันลงข้อมูลเข้าเว็บด้านล่างได้เลยนะคะ ✨🌸`,
            {
              isCard: true,
              suggestedChoices: latestChoices || [
                '📋 สรุปส่งเวร (Shift Handover)',
                '🚗 ตรวจเช็กรถฉุกเฉิน',
                '💼 ตรวจเช็กกระเป๋าฉุกเฉิน',
              ],
              parsedItems: autoFillItemsTotal,
              targetCategory: autoFillCat,
              targetLocation: autoFillLocation,
              diffSummary: {
                total: autoFillItemsTotal.length,
                completeCount,
                diffCount: diffItems.length,
                restockCount: diffItems.length,
              },
              diffItems,
              restockItems: diffItems,
              sources: allSources.length > 0 ? allSources.slice(0, 5) : undefined,
            }
          );
          notifyUnreadIfClosed();
          return;
        }

        if (generalReplies.length > 0) {
          const combined =
            failedPagesCount > 0
              ? `${generalReplies.join('\n\n')}\n\n${pageStatusLogs.filter((l) => l.startsWith('⚠️')).join('\n')}`
              : generalReplies.join('\n\n');
          updateProgressBubble(combined, {
            suggestedChoices: latestChoices,
            sources: allSources.length > 0 ? allSources.slice(0, 5) : undefined,
          });
          notifyUnreadIfClosed();
          return;
        }

        updateProgressBubble(
          `⚠️ ไม่พบข้อมูลที่สามารถนำเข้าจากภาพทั้ง ${totalPages} แผ่นได้ค่ะ\n${pageStatusLogs.join('\n')}\n\nรบกวนตรวจสอบความคมชัดหรือกดหมุนภาพให้ตั้งตรงแล้วลองใหม่อีกครั้งนะคะ ✨`,
          {
            suggestedChoices: ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
          }
        );
        notifyUnreadIfClosed();
      } finally {
        if (wakeLockSentinel) {
          try {
            await wakeLockSentinel.release();
          } catch {
            // Ignore Wake Lock release errors
          }
          wakeLockSentinel = null;
        }
        setDbActionStatus(null);
        setIsLoading(false);
        setScanProgress(null);
        abortControllerRef.current = null;
      }
      return;
    }

    const timeoutMs = isBulkEquipmentTable ? 50000 : processedAttachments.length > 0 ? 120000 : 60000;
    const timeoutTimer = setTimeout(() => {
      if (!isUserStoppedRef.current && abortControllerRef.current) {
        abortControllerRef.current.abort('TIMEOUT');
      }
    }, timeoutMs);

    try {
      const res = await authorizedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          message: query,
          channelName: activeChannel?.name || 'คลินิกวิสัญญี (Master)',
          history: isBulkEquipmentTable
            ? []
            : messages.slice(-8).map((msg) => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }],
              })),
          liveContext: requestContext,
          context: requestContext,
          appContext: compactAppContext,
          ...(processedAttachments.length > 0
            ? {
                attachments: processedAttachments.map((att, idx) => ({
                  index: idx,
                  base64: att.base64,
                  mimeType: att.mimeType,
                  fileName: att.fileName,
                })),
              }
            : {}),
        }),
      });

      clearTimeout(timeoutTimer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const groundingSources =
        Array.isArray(data.sources) && data.sources.length > 0 ? data.sources : undefined;
      const currentChoices =
        Array.isArray(data.suggestedChoices) && data.suggestedChoices.length > 0
          ? data.suggestedChoices
          : undefined;

      // 📸 Match equipment photos when AI returns MATCH_EQUIPMENT_PHOTOS or ATTACH_EQUIPMENT_PHOTOS action
      if (
        data.action?.type === 'MATCH_EQUIPMENT_PHOTOS' ||
        data.action?.type === 'ATTACH_EQUIPMENT_PHOTOS'
      ) {
        const mappings = Array.isArray(data.action.mappings) ? data.action.mappings : [];
        if (mappings.length > 0 && onAttachEquipmentPhotos) {
          const snap = onCaptureSnapshot?.('ก่อนแนบรูปภาพเข้าครุภัณฑ์');
          const matchedList: any[] = [];
          const unmatchedList: any[] = [];
          const currentAttachments = processedAttachments.length > 0 ? processedAttachments : activeAttachments;

          currentAttachments.forEach((att, idx) => {
            const m = mappings.find((item: any) => Number(item.imageIndex) === idx) || mappings[idx];
            const targetNum = String(m?.orderNumber || m?.detectedNumber || '').trim();
            const targetId = String(m?.equipmentId || '').trim();
            let foundEq: any = null;
            let foundRoom = '';

            if (targetId) {
              for (const [rId, rItems] of Object.entries(equipment || {})) {
                const match = ((rItems as any[]) || []).find((it: any) => it.id === targetId);
                if (match) {
                  foundEq = match;
                  foundRoom = rId;
                  break;
                }
              }
            }

            if (!foundEq && targetNum) {
              const targetInt = parseInt(targetNum, 10);
              for (const [rId, rItems] of Object.entries(equipment || {})) {
                const match = ((rItems as any[]) || []).find((it: any) => {
                  const itNo = String(it.no ?? '').trim();
                  const itOrder = String(it.orderNumber ?? '').trim();
                  const itCode = String(it.code || it.assetCode || '').trim();
                  const itSap = String(it.sap || it.sapCode || '').trim();
                  if (itOrder === targetNum || itNo === targetNum || itCode === targetNum || itSap === targetNum) {
                    return true;
                  }
                  if (!Number.isNaN(targetInt) && targetInt > 0) {
                    return parseInt(itNo, 10) === targetInt || parseInt(itOrder, 10) === targetInt;
                  }
                  return false;
                });
                if (match) {
                  foundEq = match;
                  foundRoom = rId;
                  break;
                }
              }
            }

            if (foundEq && !m?.unmatched) {
              matchedList.push({
                imageIndex: idx,
                orderNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
                detectedNumber: targetNum || String(foundEq.orderNumber || foundEq.no || '-'),
                equipmentId: foundEq.id,
                equipmentName: foundEq.name,
                roomId: foundRoom,
                dataUrl: att.dataUrl,
                fileName: att.fileName,
                unmatched: false,
              });
            } else {
              unmatchedList.push({
                imageIndex: idx,
                orderNumber: targetNum || '',
                detectedNumber: targetNum || '',
                equipmentId: '',
                equipmentName: '',
                roomId: '',
                dataUrl: att.dataUrl,
                fileName: att.fileName,
                reason: m?.reason || 'อ่านตัวเลขไม่ชัดเจนหรือไม่พบในระบบ',
              });
            }
          });

          setPendingPhotoMatchSession({
            totalImages: currentAttachments.length,
            matched: matchedList,
            unmatched: unmatchedList,
            allAttachments: currentAttachments.map((att, idx) => ({
              index: idx,
              dataUrl: att.dataUrl,
              fileName: att.fileName,
            })),
            snapshot: snap,
          });

          addMessage(
            'ai',
            `📸 ตรวจพบและจับคู่รูปภาพได้ ${matchedList.length}/${currentAttachments.length} รายการค่ะ ✨🌸` +
              (unmatchedList.length > 0 ? `\n⚠️ มี ${unmatchedList.length} รูปที่ต้องระบุลำดับครุภัณฑ์เองค่ะ` : '') +
              `\nโปรดตรวจสอบรายการในกล่องยืนยันด้านล่างนะคะ 🎀`,
            true,
            undefined,
            undefined,
            ['💾 บันทึกรูปภาพทั้งหมด', '🔍 เช็กครุภัณฑ์ที่ยังขาดรูป', '🏥 เปิดดูหน้าครุภัณฑ์']
          );

          setIsLoading(false);
          setScanProgress(null);
          return;
        } else {
          addMessage(
            'ai',
            data.text ||
              'ไม่พบรายการครุภัณฑ์ที่ตรงกับหมายเลขในรูปภาพค่ะ กรุณาตรวจสอบเลขครุภัณฑ์แล้วลองใหม่อีกครั้งนะคะ ✨',
            false,
            undefined,
            undefined,
            currentChoices
          );
          setIsLoading(false);
          setScanProgress(null);
          return;
        }
      }

      // 📋 Bulk Equipment Registry Import -> Open Split-View Verification Table BEFORE saving to database
      if (data.action?.type === 'BULK_IMPORT_EQUIPMENT') {
        const eqItems = Array.isArray(data.action.equipmentItems)
          ? data.action.equipmentItems
          : [];
        if (eqItems.length > 0) {
          const normalizedRows: VerificationEquipmentRow[] = eqItems
            .filter((it: any) => it && String(it.name || '').trim())
            .map((it: any, rIdx: number) => normalizeToVerificationRow(it, 0, rIdx));

          const flaggedCount = normalizedRows.filter(
            (r: VerificationEquipmentRow) => Boolean(r.handwritten_note?.trim()) || r.is_marked_x
          ).length;
          const verMsgId = `eq_verify_${Date.now()}`;
          const pageImgs =
            verificationPageImages.length > 0
              ? verificationPageImages
              : processedAttachments
                  .map((a, i) => ({ a, i }))
                  .filter(({ a }) => !a.isPdf)
                  .map(({ a, i }) => ({
                    pageIndex: i,
                    fileName: a.fileName,
                    previewUrl: a.previewUrl || a.dataUrl,
                    rotatedDegrees: 0,
                  }));

          const summaryLines: string[] = [
            `📋 อ่านตารางทะเบียนครุภัณฑ์ได้ ${normalizedRows.length} รายการ ค่ะ ✨🌸`,
          ];
          if (flaggedCount > 0) {
            summaryLines.push(
              `🟡 พบรายการที่มีลายมือเขียนทับ หรือเครื่องหมายกากบาท (X) จำนวน ${flaggedCount} รายการ (ไฮไลต์สีเหลืองไว้ให้ตรวจสอบแล้วค่ะ)`
            );
          }

          addMessage(
            'ai',
            summaryLines.join('\n'),
            true,
            undefined,
            undefined,
            currentChoices || ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
            {
              id: verMsgId,
              equipmentVerificationData: {
                rows: normalizedRows,
                pageImages: pageImgs,
                applied: false,
              },
            }
          );

          setVerificationModalState({
            isOpen: true,
            messageId: verMsgId,
            rows: normalizedRows,
            pageImages: pageImgs,
          });
          speakText(
            `น้องออร่าอ่านทะเบียนครุภัณฑ์ได้ ${normalizedRows.length} รายการแล้วค่ะ รบกวนพี่พยาบาลตรวจสอบตารางและกดยืนยันบันทึกนะคะ`
          );
        } else {
          addMessage(
            'ai',
            data.text ||
              'ไม่พบรายการครุภัณฑ์จากรูปตารางที่แนบมาค่ะ รบกวนกดหมุนรูปให้ตัวหนังสือตั้งตรงแล้วส่งใหม่อีกครั้งนะคะ ✨',
            false,
            undefined,
            undefined,
            currentChoices
          );
        }
        return;
      }

      // ⚡ Smart Inventory / Checklist Auto-Fill when AI returns AUTO_FILL_CHECKS
      if (data.action?.type === 'AUTO_FILL_CHECKS') {
        const rawChecklist = Array.isArray(data.action.checklistItems)
          ? data.action.checklistItems
          : [];
        if (rawChecklist.length > 0) {
          const mappedParsedItems = rawChecklist.map((it: any) => ({
            name: String(it?.name || '').trim(),
            expected: String(it?.expected ?? '1').trim(),
            actual: String(it?.actual ?? '1').trim(),
            exp: it?.exp && it.exp !== '-' ? String(it.exp).trim() : undefined,
            status:
              it?.status === 'EXPIRED'
                ? ('EXPIRED' as const)
                : it?.status === 'INCOMPLETE'
                ? ('INCOMPLETE' as const)
                : ('COMPLETE' as const),
            issue: it?.issue ? String(it.issue).trim() : undefined,
          }));
          const completeCount = mappedParsedItems.filter((i: any) => i.status === 'COMPLETE').length;
          const diffItems = mappedParsedItems.filter((i: any) => i.status !== 'COMPLETE');
          const resolvedCat =
            data.action.targetCategory === 'cart' || data.action.targetCategory === 'drug'
              ? data.action.targetCategory
              : 'bag';
          const resolvedLocation =
            data.action.targetLocation ||
            (resolvedCat === 'cart' ? 'รถฉุกเฉิน' : resolvedCat === 'drug' ? 'คลังยา' : 'กระเป๋าฉุกเฉิน');

          addMessage(
            'ai',
            data.text ||
              `อ่านใบตรวจเช็กเรียบร้อยแล้วค่ะ (ทั้งหมด ${mappedParsedItems.length} รายการ) สามารถกดยืนยันลงข้อมูลเข้าเว็บด้านล่างได้เลยนะคะ ✨🌸`,
            true,
            undefined,
            undefined,
            currentChoices || ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน'],
            {
              parsedItems: mappedParsedItems,
              targetCategory: resolvedCat,
              targetLocation: resolvedLocation,
              diffSummary: {
                total: mappedParsedItems.length,
                completeCount,
                diffCount: diffItems.length,
                restockCount: diffItems.length,
              },
              diffItems,
              restockItems: diffItems,
              sources: groundingSources,
            }
          );
          return;
        }
      }

      if (data.functionCall) {
        const { name, args } = data.functionCall;

        if (name === 'generateShiftHandover') {
          const handoverText = buildShiftHandoverReport();
          addMessage(
            'ai',
            handoverText,
            true,
            undefined,
            undefined,
            currentChoices || ['💊 ตรวจสอบยาใกล้หมดอายุ', '🚗 ตรวจเช็กรถฉุกเฉิน'],
            { handoverText }
          );
        } else if (name === 'updateInventoryItem') {
          const rawItemName = `${args?.itemName || ''} ${args?.sizeOrSpec || ''}`.trim();
          const catalog = buildUnifiedCatalog();
          const filteredCatalog =
            args?.targetCategory && args.targetCategory !== 'all'
              ? catalog.filter((c) => c.targetType === args.targetCategory)
              : catalog;
          const matched = findBestMedicalMatches(
            rawItemName,
            filteredCatalog.length > 0 ? filteredCatalog : catalog,
            (c) => c.name,
            (c) => c.spec
          );

          if (matched.length === 0) {
            addMessage(
              'ai',
              `❌ น้องออร่าไม่พบรายการ "${rawItemName}" ในระบบค่ะ กรุณาระบุชื่อยา/อุปกรณ์และขนาดให้ชัดเจน (เช่น ET tube No. 7.5 หรือ Adrenaline) แล้วลองอีกครั้งนะคะ ✨`
            );
          } else {
            const queryHasNumber = extractSignificantNumbers(rawItemName).length > 0;
            const distinctSizedCandidates = matched.filter((m, i, arr) => {
              const mNums = extractSignificantNumbers(`${m.name} ${m.spec}`);
              if (mNums.length === 0) return false;
              return arr.findIndex((o) => o.itemId === m.itemId) === i;
            });

            if (!queryHasNumber && distinctSizedCandidates.length > 1) {
              const sizeChoices = distinctSizedCandidates
                .slice(0, 3)
                .map((c) => `${c.name}${c.spec ? ` ${c.spec}` : ''}`);
              addMessage(
                'ai',
                `⚠️ พบรายการ "${rawItemName}" หลายขนาดในระบบค่ะ เพื่อป้องกันการอัปเดตผิดขนาด รบกวนระบุขนาดที่ต้องการแก้ไขด้วยนะคะ:`,
                false,
                undefined,
                undefined,
                sizeChoices.map(
                  (label) =>
                    `อัปเดต ${label}${args?.newExp ? ` EXP ${args.newExp}` : ''}${
                      args?.newQty !== undefined ? ` จำนวน ${args.newQty}` : ''
                    }${args?.lotNumber ? ` Lot ${args.lotNumber}` : ''}`
                )
              );
            } else if (onUpdateInventoryItem) {
              const target = matched[0];
              const snap = onCaptureSnapshot?.(`ก่อนแก้ไข ${target.name}`);
              setDbActionStatus('กำลังดำเนินการ...');
              try {
                const normalizedExp = args?.newExp ? normalizeExpDate(String(args.newExp)).expDate : undefined;
                const updRes = await onUpdateInventoryItem({
                  targetType: target.targetType,
                  itemId: target.itemId,
                  roomId: target.roomId,
                  newExp: normalizedExp && normalizedExp !== '-' ? normalizedExp : undefined,
                  lotNumber: args?.lotNumber,
                  newQty: args?.newQty,
                  newStatus: args?.newStatus,
                  note: args?.note,
                });
                if (updRes.success) {
                  const changes: string[] = [];
                  if (args?.newQty !== undefined) changes.push(`จำนวน: ${args.newQty}`);
                  if (normalizedExp) changes.push(`EXP: ${normalizedExp}`);
                  if (args?.lotNumber) changes.push(`Lot: ${args.lotNumber}`);
                  if (args?.newStatus) changes.push(`สถานะ: ${args.newStatus}`);
                  addMessage(
                    'ai',
                    `✅ อัปเดตข้อมูล **${updRes.updatedName}** (${target.locationLabel}) เรียบร้อยแล้วค่ะ!\n• รายละเอียดที่แก้: ${changes.join(' | ') || 'บันทึกข้อมูลแล้ว'}`,
                    true,
                    undefined,
                    undefined,
                    currentChoices || ['📋 สรุปส่งเวร (Shift Handover)', '💊 เช็กสต็อกยา'],
                    { undoSnapshot: snap }
                  );
                } else {
                  addMessage('ai', `❌ ไม่สามารถอัปเดต "${target.name}" ได้ กรุณาลองใหม่อีกครั้งนะคะ`);
                }
              } finally {
                setDbActionStatus(null);
              }
            }
          }
        } else if (name === 'resetChecklist') {
          const targetCat =
            args?.target && args.target.includes('cart')
              ? 'cart'
              : args?.target && args.target.includes('bag')
              ? 'bag'
              : 'both';
          const snap = onCaptureSnapshot?.(`ก่อนรีเซ็ตตาราง ${targetCat}`);
          setDbActionStatus('กำลังดำเนินการ...');
          try {
            if (targetCat === 'both' || targetCat === 'cart') {
              clearChannelCategory(activeChannelId, 'cart');
            }
            if (targetCat === 'both' || targetCat === 'bag') {
              clearChannelCategory(activeChannelId, 'bag');
            }
            reRenderData();
            addMessage(
              'ai',
              data.text ||
                'น้องออร่าได้รีเซ็ตและเคลียร์ตารางการตรวจเช็คให้เรียบร้อยแล้วค่ะ! พร้อมสำหรับการตรวจเช็คเวรใหม่นะคะ ✨🌸',
              false,
              undefined,
              undefined,
              currentChoices || ['🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน', '💊 เช็กสต็อกคลังยาวิสัญญี'],
              { undoSnapshot: snap }
            );
          } finally {
            setDbActionStatus(null);
          }
        } else if (name === 'navigateToPage') {
          const page = args?.page || 'home';
          if (onNavigate) {
            onNavigate(page as any);
          }
          const pageTitles: Record<string, string> = {
            bag_check: 'กระเป๋าฉุกเฉิน (Emergency Bag)',
            cart_check: 'รถฉุกเฉิน (Crash Cart)',
            drug_check: 'คลังยาวิสัญญี',
            room_check: 'ห้องผ่าตัด OR',
            eq_overview: 'ภาพรวมครุภัณฑ์',
            home: 'หน้าหลัก',
          };
          addMessage(
            'ai',
            data.text || `น้องออร่านำทางมาที่ [${pageTitles[page] || page}] เรียบร้อยแล้วค่ะพี่พยาบาล ✨🚗`,
            false,
            undefined,
            undefined,
            currentChoices || ['📸 สแกนใบตรวจเช็ค', '✅ เช็กครบทุกรายการ', '💊 ตรวจยาวิสัญญี']
          );
        } else if (name === 'auditPaperChecklist') {
          addMessage(
            'ai',
            data.text ||
              'น้องออร่าพร้อมตรวจเทียบกระดาษกับระบบเว็บแล้วค่ะ! พี่พยาบาลสามารถกดปุ่มรูปกล้อง 📸 ด้านล่างนี้เพื่อถ่ายรูปใบเช็กลิสต์ได้ทันทีเลยนะคะ ✨🌸📋',
            false,
            undefined,
            undefined,
            currentChoices || ['🚗 ไปหน้ารถฉุกเฉิน', '💼 ไปหน้ากระเป๋าฉุกเฉิน'],
            {
              actionMeta: {
                type: 'open_file_picker',
                label: '📸 ถ่ายรูปหรือแนบภาพใบตรวจเช็ค',
              },
            }
          );
        } else if (name === 'update_item_status') {
          const rawItemName = String(args?.itemName || '').trim();
          const rawRoomOrLoc = String(args?.roomOrLocation || '').trim().toLowerCase();
          const targetStatus: 'ปกติ' | 'ผิดปกติ' =
            String(args?.status || '').includes('ผิด') || String(args?.status || '').includes('ชำรุด')
              ? 'ผิดปกติ'
              : 'ปกติ';

          const catalog = buildUnifiedCatalog();
          const scopedCatalog = rawRoomOrLoc
            ? catalog.filter(
                (c) =>
                  c.targetType === rawRoomOrLoc ||
                  (c.roomId && c.roomId.toLowerCase() === rawRoomOrLoc) ||
                  c.locationLabel.toLowerCase().includes(rawRoomOrLoc)
              )
            : catalog;
          const matched = findBestMedicalMatches(
            rawItemName,
            scopedCatalog.length > 0 ? scopedCatalog : catalog,
            (c) => c.name,
            (c) => c.spec
          );

          if (matched.length === 0) {
            addMessage(
              'ai',
              `❌ น้องออร่าไม่พบอุปกรณ์ "${rawItemName}"${rawRoomOrLoc ? ` ใน ${rawRoomOrLoc.toUpperCase()}` : ''} ค่ะ รบกวนระบุชื่ออุปกรณ์หรือห้องผ่าตัดให้ชัดเจนขึ้นนะคะ ✨`
            );
          } else if (onUpdateInventoryItem) {
            const target = matched[0];
            const snap = onCaptureSnapshot?.(`ก่อนเปลี่ยนสถานะ ${target.name}`);
            setDbActionStatus('กำลังอัปเดตสถานะครุภัณฑ์...');
            try {
              const updRes = await onUpdateInventoryItem({
                targetType: target.targetType,
                itemId: target.itemId,
                roomId: target.roomId,
                newStatus: targetStatus,
                note: args?.note,
              });
              if (updRes.success) {
                addMessage(
                  'ai',
                  `${targetStatus === 'ผิดปกติ' ? '⚠️' : '✅'} อัปเดตสถานะ **${updRes.updatedName}** (${target.locationLabel}) เป็น **${targetStatus}** เรียบร้อยแล้วค่ะ!${args?.note ? `\n• หมายเหตุ: ${args.note}` : ''}`,
                  true,
                  undefined,
                  undefined,
                  currentChoices || ['📋 สรุปส่งเวร (Shift Handover)', '🏥 เปิดภาพรวมครุภัณฑ์'],
                  { undoSnapshot: snap, sources: groundingSources }
                );
              } else {
                addMessage('ai', `❌ ไม่สามารถอัปเดตสถานะของ "${target.name}" ได้ กรุณาลองใหม่อีกครั้งนะคะ`);
              }
            } finally {
              setDbActionStatus(null);
            }
          }
        } else if (name === 'create_restock_requisition') {
          const targetCategory = String(args?.targetCategory || 'drug');
          const reqItems = Array.isArray(args?.items) ? args.items : [];
          if (onRestockRequest) {
            setDbActionStatus('กำลังสร้างใบขอเบิกยา/เวชภัณฑ์...');
            try {
              const reqRes = await onRestockRequest({
                items: reqItems,
                targetCategory,
                notes: args?.notes || `ขอเบิกผ่านน้องออร่า (${activeChannel?.name || activeChannelId})`,
              });
              if (reqRes.success) {
                const itemLines =
                  reqItems.length > 0
                    ? reqItems.map((it: any) => `• ${it.name} (${it.qty || 1})${it.reason ? ` — ${it.reason}` : ''}`).join('\n')
                    : '• ตามรายการที่ตรวจพบว่าต่ำกว่าเกณฑ์';
                addMessage(
                  'ai',
                  `📦 สร้างใบขอเบิกพัสดุ/ยาเพิ่มเรียบร้อยแล้วค่ะ!\n🆔 รหัสใบเบิก: **${reqRes.requisitionId || '-'}**\n📍 วอร์ด: ${activeChannel?.name || 'Master'} (${targetCategory})\n${itemLines}`,
                  true,
                  undefined,
                  undefined,
                  currentChoices || ['💊 เปิดหน้าคลังยา', '📋 สรุปส่งเวร (Shift Handover)'],
                  { sources: groundingSources }
                );
              } else {
                addMessage('ai', '⚠️ ไม่สามารถบันทึกใบขอเบิกได้ กรุณาลองใหม่อีกครั้งนะคะ');
              }
            } finally {
              setDbActionStatus(null);
            }
          }
        } else if (
          name === 'delete_all_equipment' ||
          name === 'clear_category_items' ||
          name === 'clearTargetInventory'
        ) {
          const targetCat =
            name === 'delete_all_equipment'
              ? 'ครุภัณฑ์'
              : String(args?.targetCategory || args?.category || 'รายการ');
          const isEquipmentClear =
            name === 'delete_all_equipment' ||
            /ครุ|equipment/i.test(targetCat);

          if (isEquipmentClear) {
            const totalEqCount = Object.values(equipment || {}).reduce(
              (sum, arr) => sum + (Array.isArray(arr) ? arr.filter((it) => it && it.name).length : 0),
              0
            );
            addConfirmationCard(
              'ยืนยันการลบครุภัณฑ์ทั้งหมด',
              `⚠️ **ยืนยันการลบครุภัณฑ์ทั้งหมด ${totalEqCount.toLocaleString()} รายการ** ออกจากฐานข้อมูล (${activeChannel?.name || 'Master'})?\n\nข้อมูลที่ลบจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบและกดปุ่มด้านล่างเพื่อดำเนินการค่ะ`,
              'ครุภัณฑ์',
              {
                actionKind: 'delete_all_equipment',
                itemCount: totalEqCount,
              }
            );
          } else {
            addConfirmationCard(
              `ยืนยันล้างข้อมูลหมวด "${targetCat}"`,
              `⚠️ น้องออร่าได้รับคำสั่งให้ล้างรายการทั้งหมดในหมวด **[${targetCat}]** ค่ะ\n\nเพื่อความปลอดภัยของข้อมูลในวอร์ด น้องออร่าขอทวนคำสั่งก่อนทำจริงนะคะ พี่พยาบาลต้องการดำเนินการลบข้อมูลในหมวดนี้ใช่ไหมคะ?`,
              targetCat
            );
          }
        } else if (data.text) {
          addMessage('ai', data.text, false, undefined, undefined, currentChoices, { sources: groundingSources });
        }
      } else if (data.success && data.text) {
        addMessage('ai', data.text, false, undefined, undefined, currentChoices, { sources: groundingSources });
      } else {
        addMessage(
          'ai',
          data?.message || '⚠️ ไม่ได้รับการตอบกลับที่สมบูรณ์จาก AI กรุณาลองใหม่อีกครั้งนะคะ ✨',
          false,
          undefined,
          undefined,
          ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน']
        );
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const reason = abortControllerRef.current?.signal?.reason;
      if (err?.name === 'AbortError' && isUserStoppedRef.current) {
        addMessage(
          'ai',
          '⏹️ สั่งหยุดการประมวลผลเรียบร้อยค่ะ พี่สามารถพิมพ์คำถามใหม่ได้เลยนะคะ 💕',
          false,
          undefined,
          undefined,
          ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน']
        );
      } else if (err?.name === 'AbortError' || reason === 'TIMEOUT') {
        addMessage(
          'ai',
          '⏱️ การเชื่อมต่อใช้เวลานานเกินกำหนดค่ะ น้องออร่าหยุดรอให้แล้วเพื่อไม่ให้ระบบค้าง รบกวนกดส่งใหม่อีกครั้งนะคะ ✨',
          false,
          undefined,
          undefined,
          ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน']
        );
      } else {
        console.error('Aura Chat API Error:', err);
        addMessage(
          'ai',
          `⚠️ ไม่สามารถเชื่อมต่อกับระบบ AI ได้ชั่วคราว (${err?.message || 'Network error'}) รบกวนลองใหม่อีกครั้งนะคะ ✨`,
          false,
          undefined,
          undefined,
          ['📋 สรุปส่งเวร (Shift Handover)', '🚗 ตรวจเช็กรถฉุกเฉิน', '💼 ตรวจเช็กกระเป๋าฉุกเฉิน']
        );
      }
    } finally {
      clearTimeout(timeoutTimer);
      setIsLoading(false);
      setScanProgress(null);
      abortControllerRef.current = null;
    }
  };


  const handleOpen = () => {
    isOpenRef.current = true;
    setIsOpen(true);
    setTimeout(() => setIsAnimating(true), 10);
    if (onOpenChange) onOpenChange(true);
  };

  // Listen for external Smart Scan trigger events from BottomBar or Dashboard
  useEffect(() => {
    const onOpenAuraScan = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const requestedMode =
        detail.mode === 'label' || detail.mode === 'scan-label'
          ? 'label'
          : detail.mode === 'audit-paper'
          ? 'audit-paper'
          : 'auto';
      isOpenRef.current = true;
      setIsOpen(true);
      setTimeout(() => setIsAnimating(true), 10);
      if (onOpenChange) onOpenChange(true);
      setPendingScanMode(requestedMode);
      if (requestedMode === 'audit-paper') {
        setInputMessage((prev) => prev.trim() ? prev : 'ช่วยสแกนใบตรวจเช็กยอดจากรูปนี้ให้หน่อย');
      } else if (requestedMode === 'label') {
        setInputMessage((prev) => prev.trim() ? prev : 'ช่วยสแกนฉลากยาและวันหมดอายุจากรูปนี้ให้หน่อย');
      }
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 260);
    };
    window.addEventListener('open_aura_scan', onOpenAuraScan);
    return () => window.removeEventListener('open_aura_scan', onOpenAuraScan);
  }, [onOpenChange]);

  // Stop speech and reset state immediately when chat is closed
  const handleClose = () => {
    stopSpeech();
    isOpenRef.current = false;
    setIsAnimating(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      setIsOpen(false);
      if (onOpenChange) onOpenChange(false);
    }, 200);
  };

  useEffect(() => {
    const onExternalClose = () => {
      if (isOpen) {
        handleClose();
      }
    };
    window.addEventListener('close_aura_chat', onExternalClose);
    return () => window.removeEventListener('close_aura_chat', onExternalClose);
  }, [isOpen]);

  const handleQuickChip = (value: string) => {
    processCommand(value);
  };

  const renderQuickChips = () => {
    return (
      <div
        className={`px-3 py-2 border-t transition-colors ${
          isDarkMode ? 'bg-[#131314] border-[#222327]' : 'bg-slate-50/90 border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* 📸 ใส่รูปครุภัณฑ์ตามเลขในภาพ */}
          <button
            type="button"
            disabled={isLoading || Boolean(dbActionStatus)}
            onClick={() => {
              setPendingScanMode('match-photos');
              setInputMessage('เอารูปพวกนี้ใส่ในครุตามลำดับที่ทราบมีตัวเลขในภาพอยู่แล้ว');
              fileInputRef.current?.click();
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/50'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Camera size={13} className="text-blue-500 shrink-0" />
            <span>📸 ใส่รูปครุตามเลขในภาพ</span>
          </button>

          {/* 📄 สแกนใบตารางครุภัณฑ์ */}
          <button
            type="button"
            disabled={isLoading || Boolean(dbActionStatus)}
            onClick={() => {
              setPendingScanMode('bulk-import');
              setInputMessage('สแกนทะเบียนตารางครุภัณฑ์เพื่อนำเข้าข้อมูล');
              fileInputRef.current?.click();
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <FileText size={13} className="text-emerald-500 shrink-0" />
            <span>📄 สแกนตารางครุภัณฑ์</span>
          </button>

          {/* 🔍 เช็กครุภัณฑ์ที่ยังขาดรูป */}
          <button
            type="button"
            disabled={isLoading || Boolean(dbActionStatus)}
            onClick={handleCheckMissingEquipmentImages}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Sparkles size={13} className="text-indigo-400 shrink-0" />
            <span>🔍 เช็กครุภัณฑ์ที่ยังขาดรูป</span>
          </button>

          {/* ⚠️ เช็กของใกล้หมดอายุ */}
          <button
            type="button"
            disabled={isLoading || Boolean(dbActionStatus)}
            onClick={() => handleQuickChip('เช็กยาและเวชภัณฑ์ใกล้หมดอายุและของเหลือน้อย')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            <span>⚠️ เช็กของใกล้หมด</span>
          </button>

          {/* 📋 สรุปส่งเวร */}
          <button
            type="button"
            disabled={isLoading || Boolean(dbActionStatus)}
            onClick={handleGenerateShiftHandover}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'bg-[#1E1F20] border-[#2F3136] text-[#E3E3E3] hover:bg-[#282A2C]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Compass size={13} className={isDarkMode ? 'text-[#A8C7FA]' : 'text-blue-600'} />
            <span>สรุปส่งเวร</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating AI Toggle Button (Bottom-Left) */}
      {!isOpen && isBottomBarVisible && !isAnyModalOpen && (
        <button
          type="button"
          onClick={handleOpen}
          className="fixed bottom-24 left-4 z-30 w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 hover:brightness-110 active:scale-95 active:opacity-90 transition-all cursor-pointer group border border-white/25 touch-manipulation"
          title="คุยกับน้องออร่า"
        >
          <Sparkles size={26} />
          {hasUnreadAuraMessage && (
            <span
              className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full ring-2 ring-white dark:ring-[#0E0F12] shadow-sm animate-pulse pointer-events-none"
              aria-label="มีข้อความใหม่จากน้องออร่า"
            />
          )}
          <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md border border-white/10">
            คุยกับน้องออร่า
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed left-0 right-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75"
          style={
            viewportMetrics
              ? { top: `${viewportMetrics.offsetTop}px`, height: `${viewportMetrics.height}px` }
              : { top: 0, height: '100dvh' }
          }
          onClick={handleClose}
        >
          <div
            className={`w-full sm:max-w-md h-[92dvh] max-h-dvh sm:h-[600px] sm:max-h-[90dvh] flex flex-col rounded-t-[2rem] sm:rounded-[2rem] shadow-xl border transition-[transform,opacity] duration-200 origin-bottom-left overflow-hidden overscroll-contain ${
              isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            } ${isDarkMode ? 'bg-[#0E0E10] border-[#26272B] text-[#E3E3E3]' : 'bg-white border-slate-200 text-slate-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Minimalist Gemini Style */}
            <div className={`flex items-center justify-between px-5 py-3.5 border-b rounded-t-[2rem] shrink-0 transition-colors ${
              isDarkMode ? 'bg-[#0E0E10] border-[#222327] text-[#E3E3E3]' : 'bg-blue-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-teal-400 text-white shadow-sm flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <h3 className={`text-sm font-bold truncate ${isDarkMode ? 'text-[#E3E3E3]' : 'text-slate-900'}`}>
                  น้องออร่า
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Mute/Unmute Voice Toggle */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                    isVoiceEnabled
                      ? (isDarkMode ? 'bg-[#1E1F20] text-[#A8C7FA] border-[#2D2E32] hover:bg-[#282A2C]' : 'bg-blue-50 text-blue-700 border-blue-200')
                      : (isDarkMode ? 'bg-[#1E1F20] text-[#8E918F] border-[#2D2E32] hover:bg-[#282A2C]' : 'bg-slate-100 text-slate-500 border-slate-200')
                  }`}
                  title={isVoiceEnabled ? 'ปิดเสียงพูด' : 'เปิดเสียงพูด'}
                >
                  {isVoiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    isDarkMode
                      ? 'text-[#8E918F] hover:text-[#E3E3E3] hover:bg-[#1E1F20]'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                  title="ปิดหน้าต่างแชท (หยุดเสียงพูดทันที)"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div
              ref={chatBodyRef}
              className={`flex-1 min-h-0 overflow-y-auto p-4 pb-6 space-y-3 font-sans transition-colors overscroll-contain touch-pan-y ${
                isDarkMode ? 'bg-[#0E0E10] text-[#E3E3E3]' : ''
              }`}
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      m.sender === 'user'
                        ? (isDarkMode ? 'bg-[#1E1F20] text-[#E3E3E3] border border-[#2F3136]' : 'bg-blue-600 text-white')
                        : 'bg-gradient-to-tr from-blue-600 via-indigo-500 to-teal-400 text-white'
                    }`}
                  >
                    {m.sender === 'user' ? <span className="text-[10px] font-bold">YOU</span> : <Sparkles size={15} />}
                  </div>
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                      m.isCard
                        ? (isDarkMode ? 'bg-[#1E1F20] border border-[#2C2D31] text-[#E3E3E3] font-medium' : 'bg-white border-2 border-blue-100 shadow-lg font-medium')
                        : m.sender === 'user'
                        ? (isDarkMode ? 'bg-[#1E1F20] border border-[#34363A] text-[#E3E3E3] rounded-tr-none' : 'bg-blue-600 text-white rounded-tr-none')
                        : (isDarkMode ? 'bg-[#1E1F20] border border-[#2C2D31] text-[#E3E3E3] rounded-tl-none' : 'bg-slate-100 text-slate-800 rounded-tl-none')
                    }`}
                  >
                    {m.isPdfAttachment && m.attachmentName && (
                      <div className="mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] font-bold text-rose-100 dark:text-rose-200">
                        <FileText size={14} className="text-rose-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{m.attachmentName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-[9px] uppercase shrink-0">PDF</span>
                      </div>
                    )}
                    {m.images && m.images.length > 0 && (
                      <div className="mb-2.5 grid grid-cols-3 gap-1.5">
                        {m.images.map((imgUrl, imgIdx) => (
                          <div
                            key={imgIdx}
                            onClick={() =>
                              onPreviewImage?.({
                                url: imgUrl,
                                label: `รูปที่ ${imgIdx + 1} / ${m.images!.length}`,
                                images: m.images!.map((u, i) => ({
                                  url: u,
                                  label: `รูปที่ ${i + 1} / ${m.images!.length}`,
                                })),
                                currentIndex: imgIdx,
                              })
                            }
                            className="relative aspect-square rounded-xl overflow-hidden border border-white/20 bg-black/20 cursor-pointer hover:opacity-90 active:scale-95 transition"
                            title="แตะเพื่อดูรูปขนาดใหญ่"
                          >
                            <img src={imgUrl} alt={`Attachment ${imgIdx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/65 text-white text-[9px] font-bold">
                              #{imgIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.image && (
                      <div className="mb-2.5">
                        <div
                          onClick={() =>
                            onPreviewImage?.({
                              url: m.image!,
                              label: m.attachmentName || 'รูปภาพที่แนบ',
                            })
                          }
                          className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-black/10 flex justify-center max-h-72 cursor-pointer hover:opacity-95 transition"
                          title="แตะเพื่อดูรูปขนาดใหญ่"
                        >
                          <img src={m.image} alt={m.attachmentName || 'Checklist Document'} className="max-h-72 w-auto object-contain" />
                        </div>
                        {m.sender === 'user' && (
                          <div className="flex items-center justify-end gap-1.5 mt-1.5">
                            <span className="text-[10px] text-blue-100 dark:text-blue-200">ปรับมุมมอง:</span>
                            <button
                              type="button"
                              onClick={() => handleRotateUserImage(idx, 180)}
                              className="px-2 py-0.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-[10px] text-white font-medium flex items-center gap-1 transition cursor-pointer"
                              title="หมุนกลับ 180 องศา"
                            >
                              <RotateCw size={11} /> 180°
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRotateUserImage(idx, 90)}
                              className="px-2 py-0.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-[10px] text-white font-medium flex items-center gap-1 transition cursor-pointer"
                              title="หมุนตะแคง 90 องศา"
                            >
                              <RotateCw size={11} /> 90°
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-line leading-relaxed">{renderFormattedChatText(m.text)}</p>

                    {/* ⚡ ระบบ Auto-Fill อัจฉริยะ (Smart Diff & Sync Card) */}
                    {m.parsedItems && m.parsedItems.length > 0 && (
                      <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-blue-50/90 to-slate-50 dark:bg-none dark:bg-[#131314] border border-blue-200 dark:border-[#2F3136] shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs">
                            <Zap size={15} className="text-amber-500 fill-amber-500" />
                            <span>ระบบ Auto-Fill อัจฉริยะ</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 font-bold">
                            {m.diffSummary?.diffCount ? `พบจุดต่าง ${m.diffSummary.diffCount} จุด` : 'สมบูรณ์ครบถ้วน'}
                          </span>
                        </div>

                        {/* Metric Badges */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                          <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5">
                            <div className="text-slate-500">อ่านได้ทั้งหมด</div>
                            <div className="font-bold text-slate-800 dark:text-white text-xs">{m.diffSummary?.total || m.parsedItems.length}</div>
                          </div>
                          <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                            <div className="text-emerald-700 dark:text-emerald-300">ตรงกับระบบ</div>
                            <div className="font-bold text-emerald-800 dark:text-emerald-200 text-xs">{m.diffSummary?.completeCount ?? m.parsedItems.length}</div>
                          </div>
                          <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                            <div className="text-amber-700 dark:text-amber-300">จุดต่าง/ขาด</div>
                            <div className="font-bold text-amber-800 dark:text-amber-200 text-xs">{m.diffSummary?.diffCount ?? 0}</div>
                          </div>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setMessages(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], diffMode: 'diff_only' };
                                return next;
                              });
                            }}
                            className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer ${
                              (m.diffMode || 'diff_only') === 'diff_only'
                                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            🔄 เติมเฉพาะจุดต่าง (Diff Only)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMessages(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], diffMode: 'all' };
                                return next;
                              });
                            }}
                            className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer ${
                              m.diffMode === 'all'
                                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            📋 เติมทั้งหมด (Full Sync)
                          </button>
                        </div>

                        {/* Primary Action Button 1: Auto-Fill ลงเว็บ */}
                        {m.autoFillApplied ? (
                          <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex flex-col items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800 shadow-sm animate-in zoom-in-95">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={15} className="text-emerald-500" />
                              <span>บันทึกข้อมูลเรียบร้อยแล้ว ✨</span>
                            </div>
                            {m.targetLocation && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                ปลายทาง: <span className="underline decoration-emerald-300">{m.targetLocation}</span> {m.targetName ? `(${m.targetName})` : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(dbActionStatus)}
                            onClick={async () => {
                              if (onAutoFillChecks && !dbActionStatus) {
                                const snap = onCaptureSnapshot?.('ก่อน Auto-Fill ตารางตรวจเช็ก');
                                setDbActionStatus('กำลังดำเนินการ...');
                                try {
                                  const res = await onAutoFillChecks({
                                    items: m.parsedItems || [],
                                    targetCategory: m.targetCategory,
                                    onlyDiffs: (m.diffMode || 'diff_only') === 'diff_only',
                                    syncSheets: true,
                                  });
                                  setMessages((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], autoFillApplied: true };
                                    return next;
                                  });
                                  addMessage(
                                    'ai',
                                    res.summaryText ||
                                      `✅ บันทึกข้อมูลตารางลงระบบและ Cloud เรียบร้อยแล้วค่ะ (อัปเดต ${res.updatedCount} จุด)`,
                                    false,
                                    undefined,
                                    undefined,
                                    undefined,
                                    { undoSnapshot: snap }
                                  );
                                } finally {
                                  setDbActionStatus(null);
                                }
                              }
                            }}
                            className="w-full py-2.5 px-3 rounded-xl bg-[#1B6EF3] hover:bg-[#0B5ED7] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            <span>ยืนยันลงข้อมูลเข้าเว็บ ({m.parsedItems.length} รายการ)</span>
                          </button>
                        )}

                        {/* Action Button 2: One-Click Restock / Update Stock */}
                        {(m.restockItems && m.restockItems.length > 0) && (
                          m.restockApplied ? (
                            <div className="w-full py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 text-xs font-bold flex flex-col items-center justify-center gap-1 border border-sky-200 shadow-sm animate-in zoom-in-95">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-sky-500" />
                                <span>อัปเดตข้อมูล/ส่งใบเบิกเรียบร้อยแล้ว 📦</span>
                              </div>
                              <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                                ปลายทาง: <span className="underline decoration-sky-300">{m.targetLocation || 'คลังระบบ'}</span> ({m.restockItems.length} รายการ)
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(dbActionStatus)}
                              onClick={async () => {
                                if (onRestockRequest && !dbActionStatus) {
                                  const snap = onCaptureSnapshot?.('ก่อนส่งใบเบิก/อัปเดตสต็อก');
                                  setDbActionStatus('กำลังดำเนินการ...');
                                  try {
                                    await onRestockRequest({
                                      items: m.restockItems || [],
                                      targetCategory: m.targetLocation === 'ครุภัณฑ์' ? 'equipment' : 'emergency',
                                    });
                                    setMessages((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], restockApplied: true };
                                      return next;
                                    });
                                    addMessage(
                                      'ai',
                                      `📦 ส่งรายการเบิก/อัปเดตสต็อกเข้า ${m.targetLocation || 'ระบบ'} (${m.restockItems?.length || 0} รายการ) เรียบร้อยแล้วค่ะ ✨`,
                                      false,
                                      undefined,
                                      undefined,
                                      undefined,
                                      { undoSnapshot: snap }
                                    );
                                  } finally {
                                    setDbActionStatus(null);
                                  }
                                }
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              {m.targetLocation === 'ครุภัณฑ์' ? <Package size={14} /> : <Pill size={14} />}
                              <span>
                                {m.targetLocation === 'ครุภัณฑ์'
                                  ? `📦 ส่งรายการเช็กเข้าคลังครุภัณฑ์ (${m.restockItems.length} รายการ)`
                                  : m.targetLocation === 'รถ'
                                  ? `🚗 อัปเดตสต็อกรถฉุกเฉิน (${m.restockItems.length} รายการ)`
                                  : m.targetLocation === 'เป๋า'
                                  ? `💼 อัปเดตสต็อกกระเป๋า (${m.restockItems.length} รายการ)`
                                  : `📦 ส่งรายการเบิกเข้าคลังยา (${m.restockItems.length} รายการ)`}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {/* 🏷️ Vision Expiry Scan Confirmation Card */}
                    {m.labelScanData && m.labelScanData.items.length > 0 && (
                      <div className="mt-3 p-3 rounded-2xl bg-amber-50/90 dark:bg-[#131314] border border-amber-200 dark:border-[#2F3136] shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                          <div className="flex items-center gap-1.5">
                            <Tag size={14} />
                            <span>ยืนยันอัปเดตวันหมดอายุจากฉลาก</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                            ต้องยืนยันโดยพยาบาล
                          </span>
                        </div>
                        {m.labelScanData.items.map((entry, eIdx) => {
                          const selectedCand = entry.candidates[entry.selectedCandidateIdx];
                          const confScore = selectedCand?.score ?? 0;
                          const matchTag =
                            selectedCand?.matchedBy === 'code'
                              ? 'รหัสมาตรฐาน'
                              : selectedCand?.matchedBy === 'exact'
                              ? 'ตรงชื่อ 100%'
                              : selectedCand?.matchedBy === 'alias'
                              ? 'คำพ้องยา'
                              : 'ใกล้เคียง';
                          const isLowConfidence = entry.candidates.length > 0 && confScore > 0 && confScore < 75;

                          return (
                            <div
                              key={eIdx}
                              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-white/10 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="text-[11px] font-bold text-slate-800 dark:text-white">
                                  อ่านได้: {entry.scanned.itemName}
                                  {entry.scanned.sizeOrSpec ? ` (${entry.scanned.sizeOrSpec})` : ''}
                                </div>
                                {selectedCand && confScore > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      confScore >= 85
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : confScore >= 75
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    {matchTag} • {confScore}%
                                  </span>
                                )}
                              </div>
                              {isLowConfidence && (
                                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[10px] text-rose-700 dark:text-rose-300 font-semibold">
                                  ⚠️ ความเชื่อมั่นต่ำกว่า 75% กรุณาตรวจสอบขนาด/ความแรงและชื่อรายการที่จับคู่ให้ถูกต้องก่อนบันทึก
                                </div>
                              )}
                              {entry.candidates.length > 0 ? (
                                <select
                                  disabled={m.labelScanData?.applied || Boolean(dbActionStatus)}
                                  value={entry.selectedCandidateIdx}
                                  onChange={(e) => {
                                    const selIdx = Number(e.target.value);
                                    setMessages((prev) => {
                                      const next = [...prev];
                                      const curData = next[idx].labelScanData;
                                      if (!curData) return prev;
                                      const nextItems = curData.items.map((it, i) =>
                                        i === eIdx ? { ...it, selectedCandidateIdx: selIdx } : it
                                      );
                                      next[idx] = { ...next[idx], labelScanData: { ...curData, items: nextItems } };
                                      return next;
                                    });
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-[11px] font-medium"
                                >
                                  {entry.candidates.map((cand, cIdx) => (
                                    <option key={cand.itemId + cIdx} value={cIdx}>
                                      [{cand.locationLabel}] {cand.displayName} (EXP เดิม: {cand.currentExp})
                                      {cand.score ? ` — ${cand.score}%` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                  ⚠️ ไม่พบรายการที่ตรงกันในระบบ (หรือขนาดไม่ตรงกับรายการที่มี)
                                </p>
                              )}
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[9px] text-slate-500 mb-0.5">วันหมดอายุ (EXP)</label>
                                  <input
                                    type="text"
                                    disabled={m.labelScanData?.applied || Boolean(dbActionStatus)}
                                    value={entry.editedExp}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMessages((prev) => {
                                        const next = [...prev];
                                        const curData = next[idx].labelScanData;
                                        if (!curData) return prev;
                                        const nextItems = curData.items.map((it, i) =>
                                          i === eIdx ? { ...it, editedExp: val } : it
                                        );
                                        next[idx] = { ...next[idx], labelScanData: { ...curData, items: nextItems } };
                                        return next;
                                      });
                                    }}
                                    placeholder="YYYY-MM-DD"
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-slate-500 mb-0.5">Lot Number</label>
                                  <input
                                    type="text"
                                    disabled={m.labelScanData?.applied || Boolean(dbActionStatus)}
                                    value={entry.editedLot}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMessages((prev) => {
                                        const next = [...prev];
                                        const curData = next[idx].labelScanData;
                                        if (!curData) return prev;
                                        const nextItems = curData.items.map((it, i) =>
                                          i === eIdx ? { ...it, editedLot: val } : it
                                        );
                                        next[idx] = { ...next[idx], labelScanData: { ...curData, items: nextItems } };
                                        return next;
                                      });
                                    }}
                                    placeholder="Lot No."
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-[11px]"
                                  />
                                </div>
                              </div>
                              {!m.labelScanData?.applied && entry.candidates.length > 0 && (
                                <label className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(entry.nurseConfirmed)}
                                    disabled={Boolean(dbActionStatus)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setMessages((prev) => {
                                        const next = [...prev];
                                        const curData = next[idx].labelScanData;
                                        if (!curData) return prev;
                                        const nextItems = curData.items.map((it, i) =>
                                          i === eIdx ? { ...it, nurseConfirmed: checked } : it
                                        );
                                        next[idx] = { ...next[idx], labelScanData: { ...curData, items: nextItems } };
                                        return next;
                                      });
                                    }}
                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span>ยืนยันข้อมูลยา, Lot และวันหมดอายุตรงตามฉลากจริง</span>
                                </label>
                              )}
                            </div>
                          );
                        })}
                        {m.labelScanData.applied ? (
                          <div className="w-full py-2 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            <span>อัปเดตวันหมดอายุลงตารางเรียบร้อยแล้ว</span>
                          </div>
                        ) : (
                          m.labelScanData.items.some((it) => it.candidates.length > 0 && it.editedExp.trim()) && (
                            <button
                              type="button"
                              disabled={
                                Boolean(dbActionStatus) ||
                                !m.labelScanData.items.some(
                                  (it) => it.candidates.length > 0 && it.editedExp.trim() && it.nurseConfirmed
                                )
                              }
                              onClick={async () => {
                                if (!onUpdateInventoryItem || dbActionStatus) return;
                                const snap = onCaptureSnapshot?.('ก่อนอัปเดต EXP จากฉลาก');
                                setDbActionStatus('กำลังดำเนินการ...');
                                try {
                                  const updatedNames: string[] = [];
                                  for (const entry of m.labelScanData!.items) {
                                    if (!entry.nurseConfirmed) continue;
                                    const target = entry.candidates[entry.selectedCandidateIdx];
                                    if (!target || !entry.editedExp.trim()) continue;
                                    const res = await onUpdateInventoryItem({
                                      targetType: target.targetType,
                                      itemId: target.itemId,
                                      roomId: target.roomId,
                                      newExp: entry.editedExp.trim(),
                                      lotNumber: entry.editedLot.trim() || undefined,
                                    });
                                    if (res.success) {
                                      updatedNames.push(`${res.updatedName} → ${entry.editedExp.trim()}`);
                                    }
                                  }
                                  if (updatedNames.length > 0) {
                                    setMessages((prev) => {
                                      const next = [...prev];
                                      next[idx] = {
                                        ...next[idx],
                                        labelScanData: { ...next[idx].labelScanData!, applied: true },
                                      };
                                      return next;
                                    });
                                    addMessage(
                                      'ai',
                                      `✅ อัปเดตวันหมดอายุลงตารางเรียบร้อยแล้วค่ะ:\n• ${updatedNames.join('\n• ')}`,
                                      false,
                                      undefined,
                                      undefined,
                                      undefined,
                                      { undoSnapshot: snap }
                                    );
                                  }
                                } finally {
                                  setDbActionStatus(null);
                                }
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              <span>ยืนยันอัปเดตวันหมดอายุลงตาราง</span>
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {/* 📋 Equipment Registry Verification Card (Open Split-View Inline Editable Table) */}
                    {m.equipmentVerificationData && m.equipmentVerificationData.rows.length > 0 && (
                      <div className="mt-3 p-3 rounded-2xl bg-amber-50/90 dark:bg-[#131314] border border-amber-200 dark:border-[#2F3136] shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
                          <div className="flex items-center gap-1.5">
                            <Package size={15} className="text-amber-600 shrink-0" />
                            <span>ตารางทะเบียนครุภัณฑ์ก่อนบันทึก</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                            {m.equipmentVerificationData.rows.length} รายการ
                          </span>
                        </div>

                        {(() => {
                          const flagged = m.equipmentVerificationData!.rows.filter(
                            (r) => Boolean(r.handwritten_note?.trim()) || r.is_marked_x
                          ).length;
                          const selectedCount = m.equipmentVerificationData!.rows.filter(
                            (r) => r._selected
                          ).length;
                          return (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                              <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-white/5">
                                <div className="text-slate-500">ทั้งหมด</div>
                                <div className="font-bold text-slate-800 dark:text-white text-xs">
                                  {m.equipmentVerificationData!.rows.length}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-xl bg-yellow-100/80 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700">
                                <div className="text-amber-800 dark:text-amber-200">มีลายมือ/X</div>
                                <div className="font-bold text-amber-900 dark:text-amber-100 text-xs">
                                  {flagged}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                                <div className="text-emerald-700 dark:text-emerald-300">ติ๊กเลือก</div>
                                <div className="font-bold text-emerald-800 dark:text-emerald-200 text-xs">
                                  {selectedCount}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {m.equipmentVerificationData.applied ? (
                          <div className="w-full py-2 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            <span>
                              บันทึกลงฐานข้อมูลเรียบร้อยแล้ว (
                              {m.equipmentVerificationData.importedSummary?.importedCount ??
                                m.equipmentVerificationData.rows.filter((r) => r._selected).length}{' '}
                              รายการ)
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(dbActionStatus) || isSavingVerifiedImport}
                            onClick={() => {
                              setVerificationModalState({
                                isOpen: true,
                                messageId: m.id || null,
                                rows: m.equipmentVerificationData!.rows,
                                pageImages: m.equipmentVerificationData!.pageImages || [],
                              });
                            }}
                            className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                          >
                            <FileText size={14} />
                            <span>เปิดตารางตรวจสอบ &amp; แก้ไขก่อนบันทึก</span>
                          </button>
                        )}
                      </div>
                    )}
                    {m.isConfirmationCard && m.confirmationData && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-2.5 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{m.confirmationData.title}</span>
                        </div>
                        {m.confirmationData.status === 'pending' ? (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={Boolean(dbActionStatus)}
                              onClick={async () => {
                                if (dbActionStatus) return;
                                const targetCat = m.confirmationData?.targetCat || '';
                                const isDeleteAllEq = m.confirmationData?.actionKind === 'delete_all_equipment';
                                setDbActionStatus(
                                  isDeleteAllEq ? 'กำลังลบครุภัณฑ์ทั้งหมดออกจากฐานข้อมูล...' : 'กำลังดำเนินการ...'
                                );
                                try {
                                  if (isDeleteAllEq && onDeleteAllEquipment) {
                                    const delRes = await onDeleteAllEquipment();
                                    setMessages((prev) => {
                                      const next = [...prev];
                                      next[idx] = {
                                        ...next[idx],
                                        confirmationData: { ...next[idx].confirmationData!, status: 'confirmed' },
                                      };
                                      return next;
                                    });
                                    addMessage(
                                      'ai',
                                      delRes.syncedToCloud
                                        ? `🗑️ ลบครุภัณฑ์ทั้งหมด **${delRes.deletedCount.toLocaleString()} รายการ** ใน **${activeChannel?.name || 'Master'}** ออกจากฐานข้อมูล Firestore และเคลียร์หน้าเว็บเป็น 0 รายการเรียบร้อยแล้วค่ะ ✨🌸`
                                        : `🗑️ ล้างรายการครุภัณฑ์ในหน้าเว็บ **${delRes.deletedCount.toLocaleString()} รายการ** เป็น 0 รายการแล้วค่ะ${delRes.error ? `\n⚠️ หมายเหตุ Cloud: ${delRes.error}` : ''}`,
                                      false,
                                      undefined,
                                      undefined,
                                      ['🏥 เปิดภาพรวมครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
                                      { undoSnapshot: delRes.snapshot }
                                    );
                                    return;
                                  }

                                  let snap: AuraDataSnapshot | undefined;
                                  if (onDirectClearInventory) {
                                    snap = await onDirectClearInventory(targetCat);
                                  } else {
                                    snap = onCaptureSnapshot?.(`ก่อนล้างข้อมูล ${targetCat}`);
                                    if (onClearTargetInventory) {
                                      await onClearTargetInventory(targetCat);
                                    }
                                  }
                                  setMessages((prev) => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      confirmationData: { ...next[idx].confirmationData!, status: 'confirmed' },
                                    };
                                    return next;
                                  });
                                  addMessage(
                                    'ai',
                                    `🗑️ ยืนยันการล้างข้อมูลหมวด **${targetCat}** เรียบร้อยแล้วค่ะ! ข้อมูลถูกลบและบันทึกประวัติไว้ในระบบเรียบร้อยค่ะ ✨🌸`,
                                    false,
                                    undefined,
                                    undefined,
                                    undefined,
                                    { undoSnapshot: snap }
                                  );
                                } finally {
                                  setDbActionStatus(null);
                                }
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              {m.confirmationData.actionKind === 'delete_all_equipment'
                                ? 'ยืนยันลบทั้งหมด'
                                : '✅ ยืนยันการลบ'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(dbActionStatus)}
                              onClick={() => {
                                setMessages((prev) => {
                                  const next = [...prev];
                                  next[idx] = {
                                    ...next[idx],
                                    confirmationData: { ...next[idx].confirmationData!, status: 'cancelled' },
                                  };
                                  return next;
                                });
                                addMessage('ai', 'ยกเลิกการลบข้อมูลเรียบร้อยค่ะ ข้อมูลทุกอย่างยังอยู่ครบถ้วนเหมือนเดิมนะคะ 💕✨');
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : m.confirmationData.status === 'confirmed' ? (
                          <div className="py-1.5 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>ยืนยันและดำเนินการลบเรียบร้อยแล้ว</span>
                          </div>
                        ) : (
                          <div className="py-1.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5">
                            <X className="w-4 h-4 text-slate-400" />
                            <span>ยกเลิกการลบข้อมูล</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 📋 Copy Shift Handover Button */}
                    {m.handoverText && (
                      <button
                        type="button"
                        onClick={() => handleCopyHandover(m.handoverText!, idx)}
                        className="mt-2.5 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                      >
                        {copiedHandoverIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedHandoverIdx === idx ? 'คัดลอกข้อความเรียบร้อยแล้ว!' : 'คัดลอกข้อความส่งเวร'}</span>
                      </button>
                    )}

                    {/* ↩️ Undo Button after any Mutation */}
                    {m.undoSnapshot && onRestoreSnapshot && (
                      <div className="mt-2.5">
                        {m.undoApplied ? (
                          <div className="w-full py-1.5 px-3 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <span>ย้อนกลับข้อมูลเรียบร้อยแล้ว</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(dbActionStatus)}
                            onClick={() => handleUndoSnapshot(idx)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                          >
                            <Undo2 size={14} />
                            <span>ย้อนกลับ (Undo)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Persistent Action Button via actionMeta or runtime actionBtn */}
                    {m.actionMeta ? (
                      <button
                        type="button"
                        onClick={() => handleActionMetaClick(m.actionMeta!)}
                        className="mt-2.5 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>{m.actionMeta.label}</span>
                      </button>
                    ) : m.actionBtn ? (
                      <button
                        type="button"
                        onClick={m.actionBtn.onClick}
                        className="mt-2.5 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>{m.actionBtn.label}</span>
                      </button>
                    ) : null}

                    {/* 🌐 Google Search Grounding Sources */}
                    {m.sender === 'ai' && m.sources && m.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          แหล่งข้อมูลอ้างอิง (Google Search):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200/70 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-blue-900/40 text-[10px] font-medium text-blue-700 dark:text-blue-300 transition max-w-full"
                            >
                              <ExternalLink size={10} className="shrink-0" />
                              <span className="truncate max-w-[180px]">{src.title || src.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 💡 Quick Chat 3 Choices */}
                    {m.sender === 'ai' && m.suggestedChoices && m.suggestedChoices.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-[#2F3136] space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-[#A8C7FA]">
                          <Sparkles size={13} className="text-blue-500 dark:text-[#A8C7FA] shrink-0" />
                          <span>ตัวเลือกที่น่าจะตรงกับความต้องการของคุณ:</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {m.suggestedChoices.slice(0, 3).map((choice, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              disabled={isLoading || Boolean(dbActionStatus)}
                              onClick={() => processCommand(choice)}
                              className="w-full text-left px-3 py-2 rounded-xl bg-blue-50/90 hover:bg-blue-100 active:bg-blue-200/80 dark:bg-[#131314] dark:hover:bg-[#282A2C] text-blue-700 dark:text-[#E3E3E3] border border-blue-200 dark:border-[#2F3136] text-xs font-semibold shadow-xs transition-all duration-150 flex items-center justify-between group cursor-pointer disabled:opacity-50"
                            >
                              <span className="truncate">{choice}</span>
                              <span className="text-blue-500 dark:text-[#A8C7FA] group-hover:translate-x-1 transition-transform text-[11px] ml-1 shrink-0">➔</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <span
                      className={`block text-[9px] mt-1 text-right ${
                        m.sender === 'user'
                          ? (isDarkMode ? 'text-[#8E918F]' : 'text-blue-200')
                          : (isDarkMode ? 'text-[#8E918F]' : 'text-slate-400')
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {dbActionStatus && (
                <div className="flex items-center gap-2 bg-amber-50/90 dark:bg-[#1E1F20] px-3.5 py-2.5 rounded-2xl border border-amber-200 dark:border-[#2F3136] text-xs font-bold text-amber-800 dark:text-[#E3E3E3] animate-in fade-in">
                  <Loader2 size={14} className="animate-spin text-amber-600 dark:text-[#A8C7FA] shrink-0" />
                  <span>{dbActionStatus}</span>
                </div>
              )}
              {isLoading && (
                <div className="flex flex-col gap-2 bg-blue-50/80 dark:bg-[#1E1F20] p-3.5 rounded-2xl border border-blue-200 dark:border-[#2F3136] text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-blue-700 dark:text-[#E3E3E3]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="animate-spin text-blue-600 dark:text-[#A8C7FA]" />
                      <span>
                        {scanProgress ? scanProgress.text : 'น้องออร่ากำลังประมวลผล...'}
                      </span>
                    </div>
                    {scanProgress && scanProgress.total > 0 && (
                      <span className="text-[11px] font-mono font-extrabold text-blue-600 dark:text-[#A8C7FA]">
                        {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                      </span>
                    )}
                  </div>
                  {scanProgress && scanProgress.total > 0 && (
                    <div className="w-full h-2 bg-blue-200 dark:bg-[#282A2C] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-700 dark:from-[#A8C7FA] dark:to-[#8AB4F8] transition-all duration-300 rounded-full"
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

            {/* 📸 Photo Match Review & Confirmation Card */}
            {renderPhotoMatchConfirmationCard()}

            {/* 📋 Pending Upload Session Recovery Card */}
            {renderPendingUploadRecoveryCard()}

            {/* Input Form */}
            <div className={`p-4 border-t rounded-b-[2rem] transition-colors ${
              isDarkMode ? 'bg-[#131314] border-[#222327]' : 'bg-slate-50/50 border-slate-100'
            }`}>
              {/* 📎 Multi-Image / PDF Pending Attachments Preview Strip */}
              {(isProcessingAttachment || pendingAttachments.length > 0) && (
                <div className="mb-3 p-2.5 rounded-2xl bg-white dark:bg-[#1E1F20] border border-emerald-200 dark:border-[#2F3136] shadow-sm">
                  <div className="flex items-center justify-between px-0.5 mb-2">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      {isProcessingAttachment ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>กำลังย่อขนาดและเตรียมไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <Paperclip size={12} />
                          <span>ไฟล์รอส่งให้น้องออร่า ({pendingAttachments.length} ไฟล์)</span>
                        </>
                      )}
                    </span>
                    {!isProcessingAttachment && pendingAttachments.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearPendingAttachments}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                      >
                        ลบทั้งหมด
                      </button>
                    )}
                  </div>
                  {pendingAttachments.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                      {pendingAttachments.map((att, idx) => (
                        <div
                          key={`${att.fileName}-${idx}`}
                          onClick={() => {
                            if (att.isPdf || !onPreviewImage) return;
                            const imageOnly = pendingAttachments.filter((a) => !a.isPdf);
                            const matchedIndex = imageOnly.findIndex((a) => a === att);
                            const safeIdx = matchedIndex >= 0 ? matchedIndex : 0;
                            onPreviewImage({
                              url: att.previewUrl,
                              label: att.fileName || `รูปที่ ${safeIdx + 1} / ${imageOnly.length}`,
                              images: imageOnly.map((a, i) => ({
                                url: a.previewUrl,
                                label: a.fileName || `รูปที่ ${i + 1} / ${imageOnly.length}`,
                              })),
                              currentIndex: safeIdx,
                            });
                          }}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-[#3C4043] bg-slate-100 dark:bg-[#1E1F20] shrink-0 group flex items-center justify-center ${
                            att.isPdf ? '' : 'cursor-pointer hover:opacity-90 active:scale-95 transition'
                          }`}
                          title={att.isPdf ? att.fileName : `${att.fileName || 'รูปภาพ'} (แตะเพื่อดูขนาดใหญ่)`}
                        >
                          {att.isPdf ? (
                            <div className="flex flex-col items-center justify-center px-1 text-center">
                              <FileText size={20} className="text-rose-500" />
                              <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[54px] mt-0.5">
                                {att.fileName}
                              </span>
                            </div>
                          ) : (
                            <img
                              src={att.previewUrl}
                              alt={att.fileName || `Image ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold leading-none">
                            #{idx + 1}
                          </span>
                          {!att.isPdf && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRotatePendingAttachment(idx);
                              }}
                              disabled={isProcessingAttachment}
                              className="absolute top-1 left-1 p-1 bg-slate-900/80 hover:bg-blue-600 text-white rounded-full shadow cursor-pointer transition disabled:opacity-50"
                              title="หมุนภาพ 90 องศา (สำหรับภาพตะแคง)"
                            >
                              <RotateCw size={10} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePendingAttachment(idx);
                            }}
                            className="absolute top-1 right-1 p-0.5 bg-rose-600/95 hover:bg-rose-700 text-white rounded-md shadow cursor-pointer"
                            title="ลบไฟล์นี้"
                          >
                            <X size={10} className="stroke-[3]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {uiNotice && (
                <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-bold flex items-center justify-between gap-2">
                  <span>{uiNotice}</span>
                  <button type="button" onClick={() => setUiNotice(null)} className="cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isLoading || dbActionStatus || isProcessingAttachment) return;
                  if (inputMessage.trim() || pendingAttachments.length > 0) {
                    processCommand(inputMessage);
                  }
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleListen}
                  disabled={isLoading || Boolean(dbActionStatus)}
                  className={`p-2.5 rounded-full transition cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg'
                      : (isDarkMode
                          ? 'bg-[#1E1F20] text-[#C4C7C5] border border-[#2F3136] hover:bg-[#282A2C]'
                          : 'bg-blue-100 text-blue-600 hover:bg-blue-200')
                  }`}
                  title={isListening ? 'หยุดฟัง' : 'สั่งการด้วยเสียง'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleAttachFileSelect}
                />
                <input
                  type="file"
                  ref={attachInputRef}
                  className="hidden"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleAttachFileSelect}
                />
                <button
                  type="button"
                  disabled={isLoading || Boolean(dbActionStatus) || isProcessingAttachment}
                  onClick={() => {
                    setPendingScanMode('auto');
                    fileInputRef.current?.click();
                  }}
                  className={`p-2.5 rounded-full transition cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-[#1E1F20] text-[#C4C7C5] border border-[#2F3136] hover:bg-[#282A2C]'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                  title="ถ่ายรูปหรือเลือกรูปภาพ (พักไว้ในแถบตัวอย่างก่อนส่งพร้อมคำสั่ง)"
                >
                  <Camera size={18} />
                </button>
                <button
                  type="button"
                  disabled={isLoading || Boolean(dbActionStatus) || isProcessingAttachment}
                  onClick={() => attachInputRef.current?.click()}
                  className={`relative p-2.5 rounded-full transition cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-[#1E1F20] text-[#C4C7C5] border border-[#2F3136] hover:bg-[#282A2C]'
                      : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                  }`}
                  title="แนบรูปภาพหลายรูปหรือเอกสาร PDF พร้อมคำถาม"
                >
                  <Paperclip size={18} />
                  {pendingAttachments.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingAttachments.length}
                    </span>
                  )}
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onFocus={() => {
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  placeholder={
                    isListening
                      ? '🎙️ กำลังฟัง...'
                      : dbActionStatus
                      ? 'กำลังดำเนินการ...'
                      : pendingAttachments.length > 0
                      ? 'พิมพ์คำสั่งสำหรับรูป/ไฟล์ที่แนบ (เช่น แอดเข้าครุภัณฑ์ตามเลข)...'
                      : 'พิมพ์คุยกับน้องออร่า...'
                  }
                  className={`flex-1 min-w-0 px-4 py-2.5 rounded-full text-xs font-sans border outline-none transition ${
                    isDarkMode
                      ? 'bg-[#1E1F20] border-[#2F3136] text-[#E3E3E3] focus:border-[#A8C7FA]/60 placeholder-[#8E918F]'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-[#1B6EF3] shadow-inner'
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
                    disabled={
                      Boolean(dbActionStatus) ||
                      isProcessingAttachment ||
                      (inputMessage.trim() === '' && pendingAttachments.length === 0)
                    }
                    className={`w-10 h-10 min-w-[40px] rounded-full disabled:opacity-40 transition shadow-md cursor-pointer shrink-0 flex items-center justify-center overflow-visible ${
                      isDarkMode
                        ? 'bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#0E0E10]'
                        : 'bg-[#1B6EF3] hover:bg-[#0B5ED7] text-white'
                    }`}
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

      {/* 📋 Split-View Equipment Registry Verification Table Modal */}
      <EquipmentVerificationModal
        isOpen={verificationModalState.isOpen}
        initialRows={verificationModalState.rows}
        pageImages={verificationModalState.pageImages}
        isDarkMode={isDarkMode}
        isSaving={isSavingVerifiedImport}
        onClose={() =>
          setVerificationModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onRowsChange={(updatedRows) => {
          setVerificationModalState((prev) => ({ ...prev, rows: updatedRows }));
          if (verificationModalState.messageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === verificationModalState.messageId && msg.equipmentVerificationData
                  ? {
                      ...msg,
                      equipmentVerificationData: {
                        ...msg.equipmentVerificationData,
                        rows: updatedRows,
                      },
                    }
                  : msg
              )
            );
          }
        }}
        onConfirmImport={async (selectedRows) => {
          if (!onBulkImportEquipment || selectedRows.length === 0 || isSavingVerifiedImport) return;
          const snap = onCaptureSnapshot?.('ก่อนนำเข้าทะเบียนครุภัณฑ์');
          setIsSavingVerifiedImport(true);
          setDbActionStatus(`กำลังบันทึกครุภัณฑ์ที่เลือก ${selectedRows.length} รายการลงฐานข้อมูล...`);
          try {
            const importRes = await onBulkImportEquipment(selectedRows);
            const roomSummaryParts = Object.entries(importRes.roomCounts || {})
              .map(([rId, cnt]) => `${rId.toUpperCase()} (${cnt})`)
              .join(', ');

            const summaryLines: string[] = [
              `✅ บันทึกทะเบียนครุภัณฑ์ลงฐานข้อมูลสำเร็จแล้ว (ลำดับที่ ${importRes.minOrder} ถึง ${importRes.maxOrder} จำนวน ${importRes.importedCount} รายการ) ค่ะ ✨🌸`,
            ];
            if (roomSummaryParts) {
              summaryLines.push(`📍 กระจายตามห้อง: ${roomSummaryParts}`);
            }

            if (importRes.markedItems.length > 0) {
              summaryLines.push(
                `\n📝 รายการที่มีหมายเหตุลายมือ / กากบาท X (${importRes.markedItems.length} รายการ):`
              );
              importRes.markedItems.forEach((it) => {
                const statusBadge = it.status ? `[${it.status}]` : '';
                const notePart = it.note ? ` — ${it.note}` : '';
                const locPart = it.location ? ` (${it.location})` : '';
                summaryLines.push(
                  `• ลำดับ ${it.orderNumber}: **${it.name}** ${statusBadge}${locPart}${notePart}`
                );
              });
            }

            if (verificationModalState.messageId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === verificationModalState.messageId && msg.equipmentVerificationData
                    ? {
                        ...msg,
                        equipmentVerificationData: {
                          ...msg.equipmentVerificationData,
                          applied: true,
                          importedSummary: {
                            importedCount: importRes.importedCount,
                            minOrder: importRes.minOrder,
                            maxOrder: importRes.maxOrder,
                          },
                        },
                      }
                    : msg
                )
              );
            }

            setVerificationModalState((prev) => ({ ...prev, isOpen: false }));

            addMessage(
              'ai',
              summaryLines.join('\n'),
              true,
              undefined,
              undefined,
              ['🏥 เปิดดูหน้าครุภัณฑ์', '📋 สรุปส่งเวร (Shift Handover)'],
              {
                undoSnapshot: importRes.importedCount > 0 ? snap : undefined,
                actionMeta: {
                  type: 'navigate',
                  label: '🏥 เปิดหน้าครุภัณฑ์ห้องผ่าตัด',
                  view: 'room_check',
                  category: 'equipment',
                },
              }
            );
            speakText(
              `น้องออร่าบันทึกทะเบียนครุภัณฑ์ลำดับที่ ${importRes.minOrder} ถึง ${importRes.maxOrder} ครบ ${importRes.importedCount} รายการลงฐานข้อมูลเรียบร้อยแล้วค่ะ`
            );
          } finally {
            setIsSavingVerifiedImport(false);
            setDbActionStatus(null);
          }
        }}
      />
    </>
  );
};
