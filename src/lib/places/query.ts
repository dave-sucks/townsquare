/**
 * The agent's one read path for places (docs/AGENT_CHAT_REBUILD.md §6).
 *
 * search_places, places_from_people_i_follow, get_my_places, get_creator
 * and find_creators all come through here, so matching, area math and the
 * PlaceRow shape are defined once and the tools stay thin.
 *
 * Matching: a query like "burger" or "natural wine" hits place tags (both
 * the per-place tags and the tag aggregates), the place name, the AI
 * summary, and creators' post captions. place_tags is the dense signal
 * (306 of 313 places tagged, 2026-09-23); place_tag_aggregates is sparse
 * (75 rows), so it only adds weight.
 *
 * Ranking: distinct creators, then posts in the last 90 days, then all
 * posts, then match strength.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getChatCategory } from "@/lib/places/category";
import { formatPriceLevel } from "@/lib/places/format";
import type { PlaceRow } from "@/lib/agent/place-row";
import type { LatLng, MapBounds, ToolContext } from "@/lib/agent/tool-context";

// ── Area ────────────────────────────────────────────────────────────────────

/** How far "near me" reaches when there is no map view to use. */
export const NEAR_ME_RADIUS_MI = 1.5;

export type ResolvedArea =
  | ({ kind: "bbox"; label: string } & MapBounds)
  | { kind: "named"; name: string; label: string }
  | { kind: "anywhere"; label: string };

function bboxAround(center: LatLng, radiusMi: number): MapBounds {
  const latDelta = radiusMi / 69;
  const lngDelta = radiusMi / (69 * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

/**
 * area: "bounds" (the map view), "near_me", "anywhere", or a neighborhood /
 * city name. Omitted → the map view if there is one, else near the user,
 * else anywhere — "this area" should never make the agent ask where you are.
 */
export function resolveArea(
  area: string | undefined,
  ctx: Pick<ToolContext, "location" | "mapBounds">,
): ResolvedArea {
  const a = area?.trim().toLowerCase();
  const fromBounds = (): ResolvedArea | null =>
    ctx.mapBounds ? { kind: "bbox", label: "in this map area", ...ctx.mapBounds } : null;
  const fromLocation = (): ResolvedArea | null =>
    ctx.location
      ? { kind: "bbox", label: "near you", ...bboxAround(ctx.location, NEAR_ME_RADIUS_MI) }
      : null;
  const anywhere: ResolvedArea = { kind: "anywhere", label: "anywhere" };

  if (!a || a === "bounds" || a === "map" || a === "this area" || a === "here") {
    return fromBounds() ?? fromLocation() ?? anywhere;
  }
  if (a === "near_me" || a === "near me" || a === "nearby") {
    return fromLocation() ?? fromBounds() ?? anywhere;
  }
  if (a === "anywhere" || a === "all" || a === "everywhere") return anywhere;
  return { kind: "named", name: area!.trim(), label: `in ${area!.trim()}` };
}

function areaFilter(area: ResolvedArea, alias = "p"): Prisma.Sql {
  const t = Prisma.raw(alias);
  if (area.kind === "bbox") {
    const crossesDateline = area.west > area.east;
    const lng = crossesDateline
      ? Prisma.sql`(${t}.lng >= ${area.west} OR ${t}.lng <= ${area.east})`
      : Prisma.sql`${t}.lng BETWEEN ${area.west} AND ${area.east}`;
    return Prisma.sql`AND ${t}.lat BETWEEN ${area.south} AND ${area.north} AND ${lng}`;
  }
  if (area.kind === "named") {
    const pat = `%${area.name}%`;
    return Prisma.sql`AND (${t}.neighborhood ILIKE ${pat} OR ${t}.locality ILIKE ${pat} OR ${t}.formatted_address ILIKE ${pat})`;
  }
  return Prisma.empty;
}

// ── Query terms ─────────────────────────────────────────────────────────────

const FILLER = new Set([
  "spot", "spots", "place", "places", "joint", "joints", "food", "good", "best",
  "great", "near", "me", "around", "here", "the", "a", "an", "in", "for", "some",
]);

/** Venue nouns that describe the kind of place, not what it's known for. */
const VENUE = new Set([
  "bar", "bars", "restaurant", "restaurants", "cafe", "cafes", "café", "cafés",
  "shop", "shops", "place", "places", "spot", "spots", "joint", "joints",
]);

function queryWords(query: string | undefined): string[] {
  return (query ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));
}

function withPlurals(phrase: string): string[] {
  const variants = new Set([phrase]);
  if (phrase.endsWith("es") && phrase.length > 4) variants.add(phrase.slice(0, -2));
  if (phrase.endsWith("s") && phrase.length > 3) variants.add(phrase.slice(0, -1));
  else variants.add(`${phrase}s`);
  return [...variants];
}

/**
 * "burger spots" → ["burger", "burgers"]; "natural wine" → ["natural wine",
 * "natural wines"]. Filler words drop out; the phrase stays a phrase.
 */
export function matchTerms(query: string | undefined): string[] {
  const words = queryWords(query);
  return words.length === 0 ? [] : withPlurals(words.join(" "));
}

/**
 * A match spec: groups of alternative patterns; a place must hit at least
 * one pattern from EVERY group.
 */
export type TermGroups = string[][];

/**
 * Looser and looser match specs for a query, for when the exact phrase finds
 * nothing:
 *   "natural wine bar" → the phrase
 *                      → "natural wine" (venue nouns dropped)
 *                      → "natural" AND "wine", anywhere on the place
 */
export function relaxedTermSets(query: string | undefined): TermGroups[] {
  const words = queryWords(query);
  if (words.length === 0) return [[]];
  const specs: TermGroups[] = [[withPlurals(words.join(" "))]];
  const core = words.filter((w) => !VENUE.has(w));
  if (core.length > 0 && core.length < words.length) specs.push([withPlurals(core.join(" "))]);
  const meaningful = core.filter((w) => w.length >= 3);
  if (meaningful.length > 1) specs.push(meaningful.map(withPlurals));
  return specs;
}

function describeSpec(spec: TermGroups): string {
  return spec.map((g) => g[0]).join(" + ");
}

// ── Creator scope ───────────────────────────────────────────────────────────

export type CreatorScope =
  | { kind: "all" }
  /** Only posts by creators the viewer follows. */
  | { kind: "following"; userId: string }
  /** Only one creator's posts. */
  | { kind: "creator"; creatorId: string };

function reviewScope(scope: CreatorScope, alias = "r"): Prisma.Sql {
  const t = Prisma.raw(alias);
  if (scope.kind === "following") {
    return Prisma.sql`AND ${t}.user_id IN (SELECT following_id FROM follows WHERE follower_id = ${scope.userId})`;
  }
  if (scope.kind === "creator") return Prisma.sql`AND ${t}.user_id = ${scope.creatorId}`;
  return Prisma.empty;
}

/**
 * Place ids that match the terms, with a match weight. Tag and name hits
 * weigh most, captions next, AI summaries least. Tag slugs are compared with
 * - and _ read as spaces ("dive-bar", "late_night").
 */
function matchedPlacesCte(groups: TermGroups, scope: CreatorScope): Prisma.Sql {
  const rows = groups.flatMap((g, gi) => g.map((t) => Prisma.sql`(${gi}::int, ${`%${t}%`}::text)`));
  return Prisma.sql`
    terms AS (SELECT * FROM (VALUES ${Prisma.join(rows)}) AS v(grp, pat)),
    hits AS (
      SELECT pt.place_id, 4 AS w, terms.grp
        FROM place_tags pt JOIN tags t ON t.id = pt.tag_id, terms
       WHERE regexp_replace(t.slug, '[-_]', ' ', 'g') ILIKE terms.pat OR t.display_name ILIKE terms.pat
      UNION ALL
      SELECT a.place_id, 4 AS w, terms.grp
        FROM place_tag_aggregates a JOIN tags t ON t.id = a.tag_id, terms
       WHERE NOT a.is_suppressed
         AND (regexp_replace(t.slug, '[-_]', ' ', 'g') ILIKE terms.pat OR t.display_name ILIKE terms.pat)
      UNION ALL
      SELECT p.id AS place_id, 5 AS w, terms.grp FROM places p, terms WHERE p.name ILIKE terms.pat
      UNION ALL
      SELECT r.place_id, 3 AS w, terms.grp FROM reviews r, terms
       WHERE r.social_post_caption ILIKE terms.pat ${reviewScope(scope)}
      UNION ALL
      SELECT p.id AS place_id, 1 AS w, terms.grp FROM places p, terms WHERE p.ai_summary ILIKE terms.pat
    ),
    matched AS (
      SELECT place_id, max(w) AS score FROM hits
       GROUP BY place_id
      HAVING count(DISTINCT grp) = ${groups.length}
    )`;
}

// ── findPlaces ──────────────────────────────────────────────────────────────

export type PlaceSort = "most_posted" | "trending" | "closest";

export type FindPlacesOptions = {
  query?: string;
  area: ResolvedArea;
  scope: CreatorScope;
  sort?: PlaceSort;
  limit: number;
  /** The viewer — for follow state and their saves. */
  userId: string;
  location?: LatLng;
};

type CandidateRow = {
  place_id: string;
  score: number;
  posts: number;
  creators: number;
  recent_posts: number;
  last_post: Date | null;
  lat: number;
  lng: number;
  total: number;
};

/**
 * Search, loosening the query until something matches (see relaxedTermSets).
 * `matchedOn` says which wording hit, so the tool can tell the model.
 */
export async function findPlaces(
  opts: FindPlacesOptions,
): Promise<{ places: PlaceRow[]; total: number; matchedOn?: string }> {
  const specs = relaxedTermSets(opts.query);
  for (let i = 0; i < specs.length; i++) {
    const res = await findPlacesWithTerms(opts, specs[i]);
    if (res.total > 0 || i === specs.length - 1) {
      return { ...res, ...(i > 0 ? { matchedOn: describeSpec(specs[i]) } : {}) };
    }
  }
  return { places: [], total: 0 };
}

async function findPlacesWithTerms(
  opts: FindPlacesOptions,
  groups: TermGroups,
): Promise<{ places: PlaceRow[]; total: number }> {
  const hasTerms = groups.length > 0;
  const scoped = opts.scope.kind !== "all";
  // With a creator scope a place must have a post in scope; otherwise
  // unposted places (imported via someone's save) can still match, ranked
  // below posted ones.
  const statsJoin = scoped ? Prisma.sql`JOIN` : Prisma.sql`LEFT JOIN`;

  const matchCtes = hasTerms ? Prisma.sql`${matchedPlacesCte(groups, opts.scope)},` : Prisma.empty;
  const matchJoin = hasTerms ? Prisma.sql`JOIN matched m ON m.place_id = p.id` : Prisma.empty;
  const matchScore = hasTerms ? Prisma.sql`m.score` : Prisma.sql`0`;

  const order =
    opts.sort === "trending"
      ? Prisma.sql`recent_posts DESC, last_post DESC NULLS LAST, creators DESC`
      : Prisma.sql`creators DESC, recent_posts DESC, posts DESC, score DESC, last_post DESC NULLS LAST`;

  // "closest" is sorted in JS from coordinates, so fetch a wider pool.
  const poolLimit = opts.sort === "closest" && opts.location ? 200 : opts.limit;

  const rows = await prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
    WITH ${matchCtes}
    stats AS (
      SELECT r.place_id,
             count(*)::int AS posts,
             count(DISTINCT r.user_id)::int AS creators,
             (count(*) FILTER (WHERE r.social_post_posted_at > now() - interval '90 days'))::int AS recent_posts,
             max(coalesce(r.social_post_posted_at, r.created_at)) AS last_post
        FROM reviews r
       WHERE true ${reviewScope(opts.scope)}
       GROUP BY r.place_id
    )
    SELECT p.id AS place_id,
           ${matchScore}::int AS score,
           coalesce(s.posts, 0)::int AS posts,
           coalesce(s.creators, 0)::int AS creators,
           coalesce(s.recent_posts, 0)::int AS recent_posts,
           s.last_post,
           p.lat, p.lng,
           (count(*) OVER ())::int AS total
      FROM places p
      ${matchJoin}
      ${statsJoin} stats s ON s.place_id = p.id
     WHERE true ${areaFilter(opts.area)}
     ORDER BY ${order}
     LIMIT ${poolLimit}`);

  let picked = rows;
  if (opts.sort === "closest" && opts.location) {
    const here = opts.location;
    picked = [...rows]
      .sort((a, b) => distanceMi(here, a) - distanceMi(here, b))
      .slice(0, opts.limit);
  }

  const places = await hydratePlaceRows(
    picked.map((r) => r.place_id),
    { userId: opts.userId, scope: opts.scope, location: opts.location },
  );
  return { places, total: rows[0]?.total ?? 0 };
}

// ── findCreators ────────────────────────────────────────────────────────────

export type CreatorHit = {
  userId: string;
  username: string;
  avatar: string | null;
  isFollowed: boolean;
  posts: number;
  places: number;
  topPlaces: string[];
};

/** Creators ranked by how many matching posts they have in the area. */
export async function findCreators(opts: {
  query?: string;
  area: ResolvedArea;
  userId: string;
  limit: number;
}): Promise<CreatorHit[]> {
  const terms = matchTerms(opts.query);
  const matchCtes = terms.length > 0 ? Prisma.sql`WITH ${matchedPlacesCte([terms], { kind: "all" })}` : Prisma.empty;
  const matchJoin = terms.length > 0 ? Prisma.sql`JOIN matched m ON m.place_id = p.id` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { user_id: string; username: string | null; first_name: string | null; avatar: string | null; posts: number; places: number; followed: boolean; top_places: string[] }[]
  >(Prisma.sql`
    ${matchCtes}
    SELECT u.id AS user_id, u.username, u.first_name, u.profile_image_url AS avatar,
           count(*)::int AS posts,
           count(DISTINCT p.id)::int AS places,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${opts.userId} AND f.following_id = u.id) AS followed,
           (array_agg(DISTINCT p.name))[1:3] AS top_places
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN places p ON p.id = r.place_id
      ${matchJoin}
     WHERE u.id <> ${opts.userId} ${areaFilter(opts.area)}
     GROUP BY u.id
     ORDER BY posts DESC, places DESC
     LIMIT ${opts.limit}`);

  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username ?? r.first_name ?? "creator",
    avatar: r.avatar,
    isFollowed: r.followed,
    posts: r.posts,
    places: r.places,
    topPlaces: r.top_places ?? [],
  }));
}

// ── getMyPlaces ─────────────────────────────────────────────────────────────

export type MyPlacesFilter = "all" | "want_to_go" | "been" | "list";

/** The viewer's saves (optionally one list), newest first, in an area. */
export async function getMyPlaces(opts: {
  userId: string;
  filter: MyPlacesFilter;
  listName?: string;
  area: ResolvedArea;
  limit: number;
  location?: LatLng;
}): Promise<{ places: PlaceRow[]; total: number; listName?: string; listFound: boolean }> {
  let listFilter = Prisma.empty;
  let resolvedList: string | undefined;
  let listFound = true;

  if (opts.filter === "list") {
    const list = opts.listName
      ? await prisma.list.findFirst({
          where: { userId: opts.userId, name: { equals: opts.listName, mode: "insensitive" } },
          select: { id: true, name: true },
        }) ??
        (await prisma.list.findFirst({
          where: { userId: opts.userId, name: { contains: opts.listName, mode: "insensitive" } },
          select: { id: true, name: true },
        }))
      : null;
    if (!list) return { places: [], total: 0, listName: opts.listName, listFound: false };
    resolvedList = list.name;
    listFilter = Prisma.sql`AND p.id IN (SELECT place_id FROM list_places WHERE list_id = ${list.id})`;
  }

  const saveFilter =
    opts.filter === "want_to_go"
      ? Prisma.sql`AND coalesce(sp.has_been, false) = false`
      : opts.filter === "been"
        ? Prisma.sql`AND sp.has_been = true`
        : Prisma.empty;

  // A list can hold places the user never "saved"; don't require the save row then.
  const saveJoin =
    opts.filter === "list"
      ? Prisma.sql`LEFT JOIN saved_places sp ON sp.place_id = p.id AND sp.user_id = ${opts.userId}`
      : Prisma.sql`JOIN saved_places sp ON sp.place_id = p.id AND sp.user_id = ${opts.userId}`;

  const rows = await prisma.$queryRaw<{ place_id: string; total: number }[]>(Prisma.sql`
    SELECT p.id AS place_id, (count(*) OVER ())::int AS total
      FROM places p
      ${saveJoin}
     WHERE true ${saveFilter} ${listFilter} ${areaFilter(opts.area)}
     ORDER BY sp.created_at DESC NULLS LAST, p.name
     LIMIT ${opts.limit}`);

  const places = await hydratePlaceRows(rows.map((r) => r.place_id), {
    userId: opts.userId,
    scope: { kind: "all" },
    location: opts.location,
  });
  return { places, total: rows[0]?.total ?? 0, listName: resolvedList, listFound };
}

// ── Hydration: ids → PlaceRow[] ─────────────────────────────────────────────

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function distanceMi(a: LatLng, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Build full PlaceRows for ids, in the given order. Creators and the latest
 * post respect the scope (a "people I follow" answer names only followed
 * creators); tags and the viewer's save state don't.
 */
export async function hydratePlaceRows(
  ids: string[],
  opts: { userId: string; scope: CreatorScope; location?: LatLng },
): Promise<PlaceRow[]> {
  if (ids.length === 0) return [];
  const idList = Prisma.join(ids);

  const places = await prisma.place.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, googlePlaceId: true, name: true, formattedAddress: true, neighborhood: true, locality: true,
      lat: true, lng: true, primaryType: true, types: true, priceLevel: true, photoRefs: true,
    },
  });

  const tags = await prisma.$queryRaw<{ place_id: string; slug: string; display_name: string }[]>(Prisma.sql`
    SELECT place_id, slug, display_name FROM (
      SELECT x.place_id, t.slug, t.display_name,
             row_number() OVER (PARTITION BY x.place_id ORDER BY max(x.rank) DESC, t.sort_order) AS n
        FROM (
          SELECT a.place_id, a.tag_id, 1 + a.confidence AS rank
            FROM place_tag_aggregates a WHERE NOT a.is_suppressed AND a.place_id IN (${idList})
          UNION ALL
          SELECT pt.place_id, pt.tag_id, coalesce(pt.confidence, 0.5) AS rank
            FROM place_tags pt WHERE pt.place_id IN (${idList})
        ) x JOIN tags t ON t.id = x.tag_id
       GROUP BY x.place_id, t.id, t.slug, t.display_name, t.sort_order
    ) ranked WHERE n <= 3`);

  const creators = await prisma.$queryRaw<
    { place_id: string; user_id: string; username: string | null; first_name: string | null; avatar: string | null; followed: boolean; posts: number }[]
  >(Prisma.sql`
    SELECT r.place_id, u.id AS user_id, u.username, u.first_name, u.profile_image_url AS avatar,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${opts.userId} AND f.following_id = u.id) AS followed,
           count(*)::int AS posts
      FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.place_id IN (${idList}) ${reviewScope(opts.scope)}
     GROUP BY r.place_id, u.id
     ORDER BY followed DESC, posts DESC`);

  const latest = await prisma.$queryRaw<
    { place_id: string; review_id: string; caption: string | null; media_url: string | null; url: string | null; posted_at: Date | null; likes: number | null; username: string | null }[]
  >(Prisma.sql`
    SELECT DISTINCT ON (r.place_id)
           r.place_id, r.id AS review_id, r.social_post_caption AS caption,
           r.social_post_media_url AS media_url, r.instagram_url AS url,
           coalesce(r.social_post_posted_at, r.created_at) AS posted_at,
           r.social_post_likes AS likes, u.username
      FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.place_id IN (${idList}) ${reviewScope(opts.scope)}
     ORDER BY r.place_id, coalesce(r.social_post_posted_at, r.created_at) DESC`);

  const saves = await prisma.$queryRaw<
    { place_id: string; has_been: boolean | null; rating: number | null; emoji: string | null; saved: boolean; list_ids: string[] }[]
  >(Prisma.sql`
    SELECT p.id AS place_id, sp.has_been, sp.rating, sp.emoji, (sp.id IS NOT NULL) AS saved,
           coalesce(array_agg(lp.list_id) FILTER (WHERE lp.list_id IS NOT NULL), '{}') AS list_ids
      FROM places p
      LEFT JOIN saved_places sp ON sp.place_id = p.id AND sp.user_id = ${opts.userId}
      LEFT JOIN list_places lp ON lp.place_id = p.id
                              AND lp.list_id IN (SELECT id FROM lists WHERE user_id = ${opts.userId})
     WHERE p.id IN (${idList})
     GROUP BY p.id, sp.id, sp.has_been, sp.rating, sp.emoji`);

  const byId = new Map(places.map((p) => [p.id, p]));
  const tagsBy = groupBy(tags, (t) => t.place_id);
  const creatorsBy = groupBy(creators, (c) => c.place_id);
  const latestBy = new Map(latest.map((l) => [l.place_id, l]));
  const savesBy = new Map(saves.map((s) => [s.place_id, s]));
  const followingScope = opts.scope.kind === "following";

  const rows: PlaceRow[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const cs = creatorsBy.get(id) ?? [];
    const postCount = cs.reduce((n, c) => n + c.posts, 0);
    const followedCount = cs.filter((c) => c.followed).length;
    const save = savesBy.get(id);
    const post = latestBy.get(id);
    const photoRef = toStringArray(p.photoRefs)[0] ?? null;
    const distance = opts.location ? distanceMi(opts.location, p) : undefined;

    const why: string[] = [];
    if (cs.length > 0) {
      why.push(
        followingScope || followedCount === cs.length
          ? `${plural(cs.length, "creator")} you follow`
          : followedCount > 0
            ? `${plural(cs.length, "creator")} (${followedCount} you follow)`
            : plural(cs.length, "creator"),
      );
      why.push(plural(postCount, "post"));
    } else {
      why.push("No creator posts yet");
    }
    if (save?.saved) why.push(save.has_been ? "You've been" : "On your want-to-go");

    rows.push({
      kind: "place",
      placeId: p.id,
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      address: p.formattedAddress,
      emoji: save?.emoji ?? null,
      category: getChatCategory(p.primaryType, toStringArray(p.types)) || undefined,
      neighborhood: p.neighborhood ?? p.locality ?? null,
      lat: p.lat,
      lng: p.lng,
      priceLevel: formatPriceLevel(p.priceLevel),
      photoRef,
      tags: (tagsBy.get(id) ?? []).map((t) => ({ slug: t.slug, displayName: t.display_name })),
      creators: cs.slice(0, 5).map((c) => ({
        id: c.user_id,
        username: c.username ?? c.first_name ?? "creator",
        avatar: c.avatar,
        isFollowed: c.followed,
      })),
      postCount,
      latestPost: post
        ? {
            reviewId: post.review_id,
            caption: post.caption ?? undefined,
            mediaUrl: post.media_url ?? undefined,
            url: post.url ?? undefined,
            postedAt: post.posted_at ? new Date(post.posted_at).toISOString() : undefined,
            likes: post.likes ?? undefined,
            creator: post.username ?? "creator",
          }
        : undefined,
      mySave: save
        ? { saved: save.saved, hasBeen: Boolean(save.has_been), rating: save.rating, listIds: save.list_ids ?? [] }
        : { saved: false, hasBeen: false, rating: null, listIds: [] },
      ...(distance !== undefined ? { distanceMi: Math.round(distance * 10) / 10 } : {}),
      why: why.join(" · "),
    });
  }
  return rows;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * The compact text a place-list tool hands back to the model (its
 * `summary`) — name, neighborhood, creator handles, why. Enough to write
 * about the places without the full rows costing context.
 */
export function summarizePlaces(places: PlaceRow[], lead: string): string {
  if (places.length === 0) return `${lead}: none found.`;
  const lines = places.map((p, i) => {
    const where = p.neighborhood ? ` (${p.neighborhood})` : "";
    const who = p.creators?.length ? ` — ${p.creators.map((c) => `@${c.username}`).join(", ")}` : "";
    const cap = p.latestPost?.caption
      ? ` — latest post by @${p.latestPost.creator}: "${p.latestPost.caption.replace(/\s+/g, " ").slice(0, 120)}"`
      : "";
    return `${i + 1}. ${p.name}${where}${who} · ${p.why ?? ""} [placeId ${p.placeId}]${cap}`;
  });
  return `${lead}:\n${lines.join("\n")}`;
}
