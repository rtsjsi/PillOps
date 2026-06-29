import fs from 'fs';
import path from 'path';
import {
  buildInvoiceExtractionPrompt,
  OPENROUTER_OCR_AUTO_ID,
  OPENROUTER_OCR_MODEL_CHAIN,
} from '../src/lib/ai-server';
import { normalizeImageDataUrl, validateGroqImages } from '../src/lib/groq-vision';

const imagePath = process.argv[2];
const modelSlug = process.argv[3] ?? OPENROUTER_OCR_AUTO_ID;

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Set OPENROUTER_API_KEY');
  process.exit(1);
}

if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('Usage: tsx scripts/test-openrouter-invoice.ts <image-path> [model-slug]');
  process.exit(1);
}

const buf = fs.readFileSync(imagePath);
const mimeType = 'image/png';
const base64 = `data:${mimeType};base64,${buf.toString('base64')}`;
const images = [{ base64, mimeType }];

const imageError = validateGroqImages(images);
if (imageError) {
  console.error(imageError);
  process.exit(1);
}

async function main() {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://pillops.app',
      'X-Title': 'PillOps',
    },
  });

  const prompt = buildInvoiceExtractionPrompt();
  const content = [
    { type: 'text' as const, text: prompt },
    {
      type: 'image_url' as const,
      image_url: { url: normalizeImageDataUrl(base64, mimeType) },
    },
  ];

  console.log('Requested:', modelSlug);
  if (modelSlug === OPENROUTER_OCR_AUTO_ID) {
    console.log('Chain:', OPENROUTER_OCR_MODEL_CHAIN.join(' → '));
  }
  console.log('Image:', imagePath, `(${(buf.length / 1024).toFixed(1)} KB)`);
  console.log('Calling OpenRouter...\n');

  const completion = await client.chat.completions.create({
    messages: [{ role: 'user', content }],
    model: modelSlug,
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  } as any);

  const actualModel = completion.model;
  const choice = completion.choices[0];
  const raw = choice?.message?.content || '{}';

  console.log('=== OpenRouter routing ===');
  console.log('Actual model used:', actualModel);
  console.log('Finish reason:', choice?.finish_reason);
  if ((completion as any).provider) {
    console.log('Provider:', (completion as any).provider);
  }

  const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
  console.log('\n=== Extraction ===');
  console.log('Distributor:', parsed.distributorName);
  console.log('Invoice #:', parsed.invoiceNumber, '| Date:', parsed.invoiceDate);
  console.log('Total:', parsed.total);
  console.log('Items:', parsed.items?.length ?? 0);
  if (Array.isArray(parsed.items)) {
    parsed.items.forEach((item: Record<string, unknown>, i: number) => {
      console.log(
        `  ${i + 1}. ${item.medicineName} | qty=${item.quantity} free=${item.freeQuantity} | rate=${item.purchasePrice} | total=${item.totalAmount}`
      );
    });
  }
}

main().catch((err: unknown) => {
  const e = err as { message?: string; status?: number };
  console.error('FAILED:', e.status ? `[${e.status}]` : '', e.message ?? err);
  process.exit(1);
});
