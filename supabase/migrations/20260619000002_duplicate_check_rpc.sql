CREATE OR REPLACE FUNCTION check_duplicate_invoice(
  p_store_id UUID, 
  p_distributor_name TEXT, 
  p_invoice_number TEXT, 
  p_invoice_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
    v_norm_distributor TEXT;
    v_norm_invoice TEXT;
BEGIN
    -- Normalize strings: lowercase and remove all non-alphanumeric characters
    v_norm_distributor := REGEXP_REPLACE(LOWER(p_distributor_name), '[^a-z0-9]', '', 'g');
    v_norm_invoice := REGEXP_REPLACE(LOWER(p_invoice_number), '[^a-z0-9]', '', 'g');

    -- Date comparison: We check if the year and month match, as exact day might sometimes be read wrong by OCR
    -- Wait, exact match is safer if we just use the date. Let's do exact date match if provided, but we also check if date is missing
    IF p_invoice_date IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 
            FROM purchase_invoices 
            WHERE store_id = p_store_id
              AND REGEXP_REPLACE(LOWER(invoice_number), '[^a-z0-9]', '', 'g') = v_norm_invoice
              AND REGEXP_REPLACE(LOWER(distributor_name), '[^a-z0-9]', '', 'g') = v_norm_distributor
              AND invoice_date = p_invoice_date
        ) INTO v_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 
            FROM purchase_invoices 
            WHERE store_id = p_store_id
              AND REGEXP_REPLACE(LOWER(invoice_number), '[^a-z0-9]', '', 'g') = v_norm_invoice
              AND REGEXP_REPLACE(LOWER(distributor_name), '[^a-z0-9]', '', 'g') = v_norm_distributor
        ) INTO v_exists;
    END IF;

    RETURN v_exists;
END;
$$;
