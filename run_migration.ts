import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '20260613121000_rename_sales_invoices.sql'),
      'utf8'
    );

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

run();
