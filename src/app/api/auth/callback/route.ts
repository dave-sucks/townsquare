import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const fullUrl = new URL(request.url);
    const result = await handleCallback(fullUrl);
    
    if (result.success) {
      const baseUrl = process.env.REPLIT_DEPLOYMENT 
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}` 
        : `https://${process.env.REPLIT_DEV_DOMAIN}`;
      return NextResponse.redirect(new URL("/", baseUrl));
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Auth callback error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
