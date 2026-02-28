import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.url);
}
