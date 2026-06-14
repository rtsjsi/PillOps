-- RPC: get_distinct_values
-- Fetches distinct values for a given column in a given table.
-- Supports optional store_id filtering for multi-tenant isolation.
CREATE OR REPLACE FUNCTION get_distinct_values(p_table text, p_column text, p_store_id uuid DEFAULT NULL)
RETURNS TABLE (val text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_store_id IS NOT NULL THEN
    RETURN QUERY EXECUTE format(
      'SELECT DISTINCT %I::text FROM %I WHERE store_id = %L AND %I IS NOT NULL AND %I <> '''' ORDER BY 1 LIMIT 100',
      p_column, p_table, p_store_id, p_column, p_column
    );
  ELSE
    RETURN QUERY EXECUTE format(
      'SELECT DISTINCT %I::text FROM %I WHERE %I IS NOT NULL AND %I <> '''' ORDER BY 1 LIMIT 100',
      p_column, p_table, p_column, p_column
    );
  END IF;
END;
$$;
