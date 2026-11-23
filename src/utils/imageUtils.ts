// Helper to rotate an image (DataURL or File) by specified degrees (90, 180, 270)
export const rotateImageDegrees = (input: File | string, degrees: number = 180): Promise<string> => {
  return new Promise((resolve, reject) => {
    const loadImage = (src: string) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[RotateImage] Canvas context not available');
          resolve(src);
          return;
        }

        console.log(`[RotateImage] Rotating image by ${degrees}deg. Original size: ${img.width}x${img.height}`);
        const MAX_SIZE = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const normDeg = ((degrees % 360) + 360) % 360;
        const isSwapped = normDeg === 90 || normDeg === 270;

        canvas.width = isSwapped ? height : width;
        canvas.height = isSwapped ? width : height;

        // White background to avoid black borders on transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((normDeg * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(typeof input === 'string' ? input : '');
      img.src = src;
    };

    if (typeof input === 'string') {
      loadImage(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => loadImage(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(input);
    }
  });
};

// ฟังก์ชันหมุนภาพ 180 องศา และย่อขนาดภาพ (Client-side Preprocessing)
export const fixImageOrientation = (file: File): Promise<string> => {
  return rotateImageDegrees(file, 0);
};

export const prepareImageForOCR = (file: File): Promise<string> => {
  return fixImageOrientation(file);
};

// แปลง DataURL เป็น Blob สำหรับส่งแบบ multipart FormData
export const dataURLtoBlob = (dataUrl: string): Blob => {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    return new Blob([], { type: 'image/jpeg' });
  }
};

