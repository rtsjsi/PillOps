/**
 * Backfill manufacturer + pack_size for medicines that are in stock.
 * 1) Infer pack_size labels from medicine names (no API cost)
 * 2) AI-enrich remaining gaps in batches
 *
 * Run: npx tsx scripts/enrich_in_stock_medicines.ts
 * Optional: --dry-run   --limit=50
 */
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { enrichMedicineBatch } from '../src/lib/ai-server';
import { parseUnitsPerPack } from '../src/lib/pack-size';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CHUNK_SIZE = 15;
const SLEEP_MS = 1500;
const VALID_CATEGORIES = new Set([
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC',
]);

function normalizeCategory(raw: string | null | undefined, fallback: string | null): string | null {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (VALID_CATEGORIES.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes('tablet') || lower.includes('tab')) return 'Tablet';
  if (lower.includes('capsule') || lower.includes('cap')) return 'Capsule';
  if (lower.includes('syrup') || lower.includes('suspension')) return 'Syrup';
  if (lower.includes('injection') || lower.includes('inj')) return 'Injection';
  if (lower.includes('ointment') || lower.includes('cream') || lower.includes('gel')) return 'Ointment';
  if (lower.includes('drop')) return 'Drops';
  if (lower.includes('inhaler') || lower.includes('rotacap')) return 'Inhaler';
  if (lower.includes('sachet') || lower.includes('powder')) return 'Sachet';
  return fallback;
}

type Row = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  pack_size: string | null;
  units_per_pack: number;
};

function needsManufacturer(mfr: string | null) {
  return !mfr || mfr.trim() === '' || mfr.trim().toLowerCase() === 'unknown';
}

function needsPackSize(pack: string | null) {
  return !pack || pack.trim() === '';
}

/** Infer a human-readable pack label from OCR-style medicine names. */
function inferPackSizeLabel(name: string, category: string | null): string | null {
  const text = name.toUpperCase();
  const STRENGTHS = new Set([25, 50, 100, 125, 150, 200, 250, 400, 500, 650, 1000]);

  const ml = text.match(/\b(\d+(?:\.\d+)?)\s*ML\b/);
  if (ml) return `${ml[1]} ml`;

  const gm = text.match(/\b(\d+(?:\.\d+)?)\s*GM?\b/);
  if (gm) return `${gm[1]} gm`;

  const paren = text.match(/\((\d+)\s*T\)/);
  if (paren) return `${paren[1]} Tablets`;

  const cap = text.match(/\b(\d+)\s*CAP(?:S(?:ULE)?)?\b/);
  if (cap) return `${cap[1]} Capsules`;

  const endTab = text.match(/(\d+)\s*(?:TAB(?:LET)?S?)\s*$/);
  if (endTab) return `${endTab[1]} Tablets`;

  const strip = text.match(/\b(\d+)\s*'?S\s*$/);
  if (strip) return `${strip[1]} Tablets`;

  const tabMatches = [...text.matchAll(/\b(\d+)\s*(?:TAB(?:LET)?S?)\b/g)];
  for (const match of tabMatches) {
    const n = Number(match[1]);
    if (!STRENGTHS.has(n)) return `${n} Tablets`;
  }

  const tMatches = [...text.matchAll(/\b(\d+)\s*T\b/g)];
  for (const match of tMatches) {
    const n = Number(match[1]);
    if (!STRENGTHS.has(n)) return `${n} Tablets`;
  }

  const xy = text.match(/\b(\d+)\s*[*X×]\s*(\d+)\b/);
  if (xy) {
    const a = Number(xy[1]);
    const b = Number(xy[2]);
    if (b === 1 && a > 1) return `${a} Tablets`;
    if (a === 1 && b > 1) return `${b} Tablets`;
    if (a > 1 && b > 1) return `${a * b} Tablets`;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillPackSizesFromNames(client: Client, dryRun: boolean) {
  const res = await client.query<Row>(`
    SELECT DISTINCT g.id, g.name, g.category::text AS category, g.manufacturer, g.pack_size, g.units_per_pack
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.total_stock > 0
  `);

  let updated = 0;
  for (const row of res.rows) {
    const label = inferPackSizeLabel(row.name, row.category);
    if (!label) continue;
    if (row.pack_size?.trim() === label) continue;

    const units = parseUnitsPerPack(label, row.category, row.name);
    if (dryRun) {
      console.log(`[dry-run] pack_size ${row.name}: "${row.pack_size || '(empty)'}" -> "${label}" (units=${units})`);
    } else {
      await client.query(
        `UPDATE global_medicine_master
         SET pack_size = $1, units_per_pack = $2
         WHERE id = $3`,
        [label, units, row.id],
      );
    }
    updated++;
  }
  console.log(`Pack-size name inference: ${updated} / ${res.rows.length} in-stock medicines`);
  return updated;
}

async function fetchNeedingEnrichment(client: Client, limit?: number) {
  const limitSql = limit ? `LIMIT ${limit}` : '';
  const res = await client.query<Row>(`
    SELECT DISTINCT g.id, g.name, g.category::text AS category, g.manufacturer, g.pack_size, g.units_per_pack
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.total_stock > 0
      AND (
        g.manufacturer IS NULL OR g.manufacturer = '' OR g.manufacturer = 'Unknown'
        OR g.pack_size IS NULL OR g.pack_size = ''
      )
    ORDER BY g.name
    ${limitSql}
  `);
  return res.rows;
}

async function enrichWithAi(client: Client, rows: Row[], dryRun: boolean) {
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / CHUNK_SIZE);
    console.log(`AI batch ${batchNum}/${totalBatches}: ${chunk.map((c) => c.name).join(', ')}`);

    try {
      const aiResponseString = await enrichMedicineBatch(
        chunk.map((r) => ({
          id: r.id,
          name: r.name,
          manufacturer: r.manufacturer || undefined,
          category: r.category || undefined,
        })),
      );
      const enrichedData = JSON.parse(aiResponseString);
      if (!enrichedData?.medicines || !Array.isArray(enrichedData.medicines)) {
        console.error('Invalid AI response for batch', batchNum);
        failed += chunk.length;
        continue;
      }

      for (const med of enrichedData.medicines) {
        const original = chunk.find((c) => c.id === med.id);
        if (!original) continue;

        try {
          const manufacturer = needsManufacturer(original.manufacturer)
            ? (med.manufacturer?.trim() || '')
            : (original.manufacturer || '');
          const category = normalizeCategory(med.category, original.category);
          const packSize = needsPackSize(original.pack_size)
            ? (med.packSize?.trim() || inferPackSizeLabel(original.name, category) || null)
            : (original.pack_size || null);
          const units = parseUnitsPerPack(packSize, category, med.correctedName || original.name);

          if (dryRun) {
            console.log(`[dry-run] ${original.name}: mfr="${manufacturer}", pack="${packSize}", category="${category}"`);
            enriched++;
            continue;
          }

          if (manufacturer) {
            await client.query(`INSERT INTO manufacturers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [manufacturer]);
          }

          await client.query(
            `UPDATE global_medicine_master
             SET
               manufacturer = CASE WHEN $1 <> '' THEN $1 ELSE manufacturer END,
               pack_size = COALESCE($2, pack_size),
               units_per_pack = $3,
               category = COALESCE($4::medicine_category, category)
             WHERE id = $5`,
            [manufacturer, packSize, units, category, original.id],
          );
          enriched++;
          console.log(`  ✓ ${original.name} -> mfr: ${manufacturer || '(unchanged)'}, pack: ${packSize || '(unchanged)'}`);
        } catch (rowErr: any) {
          console.error(`  ✗ ${original.name}:`, rowErr?.message || rowErr);
          failed++;
        }
      }
    } catch (err: any) {
      console.error(`Batch ${batchNum} failed:`, err?.message || err);
      failed += chunk.length;
    }

    if (i + CHUNK_SIZE < rows.length) await sleep(SLEEP_MS);
  }

  return { enriched, failed };
}

async function printSummary(client: Client) {
  const r = await client.query(`
    SELECT
      COUNT(DISTINCT g.id)::int AS total_in_stock,
      COUNT(DISTINCT g.id) FILTER (WHERE g.manufacturer IS NULL OR g.manufacturer = '' OR g.manufacturer = 'Unknown')::int AS missing_mfr,
      COUNT(DISTINCT g.id) FILTER (WHERE g.pack_size IS NULL OR g.pack_size = '')::int AS missing_pack
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.total_stock > 0
  `);
  console.log('Summary:', r.rows[0]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Before:');
  await printSummary(client);

  console.log('\nStep 1: infer pack_size from medicine names...');
  await backfillPackSizesFromNames(client, dryRun);

  const remaining = await fetchNeedingEnrichment(client, limit);
  console.log(`\nStep 2: AI enrich ${remaining.length} medicines still missing manufacturer or pack_size...`);

  if (remaining.length > 0) {
    const { enriched, failed } = await enrichWithAi(client, remaining, dryRun);
    console.log(`AI done: enriched=${enriched}, failed=${failed}`);
  }

  console.log('\nAfter:');
  await printSummary(client);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
