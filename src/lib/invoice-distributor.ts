/**
 * Distinguish distributor (invoice issuer) from retail store/customer on Indian pharma invoices.
 */

export interface StoreContext {
  storeName?: string;
  storeGstin?: string;
}

const STORE_CUSTOMER_PATTERNS = [
  /^m\s*\/\s*s\.?\s/i,
  /\b(medical\s+and\s+general\s+stores?|general\s+stores?|medical\s+stores?)\b/i,
  /\b(chemist|chemists|pharmacy|retail\s+store)\b/i,
];

const CUSTOMER_LABEL_PATTERNS = [
  /\b(buyer|customer|consignee|ship\s*to|bill\s*to|deliver\s*to|party\s*name)\b/i,
];

const DISTRIBUTOR_KEYWORDS = [
  'pharma', 'distributors', 'distributor', 'agencies', 'enterprise',
  'wholesale', 'trading', 'drug', 'remedies', 'healthcare',
  'surgical', 'corporation', 'company', 'associates', 'brothers',
];

const HEADER_SKIP_PATTERNS = [
  /tax invoice/i,
  /gstin/i,
  /\bdl\s*no\b/i,
  /drug lic/i,
  /fssai/i,
  /pan\s*no/i,
  /state code/i,
  /^\d+$/,
  /^#?\s*sl\d+/i,
];

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^m\s*\/\s*s\.?\s*/i, '')
    .replace(/\b(ltd|limited|pvt|private|llp|inc)\b\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function businessNamesMatch(a?: string, b?: string): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  return longer.includes(shorter) && shorter.length >= Math.min(12, longer.length * 0.6);
}

export function isLikelyCustomerStoreName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return STORE_CUSTOMER_PATTERNS.some(pattern => pattern.test(trimmed));
}

function cleanBusinessName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

function isHeaderNoise(line: string): boolean {
  const lower = line.toLowerCase();
  return HEADER_SKIP_PATTERNS.some(pattern => pattern.test(lower));
}

function isDistributorCandidate(line: string, excludeName?: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 6 || trimmed.length > 90) return false;
  if (isHeaderNoise(trimmed)) return false;
  if (CUSTOMER_LABEL_PATTERNS.some(pattern => pattern.test(trimmed))) return false;
  if (isLikelyCustomerStoreName(trimmed)) return false;
  if (excludeName && businessNamesMatch(trimmed, excludeName)) return false;
  return DISTRIBUTOR_KEYWORDS.some(keyword => trimmed.toLowerCase().includes(keyword));
}

/** Footer "For SHRI HARI ENTERPRISE" blocks identify the invoice issuer. */
export function extractDistributorFromSignature(text: string): string | null {
  const matches = [
    ...text.matchAll(
      /\bfor\s+([A-Z][A-Za-z0-9\s&.,'-]{2,80}?)(?:\s*(?:authorised|authorized|signatory)|\s*$|\r?\n)/gi
    ),
  ];
  if (!matches.length) return null;

  for (let i = matches.length - 1; i >= 0; i--) {
    const candidate = cleanBusinessName(matches[i][1]);
    if (candidate.length >= 4 && !isLikelyCustomerStoreName(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function extractDistributorFromHeader(text: string, excludeName?: string): string | null {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const headerLines = lines.slice(0, Math.min(25, lines.length));

  for (const line of headerLines) {
    if (!isDistributorCandidate(line, excludeName)) continue;
    return cleanBusinessName(line);
  }

  for (const line of headerLines) {
    if (line.length < 8 || line.length > 90) continue;
    if (isHeaderNoise(line)) continue;
    if (CUSTOMER_LABEL_PATTERNS.some(pattern => pattern.test(line))) continue;
    if (isLikelyCustomerStoreName(line)) continue;
    if (excludeName && businessNamesMatch(line, excludeName)) continue;
    if (/[A-Z]{2,}/.test(line) && /[a-z]/.test(line) === false) {
      return cleanBusinessName(line);
    }
  }

  return null;
}

export function correctDistributorName(
  extracted: string | undefined,
  context: StoreContext & { rawTranscription?: string }
): string {
  const extractedName = extracted?.trim() ?? '';
  const { storeName, rawTranscription } = context;

  const looksLikeStore =
    !extractedName ||
    (storeName && businessNamesMatch(extractedName, storeName)) ||
    isLikelyCustomerStoreName(extractedName);

  if (!looksLikeStore) return extractedName;

  if (rawTranscription?.trim()) {
    const fromSignature = extractDistributorFromSignature(rawTranscription);
    if (fromSignature && !businessNamesMatch(fromSignature, storeName)) {
      return fromSignature;
    }

    const fromHeader = extractDistributorFromHeader(rawTranscription, storeName);
    if (fromHeader && !businessNamesMatch(fromHeader, storeName)) {
      return fromHeader;
    }
  }

  return extractedName;
}

export function buildDistributorExtractionInstructions(context?: StoreContext): string {
  const storeHint = context?.storeName
    ? `\nThe scanning retail pharmacy is "${context.storeName}". NEVER use this name as distributorName.`
  : '';

  const gstinHint = context?.storeGstin
    ? `\nThe store's GSTIN is ${context.storeGstin}. Do not pick the business block associated with this GSTIN.`
    : '';

  return `10. DISTRIBUTOR vs CUSTOMER/STORE NAME (CRITICAL):
Indian pharmaceutical tax invoices show TWO business entities in the header:
- **Distributor (issuer/seller)** — the wholesaler who issued the invoice. Usually TOP-LEFT, largest printed company name, has wholesale D.L. No, and appears again at the bottom as "For [NAME]" above "Authorised Signatory".
- **Customer (buyer/retail store)** — the pharmacy receiving the goods. Usually TOP-RIGHT, often prefixed with "M/s", labeled "Buyer" / "Bill To" / "Party", and often contains words like "MEDICAL AND GENERAL STORES", "CHEMIST", or "PHARMACY".

For distributorName, extract ONLY the issuer/wholesaler. NEVER extract the retail store or customer name.${storeHint}${gstinHint}
If two company names appear and you are unsure, prefer the name in the "For _____" signature block at the bottom over any "M/s ..." name.`;
}
