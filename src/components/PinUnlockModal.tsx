import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { isValidFourDigitPin } from '../utils/wardUtils';

interface PinUnlockModalProps {
  isOpen: boolean;
  wardId: string;
  actionLabel?: string;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onUnlocked: () => void;
  onCancel: () => void;
}

export const PinUnlockModal: React.FC<PinUnlockModalProps> = ({
  isOpen,
  wardId,
  actionLabel,
  onVerifyPin,
  onUnlocked,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = pin.replace(/\D/g, '').slice(0, 4);
    if (!isValidFourDigitPin(cleaned)) {
      setError('กรุณากรอกรหัส PIN 4 หลักให้ครบถ้วน');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const ok = await onVerifyPin(cleaned);
      if (ok) {
        onUnlocked();
      } else {
        setError('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('ไม่สามารถตรวจสอบรหัส PIN ได้');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1F20] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                ยืนยันรหัส PIN ห้องวอร์ด
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                วอร์ด <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{wardId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {actionLabel
              ? `กรุณากรอก PIN 4 หลักเพื่อปลดล็อกการแก้ไข (${actionLabel})`
              : 'ห้องวอร์ดนี้เปิดใช้งานรหัส PIN ป้องกันการแก้ไข กรุณากรอก PIN 4 หลักเพื่อดำเนินการต่อ'}
          </p>

          <div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(next);
                if (error) setError('');
              }}
              placeholder="• • • •"
              className="w-full py-3 px-4 rounded-2xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-black/30 text-center text-2xl font-mono font-black tracking-[0.6em] text-slate-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isVerifying || pin.length < 4}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'กำลังตรวจ...' : 'ปลดล็อกแก้ไข'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
