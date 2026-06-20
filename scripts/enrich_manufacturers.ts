import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { enrichMedicineBatchWithGroq } from '../src/lib/ai-server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Fetching 10 records without a manufacturer...');
  const res = await client.query("SELECT id, name, category, manufacturer FROM global_medicine_master WHERE manufacturer IS NULL OR manufacturer = '' OR manufacturer = 'Unknown' ORDER BY RANDOM() LIMIT 10");
  
  if (res.rows.length === 0) {
    console.log('No records found!');
    await client.end();
    return;
  }

  console.log('Records to enrich:', res.rows.map(r => r.name));
  
  console.log('Calling AI to enrich...');
  const aiResponseString = await enrichMedicineBatchWithGroq(res.rows);
  const enrichedData = JSON.parse(aiResponseString);

  if (!enrichedData?.medicines || !Array.isArray(enrichedData.medicines)) {
    console.error('Invalid AI response:', enrichedData);
    await client.end();
    return;
  }

  for (const med of enrichedData.medicines) {
    try {
      console.log(`Updating ${med.name} with manufacturer: ${med.manufacturer}`);
      await client.query(
        `UPDATE global_medicine_master SET manufacturer = $1 WHERE name = $2`,
        [med.manufacturer || 'Unknown', med.name]
      );
    } catch (e: any) {
      console.error(`Failed to update ${med.name}:`, e.message);
    }
  }

  console.log('Successfully enriched records!');
  await client.end();
}

main().catch(console.error);
