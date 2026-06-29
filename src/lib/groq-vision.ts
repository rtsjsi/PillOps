/**
 * Groq vision API limits — https://console.groq.com/docs/vision
 */
export const GROQ_VISION_LIMITS = {
  /** Max images per chat.completions request */
  maxImagesPerRequest: 5,
  /** Base64-encoded image payload limit (413 if exceeded) */
  maxBase64BytesPerImage: 4 * 1024 * 1024,
  /** Safety target — stay under hard 4MB cap after encoding overhead */
  targetBase64BytesPerImage: Math.floor(3.75 * 1024 * 1024),
  /** Max pixels per image (33 megapixels) */
  maxMegapixelsPerImage: 33_177_600,
} as const;

export interface GroqImagePayload {
  base64: string;
  mimeType: string;
}

export interface InvoiceExtractionPartial {
  rawTranscription?: string;
  distributorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items?: unknown[];
  subtotal?: number;
  discountAmount?: number;
  gstAmount?: number;
  total?: number;
}

/** Approximate decoded byte size of a data-URL or raw base64 string */
export function base64PayloadBytes(dataUrlOrBase64: string): number {
  const base64 = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.split(',')[1]
    : dataUrlOrBase64;
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Ensure Groq receives a proper data URL (docs: data:image/jpeg;base64,...) */
export function normalizeImageDataUrl(base64: string, mimeType = 'image/jpeg'): string {
  if (base64.startsWith('data:')) return base64;
  const cleanMime = mimeType || 'image/jpeg';
  return `data:${cleanMime};base64,${base64}`;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Returns a user-facing error string, or null if valid */
export function validateGroqImages(images: GroqImagePayload[]): string | null {
  if (!images.length) return 'Missing image data';

  for (let i = 0; i < images.length; i++) {
    const bytes = base64PayloadBytes(images[i].base64);
    if (bytes > GROQ_VISION_LIMITS.maxBase64BytesPerImage) {
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      return `Page ${i + 1} is ${mb}MB — Groq allows max 4MB per base64 image. Crop tighter or use a lower-resolution photo.`;
    }
  }

  return null;
}

export function mergeInvoiceExtractions(partials: InvoiceExtractionPartial[]): InvoiceExtractionPartial {
  const merged: InvoiceExtractionPartial = {
    rawTranscription: '',
    distributorName: '',
    invoiceNumber: '',
    invoiceDate: '',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    gstAmount: 0,
    total: 0,
  };

  const transcriptions: string[] = [];

  for (const part of partials) {
    if (part.rawTranscription?.trim()) transcriptions.push(part.rawTranscription.trim());
    if (!merged.distributorName && part.distributorName) merged.distributorName = part.distributorName;
    if (!merged.invoiceNumber && part.invoiceNumber) merged.invoiceNumber = part.invoiceNumber;
    if (!merged.invoiceDate && part.invoiceDate) merged.invoiceDate = part.invoiceDate;
    if (Array.isArray(part.items)) merged.items!.push(...part.items);
    if (part.subtotal) merged.subtotal = part.subtotal;
    if (part.discountAmount) merged.discountAmount = part.discountAmount;
    if (part.gstAmount) merged.gstAmount = part.gstAmount;
    if (part.total) merged.total = part.total;
  }

  merged.rawTranscription = transcriptions.join('\n\n--- page break ---\n\n');
  return merged;
}

export function buildContinuationPrompt(pageStart: number, pageEnd: number, totalPages: number): string {
  return `These are pages ${pageStart}-${pageEnd} of ${totalPages} from the same Indian pharmaceutical distributor invoice.

Extract EVERY line item visible on these pages only. Return valid JSON:
{
  "rawTranscription": "row-by-row table text from these pages only",
  "items": [ /* same item schema as before */ ]
}

Do NOT repeat distributor/invoice header unless it appears on these pages. Do not skip duplicate medicine names — each printed row is a separate item.`;
}
