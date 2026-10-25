/**
 * Media conversion utility for offline persistence.
 * Converts uploaded image files to compressed Base64 Data Strings
 * so they can be stored permanently in localStorage.
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Converts a File or Blob into a Base64 Data URL string with optional canvas compression.
 */
export async function fileToBase64(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.85,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read file into Base64'));
    };

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Empty result from FileReader'));
        return;
      }

      // If not an image (e.g. svg or pdf), return raw Base64 data url directly
      if (!file.type.startsWith('image/') || file.type.includes('svg')) {
        resolve(rawDataUrl);
        return;
      }

      // Compress and scale down to fit comfortably in localStorage
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onerror = () => {
        // Fallback to raw data url if image element cannot decode
        resolve(rawDataUrl);
      };
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if dimensions exceed maximum
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL(format, quality);
          resolve(compressedDataUrl);
        } catch (err) {
          // If canvas extraction fails (e.g. security error), resolve raw data url
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Checks whether a given string is a valid Base64 image data URL.
 */
export function isBase64Image(value?: string | null): boolean {
  if (!value) return false;
  return typeof value === 'string' && value.startsWith('data:image/');
}
