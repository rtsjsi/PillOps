-- ============================================================
-- Migration: Duplicate Invoice Guard
-- 
-- Adds DB-level enforcement to prevent duplicate purchase invoices.
-- Uses normalized generated columns + partial unique index
-- so that variations in casing/spacing/punctuation don't bypass the check.
-- ============================================================

-- 1. Add normalized generated columns for fuzzy-safe matching
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS normalized_invoice_number TEXT
    GENERATED ALWAYS AS (REGEXP_REPLACE(LOWER(invoice_number), '[^a-z0-9]', '', 'g')) STORED;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS normalized_distributor_name TEXT
    GENERATED ALWAYS AS (REGEXP_REPLACE(LOWER(distributor_name), '[^a-z0-9]', '', 'g')) STORED;

-- 2. Create a partial unique index for COMPLETED invoices only (drafts can overlap)
--    Includes invoice_date per user requirement
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_invoice_completed
  ON purchase_invoices (store_id, normalized_invoice_number, normalized_distributor_name, invoice_date)
  WHERE status = 'completed';

-- 3. Update the save_purchase_invoice RPC to check for duplicates before inserting
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
  v_status            varchar(20);
  v_existing_id       uuid;
  v_invoice_id        uuid;
BEGIN
  v_store_id := (purchase_data->>'storeId')::uuid;
  v_status := COALESCE(purchase_data->>'status', 'completed');
  v_invoice_id := (purchase_data->>'id')::uuid;

  -- ─── Duplicate Guard (only for completed invoices, not drafts) ───
  IF v_status = 'completed' AND purchase_data->>'invoiceNumber' IS NOT NULL AND purchase_data->>'distributorName' IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM purchase_invoices
    WHERE store_id = v_store_id
      AND normalized_invoice_number = REGEXP_REPLACE(LOWER(purchase_data->>'invoiceNumber'), '[^a-z0-9]', '', 'g')
      AND normalized_distributor_name = REGEXP_REPLACE(LOWER(purchase_data->>'distributorName'), '[^a-z0-9]', '', 'g')
      AND invoice_date = (purchase_data->>'invoiceDate')::date
      AND status = 'completed'
      AND (v_invoice_id IS NULL OR id != v_invoice_id)  -- Allow updating the same invoice
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_INVOICE: Invoice #% from % dated % already exists in your completed purchases. If this is a different invoice, please verify the invoice number.',
        purchase_data->>'invoiceNumber',
        purchase_data->>'distributorName',
        purchase_data->>'invoiceDate';
    END IF;
  END IF;

  -- Ensure Distributor exists
  INSERT INTO distributors (store_id, name)
  VALUES (v_store_id, purchase_data->>'distributorName')
  ON CONFLICT (store_id, name) DO NOTHING;

  -- 1. Upsert purchase invoice
  IF v_invoice_id IS NOT NULL THEN
    UPDATE purchase_invoices
    SET
      distributor_name = purchase_data->>'distributorName',
      invoice_number = purchase_data->>'invoiceNumber',
      invoice_date = (purchase_data->>'invoiceDate')::date,
      subtotal = (purchase_data->>'subtotal')::double precision,
      discount_amount = COALESCE((purchase_data->>'discountAmount')::double precision, 0),
      gst_amount = (purchase_data->>'gstAmount')::double precision,
      total = (purchase_data->>'total')::double precision,
      status = v_status
    WHERE id = v_invoice_id AND store_id = v_store_id
    RETURNING * INTO v_invoice;

    -- Delete old items to replace them
    DELETE FROM purchase_invoice_items WHERE invoice_id = v_invoice.id;
  ELSE
    INSERT INTO purchase_invoices (
      store_id, distributor_name, invoice_number, invoice_date,
      subtotal, discount_amount, gst_amount, total, status
    )
    VALUES (
      v_store_id,
      purchase_data->>'distributorName',
      purchase_data->>'invoiceNumber',
      (purchase_data->>'invoiceDate')::date,
      (purchase_data->>'subtotal')::double precision,
      COALESCE((purchase_data->>'discountAmount')::double precision, 0),
      (purchase_data->>'gstAmount')::double precision,
      (purchase_data->>'total')::double precision,
      v_status
    )
    RETURNING * INTO v_invoice;
  END IF;

  -- 2. Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Ensure Manufacturer exists
    IF v_item->>'manufacturer' IS NOT NULL AND v_item->>'manufacturer' <> '' THEN
      INSERT INTO manufacturers (name)
      VALUES (v_item->>'manufacturer')
      ON CONFLICT (name) DO NOTHING;
    END IF;

    -- Find Global Medicine (must exist based on new requirements, but we keep this as fallback)
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

    -- Find or create Store Inventory link
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

    -- Insert purchase invoice item
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

    -- Upsert batch ONLY if completed
    IF v_status = 'completed' THEN
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
    END IF;
  END LOOP;

  RETURN to_jsonb(v_invoice);
END;
$$;
