/**
 * Distinguish this invoice's payable total from distributor ledger/outstanding amounts.
 */

const IGNORE_TOTAL_LABEL_PATTERNS = [
  /\boutstanding\b/i,
  /\bo\s*\/\s*s\b/i,
  /\bprevious\s+balance\b/i,
  /\bprev(?:ious)?\s+bal\b/i,
  /\bopening\s+balance\b/i,
  /\bclosing\s+balance\b/i,
  /\bold\s+balance\b/i,
  /\bledger\s+balance\b/i,
  /\baccount\s+balance\b/i,
  /\bbalance\s+due\b/i,
  /\bamount\s+due\b/i,
  /\btotal\s+due\b/i,
  /\bcredit\s+limit\b/i,
  /\bcr\s+limit\b/i,
  /\bprevious\s+due\b/i,
];

const INVOICE_TOTAL_LABEL_PATTERNS = [
  /\bgrand\s+total\b/i,
  /\bnet\s+amount\b/i,
  /\bnet\s+payable\b/i,
  /\bbill\s+amount\b/i,
  /\binvoice\s+total\b/i,
  /\binvoice\s+amount\b/i,
  /\bnet\s+total\b/i,
  /\bgross\s+total\b/i,
  /\bamount\s+payable\b/i,
  /\btotal\s+bill\b/i,
  /\btotal\s+amount\b/i,
];

function parseAmount(raw: string): number {
  const value = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function extractAmountFromLine(line: string): number {
  const labeled = line.match(
    /(?:grand\s+total|net\s+amount|net\s+payable|bill\s+amount|invoice\s+total|invoice\s+amount|net\s+total|gross\s+total|amount\s+payable|total\s+bill|total\s+amount|outstanding|balance|amount\s+due)\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+\.?\d*)/i
  );
  if (labeled?.[1]) return parseAmount(labeled[1]);

  const trailing = line.match(/(?:rs\.?|₹)?\s*([\d,]+\.\d{2})\s*$/i);
  if (trailing?.[1]) return parseAmount(trailing[1]);

  const anyNumber = line.match(/([\d,]+\.\d{2})/);
  return anyNumber?.[1] ? parseAmount(anyNumber[1]) : 0;
}

export function totalsAreClose(a: number, b: number, tolerance = 0.02): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(2, a * tolerance);
}

export function sumItemTotals(items: Array<{ totalAmount?: number }> | undefined): number {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
}

export function isIgnoredTotalLabel(line: string): boolean {
  return IGNORE_TOTAL_LABEL_PATTERNS.some(pattern => pattern.test(line));
}

export function isInvoiceTotalLabel(line: string): boolean {
  return INVOICE_TOTAL_LABEL_PATTERNS.some(pattern => pattern.test(line));
}

export function extractIgnoredAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !isIgnoredTotalLabel(trimmed)) continue;
    const value = extractAmountFromLine(trimmed);
    if (value > 0) amounts.push(value);
  }
  return amounts;
}

/** Prefer footer grand/net total — not header outstanding balance. */
export function extractInvoiceTotalFromText(text: string): number | null {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let best: { value: number; score: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isIgnoredTotalLabel(line)) continue;
    if (!isInvoiceTotalLabel(line)) continue;

    const value = extractAmountFromLine(line);
    if (value <= 0) continue;

    let score = 10;
    const lower = line.toLowerCase();
    if (i >= lines.length - 25) score += 25;
    if (lower.includes('grand')) score += 20;
    if (lower.includes('net')) score += 8;
    if (lower.includes('payable') || lower.includes('bill amount')) score += 6;

    if (!best || score > best.score) {
      best = { value, score };
    }
  }

  return best?.value ?? null;
}

export function correctInvoiceTotal(
  extracted: number | undefined,
  items: Array<{ totalAmount?: number }> | undefined,
  rawTranscription?: string
): number {
  const extractedTotal = Number(extracted) || 0;
  const itemsSum = sumItemTotals(items);
  const roundedItemsSum = Math.round(itemsSum * 100) / 100;
  const fromFooter = rawTranscription?.trim()
    ? extractInvoiceTotalFromText(rawTranscription)
    : null;
  const ignoredAmounts = rawTranscription?.trim()
    ? extractIgnoredAmounts(rawTranscription)
    : [];

  const extractedMatchesIgnored = ignoredAmounts.some(amount =>
    totalsAreClose(amount, extractedTotal)
  );
  const extractedFarFromItems =
    roundedItemsSum > 0 && extractedTotal > 0 && !totalsAreClose(extractedTotal, roundedItemsSum, 0.06);

  const needsCorrection =
    extractedMatchesIgnored ||
    (extractedFarFromItems && (fromFooter != null || roundedItemsSum > 0)) ||
    (extractedTotal <= 0 && (fromFooter != null || roundedItemsSum > 0));

  if (!needsCorrection) return extractedTotal;

  if (fromFooter != null) {
    if (extractedMatchesIgnored) return fromFooter;
    if (roundedItemsSum > 0 && totalsAreClose(fromFooter, roundedItemsSum, 0.08)) return fromFooter;
    if (extractedFarFromItems && totalsAreClose(fromFooter, roundedItemsSum, 0.12)) return fromFooter;
    if (extractedTotal <= 0) return fromFooter;
  }

  if (roundedItemsSum > 0 && (extractedMatchesIgnored || extractedFarFromItems || extractedTotal <= 0)) {
    return roundedItemsSum;
  }

  return extractedTotal;
}

export function buildInvoiceTotalExtractionInstructions(): string {
  return `11. INVOICE TOTAL vs OUTSTANDING BALANCE (CRITICAL):
Indian distributor invoices often show TWO different amounts:
- **Invoice total (USE THIS for "total")** — the payable amount for THIS invoice only. Found at the BOTTOM in the totals/footer section, labeled "Grand Total", "Net Amount", "Net Payable", "Bill Amount", or "Invoice Total". It equals the sum of line-item amounts on this invoice.
- **Outstanding / balance (IGNORE)** — cumulative ledger balance with the distributor across past invoices. Often in the HEADER near invoice number/date, labeled "Outstanding", "O/S", "Balance", "Previous Balance", "Amount Due", or "Ledger Balance". This is NOT the invoice total.

For the JSON "total" field, extract ONLY this invoice's grand/net payable amount. NEVER use Outstanding or account balance.
If unsure, use the amount at the bottom labeled Grand Total / Net Amount, not any Outstanding figure in the header.`;
}
