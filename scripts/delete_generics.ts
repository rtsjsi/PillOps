import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Deleting purely generic medicines...');
  
  const query = `
    DELETE
    FROM global_medicine_master
    WHERE 
      jsonb_typeof(ingredients) = 'array' 
      AND jsonb_array_length(ingredients) > 0
      AND lower(name) = lower(ingredients->0->>'salt')
    RETURNING name;
  `;

  const res = await client.query(query);
  
  console.log(`Deleted ${res.rowCount} records:`);
  res.rows.forEach(r => {
    console.log(`- ${r.name}`);
  });

  await client.end();
}

main().catch(console.error);
