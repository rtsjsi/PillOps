-- ============================================================
-- Migration: Optimize global_medicine_master for LOV Performance
-- 
-- Fixes:
-- 1. Creates missing indexes (B-tree + trigram GIN)
-- 2. Creates missing search_medicines RPC function
-- 3. Drops unused columns: barcode, image_url
-- 4. Changes gst_percent from double precision to smallint
-- ============================================================

-- ─── 1. Enable pg_trgm extension for fuzzy search ──────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── 2. Create performance indexes ────────────────────────
-- B-tree index for ORDER BY name (default LOV listing)
CREATE INDEX IF NOT EXISTS idx_gmm_name ON global_medicine_master (name);

-- B-tree index for exact name lookups (purchase RPC WHERE name = ...)
CREATE INDEX IF NOT EXISTS idx_gmm_name_exact ON global_medicine_master (name text_pattern_ops);

-- Trigram GIN indexes for fuzzy ILIKE '%term%' search (biggest LOV bottleneck)
CREATE INDEX IF NOT EXISTS idx_gmm_name_trgm ON global_medicine_master USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gmm_generic_name_trgm ON global_medicine_master USING gin (generic_name gin_trgm_ops);

-- Index for manufacturer lookups (used in DISTINCT queries and LOV)
CREATE INDEX IF NOT EXISTS idx_gmm_manufacturer ON global_medicine_master (manufacturer) WHERE manufacturer IS NOT NULL AND manufacturer <> '';

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_gmm_category ON global_medicine_master (category);

-- ─── 3. Create search_medicines RPC function ───────────────
-- This function is called by the app but was never created.
-- Uses trigram indexes for fast fuzzy search.
CREATE OR REPLACE FUNCTION search_medicines(search_term text)
RETURNS SETOF global_medicine_master
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM global_medicine_master
  WHERE
    name ILIKE '%' || search_term || '%'
    OR generic_name ILIKE '%' || search_term || '%'
    OR manufacturer ILIKE '%' || search_term || '%'
  ORDER BY
    CASE
      WHEN name ILIKE search_term THEN 0              -- Exact match
      WHEN name ILIKE search_term || '%' THEN 1        -- Starts with
      WHEN generic_name ILIKE search_term || '%' THEN 2 -- Generic starts with
      WHEN name ILIKE '%' || search_term || '%' THEN 3  -- Name contains
      ELSE 4
    END,
    name
  LIMIT 30;
END;
$$;

-- ─── 4. Drop unused columns ───────────────────────────────
ALTER TABLE global_medicine_master DROP COLUMN IF EXISTS barcode;
ALTER TABLE global_medicine_master DROP COLUMN IF EXISTS image_url;

-- ─── 5. Change gst_percent from double precision to smallint ─
ALTER TABLE global_medicine_master 
  ALTER COLUMN gst_percent TYPE smallint USING COALESCE(gst_percent, 12)::smallint;
ALTER TABLE global_medicine_master 
  ALTER COLUMN gst_percent SET DEFAULT 12;

-- ─── 6. Grant execute on search_medicines to authenticated/anon ─
GRANT EXECUTE ON FUNCTION search_medicines(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_medicines(text) TO anon;
