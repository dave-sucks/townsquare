import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/auth";

export async function GET() {
  try {
    const authUrl = await getAuthorizationUrl();
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
