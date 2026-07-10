-- Paginated inventory RPCs (runs on Postgres, not Cloudflare Workers).

CREATE OR REPLACE FUNCTION batch_expiry_days(p_expiry_date text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_expiry_date IS NULL OR length(p_expiry_date) < 7 THEN 0
    ELSE (
      (date_trunc('month', to_date(p_expiry_date || '-01', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day')::date
      - CURRENT_DATE
    )::integer
  END
$$;

CREATE OR REPLACE FUNCTION medicine_worst_expiry_status(p_store_inventory_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM store_inventory_batches b
      WHERE b.store_inventory_id = p_store_inventory_id AND b.quantity > 0
    ) THEN 'ok'
    WHEN EXISTS (
      SELECT 1 FROM store_inventory_batches b
      WHERE b.store_inventory_id = p_store_inventory_id AND b.quantity > 0
        AND batch_expiry_days(b.expiry_date) < 0
    ) THEN 'expired'
    WHEN EXISTS (
      SELECT 1 FROM store_inventory_batches b
      WHERE b.store_inventory_id = p_store_inventory_id AND b.quantity > 0
        AND batch_expiry_days(b.expiry_date) <= 7
    ) THEN 'critical'
    WHEN EXISTS (
      SELECT 1 FROM store_inventory_batches b
      WHERE b.store_inventory_id = p_store_inventory_id AND b.quantity > 0
        AND batch_expiry_days(b.expiry_date) <= 30
    ) THEN 'warning'
    ELSE 'ok'
  END
$$;

CREATE OR REPLACE FUNCTION get_inventory_summary(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer;
  v_critical integer;
  v_warning integer;
  v_low_stock integer;
  v_total integer;
  v_categories jsonb;
BEGIN
  IF NOT (p_store_id = public.user_store_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total
  FROM store_inventory si
  WHERE si.store_id = p_store_id;

  SELECT
    count(*) FILTER (WHERE medicine_worst_expiry_status(si.id) = 'expired'),
    count(*) FILTER (WHERE medicine_worst_expiry_status(si.id) = 'critical'),
    count(*) FILTER (WHERE medicine_worst_expiry_status(si.id) = 'warning')
  INTO v_expired, v_critical, v_warning
  FROM store_inventory si
  WHERE si.store_id = p_store_id;

  SELECT count(*) INTO v_low_stock
  FROM store_inventory si
  WHERE si.store_id = p_store_id
    AND si.reorder_level > 0
    AND si.total_stock <= si.reorder_level;

  SELECT COALESCE(jsonb_agg(cat ORDER BY cat), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT DISTINCT g.category AS cat
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = p_store_id
      AND g.category IS NOT NULL
      AND g.category <> ''
  ) cats;

  RETURN jsonb_build_object(
    'totalMedicines', v_total,
    'expired', v_expired,
    'critical', v_critical,
    'warning', v_warning,
    'lowStock', v_low_stock,
    'categories', v_categories
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_inventory_list(
  p_store_id uuid,
  p_search text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_expiry_filter text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_items jsonb;
BEGIN
  IF NOT (p_store_id = public.user_store_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total
  FROM store_inventory si
  JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
  WHERE si.store_id = p_store_id
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR g.name ILIKE '%' || p_search || '%'
      OR g.generic_name ILIKE '%' || p_search || '%'
    )
    AND (
      p_category IS NULL OR p_category = 'All' OR g.category = p_category
    )
    AND (
      p_expiry_filter IS NULL OR p_expiry_filter = ''
      OR medicine_worst_expiry_status(si.id) = p_expiry_filter
    );

  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.sort_priority, sub.name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      si.id,
      g.name,
      g.generic_name AS "genericName",
      g.category,
      si.total_stock AS "totalStock",
      si.reorder_level AS "reorderLevel",
      si.rack,
      medicine_worst_expiry_status(si.id) AS "overallExpiryStatus",
      CASE medicine_worst_expiry_status(si.id)
        WHEN 'expired' THEN 0
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        ELSE 3
      END AS sort_priority,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'batchNumber', b.batch_number,
            'expiryDate', b.expiry_date,
            'quantity', b.quantity
          )
          ORDER BY b.expiry_date
        )
        FROM store_inventory_batches b
        WHERE b.store_inventory_id = si.id AND b.quantity > 0
      ), '[]'::jsonb) AS batches
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = p_store_id
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR g.name ILIKE '%' || p_search || '%'
        OR g.generic_name ILIKE '%' || p_search || '%'
      )
      AND (
        p_category IS NULL OR p_category = 'All' OR g.category = p_category
      )
      AND (
        p_expiry_filter IS NULL OR p_expiry_filter = ''
        OR medicine_worst_expiry_status(si.id) = p_expiry_filter
      )
    ORDER BY sort_priority, g.name
    OFFSET GREATEST(p_offset, 0)
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  ) sub;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION get_expiring_batches(
  p_store_id uuid,
  p_max_days integer DEFAULT 180
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (p_store_id = public.user_store_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub."daysLeft")
    FROM (
      SELECT
        b.id AS "batchId",
        si.id AS "medicineId",
        g.name AS "medicineName",
        si.rack,
        g.category,
        b.batch_number AS "batchNumber",
        b.expiry_date AS "expiryDate",
        b.quantity,
        b.purchase_price AS "purchasePrice",
        b.mrp,
        batch_expiry_days(b.expiry_date) AS "daysLeft",
        CASE
          WHEN batch_expiry_days(b.expiry_date) < 0 THEN 'expired'
          WHEN batch_expiry_days(b.expiry_date) <= 7 THEN 'critical'
          WHEN batch_expiry_days(b.expiry_date) <= 30 THEN 'warning'
          ELSE 'ok'
        END AS urgency,
        (b.quantity * COALESCE(b.purchase_price, 0))::double precision AS "valueAtRisk"
      FROM store_inventory_batches b
      JOIN store_inventory si ON si.id = b.store_inventory_id
      JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
      WHERE b.store_id = p_store_id
        AND b.quantity > 0
        AND batch_expiry_days(b.expiry_date) <= p_max_days
      ORDER BY batch_expiry_days(b.expiry_date)
    ) sub
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION get_inventory_report(
  p_store_id uuid,
  p_search text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_total_value double precision;
  v_items jsonb;
BEGIN
  IF NOT (p_store_id = public.user_store_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    count(*),
    COALESCE(sum(stock_value), 0)
  INTO v_total, v_total_value
  FROM (
    SELECT
      si.id,
      COALESCE((
        SELECT sum(b.quantity * COALESCE(b.purchase_price, 0))
        FROM store_inventory_batches b
        WHERE b.store_inventory_id = si.id AND b.quantity > 0
      ), 0) AS stock_value
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = p_store_id
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR g.name ILIKE '%' || p_search || '%'
        OR g.generic_name ILIKE '%' || p_search || '%'
      )
  ) counted;

  SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      si.id,
      g.name,
      g.category,
      si.total_stock AS "totalStock",
      si.reorder_level AS "reorderLevel",
      COALESCE((
        SELECT sum(b.quantity * COALESCE(b.purchase_price, 0))
        FROM store_inventory_batches b
        WHERE b.store_inventory_id = si.id AND b.quantity > 0
      ), 0)::double precision AS "stockValue",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'batchNumber', b.batch_number,
            'quantity', b.quantity,
            'purchasePrice', b.purchase_price
          )
          ORDER BY b.expiry_date
        )
        FROM store_inventory_batches b
        WHERE b.store_inventory_id = si.id AND b.quantity > 0
      ), '[]'::jsonb) AS batches
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = p_store_id
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR g.name ILIKE '%' || p_search || '%'
        OR g.generic_name ILIKE '%' || p_search || '%'
      )
    ORDER BY g.name
    OFFSET GREATEST(p_offset, 0)
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'totalValue', v_total_value
  );
END;
$$;
