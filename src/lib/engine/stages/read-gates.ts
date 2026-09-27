/**
 * Read's gates (Layer 1): the rules code can check in Read's answer, and
 * what a place keeps when one still fails after the retry. Pure, so they're
 * tested without the database.
 */

import type { ReadFacts } from "../agents/read/context";
import type { ReadOutput } from "../agents/read/schema";
import { isVerbatim } from "../text";

/** A broken rule: the place it's about (null for the post) and the optional field that broke it. */
export type GateFailure = { place: number | null; field: "excerpt" | "taggedAccount" | "score" | null; message: string };

/** Layer 1: the rules code can check. */
export function checkRead(out: ReadOutput, facts: ReadFacts): GateFailure[] {
  const failures: GateFailure[] = [];
  if (out.postType === "not_a_place" && out.places.length > 0) {
    failures.push({
      place: null,
      field: null,
      message: "The post type is not_a_place, but places are listed. List no places, or choose the post type that fits.",
    });
  }
  const tagged = new Set(facts.taggedAccounts);
  out.places.forEach((p, i) => {
    if (p.excerptSource === "transcript") {
      failures.push({ place: i, field: "excerpt", message: `"${p.name}": this post has no transcript, so the excerpt must come from the caption.` });
    } else if (!isVerbatim(p.excerpt, facts.caption)) {
      failures.push({
        place: i,
        field: "excerpt",
        message: `"${p.name}": the excerpt is not copied word for word from the caption. Copy the caption's exact text (you may cut it short, but don't change or add words), or leave it empty if the caption says nothing about this place.`,
      });
    }
    if (p.taggedAccount) {
      const acct = p.taggedAccount.replace(/^@/, "").trim().toLowerCase();
      if (!tagged.has(acct)) {
        failures.push({
          place: i,
          field: "taggedAccount",
          message: `"${p.name}": @${acct} is not an account this post tags or mentions (${facts.taggedAccounts.length ? facts.taggedAccounts.map((a) => `@${a}`).join(", ") : "it tags none"}). Use one of those, or null.`,
        });
      }
    }
    if (p.score && !isVerbatim(p.score, facts.scoreSources)) {
      failures.push({ place: i, field: "score", message: `"${p.name}": the score "${p.score}" doesn't appear in the post. Copy it exactly as written, or null.` });
    }
  });
  return failures;
}

/**
 * What survives the gates after the retry. Every per-place rule is about an
 * optional field (excerpt, tagged account, score), so a place keeps its name
 * and loses only the field that broke the rule: a bad excerpt never costs a
 * post its place. A post-level contradiction (not a place, yet places listed)
 * keeps no places, and the mentions step then leaves the post's existing
 * mentions alone.
 */
export function repairPlaces(out: ReadOutput, failures: GateFailure[]): ReadOutput["places"] {
  if (failures.some((f) => f.place === null)) return [];
  return out.places.map((p, i) => {
    const broken = new Set(failures.filter((f) => f.place === i).map((f) => f.field));
    return {
      ...p,
      ...(broken.has("excerpt") ? { excerpt: "", excerptSource: "caption" as const } : {}),
      ...(broken.has("taggedAccount") ? { taggedAccount: null } : {}),
      ...(broken.has("score") ? { score: null } : {}),
    };
  });
}
