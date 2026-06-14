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
    .from('store_inventory')
    .select('*, global_medicine_master(*), store_inventory_batches(*)');

  if (error) throw new Error(error.message);
  
  const mappedData = (data ?? []).map((med: any) => {
    const gObj = med.global_medicine_master;
    const g = Array.isArray(gObj) ? (gObj[0] || {}) : (gObj || {});
    
    const batches = (med.store_inventory_batches || []).map((b: any) => ({
      ...b,
      batchNumber: b.batch_number || b.batchNumber,
      expiryDate: b.expiry_date || b.expiryDate,
      purchasePrice: b.purchase_price || b.purchasePrice,
      receivedDate: b.received_date || b.receivedDate
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
      reorderLevel: med.reorder_level || med.reorderLevel,
      totalStock: med.total_stock !== undefined ? med.total_stock : (med.totalStock || 0),
      rack: med.rack,
      batches
    };
  });

  return mappedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function fetchMedicineById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_inventory')
    .select('*, global_medicine_master(*), store_inventory_batches(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  
  const gObj = data.global_medicine_master;
  const g = Array.isArray(gObj) ? (gObj[0] || {}) : (gObj || {});
  
  const batches = (data.store_inventory_batches || []).map((b: any) => ({
    ...b,
    batchNumber: b.batch_number || b.batchNumber,
    expiryDate: b.expiry_date || b.expiryDate,
    purchasePrice: b.purchase_price || b.purchasePrice,
    receivedDate: b.received_date || b.receivedDate
  }));

  return {
    ...data,
    name: g.name,
    genericName: g.generic_name || g.genericName,
    category: g.category,
    manufacturer: g.manufacturer,
    hsnCode: g.hsn_code || g.hsnCode,
    schedule: g.schedule,
    gstPercent: g.gst_percent || g.gstPercent,
    reorderLevel: data.reorder_level || data.reorderLevel,
    totalStock: data.total_stock !== undefined ? data.total_stock : (data.totalStock || 0),
    rack: data.rack,
    batches
  };
}

export async function fetchGlobalMedicines(searchQuery: string) {
  if (!searchQuery) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('global_medicine_master')
    .select('*')
    .ilike('name', `%${searchQuery}%`)
    .limit(20);

  if (error) throw new Error(error.message);
  
  return (data ?? []).map((g: any) => ({
    ...g,
    genericName: g.generic_name || g.genericName,
    hsnCode: g.hsn_code || g.hsnCode,
    gstPercent: g.gst_percent || g.gstPercent,
  }));
}

// ─── Invoices ──────────────────────────────────────────────

export async function fetchInvoices(limit?: number) {
  const supabase = createClient();
  let query = supabase
    .from('sales_invoices')
    .select('*, items:sales_invoice_items(*, medicine:store_inventory(global_medicine_master(name)), batch:store_inventory_batches(batch_number))')
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []).map((inv: any) => ({
    ...inv,
    invoiceNumber: inv.invoice_number || inv.invoiceNumber,
    customerName: inv.customer_name || inv.customerName,
    customerPhone: inv.customer_phone || inv.customerPhone,
    doctorName: inv.doctor_name || inv.doctorName,
    area: inv.area,
    gstAmount: inv.gst_amount || inv.gstAmount,
    discountPercent: inv.discount_percent || inv.discountPercent,
    discountAmount: inv.discount_amount || inv.discountAmount,
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
    .select('*, items:sales_invoice_items(*, medicine:store_inventory(global_medicine_master(name)), batch:store_inventory_batches(batch_number))')
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

export async function fetchPurchases() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*, items:purchase_invoice_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((purch: any) => ({
    ...purch,
    distributorName: purch.distributor_name || purch.distributorName,
    invoiceNumber: purch.invoice_number || purch.invoiceNumber,
    invoiceDate: purch.invoice_date || purch.invoiceDate,
    gstAmount: purch.gst_amount || purch.gstAmount,
    discountAmount: purch.discount_amount || purch.discountAmount,
    items: (purch.items || []).map((item: any) => ({
      ...item,
      medicineName: item.medicine_name || item.medicineName,
      batchNumber: item.batch_number || item.batchNumber,
      freeQuantity: item.free_quantity || item.freeQuantity,
      purchasePrice: item.purchase_price || item.purchasePrice,
      discountPercent: item.discount_percent || item.discountPercent,
      gstPercent: item.gst_percent || item.gstPercent,
      expiryDate: item.expiry_date || item.expiryDate,
      totalAmount: item.total_amount || item.totalAmount
    }))
  }));
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
