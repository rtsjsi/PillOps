-- Migration for dynamic masters and draft status

CREATE TABLE IF NOT EXISTS "distributors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("store_id", "name")
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "phone" varchar(20),
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("store_id", "name")
);

CREATE TABLE IF NOT EXISTS "manufacturers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Seed manufacturers
INSERT INTO "manufacturers" (name)
SELECT DISTINCT manufacturer FROM global_medicine_master WHERE manufacturer IS NOT NULL AND manufacturer <> '' ON CONFLICT (name) DO NOTHING;

-- Seed distributors
INSERT INTO "distributors" (store_id, name)
SELECT DISTINCT store_id, distributor_name FROM purchase_invoices WHERE distributor_name IS NOT NULL AND distributor_name <> '' ON CONFLICT (store_id, name) DO NOTHING;

-- Seed customers
INSERT INTO "customers" (store_id, name)
SELECT DISTINCT store_id, customer_name FROM sales_invoices WHERE customer_name IS NOT NULL AND customer_name <> '' ON CONFLICT (store_id, name) DO NOTHING;

-- Add status to purchase_invoices
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'completed' NOT NULL;

-- Update RPC save_purchase_invoice
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
BEGIN
  v_store_id := (purchase_data->>'storeId')::uuid;
  v_status := COALESCE(purchase_data->>'status', 'completed');

  -- Ensure Distributor exists
  INSERT INTO distributors (store_id, name)
  VALUES (v_store_id, purchase_data->>'distributorName')
  ON CONFLICT (store_id, name) DO NOTHING;

  -- 1. Upsert purchase invoice
  IF purchase_data->>'id' IS NOT NULL THEN
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
    WHERE id = (purchase_data->>'id')::uuid AND store_id = v_store_id
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
    END IF;
  END LOOP;

  RETURN to_jsonb(v_invoice);
END;
$$;
