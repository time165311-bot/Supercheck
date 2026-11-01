import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  X,
  Code2,
} from 'lucide-react';
import { GAS_SCRIPT_V5 } from '../constants/initialData';
import { testGasConnection } from '../services/api';

export interface GoogleSheetsSettingsProps {
  sheetUrl?: string;
  apiUrl?: string;
  onSave?: (newApiUrl: string, newSheetUrl: string) => void;
  isDark?: boolean;
  onClose?: () => void;
}

/**
 * GoogleSheetsSettings Component
 * High Contrast, Dark/Light Mode compatible, with Syntax Highlighted GAS V5 Script Preview
 */
export const GoogleSheetsSettings: React.FC<GoogleSheetsSettingsProps> = ({
  sheetUrl = '',
  apiUrl = '',
  onSave,
  isDark = true,
  onClose,
}) => {
  const [inputSheetUrl, setInputSheetUrl] = useState<string>(sheetUrl);
  const [inputApiUrl, setInputApiUrl] = useState<string>(apiUrl);
  const [copiedGasCode, setCopiedGasCode] = useState<boolean>(false);
  const [isTestingGas, setIsTestingGas] = useState<boolean>(false);
  const [gasTestResult, setGasTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedConfigMsg, setSavedConfigMsg] = useState<boolean>(false);
  const [showScriptPreview, setShowScriptPreview] = useState<boolean>(true);

  const handleSave = () => {
    const trimmedSheet = inputSheetUrl.trim();
    const trimmedApi = inputApiUrl.trim();
    if (onSave) {
      onSave(trimmedApi, trimmedSheet);
    }
    setSavedConfigMsg(true);
    setTimeout(() => setSavedConfigMsg(false), 3000);
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_V5);
      setCopiedGasCode(true);
      setTimeout(() => setCopiedGasCode(false), 4000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = GAS_SCRIPT_V5;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedGasCode(true);
      setTimeout(() => setCopiedGasCode(false), 4000);
    }
  };

  const handleTestGas = async () => {
    if (!inputApiUrl.trim()) {
      setGasTestResult({
        ok: false,
        msg: 'กรุณากรอก Web App URL ของ Google Apps Script ก่อนกดทดสอบ',
      });
      return;
    }
    setIsTestingGas(true);
    setGasTestResult(null);
    try {
      const res = await testGasConnection(inputApiUrl.trim());
      setGasTestResult({ ok: res.ok, msg: res.message });
    } catch (e: any) {
      setGasTestResult({
        ok: false,
        msg: e?.message || 'ไม่สามารถทดสอบการเชื่อมต่อได้ ตรวจสอบสิทธิ์ Access เป็น Anyone',
      });
    } finally {
      setIsTestingGas(false);
    }
  };

  return (
    <div
      className={`w-full p-4 sm:p-5 rounded-2xl border transition-colors ${
        isDark
          ? 'bg-[#14161D] border-slate-700 text-white shadow-xl'
          : 'bg-white border-slate-300 text-slate-900 shadow-lg'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3
              className={`font-bold text-sm sm:text-base ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              ตั้งค่าการเชื่อมต่อ Google Sheets & Apps Script
            </h3>
            <p
              className={`text-xs font-medium ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              รองรับการบันทึกตรวจเช็ก 4 หมวดอัตโนมัติ (ครุภัณฑ์, กระเป๋า, รถ, คลังยา)
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Field 1: Google Sheets URL */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label
              className={`text-xs font-bold ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              1. URL ลิงก์ Google Sheets (สเปรดชีตปลายทาง):
            </label>
            {inputSheetUrl && (
              <a
                href={inputSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>เปิดดูชีตจริง</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <input
            type="url"
            value={inputSheetUrl}
            onChange={(e) => setInputSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition font-mono ${
              isDark
                ? 'bg-[#0E0F14] border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Field 2: Google Apps Script Web App URL */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center flex-wrap gap-1">
            <label
              className={`text-xs font-bold ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              2. Google Apps Script Web App URL (/exec):
            </label>
            <button
              type="button"
              onClick={handleTestGas}
              disabled={isTestingGas || !inputApiUrl.trim()}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold disabled:opacity-40 cursor-pointer"
            >
              {isTestingGas ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>กำลังทดสอบ...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>ทดสอบการเชื่อมต่อ</span>
                </>
              )}
            </button>
          </div>
          <input
            type="url"
            value={inputApiUrl}
            onChange={(e) => setInputApiUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition font-mono ${
              isDark
                ? 'bg-[#0E0F14] border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
          {gasTestResult && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 mt-1.5 ${
                gasTestResult.ok
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
              }`}
            >
              {gasTestResult.ok ? <Check size={14} /> : <X size={14} />}
              <span>{gasTestResult.msg}</span>
            </div>
          )}
        </div>

        {/* Buttons Row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Check size={15} />
            <span>{savedConfigMsg ? '✓ บันทึกสำเร็จแล้ว!' : '💾 บันทึกการตั้งค่า'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyGasCode}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
            }`}
          >
            {copiedGasCode ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            <span>{copiedGasCode ? '✓ คัดลอกโค้ดแล้ว' : 'คัดลอกโค้ด GAS V5'}</span>
          </button>
        </div>

        {/* Syntax Highlighted Code Preview Block */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-bold flex items-center gap-1.5 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              <Code2 size={14} className="text-emerald-500" />
              <span>โครงสร้างฟังก์ชัน Google Apps Script V5 (รองรับ 4 หมวด)</span>
            </span>
            <button
              type="button"
              onClick={() => setShowScriptPreview(!showScriptPreview)}
              className="text-xs text-blue-500 hover:underline cursor-pointer font-semibold"
            >
              {showScriptPreview ? 'ย่อโค้ด' : 'ขยายดูโค้ด'}
            </button>
          </div>

          {showScriptPreview && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19] text-xs font-mono shadow-inner">
              <div className="bg-[#131B2E] px-3 py-1.5 border-b border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                <span className="font-semibold text-cyan-300">Code.gs (Apps Script V5)</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                  Ready to Deploy
                </span>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto space-y-1 text-[11px] leading-relaxed selection:bg-blue-600 selection:text-white">
                <p className="text-slate-400">// --- 1. Main Entry Points: doGet & doPost ---</p>
                <p>
                  <span className="text-purple-400">function</span>{' '}
                  <span className="text-emerald-300">doGet</span>(e) &#123;{' '}
                  <span className="text-purple-400">return</span>{' '}
                  <span className="text-cyan-300">ok_</span>(&#123; status:{' '}
                  <span className="text-orange-300">'online'</span>, version:{' '}
                  <span className="text-orange-300">'5.0'</span> &#125;); &#125;
                </p>
                <p>
                  <span className="text-purple-400">function</span>{' '}
                  <span className="text-emerald-300">doPost</span>(e) &#123;
                </p>
                <p className="pl-4">
                  <span className="text-purple-400">var</span> data = JSON.
                  <span className="text-cyan-300">parse</span>(e.postData.contents);
                </p>
                <p className="pl-4 text-slate-400">// ตรวจสอบประเภทและแยกบันทึกตามหมวดอัตโนมัติ</p>
                <p className="pl-4">
                  <span className="text-purple-400">if</span> (data.type ==={' '}
                  <span className="text-orange-300">'eq'</span>) writeEquipmentReport_(ss, data);
                </p>
                <p className="pl-4">
                  <span className="text-purple-400">else if</span> (data.type ==={' '}
                  <span className="text-orange-300">'bag'</span>) writeEmergencyReport_(ss, data,{' '}
                  <span className="text-orange-300">'bag'</span>);
                </p>
                <p className="pl-4">
                  <span className="text-purple-400">else if</span> (data.type ==={' '}
                  <span className="text-orange-300">'cart'</span>) writeEmergencyReport_(ss, data,{' '}
                  <span className="text-orange-300">'cart'</span>);
                </p>
                <p className="pl-4">
                  <span className="text-purple-400">else if</span> (data.type ==={' '}
                  <span className="text-orange-300">'drug'</span>) writeDrugReport_(ss, data);
                </p>
                <p className="pl-4">
                  <span className="text-purple-400">return</span>{' '}
                  <span className="text-cyan-300">ok_</span>(&#123; message:{' '}
                  <span className="text-orange-300">'บันทึกข้อมูลเรียบร้อยแล้ว'</span> &#125;);
                </p>
                <p>&#125;</p>
                <p className="text-slate-400 mt-2">// ฟังก์ชันสร้าง Sheet ย่อยอัตโนมัติ: getUniqueSheet_(ss, baseName)</p>
                <p className="text-slate-400">// ปรับตั้งหน้ากระดาษ A4 Landscape + ตีกรอบเส้นขอบดำคมชัด</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetsSettings;
