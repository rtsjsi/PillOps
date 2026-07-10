/** DB stores expiry as YYYY-MM (varchar(7)). Forms use MM-YYYY. */

const MM_YYYY = /^(0[1-9]|1[0-2])-\d{4}$/;
const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/;
const YYYY_MM_DD = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;

/** Convert DB / mixed input to MM-YYYY for form fields. */
export function formatExpiryForForm(date: string): string {
  const clean = date.trim();
  if (!clean) return '';

  if (YYYY_MM_DD.test(clean)) {
    const [yyyy, mm] = clean.split('-');
    return `${mm}-${yyyy}`;
  }

  if (YYYY_MM.test(clean)) {
    const [yyyy, mm] = clean.split('-');
    return `${mm}-${yyyy}`;
  }

  if (MM_YYYY.test(clean)) {
    return clean;
  }

  // MM/YYYY or MM-YY style pasted values
  if (/^(0[1-9]|1[0-2])[-/](\d{2}|\d{4})$/.test(clean)) {
    const [mm, yy] = clean.split(/[-/]/);
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${mm}-${yyyy}`;
  }

  return clean;
}

/** Convert form / OCR input to YYYY-MM for the database. */
export function normalizeExpiryForDb(expiry: string): string {
  const clean = expiry.trim();
  if (!clean) return '';

  if (YYYY_MM.test(clean)) {
    return clean;
  }

  if (YYYY_MM_DD.test(clean)) {
    return clean.slice(0, 7);
  }

  if (MM_YYYY.test(clean)) {
    const [mm, yyyy] = clean.split('-');
    return `${yyyy}-${mm}`;
  }

  if (/^(0[1-9]|1[0-2])[-/](\d{4})$/.test(clean)) {
    const [mm, yyyy] = clean.split(/[-/]/);
    return `${yyyy}-${mm}`;
  }

  if (/^(0[1-9]|1[0-2])[-/](\d{2})$/.test(clean)) {
    const [mm, yy] = clean.split(/[-/]/);
    return `20${yy}-${mm}`;
  }

  // Last resort: trim ISO / datetime strings to the month
  if (clean.length > 7 && /^\d{4}-(0[1-9]|1[0-2])/.test(clean)) {
    return clean.slice(0, 7);
  }

  return clean;
}

export function isValidExpiryFormValue(expiry: string): boolean {
  return MM_YYYY.test(expiry.trim());
}
