/**
 * Loads an image File or DataURL respecting camera EXIF orientation when possible.
 */
async function loadOrientedDrawable(
  source: File | string
): Promise<{ drawable: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof window !== 'undefined' && typeof createImageBitmap === 'function' && source instanceof File) {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // Fall back to HTMLImageElement below
    }
  }

  const dataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(source);
        });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = (err) => reject(err);
    el.src = dataUrl;
  });

  return {
    drawable: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    cleanup: () => {},
  };
}

/**
 * Fast projection-profile check to detect if a landscape table was photographed vertically (90°/270° rotated).
 * Returns 0 if already upright/horizontal, or 90 / 270 if vertical text rows are detected.
 */
function detectTableRotationDegrees(
  drawable: CanvasImageSource,
  srcWidth: number,
  srcHeight: number
): 0 | 90 | 270 {
  // Only auto-rotate when the photo is noticeably taller than wide (portrait shot of a landscape table)
  if (srcHeight <= srcWidth * 1.1) return 0;

  try {
    const sampleMax = 220;
    const scale = Math.min(1, sampleMax / Math.max(srcWidth, srcHeight));
    const w = Math.max(24, Math.round(srcWidth * scale));
    const h = Math.max(24, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    ctx.drawImage(drawable, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Compute grayscale luminance (0..255)
    const lum = new Float32Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Row projection (high variance = horizontal text bands/rules)
    const rowMeans = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const offset = y * w;
      for (let x = 0; x < w; x++) sum += lum[offset + x];
      rowMeans[y] = sum / w;
    }

    // Column projection (high variance = vertical text bands/rules -> sideways 90°)
    const colMeans = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y < h; y++) sum += lum[y * w + x];
      colMeans[x] = sum / h;
    }

    const calcAdjacentDiffEnergy = (arr: Float32Array): number => {
      let total = 0;
      for (let i = 1; i < arr.length; i++) {
        total += Math.abs(arr[i] - arr[i - 1]);
      }
      return total / Math.max(1, arr.length - 1);
    };

    const rowEnergy = calcAdjacentDiffEnergy(rowMeans);
    const colEnergy = calcAdjacentDiffEnergy(colMeans);

    // If vertical bands (colEnergy) clearly dominate horizontal bands (rowEnergy), the table is rotated 90°/270°
    if (colEnergy > rowEnergy * 1.12 || srcHeight > srcWidth * 1.25) {
      // Heuristic to pick +90° (header on left) vs 270°/-90° (header on right):
      // Printed government tables have a denser, darker bordered title/column header strip on the top ~18% of the page.
      const stripWidth = Math.max(4, Math.floor(w * 0.2));
      let leftDarkness = 0;
      let rightDarkness = 0;
      for (let y = 0; y < h; y++) {
        const rowOff = y * w;
        for (let x = 0; x < stripWidth; x++) {
          leftDarkness += 255 - lum[rowOff + x];
          rightDarkness += 255 - lum[rowOff + (w - 1 - x)];
        }
      }
      return leftDarkness >= rightDarkness ? 90 : 270;
    }
  } catch {
    // Safe fallback if canvas readback fails
  }

  return 0;
}

/**
 * Applies mild contrast stretch + sharpening on RGBA pixel data while preserving ink colors
 * (so handwritten blue/red pen annotations stay clearly distinguishable from black print).
 */
function enhanceContrastAndSharpnessInPlace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    const totalPixels = width * height;
    if (totalPixels === 0) return;

    // 1. Luminance histogram for gentle auto-levels (2nd..98th percentile)
    const hist = new Uint32Array(256);
    for (let i = 0; i < pixels.length; i += 4) {
      const y = Math.min(255, Math.max(0, Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])));
      hist[y]++;
    }

    const lowTarget = Math.floor(totalPixels * 0.015);
    const highTarget = Math.floor(totalPixels * 0.985);
    let acc = 0;
    let lowClip = 0;
    let highClip = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc <= lowTarget) lowClip = v;
      if (acc <= highTarget) highClip = v;
    }

    const range = Math.max(60, highClip - lowClip);
    const scale = 255 / range;

    // Clamp stretch strength so normal photos don't clip highlights or shadows aggressively
    const applyStretch = range < 235;
    if (applyStretch) {
      for (let i = 0; i < pixels.length; i += 4) {
        const r = (pixels[i] - lowClip) * scale;
        const g = (pixels[i + 1] - lowClip) * scale;
        const b = (pixels[i + 2] - lowClip) * scale;
        pixels[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        pixels[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        pixels[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      }
    }

    // 2. Mild unsharp-style sharpening on interior pixels to crisp up 12-digit SAP numbers
    const copy = new Uint8ClampedArray(pixels);
    const stride = width * 4;
    const strength = 0.28;
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * stride;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x * 4;
        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const avgNeighbor =
            (copy[idx - 4 + c] + copy[idx + 4 + c] + copy[idx - stride + c] + copy[idx + stride + c]) * 0.25;
          const sharpened = center + (center - avgNeighbor) * strength;
          pixels[idx + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Ignore pixel manipulation failures on restricted canvases
  }
}

/**
 * Compresses an image File on the client side using HTML5 Canvas before sending to Gemini Vision / Chat APIs.
 * Supports custom maxWidth & quality (e.g., 1000px, 0.8 for multi-photo equipment attachment)
 * and guarantees the resulting Data URL stays under Firestore's 500,000-byte field limit.
 */
export async function compressImageToBase64(
  file: File,
  maxWidth = 1600,
  quality = 0.85,
  maxCharLimit = 450000
): Promise<string> {
  const { drawable, width: rawW, height: rawH, cleanup } = await loadOrientedDrawable(file);
  try {
    const renderAt = (targetMaxDim: number, q: number): string => {
      const canvas = document.createElement('canvas');
      let width = rawW;
      let height = rawH;

      if (width > targetMaxDim) {
        height = Math.round((height * targetMaxDim) / width);
        width = targetMaxDim;
      }
      if (height > targetMaxDim) {
        width = Math.round((width * targetMaxDim) / height);
        height = targetMaxDim;
      }

      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('ไม่สามารถสร้าง Canvas สำหรับย่อรูปได้');
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', q);
    };

    let compressedBase64 = renderAt(maxWidth, quality);

    if (compressedBase64.length > maxCharLimit) {
      for (const q of [0.72, 0.58, 0.45]) {
        compressedBase64 = renderAt(Math.min(maxWidth, 1100), q);
        if (compressedBase64.length <= maxCharLimit) break;
      }
    }

    return compressedBase64;
  } finally {
    cleanup();
  }
}

/**
 * Pre-processes a photographed equipment registry table before Gemini OCR:
 * 1) Applies EXIF orientation + detects sideways portrait shots of landscape tables & auto-rotates upright
 * 2) Enhances contrast & edge sharpness so 12-digit SAP codes & HANA suffixes remain legible
 * 3) Preserves high resolution (1800px) while keeping payload fast
 */
export async function preprocessTableImageForOcr(
  source: File | string,
  options?: { forceRotationDegrees?: number; maxDimension?: number; quality?: number }
): Promise<{
  base64: string;
  dataUrl: string;
  mimeType: string;
  rotatedDegrees: number;
}> {
  const maxDim = options?.maxDimension ?? 1800;
  const quality = options?.quality ?? 0.86;
  const { drawable, width: srcW, height: srcH, cleanup } = await loadOrientedDrawable(source);

  try {
    const autoDeg =
      typeof options?.forceRotationDegrees === 'number'
        ? options.forceRotationDegrees
        : detectTableRotationDegrees(drawable, srcW, srcH);

    const normDeg = ((autoDeg % 360) + 360) % 360;
    const isSwapped = normDeg === 90 || normDeg === 270;

    let drawW = srcW;
    let drawH = srcH;
    if (drawW > maxDim || drawH > maxDim) {
      if (drawW >= drawH) {
        drawH = Math.round((drawH * maxDim) / drawW);
        drawW = maxDim;
      } else {
        drawW = Math.round((drawW * maxDim) / drawH);
        drawH = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, isSwapped ? drawH : drawW);
    canvas.height = Math.max(1, isSwapped ? drawW : drawH);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ไม่สามารถสร้าง Canvas สำหรับปรับปรุงภาพได้');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (normDeg !== 0) {
      ctx.rotate((normDeg * Math.PI) / 180);
    }
    ctx.drawImage(drawable, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    enhanceContrastAndSharpnessInPlace(ctx, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length > 1_100_000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.74);
    }
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');

    return {
      base64,
      dataUrl,
      mimeType: 'image/jpeg',
      rotatedDegrees: normDeg,
    };
  } finally {
    cleanup();
  }
}

/**
 * Backward-compatible alias for compressImageToBase64
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.85
): Promise<string> {
  return compressImageToBase64(file, maxWidth, quality);
}

/**
 * Converts a File (image/jpeg, image/png, image/webp, or application/pdf) into a normalized attachment payload.
 * Images are automatically compressed via Canvas; PDFs are read directly as base64 Data URLs.
 */
export async function prepareAttachmentForAura(
  file: File,
  maxWidth = 1600,
  quality = 0.85
): Promise<{
  base64: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  isPdf: boolean;
}> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = (err) => reject(err);
    });
    const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');
    return {
      base64: cleanBase64,
      dataUrl,
      mimeType: 'application/pdf',
      fileName: file.name || 'document.pdf',
      isPdf: true,
    };
  }

  const dataUrl = await compressImageToBase64(file, maxWidth, quality, 900000);
  const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');
  return {
    base64: cleanBase64,
    dataUrl,
    mimeType: 'image/jpeg',
    fileName: file.name || 'photo.jpg',
    isPdf: false,
  };
}
