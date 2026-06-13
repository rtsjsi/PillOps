-- ============================================================
-- Migration: Global Item Master
-- Creates the global_medicines table, migrates data,
-- links medicines, and updates the save_purchase_invoice RPC.
-- ============================================================

-- 1. Create global_medicines table
CREATE TABLE "global_medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"generic_name" varchar(255),
	"category" "medicine_category" NOT NULL,
	"manufacturer" varchar(255),
	"hsn_code" varchar(20),
	"schedule" "drug_schedule" DEFAULT 'OTC',
	"gst_percent" double precision DEFAULT 12,
	"created_by_store_id" uuid REFERENCES "stores"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Insert deduplicated medicines into global_medicines
INSERT INTO "global_medicines" (name, generic_name, category, manufacturer, hsn_code, schedule, gst_percent, created_by_store_id)
SELECT DISTINCT ON (name) name, generic_name, category, manufacturer, hsn_code, schedule, gst_percent, store_id
FROM "medicines";

-- 3. Add global_medicine_id to medicines
ALTER TABLE "medicines" ADD COLUMN "global_medicine_id" uuid;

-- 4. Link medicines to global_medicines based on name
UPDATE "medicines" m
SET global_medicine_id = g.id
FROM "global_medicines" g
WHERE m.name = g.name;

-- 5. Enforce foreign key and NOT NULL
ALTER TABLE "medicines" ALTER COLUMN "global_medicine_id" SET NOT NULL;
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_global_medicine_id_global_medicines_id_fk" FOREIGN KEY ("global_medicine_id") REFERENCES "public"."global_medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- 6. Drop redundant columns from medicines
ALTER TABLE "medicines" DROP COLUMN "name";
ALTER TABLE "medicines" DROP COLUMN "generic_name";
ALTER TABLE "medicines" DROP COLUMN "category";
ALTER TABLE "medicines" DROP COLUMN "manufacturer";
ALTER TABLE "medicines" DROP COLUMN "hsn_code";
ALTER TABLE "medicines" DROP COLUMN "schedule";
ALTER TABLE "medicines" DROP COLUMN "gst_percent";

-- 7. Update RPC: save_purchase_invoice
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
  v_purchase          purchases%ROWTYPE;
  v_item              jsonb;
  v_global_medicine_id uuid;
  v_medicine_id       uuid;
  v_batch_id          uuid;
  v_store_id          uuid;
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

  -- 2. For each item, find/create global medicine -> find/create store medicine -> insert purchase item -> upsert batch
  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Step 2a. Find or create Global Medicine
    SELECT id INTO v_global_medicine_id
    FROM global_medicines
    WHERE name = v_item->>'medicineName'
    LIMIT 1;

    IF v_global_medicine_id IS NULL THEN
      INSERT INTO global_medicines (
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
      RETURNING id INTO v_global_medicine_id;
    END IF;

    -- Step 2b. Find or create Store Medicine link
    SELECT id INTO v_medicine_id
    FROM medicines
    WHERE store_id = v_store_id
      AND global_medicine_id = v_global_medicine_id
    LIMIT 1;

    IF v_medicine_id IS NULL THEN
      INSERT INTO medicines (
        store_id, global_medicine_id, reorder_level
      )
      VALUES (
        v_store_id,
        v_global_medicine_id,
        10
      )
      RETURNING id INTO v_medicine_id;
    END IF;

    -- Step 2c. Insert purchase item
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

    -- Step 2d. Upsert batch
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
