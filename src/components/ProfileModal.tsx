import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Crop,
  Key,
  LogOut,
  RotateCw,
  Trash2,
  Upload,
  User as UserIcon,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { User } from '../types';

const PRESET_AVATARS = [
  {
    label: 'แพทย์ / วิสัญญีแพทย์ (Doctor)',
    url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'พยาบาลวิสัญญี (Nurse)',
    url: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'เจ้าหน้าที่ผ่าตัด (Surgeon)',
    url: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'สเตทโทสโคป (Stethoscope)',
    url: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'พยาบาลหญิง (Female Nurse)',
    url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'เครื่องมือผ่าตัด (Surgical Tools)',
    url: 'https://images.unsplash.com/photo-1583912267670-6575ad472688?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'เครื่องมือดมยา (Anesthesia Equipment)',
    url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=200&q=80',
  },
  {
    label: 'ไซริงค์ฉีดยา (Syringe)',
    url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=200&q=80',
  },
];

interface ProfileModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onUpdateAvatar: (newAvatar: string) => void;
  onOpenPasswordModal?: () => void;
  onLogout?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onUpdateAvatar,
  onOpenPasswordModal,
  onLogout,
}) => {
  const [avatar, setAvatar] = useState<string>(currentUser?.avatar || '');
  const [avatarSaved, setAvatarSaved] = useState(false);

  // Cropper states
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setAvatar(currentUser.avatar || '');
      setAvatarSaved(false);
      setRawImageForCrop(null);
    }
  }, [isOpen, currentUser]);

  // When raw image changes, initialize cropper
  useEffect(() => {
    if (!rawImageForCrop) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      setCropZoom(1);
      setCropRotation(0);
      setCropPan({ x: 0, y: 0 });
      drawCropPreview(img, 1, 0, { x: 0, y: 0 });
    };
    img.src = rawImageForCrop;
  }, [rawImageForCrop]);

  // Redraw cropper canvas whenever zoom, rotation, or pan updates
  useEffect(() => {
    if (loadedImageRef.current && rawImageForCrop) {
      drawCropPreview(loadedImageRef.current, cropZoom, cropRotation, cropPan);
    }
  }, [cropZoom, cropRotation, cropPan, rawImageForCrop]);

  const drawCropPreview = (
    img: HTMLImageElement,
    zoom: number,
    rotation: number,
    pan: { x: number; y: number }
  ) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // Save context for transform
    ctx.save();

    // Center point
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw image centered
    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;
    if (aspect > 1) {
      drawW = size * aspect;
    } else {
      drawH = size / aspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX - cropPan.x, y: clientY - cropPan.y };
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setCropPan({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Create high-res circular avatar canvas
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 180;
    finalCanvas.height = 180;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Draw the cropped result directly from preview canvas
    ctx.drawImage(canvas, 0, 0, 180, 180);

    const croppedDataUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
    setAvatar(croppedDataUrl);
    onUpdateAvatar(croppedDataUrl);
    setAvatarSaved(true);
    setRawImageForCrop(null);
  };

  if (!isOpen || !currentUser) return null;

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setRawImageForCrop(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const handleSelectPreset = (url: string) => {
    setAvatar(url);
    onUpdateAvatar(url);
    setAvatarSaved(true);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    onUpdateAvatar('');
    setAvatarSaved(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-black rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                โปรไฟล์ผู้ใช้งาน (Profile)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                จัดการรูปโปรไฟล์ บัญชี และความปลอดภัย
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Interactive Image Cropper (Shown when an image is picked) */}
          {rawImageForCrop ? (
            <div className="p-4 bg-slate-50 dark:bg-neutral-900/90 rounded-2xl border border-sky-300 dark:border-neutral-700 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>ปรับแต่งรูปโปรไฟล์</span>
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  ลากเพื่อจัดตำแหน่ง
                </span>
              </div>

              {/* Canvas viewport with circular guide mask */}
              <div className="flex justify-center items-center py-2">
                <div
                  className="relative w-48 h-48 rounded-full overflow-hidden shadow-lg ring-4 ring-blue-500/80 cursor-grab active:cursor-grabbing touch-none bg-neutral-900"
                  onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
                  onMouseMove={(e) => handleMoveDrag(e.clientX, e.clientY)}
                  onMouseUp={handleEndDrag}
                  onMouseLeave={handleEndDrag}
                  onTouchStart={(e) => {
                    if (e.touches.length === 1) {
                      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches.length === 1) {
                      handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchEnd={handleEndDrag}
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={240}
                    height={240}
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                  {/* Guide ring */}
                  <div className="absolute inset-0 pointer-events-none border border-white/30 rounded-full" />
                </div>
              </div>

              {/* Cropper adjustment sliders & rotation */}
              <div className="space-y-3 px-2">
                <div className="flex items-center justify-between gap-3 text-neutral-600 dark:text-neutral-300">
                  <div className="flex items-center gap-2 flex-1">
                    <ZoomIn className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.05}
                      value={cropZoom}
                      onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                      className="w-full accent-blue-600 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <ZoomIn className="w-4 h-4 text-neutral-400 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCropRotation((prev) => (prev + 90) % 360)}
                    className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition cursor-pointer flex items-center gap-1 text-[11px] ios-touch"
                    title="หมุนรูป 90 องศา"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>หมุน {cropRotation}°</span>
                  </button>
                </div>

                {/* Confirm / Cancel crop */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setRawImageForCrop(null)}
                    className="px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium transition cursor-pointer ios-touch"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCrop}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer ios-touch"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>บันทึกรูปโปรไฟล์</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Account Details Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 flex items-center gap-3.5">
                <div className="relative shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={currentUser.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-sky-500 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 text-white flex items-center justify-center font-bold text-lg shadow-md ring-2 ring-neutral-700">
                      {currentUser.name ? currentUser.name.charAt(0) : <UserIcon className="w-6 h-6" />}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {currentUser.name}
                  </h4>
                  <p className="text-slate-500 dark:text-neutral-400 text-xs">
                    @{currentUser.username} ({currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'})
                  </p>
                  {avatarSaved && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>บันทึกรูปโปรไฟล์เรียบร้อย</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Profile Picture Upload & Presets Section */}
              <div className="space-y-2.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 text-xs">
                  <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>รูปโปรไฟล์ผู้ใช้งาน</span>
                </label>

                <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs text-xs ios-touch">
                      <Upload className="w-3.5 h-3.5" />
                      <span>อัปโหลดรูปจากอุปกรณ์</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                      />
                    </label>

                    {avatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-medium transition cursor-pointer flex items-center gap-1 text-xs ios-touch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูป</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-neutral-400 block mb-1.5">
                      หรือเลือกจากรูปโปรไฟล์สำเร็จรูป (8 รูปแบบ):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PRESET_AVATARS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(p.url)}
                          className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1.5 text-center ${
                            avatar === p.url
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-500/20'
                              : 'border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-900'
                          }`}
                        >
                          <img
                            src={p.url}
                            alt={p.label}
                            className="w-10 h-10 rounded-full object-cover shadow-xs border border-slate-200 dark:border-neutral-700"
                            loading="lazy"
                          />
                          <span className="text-[10px] text-slate-700 dark:text-neutral-300 font-medium line-clamp-1">
                            {p.label.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Account & Security Section */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-neutral-800">
            <label className="font-bold text-slate-700 dark:text-neutral-300">
              ความปลอดภัยและบัญชี
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onOpenPasswordModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPasswordModal();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-medium transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 font-medium transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-xs transition cursor-pointer shadow-xs hover:opacity-90"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
