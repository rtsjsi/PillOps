import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Cleaning up duplicate medicines (keeping 1 copy of each)...');
  
  // Keep the one with the smallest id (string comparison is fine for UUIDs just to pick a stable one)
  const query = `
    DELETE FROM global_medicine_master
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
        ROW_NUMBER() OVER(PARTITION BY lower(name) ORDER BY id) as row_num
        FROM global_medicine_master
      ) t
      WHERE t.row_num > 1
    );
  `;

  const res = await client.query(query);
  
  console.log(`Deleted ${res.rowCount} duplicate records!`);

  await client.end();
}

main().catch(console.error);
