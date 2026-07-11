import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const r = await client.query(`
    SELECT 
      COUNT(DISTINCT g.id)::int as total_in_stock,
      COUNT(DISTINCT g.id) FILTER (WHERE g.manufacturer IS NULL OR g.manufacturer = '' OR g.manufacturer = 'Unknown')::int as missing_mfr,
      COUNT(DISTINCT g.id) FILTER (WHERE g.pack_size IS NULL OR g.pack_size = '')::int as missing_pack,
      COUNT(DISTINCT g.id) FILTER (WHERE g.units_per_pack = 1 AND g.category::text NOT IN ('Syrup','Injection','Ointment','Drops','Inhaler'))::int as units_default_1
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.total_stock > 0
  `);
  console.log('Stats:', r.rows[0]);

  const sample = await client.query(`
    SELECT g.id, g.name, g.category, g.manufacturer, g.pack_size, g.units_per_pack, si.total_stock
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.total_stock > 0
      AND ((g.manufacturer IS NULL OR g.manufacturer = '' OR g.manufacturer = 'Unknown')
        OR (g.pack_size IS NULL OR g.pack_size = ''))
    ORDER BY si.total_stock DESC
    LIMIT 15
  `);
  console.log('Sample needing fix:', sample.rows);

  const col = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='global_medicine_master' AND column_name='units_per_pack'",
  );
  console.log('units_per_pack column exists:', col.rows.length > 0);

  await client.end();
}

main().catch(console.error);
