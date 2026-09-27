/**
 * Send engine events from the command line (to the Inngest Dev Server under
 * INNGEST_DEV=1, else to Inngest Cloud with INNGEST_EVENT_KEY).
 *
 *   npx tsx scripts/engine-run.ts post <postId|shortcode>... [--from resolve|tag]
 *   npx tsx scripts/engine-run.ts sample            the dev sample (docs/engine/sample.json)
 *   npx tsx scripts/engine-run.ts sync <handle>
 *   npx tsx scripts/engine-run.ts place <placeId>...
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.development.local", quiet: true });
dotenv.config({ quiet: true });

async function main() {
  const { inngest, placeChanged, postReprocess, sourceSync } = await import("../src/lib/engine/inngest");
  const { prisma } = await import("../src/lib/prisma");
  const [cmd, ...rest] = process.argv.slice(2);
  const fromIdx = rest.indexOf("--from");
  const fromStage = fromIdx >= 0 ? rest[fromIdx + 1] : undefined;
  const args = fromIdx >= 0 ? rest.slice(0, fromIdx) : rest;

  const postIds = async (keys: string[]) => {
    const rows = await prisma.ingestedPost.findMany({
      where: { OR: [{ id: { in: keys } }, { canonicalPostId: { in: keys } }] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  };

  if (cmd === "post" || cmd === "sample") {
    let keys = args;
    if (cmd === "sample") {
      const { readFileSync } = await import("node:fs");
      keys = (JSON.parse(readFileSync("docs/engine/sample.json", "utf8")) as { shortcode: string }[]).map((s) => s.shortcode);
    }
    const ids = await postIds(keys);
    await inngest.send(ids.map((postId) => postReprocess.create({ postId, requestedBy: "builder", ...(fromStage ? { fromStage } : {}) })));
    console.log(`Sent engine/post.reprocess for ${ids.length} post(s)${fromStage ? ` from ${fromStage}` : ""}.`);
  } else if (cmd === "sync") {
    const source = await prisma.source.findFirstOrThrow({ where: { handle: { equals: args[0], mode: "insensitive" } } });
    await inngest.send(sourceSync.create({ sourceId: source.id }));
    console.log(`Sent engine/source.sync for @${source.handle}.`);
  } else if (cmd === "place") {
    await inngest.send(args.map((placeId) => placeChanged.create({ placeId })));
    console.log(`Sent engine/place.changed for ${args.length} place(s).`);
  } else {
    console.log("Usage: engine-run.ts post <id|shortcode>... [--from resolve|tag] | sample | sync <handle> | place <placeId>...");
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
