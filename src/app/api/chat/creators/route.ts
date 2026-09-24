/**
 * GET /api/chat/creators?q= — the composer's @mention search.
 *
 * Creators are users with posts. People the viewer follows come first, then
 * username-prefix matches, then the most prolific. An empty query lists the
 * top of that order, so "@" alone is useful.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;

export type MentionCreator = {
  username: string;
  name: string | null;
  avatar: string | null;
  posts: number;
  isFollowed: boolean;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/^@/, "").slice(0, 40);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const prefix = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  try {
    const rows = await prisma.$queryRaw<
      { username: string; first_name: string | null; last_name: string | null; avatar: string | null; posts: number; followed: boolean }[]
    >(Prisma.sql`
      SELECT u.username, u.first_name, u.last_name, u.profile_image_url AS avatar,
             count(r.id)::int AS posts,
             EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${user.id} AND f.following_id = u.id) AS followed
        FROM users u
        JOIN reviews r ON r.user_id = u.id
       WHERE u.id <> ${user.id}
         AND u.username IS NOT NULL
         ${q ? Prisma.sql`AND (u.username ILIKE ${like} OR u.first_name ILIKE ${like} OR u.last_name ILIKE ${like})` : Prisma.empty}
       GROUP BY u.id
       ORDER BY followed DESC, ${q ? Prisma.sql`(u.username ILIKE ${prefix}) DESC,` : Prisma.empty} posts DESC
       LIMIT ${LIMIT}`);

    const creators: MentionCreator[] = rows.map((r) => ({
      username: r.username,
      name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
      avatar: r.avatar,
      posts: r.posts,
      isFollowed: r.followed,
    }));
    return NextResponse.json({ creators });
  } catch (error) {
    console.error("[chat/creators] search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
