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

  // Upsert our app's user record keyed on the Supabase auth user ID
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
    // Email uniqueness clash (another account with same email) — log and continue.
    // The user will still be authenticated; profile data may be stale.
    console.error("User upsert error:", err?.message);
  }

  return NextResponse.redirect(`${origin}/`);
}
