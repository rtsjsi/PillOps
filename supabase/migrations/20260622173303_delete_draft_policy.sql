CREATE POLICY "Users can delete purchases for their store"
  ON purchase_invoices FOR DELETE
  USING (store_id = public.user_store_id() OR public.is_super_admin());

CREATE POLICY "Users can delete purchase items for their store"
  ON purchase_invoice_items FOR DELETE
  USING (store_id = public.user_store_id() OR public.is_super_admin());
