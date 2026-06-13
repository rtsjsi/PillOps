-- ============================================================
-- Migration: Rename Inventory Batches
-- Renames inventory_batches to store_inventory_batches.
-- Renames inventory_batch_id foreign keys.
-- Updates save_purchase_invoice, save_sales_invoice, and get_dashboard_stats.
-- ============================================================

-- 1. Rename table
ALTER TABLE inventory_batches RENAME TO store_inventory_batches;

-- 2. Rename columns in dependent tables
ALTER TABLE sales_invoice_items RENAME COLUMN inventory_batch_id TO store_inventory_batch_id;

-- 3. Rename Trigger (Note: PostgreSQL triggers are bound to tables, so we just rename the trigger function and the trigger itself if desired)
ALTER TRIGGER on_inventory_batch_change ON store_inventory_batches RENAME TO on_store_inventory_batch_change;

-- 4. Update save_purchase_invoice
CREATE OR REPLACE FUNCTION save_purchase_invoice(
  purchase_data jsonb,
  items         jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice           purchase_invoices%ROWTYPE;
  v_item              jsonb;
  v_global_medicine_master_id uuid;
  v_store_inv_id      uuid;
  v_batch_id          uuid;
  v_store_id          uuid;
BEGIN
  v_store_id := (purchase_data->>'storeId')::uuid;

  -- 1. Insert purchase invoice
  INSERT INTO purchase_invoices (
    store_id, distributor_name, invoice_number, invoice_date,
    subtotal, discount_amount, gst_amount, total
  )
  VALUES (
    v_store_id,
    purchase_data->>'distributorName',
    purchase_data->>'invoiceNumber',
    (purchase_data->>'invoiceDate')::date,
    (purchase_data->>'subtotal')::double precision,
    COALESCE((purchase_data->>'discountAmount')::double precision, 0),
    (purchase_data->>'gstAmount')::double precision,
    (purchase_data->>'total')::double precision
  )
  RETURNING * INTO v_invoice;

  -- 2. For each item, find/create global medicine -> find/create store inventory -> insert invoice item -> upsert batch
  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Step 2a. Find or create Global Medicine
    SELECT id INTO v_global_medicine_master_id
    FROM global_medicine_master
    WHERE name = v_item->>'medicineName'
    LIMIT 1;

    IF v_global_medicine_master_id IS NULL THEN
      INSERT INTO global_medicine_master (
        name, generic_name, category, manufacturer, hsn_code, created_by_store_id
      )
      VALUES (
        v_item->>'medicineName',
        '',
        'Tablet',
        COALESCE(v_item->>'manufacturer', ''),
        COALESCE(v_item->>'hsnCode', ''),
        v_store_id
      )
      RETURNING id INTO v_global_medicine_master_id;
    END IF;

    -- Step 2b. Find or create Store Inventory link
    SELECT id INTO v_store_inv_id
    FROM store_inventory
    WHERE store_id = v_store_id
      AND global_medicine_master_id = v_global_medicine_master_id
    LIMIT 1;

    IF v_store_inv_id IS NULL THEN
      INSERT INTO store_inventory (
        store_id, global_medicine_master_id, reorder_level, total_stock
      )
      VALUES (
        v_store_id,
        v_global_medicine_master_id,
        10,
        0
      )
      RETURNING id INTO v_store_inv_id;
    END IF;

    -- Step 2c. Insert purchase invoice item
    INSERT INTO purchase_invoice_items (
      store_id, invoice_id, store_inventory_id, medicine_name,
      batch_number, quantity, free_quantity, purchase_price,
      discount_percent, mrp, gst_percent, expiry_date, total_amount
    )
    VALUES (
      v_store_id,
      v_invoice.id,
      v_store_inv_id,
      v_item->>'medicineName',
      v_item->>'batchNumber',
      (v_item->>'quantity')::integer,
      COALESCE((v_item->>'freeQuantity')::integer, 0),
      (v_item->>'purchasePrice')::double precision,
      COALESCE((v_item->>'discountPercent')::double precision, 0),
      (v_item->>'mrp')::double precision,
      (v_item->>'gstPercent')::double precision,
      v_item->>'expiryDate',
      (v_item->>'totalAmount')::double precision
    );

    -- Step 2d. Upsert batch
    SELECT id INTO v_batch_id
    FROM store_inventory_batches
    WHERE store_id = v_store_id
      AND store_inventory_id = v_store_inv_id
      AND batch_number = v_item->>'batchNumber'
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      UPDATE store_inventory_batches
      SET quantity = quantity + (v_item->>'quantity')::integer
                              + COALESCE((v_item->>'freeQuantity')::integer, 0)
      WHERE id = v_batch_id AND store_id = v_store_id;
    ELSE
      INSERT INTO store_inventory_batches (
        store_id, store_inventory_id, batch_number, quantity,
        purchase_price, mrp, expiry_date, received_date
      )
      VALUES (
        v_store_id,
        v_store_inv_id,
        v_item->>'batchNumber',
        (v_item->>'quantity')::integer + COALESCE((v_item->>'freeQuantity')::integer, 0),
        (v_item->>'purchasePrice')::double precision,
        (v_item->>'mrp')::double precision,
        v_item->>'expiryDate',
        (purchase_data->>'invoiceDate')::date
      );
    END IF;
  END LOOP;

  RETURN to_jsonb(v_invoice);
END;
$$;

-- 5. Update save_sales_invoice
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
      store_id, sales_invoice_id, store_inventory_id, store_inventory_batch_id,
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

    UPDATE store_inventory_batches
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

-- 6. Update get_dashboard_stats
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
  FROM store_inventory_batches
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
