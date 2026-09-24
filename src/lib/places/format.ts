/** Client-safe place formatting helpers. */

/**
 * Place.priceLevel arrives as "$$", a bare number ("3"), or a Places API
 * enum ("PRICE_LEVEL_MODERATE") depending on how the place was imported.
 */
export function formatPriceLevel(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\$+$/.test(s)) return s;
  if (/^[0-4]$/.test(s)) return s === "0" ? null : "$".repeat(Number(s));
  const byName: Record<string, string | null> = {
    PRICE_LEVEL_FREE: null,
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return s in byName ? byName[s] : null;
}
