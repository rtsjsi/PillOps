/*
 * OCR model options for invoice extraction.
 * Groq vision models: https://console.groq.com/docs/vision
 * Gemini models require GEMINI_API_KEY (may fail from some Cloudflare regions).
 * OpenRouter: https://openrouter.ai/docs — free vision router + paid fallbacks.
 */
import {
  GROQ_VISION_LIMITS,
  buildContinuationPrompt,
  chunkArray,
  mergeInvoiceExtractions,
  normalizeImageDataUrl,
  stripJsonFences,
  validateGroqImages,
  type GroqImagePayload,
  type InvoiceExtractionPartial,
} from '@/lib/groq-vision';
import {
  buildDistributorExtractionInstructions,
  type StoreContext,
} from '@/lib/invoice-distributor';
import { buildInvoiceTotalExtractionInstructions } from '@/lib/invoice-totals';
export type OcrModelProvider = 'groq' | 'gemini' | 'openrouter' | 'offline';

export interface OcrModelOption {
  id: string;
  label: string;
  provider: OcrModelProvider;
  /** Max output tokens — keep prompt + images + max_tokens under provider caps */
  maxOutputTokens?: number;
  /** Longest image edge (px) before sending to the API */
  maxImageDim?: number;
}

/** Default Groq vision model — free tier, supports images + JSON mode */
export const DEFAULT_GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
export const QWEN_GROQ_VISION_MODEL = 'qwen/qwen3.6-27b';
/** Pinned OpenRouter free vision models for invoice OCR (excludes openrouter/free random router + content-safety). */
export const OPENROUTER_OCR_MODEL_CHAIN = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
] as const;

/** Dropdown / auto-fallback id — tries OPENROUTER_OCR_MODEL_CHAIN in order */
export const OPENROUTER_OCR_AUTO_ID = 'openrouter/auto';
export const DEFAULT_OPENROUTER_VISION_MODEL = OPENROUTER_OCR_AUTO_ID;

/** Explicit auto-fallback order when preferredModel is "auto" */
export const AUTO_OCR_FALLBACK_ORDER = [
  DEFAULT_GROQ_VISION_MODEL,
  QWEN_GROQ_VISION_MODEL,
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  OPENROUTER_OCR_AUTO_ID,
] as const;

// Only models listed on https://console.groq.com/docs/vision — text-only models (e.g. Maverick) return 404 with images.
export const GROQ_OCR_MODELS: OcrModelOption[] = [
  { id: DEFAULT_GROQ_VISION_MODEL, label: 'Llama 4 Scout 17B (Groq)', provider: 'groq', maxOutputTokens: 8000, maxImageDim: 2000 },
  // Qwen has a smaller per-request token budget — use compact prompt + moderate max_tokens
  { id: QWEN_GROQ_VISION_MODEL, label: 'Qwen 3.6 27B (Groq)', provider: 'groq', maxOutputTokens: 4096, maxImageDim: 1200 },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Google)', provider: 'gemini', maxOutputTokens: 8192, maxImageDim: 2000 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)', provider: 'gemini', maxOutputTokens: 8192, maxImageDim: 2000 },
  {
    id: OPENROUTER_OCR_AUTO_ID,
    label: 'OpenRouter (Gemma 4 26B free)',
    provider: 'openrouter',
    maxOutputTokens: 8192,
    maxImageDim: 2000,
  },
  { id: 'offline', label: 'Offline OCR (No API)', provider: 'offline' },
];

const INVOICE_JSON_SCHEMA = `{
  "rawTranscription": "",
  "distributorName": "",
  "invoiceNumber": "",
  "invoiceDate": "YYYY-MM-DD",
  "items": [
    {
      "medicineName": "",
      "pack": "",
      "hsnCode": "",
      "manufacturer": "",
      "batchNumber": "",
      "quantity": 0,
      "freeQuantity": 0,
      "purchasePrice": 0,
      "discountPercent": 0,
      "mrp": 0,
      "gstPercent": 0,
      "expiryDate": "MM-YYYY",
      "totalAmount": 0
    }
  ],
  "subtotal": 0,
  "discountAmount": 0,
  "gstAmount": 0,
  "total": 0
}`;

export interface InvoicePromptOptions {
  /** Shorter prompt for models with tight output limits (e.g. Qwen) */
  compact?: boolean;
}

export function buildInvoiceExtractionPrompt(
  context?: StoreContext,
  options: InvoicePromptOptions = {}
): string {
  const compact = options.compact ?? false;

  const distributorRules = compact
    ? `10. distributorName must be the wholesaler/issuer (top-left or "For ..." signatory). Ignore the retail customer (M/s, medical stores).${context?.storeName ? ` Never use "${context.storeName}".` : ''}${context?.storeGstin ? ` Ignore GSTIN ${context.storeGstin}.` : ''}`
    : buildDistributorExtractionInstructions(context);

  const totalRules = compact
    ? '11. total must be this invoice Grand Total or Net Amount in the footer. Ignore Outstanding, O/S, or ledger balance in the header.'
    : buildInvoiceTotalExtractionInstructions();

  const transcriptionRule = compact
    ? '1. Set rawTranscription to an empty string "" — do not transcribe the full table (output token limit).'
    : '1. Chain of Thought: First, in the "rawTranscription" field, write out a literal transcription of the entire items table exactly as you see it row-by-row. This scratchpad helps you maintain spatial alignment.';

  return `You are an expert pharmacy data extraction AI.
Analyze these images of a multi-page distributor pharmaceutical invoice. Extract the tabular structured data perfectly, combining all items from all pages into a single continuous list.
Pay close attention to table headers.
Often, 'Rate' means Purchase Price, 'Disc' means Discount %, 'G%' means GST %, 'Exp' means Expiry Date, 'Qty' or 'Billed' means Quantity.

CRITICAL INSTRUCTIONS:
${transcriptionRule}
2. Extract EVERY SINGLE ROW in the invoice items table. DO NOT skip, summarize, or truncate any items.
3. ZERO HALLUCINATION POLICY: DO NOT guess or default to 1 for quantities. Find the exact column for 'Qty', 'Billed Qty', or 'Act' and extract the exact number.
4. OCR PRECISION: Pay extreme attention to similar-looking characters in Batch Numbers (e.g., 6 vs 8, 0 vs O, B vs 8, D vs 0). Double-check the image pixels carefully.
5. EXPIRY FORMATS: Look for the 'Exp' column. Indian invoices typically use MM/YY or MM-YY (e.g., "08/26" or "08-26"). Read the digits carefully.
6. EXACT MEDICINE NAMES: Do NOT clean, normalize, or truncate the medicine names. Extract the EXACT verbatim string written under the item/product name column, including all volume, packaging, and unit details (e.g. extract "CREMAFFIN SYP 225ML" exactly, NOT just "CREMAFFIN SYRUP").
7. DUPLICATE ROWS & REPEATED ITEMS: Be extremely careful not to skip rows that have the same medicine name. Some invoices list the same item twice on consecutive lines. Treat them as separate items and extract BOTH rows.
8. IGNORE HANDWRITTEN MARKS: The invoice may have handwritten checkmarks (e.g., blue pen ticks) over the printed quantities or amounts. Ignore these pen marks. Read only the printed digits.
9. QTY vs PACK: Do NOT confuse the "Pack" column (e.g. "60T", "10ML") with the "Qty" column. Make sure the quantity reflects the printed number in the Qty column.
${distributorRules}
${totalRules}

Return ONLY a valid JSON object matching this shape (replace placeholders with extracted values; all numbers must be numeric, not strings):
${INVOICE_JSON_SCHEMA}

IMPORTANT: You MUST return ONLY valid JSON. No markdown fences, no comments, no trailing commas, no preamble. Output JSON immediately.`;
}

/** Default prompt without store context — prefer buildInvoiceExtractionPrompt when store is known */
export const PROMPT = buildInvoiceExtractionPrompt();

export function isCompactGroqVisionModel(modelName: string): boolean {
  return modelName === QWEN_GROQ_VISION_MODEL;
}

export function isOpenRouterOcrModel(modelName: string): boolean {
  return (
    modelName === OPENROUTER_OCR_AUTO_ID ||
    (OPENROUTER_OCR_MODEL_CHAIN as readonly string[]).includes(modelName)
  );
}

export function resolveOpenRouterModelChain(modelName: string): string[] {
  if (modelName === OPENROUTER_OCR_AUTO_ID) return [...OPENROUTER_OCR_MODEL_CHAIN];
  if ((OPENROUTER_OCR_MODEL_CHAIN as readonly string[]).includes(modelName)) return [modelName];
  return [modelName];
}

// --- TIER EXECUTORS ---
// Note: We use dynamic imports for SDKs so they don't bloat the Cloudflare Worker 
// initialization time (Error 1102 fix).

function getOcrModelLimits(modelName: string) {
  const option =
    GROQ_OCR_MODELS.find(m => m.id === modelName) ??
    (isOpenRouterOcrModel(modelName)
      ? GROQ_OCR_MODELS.find(m => m.id === OPENROUTER_OCR_AUTO_ID)
      : undefined);
  return {
    maxOutputTokens: option?.maxOutputTokens ?? 8000,
    maxImageDim: option?.maxImageDim ?? 2000,
  };
}

function buildGroqVisionContent(
  images: GroqImagePayload[],
  prompt: string,
  pageOffset = 0,
  totalPages?: number
) {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
  ];

  const total = totalPages ?? images.length;
  images.forEach((img, i) => {
    const pageNum = pageOffset + i + 1;
    if (total > 1) {
      content.push({ type: 'text', text: `Invoice page ${pageNum} of ${total}:` });
    }
    content.push({
      type: 'image_url',
      image_url: { url: normalizeImageDataUrl(img.base64, img.mimeType) },
    });
  });

  return content;
}

type VisionSingleRunner = (
  images: GroqImagePayload[],
  modelName: string,
  options: {
    prompt?: string;
    pageOffset?: number;
    totalPages?: number;
  }
) => Promise<string>;

/** Multi-page invoice OCR — batches into groups of 5 and merges results */
async function runBatchedInvoiceOcr(
  images: GroqImagePayload[],
  modelName: string,
  prompt: string,
  runSingle: VisionSingleRunner
): Promise<string> {
  const imageError = validateGroqImages(images);
  if (imageError) throw new Error(imageError);

  if (images.length <= GROQ_VISION_LIMITS.maxImagesPerRequest) {
    return runSingle(images, modelName, { totalPages: images.length, prompt });
  }

  const chunks = chunkArray(images, GROQ_VISION_LIMITS.maxImagesPerRequest);
  const totalPages = images.length;
  const compact = isCompactGroqVisionModel(modelName);
  const partials: InvoiceExtractionPartial[] = [];
  let pageOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const pageStart = pageOffset + 1;
    const pageEnd = pageOffset + chunk.length;

    const rawJson =
      i === 0
        ? await runSingle(chunk, modelName, { totalPages, pageOffset: 0, prompt })
        : await runSingle(chunk, modelName, {
            totalPages,
            pageOffset,
            prompt: buildContinuationPrompt(pageStart, pageEnd, totalPages, compact),
          });

    const cleaned = stripJsonFences(rawJson);
    try {
      partials.push(JSON.parse(cleaned) as InvoiceExtractionPartial);
    } catch {
      throw Object.assign(
        new Error('Model returned invalid JSON (output may be truncated). Try Llama 4 Scout or fewer pages.'),
        { status: 400 }
      );
    }
    pageOffset += chunk.length;
  }

  return JSON.stringify(mergeInvoiceExtractions(partials));
}

function throwIfTruncated(choice: { finish_reason?: string | null } | undefined) {
  if (choice?.finish_reason === 'length') {
    throw Object.assign(
      new Error('Model output was truncated (token limit). Try fewer pages, a smaller image, or Llama 4 Scout.'),
      { status: 413 }
    );
  }
}

async function runGroqSingle(
  images: GroqImagePayload[],
  modelName: string,
  options: {
    prompt?: string;
    pageOffset?: number;
    totalPages?: number;
  } = {}
): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY');

  const imageError = validateGroqImages(images);
  if (imageError) throw new Error(imageError);

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    defaultHeaders: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const { maxOutputTokens } = getOcrModelLimits(modelName);
  const prompt = options.prompt ?? PROMPT;
  const content = buildGroqVisionContent(
    images,
    prompt,
    options.pageOffset ?? 0,
    options.totalPages
  );

  // Qwen 3.6 is a reasoning model — JSON mode requires hidden/parsed reasoning_format
  // and reasoning_effort "none" saves output tokens for large item lists.
  const qwenParams = isCompactGroqVisionModel(modelName)
    ? { reasoning_format: 'hidden' as const, reasoning_effort: 'none' as const }
    : {};

  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: 'user', content: content as any }],
    model: modelName,
    temperature: 0.1,
    max_tokens: maxOutputTokens,
    // Scout + Qwen support JSON mode per https://console.groq.com/docs/vision
    response_format: { type: 'json_object' },
    ...qwenParams,
  } as any);

  const choice = chatCompletion.choices[0];
  throwIfTruncated(choice);

  return choice?.message?.content || '{}';
}

async function runOpenRouterSingle(
  images: GroqImagePayload[],
  modelName: string,
  options: {
    prompt?: string;
    pageOffset?: number;
    totalPages?: number;
  } = {}
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY');

  const imageError = validateGroqImages(images);
  if (imageError) throw new Error(imageError);

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://pillops.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'PillOps',
    },
  });

  const { maxOutputTokens } = getOcrModelLimits(modelName);
  const prompt = options.prompt ?? PROMPT;
  const content = buildGroqVisionContent(
    images,
    prompt,
    options.pageOffset ?? 0,
    options.totalPages
  );

  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: 'user', content: content as any }],
    model: modelName,
    temperature: 0.1,
    max_tokens: maxOutputTokens,
    response_format: { type: 'json_object' },
  } as any);

  const choice = chatCompletion.choices[0];
  if (!choice) {
    throw new Error(`OpenRouter (${modelName}) returned no choices`);
  }
  throwIfTruncated(choice);

  const actualModel = chatCompletion.model;
  if (actualModel && actualModel !== modelName) {
    console.log(`[OCR] OpenRouter routed ${modelName} → ${actualModel}`);
  }

  return choice.message?.content || '{}';
}

/** Multi-page invoice OCR — batches into groups of 5 (Groq vision limit) and merges results */
export async function runGroqInvoiceOcr(
  images: GroqImagePayload[],
  modelName: string = DEFAULT_GROQ_VISION_MODEL,
  prompt: string = PROMPT
): Promise<string> {
  return runBatchedInvoiceOcr(images, modelName, prompt, runGroqSingle);
}

export async function runOpenRouterInvoiceOcr(
  images: GroqImagePayload[],
  modelName: string = DEFAULT_OPENROUTER_VISION_MODEL,
  prompt: string = PROMPT
): Promise<string> {
  return runBatchedInvoiceOcr(images, modelName, prompt, runOpenRouterSingle);
}

export async function runGroq(
  images: GroqImagePayload[],
  modelName: string = DEFAULT_GROQ_VISION_MODEL,
  context?: StoreContext
) {
  const compact = isCompactGroqVisionModel(modelName);
  const prompt = buildInvoiceExtractionPrompt(context, { compact });
  return runGroqInvoiceOcr(images, modelName, prompt);
}

export async function runOpenRouter(
  images: GroqImagePayload[],
  modelName: string = OPENROUTER_OCR_AUTO_ID,
  context?: StoreContext
) {
  const prompt = buildInvoiceExtractionPrompt(context);
  const models = resolveOpenRouterModelChain(modelName);
  let lastError: unknown;

  for (const slug of models) {
    try {
      console.log(`[OCR] OpenRouter trying: ${slug}`);
      return await runOpenRouterInvoiceOcr(images, slug, prompt);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.warn(`[OCR] OpenRouter ${slug} failed: ${e.message ?? err}`);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All OpenRouter vision models failed');
}

export async function runGemini(
  images: {base64: string, mimeType: string}[],
  modelName: string = "gemini-flash-latest",
  context?: StoreContext
) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 8192 } });

  const parts: any[] = [buildInvoiceExtractionPrompt(context)];
  images.forEach(img => {
      const cleanBase64 = img.base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64/, "");
      parts.push({ inlineData: { data: cleanBase64, mimeType: img.mimeType } });
  });

  try {
    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    if (err.message?.includes('User location is not supported')) {
      throw new Error("Google Gemini API is currently unavailable in the Cloudflare datacenter region processing your request. Please select 'Llama 4 Scout 17B' from the dropdown to use Groq instead.");
    }
    throw err;
  }
}

/** Offline OCR using Tesseract.js (pure JS, no external API) */
export async function runOfflineOcr(images: { base64: string, mimeType: string }[]) {
  // Dynamically import tesseract.js to avoid bundling it in production if not used
  const { createWorker } = await import('tesseract.js');
  // @ts-ignore - logger option not recognized in typings
  const worker = await createWorker({ logger: m => console.log('[Tesseract]', m) });
  await worker.load();
  // @ts-ignore - loadLanguage may not be in typings
  await worker.loadLanguage('eng');
  // @ts-ignore - initialize may not be in typings
  await worker.initialize('eng');

  let combinedText = '';
  for (const img of images) {
    // Tesseract can accept a base64 data URL directly
    const { data: { text } } = await worker.recognize(img.base64);
    combinedText += text + '\n';
  }
  await worker.terminate();

  // Return a JSON string matching the expected invoice schema (mostly empty placeholders)
  const placeholder = {
    rawTranscription: combinedText.trim(),
    distributorName: '',
    invoiceNumber: '',
    invoiceDate: '',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    gstAmount: 0,
    total: 0
  };
  return JSON.stringify(placeholder);
}

export async function enrichMedicineBatchWithGroq(medicines: {id: string, name: string, manufacturer?: string, category?: string}[]) {
  if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ 
    baseURL: "https://api.groq.com/openai/v1", 
    apiKey: process.env.GROQ_API_KEY,
    defaultHeaders: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const systemPrompt = `You are a strict Indian pharmaceutical data AI. 
You will be given a JSON array of medicines containing 'id', 'name', and sometimes an abbreviated 'manufacturer' or empty 'category'.
For each medicine, return detailed clinical information including:
- category: String. The dosage form (e.g., "Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Cream", "Drops", "Powder"). Infer this from the name if possible.
- correctedName: String. The proper, standardized pharmaceutical name of the medicine (e.g., correcting "Dlo 650 Mg Tab" to "DOLO 650 TABLET" or "CROCIN ADVANCE"). This MUST BE ENTIRELY IN UPPERCASE. Fix any abbreviations or typos.
- manufacturer: String. The full, correct, standard name of the pharmaceutical company (e.g., "Sun Pharma", "Mankind Pharma", "Abbott"). Correct any abbreviations or misspellings.
- packSize: String or null. The standard packaging size (e.g. "10 Tablets", "100 ml", "15 gm"). Infer if possible, otherwise null.
- hsnCode: String or null. The applicable Indian HSN Code for this medicine (typically 3004xxxx).
- gstPercent: Number or null. The applicable GST percentage for this medicine (e.g. 5, 12, 18).
- ingredients: Array of objects with 'salt' and 'strength' (e.g. [{"salt": "Paracetamol", "strength": "650mg"}]).
- substitutes: Array of strings containing 2-3 popular Indian generic equivalents/substitutes (e.g. ["Calpol 650", "Crocin 650"]).
- storageConditions: String describing how to store it (e.g. "Store below 30°C, protect from light").
- isNarcotic: boolean (true if it contains Codeine, Tramadol, etc under NDPS Act).
- prescriptionRequired: boolean (true for Rx only).

Return ONLY a valid JSON object with the following schema:
{
  "medicines": [
    {
      "id": "original-id",
      "correctedName": "string",
      "category": "string",
      "manufacturer": "string",
      "packSize": "string",
      "hsnCode": "string",
      "gstPercent": 12,
      "ingredients": [{"salt": "string", "strength": "string"}],
      "substitutes": ["string"],
      "storageConditions": "string",
      "isNarcotic": boolean,
      "prescriptionRequired": boolean
    }
  ]
}`;

  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(medicines) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });
    return chatCompletion.choices[0]?.message?.content || '{"medicines":[]}';
  } catch (err: any) {
    if (err.message?.includes('403') || err.status === 403) {
      console.warn('Groq returned 403 (likely blocked Cloudflare Worker IP). Falling back to Gemini...');
      return await enrichMedicineBatchWithGemini(medicines);
    }
    throw err;
  }
}

export async function enrichMedicineBatchWithGemini(medicines: {id: string, name: string, manufacturer?: string, category?: string}[]) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const systemPrompt = `You are a strict Indian pharmaceutical data AI. 
You will be given a JSON array of medicines containing 'id', 'name', and sometimes an abbreviated 'manufacturer' or empty 'category'.
For each medicine, return detailed clinical information including:
- category: String. The dosage form (e.g., "Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Cream", "Drops", "Powder"). Infer this from the name if possible.
- correctedName: String. The proper, standardized pharmaceutical name of the medicine (e.g., correcting "Dlo 650 Mg Tab" to "DOLO 650 TABLET" or "CROCIN ADVANCE"). This MUST BE ENTIRELY IN UPPERCASE. Fix any abbreviations or typos.
- manufacturer: String. The full, correct, standard name of the pharmaceutical company (e.g., "Sun Pharma", "Mankind Pharma", "Abbott"). Correct any abbreviations or misspellings.
- packSize: String or null. The standard packaging size (e.g. "10 Tablets", "100 ml", "15 gm"). Infer if possible, otherwise null.
- hsnCode: String or null. The applicable Indian HSN Code for this medicine (typically 3004xxxx).
- gstPercent: Number or null. The applicable GST percentage for this medicine (e.g. 5, 12, 18).
- ingredients: Array of objects with 'salt' and 'strength' (e.g. [{"salt": "Paracetamol", "strength": "650mg"}]).
- substitutes: Array of strings containing 2-3 popular Indian generic equivalents/substitutes (e.g. ["Calpol 650", "Crocin 650"]).
- storageConditions: String describing how to store it (e.g. "Store below 30°C, protect from light").
- isNarcotic: boolean (true if it contains Codeine, Tramadol, etc under NDPS Act).
- prescriptionRequired: boolean (true for Rx only).

Return ONLY a valid JSON object with the following schema:
{
  "medicines": [
    {
      "id": "original-id",
      "correctedName": "string",
      "category": "string",
      "manufacturer": "string",
      "packSize": "string",
      "hsnCode": "string",
      "gstPercent": 12,
      "ingredients": [{"salt": "string", "strength": "string"}],
      "substitutes": ["string"],
      "storageConditions": "string",
      "isNarcotic": boolean,
      "prescriptionRequired": boolean
    }
  ]
}`;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest", 
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 } 
  });
  
  try {
    const result = await model.generateContent([
      systemPrompt,
      JSON.stringify(medicines)
    ]);
    
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    if (err.message?.includes('User location is not supported')) {
      throw new Error("Google Gemini API is currently unavailable in the Cloudflare datacenter region processing your request. The Groq API also failed. Please try again later or check your API keys.");
    }
    throw err;
  }
}
