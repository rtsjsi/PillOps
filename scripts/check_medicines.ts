import fs from 'fs';
import csv from 'csv-parser';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log('Connected to DB...');
  const res = await client.query('SELECT name FROM global_medicine_master');
  const dbMedicines = new Set(res.rows.map(r => r.name.toLowerCase().trim()));
  console.log(`Found ${dbMedicines.size} medicines in DB`);

  const missingMedicines: string[] = [];
  let totalCount = 0;

  fs.createReadStream('Medicine_Details.csv')
    .pipe(csv())
    .on('data', (data) => {
      totalCount++;
      // Get the first column value if the header is not strictly "Medicine Name"
      const rawName = data['Medicine Name'] || Object.values(data)[0];
      if (rawName && typeof rawName === 'string') {
         const medName = rawName.trim();
         // The DB might have uppercase names or specific formatting, but we compared lowercase
         if (!dbMedicines.has(medName.toLowerCase())) {
            missingMedicines.push(medName);
         }
      }
    })
    .on('end', async () => {
      console.log(`Total in CSV: ${totalCount}`);
      console.log(`Missing in DB: ${missingMedicines.length}`);
      
      if (missingMedicines.length > 0) {
         console.log(`Some missing examples:`);
         console.log(missingMedicines.slice(0, 15).join('\n'));
      }
      
      // Save full list to a file for review
      fs.writeFileSync('missing_medicines.txt', missingMedicines.join('\n'));
      console.log('Full list of missing medicines saved to missing_medicines.txt');
      
      await client.end();
    });
}

main().catch(console.error);
