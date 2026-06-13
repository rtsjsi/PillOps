-- ============================================================
-- Migration: Inventory Redesign
-- Renames tables to reflect physical inventory structure and
-- adds a calculated total_stock column to store_inventory.
-- ============================================================

-- 1. Rename foreign key columns in referencing tables
ALTER TABLE batches RENAME COLUMN medicine_id TO store_inventory_id;
ALTER TABLE purchase_items RENAME COLUMN medicine_id TO store_inventory_id;
ALTER TABLE purchase_items RENAME COLUMN purchase_id TO invoice_id;

-- 2. Rename tables
ALTER TABLE medicines RENAME TO store_inventory;
ALTER TABLE batches RENAME TO inventory_batches;
ALTER TABLE purchases RENAME TO purchase_invoices;
ALTER TABLE purchase_items RENAME TO purchase_invoice_items;


-- Rename global_medicine_master
ALTER TABLE global_medicines RENAME TO global_medicine_master;
ALTER TABLE store_inventory RENAME COLUMN global_medicine_id TO global_medicine_master_id;

-- 3. Add total_stock column to store_inventory
ALTER TABLE store_inventory ADD COLUMN total_stock integer DEFAULT 0 NOT NULL;

-- 4. Backfill total_stock using existing batches
UPDATE store_inventory si
SET total_stock = COALESCE((
  SELECT SUM(quantity)
  FROM inventory_batches b
  WHERE b.store_inventory_id = si.id
), 0);

-- 5. Create trigger function to auto-update total_stock
CREATE OR REPLACE FUNCTION update_store_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE store_inventory
    SET total_stock = total_stock + NEW.quantity
    WHERE id = NEW.store_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE store_inventory
    SET total_stock = total_stock - OLD.quantity + NEW.quantity
    WHERE id = NEW.store_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE store_inventory
    SET total_stock = total_stock - OLD.quantity
    WHERE id = OLD.store_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 6. Attach trigger
CREATE TRIGGER on_inventory_batch_change
AFTER INSERT OR UPDATE OF quantity OR DELETE ON inventory_batches
FOR EACH ROW
EXECUTE FUNCTION update_store_inventory_stock();

-- 7. Update RPC: save_purchase_invoice to use new table names
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
    FROM inventory_batches
    WHERE store_id = v_store_id
      AND store_inventory_id = v_store_inv_id
      AND batch_number = v_item->>'batchNumber'
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      UPDATE inventory_batches
      SET quantity = quantity + (v_item->>'quantity')::integer
                              + COALESCE((v_item->>'freeQuantity')::integer, 0)
      WHERE id = v_batch_id AND store_id = v_store_id;
    ELSE
      INSERT INTO inventory_batches (
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


-- 8. Update RPC: get_dashboard_stats to use new table names and the new total_stock column
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

  -- Today's sales
  SELECT COALESCE(sum(total), 0) INTO v_today_sales
  FROM invoices
  WHERE store_id = p_store_id
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  -- Low stock (optimised using total_stock column directly)
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
