import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function GET() {
  try {
    await logout();
    return NextResponse.redirect(new URL("/", process.env.REPLIT_DEPLOYMENT 
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}` 
      : `https://${process.env.REPLIT_DEV_DOMAIN}`));
  } catch (error: any) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
