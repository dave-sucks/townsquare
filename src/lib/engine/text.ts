/**
 * Text helpers the gates and Resolve's scoring share: whitespace
 * normalization, verbatim checks, and name similarity.
 */

/** Collapse whitespace and unify Unicode forms, for "verbatim" comparisons. */
export function normalizeWhitespace(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Curly quotes and dashes as their plain forms. */
function plainPunctuation(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑‒–—]/g, "-");
}

/**
 * Is `part` a verbatim substring of `whole`? Whitespace and typographic
 * punctuation (curly quotes, dashes) don't count as differences: a model
 * copies "L’Appartement" as "L'Appartement".
 */
export function isVerbatim(part: string, whole: string): boolean {
  const norm = (s: string) => plainPunctuation(normalizeWhitespace(s));
  const p = norm(part);
  if (!p) return true;
  return norm(whole).includes(p);
}

/** Looser: also ignores case and curly-vs-straight punctuation (tag evidence). */
export function containsLoosely(whole: string, part: string): boolean {
  const norm = (s: string) => plainPunctuation(normalizeWhitespace(s)).toLowerCase();
  const p = norm(part);
  return !p || norm(whole).includes(p);
}

/**
 * Evidence holds when it (or a quoted fragment inside it, for a model that
 * wraps its quote in a sentence) appears in the source.
 */
export function evidenceHolds(source: string, evidence: string): boolean {
  if (containsLoosely(source, evidence)) return true;
  const quoted = [...evidence.matchAll(/["“'‘]([^"”'’]{6,})["”'’]/g)].map((m) => m[1]);
  if (quoted.some((q) => containsLoosely(source, q))) return true;
  // A list of quotes ("cinnamon roll, pumpkin roll") holds when every item does.
  const parts = evidence.split(/[,;]| and /).map((p) => p.trim()).filter((p) => p.length >= 3);
  return parts.length > 1 && parts.every((p) => containsLoosely(source, p));
}

const NAME_STOPWORDS = new Set(["the", "restaurant", "nyc", "and", "&"]);

/** Lowercase, strip punctuation and accents and filler words ("the", "restaurant", "nyc"). */
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !NAME_STOPWORDS.has(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0–1 edit-distance similarity of two strings. */
function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  return (total - levenshtein(a, b)) / total;
}

/**
 * Token-set ratio (as in fuzzywuzzy): compares the shared tokens against
 * each side's full token set, so "Joe's Pizza" vs "Joe's Pizza Broadway"
 * scores high while unrelated names don't.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const shared = [...ta].filter((t) => tb.has(t)).sort();
  const onlyA = [...ta].filter((t) => !tb.has(t)).sort();
  const onlyB = [...tb].filter((t) => !ta.has(t)).sort();
  const s = shared.join(" ");
  const sa = [s, ...onlyA].filter(Boolean).join(" ");
  const sb = [s, ...onlyB].filter(Boolean).join(" ");
  if (s && (onlyA.length === 0 || onlyB.length === 0)) return 1;
  return Math.max(ratio(s, sa), ratio(s, sb), ratio(sa, sb));
}

/** A dish name as a counting key: lowercase, no punctuation, simple singular. */
export function dishKey(name: string): string {
  const t = nameTokens(name).join(" ");
  return t.endsWith("es") && t.length > 4 && /(ches|shes|xes|ses)$/.test(t)
    ? t.slice(0, -2)
    : t.endsWith("s") && !t.endsWith("ss") && t.length > 3
      ? t.slice(0, -1)
      : t;
}

/** "8.5/10" → { value: 8.5, outOf: 10 }. */
export function parseScore(raw: string | null | undefined): { value: number; outOf: number | null } | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/i);
  if (m) return { value: Number(m[1]), outOf: Number(m[2]) };
  const n = raw.match(/(\d+(?:\.\d+)?)/);
  return n ? { value: Number(n[1]), outOf: null } : null;
}

/** Great-circle distance in kilometers. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
