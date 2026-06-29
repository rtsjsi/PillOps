/**
 * invoice-text-parser.ts
 * 
 * A rule-based parser that converts raw OCR text into structured invoice JSON.
 * Runs entirely in the browser — no AI, no API calls.
 * 
 * Optimized for Indian pharmaceutical distributor invoices which typically have:
 * - Header: Distributor name, invoice number, date
 * - Table: Medicine name, batch, expiry, qty, rate, MRP, GST%, amount
 * - Footer: Subtotal, discount, GST, total
 */

interface ParsedItem {
  medicineName: string;
  pack: string;
  hsnCode: string;
  manufacturer: string;
  batchNumber: string;
  quantity: number;
  freeQuantity: number;
  purchasePrice: number;
  discountPercent: number;
  mrp: number;
  gstPercent: number;
  expiryDate: string;
  totalAmount: number;
}

interface ParsedInvoice {
  rawTranscription: string;
  distributorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ParsedItem[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  total: number;
  offlineOcrNote: string;
  parsingConfidence: string;
}

// ─── Date patterns common in Indian invoices ───────────────────
const DATE_PATTERNS = [
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
  // YYYY-MM-DD
  /(\d{4})-(\d{2})-(\d{2})/,
  // DD/MM/YY
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/,
];

// ─── Expiry date patterns (MM/YY, MM-YY, MM/YYYY) ─────────────
const EXPIRY_PATTERNS = [
  /\b(0[1-9]|1[0-2])[\/\-](20\d{2})\b/,  // MM/YYYY or MM-YYYY
  /\b(0[1-9]|1[0-2])[\/\-](\d{2})\b/,     // MM/YY or MM-YY
];

// ─── Invoice number patterns ───────────────────────────────────
const INVOICE_NUM_PATTERNS = [
  /(?:inv(?:oice)?|bill)\s*(?:no|#|number)?[:\s.]*([A-Z0-9\-\/]+)/i,
  /(?:no|#)[:\s.]*([A-Z]{1,4}[\/\-]?\d{3,}[\/\-]?\d*)/i,
  /\b([A-Z]{1,5}[\/\-]\d{4,}[\/\-]?\d*)\b/,
];

// ─── Common Indian pharma distributor keywords ─────────────────
const DISTRIBUTOR_KEYWORDS = [
  'pharma', 'distributors', 'agencies', 'enterprise', 'medical',
  'wholesale', 'trading', 'drug', 'remedies', 'healthcare',
  'surgical', 'corporation', 'company', 'associates', 'brothers'
];

// ─── Header/footer keywords to skip ────────────────────────────
const SKIP_KEYWORDS = [
  'tax invoice', 'gstin', 'dl no', 'drug licence', 'fssai',
  'terms', 'conditions', 'bank', 'account', 'ifsc', 'branch',
  'e.&o.e', 'subject to', 'goods once', 'return', 'thank you',
  'page', 'printed', 'authorized', 'signatory', 'for ',
  'receiver', 'transport', 'vehicle', 'pan no', 'cin',
  'state code', 'reverse charge'
];

// ─── Table header keywords ─────────────────────────────────────
const TABLE_HEADER_KEYWORDS = [
  'product', 'particular', 'item', 'description', 'medicine',
  'batch', 'expiry', 'qty', 'quantity', 'rate', 'mrp', 'amount',
  'disc', 'gst', 'pack', 'hsn', 'sr', 'no.', 'billed'
];

/**
 * Main parser function: takes raw OCR text and returns structured invoice data.
 */
export function parseInvoiceText(rawText: string): ParsedInvoice {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log(`[Parser] Starting parse of ${lines.length} lines`);

  // Step 1: Extract header info
  const header = extractHeader(lines);
  console.log('[Parser] Header:', header);

  // Step 2: Find where the items table starts and ends
  const tableRange = findTableRange(lines);
  console.log('[Parser] Table range:', tableRange);

  // Step 3: Parse item rows
  const items = parseItemRows(lines, tableRange);
  console.log(`[Parser] Extracted ${items.length} items`);

  // Step 4: Extract footer totals
  const footer = extractFooter(lines);
  console.log('[Parser] Footer:', footer);

  const confidence = items.length > 0 ? 
    (items.length >= 3 ? 'medium' : 'low') : 'very-low';

  return {
    rawTranscription: rawText,
    distributorName: header.distributorName,
    invoiceNumber: header.invoiceNumber,
    invoiceDate: header.invoiceDate,
    items,
    subtotal: footer.subtotal,
    discountAmount: footer.discountAmount,
    gstAmount: footer.gstAmount,
    total: footer.total,
    offlineOcrNote: `Parsed offline from OCR text (${items.length} items detected, confidence: ${confidence}). Please verify all fields carefully.`,
    parsingConfidence: confidence,
  };
}

// ─── HEADER EXTRACTION ─────────────────────────────────────────

function extractHeader(lines: string[]) {
  let distributorName = '';
  let invoiceNumber = '';
  let invoiceDate = '';

  // Scan first 15 lines for header info
  const headerLines = lines.slice(0, Math.min(15, lines.length));

  // Find distributor name (usually the first or second prominent line)
  for (const line of headerLines) {
    const lower = line.toLowerCase();
    if (DISTRIBUTOR_KEYWORDS.some(kw => lower.includes(kw))) {
      distributorName = line;
      break;
    }
  }
  // Fallback: first long line that isn't a skip keyword
  if (!distributorName) {
    for (const line of headerLines.slice(0, 5)) {
      const lower = line.toLowerCase();
      if (line.length > 10 && !SKIP_KEYWORDS.some(kw => lower.includes(kw)) &&
          !TABLE_HEADER_KEYWORDS.some(kw => lower.includes(kw))) {
        distributorName = line;
        break;
      }
    }
  }

  // Find invoice number
  for (const line of headerLines) {
    for (const pattern of INVOICE_NUM_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        invoiceNumber = match[1] || match[0];
        break;
      }
    }
    if (invoiceNumber) break;
  }

  // Find invoice date
  for (const line of headerLines) {
    const lower = line.toLowerCase();
    if (lower.includes('date') || lower.includes('dt')) {
      for (const pattern of DATE_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          invoiceDate = formatDate(match);
          break;
        }
      }
    }
    if (invoiceDate) break;
  }
  // Fallback: find any date in header
  if (!invoiceDate) {
    for (const line of headerLines) {
      for (const pattern of DATE_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          invoiceDate = formatDate(match);
          break;
        }
      }
      if (invoiceDate) break;
    }
  }

  return { distributorName, invoiceNumber, invoiceDate };
}

function formatDate(match: RegExpMatchArray): string {
  const full = match[0];
  // Check if it's YYYY-MM-DD format
  if (/^\d{4}-/.test(full)) return full;
  
  const parts = full.split(/[\/\-.]/);
  if (parts.length === 3) {
    let [a, b, c] = parts;
    // DD/MM/YYYY
    if (c.length === 4) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    // DD/MM/YY
    if (c.length === 2) return `20${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  return full;
}

// ─── TABLE RANGE DETECTION ─────────────────────────────────────

function findTableRange(lines: string[]): { start: number; end: number } {
  let start = -1;
  let end = lines.length - 1;

  // Find table header row
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const headerMatchCount = TABLE_HEADER_KEYWORDS.filter(kw => lower.includes(kw)).length;
    if (headerMatchCount >= 3) {
      start = i + 1; // Items start after the header row
      break;
    }
  }

  // If no clear header found, look for first line with multiple numbers
  if (start === -1) {
    for (let i = 5; i < lines.length; i++) {
      if (isLikelyItemRow(lines[i])) {
        start = i;
        break;
      }
    }
  }

  if (start === -1) start = Math.min(10, lines.length); // Last resort

  // Find table end (footer starts)
  for (let i = lines.length - 1; i > start; i--) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('total') || lower.includes('subtotal') || 
        lower.includes('grand total') || lower.includes('net amount') ||
        lower.includes('round off') || lower.includes('cgst') || lower.includes('sgst')) {
      // The footer block starts a few lines before 'total'
      end = i;
      // Walk backwards to find start of footer block
      while (end > start && isLikelyFooterLine(lines[end - 1])) {
        end--;
      }
      break;
    }
  }

  return { start, end };
}

function isLikelyFooterLine(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes('total') || lower.includes('amount') || 
         lower.includes('cgst') || lower.includes('sgst') || lower.includes('igst') ||
         lower.includes('discount') || lower.includes('round') ||
         lower.includes('net ') || lower.includes('gross');
}

// ─── ITEM ROW PARSING ──────────────────────────────────────────

function isLikelyItemRow(line: string): boolean {
  // An item row typically has multiple numbers (qty, rate, mrp, amount)
  const numbers = line.match(/\d+\.?\d*/g) || [];
  // And at least some text (medicine name)
  const hasText = /[a-zA-Z]{3,}/.test(line);
  return numbers.length >= 3 && hasText;
}

function parseItemRows(lines: string[], range: { start: number; end: number }): ParsedItem[] {
  const items: ParsedItem[] = [];
  const tableLines = lines.slice(range.start, range.end);

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    
    // Skip empty lines, header-like lines, or lines that are too short
    if (line.length < 5) continue;
    const lower = line.toLowerCase();
    if (SKIP_KEYWORDS.some(kw => lower.includes(kw))) continue;
    if (TABLE_HEADER_KEYWORDS.filter(kw => lower.includes(kw)).length >= 3) continue;

    if (!isLikelyItemRow(line)) continue;

    const item = parseItemLine(line);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

function parseItemLine(line: string): ParsedItem | null {
  // Strategy: extract all numbers from the line, then assign them to fields
  // based on their position and value ranges.
  
  // Extract all decimal numbers from the line
  const numberMatches: { value: number; index: number; raw: string }[] = [];
  const numRegex = /(\d+\.?\d*)/g;
  let match;
  while ((match = numRegex.exec(line)) !== null) {
    numberMatches.push({
      value: parseFloat(match[1]),
      index: match.index,
      raw: match[1]
    });
  }

  if (numberMatches.length < 3) return null;

  // Extract batch number (alphanumeric, often like "AB1234" or "1234A")
  const batchMatch = line.match(/\b([A-Z]{1,3}\d{2,6}[A-Z]?\d*|[A-Z0-9]{4,10})\b/i);
  
  // Extract expiry date
  let expiryDate = '';
  for (const pattern of EXPIRY_PATTERNS) {
    const expMatch = line.match(pattern);
    if (expMatch) {
      const mm = expMatch[1];
      const yy = expMatch[2];
      expiryDate = yy.length === 4 ? `${mm}-${yy}` : `${mm}-20${yy}`;
      break;
    }
  }

  // Extract medicine name: text portion before the first number cluster
  // or the longest text segment
  const firstNumIdx = numberMatches.length > 0 ? numberMatches[0].index : line.length;
  let medicineName = line.substring(0, firstNumIdx).trim();
  
  // Clean up: remove serial number from start (like "1 " or "01 ")
  medicineName = medicineName.replace(/^\d{1,3}\s+/, '').trim();
  
  // Remove batch number from medicine name if it got included
  if (batchMatch && medicineName.includes(batchMatch[1])) {
    medicineName = medicineName.replace(batchMatch[1], '').trim();
  }

  if (medicineName.length < 2) return null;

  // Assign numbers to fields based on typical invoice column order and value ranges:
  // Typical order: [Qty] [Free] [Rate/Price] [Disc%] [MRP] [GST%] [Amount]
  // But varies by invoice. Use heuristics on value ranges.
  
  const nums = numberMatches.map(n => n.value);
  
  let quantity = 1;
  let freeQuantity = 0;
  let purchasePrice = 0;
  let discountPercent = 0;
  let mrp = 0;
  let gstPercent = 0;
  let totalAmount = 0;

  // Last number is usually the total amount (largest value or last in row)
  totalAmount = nums[nums.length - 1] || 0;

  // Find GST % (typically 5, 12, 18, or 28)
  const gstCandidates = nums.filter(n => [5, 12, 18, 28, 0].includes(n));
  if (gstCandidates.length > 0) {
    gstPercent = gstCandidates[0];
  }

  // Try to identify fields by value ranges
  const sortedByValue = [...nums].sort((a, b) => a - b);
  
  if (nums.length >= 5) {
    // Likely layout: qty, rate, disc%, mrp, gst%, amount
    // Small integers (1-999) at start = quantity
    quantity = nums[0] <= 500 ? nums[0] : 1;
    
    // Prices: medium values, typically between 1 and 10000
    const priceValues = nums.filter(n => n > 1 && n < 50000 && n !== gstPercent && n !== quantity);
    
    if (priceValues.length >= 2) {
      // Usually rate < MRP
      const sorted = [...priceValues].sort((a, b) => a - b);
      purchasePrice = sorted[0] || 0;
      mrp = sorted.length > 1 ? sorted[sorted.length - 2] || sorted[0] : purchasePrice;
      totalAmount = sorted[sorted.length - 1] || 0;
    } else if (priceValues.length === 1) {
      purchasePrice = priceValues[0];
      mrp = purchasePrice;
    }
  } else if (nums.length >= 3) {
    quantity = nums[0] <= 500 ? nums[0] : 1;
    purchasePrice = nums[1] || 0;
    totalAmount = nums[nums.length - 1] || 0;
    mrp = purchasePrice;
  }

  // Detect discount (small decimal like 5.0, 10.0, 15.0)
  const discCandidates = nums.filter(n => n > 0 && n <= 50 && n !== gstPercent && n !== quantity && 
    n !== purchasePrice && n !== mrp && n !== totalAmount);
  if (discCandidates.length > 0) {
    discountPercent = discCandidates[0];
  }

  // Extract HSN code (4-8 digit number, typically starting with 3004 for pharma)
  let hsnCode = '';
  const hsnMatch = line.match(/\b(3004\d{2,4}|\d{4}00\d{2})\b/);
  if (hsnMatch) hsnCode = hsnMatch[1];

  // Detect pack info (like "10T", "100ML", "15GM", "10x10")
  let pack = '';
  const packMatch = line.match(/\b(\d+\s*[xX×]\s*\d+|\d+\s*(?:TAB|CAP|ML|GM|MG|LTR|T|STRIP|AMP|VIAL|TUBE|INJ)S?)\b/i);
  if (packMatch) pack = packMatch[1];

  return {
    medicineName: medicineName.toUpperCase(),
    pack,
    hsnCode,
    manufacturer: '',
    batchNumber: batchMatch ? batchMatch[1] : '',
    quantity: Math.round(quantity),
    freeQuantity,
    purchasePrice: Math.round(purchasePrice * 100) / 100,
    discountPercent: Math.round(discountPercent * 100) / 100,
    mrp: Math.round(mrp * 100) / 100,
    gstPercent,
    expiryDate,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

// ─── FOOTER EXTRACTION ─────────────────────────────────────────

function extractFooter(lines: string[]) {
  let subtotal = 0;
  let discountAmount = 0;
  let gstAmount = 0;
  let total = 0;

  // Scan last 15 lines for totals
  const footerLines = lines.slice(Math.max(0, lines.length - 15));

  for (const line of footerLines) {
    const lower = line.toLowerCase();
    const numMatch = line.match(/([\d,]+\.?\d*)\s*$/);
    const value = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

    if (!value) continue;

    if (lower.includes('grand total') || lower.includes('net amount') || 
        lower.includes('net payable') || lower.includes('bill amount')) {
      total = value;
    } else if (lower.includes('sub') && lower.includes('total')) {
      subtotal = value;
    } else if (lower.includes('total') && !lower.includes('sub')) {
      // Generic "total" — could be grand total
      if (value > total) total = value;
    } else if (lower.includes('discount') || lower.includes('disc')) {
      discountAmount = value;
    } else if (lower.includes('cgst') || lower.includes('sgst') || lower.includes('igst') || lower.includes('gst')) {
      gstAmount += value;
    }
  }

  return { subtotal, discountAmount, gstAmount, total };
}
