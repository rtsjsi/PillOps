-- update_sales_invoice RPC sets updated_at but the column was never added
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
