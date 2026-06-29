/**
 * Browser-side image compression for Groq vision API (4MB base64 limit per image).
 * https://console.groq.com/docs/vision
 */
import {
  GROQ_VISION_LIMITS,
  base64PayloadBytes,
} from '@/lib/groq-vision';

function drawToJpegDataUrl(img: HTMLImageElement, width: number, height: number, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
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

/** Resize and iteratively compress until under Groq's 4MB base64 limit */
export async function compressDataUrlForGroq(
  dataUrl: string,
  maxDim: number,
  targetBytes = GROQ_VISION_LIMITS.targetBase64BytesPerImage
): Promise<string> {
  const img = await loadImage(dataUrl);
  let { width, height } = fitWithinMaxDim(img.width, img.height, maxDim);
  let dim = Math.max(width, height);
  let quality = 0.88;
  let result = drawToJpegDataUrl(img, width, height, quality);

  // Step down quality, then dimensions, until under target
  for (let attempt = 0; attempt < 12; attempt++) {
    if (base64PayloadBytes(result) <= targetBytes) return result;

    if (quality > 0.45) {
      quality -= 0.08;
    } else {
      dim = Math.round(dim * 0.85);
      if (dim < 600) break;
      const fitted = fitWithinMaxDim(img.width, img.height, dim);
      width = fitted.width;
      height = fitted.height;
      quality = 0.75;
    }
    result = drawToJpegDataUrl(img, width, height, quality);
  }

  return result;
}

/** Initial capture compression when adding pages from camera/gallery */
export async function fileToGroqJpegDataUrl(file: File, maxDim = 2000): Promise<string> {
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return compressDataUrlForGroq(dataUrl, maxDim);
}
