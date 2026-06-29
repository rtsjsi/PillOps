import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Running duplicate check on global_medicine_master (case-insensitive name check)...');
  
  const query = `
    SELECT lower(name) as name_lower, count(*) as count
    FROM global_medicine_master
    GROUP BY lower(name)
    HAVING count(*) > 1
    ORDER BY count DESC;
  `;

  const res = await client.query(query);
  
  if (res.rowCount === 0) {
    console.log('No duplicates found! Every medicine name is unique.');
  } else {
    console.log(`Found ${res.rowCount} duplicate names! Showing top 20 with highest counts:`);
    
    // Fetch top 20
    for (let i = 0; i < Math.min(20, res.rowCount ?? 0); i++) {
      const name = res.rows[i].name_lower;
      const count = res.rows[i].count;
      console.log(`- "${name}" appears ${count} times`);
      
      // optionally fetch the exact names to see differences in case/formatting
      const detailRes = await client.query(`SELECT id, name, category FROM global_medicine_master WHERE lower(name) = $1 LIMIT 5`, [name]);
      detailRes.rows.forEach(r => {
        console.log(`    > ID: ${r.id} | Name: ${r.name} | Category: ${r.category}`);
      });
    }
  }

  await client.end();
}

main().catch(console.error);
