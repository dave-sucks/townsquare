import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("OAuth error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    console.error("Auth callback error:", exchangeError);
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(exchangeError?.message ?? "auth_failed")}`
    );
  }

  const authUser = data.user;
  const meta = authUser.user_metadata ?? {};

  // Derive name fields from Google OAuth metadata
  const fullName: string = meta.full_name ?? meta.name ?? "";
  const parts = fullName.trim().split(" ");
  const firstName: string | null =
    meta.given_name ?? (parts[0] || null);
  const lastName: string | null =
    meta.family_name ?? (parts.slice(1).join(" ") || null);
  const profileImageUrl: string | null =
    meta.avatar_url ?? meta.picture ?? null;

  // Upsert our app's user record keyed on the Supabase auth user ID.
  // If a row already exists with this email under a different ID (pre-Supabase
  // migration), update that row's primary key to the new Supabase ID so that
  // all related records (saved places, lists, follows, etc.) cascade over too.
  try {
    const email = authUser.email ?? null;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== authUser.id) {
        const oldId = existing.id;
        const newId = authUser.id;
        // Can't UPDATE users.id directly — child FK constraints reject it because
        // newId doesn't exist in users yet, and oldId can't be removed while
        // children still reference it. Instead: insert new row, re-point children, delete old.
        await prisma.$transaction(async (tx) => {
          // 1. Insert the new user row (copy old, override id + profile fields)
          await tx.$executeRaw`
            INSERT INTO users (
              id, email, username, password_hash, created_at,
              first_name, last_name, profile_image_url,
              bio, instagram_handle, is_verified, location, website,
              avatar_emoji, instagram_id, instagram_post_count,
              is_instagram_import, last_instagram_sync
            )
            SELECT
              ${newId}, email, username, password_hash, created_at,
              ${firstName}, ${lastName}, ${profileImageUrl},
              bio, instagram_handle, is_verified, location, website,
              avatar_emoji, instagram_id, instagram_post_count,
              is_instagram_import, last_instagram_sync
            FROM users WHERE id = ${oldId}
          `;
          // 2. Re-point all child tables from oldId → newId
          await tx.$executeRaw`UPDATE saved_places  SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await tx.$executeRaw`UPDATE lists         SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await tx.$executeRaw`UPDATE follows       SET follower_id  = ${newId} WHERE follower_id  = ${oldId}`;
          await tx.$executeRaw`UPDATE follows       SET following_id = ${newId} WHERE following_id = ${oldId}`;
          await tx.$executeRaw`UPDATE activities    SET actor_id     = ${newId} WHERE actor_id     = ${oldId}`;
          await tx.$executeRaw`UPDATE reviews       SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await tx.$executeRaw`UPDATE photos        SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await tx.$executeRaw`UPDATE conversations SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          // 3. Delete the old user row (now has no children)
          await tx.$executeRaw`DELETE FROM users WHERE id = ${oldId}`;
        });
        return NextResponse.redirect(`${origin}/`);
      }
    }

    await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email,
        firstName,
        lastName,
        profileImageUrl,
      },
      update: {
        email,
        firstName,
        lastName,
        profileImageUrl,
      },
    });
  } catch (err: any) {
    console.error("User upsert error:", err?.message);
  }

  return NextResponse.redirect(`${origin}/`);
}
