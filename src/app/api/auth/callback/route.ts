import { NextRequest, NextResponse } from "next/server";
import { handleCallback, getCallbackUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const incomingUrl = new URL(request.url);
    const callbackBase = new URL(getCallbackUrl());
    callbackBase.search = incomingUrl.search;
    
    const result = await handleCallback(callbackBase);
    
    if (result.success) {
      const origin = callbackBase.origin;
      return NextResponse.redirect(new URL("/", origin));
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Auth callback error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
