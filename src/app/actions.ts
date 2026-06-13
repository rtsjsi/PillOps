'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { cache } from 'react';
import { chatWithGroq } from '@/lib/ai-server';

// ─── AI Helper ─────────────────────────────────────────────

export async function askAI(prompt: string, context?: string) {
  const systemPrompt = `You are a helpful pharmacy assistant for PillOps. ${context || ''}`;
  return await chatWithGroq(prompt, systemPrompt);
}

// ─── SaaS Helpers ──────────────────────────────────────────

import { cookies } from 'next/headers';

const getStoreId = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminDb = createAdminClient();
  const { data: profile, error } = await adminDb
    .from('user_profiles')
    .select('role, store_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`DB Error in getStoreId: ${error.message || JSON.stringify(error)}`);
  }
  if (!profile) {
    throw new Error(`User profile not found. Please contact administrator.`);
  }

  if (profile.role === 'super_admin') {
    const cookieStore = await cookies();
    const selectedStoreId = cookieStore.get('pillops_selected_store_id')?.value;
    if (selectedStoreId) return selectedStoreId;
    
    throw new Error('Super Admin must select a pharmacy from the top bar before accessing this section.');
  }

  if (!profile.store_id) {
    throw new Error('No pharmacy assigned to your profile.');
  }

  return profile.store_id as string;
});

async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'super_admin') throw new Error('Forbidden: Super Admin access required');
  return true;
}

// ─── Super Admin Actions (mutations — need admin client) ───

export async function createStore(storeData: any) {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  const { data: store, error } = await supabase
    .from('stores')
    .insert({
      name: storeData.name,
      address: storeData.address,
      phone: storeData.phone,
      gstin: storeData.gstin,
      subscription_tier: storeData.subscriptionTier || 'pro',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return store;
}

export async function getAllStores() {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getAvailableStoresForSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') return [];

  const { data } = await adminDb
    .from('stores')
    .select('id, name')
    .order('name', { ascending: true });

  return data ?? [];
}

// ─── Sales / POS (mutations) ───────────────────────────────

export async function saveSalesInvoice(invoiceData: any, items: any[]) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('save_sales_invoice', {
    invoice_data: { ...invoiceData, storeId },
    items: items,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
  revalidatePath('/inventory');
  revalidatePath('/pos');
  revalidatePath('/expiry');

  return data;
}

// ─── Purchases (mutations) ─────────────────────────────────

export async function savePurchaseInvoice(purchaseData: any, items: any[]) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('save_purchase_invoice', {
    purchase_data: { ...purchaseData, storeId },
    items: items,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/expiry');

  return data;
}

// ─── Profile & User Settings (mutations) ────────────────────

export async function updateProfile(fullName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from('user_profiles')
    .update({ full_name: fullName })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ─── Store Settings (mutations) ─────────────────────────────

export async function updateStoreSettings(data: { name: string, address: string, phone: string, gstin: string }) {
  const storeId = await getStoreId();
  const adminDb = createAdminClient();
  
  const { error } = await adminDb
    .from('stores')
    .update({
      name: data.name,
      address: data.address,
      phone: data.phone,
      gstin: data.gstin
    })
    .eq('id', storeId);

  if (error) throw new Error(error.message);
}

// ─── Staff Management (needs admin auth client) ─────────────

export async function getStoreStaff() {
  const storeId = await getStoreId();
  const adminDb = createAdminClient();

  const { data: profiles, error } = await adminDb
    .from('user_profiles')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const { data: authData, error: authError } = await adminDb.auth.admin.listUsers();
  if (authError) throw new Error(authError.message);

  const staff = profiles.map(profile => {
    const authUser = authData.users.find(u => u.id === profile.id);
    return {
      ...profile,
      email: authUser?.email || ''
    };
  });

  return staff;
}

export async function addStoreStaff(data: { fullName: string, email: string, password: string, role: string }) {
  try {
    const storeId = await getStoreId();
    const adminDb = createAdminClient();

    // Check caller is owner or super_admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: callerProfile } = await adminDb
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'owner' && callerProfile?.role !== 'super_admin') {
      return { error: 'Unauthorized: Only store owners can add staff.' };
    }

    const { data: authUser, error: authError } = await adminDb.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    if (!authUser?.user?.id) {
       return { error: "Failed to create user in authentication system." };
    }

    const { error: profileError } = await adminDb
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        store_id: storeId,
        full_name: data.fullName,
        role: data.role
      });

    if (profileError) {
      await adminDb.auth.admin.deleteUser(authUser.user.id);
      return { error: profileError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "An unexpected error occurred." };
  }
}

export async function updateStaffRole(userId: string, role: string) {
  const storeId = await getStoreId();
  const adminDb = createAdminClient();

  // Verify caller
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: callerProfile } = await adminDb
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'owner' && callerProfile?.role !== 'super_admin') {
    throw new Error('Unauthorized: Only store owners can update staff roles.');
  }

  const { data: staffProfile } = await adminDb
    .from('user_profiles')
    .select('store_id')
    .eq('id', userId)
    .single();

  if (staffProfile?.store_id !== storeId) throw new Error('Unauthorized');

  const { error } = await adminDb
    .from('user_profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

export async function removeStaff(userId: string) {
  const storeId = await getStoreId();
  const adminDb = createAdminClient();

  // Verify caller
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: callerProfile } = await adminDb
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'owner' && callerProfile?.role !== 'super_admin') {
    throw new Error('Unauthorized: Only store owners can remove staff.');
  }

  const { data: staffProfile } = await adminDb
    .from('user_profiles')
    .select('store_id')
    .eq('id', userId)
    .single();

  if (staffProfile?.store_id !== storeId) throw new Error('Unauthorized');

  const { error } = await adminDb.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

export async function disposeBatch(batchId: string) {
  const storeId = await getStoreId();
  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from('batches')
    .update({ quantity: 0 })
    .eq('id', batchId)
    .eq('store_id', storeId);

  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
  revalidatePath('/expiry');
  revalidatePath('/dashboard');
  revalidatePath('/pos');
}
