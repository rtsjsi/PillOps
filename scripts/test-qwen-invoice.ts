import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runGroq, QWEN_GROQ_VISION_MODEL } from '../src/lib/ai-server';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const imagePath =
  process.argv[2] ??
  path.join(
    process.cwd(),
    'assets/c__Users_rtsjsi_AppData_Roaming_Cursor_User_workspaceStorage_d553ea2a17262037e1e09cb9532cb4e8_images_WhatsApp_Image_2026-06-28_at_19.41.00-120cc9be-c3aa-4484-af56-a5b37d98b729.png'
  );

if (!fs.existsSync(imagePath)) {
  console.error('Image not found:', imagePath);
  process.exit(1);
}

const buf = fs.readFileSync(imagePath);
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
const base64 = `data:${mimeType};base64,${buf.toString('base64')}`;

console.log('Model:', QWEN_GROQ_VISION_MODEL);
console.log('Image:', imagePath, `(${(buf.length / 1024).toFixed(1)} KB)`);
console.log('Calling Groq...\n');

async function main() {
  const raw = await runGroq([{ base64, mimeType }], QWEN_GROQ_VISION_MODEL);
  const parsed = JSON.parse(raw);
  console.log('SUCCESS');
  console.log('Distributor:', parsed.distributorName);
  console.log('Invoice #:', parsed.invoiceNumber, '| Date:', parsed.invoiceDate);
  console.log('Total:', parsed.total);
  console.log('Items:', parsed.items?.length ?? 0);
  if (Array.isArray(parsed.items)) {
    parsed.items.forEach((item: Record<string, unknown>, i: number) => {
      console.log(
        `  ${i + 1}. ${item.medicineName} | qty=${item.quantity} | rate=${item.purchasePrice} | total=${item.totalAmount}`
      );
    });
  }
  console.log('\n--- full JSON ---');
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err: unknown) => {
  const e = err as { message?: string; status?: number };
  console.error('FAILED:', e.status ? `[${e.status}]` : '', e.message ?? err);
  process.exit(1);
});
