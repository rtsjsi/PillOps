import type { PurchaseItem } from '@/components/purchases/purchase-item-card';

/** Per-line: discount on gross, GST on net taxable amount. */
export function calculatePurchaseLineAmount(
  item: Pick<PurchaseItem, 'quantity' | 'purchasePrice' | 'discountPercent' | 'gstPercent'>,
) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.purchasePrice) || 0;
  const disc = Number(item.discountPercent) || 0;
  const gst = Number(item.gstPercent) || 0;

  const gross = qty * price;
  const taxable = gross * (1 - disc / 100);
  const gstAmount = taxable * (gst / 100);
  const totalAmount = taxable + gstAmount;

  return {
    gross: Number(gross.toFixed(2)),
    taxable: Number(taxable.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

export function calculatePurchaseTotals(items: PurchaseItem[]) {
  let subtotal = 0;
  let discountAmount = 0;
  let gstAmount = 0;

  items.forEach((item) => {
    const line = calculatePurchaseLineAmount(item);
    subtotal += line.taxable;
    discountAmount += line.gross - line.taxable;
    gstAmount += line.gstAmount;
  });

  const total = subtotal + gstAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export const PURCHASE_LINE_TOTAL_FIELDS = [
  'quantity',
  'purchasePrice',
  'discountPercent',
  'gstPercent',
] as const;
