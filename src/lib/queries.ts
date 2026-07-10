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
import { createQueryCache } from '@/lib/query-cache';

const medicinesCache = createQueryCache<any[]>(30_000);
const storeSettingsCaches = new Map<string, ReturnType<typeof createQueryCache<any>>>();

function getStoreSettingsCache(storeId?: string) {
  const key = storeId || 'default';
  if (!storeSettingsCaches.has(key)) {
    storeSettingsCaches.set(key, createQueryCache<any>(60_000));
  }
  return storeSettingsCaches.get(key)!;
}

export function clearQueryCaches() {
  medicinesCache.clear();
  storeSettingsCaches.clear();
}

// ─── Medicines (full catalog — POS / purchases only) ───────

const MEDICINE_FULL_SELECT = `
  id, reorder_level, total_stock, rack, store_id, global_medicine_master_id,
  global_medicine_master(name, generic_name, category, manufacturer, hsn_code, schedule, gst_percent, pack_size, units_per_pack),
  store_inventory_batches(id, batch_number, expiry_date, quantity, purchase_price, mrp, received_date)
`;

function mapMedicineRow(med: any) {
  const gObj = med.global_medicine_master;
  const g = Array.isArray(gObj) ? (gObj[0] || {}) : (gObj || {});

  const batches = (med.store_inventory_batches || []).map((b: any) => ({
    ...b,
    batchNumber: b.batch_number || b.batchNumber,
    expiryDate: b.expiry_date || b.expiryDate,
    purchasePrice: b.purchase_price || b.purchasePrice,
    receivedDate: b.received_date || b.receivedDate,
  }));

  return {
    ...med,
    name: g.name,
    genericName: g.generic_name || g.genericName,
    category: g.category,
    manufacturer: g.manufacturer,
    hsnCode: g.hsn_code || g.hsnCode,
    schedule: g.schedule,
    gstPercent: g.gst_percent || g.gstPercent,
    packSize: g.pack_size || g.packSize || '',
    unitsPerPack: g.units_per_pack || g.unitsPerPack || 1,
    reorderLevel: med.reorder_level || med.reorderLevel,
    totalStock: med.total_stock !== undefined ? med.total_stock : (med.totalStock || 0),
    rack: med.rack,
    batches,
  };
}

export async function fetchMedicines(options?: { force?: boolean }) {
  return medicinesCache.fetch(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('store_inventory')
      .select(MEDICINE_FULL_SELECT);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .map(mapMedicineRow)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, options);
}

// ─── Inventory browse (paginated RPCs — list pages) ──────────

export type InventoryListParams = {
  search?: string;
  category?: string;
  expiryFilter?: string | null;
  offset?: number;
  limit?: number;
};

export async function fetchInventorySummary(storeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_inventory_summary', { p_store_id: storeId });
  if (error) throw new Error(error.message);
  return data as {
    totalMedicines: number;
    expired: number;
    critical: number;
    warning: number;
    lowStock: number;
    categories: string[];
  };
}

export async function fetchInventoryList(storeId: string, params: InventoryListParams = {}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_inventory_list', {
    p_store_id: storeId,
    p_search: params.search?.trim() || null,
    p_category: params.category && params.category !== 'All' ? params.category : null,
    p_expiry_filter: params.expiryFilter || null,
    p_offset: params.offset ?? 0,
    p_limit: params.limit ?? 50,
  });
  if (error) throw new Error(error.message);
  return data as { items: any[]; total: number };
}

export async function fetchExpiringBatches(storeId: string, maxDays = 180) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_expiring_batches', {
    p_store_id: storeId,
    p_max_days: maxDays,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export async function fetchInventoryReport(
  storeId: string,
  params: { search?: string; offset?: number; limit?: number } = {}
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_inventory_report', {
    p_store_id: storeId,
    p_search: params.search?.trim() || null,
    p_offset: params.offset ?? 0,
    p_limit: params.limit ?? 100,
  });
  if (error) throw new Error(error.message);
  return data as { items: any[]; total: number; totalValue: number };
}

export async function fetchMedicineById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_inventory')
    .select(MEDICINE_FULL_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapMedicineRow(data);
}

export async function fetchGlobalMedicines(searchQuery: string) {
  if (!searchQuery) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('search_medicines', { search_term: searchQuery });

  if (error) throw new Error(error.message);
  
  return (data ?? []).map((g: any) => ({
    ...g,
    genericName: g.generic_name || g.genericName,
    hsnCode: g.hsn_code || g.hsnCode,
    gstPercent: g.gst_percent || g.gstPercent,
  }));
}

// ─── Invoices ──────────────────────────────────────────────

function mapInvoiceSummary(inv: any) {
  return {
    ...inv,
    invoiceNumber: inv.invoice_number || inv.invoiceNumber,
    customerName: inv.customer_name || inv.customerName,
    customerPhone: inv.customer_phone || inv.customerPhone,
    doctorName: inv.doctor_name || inv.doctorName,
    area: inv.area,
    gstAmount: inv.gst_amount || inv.gstAmount,
    discountPercent: inv.discount_percent || inv.discountPercent,
    discountAmount: inv.discount_amount || inv.discountAmount,
    createdAt: inv.created_at || inv.createdAt,
  };
}

/** Lightweight list query — no line items. Prefer for tables and landing pages. */
export async function fetchInvoicesList(options?: { limit?: number; search?: string }) {
  const supabase = createClient();
  let query = supabase
    .from('sales_invoices')
    .select('id, invoice_number, customer_name, customer_phone, doctor_name, area, subtotal, gst_amount, discount_percent, discount_amount, total, created_at')
    .order('created_at', { ascending: false });

  const search = options?.search?.trim();
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,invoice_number.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInvoiceSummary);
}

export async function fetchInvoices(limit?: number) {
  const supabase = createClient();
  let query = supabase
    .from('sales_invoices')
    .select('*, items:sales_invoice_items(*, medicine:store_inventory(global_medicine_master(name, manufacturer, pack_size, units_per_pack)), batch:store_inventory_batches(batch_number))')
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []).map((inv: any) => ({
    ...mapInvoiceSummary(inv),
    items: (inv.items || []).map((item: any) => ({
      ...item,
      expiryDate: item.expiry_date || item.expiryDate,
      gstPercent: item.gst_percent || item.gstPercent,
    }))
  }));
}

export async function fetchInvoiceById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sales_invoices')
    .select('*, items:sales_invoice_items(*, medicine:store_inventory(global_medicine_master(name, manufacturer, pack_size, units_per_pack)), batch:store_inventory_batches(batch_number))')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    invoiceNumber: data.invoice_number || data.invoiceNumber,
    customerName: data.customer_name || data.customerName,
    customerPhone: data.customer_phone || data.customerPhone,
    doctorName: data.doctor_name || data.doctorName,
    area: data.area,
    gstAmount: data.gst_amount || data.gstAmount,
    discountPercent: data.discount_percent || data.discountPercent,
    discountAmount: data.discount_amount || data.discountAmount,
    items: (data.items || []).map((item: any) => ({
      ...item,
      expiryDate: item.expiry_date || item.expiryDate,
      gstPercent: item.gst_percent || item.gstPercent,
    }))
  };
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
    .from('sales_invoices')
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

function mapPurchaseSummary(purch: any) {
  return {
    ...purch,
    status: purch.status || 'completed',
    distributorName: purch.distributor_name || purch.distributorName,
    invoiceNumber: purch.invoice_number || purch.invoiceNumber,
    invoiceDate: purch.invoice_date || purch.invoiceDate,
    gstAmount: purch.gst_amount || purch.gstAmount,
    discountAmount: purch.discount_amount || purch.discountAmount,
    createdAt: purch.created_at || purch.createdAt,
    items: (purch.items || []).map((item: any) => ({
      ...item,
      medicineName: item.medicine_name || item.medicineName,
      extractedName: item.extracted_name || item.extractedName,
      batchNumber: item.batch_number || item.batchNumber,
      freeQuantity: item.free_quantity || item.freeQuantity,
      purchasePrice: item.purchase_price || item.purchasePrice,
      discountPercent: item.discount_percent || item.discountPercent,
      gstPercent: item.gst_percent || item.gstPercent,
      expiryDate: item.expiry_date || item.expiryDate,
      totalAmount: item.total_amount || item.totalAmount,
    })),
  };
}

/** Lightweight list query — minimal item fields for draft routing only. */
export async function fetchPurchasesList(options?: {
  limit?: number;
  search?: string;
  status?: 'completed' | 'draft';
}) {
  const supabase = createClient();
  let query = supabase
    .from('purchase_invoices')
    .select(`
      id, status, distributor_name, invoice_number, invoice_date, total, subtotal, gst_amount, discount_amount, created_at,
      items:purchase_invoice_items(id, medicine_name, batch_number, quantity, total_amount, extracted_name)
    `)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const search = options?.search?.trim();
  if (search) {
    query = query.or(`distributor_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPurchaseSummary);
}

export async function fetchPurchaseDraftCount() {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('purchase_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchPurchases() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*, items:purchase_invoice_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPurchaseSummary);
}

export async function fetchRecentPurchases(limit = 5) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, distributor_name, invoice_number, invoice_date, total, status, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((purch: any) => ({
    id: purch.id,
    distributorName: purch.distributor_name || '',
    invoiceNumber: purch.invoice_number || '',
    invoiceDate: purch.invoice_date || '',
    total: purch.total || 0,
    createdAt: purch.created_at,
  }));
}

// ─── Aliases ───────────────────────────────────────────────

export async function fetchAliasesForDistributor(distributorName: string) {
  if (!distributorName) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('distributor_medicine_aliases')
    .select('ocr_name, global_medicine_master(*)')
    .eq('distributor_name', distributorName);

  if (error) return [];
  
  return data.map((alias: any) => {
    const gObj = alias.global_medicine_master;
    const g = Array.isArray(gObj) ? (gObj[0] || {}) : (gObj || {});
    return {
      ocrName: alias.ocr_name,
      medicineName: g.name,
      category: g.category,
      manufacturer: g.manufacturer
    };
  });
}

// ─── Store Settings ────────────────────────────────────────

export async function fetchStoreSettings(storeId?: string, options?: { force?: boolean }) {
  return getStoreSettingsCache(storeId).fetch(async () => {
    const supabase = createClient();
    let query = supabase
      .from('stores')
      .select('id, name, address, phone, gstin, dl_no');

    if (storeId) {
      query = query.eq('id', storeId);
    }

    const { data, error } = await query.limit(1).single();
    if (error) throw new Error(error.message);
    return data;
  }, options);
}

// ─── User Profile ──────────────────────────────────────────

const PROFILE_CACHE_TTL_MS = 60_000;
let cachedProfile: { value: Awaited<ReturnType<typeof fetchUserProfileImpl>>; at: number } | null = null;
let inflightProfile: Promise<Awaited<ReturnType<typeof fetchUserProfileImpl>>> | null = null;

export function clearUserProfileCache() {
  cachedProfile = null;
  inflightProfile = null;
  clearQueryCaches();
}

async function fetchUserProfileImpl() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, role, store_id, full_name, email, phone, created_at')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;

  const storeSelect = 'id, name, address, phone, gstin, dl_no';

  // If super_admin, read the selected store from cookie
  if (profile.role === 'super_admin') {
    const match = typeof document !== 'undefined' ? document.cookie.match(/(^| )pillops_selected_store_id=([^;]+)/) : null;
    const selectedStoreId = match ? match[2] : null;

    if (selectedStoreId) {
      const { data: store } = await supabase.from('stores').select(storeSelect).eq('id', selectedStoreId).single();
      return { ...profile, store_id: selectedStoreId, store, user };
    }

    return { ...profile, user, store: null };
  }

  const { data: store } = await supabase
    .from('stores')
    .select(storeSelect)
    .eq('id', profile.store_id)
    .single();

  return { ...profile, store, user };
}

export async function fetchUserProfile(options?: { force?: boolean }) {
  if (!options?.force && cachedProfile && Date.now() - cachedProfile.at < PROFILE_CACHE_TTL_MS) {
    return cachedProfile.value;
  }

  if (!options?.force && inflightProfile) {
    return inflightProfile;
  }

  inflightProfile = fetchUserProfileImpl()
    .then((result) => {
      cachedProfile = { value: result, at: Date.now() };
      return result;
    })
    .finally(() => {
      inflightProfile = null;
    });

  return inflightProfile;
}

// ─── Store Staff (read only — admin ops stay server-side) ──

export async function fetchStoreStaff() {
  const profile = await fetchUserProfile();
  if (!profile) throw new Error('Unauthorized');

  const storeId = profile.store_id;
  if (!storeId) {
    throw new Error('No pharmacy selected. Please select a pharmacy from the top bar.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveInventoryAdjustment(adjustmentData: any, items: any[]) {
  const supabase = createClient();
  const profile = await fetchUserProfile();
  if (!profile || !profile.store_id) throw new Error('Unauthorized');

  const { data, error } = await supabase.rpc('save_inventory_adjustment', {
    adjustment_data: { ...adjustmentData, storeId: profile.store_id },
    items
  });

  if (error) throw new Error(error.message);
  return data;
}