import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Checking for missing fields in global_medicine_master...');
  
  const queries = [
    { name: 'Missing Manufacturer', q: "SELECT COUNT(*) FROM global_medicine_master WHERE manufacturer IS NULL OR manufacturer = ''" },
    { name: 'Missing HSN Code', q: "SELECT COUNT(*) FROM global_medicine_master WHERE hsn_code IS NULL OR hsn_code = ''" },
    { name: 'Missing GST Percent', q: "SELECT COUNT(*) FROM global_medicine_master WHERE gst_percent IS NULL" },
    { name: 'Missing Narcotic Flag', q: "SELECT COUNT(*) FROM global_medicine_master WHERE is_narcotic IS NULL" },
    { name: 'Missing Prescription Flag', q: "SELECT COUNT(*) FROM global_medicine_master WHERE prescription_required IS NULL" },
    { name: 'Total Records', q: "SELECT COUNT(*) FROM global_medicine_master" }
  ];

  for (const query of queries) {
    const res = await client.query(query.q);
    console.log(`${query.name}: ${res.rows[0].count}`);
  }

  await client.end();
}

main().catch(console.error);
