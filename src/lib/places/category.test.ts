/**
 * The word a place is filed under. The regression: Google lists types
 * alphabetically and the stored primaryType is the first, so 251 of 437
 * places (Le Veau d'Or among them) said "Establishment".
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { placeCategory } from "./category";

const RESTAURANT = ["establishment", "food", "point_of_interest", "restaurant"];

test("skips Google's generic first type", () => {
  assert.equal(placeCategory("establishment", RESTAURANT), "Restaurant");
});

test("keeps a common kind Google put first", () => {
  assert.equal(placeCategory("bar", ["bar", "establishment", "point_of_interest", "restaurant"]), "Bar");
});

test("a type set by hand wins over Google's", () => {
  assert.equal(placeCategory("wine_bar", RESTAURANT), "Wine Bar");
});

test("falls back to the first specific type, then to nothing", () => {
  assert.equal(placeCategory("art_gallery", ["art_gallery", "establishment", "point_of_interest"]), "Art Gallery");
  assert.equal(placeCategory("establishment", ["establishment", "point_of_interest"]), "");
  assert.equal(placeCategory(null, null), "");
});
