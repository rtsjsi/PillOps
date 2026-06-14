-- ============================================================
-- Migration: Add Doctor Name and Area to Sales Invoices
-- ============================================================

-- 1. Add fields to sales_invoices
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS doctor_name varchar(255);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS area varchar(255);

-- 2. Update save_sales_invoice RPC
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
    doctor_name, area,
    subtotal, gst_amount, discount_percent, discount_amount, total
  )
  VALUES (
    (invoice_data->>'storeId')::uuid,
    invoice_data->>'invoiceNumber',
    invoice_data->>'customerName',
    invoice_data->>'customerPhone',
    invoice_data->>'doctorName',
    invoice_data->>'area',
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
