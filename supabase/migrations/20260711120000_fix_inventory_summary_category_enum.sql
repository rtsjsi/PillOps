-- Fix get_inventory_summary: comparing medicine_category enum to '' forces an invalid cast.

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
    SELECT DISTINCT g.category::text AS cat
    FROM store_inventory si
    JOIN global_medicine_master g ON g.id = si.global_medicine_master_id
    WHERE si.store_id = p_store_id
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

-- Treat blank category filter like "All" (avoid enum cast errors on empty text).
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
      p_category IS NULL OR btrim(p_category) = '' OR p_category = 'All'
      OR g.category::text = p_category
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
        p_category IS NULL OR btrim(p_category) = '' OR p_category = 'All'
        OR g.category::text = p_category
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
