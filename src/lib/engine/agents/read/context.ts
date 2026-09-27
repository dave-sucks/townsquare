/**
 * Read's Layer 2 digest: the post pre-digested into tagged blocks, plus the
 * facts the gates check the output against.
 */

import { ENGINE } from "../../config";
import { renderExamples, type ExampleRow } from "../../examples";

type Comment = {
  text?: string;
  ownerUsername?: string;
  likesCount?: number;
  replies?: Comment[];
};

type RawPost = {
  type?: string;
  productType?: string;
  timestamp?: string;
  locationName?: string;
  taggedUsers?: { username?: string }[];
  mentions?: string[];
  hashtags?: string[];
  coauthorProducers?: { username?: string }[];
  paidPartnership?: boolean;
  sponsors?: { username?: string }[] | string[];
  alt?: string;
  childPosts?: { alt?: string; taggedUsers?: { username?: string }[] }[];
  latestComments?: Comment[];
  videoDuration?: number;
};

export type ReadFacts = {
  caption: string;
  /** Accounts the post tags, @mentions or co-authors (lowercase, no @). */
  taggedAccounts: string[];
  locationName: string | null;
  /** Everything a score might be quoted from. */
  scoreSources: string;
};

const handleOf = (u: string) => u.replace(/^@/, "").trim().toLowerCase();
const unique = <T,>(xs: T[]) => [...new Set(xs)];

function describeType(raw: RawPost, childCount: number): string {
  if (raw.type === "Sidecar") return `carousel of ${childCount || "several"} photos/videos`;
  if (raw.type === "Video") return raw.productType === "clips" ? "reel (video)" : "video";
  return "photo";
}

export function buildReadContext(input: {
  handle: string;
  homeCity: string | null;
  notes: string | null;
  caption: string | null;
  postedAt: Date | string | null;
  raw: unknown;
  examples: ExampleRow[];
  reviewerNote?: string | null;
}): { text: string; facts: ReadFacts } {
  const raw = (input.raw ?? {}) as RawPost;
  const handle = handleOf(input.handle);
  const caption = input.caption ?? "";
  const children = raw.childPosts ?? [];

  const tagged = unique(
    [...(raw.taggedUsers ?? []), ...children.flatMap((c) => c.taggedUsers ?? [])]
      .map((u) => u.username)
      .filter((u): u is string => !!u)
      .map(handleOf),
  );
  // Apify's mentions list can miss handles the caption plainly @mentions.
  const inCaption = [...caption.matchAll(/@([A-Za-z0-9._]{2,30})/g)].map((m) => m[1].replace(/\.$/, ""));
  const mentioned = unique([...(raw.mentions ?? []), ...inCaption].map(handleOf));
  const coauthors = unique((raw.coauthorProducers ?? []).map((u) => u.username).filter((u): u is string => !!u).map(handleOf));
  const sponsors = unique(
    (raw.sponsors ?? []).map((s) => (typeof s === "string" ? s : s.username)).filter((s): s is string => !!s).map(handleOf),
  );

  // The creator's own words in the comments carry weight (they often answer "where is this?").
  const creatorReplies: string[] = [];
  const others: Comment[] = [];
  for (const c of raw.latestComments ?? []) {
    if (c.ownerUsername && handleOf(c.ownerUsername) === handle) creatorReplies.push(`- ${c.text ?? ""}`);
    else others.push(c);
    for (const r of c.replies ?? []) {
      if (r.ownerUsername && handleOf(r.ownerUsername) === handle) {
        creatorReplies.push(`- replying to @${c.ownerUsername} ("${(c.text ?? "").slice(0, 140)}"): ${r.text ?? ""}`);
      }
    }
  }
  const topOthers = others
    .filter((c) => (c.text ?? "").trim().length > 0)
    .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
    .slice(0, ENGINE.read.topComments)
    .map((c) => `- @${c.ownerUsername}: ${c.text}`);

  const alts = unique([raw.alt, ...children.map((c) => c.alt)].filter((a): a is string => !!a && a.trim().length > 0));
  const posted = input.postedAt ? new Date(input.postedAt).toISOString().slice(0, 10) : "unknown date";

  const postLines = [
    `Type: ${describeType(raw, children.length)} · Posted ${posted}`,
    `Location tag: ${raw.locationName || "none"}`,
    `Tagged accounts: ${tagged.length ? tagged.map((t) => `@${t}`).join(", ") : "none"}`,
    `@mentions in the caption: ${mentioned.length ? mentioned.map((t) => `@${t}`).join(", ") : "none"}`,
    coauthors.length ? `Co-authors: ${coauthors.map((t) => `@${t}`).join(", ")}` : null,
    `Hashtags: ${(raw.hashtags ?? []).length ? (raw.hashtags ?? []).map((h) => `#${h}`).join(" ") : "none"}`,
    `Paid partnership: ${raw.paidPartnership ? "yes" : "no"}${sponsors.length ? ` (sponsors: ${sponsors.map((s) => `@${s}`).join(", ")})` : ""}`,
  ].filter(Boolean);

  const blocks = [
    `<creator>\n@${handle}${input.homeCity ? ` · based in ${input.homeCity}` : ""}${input.notes ? `\nNotes: ${input.notes}` : ""}\n</creator>`,
    `<post>\n${postLines.join("\n")}\n</post>`,
    `<caption>\n${caption || "(no caption)"}\n</caption>`,
    alts.length ? `<alt_text>\nInstagram's description of the images:\n${alts.map((a) => `- ${a}`).join("\n")}\n</alt_text>` : null,
    creatorReplies.length || topOthers.length
      ? `<comments>\n${creatorReplies.length ? `The creator's own comments and replies:\n${creatorReplies.join("\n")}\n` : ""}${topOthers.length ? `Top comments from others:\n${topOthers.join("\n")}` : ""}\n</comments>`
      : null,
    renderExamples(input.examples, describeReadExample) || null,
    input.reviewerNote ? `<reviewer_note>\nA person reviewed an earlier reading of this post and said: ${input.reviewerNote}\n</reviewer_note>` : null,
  ].filter(Boolean);

  return {
    text: blocks.join("\n\n"),
    facts: {
      caption,
      taggedAccounts: unique([...tagged, ...mentioned, ...coauthors]),
      locationName: raw.locationName ?? null,
      scoreSources: [caption, ...creatorReplies].join("\n"),
    },
  };
}

/** An example as the post's caption and the places a person approved. */
function describeReadExample(row: ExampleRow): string {
  const input = (row.input ?? {}) as { caption?: string; locationTag?: string | null };
  const expected = (row.expected ?? {}) as { postType?: string; places?: { name: string; excerpt?: string; verdict?: string }[] };
  const places = (expected.places ?? [])
    .map((p) => `- ${p.name}${p.verdict ? ` (${p.verdict})` : ""}${p.excerpt ? `: "${p.excerpt.slice(0, 200)}"` : ""}`)
    .join("\n");
  return `Caption: ${(input.caption ?? "").slice(0, 600)}\nLocation tag: ${input.locationTag ?? "none"}\nPost type: ${expected.postType ?? "?"}\nPlaces:\n${places || "(none)"}`;
}
