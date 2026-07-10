const NON_SPLITTABLE = new Set(['Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler']);

/** Parse pack size into saleable units per pack/strip (e.g. strip of 10 tabs → 10). */
export function parseUnitsPerPack(
  packSize?: string | null,
  category?: string | null,
  medicineName?: string | null,
): number {
  if (category && NON_SPLITTABLE.has(category)) return 1;

  const text = `${packSize ?? ''} ${medicineName ?? ''}`.toUpperCase();

  const xy = text.match(/\b(\d+)\s*[*X×]\s*(\d+)\b/);
  if (xy) {
    const a = Number(xy[1]);
    const b = Number(xy[2]);
    if (b === 1 && a > 1) return a;
    if (a === 1 && b > 1) return b;
    if (a > 1 && b > 1) return a * b;
  }

  const tab = text.match(/\b(\d+)\s*(?:TAB|CAP|T)S?\b/);
  if (tab && Number(tab[1]) > 1) return Number(tab[1]);

  const strip = text.match(/\b(\d+)\s*'?S\b/);
  if (strip && Number(strip[1]) > 1) return Number(strip[1]);

  const oneBy = text.match(/\b1\s*[*X×]\s*(\d+)\b/);
  if (oneBy) return Number(oneBy[1]);

  return 1;
}

export function formatPackLabel(unitsPerPack: number, packSize?: string | null): string {
  if (unitsPerPack <= 1) return '';
  if (packSize?.trim()) return packSize.trim();
  return `${unitsPerPack} units/pack`;
}

export function formatSaleQty(quantity: number, unitsPerPack: number): string {
  if (unitsPerPack <= 1) return String(quantity);
  return `${quantity} (Pk ${unitsPerPack})`;
}
