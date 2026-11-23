import React, { useState, useEffect } from 'react';
import { X, RotateCcw, RotateCw, Save } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave?: (newImageUrl: string) => void;
}

const rotateImageBy90 = (dataUrl: string, clockwise: boolean): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      canvas.width = height;
      canvas.height = width;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((clockwise ? 90 : -90) * (Math.PI / 180));
      ctx.drawImage(img, -width / 2, -height / 2);
      ctx.restore();

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve(rotatedDataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, onClose, onSave }) => {
  const [currentImg, setCurrentImg] = useState(imageUrl);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    setCurrentImg(imageUrl);
  }, [imageUrl]);

  if (!isOpen || !currentImg) return null;

  const handleRotate = async (clockwise: boolean) => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageBy90(currentImg, clockwise);
      setCurrentImg(rotated);
    } finally {
      setIsRotating(false);
    }
  };

  const handleSaveRotation = () => {
    if (onSave) {
      onSave(currentImg);
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm cursor-zoom-out"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center cursor-default space-y-3"
      >
        {/* Top Control Bar */}
        <div className="absolute -top-14 left-0 right-0 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRotate(false)}
              disabled={isRotating}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer shadow-md"
              title="หมุนซ้าย 90°"
            >
              <RotateCcw size={14} />
              <span>หมุนซ้าย 90°</span>
            </button>
            <button
              type="button"
              onClick={() => handleRotate(true)}
              disabled={isRotating}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer shadow-md"
              title="หมุนขวา 90°"
            >
              <RotateCw size={14} />
              <span>หมุนขวา 90°</span>
            </button>
            {onSave && currentImg !== imageUrl && (
              <button
                type="button"
                onClick={handleSaveRotation}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer animate-in fade-in"
                title="บันทึกการหมุน"
              >
                <Save size={14} />
                <span>บันทึกการหมุน</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white hover:text-slate-300 rounded-full bg-slate-800/90 border border-slate-700 transition cursor-pointer shadow-md"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <img
          src={currentImg}
          alt="Enlarged"
          className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl border border-slate-700 select-none"
        />
      </div>
    </div>
  );
};
