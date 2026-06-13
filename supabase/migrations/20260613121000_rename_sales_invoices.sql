-- ============================================================
-- Migration: Rename Invoices to Sales Invoices
-- Renames invoices and invoice_items to sales_invoices and sales_invoice_items.
-- Renames relevant foreign key columns.
-- Replaces create_invoice RPC with save_sales_invoice RPC.
-- Updates get_dashboard_stats RPC.
-- ============================================================

-- 1. Rename tables
ALTER TABLE invoices RENAME TO sales_invoices;
ALTER TABLE invoice_items RENAME TO sales_invoice_items;

-- 2. Rename columns in sales_invoice_items
ALTER TABLE sales_invoice_items RENAME COLUMN invoice_id TO sales_invoice_id;
ALTER TABLE sales_invoice_items RENAME COLUMN medicine_id TO store_inventory_id;
ALTER TABLE sales_invoice_items RENAME COLUMN batch_id TO inventory_batch_id;

-- 3. Drop old RPC
DROP FUNCTION IF EXISTS create_invoice(jsonb, jsonb);

-- 4. Create new RPC: save_sales_invoice
CREATE OR REPLACE FUNCTION save_sales_invoice(
  invoice_data jsonb,
  items        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice   sales_invoices%ROWTYPE;
  v_item      jsonb;
BEGIN
  -- 1. Insert invoice
  INSERT INTO sales_invoices (
    store_id, invoice_number, customer_name, customer_phone,
    subtotal, gst_amount, discount_percent, discount_amount, total
  )
  VALUES (
    (invoice_data->>'storeId')::uuid,
    invoice_data->>'invoiceNumber',
    invoice_data->>'customerName',
    invoice_data->>'customerPhone',
    (invoice_data->>'subtotal')::double precision,
    (invoice_data->>'gstAmount')::double precision,
    COALESCE((invoice_data->>'discountPercent')::double precision, 0),
    COALESCE((invoice_data->>'discountAmount')::double precision, 0),
    (invoice_data->>'total')::double precision
  )
  RETURNING * INTO v_invoice;

  -- 2. Insert line items and decrement batch quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    INSERT INTO sales_invoice_items (
      store_id, sales_invoice_id, store_inventory_id, inventory_batch_id,
      quantity, mrp, gst_percent, expiry_date
    )
    VALUES (
      v_invoice.store_id,
      v_invoice.id,
      (v_item->>'medicineId')::uuid,
      (v_item->>'batchId')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'mrp')::double precision,
      (v_item->>'gstPercent')::double precision,
      v_item->>'expiryDate'
    );

    UPDATE inventory_batches
    SET quantity = quantity - (v_item->>'quantity')::integer
    WHERE id = (v_item->>'batchId')::uuid
      AND store_id = v_invoice.store_id;
  END LOOP;

  -- 3. Increment store last_invoice_number
  UPDATE stores
  SET last_invoice_number = last_invoice_number + 1
  WHERE id = v_invoice.store_id;

  RETURN to_jsonb(v_invoice);
END;
$$;

-- 5. Update RPC: get_dashboard_stats
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
  FROM store_inventory WHERE store_id = p_store_id;

  -- Today's sales (now using sales_invoices)
  SELECT COALESCE(sum(total), 0) INTO v_today_sales
  FROM sales_invoices
  WHERE store_id = p_store_id
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  -- Low stock
  SELECT count(*) INTO v_low_stock_count
  FROM store_inventory m
  WHERE m.store_id = p_store_id
    AND m.reorder_level > 0
    AND m.total_stock <= m.reorder_level;

  -- Expiring within 3 months
  v_three_months := to_char(CURRENT_DATE + interval '3 months', 'YYYY-MM');
  SELECT count(*) INTO v_expiring_count
  FROM inventory_batches
  WHERE store_id = p_store_id
    AND quantity > 0
    AND expiry_date <= v_three_months;

  -- Recent 5 invoices (now using sales_invoices)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
  INTO v_recent_invoices
  FROM (
    SELECT id, invoice_number AS "invoiceNumber",
           customer_name AS "customerName",
           customer_phone AS "customerPhone",
           total, created_at AS "createdAt"
    FROM sales_invoices
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
