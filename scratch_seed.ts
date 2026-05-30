import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  const userId = 'cfa4a670-a60e-4142-9112-b15c89fa4317';
  
  console.log('Creating store...');
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .insert({
      name: 'PillOps Main Pharmacy',
      address: '123 Health St',
      subscription_tier: 'pro'
    })
    .select()
    .single();

  if (storeError) {
    console.error('Store Error:', storeError);
    return;
  }
  
  console.log('Store created:', store.id);
  
  console.log('Creating user profile...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: userId,
      store_id: store.id,
      role: 'super_admin',
      full_name: 'Admin User'
    })
    .select()
    .single();
    
  if (profileError) {
    console.error('Profile Error:', profileError);
    return;
  }
  
  console.log('Profile created successfully:', profile);
}

seed();
