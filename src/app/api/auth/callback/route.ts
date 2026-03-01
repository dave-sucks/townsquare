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
        await prisma.$executeRaw`
          UPDATE users
          SET id = ${authUser.id},
              first_name = ${firstName},
              last_name = ${lastName},
              profile_image_url = ${profileImageUrl}
          WHERE email = ${email}
        `;
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
