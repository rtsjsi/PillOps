import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT name, category FROM global_medicine_master WHERE manufacturer IS NULL OR manufacturer = '' OR manufacturer = 'Unknown' ORDER BY RANDOM() LIMIT 10");
  console.log(res.rows);
  await client.end();
}
main().catch(console.error);
