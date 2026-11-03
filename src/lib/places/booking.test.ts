/**
 * Booking links: every link form a restaurant site uses comes out as the
 * platform's own page, and the Book link fills in the date and party size.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingHref, parseBookingUrl, pick } from "./booking";

test("Resy venue links, including the older form without /venues/", () => {
  assert.deepEqual(parseBookingUrl("https://resy.com/cities/new-york-ny/venues/the-spaniard?date=2026-10-24&seats=2"), {
    provider: "resy",
    url: "https://resy.com/cities/new-york-ny/venues/the-spaniard",
  });
  assert.equal(parseBookingUrl("https://resy.com/cities/ny/do-not-disturb")?.url, "https://resy.com/cities/ny/venues/do-not-disturb");
  assert.equal(parseBookingUrl("https://resy.com/cities/new-york-ny"), null);
});

test("OpenTable pages, by slug or by restaurant id", () => {
  assert.equal(parseBookingUrl("https://www.opentable.com/r/bufon-new-york")?.url, "https://www.opentable.com/r/bufon-new-york");
  assert.equal(
    parseBookingUrl("//www.opentable.com/restref/client/?rid=1015270&restref=1015270&lang=en-US")?.url,
    "https://www.opentable.com/restaurant/profile/1015270",
  );
  assert.equal(parseBookingUrl("https://www.opentable.com/restaurant/profile/1015270")?.provider, "opentable");
});

test("Tock and SevenRooms pages; Tock's own pages aren't venues", () => {
  assert.equal(parseBookingUrl("https://www.exploretock.com/atera/")?.url, "https://www.exploretock.com/atera");
  assert.equal(parseBookingUrl("https://www.exploretock.com/city/new-york-city"), null);
  assert.equal(
    parseBookingUrl("https://www.sevenrooms.com/reservations/baccarathotelgrandsalon")?.url,
    "https://www.sevenrooms.com/explore/baccarathotelgrandsalon/reservations/create/search",
  );
  assert.equal(parseBookingUrl("https://www.example.com/reservations"), null);
});

test("the Book link carries the date and party size", () => {
  const when = { date: "2026-10-24", seats: 4 };
  assert.equal(bookingHref({ provider: "resy", url: "https://resy.com/cities/new-york-ny/venues/the-spaniard" }, when), "https://resy.com/cities/new-york-ny/venues/the-spaniard?date=2026-10-24&seats=4");
  assert.equal(
    bookingHref({ provider: "opentable", url: "https://www.opentable.com/r/la-nacional-restaurant-new-york" }, when),
    "https://www.opentable.com/r/la-nacional-restaurant-new-york?covers=4&dateTime=2026-10-24T19%3A00",
  );
  assert.match(bookingHref({ provider: "sevenrooms", url: "https://www.sevenrooms.com/explore/x/reservations/create/search" }, when), /date=2026-10-24&party_size=4$/);
});

test("a page must carry the place's name; among several, the neighborhood decides", () => {
  const resy = (slug: string) => ({ provider: "resy" as const, url: `https://resy.com/cities/new-york-ny/venues/${slug}` });
  assert.equal(pick([resy("bavettes-bar-and-boeuf")], { name: "Monkey Bar" }), null);
  assert.equal(pick([resy("canto-upper-west-side"), resy("canto-west-village")], { name: "Canto West Village", neighborhood: "West Village" })?.url, resy("canto-west-village").url);
  assert.equal(pick([resy("dannys-nyc")], { name: "Danny’s" })?.url, resy("dannys-nyc").url);
  assert.equal(pick([resy("and-son-greenwich-village")], { name: "& Son Steakeasy" })?.url, resy("and-son-greenwich-village").url);
  assert.ok(pick([{ provider: "opentable", url: "https://www.opentable.com/restaurant/profile/213" }], { name: "Union Square Cafe" }));
});

test("a Resy page in another state is another branch", () => {
  const nyc = { name: "Little Hen", address: "155 Bleecker St, New York, NY 10012, USA" };
  assert.equal(pick([{ provider: "resy", url: "https://resy.com/cities/fort-lauderdale-fl/venues/little-hen-fort-lauderdale" }], nyc), null);
  assert.ok(pick([{ provider: "resy", url: "https://resy.com/cities/ny/venues/little-hen" }], nyc));
  assert.ok(pick([{ provider: "resy", url: "https://resy.com/cities/toronto-on/venues/bar-eugenie" }], { name: "Bar Eugenie", address: "1 King St W, Toronto, ON M5H 1A1, Canada" }));
});
