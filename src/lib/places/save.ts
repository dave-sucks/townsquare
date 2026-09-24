/**
 * The agent's writes: save / mark-been / rate a place, and add places to a
 * list. Same rules as the app's own endpoints (/api/saved-places POST and
 * /api/chat/save-all-to-list): default emoji on first save, activity rows,
 * a list created when missing.
 */

import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { getDefaultEmoji } from "@/lib/default-emoji";

/** The app's rating scale (SaveToListDropdown): 1 ehh, 3 liked, 5 loved. */
export const RATING_VALUES = { ehh: 1, liked: 3, loved: 5 } as const;
export type RatingWord = keyof typeof RATING_VALUES;

const toTypes = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** A Place by Townsquare id or Google place id. */
export async function findPlaceByAnyId(id: string) {
  return prisma.place.findFirst({
    where: { OR: [{ id }, { googlePlaceId: id }] },
    select: { id: true, googlePlaceId: true, name: true, primaryType: true, types: true, photoRefs: true, neighborhood: true },
  });
}

export async function savePlaceForUser(opts: {
  userId: string;
  placeId: string;
  status: "want_to_go" | "been";
  rating?: RatingWord;
}) {
  const place = await findPlaceByAnyId(opts.placeId);
  if (!place) throw new Error(`No place with id ${opts.placeId}`);

  const hasBeen = opts.status === "been";
  const rating = hasBeen && opts.rating ? RATING_VALUES[opts.rating] : null;
  const saved = await prisma.savedPlace.upsert({
    where: { userId_placeId: { userId: opts.userId, placeId: place.id } },
    update: { hasBeen, rating, visitedAt: hasBeen ? new Date() : null },
    create: {
      userId: opts.userId,
      placeId: place.id,
      hasBeen,
      rating,
      visitedAt: hasBeen ? new Date() : null,
      emoji: getDefaultEmoji(place.primaryType, toTypes(place.types)),
    },
    select: { id: true, emoji: true },
  });

  await createActivity({
    actorId: opts.userId,
    type: hasBeen ? "PLACE_MARKED_BEEN" : "PLACE_SAVED",
    placeId: place.id,
    metadata: { placeName: place.name, rating: rating ?? undefined },
  });

  return { place, saved, hasBeen, rating };
}

export async function addPlacesToList(opts: { userId: string; listName: string; placeIds: string[] }) {
  const name = opts.listName.trim();
  let list = await prisma.list.findFirst({
    where: { userId: opts.userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const created = !list;
  if (!list) {
    list = await prisma.list.create({
      data: { userId: opts.userId, name, visibility: "PRIVATE" },
      select: { id: true, name: true },
    });
  }

  const results: { placeId: string; googlePlaceId: string; name: string; emoji: string | null; photoRef: string | null; added: boolean }[] = [];
  for (const id of opts.placeIds) {
    const place = await findPlaceByAnyId(id);
    if (!place) continue;

    // A list place is also a save (the app's save-all flow does the same).
    const saved = await prisma.savedPlace.upsert({
      where: { userId_placeId: { userId: opts.userId, placeId: place.id } },
      update: {},
      create: {
        userId: opts.userId,
        placeId: place.id,
        hasBeen: false,
        emoji: getDefaultEmoji(place.primaryType, toTypes(place.types)),
      },
      select: { emoji: true },
    });

    const existing = await prisma.listPlace.findUnique({
      where: { listId_placeId: { listId: list.id, placeId: place.id } },
      select: { id: true },
    });
    if (!existing) await prisma.listPlace.create({ data: { listId: list.id, placeId: place.id } });

    results.push({
      placeId: place.id,
      googlePlaceId: place.googlePlaceId,
      name: place.name,
      emoji: saved.emoji,
      photoRef: toTypes(place.photoRefs)[0] ?? null,
      added: !existing,
    });
  }

  if (created) {
    await createActivity({
      actorId: opts.userId,
      type: "LIST_CREATED",
      listId: list.id,
      metadata: { listName: list.name, placeCount: results.filter((r) => r.added).length },
    });
  }

  return { list, created, results };
}
