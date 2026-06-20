import fs from 'fs';
import csv from 'csv-parser';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function determineCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('tablet')) return 'Tablet';
  if (lower.includes('capsule')) return 'Capsule';
  if (lower.includes('syrup') || lower.includes('suspension')) return 'Syrup';
  if (lower.includes('injection')) return 'Injection';
  if (lower.includes('ointment') || lower.includes('cream') || lower.includes('gel') || lower.includes('soap')) return 'Ointment';
  if (lower.includes('drop')) return 'Drops';
  if (lower.includes('inhaler') || lower.includes('respule')) return 'Inhaler';
  if (lower.includes('sachet')) return 'Sachet';
  return 'OTC';
}

async function main() {
  const missingFile = fs.readFileSync('missing_medicines_data.txt', 'utf-8');
  const missingNames = new Set(missingFile.split('\n').map(n => n.trim().toLowerCase()).filter(n => n));

  const recordsToInsert: any[] = [];
  
  fs.createReadStream('medicine_data.csv')
    .pipe(csv())
    .on('data', (data) => {
      const rawName = data['product_name'];
      if (rawName && typeof rawName === 'string') {
         const medName = rawName.trim();
         if (missingNames.has(medName.toLowerCase())) {
            
            recordsToInsert.push({
               name: medName.toUpperCase(),
               category: determineCategory(medName),
               manufacturer: data['product_manufactured'] ? data['product_manufactured'].trim() : null,
               ingredients: data['salt_composition'] ? JSON.stringify([{ salt: data['salt_composition'].trim(), strength: '' }]) : JSON.stringify([])
            });
            missingNames.delete(medName.toLowerCase()); // To avoid duplicates
         }
      }
    })
    .on('end', async () => {
      console.log(`Extracted ${recordsToInsert.length} records from CSV to insert.`);
      
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      console.log('Connected to Database. Starting import...');

      const chunkSize = 100;
      let insertedCount = 0;
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (rec) => {
          try {
             await client.query(
               `INSERT INTO global_medicine_master (name, category, manufacturer, ingredients, gst_percent, is_narcotic, prescription_required)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
               [rec.name, rec.category, rec.manufacturer, rec.ingredients, 12, false, false]
             );
             insertedCount++;
          } catch (e: any) {
             console.error(`Error inserting ${rec.name}`, e.message);
          }
        }));
        if ((i + chunkSize) % 500 === 0 || i + chunkSize >= recordsToInsert.length) {
           console.log(`Imported ${Math.min(i + chunkSize, recordsToInsert.length)} / ${recordsToInsert.length} medicines...`);
        }
      }

      console.log(`Successfully imported ${insertedCount} missing medicines!`);
      await client.end();
    });
}

main().catch(console.error);
