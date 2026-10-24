/**
 * Where a place takes reservations: its page on Resy, OpenTable, Tock or
 * SevenRooms, found on the place's own website (the booking link its
 * "Reserve" button points to). The place page links there with the date and
 * party size filled in; nothing here needs a booking platform's API, and an
 * admin can set or clear the link by hand.
 */

import { parseBookingUrl, type Booking } from "./booking-link";

export { bookingHref, parseBookingUrl, PROVIDER_LABEL, BOOKING_PROVIDERS, type Booking, type BookingProvider } from "./booking-link";

const BOOKING_LINK = /(?:https?:)?\/\/(?:www\.)?(?:resy\.com\/cities\/[^\s"'<>)]+|[a-z.]*opentable\.com\/[^\s"'<>)]+|exploretock\.com\/[^\s"'<>)]+|sevenrooms\.com\/(?:explore|reservations)\/[^\s"'<>)]+)/gi;

/** Every booking page a page links to. */
function scanHtml(html: string): Booking[] {
  const found: Booking[] = [];
  for (const m of html.replaceAll("&amp;", "&").matchAll(BOOKING_LINK)) {
    const b = parseBookingUrl(m[0]);
    if (b && !found.some((f) => f.url === b.url)) found.push(b);
  }
  // BentoBox sites name the service and its id; an OpenTable id is enough for a link (a Resy id isn't).
  for (const m of html.matchAll(/data-reservation-service="opentable"[^>]*?data-reservation-id="(\d+)"/gi)) {
    const url = `https://www.opentable.com/restaurant/profile/${m[1]}`;
    if (!found.some((f) => f.url === url)) found.push({ provider: "opentable", url });
  }
  return found;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !["the", "and", "nyc", "ny", "new", "york", "restaurant", "bar"].includes(w));

/** The last part of a booking page's address ("the-spaniard"), or null for an id-only OpenTable link. */
function slugOf(b: Booking): string | null {
  if (b.provider === "opentable" && b.url.includes("/restaurant/profile/")) return null;
  if (b.provider === "sevenrooms") return b.url.split("/explore/")[1]?.split("/")[0] ?? null;
  return b.url.split("/").filter(Boolean).pop() ?? null;
}

/** The state or province in a Google address ("…, NY 10012, USA" → "ny"), when there is one. */
function stateOf(address: string | null | undefined): string | null {
  return address?.match(/,\s*([A-Z]{2})\s+(?:\d{5}|[A-Z]\d[A-Z])/)?.[1].toLowerCase() ?? null;
}

/** A Resy page's state, from its city ("new-york-ny", or the older "ny"). */
function resyState(b: Booking): string | null {
  const city = b.provider === "resy" ? b.url.match(/\/cities\/([a-z-]+)\//)?.[1] : null;
  return city ? (city.match(/-([a-z]{2})$/)?.[1] ?? (city.length === 2 ? city : null)) : null;
}

/**
 * The page for this place. A page must carry the place's name (a group's
 * site can link a sister restaurant: Monkey Bar's links Bavette's), and a
 * Resy page must be in the place's state (Little Hen's site links its Fort
 * Lauderdale one); with several, the one that also names its neighborhood
 * (Canto's West Village vs Upper West Side). OpenTable's id-only links come
 * from the site's own booking form and can't be checked, so they pass.
 */
export function pick(found: Booking[], place: { name: string; neighborhood?: string | null; address?: string | null }): Booking | null {
  const name = words(place.name).filter((w) => w.length >= 3);
  const area = words(place.neighborhood ?? "");
  const state = stateOf(place.address);
  const compact = (b: Booking) => (slugOf(b) ?? "").replace(/[^a-z0-9]/g, "");
  const named = found.filter((b) => {
    if (state && resyState(b) && resyState(b) !== state) return false;
    return slugOf(b) === null || name.some((w) => compact(b).includes(w));
  });
  const score = (b: Booking) => [...name, ...area].filter((w) => compact(b).includes(w)).length;
  return named.sort((a, b) => score(b) - score(a))[0] ?? null;
}

async function fetchPage(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    return { url: res.url, html: (await res.text()).slice(0, 2_000_000) };
  } catch {
    return null;
  }
}

/** The website's booking page: on its home page, or one "reservations" page on the same site. */
export async function findOnWebsite(website: string, place: { name: string; neighborhood?: string | null; address?: string | null }): Promise<Booking | null> {
  const direct = parseBookingUrl(website);
  if (direct) return pick([direct], place);
  const home = await fetchPage(website);
  if (!home) return null;
  let found = scanHtml(home.html);
  if (!found.length) {
    const link = home.html.match(/href=["']([^"'#]*reserv[^"']*)["']/i)?.[1];
    if (link) {
      try {
        const next = new URL(link, home.url);
        const nextBooking = parseBookingUrl(next.toString());
        if (nextBooking) found = [nextBooking];
        else if (next.hostname === new URL(home.url).hostname) {
          const page = await fetchPage(next.toString());
          if (page) found = scanHtml(page.html);
        }
      } catch {
        // A malformed link: nothing more to read.
      }
    }
  }
  return pick(found, place);
}

/** Google's word on the place: its website, and whether it takes reservations. */
export async function googleBookingFacts(googlePlaceId: string): Promise<{ website: string | null; reservable: boolean | null }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Google Maps API key not configured");
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=website,reservable&key=${apiKey}`,
  );
  const data = (await res.json()) as { status: string; error_message?: string; result?: { website?: string; reservable?: boolean } };
  if (data.status !== "OK") throw new Error(`Google Place Details: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  return { website: data.result?.website ?? null, reservable: data.result?.reservable ?? null };
}

export type BookingCheck = {
  website: string | null;
  reservable: boolean | null;
  booking: Booking | null;
};

/**
 * The whole check for one place. Only a place Google says takes
 * reservations gets a link: a group's website can point at another
 * location's page (Buvette's site links its London one).
 */
export async function checkBooking(place: { googlePlaceId: string; name: string; neighborhood?: string | null; address?: string | null }): Promise<BookingCheck> {
  const { website, reservable } = await googleBookingFacts(place.googlePlaceId);
  const booking = reservable === true && website ? await findOnWebsite(website, place) : null;
  return { website, reservable, booking };
}
