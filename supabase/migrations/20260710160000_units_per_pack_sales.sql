-- Track inventory in saleable units (tablets/caps) so partial strip sales are supported.

ALTER TABLE global_medicine_master
  ADD COLUMN IF NOT EXISTS units_per_pack integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION parse_units_per_pack(
  p_pack_size text,
  p_category text,
  p_name text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
  v_match text[];
  v_a integer;
  v_b integer;
BEGIN
  IF p_category IS NOT NULL AND p_category IN ('Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler') THEN
    RETURN 1;
  END IF;

  v_text := UPPER(COALESCE(p_pack_size, '') || ' ' || COALESCE(p_name, ''));

  v_match := regexp_match(v_text, '\y(\d+)\s*[*X×]\s*(\d+)\y');
  IF v_match IS NOT NULL THEN
    v_a := v_match[1]::integer;
    v_b := v_match[2]::integer;
    IF v_b = 1 AND v_a > 1 THEN RETURN v_a; END IF;
    IF v_a = 1 AND v_b > 1 THEN RETURN v_b; END IF;
    IF v_a > 1 AND v_b > 1 THEN RETURN v_a * v_b; END IF;
  END IF;

  v_match := regexp_match(v_text, '\y(\d+)\s*(?:TAB|CAP|T)S?\y');
  IF v_match IS NOT NULL AND v_match[1]::integer > 1 THEN
    RETURN v_match[1]::integer;
  END IF;

  v_match := regexp_match(v_text, '\y(\d+)\s*''?S\y');
  IF v_match IS NOT NULL AND v_match[1]::integer > 1 THEN
    RETURN v_match[1]::integer;
  END IF;

  v_match := regexp_match(v_text, '\y1\s*[*X×]\s*(\d+)\y');
  IF v_match IS NOT NULL THEN
    RETURN v_match[1]::integer;
  END IF;

  RETURN 1;
END;
$$;

-- Backfill units_per_pack from pack_size / medicine name
UPDATE global_medicine_master g
SET units_per_pack = parse_units_per_pack(g.pack_size, g.category::text, g.name)
WHERE units_per_pack = 1;

-- Convert existing batch stock from packs/strips to saleable units
UPDATE store_inventory_batches b
SET
  quantity = b.quantity * g.units_per_pack,
  mrp = ROUND((b.mrp / g.units_per_pack)::numeric, 2),
  purchase_price = ROUND((b.purchase_price / g.units_per_pack)::numeric, 2)
FROM store_inventory si
JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
WHERE b.store_inventory_id = si.id
  AND g.units_per_pack > 1;

UPDATE store_inventory si
SET total_stock = COALESCE((
  SELECT SUM(b.quantity)
  FROM store_inventory_batches b
  WHERE b.store_inventory_id = si.id
), 0);

CREATE OR REPLACE FUNCTION refresh_medicine_units_per_pack(p_global_medicine_master_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_units integer;
BEGIN
  SELECT parse_units_per_pack(g.pack_size, g.category::text, g.name)
  INTO v_units
  FROM global_medicine_master g
  WHERE g.id = p_global_medicine_master_id;

  v_units := COALESCE(v_units, 1);

  UPDATE global_medicine_master
  SET units_per_pack = v_units
  WHERE id = p_global_medicine_master_id;

  RETURN v_units;
END;
$$;

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
  v_old_item          purchase_invoice_items%ROWTYPE;
  v_global_medicine_master_id uuid;
  v_store_inv_id      uuid;
  v_batch_id          uuid;
  v_store_id          uuid;
  v_status            varchar(20);
  v_old_status        varchar(20);
  v_existing_id       uuid;
  v_invoice_id        uuid;
  v_medicine_name     text;
  v_norm_name         text;
  v_units_per_pack    integer;
  v_stock_units       integer;
  v_unit_mrp          double precision;
  v_unit_purchase     double precision;
BEGIN
  v_store_id := (purchase_data->>'storeId')::uuid;
  v_status := COALESCE(purchase_data->>'status', 'completed');
  v_invoice_id := (purchase_data->>'id')::uuid;

  IF v_status = 'completed' AND purchase_data->>'invoiceNumber' IS NOT NULL AND purchase_data->>'distributorName' IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM purchase_invoices
    WHERE store_id = v_store_id
      AND normalized_invoice_number = REGEXP_REPLACE(LOWER(purchase_data->>'invoiceNumber'), '[^a-z0-9]', '', 'g')
      AND normalized_distributor_name = REGEXP_REPLACE(LOWER(purchase_data->>'distributorName'), '[^a-z0-9]', '', 'g')
      AND invoice_date = (purchase_data->>'invoiceDate')::date
      AND status = 'completed'
      AND (v_invoice_id IS NULL OR id != v_invoice_id)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_INVOICE: Invoice #% from % dated % already exists in your completed purchases. If this is a different invoice, please verify the invoice number.',
        purchase_data->>'invoiceNumber',
        purchase_data->>'distributorName',
        purchase_data->>'invoiceDate';
    END IF;
  END IF;

  INSERT INTO distributors (store_id, name)
  VALUES (v_store_id, purchase_data->>'distributorName')
  ON CONFLICT (store_id, name) DO NOTHING;

  IF v_invoice_id IS NOT NULL THEN
    SELECT status INTO v_old_status
    FROM purchase_invoices
    WHERE id = v_invoice_id AND store_id = v_store_id;

    IF v_old_status = 'completed' THEN
      FOR v_old_item IN
        SELECT * FROM purchase_invoice_items WHERE invoice_id = v_invoice_id
      LOOP
        SELECT COALESCE(g.units_per_pack, 1)
        INTO v_units_per_pack
        FROM store_inventory si
        JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
        WHERE si.id = v_old_item.store_inventory_id;

        v_stock_units := (v_old_item.quantity + COALESCE(v_old_item.free_quantity, 0)) * COALESCE(v_units_per_pack, 1);

        UPDATE store_inventory_batches
        SET quantity = GREATEST(0, quantity - v_stock_units)
        WHERE store_id = v_store_id
          AND store_inventory_id = v_old_item.store_inventory_id
          AND batch_number = v_old_item.batch_number;
      END LOOP;
    END IF;

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_medicine_name := v_item->>'medicineName';
    v_norm_name := normalize_medicine_name(v_medicine_name);
    v_global_medicine_master_id := NULL;
    v_store_inv_id := NULL;

    IF v_item->>'manufacturer' IS NOT NULL AND v_item->>'manufacturer' <> '' THEN
      INSERT INTO manufacturers (name)
      VALUES (v_item->>'manufacturer')
      ON CONFLICT (name) DO NOTHING;
    END IF;

    SELECT si.id, si.global_medicine_master_id
    INTO v_store_inv_id, v_global_medicine_master_id
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = v_store_id
      AND normalize_medicine_name(g.name) = v_norm_name
    ORDER BY si.total_stock DESC, si.created_at ASC, si.id ASC
    LIMIT 1;

    IF v_global_medicine_master_id IS NULL
       AND v_item->>'extractedName' IS NOT NULL
       AND v_item->>'extractedName' <> '' THEN
      SELECT dma.global_medicine_master_id
      INTO v_global_medicine_master_id
      FROM distributor_medicine_aliases dma
      WHERE dma.store_id = v_store_id
        AND dma.distributor_name = purchase_data->>'distributorName'
        AND dma.ocr_name = v_item->>'extractedName'
      LIMIT 1;
    END IF;

    IF v_global_medicine_master_id IS NULL THEN
      SELECT id
      INTO v_global_medicine_master_id
      FROM global_medicine_master
      WHERE normalize_medicine_name(name) = v_norm_name
      ORDER BY
        (name = v_medicine_name) DESC,
        created_at ASC,
        id ASC
      LIMIT 1;
    END IF;

    IF v_global_medicine_master_id IS NULL THEN
      v_units_per_pack := parse_units_per_pack(
        NULL,
        COALESCE(v_item->>'category', 'Tablet'),
        v_medicine_name
      );

      INSERT INTO global_medicine_master (
        name, generic_name, category, manufacturer, hsn_code, created_by_store_id, units_per_pack
      )
      VALUES (
        v_medicine_name,
        '',
        COALESCE(NULLIF(v_item->>'category', ''), 'Tablet')::medicine_category,
        COALESCE(v_item->>'manufacturer', ''),
        COALESCE(v_item->>'hsnCode', ''),
        v_store_id,
        v_units_per_pack
      )
      RETURNING id INTO v_global_medicine_master_id;
    ELSE
      v_units_per_pack := refresh_medicine_units_per_pack(v_global_medicine_master_id);
    END IF;

    IF v_item->>'extractedName' IS NOT NULL AND v_item->>'extractedName' <> '' THEN
      INSERT INTO distributor_medicine_aliases (
        store_id, distributor_name, ocr_name, global_medicine_master_id
      )
      VALUES (
        v_store_id,
        purchase_data->>'distributorName',
        v_item->>'extractedName',
        v_global_medicine_master_id
      )
      ON CONFLICT ON CONSTRAINT uq_distributor_alias
      DO UPDATE SET global_medicine_master_id = EXCLUDED.global_medicine_master_id;
    END IF;

    IF v_store_inv_id IS NULL THEN
      SELECT id
      INTO v_store_inv_id
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
    END IF;

    v_units_per_pack := COALESCE(v_units_per_pack, refresh_medicine_units_per_pack(v_global_medicine_master_id), 1);
    v_stock_units := ((v_item->>'quantity')::integer + COALESCE((v_item->>'freeQuantity')::integer, 0)) * v_units_per_pack;
    v_unit_mrp := (v_item->>'mrp')::double precision / NULLIF(v_units_per_pack, 0);
    v_unit_purchase := (v_item->>'purchasePrice')::double precision / NULLIF(v_units_per_pack, 0);

    INSERT INTO purchase_invoice_items (
      store_id, invoice_id, store_inventory_id, medicine_name,
      batch_number, quantity, free_quantity, purchase_price,
      discount_percent, mrp, gst_percent, expiry_date, total_amount
    )
    VALUES (
      v_store_id,
      v_invoice.id,
      v_store_inv_id,
      v_medicine_name,
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

    IF v_status = 'completed' THEN
      SELECT id INTO v_batch_id
      FROM store_inventory_batches
      WHERE store_id = v_store_id
        AND store_inventory_id = v_store_inv_id
        AND batch_number = v_item->>'batchNumber'
      LIMIT 1;

      IF v_batch_id IS NOT NULL THEN
        UPDATE store_inventory_batches
        SET quantity = quantity + v_stock_units,
            mrp = v_unit_mrp,
            purchase_price = v_unit_purchase
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
          v_stock_units,
          v_unit_purchase,
          v_unit_mrp,
          v_item->>'expiryDate',
          (purchase_data->>'invoiceDate')::date
        );
      END IF;
    END IF;
  END LOOP;

  RETURN to_jsonb(v_invoice);
END;
$$;

CREATE OR REPLACE FUNCTION save_inventory_adjustment(
  adjustment_data jsonb,
  items         jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item              jsonb;
  v_global_medicine_master_id uuid;
  v_store_inv_id      uuid;
  v_batch_id          uuid;
  v_store_id          uuid;
  v_type              text;
  v_reason            text;
  v_count             integer := 0;
  v_units_per_pack    integer;
  v_stock_units       integer;
BEGIN
  v_store_id := (adjustment_data->>'storeId')::uuid;
  v_type := COALESCE(adjustment_data->>'type', 'IN');
  v_reason := COALESCE(adjustment_data->>'reason', 'Miscellaneous Adjustment');

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    SELECT id INTO v_global_medicine_master_id
    FROM global_medicine_master
    WHERE normalize_medicine_name(name) = normalize_medicine_name(v_item->>'medicineName')
    ORDER BY (name = v_item->>'medicineName') DESC, created_at ASC
    LIMIT 1;

    IF v_global_medicine_master_id IS NULL THEN
      v_units_per_pack := parse_units_per_pack(NULL, 'Tablet', v_item->>'medicineName');

      INSERT INTO global_medicine_master (
        name, generic_name, category, manufacturer, hsn_code, created_by_store_id, units_per_pack
      )
      VALUES (
        v_item->>'medicineName',
        '',
        'Tablet',
        COALESCE(v_item->>'manufacturer', ''),
        COALESCE(v_item->>'hsnCode', ''),
        v_store_id,
        v_units_per_pack
      )
      RETURNING id INTO v_global_medicine_master_id;
    ELSE
      v_units_per_pack := refresh_medicine_units_per_pack(v_global_medicine_master_id);
    END IF;

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

    v_stock_units := (v_item->>'quantity')::integer;

    SELECT id INTO v_batch_id
    FROM store_inventory_batches
    WHERE store_id = v_store_id
      AND store_inventory_id = v_store_inv_id
      AND batch_number = v_item->>'batchNumber'
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      IF v_type = 'IN' THEN
        UPDATE store_inventory_batches
        SET quantity = quantity + v_stock_units
        WHERE id = v_batch_id AND store_id = v_store_id;
      ELSE
        UPDATE store_inventory_batches
        SET quantity = quantity - v_stock_units
        WHERE id = v_batch_id AND store_id = v_store_id;
      END IF;
    ELSE
      INSERT INTO store_inventory_batches (
        store_id, store_inventory_id, batch_number, quantity,
        purchase_price, mrp, expiry_date, received_date
      )
      VALUES (
        v_store_id,
        v_store_inv_id,
        v_item->>'batchNumber',
        v_stock_units,
        COALESCE((v_item->>'purchasePrice')::double precision, 0),
        COALESCE((v_item->>'mrp')::double precision, 0),
        v_item->>'expiryDate',
        CURRENT_DATE
      )
      RETURNING id INTO v_batch_id;
    END IF;

    INSERT INTO inventory_adjustments (
      store_id, type, reason, store_inventory_id, batch_id, quantity
    )
    VALUES (
      v_store_id,
      v_type,
      v_reason,
      v_store_inv_id,
      v_batch_id,
      v_stock_units
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'itemsProcessed', v_count);
END;
$$;
