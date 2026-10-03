/** Parses "12,999" or "12999.50" typed by a person into minor units. Returns null when it is not a positive amount. */
export function parseMinor(text: string): number | null {
  const cleaned = text.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function minorToInput(minor: number | null | undefined): string {
  if (!minor) return "";
  return String(minor / 100);
}
