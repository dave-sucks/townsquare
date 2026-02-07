import { NextRequest, NextResponse } from "next/server";
import { handleCallback, getCallbackUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const incomingUrl = new URL(request.url);
    const callbackUrl = getCallbackUrl();
    const callbackBase = new URL(callbackUrl);
    callbackBase.search = incomingUrl.search;
    
    const result = await handleCallback(callbackBase);
    
    if (result.success) {
      const origin = callbackBase.origin;
      return NextResponse.redirect(new URL("/", origin));
    } else {
      return NextResponse.json(
        { error: result.error, callbackUrl },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Auth callback error:", error?.message, error?.stack);
    return NextResponse.json(
      { error: "Authentication failed", detail: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
