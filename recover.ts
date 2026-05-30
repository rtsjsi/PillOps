import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

async function recoverSuperAdmin() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check remaining users in auth.users
    const res = await client.query(`SELECT id, email FROM auth.users`);
    console.log(`Found ${res.rowCount} users in auth.users:`, res.rows);

    for (const user of res.rows) {
      console.log(`Recreating profile for Super Admin: ${user.email}`);
      // Recreate profile with role 'super_admin' and store_id NULL
      await client.query(`
        INSERT INTO public.user_profiles (id, role, full_name, store_id)
        VALUES ($1, 'super_admin', 'Super Admin', NULL)
        ON CONFLICT (id) DO NOTHING;
      `, [user.id]);
      console.log(`Successfully restored profile for ${user.email}`);
    }

  } catch (err) {
    console.error('Error recovering:', err);
  } finally {
    await client.end();
  }
}

recoverSuperAdmin();
