import React from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm cursor-zoom-out"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center cursor-default"
      >
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 p-2 text-white hover:text-slate-300 rounded-full bg-slate-800/80 transition"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={imageUrl}
          alt="Enlarged"
          className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-slate-700"
        />
      </div>
    </div>
  );
};
