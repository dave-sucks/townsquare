/**
 * Read's gates, and what a place keeps when a gate still fails after the
 * retry. The regression: a burger post about The Spaniard lost its place
 * (and its correct match) because Read's excerpt wasn't word for word.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReadFacts } from "../agents/read/context";
import type { ReadOutput, ReadPlace } from "../agents/read/schema";
import { checkRead, repairPlaces } from "./read-gates";

const caption =
  "The ultimate smash!!! @thespaniardnyc Double-Double, American Cheese, Lettuce, Pickles, Homemade Burger Sauce, & Sesame Seed Bun. A crispy smashburger with the right balance of flavors 🍔 Overall Rating: 8.1 (Special shout of for the fluffiest onion rings aka onion clouds!)";

const facts: ReadFacts = {
  caption,
  taggedAccounts: ["thespaniardnyc", "burger_club_nyc"],
  locationName: "The Spaniard",
  scoreSources: caption,
};

const place = (over: Partial<ReadPlace> = {}): ReadPlace => ({
  name: "The Spaniard",
  evidence: ["caption", "location_tag", "tagged_account"],
  taggedAccount: "thespaniardnyc",
  addressHint: null,
  areaHint: null,
  role: "primary",
  excerpt: "A crispy smashburger with the right balance of flavors",
  excerptSource: "caption",
  dishes: [{ name: "Double-Double", sentiment: "positive" }],
  verdict: "loved",
  score: "8.1",
  confidence: "high",
  missing: null,
  ...over,
});

const answer = (places: ReadPlace[], postType: ReadOutput["postType"] = "single_place"): ReadOutput => ({
  postType,
  notPlaceReason: null,
  sponsored: false,
  places,
});

test("a clean answer passes the gates and keeps every field", () => {
  const out = answer([place()]);
  const failures = checkRead(out, facts);
  assert.deepEqual(failures, []);
  assert.deepEqual(repairPlaces(out, failures), out.places);
});

test("an excerpt that isn't word for word costs the excerpt, not the place", () => {
  // The model "fixed" the caption's typo, so the excerpt isn't verbatim.
  const out = answer([place({ excerpt: "Special shout out for the fluffiest onion rings" })]);
  const failures = checkRead(out, facts);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].field, "excerpt");
  const [kept] = repairPlaces(out, failures);
  assert.equal(kept.name, "The Spaniard");
  assert.equal(kept.excerpt, "");
  assert.equal(kept.taggedAccount, "thespaniardnyc");
  assert.equal(kept.score, "8.1");
  assert.deepEqual(kept.dishes, out.places[0].dishes);
});

test("an account the post doesn't tag, or a score it doesn't give, is cleared and the place stays", () => {
  const out = answer([place({ taggedAccount: "spaniard_official", score: "9.2" })]);
  const failures = checkRead(out, facts);
  assert.deepEqual(failures.map((f) => f.field).sort(), ["score", "taggedAccount"]);
  const [kept] = repairPlaces(out, failures);
  assert.equal(kept.taggedAccount, null);
  assert.equal(kept.score, null);
  assert.equal(kept.excerpt, out.places[0].excerpt);
});

test("only the place that broke a rule is touched", () => {
  const out = answer([place(), place({ name: "Other Spot", taggedAccount: null, excerpt: "not in the caption at all", score: null })], "roundup");
  const failures = checkRead(out, facts);
  assert.deepEqual(failures.map((f) => f.place), [1]);
  const kept = repairPlaces(out, failures);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].excerpt, out.places[0].excerpt);
  assert.equal(kept[1].excerpt, "");
});

test("a post-level contradiction keeps no places", () => {
  const out = answer([place()], "not_a_place");
  const failures = checkRead(out, facts);
  assert.ok(failures.some((f) => f.place === null));
  assert.deepEqual(repairPlaces(out, failures), []);
});
