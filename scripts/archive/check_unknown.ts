import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const unknownOnlyRes = await client.query("SELECT COUNT(*) FROM global_medicine_master WHERE lower(manufacturer) = 'unknown'");
  console.log(`Manufacturers exactly marked as 'Unknown': ${unknownOnlyRes.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
