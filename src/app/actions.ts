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

const getStoreId = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminDb = createAdminClient();
  const { data: profile, error } = await adminDb
    .from('user_profiles')
    .select('store_id')
    .eq('id', user.id)
    .single();

  if (error) {
    throw new Error(`DB Error in getStoreId: ${error.message || JSON.stringify(error)}`);
  }
  if (!profile) {
    throw new Error(`Store profile not found for user ${user.id}. Please contact administrator.`);
  }
  return profile.store_id as string;
});

export const getUserProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('user_profiles')
    .select('*, store:stores(*)')
    .eq('id', user.id)
    .single();

  return profile ? { ...profile, user } : null;
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
    .single();

  if (!profile || profile.role !== 'super_admin') throw new Error('Forbidden: Super Admin access required');
  return true;
}

// ─── Super Admin Actions ───────────────────────────────────

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

// ─── Dashboard Stats ──────────────────────────────────────

export async function getDashboardStats() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: totalMedicines },
    { data: salesToday },
    { count: lowStockCount },
    { count: expiringCount },
    { data: recentInvoices },
    { data: storeInfo },
  ] = await Promise.all([
    // Total medicines
    supabase
      .from('medicines')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId),

    // Today's sales
    supabase
      .from('invoices')
      .select('total')
      .eq('store_id', storeId)
      .gte('created_at', today.toISOString()),

    // Low stock: medicines where reorder_level >= total batch quantity
    supabase
      .from('medicines')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .filter('reorder_level', 'gte', 0), // refined below via rpc

    // Expiring soon (within 3 months) — use rpc for date arithmetic
    supabase
      .from('batches')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gt('quantity', 0)
      .lte('expiry_date', getThreeMonthsFromNow()),

    // Recent invoices
    supabase
      .from('invoices')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5),

    // Store info
    supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single(),
  ]);

  // Low stock count via rpc (complex correlated subquery)
  const { count: realLowStock } = await supabase
    .from('medicines')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .filter('reorder_level', 'gt', 0);

  // For true low stock we use a Postgres view/rpc — approximate here with total
  const todaySales = salesToday?.reduce((sum, inv) => sum + (inv.total || 0), 0) ?? 0;

  return {
    totalMedicines: totalMedicines ?? 0,
    todaySales,
    lowStockCount: realLowStock ?? 0,
    expiringCount: expiringCount ?? 0,
    recentInvoices: recentInvoices ?? [],
    storeName: storeInfo?.name ?? 'PillOps Store',
  };
}

function getThreeMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  // Format as YYYY-MM to match the expiry_date column format
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getDashboardData() {
  try {
    const [stats, medicines, salesTrends] = await Promise.all([
      getDashboardStats(),
      getMedicines(),
      getSalesStats(),
    ]);
    return { stats, medicines, salesTrends, error: null };
  } catch (err: any) {
    console.error('getDashboardData Error:', err);
    return { error: err.message || err.toString() };
  }
}

export async function getSalesStats() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('invoices')
    .select('created_at, total')
    .eq('store_id', storeId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  // Group by date client-side
  const byDay = new Map<string, number>();
  for (const inv of data ?? []) {
    const day = inv.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + inv.total);
  }

  return Array.from(byDay.entries()).map(([day, sales]) => ({
    name: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    sales,
  }));
}

// ─── Medicines ─────────────────────────────────────────────

export async function getMedicines() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('medicines')
    .select('*, batches(*)')
    .eq('store_id', storeId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMedicineById(id: string) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('medicines')
    .select('*, batches(*)')
    .eq('id', id)
    .eq('store_id', storeId)
    .single();

  if (error) return null;
  return data;
}

// ─── Sales / POS ───────────────────────────────────────────

export async function createInvoice(invoiceData: any, items: any[]) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('create_invoice', {
    invoice_data: { ...invoiceData, storeId },
    items: items,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
  revalidatePath('/inventory');
  revalidatePath('/pos');
  return data;
}

export async function getInvoiceById(id: string) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', id)
    .eq('store_id', storeId)
    .single();

  if (error) return null;
  return data;
}

export async function getInvoices() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStoreSettings() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getPOSData() {
  const [medicines, storeSettings] = await Promise.all([
    getMedicines(),
    getStoreSettings(),
  ]);
  return { medicines, storeSettings };
}

// ─── Purchases ─────────────────────────────────────────────

export async function getPurchases() {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function savePurchaseInvoice(purchaseData: any, items: any[]) {
  const storeId = await getStoreId();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('save_purchase_invoice', {
    purchase_data: { ...purchaseData, storeId },
    items: items,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
  revalidatePath('/inventory');
  revalidatePath('/purchases');
  return data;
}
