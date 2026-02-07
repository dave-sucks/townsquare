import { NextResponse } from "next/server";
import { logout, getCallbackUrl } from "@/lib/auth";

export async function GET() {
  try {
    await logout();
    const origin = new URL(getCallbackUrl()).origin;
    return NextResponse.redirect(new URL("/", origin));
  } catch (error: any) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
