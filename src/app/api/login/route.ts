import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/auth";

export async function GET() {
  try {
    const authUrl = await getAuthorizationUrl();
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Login error:", error?.message, error?.stack);
    return NextResponse.json(
      { error: "Login failed", detail: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
