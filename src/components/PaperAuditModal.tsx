import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Plus,
  RefreshCw,
  Eye,
  FileText,
  Volume2,
  VolumeX,
  BriefcaseMedical,
  Truck,
  Pill,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { PaperAuditResult } from '../types';
import { comparePaperWithWeb } from '../services/api';
import { useDataContext } from '../context/DataContext';
import { speakWithAura, stopSpeech } from '../utils/textToSpeech';
import { logAuditEvent } from '../services/auditLogger';

interface PaperAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'bag' | 'cart' | 'drug';
  isDarkMode?: boolean;
}

export const PaperAuditModal: React.FC<PaperAuditModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'bag',
  isDarkMode = false,
}) => {
  const {
    channelData,
    activeChannelId,
    activeChannel,
    batchAddItems,
    addBatchItemsToChannel,
    batchUpdateItemQuantities,
    reRenderData,
  } = useDataContext();

  const [category, setCategory] = useState<'bag' | 'cart' | 'drug'>(initialCategory);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [auditResult, setAuditResult] = useState<PaperAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'missing' | 'discrepancies' | 'matched' | 'extra'>('all');
  const [selectedMissingIndices, setSelectedMissingIndices] = useState<number[]>([]);
  const [selectedDiscrepancyIndices, setSelectedDiscrepancyIndices] = useState<number[]>([]);
  const [addedMissingNames, setAddedMissingNames] = useState<string[]>([]);
  const [updatedDiscrepancyNames, setUpdatedDiscrepancyNames] = useState<string[]>([]);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialCategory
  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory, isOpen]);

  // Clean up preview object URL on unmount or reset
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      stopSpeech();
    };
  }, [imagePreview]);

  if (!isOpen) return null;

  // Retrieve current items from channelData or localStorage for selected category
  const getCurrentWebItems = (): any[] => {
    if (category === 'drug') {
      try {
        const storedDrugs = localStorage.getItem('anesthesia_drugs');
        if (storedDrugs) return JSON.parse(storedDrugs);
      } catch (e) {
        // fallback
      }
      return [];
    }

    const currentList = channelData?.lists?.[category];
    if (!currentList?.groups) return [];

    const items: any[] = [];
    Object.entries(currentList.groups).forEach(([groupName, groupItems]) => {
      groupItems.forEach((item) => {
        items.push({
          ...item,
          groupName,
        });
      });
    });
    return items;
  };

  const currentWebItems = getCurrentWebItems();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAuditResult(null);
    setAddedMissingNames([]);
    setUpdatedDiscrepancyNames([]);
    setActionSuccessMsg(null);
  };

  const startAudit = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(15);
    setProgressText('น้องออร่ากำลังอ่านตัวหนังสือและตารางจากกระดาษ (OCR)... ✨');

    const progressTimer1 = setTimeout(() => {
      setAnalysisProgress(50);
      setProgressText('กำลังเปรียบเทียบรายการในกระดาษกับฐานข้อมูลเว็บปัจจุบัน... 🔍');
    }, 1200);

    const progressTimer2 = setTimeout(() => {
      setAnalysisProgress(85);
      setProgressText('กำลังสรุปผลการตรวจสอบและจำแนกรายการที่ขาด/ไม่ตรงกัน... 📊');
    }, 2400);

    try {
      const data = await comparePaperWithWeb(
        selectedFile,
        currentWebItems,
        category,
        selectedFile.name
      );

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      setAnalysisProgress(100);
      setProgressText('วิเคราะห์และเปรียบเทียบเสร็จเรียบร้อยแล้วค่ะ! ✨🌸');

      if (data.result) {
        setAuditResult(data.result);
        // Pre-select all missing items
        if (data.result.missingInWeb) {
          setSelectedMissingIndices(data.result.missingInWeb.map((_: any, idx: number) => idx));
        }
        // Pre-select all discrepancies
        if (data.result.discrepancies) {
          setSelectedDiscrepancyIndices(data.result.discrepancies.map((_: any, idx: number) => idx));
        }

        // Voice read summary with locked cute tone
        if (data.result.summaryText) {
          speakWithAura(data.result.summaryText, [], undefined, () => setIsSpeaking(false));
          setIsSpeaking(true);
        }

        // Log audit event
        logAuditEvent({
          action: 'เช็คของ',
          targetCollection: category,
          targetId: 'paper_audit',
          details: {
            message: `สแกนตรวจเทียบกระดาษกับระบบเว็บ (${category})`,
            matchedCount: data.result.matchedItems?.length || 0,
            missingCount: data.result.missingInWeb?.length || 0,
            discrepancyCount: data.result.discrepancies?.length || 0,
          },
        });
      }
    } catch (err: any) {
      console.warn('Paper audit error:', err);
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      alert('เกิดข้อขัดข้องในการส่งรูปภาพไปให้ AI ตรวจสอบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeakSummary = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
      return;
    }
    if (auditResult?.summaryText) {
      speakWithAura(auditResult.summaryText, [], undefined, () => setIsSpeaking(false));
      setIsSpeaking(true);
    }
  };

  // Add selected missing items to web immediately
  const handleAddMissingItems = () => {
    if (!auditResult?.missingInWeb) return;

    const itemsToAdd = auditResult.missingInWeb.filter((_, idx) =>
      selectedMissingIndices.includes(idx)
    );

    if (itemsToAdd.length === 0) {
      alert('กรุณาเลือกรายการที่ต้องการเพิ่มเข้าเว็บอย่างน้อย 1 รายการ');
      return;
    }

    const formattedItems = itemsToAdd.map((item) => ({
      name: item.itemName,
      qty: item.targetQuantity || '1',
      unitText: item.targetQuantity || '1',
      groupName: item.category || (category === 'cart' ? 'ยาและเวชภัณฑ์ฉุกเฉิน' : 'อุปกรณ์ช่วยชีวิตฉุกเฉิน'),
      exp: item.expDate || '-',
    }));

    if (category === 'bag' || category === 'cart') {
      addBatchItemsToChannel(activeChannelId, formattedItems, category);
      reRenderData();
    } else {
      // Drug category
      try {
        const stored = localStorage.getItem('anesthesia_drugs');
        const existingDrugs = stored ? JSON.parse(stored) : [];
        const newDrugs = [
          ...existingDrugs,
          ...formattedItems.map((f, i) => ({
            id: `drug_ocr_${Date.now()}_${i}`,
            name: f.name,
            totalQty: parseInt(f.qty, 10) || 1,
            remaining: parseInt(f.qty, 10) || 1,
            unit: 'amp',
            location: 'คลังยาวิสัญญี',
            category: 'ยาฉุกเฉิน',
            expDate: f.exp,
          })),
        ];
        localStorage.setItem('anesthesia_drugs', JSON.stringify(newDrugs));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Error saving drugs:', e);
      }
    }

    const addedNames = itemsToAdd.map((i) => i.itemName);
    setAddedMissingNames((prev) => [...prev, ...addedNames]);
    setActionSuccessMsg(`✨ บันทึกเพิ่มรายการ ${itemsToAdd.length} รายการเข้าสู่ระบบเว็บเรียบร้อยแล้วค่ะ!`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Update web item quantities to match paper checklist
  const handleUpdateDiscrepancies = () => {
    if (!auditResult?.discrepancies) return;

    const itemsToUpdate = auditResult.discrepancies.filter((_, idx) =>
      selectedDiscrepancyIndices.includes(idx)
    );

    if (itemsToUpdate.length === 0) {
      alert('กรุณาเลือกรายการที่ต้องการอัปเดตจำนวนอย่างน้อย 1 รายการ');
      return;
    }

    const updates = itemsToUpdate.map((item) => ({
      itemName: item.itemName,
      newQty: item.paperQty || '1',
    }));

    if (category === 'bag' || category === 'cart') {
      batchUpdateItemQuantities(activeChannelId, updates, category);
      reRenderData();
    }

    const updatedNames = itemsToUpdate.map((i) => i.itemName);
    setUpdatedDiscrepancyNames((prev) => [...prev, ...updatedNames]);
    setActionSuccessMsg(`✨ ปรับจำนวน ${itemsToUpdate.length} รายการในเว็บให้ตรงตามกระดาษเรียบร้อยแล้วค่ะ!`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleCloseModal = () => {
    stopSpeech();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden my-auto ${
          isDarkMode
            ? 'bg-[#18191B] border-white/10 text-gray-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 transition-colors ${
            isDarkMode
              ? 'bg-gradient-to-r from-blue-900/30 via-indigo-900/30 to-purple-900/30 border-white/10'
              : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-pink-50 border-slate-200/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold flex items-center gap-1.5">
                  <span>ตรวจเทียบกระดาษกับเว็บ (Paper Checklist Audit)</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                  AI Vision 3.8
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                ถ่ายภาพใบเช็คกระดาษเพื่อให้น้องออร่าหาว่ามีรายการไหนขาดหรือจำนวนไม่ตรงกับเว็บ 💕
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Selector Bar */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between flex-wrap gap-2 text-xs shrink-0 ${
            isDarkMode ? 'bg-[#1F2023] border-white/5' : 'bg-slate-50 border-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 dark:text-gray-400">หมวดหมู่ที่จะเทียบ:</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'bag', label: 'กระเป๋าฉุกเฉิน', icon: BriefcaseMedical },
                { id: 'cart', label: 'รถฉุกเฉิน (Crash Cart)', icon: Truck },
                { id: 'drug', label: 'คลังยาวิสัญญี', icon: Pill },
              ].map((c) => {
                const IconComponent = c.icon;
                const isActive = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategory(c.id as any);
                      setAuditResult(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isDarkMode
                        ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent size={13} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
            รายการในเว็บปัจจุบัน: <span className="font-bold text-blue-600 dark:text-blue-400">{currentWebItems.length} รายการ</span>
          </div>
        </div>

        {/* Success Alert Banner */}
        {actionSuccessMsg && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: Upload / Image Preview */}
          {!auditResult && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                    isDarkMode
                      ? 'border-white/15 hover:border-pink-500/50 bg-white/5'
                      : 'border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                    <Camera size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      ถ่ายภาพหรืออัปโหลดรูปตารางกระดาษตรวจเช็ค
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                      ถ่ายภาพตารางตรวจเช็คกระเป๋ายา, รถฉุกเฉิน หรือแบบฟอร์มบันทึก 5 สัปดาห์ เพื่อนำมาเปรียบเทียบกับข้อมูลบนเว็บ
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                  >
                    <Upload size={14} />
                    <span>เลือกรูปภาพ / ถ่ายภาพด้วยกล้อง</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black/5 dark:bg-black/30 flex items-center justify-center max-h-[360px]">
                    <img
                      src={imagePreview}
                      alt="Paper Checklist Preview"
                      className="max-h-[360px] w-auto object-contain"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold hover:bg-slate-900 transition flex items-center gap-1 shadow-md"
                      >
                        <RefreshCw size={12} />
                        <span>เปลี่ยนรูปภาพ</span>
                      </button>
                    </div>
                  </div>

                  {isAnalyzing ? (
                    <div
                      className={`p-5 rounded-2xl border text-center space-y-3 ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-pink-50/60 border-pink-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 text-pink-600 dark:text-pink-400 font-bold text-sm">
                        <Sparkles size={18} className="animate-spin" />
                        <span>{progressText}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-pink-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${analysisProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400">
                        น้องออร่ากำลังวิเคราะห์ตารางอย่างละเอียด กรุณารอสักครู่นะคะ ✨
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={startAudit}
                        className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-pink-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Sparkles size={16} />
                        <span>เริ่มสแกนตรวจเทียบกระดาษกับเว็บ ✨</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Audit Results View */}
          {auditResult && (
            <div className="space-y-4">
              {/* Sweet Anime Speech Bubble */}
              <div
                className={`p-4 rounded-2xl border relative overflow-hidden transition-all ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-blue-950/40 border-pink-500/30'
                    : 'bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 border-pink-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Sparkles size={18} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                          <span>สรุปผลการวิเคราะห์โดยน้องออร่า</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-pink-500/20 text-pink-500 font-semibold">
                            Aura AI
                          </span>
                        </h4>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-gray-200 leading-relaxed">
                        {auditResult.summaryText}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSpeakSummary}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      isSpeaking
                        ? 'bg-pink-500 text-white border-pink-400 shadow-md animate-pulse'
                        : isDarkMode
                        ? 'bg-white/10 text-pink-300 border-white/10 hover:bg-white/20'
                        : 'bg-white text-pink-600 border-pink-200 hover:bg-pink-50'
                    }`}
                    title="เปิด/ปิดเสียงอ่านสรุป"
                  >
                    {isSpeaking ? <Volume2 size={15} /> : <Volume2 size={15} />}
                    <span className="hidden sm:inline">{isSpeaking ? 'หยุดเสียง' : 'ฟังเสียงออร่า'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Status Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Matched */}
                <button
                  type="button"
                  onClick={() => setActiveTab('matched')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    activeTab === 'matched'
                      ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                    <span className="text-[11px] font-bold">🟢 ตรงกัน (Matched)</span>
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {auditResult.matchedItems.length}
                    <span className="text-[11px] font-normal ml-1 text-slate-500">รายการ</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                    กระดาษและเว็บตรงกันครบถ้วน
                  </div>
                </button>

                {/* 2. Missing in Web */}
                <button
                  type="button"
                  onClick={() => setActiveTab('missing')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    activeTab === 'missing'
                      ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-300'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                    <span className="text-[11px] font-bold">🟡 ขาดในเว็บ (Missing)</span>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-300">
                    {auditResult.missingInWeb.length}
                    <span className="text-[11px] font-normal ml-1 text-slate-500">รายการ</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                    มีในกระดาษแต่ยังไม่ได้เพิ่ม
                  </div>
                </button>

                {/* 3. Discrepancies */}
                <button
                  type="button"
                  onClick={() => setActiveTab('discrepancies')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    activeTab === 'discrepancies'
                      ? 'ring-2 ring-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-300'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
                    <span className="text-[11px] font-bold">🔴 ข้อผิดพลาด/ไม่ตรงกัน</span>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-300">
                    {auditResult.discrepancies.length}
                    <span className="text-[11px] font-normal ml-1 text-slate-500">รายการ</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                    จำนวนในเว็บไม่ตรงกับกระดาษ
                  </div>
                </button>

                {/* 4. Extra in Web */}
                <button
                  type="button"
                  onClick={() => setActiveTab('extra')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    activeTab === 'extra'
                      ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-300'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                    <span className="text-[11px] font-bold">🔵 มีเฉพาะในเว็บ</span>
                    <HelpCircle size={14} />
                  </div>
                  <div className="text-lg font-black text-blue-700 dark:text-blue-300">
                    {auditResult.extraInWeb.length}
                    <span className="text-[11px] font-normal ml-1 text-slate-500">รายการ</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                    มีในระบบแต่กระดาษชุดนี้ไม่มี
                  </div>
                </button>
              </div>

              {/* Action Toolbar & Filters */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between flex-wrap gap-2.5 ${
                  isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {[
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'missing', label: `ขาดในเว็บ (${auditResult.missingInWeb.length})` },
                    { id: 'discrepancies', label: `ไม่ตรงกัน (${auditResult.discrepancies.length})` },
                    { id: 'matched', label: `ตรงกัน (${auditResult.matchedItems.length})` },
                    { id: 'extra', label: `มีเฉพาะในเว็บ (${auditResult.extraInWeb.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        activeTab === t.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : isDarkMode
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Primary 1-Click Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {auditResult.missingInWeb.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddMissingItems}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus size={14} />
                      <span>เพิ่มรายการที่ขาดเข้าเว็บทันที ({selectedMissingIndices.length})</span>
                    </button>
                  )}

                  {auditResult.discrepancies.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUpdateDiscrepancies}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Check size={14} />
                      <span>ปรับจำนวนตามกระดาษ ({selectedDiscrepancyIndices.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAuditResult(null);
                      setSelectedFile(null);
                      setImagePreview('');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${
                      isDarkMode
                        ? 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Camera size={13} />
                    <span>สแกนใบใหม่</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Photo Preview */}
              {imagePreview && (
                <div
                  className={`p-3 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setIsImageExpanded(!isImageExpanded)}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300">
                      <FileText size={15} className="text-blue-600" />
                      <span>รูปถ่ายกระดาษตรวจเช็คที่ใช้เปรียบเทียบ</span>
                      <span className="text-[10px] text-slate-400">
                        ({isImageExpanded ? 'คลิกเพื่อย่อ' : 'คลิกเพื่อดูรูปภาพต้นฉบับ'})
                      </span>
                    </div>
                    {isImageExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {isImageExpanded && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-black/10 flex items-center justify-center p-2">
                      <img
                        src={imagePreview}
                        alt="Paper Checklist"
                        className="max-h-[420px] w-auto object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Items List View */}
              <div className="space-y-2.5">
                {/* 1. Missing in Web Section */}
                {(activeTab === 'all' || activeTab === 'missing') && auditResult.missingInWeb.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={15} />
                        <span>รายการที่มีในกระดาษ แต่ยังไม่ได้แอดลงในระบบเว็บ ({auditResult.missingInWeb.length} รายการ)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMissingIndices.length === auditResult.missingInWeb.length) {
                            setSelectedMissingIndices([]);
                          } else {
                            setSelectedMissingIndices(auditResult.missingInWeb.map((_, i) => i));
                          }
                        }}
                        className="text-[11px] text-amber-700 dark:text-amber-300 underline cursor-pointer"
                      >
                        {selectedMissingIndices.length === auditResult.missingInWeb.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {auditResult.missingInWeb.map((item, idx) => {
                        const isSelected = selectedMissingIndices.includes(idx);
                        const isAdded = addedMissingNames.includes(item.itemName);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isAdded) return;
                              setSelectedMissingIndices((prev) =>
                                prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                              );
                            }}
                            className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 opacity-70'
                                : isSelected
                                ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                                : isDarkMode
                                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected || isAdded}
                                disabled={isAdded}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-amber-600 accent-amber-500 cursor-pointer"
                              />
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{item.itemName}</span>
                                  {isAdded && (
                                    <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                      ✓ เพิ่มเข้าเว็บแล้ว
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                  <span>จำนวนที่ระบุในกระดาษ: <strong className="text-amber-600">{item.targetQuantity || '1'}</strong></span>
                                  {item.expDate && item.expDate !== '-' && (
                                    <span>วันหมดอายุ: {item.expDate}</span>
                                  )}
                                  {item.category && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-[9px]">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="text-[11px] font-bold text-amber-600 shrink-0">
                              + รอดำเนินการ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Discrepancies Section */}
                {(activeTab === 'all' || activeTab === 'discrepancies') && auditResult.discrepancies.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={15} />
                        <span>รายการที่ข้อมูลไม่ตรงกัน / จำนวนต่างกัน ({auditResult.discrepancies.length} รายการ)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDiscrepancyIndices.length === auditResult.discrepancies.length) {
                            setSelectedDiscrepancyIndices([]);
                          } else {
                            setSelectedDiscrepancyIndices(auditResult.discrepancies.map((_, i) => i));
                          }
                        }}
                        className="text-[11px] text-rose-700 dark:text-rose-300 underline cursor-pointer"
                      >
                        {selectedDiscrepancyIndices.length === auditResult.discrepancies.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {auditResult.discrepancies.map((item, idx) => {
                        const isSelected = selectedDiscrepancyIndices.includes(idx);
                        const isUpdated = updatedDiscrepancyNames.includes(item.itemName);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isUpdated) return;
                              setSelectedDiscrepancyIndices((prev) =>
                                prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                              );
                            }}
                            className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                              isUpdated
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 opacity-70'
                                : isSelected
                                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700'
                                : isDarkMode
                                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected || isUpdated}
                                disabled={isUpdated}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-rose-600 accent-rose-500 cursor-pointer"
                              />
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{item.itemName}</span>
                                  {isUpdated && (
                                    <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                      ✓ อัปเดตแล้ว
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                                  {item.issue}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-3 mt-0.5">
                                  <span>กระดาษ: <strong>{item.paperQty || '-'}</strong></span>
                                  <span>ในเว็บเดิม: <strong>{item.webQty || '-'}</strong></span>
                                </div>
                              </div>
                            </div>

                            <span className="text-[11px] font-bold text-rose-600 shrink-0">
                              ปรับเป็น {item.paperQty}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Matched Section */}
                {(activeTab === 'all' || activeTab === 'matched') && auditResult.matchedItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={15} />
                      <span>รายการที่ตรงกันทั้งกระดาษและเว็บ ({auditResult.matchedItems.length} รายการ)</span>
                    </div>

                    <div className="space-y-1.5">
                      {auditResult.matchedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs ${
                            isDarkMode
                              ? 'bg-emerald-950/20 border-emerald-900/40 text-gray-200'
                              : 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span className="font-semibold">{item.itemName}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                            ตรงกัน ({item.paperQty || item.webQty || '1'})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Extra in Web Section */}
                {(activeTab === 'all' || activeTab === 'extra') && auditResult.extraInWeb.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                      <HelpCircle size={15} />
                      <span>รายการที่มีอยู่ในระบบเว็บ แต่ในฟอร์มกระดาษชุดนี้ไม่มี ({auditResult.extraInWeb.length} รายการ)</span>
                    </div>

                    <div className="space-y-1.5">
                      {auditResult.extraInWeb.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs ${
                            isDarkMode
                              ? 'bg-blue-950/20 border-blue-900/40 text-gray-200'
                              : 'bg-blue-50/40 border-blue-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-medium">{item.itemName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            จำนวนในเว็บ: {item.webQty || '1'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDarkMode ? 'bg-[#18191B] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-xs text-slate-500 dark:text-gray-400">
            ระบบตรวจสอบเอกสารอัตโนมัติ (Document Audit) เชื่อมโยงกับ Google Sheets & Firestore
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isDarkMode
                  ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
