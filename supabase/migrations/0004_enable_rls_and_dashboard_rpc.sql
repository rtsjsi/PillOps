-- ============================================================
-- Migration: Enable RLS + Policies + Dashboard RPC
-- This secures all tables so client-side queries (anon key)
-- can only access data for the authenticated user's store.
-- ============================================================

-- ─── Helper Functions ──────────────────────────────────────

-- Get the current user's store_id from their profile
CREATE OR REPLACE FUNCTION public.user_store_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT store_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Check if the current user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

-- ─── Enable RLS on All Tables ──────────────────────────────

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- ─── Stores Policies ───────────────────────────────────────

CREATE POLICY "Users can view their own store"
  ON stores FOR SELECT
  USING (id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Owners can update their store"
  ON stores FOR UPDATE
  USING (id = public.user_store_id() OR public.is_super_admin());

-- ─── User Profiles Policies ────────────────────────────────

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid() OR store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── Medicines Policies ────────────────────────────────────

CREATE POLICY "Users can view their store medicines"
  ON medicines FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert medicines for their store"
  ON medicines FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can update their store medicines"
  ON medicines FOR UPDATE
  USING (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Batches Policies ──────────────────────────────────────

CREATE POLICY "Users can view their store batches"
  ON batches FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert batches for their store"
  ON batches FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can update their store batches"
  ON batches FOR UPDATE
  USING (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Invoices Policies ─────────────────────────────────────

CREATE POLICY "Users can view their store invoices"
  ON invoices FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert invoices for their store"
  ON invoices FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Invoice Items Policies ────────────────────────────────

CREATE POLICY "Users can view their store invoice items"
  ON invoice_items FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert invoice items for their store"
  ON invoice_items FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Purchases Policies ────────────────────────────────────

CREATE POLICY "Users can view their store purchases"
  ON purchases FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert purchases for their store"
  ON purchases FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Purchase Items Policies ───────────────────────────────

CREATE POLICY "Users can view their store purchase items"
  ON purchase_items FOR SELECT
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can insert purchase items for their store"
  ON purchase_items FOR INSERT
  WITH CHECK (store_id = public.user_store_id() OR public.is_super_admin());

-- ─── Dashboard Stats RPC ───────────────────────────────────
-- Single Postgres function that returns all dashboard stats
-- in one call, replacing 7+ separate queries from the Worker.

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_medicines  integer;
  v_today_sales      double precision;
  v_low_stock_count  integer;
  v_expiring_count   integer;
  v_recent_invoices  jsonb;
  v_store_name       text;
  v_three_months     text;
BEGIN
  -- Verify access
  IF NOT (p_store_id = public.user_store_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Total medicines
  SELECT count(*) INTO v_total_medicines
  FROM medicines WHERE store_id = p_store_id;

  -- Today's sales
  SELECT COALESCE(sum(total), 0) INTO v_today_sales
  FROM invoices
  WHERE store_id = p_store_id
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  -- Low stock (medicines where total batch qty <= reorder_level)
  SELECT count(*) INTO v_low_stock_count
  FROM medicines m
  WHERE m.store_id = p_store_id
    AND m.reorder_level > 0
    AND (
      SELECT COALESCE(sum(b.quantity), 0)
      FROM batches b
      WHERE b.medicine_id = m.id AND b.store_id = p_store_id
    ) <= m.reorder_level;

  -- Expiring within 3 months
  v_three_months := to_char(CURRENT_DATE + interval '3 months', 'YYYY-MM');
  SELECT count(*) INTO v_expiring_count
  FROM batches
  WHERE store_id = p_store_id
    AND quantity > 0
    AND expiry_date <= v_three_months;

  -- Recent 5 invoices
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_recent_invoices
  FROM (
    SELECT id, invoice_number AS "invoiceNumber",
           customer_name AS "customerName",
           customer_phone AS "customerPhone",
           total, created_at AS "createdAt"
    FROM invoices
    WHERE store_id = p_store_id
    ORDER BY created_at DESC
    LIMIT 5
  ) sub;

  -- Store name
  SELECT name INTO v_store_name FROM stores WHERE id = p_store_id;

  RETURN jsonb_build_object(
    'totalMedicines', v_total_medicines,
    'todaySales', v_today_sales,
    'lowStockCount', v_low_stock_count,
    'expiringCount', v_expiring_count,
    'recentInvoices', v_recent_invoices,
    'storeName', COALESCE(v_store_name, 'PillOps Store')
  );
END;
$$;
