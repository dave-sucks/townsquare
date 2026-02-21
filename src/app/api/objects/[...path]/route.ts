import { NextRequest, NextResponse } from "next/server";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

async function signObjectURL(bucketName: string, objectName: string): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method: "GET",
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
    }
  );
  if (!response.ok) throw new Error(`Sign failed: ${response.status}`);
  const { signed_url } = await response.json();
  return signed_url;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const objectPath = path.join("/");

  const publicDir = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
  if (!publicDir) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const fullPath = publicDir.startsWith("/") ? publicDir.slice(1) : publicDir;
  const parts = fullPath.split("/");
  const bucketName = parts[0];
  const objectName = [...parts.slice(1), objectPath].join("/");

  try {
    const signedUrl = await signObjectURL(bucketName, objectName);
    const imageRes = await fetch(signedUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const buffer = await imageRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": imageRes.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
