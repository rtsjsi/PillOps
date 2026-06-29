/**
 * Browser-side image prep for vision OCR APIs (4MB base64 limit per image).
 * Compresses only when over size/dimension limits — preserves quality for OCR.
 * https://console.groq.com/docs/vision
 */
import {
  GROQ_VISION_LIMITS,
  base64PayloadBytes,
} from '@/lib/groq-vision';

const DEFAULT_JPEG_QUALITY = 0.92;
const MIN_JPEG_QUALITY = 0.8;
const VISION_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function mimeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match?.[1] ?? 'image/jpeg';
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function fitWithinMaxDim(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height };
  if (width > height && width > maxDim) {
    return { width: maxDim, height: Math.round((height * maxDim) / width) };
  }
  if (height > maxDim) {
    return { width: Math.round((width * maxDim) / height), height: maxDim };
  }
  return { width, height };
}

function dimensionsWithinMax(width: number, height: number, maxDim: number): boolean {
  return width <= maxDim && height <= maxDim;
}

function drawToDataUrl(
  img: HTMLImageElement,
  width: number,
  height: number,
  format: 'image/jpeg' | 'image/png',
  quality = DEFAULT_JPEG_QUALITY
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, width, height);
  if (format === 'image/png') return canvas.toDataURL('image/png');
  return canvas.toDataURL('image/jpeg', quality);
}

async function isAlreadyVisionReady(
  dataUrl: string,
  maxDim: number,
  targetBytes: number
): Promise<boolean> {
  if (base64PayloadBytes(dataUrl) > targetBytes) return false;
  if (!VISION_MIME_TYPES.has(mimeFromDataUrl(dataUrl))) return false;
  const img = await loadImage(dataUrl);
  return dimensionsWithinMax(img.width, img.height, maxDim);
}

/** Read file as data URL — no compression (full resolution for crop). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Export cropped canvas — PNG when small enough (sharper text), else high-quality JPEG. */
export function exportCanvasForOcr(
  canvas: HTMLCanvasElement,
  targetBytes = GROQ_VISION_LIMITS.targetBase64BytesPerImage
): { base64: string; mimeType: string } {
  const png = canvas.toDataURL('image/png');
  if (base64PayloadBytes(png) <= targetBytes) {
    return { base64: png, mimeType: 'image/png' };
  }

  let quality = DEFAULT_JPEG_QUALITY;
  let jpeg = canvas.toDataURL('image/jpeg', quality);
  while (base64PayloadBytes(jpeg) > targetBytes && quality > MIN_JPEG_QUALITY) {
    quality -= 0.04;
    jpeg = canvas.toDataURL('image/jpeg', quality);
  }
  return { base64: jpeg, mimeType: 'image/jpeg' };
}

/**
 * Prepare image for vision API — skip re-encode when already within limits;
 * otherwise resize and prefer PNG, then step down JPEG quality / dimensions.
 */
export async function prepareImageForVisionApi(
  dataUrl: string,
  maxDim: number,
  targetBytes = GROQ_VISION_LIMITS.targetBase64BytesPerImage
): Promise<{ base64: string; mimeType: string }> {
  if (await isAlreadyVisionReady(dataUrl, maxDim, targetBytes)) {
    return { base64: dataUrl, mimeType: mimeFromDataUrl(dataUrl) };
  }

  const img = await loadImage(dataUrl);
  let { width, height } = fitWithinMaxDim(img.width, img.height, maxDim);
  let dim = Math.max(width, height);
  let quality = DEFAULT_JPEG_QUALITY;

  let png = drawToDataUrl(img, width, height, 'image/png');
  if (base64PayloadBytes(png) <= targetBytes) {
    return { base64: png, mimeType: 'image/png' };
  }

  let result = drawToDataUrl(img, width, height, 'image/jpeg', quality);

  for (let attempt = 0; attempt < 12; attempt++) {
    if (base64PayloadBytes(result) <= targetBytes) {
      return { base64: result, mimeType: 'image/jpeg' };
    }

    if (quality > MIN_JPEG_QUALITY) {
      quality -= 0.04;
    } else {
      dim = Math.round(dim * 0.85);
      if (dim < 600) break;
      const fitted = fitWithinMaxDim(img.width, img.height, dim);
      width = fitted.width;
      height = fitted.height;
      quality = 0.88;
      png = drawToDataUrl(img, width, height, 'image/png');
      if (base64PayloadBytes(png) <= targetBytes) {
        return { base64: png, mimeType: 'image/png' };
      }
    }
    result = drawToDataUrl(img, width, height, 'image/jpeg', quality);
  }

  return { base64: result, mimeType: 'image/jpeg' };
}

/** @deprecated Use prepareImageForVisionApi — kept for callers that only need base64 */
export async function compressDataUrlForGroq(
  dataUrl: string,
  maxDim: number,
  targetBytes = GROQ_VISION_LIMITS.targetBase64BytesPerImage
): Promise<string> {
  const { base64 } = await prepareImageForVisionApi(dataUrl, maxDim, targetBytes);
  return base64;
}
