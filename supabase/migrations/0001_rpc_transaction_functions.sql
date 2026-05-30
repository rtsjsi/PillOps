-- ============================================================
-- RPC: create_invoice
-- Atomically creates a sales invoice, its line items, and
-- decrements the corresponding batch quantities, and
-- increments the store's last_invoice_number.
-- Called via supabase.rpc('create_invoice', { invoice_data, items })
-- ============================================================
CREATE OR REPLACE FUNCTION create_invoice(
  invoice_data jsonb,
  items        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as DB owner, bypasses RLS for atomicity
SET search_path = public
AS $$
DECLARE
  v_invoice   invoices%ROWTYPE;
  v_item      jsonb;
BEGIN
  -- 1. Insert invoice
  INSERT INTO invoices (
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
    INSERT INTO invoice_items (
      store_id, invoice_id, medicine_id, batch_id,
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

    UPDATE batches
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

-- ============================================================
-- RPC: save_purchase_invoice
-- Atomically creates a purchase record, upserts medicines,
-- inserts purchase items, and upserts batch quantities.
-- Called via supabase.rpc('save_purchase_invoice', { purchase_data, items })
-- ============================================================
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
  v_purchase      purchases%ROWTYPE;
  v_item          jsonb;
  v_medicine_id   uuid;
  v_batch_id      uuid;
  v_store_id      uuid;
BEGIN
  v_store_id := (purchase_data->>'storeId')::uuid;

  -- 1. Insert purchase header
  INSERT INTO purchases (
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
  RETURNING * INTO v_purchase;

  -- 2. For each item, upsert medicine + insert purchase item + upsert batch
  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Find or create medicine
    SELECT id INTO v_medicine_id
    FROM medicines
    WHERE store_id = v_store_id
      AND name = v_item->>'medicineName'
    LIMIT 1;

    IF v_medicine_id IS NULL THEN
      INSERT INTO medicines (
        store_id, name, generic_name, category, manufacturer, hsn_code
      )
      VALUES (
        v_store_id,
        v_item->>'medicineName',
        '',
        'Tablet',
        COALESCE(v_item->>'manufacturer', ''),
        COALESCE(v_item->>'hsnCode', '')
      )
      RETURNING id INTO v_medicine_id;
    END IF;

    -- Insert purchase item
    INSERT INTO purchase_items (
      store_id, purchase_id, medicine_id, medicine_name,
      batch_number, quantity, free_quantity, purchase_price,
      discount_percent, mrp, gst_percent, expiry_date, total_amount
    )
    VALUES (
      v_store_id,
      v_purchase.id,
      v_medicine_id,
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

    -- Upsert batch
    SELECT id INTO v_batch_id
    FROM batches
    WHERE store_id = v_store_id
      AND medicine_id = v_medicine_id
      AND batch_number = v_item->>'batchNumber'
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      UPDATE batches
      SET quantity = quantity + (v_item->>'quantity')::integer
                              + COALESCE((v_item->>'freeQuantity')::integer, 0)
      WHERE id = v_batch_id AND store_id = v_store_id;
    ELSE
      INSERT INTO batches (
        store_id, medicine_id, batch_number, quantity,
        purchase_price, mrp, expiry_date, received_date
      )
      VALUES (
        v_store_id,
        v_medicine_id,
        v_item->>'batchNumber',
        (v_item->>'quantity')::integer + COALESCE((v_item->>'freeQuantity')::integer, 0),
        (v_item->>'purchasePrice')::double precision,
        (v_item->>'mrp')::double precision,
        v_item->>'expiryDate',
        (purchase_data->>'invoiceDate')::date
      );
    END IF;
  END LOOP;

  RETURN to_jsonb(v_purchase);
END;
$$;
