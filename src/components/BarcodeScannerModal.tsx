import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Keyboard, Check } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'barcode-scanner-reader-element';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setErrorMsg(null);
      setPermissionDenied(false);
      setManualCode('');
      return;
    }

    if (activeTab !== 'camera') {
      stopScanner();
      return;
    }

    let isMounted = true;
    setErrorMsg(null);
    setPermissionDenied(false);

    const startScanner = async () => {
      try {
        // Request camera permission explicitly via getUserMedia to catch permission errors gracefully
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            stream.getTracks().forEach((track) => track.stop());
          } catch (permErr: any) {
            console.warn('getUserMedia permission check:', permErr);
            if (
              permErr?.name === 'NotAllowedError' ||
              permErr?.name === 'PermissionDeniedError' ||
              permErr?.message?.toLowerCase().includes('permission') ||
              permErr?.message?.toLowerCase().includes('denied')
            ) {
              if (isMounted) {
                setPermissionDenied(true);
                setErrorMsg('เบราว์เซอร์ปฏิเสธการเข้าถึงกล้อง (Permission Denied)');
              }
              return;
            }
          }
        }

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerElementId);
        }

        let cameraConfig: any = { facingMode: 'environment' };

        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCamera = cameras.find((c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
            ) || cameras[cameras.length - 1];

            if (backCamera) {
              cameraConfig = backCamera.id;
            }
          }
        } catch (camErr) {
          console.warn('getCameras failed, falling back to environment facingMode:', camErr);
        }

        await scannerRef.current.start(
          cameraConfig,
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
          const isPermErr =
            err?.name === 'NotAllowedError' ||
            err?.name === 'PermissionDeniedError' ||
            err?.message?.toLowerCase().includes('permission') ||
            err?.message?.toLowerCase().includes('denied');

          if (isPermErr) {
            setPermissionDenied(true);
            setErrorMsg('เบราว์เซอร์ปฏิเสธการเข้าถึงกล้อง (Permission Denied)');
          } else {
            setErrorMsg('ไม่สามารถเปิดกล้องได้: ' + (err?.message || 'กรุณาตรวจสอบการเชื่อมต่อกล้อง'));
          }
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
  }, [isOpen, activeTab]);

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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanSuccess(manualCode.trim());
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base">
            <Camera className="w-5 h-5 text-blue-500" />
            <span>สแกนบาร์โค้ด / QR Code</span>
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

        {/* Tab Selection: Camera vs Manual Entry */}
        <div className="px-5 pt-3 flex border-b border-slate-100 dark:border-slate-800 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
              activeTab === 'camera'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Camera size={15} />
            <span>ส่องกล้อง</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              setActiveTab('manual');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Keyboard size={15} />
            <span>พิมพ์รหัสเอง</span>
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-4 flex flex-col items-center">
          {activeTab === 'camera' ? (
            <div className="w-full relative bg-black rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center shadow-inner border border-slate-800">
              <div id={readerElementId} className="w-full h-full overflow-hidden" />

              {errorMsg && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-rose-400 gap-3">
                  <AlertCircle className="w-10 h-10 animate-bounce" />
                  <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>

                  {permissionDenied ? (
                    <div className="space-y-2 w-full">
                      <p className="text-[11px] text-slate-300">
                        กรุณากดอนุญาตสิทธิ์กล้องในเบราว์เซอร์ หรือใช้วิธีพิมพ์รหัสบาร์โค้ดด้วยตนเองด้านล่าง
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          stopScanner();
                          setActiveTab('manual');
                        }}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
                      >
                        ⌨️ สลับไปใช้พิมพ์รหัสเอง
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        stopScanner();
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 transition cursor-pointer active:scale-95"
                    >
                      ลองใหม่อีกครั้ง
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Manual Barcode Input Mode */
            <form onSubmit={handleManualSubmit} className="w-full space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ป้อนหมายเลขบาร์โค้ด / Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="เช่น 8851234567890 หรือ DRUG-001"
                    autoFocus
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Check size={16} />
                <span>ยืนยันรหัสบาร์โค้ด</span>
              </button>
            </form>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
            {activeTab === 'camera'
              ? 'ส่องกล้องไปที่รหัสบาร์โค้ดหรือ QR Code บนกล่องยา/อุปกรณ์ ระบบจะอ่านรหัสโดยอัตโนมัติ'
              : 'ป้อนหมายเลขหรือรหัสกำกับจากกล่องอุปกรณ์ แล้วกด ยืนยัน'}
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
