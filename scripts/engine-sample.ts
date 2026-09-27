/**
 * Picks the 60-post dev sample the engine is iterated on, and writes it to
 * docs/engine/sample.json. Deterministic: the same posts every time.
 *
 * Mix: every source; posts the old importer matched by location tag, posts
 * Dave matched by hand, and posts it left unresolved; plus the multi-place
 * roundups that motivated mentions.
 *
 *   npx tsx scripts/engine-sample.ts
 */

import { writeFileSync } from "node:fs";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

/** Roundups and odd cases worth keeping in every run. */
const MUST = [
  { match: "top rated bakeries in the U.S.", why: "roundup: 12 bakeries in 8 cities (Dave's screenshot)" },
  { match: "top 12 rated taquerias", why: "roundup: 12 taquerias across the US" },
  { match: "top 3 rated bakeries in LA", why: "roundup: 3 LA bakeries" },
  { match: "Our favorite bakeries we tried in 2025", why: "roundup; the post stuck in 'new' since Feb 23" },
  { match: "Top 5 Chicago bakeries", why: "roundup: 20 places, tagged 'Chicago, Illinois' (old import matched University Club)" },
];

async function main() {
  const { Prisma } = await import("../src/generated/prisma");
  const { prisma } = await import("../src/lib/prisma");

  const picked = new Map<string, { shortcode: string; handle: string; why: string }>();
  for (const m of MUST) {
    const post = await prisma.ingestedPost.findFirst({
      where: { caption: { contains: m.match, mode: "insensitive" } },
      select: { canonicalPostId: true, authorHandle: true },
    });
    if (post) picked.set(post.canonicalPostId, { shortcode: post.canonicalPostId, handle: post.authorHandle, why: m.why });
  }

  // Per source: 2 location-tag matches, 1 hand-matched, 2 unresolved, by a stable hash.
  const strata = [
    { label: "old import: location tag match", where: Prisma.sql`status = 'processed' AND resolve_method = 'geotag'`, n: 2 },
    { label: "old import: matched by hand", where: Prisma.sql`status = 'processed' AND resolve_method = 'manual'`, n: 1 },
    { label: "old import: caption match", where: Prisma.sql`status = 'processed' AND resolve_method = 'caption'`, n: 0 },
    { label: "old import: unresolved", where: Prisma.sql`status = 'unresolved'`, n: 2 },
  ];
  const sources = await prisma.source.findMany({ select: { handle: true }, orderBy: { handle: "asc" } });
  for (const s of sources) {
    for (const st of strata) {
      if (st.n === 0) continue;
      const rows = await prisma.$queryRaw<{ canonical_post_id: string }[]>(Prisma.sql`
        SELECT canonical_post_id FROM ingested_posts
         WHERE author_handle = ${s.handle} AND ${st.where}
           AND length(coalesce(caption, '')) < 2500
         ORDER BY md5(canonical_post_id) LIMIT ${st.n + 2}`);
      let added = 0;
      for (const r of rows) {
        if (added >= st.n || picked.has(r.canonical_post_id)) continue;
        picked.set(r.canonical_post_id, { shortcode: r.canonical_post_id, handle: s.handle, why: st.label });
        added++;
      }
    }
  }

  // Top up to 60 with caption matches the old importer made, then anything else.
  for (const where of [Prisma.sql`status = 'processed' AND resolve_method = 'caption'`, Prisma.sql`true`]) {
    if (picked.size >= 60) break;
    const rows = await prisma.$queryRaw<{ canonical_post_id: string; author_handle: string }[]>(Prisma.sql`
      SELECT canonical_post_id, author_handle FROM ingested_posts
       WHERE ${where} AND length(coalesce(caption, '')) < 2500
       ORDER BY md5(canonical_post_id) LIMIT 80`);
    for (const r of rows) {
      if (picked.size >= 60) break;
      if (!picked.has(r.canonical_post_id)) {
        picked.set(r.canonical_post_id, { shortcode: r.canonical_post_id, handle: r.author_handle, why: "old import: caption match" });
      }
    }
  }

  const sample = [...picked.values()].slice(0, 60);
  writeFileSync("docs/engine/sample.json", JSON.stringify(sample, null, 2) + "\n");
  const counts = sample.reduce<Record<string, number>>((acc, s) => ((acc[s.why] = (acc[s.why] ?? 0) + 1), acc), {});
  console.log(`${sample.length} posts`, counts);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
