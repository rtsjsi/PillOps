-- ============================================================
-- Migration: Merge fuzzy-duplicate store_inventory rows
-- Same medicine under slightly different OCR names within a store.
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_medicine_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT REGEXP_REPLACE(LOWER(TRIM(COALESCE(p_name, ''))), '[^a-z0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION merge_store_inventory_row(
  p_winner_id uuid,
  p_loser_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_gmm_id uuid;
  v_loser_gmm_id  uuid;
  v_loser_batch   record;
  v_winner_batch_id uuid;
BEGIN
  IF p_winner_id = p_loser_id THEN
    RETURN;
  END IF;

  SELECT global_medicine_master_id INTO v_winner_gmm_id
  FROM store_inventory WHERE id = p_winner_id;

  SELECT global_medicine_master_id INTO v_loser_gmm_id
  FROM store_inventory WHERE id = p_loser_id;

  IF v_winner_gmm_id IS NULL OR v_loser_gmm_id IS NULL THEN
    RAISE EXCEPTION 'Winner or loser store_inventory row not found';
  END IF;

  -- Merge batches from loser into winner
  FOR v_loser_batch IN
    SELECT id, batch_number, quantity
    FROM store_inventory_batches
    WHERE store_inventory_id = p_loser_id
  LOOP
    SELECT id INTO v_winner_batch_id
    FROM store_inventory_batches
    WHERE store_inventory_id = p_winner_id
      AND batch_number = v_loser_batch.batch_number
    LIMIT 1;

    IF v_winner_batch_id IS NOT NULL THEN
      UPDATE sales_invoice_items
      SET store_inventory_batch_id = v_winner_batch_id
      WHERE store_inventory_batch_id = v_loser_batch.id;

      UPDATE inventory_adjustments
      SET batch_id = v_winner_batch_id
      WHERE batch_id = v_loser_batch.id;

      UPDATE store_inventory_batches
      SET quantity = quantity + v_loser_batch.quantity
      WHERE id = v_winner_batch_id;

      DELETE FROM store_inventory_batches WHERE id = v_loser_batch.id;
    ELSE
      UPDATE store_inventory_batches
      SET store_inventory_id = p_winner_id
      WHERE id = v_loser_batch.id;
    END IF;
  END LOOP;

  -- Repoint historical rows
  UPDATE purchase_invoice_items
  SET store_inventory_id = p_winner_id
  WHERE store_inventory_id = p_loser_id;

  UPDATE sales_invoice_items
  SET store_inventory_id = p_winner_id
  WHERE store_inventory_id = p_loser_id;

  UPDATE inventory_adjustments
  SET store_inventory_id = p_winner_id
  WHERE store_inventory_id = p_loser_id;

  -- Merge distributor OCR aliases onto the winner global master
  UPDATE distributor_medicine_aliases dma
  SET global_medicine_master_id = v_winner_gmm_id
  WHERE global_medicine_master_id = v_loser_gmm_id
    AND NOT EXISTS (
      SELECT 1
      FROM distributor_medicine_aliases existing
      WHERE existing.store_id = dma.store_id
        AND existing.distributor_name = dma.distributor_name
        AND existing.ocr_name = dma.ocr_name
        AND existing.global_medicine_master_id = v_winner_gmm_id
    );

  DELETE FROM distributor_medicine_aliases
  WHERE global_medicine_master_id = v_loser_gmm_id;

  -- Recalculate winner stock from batches (source of truth)
  UPDATE store_inventory
  SET total_stock = COALESCE((
    SELECT SUM(quantity)
    FROM store_inventory_batches
    WHERE store_inventory_id = p_winner_id
  ), 0)
  WHERE id = p_winner_id;

  DELETE FROM store_inventory WHERE id = p_loser_id;

  -- Drop orphan global masters left behind by the merge
  DELETE FROM global_medicine_master g
  WHERE g.id = v_loser_gmm_id
    AND NOT EXISTS (
      SELECT 1 FROM store_inventory si
      WHERE si.global_medicine_master_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM distributor_medicine_aliases dma
      WHERE dma.global_medicine_master_id = g.id
    );
END;
$$;

CREATE OR REPLACE FUNCTION merge_all_store_inventory_duplicates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group   record;
  v_row     record;
  v_winner_id uuid;
  v_merged  integer := 0;
  v_groups  integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  FOR v_group IN
    WITH inv AS (
      SELECT
        si.id,
        si.store_id,
        si.total_stock,
        si.created_at,
        g.name,
        normalize_medicine_name(g.name) AS norm_name
      FROM store_inventory si
      JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    ),
    dupe_groups AS (
      SELECT store_id, norm_name
      FROM inv
      GROUP BY store_id, norm_name
      HAVING COUNT(*) > 1
    )
    SELECT dg.store_id, dg.norm_name
    FROM dupe_groups dg
    ORDER BY dg.norm_name
  LOOP
    v_winner_id := NULL;
    v_groups := v_groups + 1;

    FOR v_row IN
      SELECT si.id, g.name, si.total_stock
      FROM store_inventory si
      JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
      WHERE si.store_id = v_group.store_id
        AND normalize_medicine_name(g.name) = v_group.norm_name
      ORDER BY
        si.total_stock DESC,
        length(REGEXP_REPLACE(g.name, '[^a-zA-Z0-9]', '', 'g')) ASC,
        si.created_at ASC,
        si.id ASC
    LOOP
      IF v_winner_id IS NULL THEN
        v_winner_id := v_row.id;
      ELSE
        PERFORM merge_store_inventory_row(v_winner_id, v_row.id);
        v_merged := v_merged + 1;
        v_details := v_details || jsonb_build_object(
          'norm_name', v_group.norm_name,
          'winner_name', (SELECT name FROM global_medicine_master g JOIN store_inventory si ON si.global_medicine_master_id = g.id WHERE si.id = v_winner_id),
          'merged_name', v_row.name,
          'loser_id', v_row.id
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'groups_processed', v_groups,
    'rows_merged', v_merged,
    'details', v_details
  );
END;
$$;

-- Run the one-time cleanup
SELECT merge_all_store_inventory_duplicates();
