import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Finding purely generic medicines (where the medicine name exactly matches its active ingredient)...');
  
  // Try to find records where the name matches the salt exactly, or where it's a known generic like PARACETAMOL
  const query = `
    SELECT name, category, manufacturer, ingredients
    FROM global_medicine_master
    WHERE 
      jsonb_typeof(ingredients) = 'array' 
      AND jsonb_array_length(ingredients) > 0
      AND lower(name) = lower(ingredients->0->>'salt')
    LIMIT 20;
  `;

  const res = await client.query(query);
  
  console.log(`Found ${res.rows.length} generic chemical names (showing top 20):`);
  res.rows.forEach(r => {
    console.log(`- ${r.name} (${r.category}) | Manufacturer: ${r.manufacturer || 'None'}`);
  });

  // Also let's just get a count
  const countRes = await client.query(`
    SELECT count(*)
    FROM global_medicine_master
    WHERE 
      jsonb_typeof(ingredients) = 'array' 
      AND jsonb_array_length(ingredients) > 0
      AND lower(name) = lower(ingredients->0->>'salt')
  `);
  
  console.log(`\nTotal purely generic chemical names found in database: ${countRes.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
