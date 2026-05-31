/**
 * Client-side Supabase queries.
 *
 * These run directly in the browser using the anon key + RLS,
 * completely bypassing Cloudflare Workers. This keeps the Worker
 * within the free-tier 10ms CPU limit.
 *
 * ONLY use these for READ operations.
 * Mutations (create/update/delete) still go through server actions.
 */

import { createClient } from '@/utils/supabase/client';

// ─── Medicines ─────────────────────────────────────────────

export async function fetchMedicines() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('medicines')
    .select('*, batches(*)')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMedicineById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('medicines')
    .select('*, batches(*)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

// ─── Invoices ──────────────────────────────────────────────

export async function fetchInvoices() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchInvoiceById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*, medicine:medicines(name), batch:batches(batch_number))')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

// ─── Dashboard Stats (via RPC) ─────────────────────────────

export async function fetchDashboardStats(storeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_dashboard_stats', { p_store_id: storeId });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchSalesStats() {
  const supabase = createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('invoices')
    .select('created_at, total')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  // Group by date client-side (runs in browser, not Worker)
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

// ─── Purchases ─────────────────────────────────────────────

export async function fetchPurchases() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('*, items:purchase_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Store Settings ────────────────────────────────────────

export async function fetchStoreSettings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─── User Profile ──────────────────────────────────────────

export async function fetchUserProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;

  // If super_admin, read the selected store from cookie
  if (profile.role === 'super_admin') {
    const match = typeof document !== 'undefined' ? document.cookie.match(/(^| )pillops_selected_store_id=([^;]+)/) : null;
    const selectedStoreId = match ? match[2] : null;
    
    if (selectedStoreId) {
      const { data: store } = await supabase.from('stores').select('*').eq('id', selectedStoreId).single();
      return { ...profile, store_id: selectedStoreId, store, user };
    }
    
    return { ...profile, user };
  }

  // Fetch store info
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', profile.store_id)
    .single();

  return { ...profile, store, user };
}

// ─── Store Staff (read only — admin ops stay server-side) ──

export async function fetchStoreStaff() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
