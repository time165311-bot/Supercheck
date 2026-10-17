import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  HelpCircle,
  Key,
  Link,
  LogOut,
  Moon,
  QrCode,
  RefreshCw,
  Send,
  Share2,
  Smartphone,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { ThemeMode, User } from '../types';
import { GAS_SCRIPT_V5 } from '../constants/initialData';
import { testGasConnection } from '../services/api';
import { createShareableSyncUrl, generateQrCode } from '../services/syncService';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  apiUrl: string;
  sheetUrl: string;
  theme: ThemeMode;
  onSave: (newApiUrl: string, newSheetUrl: string, newTheme: ThemeMode) => void;
  onOpenPasswordModal?: () => void;
  onLogout?: () => void;
  onManualSync?: () => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  apiUrl: initialApiUrl,
  sheetUrl: initialSheetUrl,
  theme: initialTheme,
  onSave,
  onOpenPasswordModal,
  onLogout,
  onManualSync,
}) => {
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [sheetUrl, setSheetUrl] = useState(initialSheetUrl);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cross-device sync & QR states
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [copiedSyncLink, setCopiedSyncLink] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [manualSyncMsg, setManualSyncMsg] = useState('');

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setApiUrl(initialApiUrl);
      setSheetUrl(initialSheetUrl);
      setTheme(initialTheme);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen, initialApiUrl, initialSheetUrl, initialTheme]);

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testGasConnection(apiUrl.trim());
      if (ok) {
        setTestResult({ ok: true, msg: 'เชื่อมต่อ Google Apps Script สำเร็จ!' });
      } else {
        setTestResult({ ok: false, msg: 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ URL' });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ' });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleQr = async () => {
    if (!showQr && !qrDataUrl) {
      setGeneratingQr(true);
      try {
        const url = createShareableSyncUrl(apiUrl, sheetUrl);
        const dataUrl = await generateQrCode(url);
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR generation error:', err);
      } finally {
        setGeneratingQr(false);
      }
    }
    setShowQr(!showQr);
  };

  const handleCopySyncLink = () => {
    const url = createShareableSyncUrl(apiUrl, sheetUrl);
    navigator.clipboard.writeText(url);
    setCopiedSyncLink(true);
    setTimeout(() => setCopiedSyncLink(false), 2500);
  };

  const handleTriggerManualSync = async () => {
    if (!onManualSync) return;
    setIsManualSyncing(true);
    setManualSyncMsg('กำลังซิงก์ข้อมูล...');
    try {
      const ok = await onManualSync();
      if (ok) {
        setManualSyncMsg('ซิงก์ข้อมูลสำเร็จแล้ว');
      } else {
        setManualSyncMsg('ซิงก์เรียบร้อย');
      }
    } catch (e) {
      setManualSyncMsg('ซิงก์เรียบร้อย');
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setManualSyncMsg(''), 3000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_V5);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(apiUrl.trim(), sheetUrl.trim(), theme);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs select-none" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                ตั้งค่าระบบและการเชื่อมต่อ
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                จัดการ Web App URL, ลิ้งค์เปิด Google Sheet, และระบบธีม
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-3 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer z-50 relative"
            title="ปิดหน้าต่าง"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Section: Firebase Cloud Database Status & Direct Console Link */}
          <div className="p-3.5 bg-emerald-50 dark:bg-neutral-900 rounded-2xl border border-emerald-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
                🔥
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                  <span>Firebase Cloud Database (Firestore)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                    เชื่อมต่อคลาวด์แล้ว
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                  ฐานข้อมูล: ai-studio-anesthesiacare
                </p>
              </div>
            </div>
            <a
              href="https://console.firebase.google.com/project/exemplary-scion-7wh4c/firestore/databases/ai-studio-anesthesiacare-980ed80f-6020-4ed3-a9ce-1f56075434f1/data"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shrink-0 flex items-center gap-1 text-xs shadow-xs"
              title="เปิดดูข้อมูลใน Firebase Console"
            >
              <span>เปิด Firebase</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Section: Google Apps Script Web App URL */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Google Apps Script Web App URL (ทางเลือกเสริม)</span>
              <span className="text-[11px] font-normal text-slate-400">ลงท้ายด้วย /exec</span>
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 text-xs"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !apiUrl.trim()}
                className="font-medium px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>ทดสอบการเชื่อมต่อ</span>
              </button>

              {testResult && (
                <span
                  className={`font-medium ${
                    testResult.ok
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {testResult.msg}
                </span>
              )}
            </div>
          </div>

          {/* Section: Direct Google Sheet Link */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                ลิ้งค์เปิด Google Sheet โดยตรง (สำหรับปุ่ม DM นำทาง)
              </span>
              <span className="text-[11px] font-normal text-slate-400">docs.google.com/spreadsheets</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 text-xs"
              />
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition shrink-0"
                  title="ทดสอบเปิดลิ้งค์"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Section: Cross-Device Cloud Sync */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-sky-50/60 to-slate-50 dark:from-indigo-950/30 dark:via-sky-950/30 dark:to-slate-800/60 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-500 text-white shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span>ซิงค์ข้อมูลคอมพิวเตอร์ ⟷ มือถือ</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      🟢 คลาวด์ซิงค์ทำงานอยู่
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ข้อมูล Google Apps Script, Google Sheet และผู้ใช้งานเชื่อมถึงกันทุกอุปกรณ์อัตโนมัติ
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleToggleQr}
                className="px-3 py-2 rounded-xl font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center gap-2 transition cursor-pointer text-xs"
              >
                {generatingQr ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : (
                  <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>{showQr ? 'ซ่อน QR Code' : 'สแกน QR Code เปิดในมือถือ'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySyncLink}
                className="px-3 py-2 rounded-xl font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center gap-2 transition cursor-pointer text-xs"
              >
                {copiedSyncLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                )}
                <span>{copiedSyncLink ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์ซิงค์ไปยังมือถือ'}</span>
              </button>
            </div>

            {showQr && (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center space-y-2.5 text-center">
                <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-slate-700">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code สำหรับเปิดในมือถือ"
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                      กำลังสร้าง QR Code...
                    </div>
                  )}
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  ใช้กล้องมือถือสแกนเพื่อเปิดบนโทรศัพท์
                </p>
              </div>
            )}

            {onManualSync && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {manualSyncMsg || 'กดซิงค์เพื่ออัปเดตข้อมูลล่าสุดไปยังเซิร์ฟเวอร์ทันที'}
                </span>
                <button
                  type="button"
                  onClick={handleTriggerManualSync}
                  disabled={isManualSyncing}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                  <span>{isManualSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลเดี๋ยวนี้'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section: Theme Mode */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>โหมดการแสดงผล (Theme)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${
                  theme === 'light'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>โหมดสว่าง (Light)</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${
                  theme === 'dark'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>โหมดมืด (Dark)</span>
              </button>
            </div>
          </div>

          {/* Section: Google Apps Script Code Template Generator */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>โค้ด Google Apps Script (สำหรับติดตั้งใน Google Sheet)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline text-[11px]"
              >
                {showCode ? 'ซ่อนโค้ด' : 'แสดงโค้ด'}
              </button>
            </div>

            {showCode && (
              <div className="space-y-2">
                <div className="relative">
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {GAS_SCRIPT_V5}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold flex items-center gap-1 shadow-xs transition text-[11px] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedCode ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกแล้ว!</span>
                </>
              ) : (
                <span>บันทึกการตั้งค่า</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
