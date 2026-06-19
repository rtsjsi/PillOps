import fs from 'fs';
import csv from 'csv-parser';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const missingFile = fs.readFileSync('missing_medicines.txt', 'utf-8');
  const missingNames = new Set(missingFile.split('\n').map(n => n.trim().toLowerCase()).filter(n => n));

  const recordsToInsert: any[] = [];
  
  fs.createReadStream('Medicine_Details.csv')
    .pipe(csv())
    .on('data', (data) => {
      const rawName = data['Medicine Name'] || Object.values(data)[0];
      if (rawName && typeof rawName === 'string') {
         const medName = rawName.trim();
         if (missingNames.has(medName.toLowerCase())) {
            recordsToInsert.push({
               name: medName.toUpperCase(),
               category: null,
               manufacturer: data['Manufacturer'] ? data['Manufacturer'].trim() : null,
               ingredients: data['Composition'] ? JSON.stringify([{ salt: data['Composition'].trim(), strength: '' }]) : JSON.stringify([])
            });
            missingNames.delete(medName.toLowerCase()); // To avoid duplicates
         }
      }
    })
    .on('end', async () => {
      console.log(`Extracted ${recordsToInsert.length} records from CSV to insert.`);
      
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.error('DATABASE_URL is missing in .env.local');
        return;
      }
      const client = new Client({ connectionString });
      await client.connect();
      console.log('Connected to Database. Starting import...');

      let insertedCount = 0;
      for (const rec of recordsToInsert) {
         try {
           // Basic insert query. We handle uniqueness in our logic or via DB constraint.
           await client.query(
             `INSERT INTO global_medicine_master (name, category, manufacturer, ingredients, gst_percent, is_narcotic, prescription_required)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
             [rec.name, rec.category, rec.manufacturer, rec.ingredients, 12, false, false]
           );
           insertedCount++;
         } catch(e: any) {
           // If there is a unique constraint violation, we just skip it
           if (e.code === '23505') {
               // duplicate
           } else {
               console.error('Error inserting', rec.name, e.message);
           }
         }
      }
      
      console.log(`Successfully imported ${insertedCount} missing medicines!`);
      await client.end();
    });
}

main().catch(console.error);
