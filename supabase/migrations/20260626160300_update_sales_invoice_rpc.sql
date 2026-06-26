CREATE OR REPLACE FUNCTION update_sales_invoice(
  p_invoice_id uuid,
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
  v_old_item  RECORD;
  v_store_id  uuid;
BEGIN
  v_store_id := (invoice_data->>'storeId')::uuid;

  -- 1. Revert previous inventory changes
  FOR v_old_item IN SELECT store_inventory_batch_id, quantity FROM sales_invoice_items WHERE sales_invoice_id = p_invoice_id
  LOOP
    UPDATE store_inventory_batches
    SET quantity = quantity + v_old_item.quantity
    WHERE id = v_old_item.store_inventory_batch_id
      AND store_id = v_store_id;
  END LOOP;

  -- 2. Delete old items
  DELETE FROM sales_invoice_items WHERE sales_invoice_id = p_invoice_id;

  -- 3. Update invoice details
  UPDATE sales_invoices
  SET
    customer_name = invoice_data->>'customerName',
    customer_phone = invoice_data->>'customerPhone',
    doctor_name = invoice_data->>'doctorName',
    area = invoice_data->>'area',
    subtotal = (invoice_data->>'subtotal')::double precision,
    gst_amount = (invoice_data->>'gstAmount')::double precision,
    discount_percent = COALESCE((invoice_data->>'discountPercent')::double precision, 0),
    discount_amount = COALESCE((invoice_data->>'discountAmount')::double precision, 0),
    total = (invoice_data->>'total')::double precision,
    updated_at = NOW()
  WHERE id = p_invoice_id AND store_id = v_store_id
  RETURNING * INTO v_invoice;

  -- 4. Insert new line items and decrement batch quantities
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

  RETURN to_jsonb(v_invoice);
END;
$$;
