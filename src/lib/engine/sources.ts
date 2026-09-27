/**
 * Read side of sources: each source with the numbers its card and strip show.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type SourceSummary = {
  id: string;
  handle: string;
  status: "active" | "paused";
  homeCity: string | null;
  notes: string | null;
  trustWeight: number;
  lastSyncedAt: string | null;
  lastPostAt: string | null;
  user: { id: string; username: string | null; avatar: string | null; name: string | null } | null;
  lastSync: { id: string; status: string; createdAt: string; fetched: number; error: string | null } | null;
  posts: number;
  places: number;
  needsReview: number;
  notAPlace: number;
  failed: number;
};

type Row = {
  id: string; handle: string; status: "active" | "paused"; home_city: string | null; notes: string | null; trust_weight: number;
  last_synced_at: Date | null; last_post_at: Date | null;
  user_id: string | null; username: string | null; avatar: string | null; first_name: string | null; last_name: string | null;
  posts: number; places: number; needs_review: number; not_a_place: number; failed: number;
  sync_id: string | null; sync_status: string | null; sync_created: Date | null; sync_fetched: number | null; sync_error: string | null;
};

export async function listSources(where: Prisma.Sql = Prisma.sql`true`): Promise<SourceSummary[]> {
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT s.id, s.handle, s.status, s.home_city, s.notes, s.trust_weight, s.last_synced_at, s.last_post_at,
           u.id AS user_id, u.username, u.profile_image_url AS avatar, u.first_name, u.last_name,
           (SELECT count(*)::int FROM ingested_posts p WHERE p.source_id = s.id) AS posts,
           (SELECT count(DISTINCT r.place_id)::int FROM reviews r JOIN ingested_posts p ON p.id = r.ingested_post_id WHERE p.source_id = s.id) AS places,
           (SELECT count(DISTINCT ri.post_id)::int FROM review_items ri JOIN ingested_posts p ON p.id = ri.post_id
             WHERE p.source_id = s.id AND ri.status = 'open') AS needs_review,
           (SELECT count(*)::int FROM ingested_posts p WHERE p.source_id = s.id AND p.post_type = 'not_a_place') AS not_a_place,
           (SELECT count(*)::int FROM ingested_posts p WHERE p.source_id = s.id AND p.status = 'failed') AS failed,
           j.id AS sync_id, j.status::text AS sync_status, j.created_at AS sync_created, j.posts_fetched AS sync_fetched, j.error AS sync_error
      FROM sources s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN LATERAL (SELECT * FROM import_jobs j WHERE j.source_id = s.id ORDER BY j.created_at DESC LIMIT 1) j ON true
     WHERE ${where}
     ORDER BY s.status, s.handle`);
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    status: r.status,
    homeCity: r.home_city,
    notes: r.notes,
    trustWeight: r.trust_weight,
    lastSyncedAt: r.last_synced_at?.toISOString() ?? null,
    lastPostAt: r.last_post_at?.toISOString() ?? null,
    user: r.user_id ? { id: r.user_id, username: r.username, avatar: r.avatar, name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null } : null,
    lastSync: r.sync_id
      ? { id: r.sync_id, status: r.sync_status ?? "", createdAt: r.sync_created!.toISOString(), fetched: r.sync_fetched ?? 0, error: r.sync_error }
      : null,
    posts: r.posts,
    places: r.places,
    needsReview: r.needs_review,
    notAPlace: r.not_a_place,
    failed: r.failed,
  }));
}
