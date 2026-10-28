import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'barcode-scanner-reader-element';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setErrorMsg(null);

    const startScanner = async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerElementId);
        }

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          if (isMounted) setErrorMsg('ไม่พบกล้องในอุปกรณ์นี้');
          return;
        }

        const backCamera = cameras.find((c) =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
        ) || cameras[cameras.length - 1];

        await scannerRef.current.start(
          backCamera ? backCamera.id : { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
              stopScanner();
              onClose();
            }
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Failed to start barcode scanner:', err);
        if (isMounted) {
          setErrorMsg('ไม่สามารถเปิดกล้องได้: ' + (err?.message || 'กรุณาอนุญาตให้เข้าถึงกล้อง'));
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base">
            <Camera className="w-5 h-5 text-blue-500 animate-pulse" />
            <span>สแกนบาร์โค้ด / QR Code แท้จริง</span>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer active:scale-90"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-4 flex flex-col items-center">
          <div className="w-full relative bg-black rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center shadow-inner border border-slate-800">
            <div id={readerElementId} className="w-full h-full overflow-hidden" />

            {errorMsg && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-rose-400 gap-3">
                <AlertCircle className="w-10 h-10 animate-bounce" />
                <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    stopScanner();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 transition cursor-pointer active:scale-95"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
            ส่องกล้องไปที่รหัสบาร์โค้ดหรือ QR Code บนกล่องยา/อุปกรณ์ ระบบจะอ่านรหัสโดยอัตโนมัติ
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer active:scale-95"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};
