/** Form state for numeric inputs — empty string means "cleared while editing". */
export type NumericFieldValue = number | '';

export function toNumericField(value: NumericFieldValue | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number' && isNaN(value)) return '';
  return String(value);
}

export function parseWholeField(raw: string): NumericFieldValue {
  if (raw === '') return '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : '';
}

export function parseDecimalField(raw: string): NumericFieldValue {
  if (raw === '') return '';
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : '';
}

export function coerceNumber(value: NumericFieldValue | null | undefined, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isNumericFieldEmpty(value: NumericFieldValue | null | undefined): boolean {
  return value === '' || value === null || value === undefined || (typeof value === 'number' && isNaN(value));
}
