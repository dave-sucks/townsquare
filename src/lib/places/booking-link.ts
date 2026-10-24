/**
 * A booking page on Resy, OpenTable, Tock or SevenRooms: read from any link
 * to one, and the link the place page's Book button opens, with the date and
 * party size filled in. Safe for the browser; finding a place's page lives in
 * booking.ts.
 */

export const BOOKING_PROVIDERS = ["resy", "opentable", "tock", "sevenrooms"] as const;
export type BookingProvider = (typeof BOOKING_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<BookingProvider, string> = {
  resy: "Resy",
  opentable: "OpenTable",
  tock: "Tock",
  sevenrooms: "SevenRooms",
};

export type Booking = { provider: BookingProvider; url: string };

// Tock paths that aren't a venue.
const TOCK_RESERVED = new Set(["city", "collections", "search", "about", "join", "login", "signup", "account", "giftcards", "business"]);

/** A booking page from any link to one, normalized (no query string), or null. */
export function parseBookingUrl(raw: string): Booking | null {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^\/\//, "https://"));
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());
  if (host === "resy.com" && parts[0] === "cities" && parts[1]) {
    // /cities/{city}/venues/{slug}, or the older /cities/{city}/{slug}.
    const slug = parts[2] === "venues" ? parts[3] : parts[2];
    if (slug && slug !== "venues" && /^[a-z0-9-]+$/.test(slug)) return { provider: "resy", url: `https://resy.com/cities/${parts[1]}/venues/${slug}` };
  }
  if (host === "opentable.com" || host.endsWith(".opentable.com")) {
    if (parts[0] === "r" && parts[1]) return { provider: "opentable", url: `https://www.opentable.com/r/${parts[1]}` };
    const rid = u.searchParams.get("rid") ?? u.searchParams.get("restref") ?? (parts[0] === "restaurant" && parts[1] === "profile" ? parts[2] : null);
    if (rid && /^\d+$/.test(rid)) return { provider: "opentable", url: `https://www.opentable.com/restaurant/profile/${rid}` };
  }
  if (host === "exploretock.com" && parts[0] && !TOCK_RESERVED.has(parts[0]) && /^[a-z0-9-]+$/.test(parts[0])) {
    return { provider: "tock", url: `https://www.exploretock.com/${parts[0]}` };
  }
  if (host === "sevenrooms.com" && (parts[0] === "explore" || parts[0] === "reservations") && parts[1] && /^[a-z0-9-]+$/.test(parts[1])) {
    return { provider: "sevenrooms", url: `https://www.sevenrooms.com/explore/${parts[1]}/reservations/create/search` };
  }
  return null;
}

/**
 * The booking page with the date and party size filled in. Resy, OpenTable
 * (its profile links redirect and keep them) and SevenRooms read them; Tock
 * opens the venue page.
 */
export function bookingHref(booking: Booking, opts: { date: string; seats: number; time?: string }): string {
  const time = opts.time ?? "19:00";
  const q = (params: Record<string, string>) => `${booking.url}?${new URLSearchParams(params)}`;
  switch (booking.provider) {
    case "resy":
      return q({ date: opts.date, seats: String(opts.seats) });
    case "opentable":
      return q({ covers: String(opts.seats), dateTime: `${opts.date}T${time}` });
    case "sevenrooms":
      return q({ date: opts.date, party_size: String(opts.seats) });
    case "tock":
      return q({ date: opts.date, size: String(opts.seats), time });
  }
}
