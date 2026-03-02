import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";

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

  const fullName: string = meta.full_name ?? meta.name ?? "";
  const parts = fullName.trim().split(" ");
  const firstName: string | null = meta.given_name ?? (parts[0] || null);
  const lastName: string | null = meta.family_name ?? (parts.slice(1).join(" ") || null);
  const profileImageUrl: string | null = meta.avatar_url ?? meta.picture ?? null;

  try {
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email: authUser.email ?? null,
        firstName,
        lastName,
        profileImageUrl,
      },
      update: {
        email: authUser.email ?? null,
        firstName,
        lastName,
        profileImageUrl,
      },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation — a legacy user with this email exists under a different ID.
    // Migrate their ID to the new Supabase UUID so all their data carries over.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && authUser.email) {
      try {
        const legacyUser = await prisma.user.findUnique({ where: { email: authUser.email } });
        if (legacyUser && legacyUser.id !== authUser.id) {
          const oldId = legacyUser.id;
          const newId = authUser.id;
          // Disable FK triggers so we can change the PK, then re-enable
          await prisma.$executeRaw`SET LOCAL session_replication_role = 'replica'`;
          await prisma.$executeRaw`UPDATE users          SET id           = ${newId} WHERE id           = ${oldId}`;
          await prisma.$executeRaw`UPDATE saved_places   SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await prisma.$executeRaw`UPDATE reviews        SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await prisma.$executeRaw`UPDATE photos         SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await prisma.$executeRaw`UPDATE lists          SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await prisma.$executeRaw`UPDATE activities     SET actor_id     = ${newId} WHERE actor_id     = ${oldId}`;
          await prisma.$executeRaw`UPDATE follows        SET follower_id  = ${newId} WHERE follower_id  = ${oldId}`;
          await prisma.$executeRaw`UPDATE follows        SET following_id = ${newId} WHERE following_id = ${oldId}`;
          await prisma.$executeRaw`UPDATE conversations  SET user_id      = ${newId} WHERE user_id      = ${oldId}`;
          await prisma.$executeRaw`SET LOCAL session_replication_role = 'origin'`;
          // Now update profile fields
          await prisma.user.update({
            where: { id: newId },
            data: { firstName, lastName, profileImageUrl },
          });
          console.log(`Migrated legacy user ${oldId} → ${newId}`);
        }
      } catch (migrationErr: any) {
        console.error("Legacy user migration failed:", migrationErr?.message);
      }
    } else {
      console.error("User upsert error:", err?.message);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
