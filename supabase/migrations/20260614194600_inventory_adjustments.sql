-- Table: inventory_adjustments
CREATE TABLE inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  type text NOT NULL CHECK (type IN ('IN', 'OUT')),
  reason text NOT NULL,
  store_inventory_id uuid NOT NULL REFERENCES store_inventory(id),
  batch_id uuid REFERENCES store_inventory_batches(id),
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores can view their own inventory_adjustments"
  ON inventory_adjustments FOR SELECT
  USING (store_id = auth.uid());

CREATE POLICY "Stores can insert their own inventory_adjustments"
  ON inventory_adjustments FOR INSERT
  WITH CHECK (store_id = auth.uid());

-- RPC: save_inventory_adjustment
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
BEGIN
  v_store_id := (adjustment_data->>'storeId')::uuid;
  v_type := COALESCE(adjustment_data->>'type', 'IN');
  v_reason := COALESCE(adjustment_data->>'reason', 'Miscellaneous Adjustment');

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Step 1. Find or create Global Medicine
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

    -- Step 2. Find or create Store Inventory link
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

    -- Step 3. Upsert batch
    SELECT id INTO v_batch_id
    FROM store_inventory_batches
    WHERE store_id = v_store_id
      AND store_inventory_id = v_store_inv_id
      AND batch_number = v_item->>'batchNumber'
    LIMIT 1;

    IF v_batch_id IS NOT NULL THEN
      IF v_type = 'IN' THEN
        UPDATE store_inventory_batches
        SET quantity = quantity + (v_item->>'quantity')::integer
        WHERE id = v_batch_id AND store_id = v_store_id;
      ELSE
        UPDATE store_inventory_batches
        SET quantity = quantity - (v_item->>'quantity')::integer
        WHERE id = v_batch_id AND store_id = v_store_id;
      END IF;
    ELSE
      -- Batch doesn't exist, create it (only logical for 'IN')
      INSERT INTO store_inventory_batches (
        store_id, store_inventory_id, batch_number, quantity,
        purchase_price, mrp, expiry_date, received_date
      )
      VALUES (
        v_store_id,
        v_store_inv_id,
        v_item->>'batchNumber',
        (v_item->>'quantity')::integer,
        COALESCE((v_item->>'purchasePrice')::double precision, 0),
        COALESCE((v_item->>'mrp')::double precision, 0),
        v_item->>'expiryDate',
        CURRENT_DATE
      )
      RETURNING id INTO v_batch_id;
    END IF;

    -- Step 4. Log the adjustment
    INSERT INTO inventory_adjustments (
      store_id, type, reason, store_inventory_id, batch_id, quantity
    )
    VALUES (
      v_store_id,
      v_type,
      v_reason,
      v_store_inv_id,
      v_batch_id,
      (v_item->>'quantity')::integer
    );
    
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'itemsProcessed', v_count);
END;
$$;
