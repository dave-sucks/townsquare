/**
 * Finds the booking page for every visible place that hasn't been checked
 * (or every place, with --all), from its website. New places get theirs from
 * the engine's place refresh; this fills in the ones from before.
 *
 *   npx tsx scripts/booking-backfill.ts [--all] [--limit N]
 *
 * Each place is one Google Place Details call (website + reservable) and a
 * fetch of the place's website. No model calls.
 */

import dotenv from "dotenv";

dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const all = args.includes("--all");
const limit = Number(args[args.indexOf("--limit") + 1]) || undefined;
const CONCURRENCY = 4;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { runBooking } = await import("../src/lib/engine/stages/booking");

  const places = await prisma.place.findMany({
    where: { isHidden: false, mergedIntoId: null, bookingManual: false, ...(all ? {} : { bookingCheckedAt: null }) },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  console.log(`Checking ${places.length} places…`);

  const tally: Record<string, number> = {};
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < places.length) {
      const p = places[next++];
      try {
        const { output } = await runBooking(p.id, { force: true });
        const key = output.provider ?? (output.reservable ? "takes reservations, no link found" : "no online reservations");
        tally[key] = (tally[key] ?? 0) + 1;
        if (output.provider) console.log(`${p.name.slice(0, 36).padEnd(36)} ${output.url}`);
      } catch (err) {
        failed++;
        console.log(`${p.name.slice(0, 36).padEnd(36)} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log("\n" + Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join("\n"));
  if (failed) console.log(`failed: ${failed}`);
  await prisma.$disconnect();
}

main();
