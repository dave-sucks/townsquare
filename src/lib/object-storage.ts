const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, errorcode: ${response.status}`);
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export async function downloadAndStoreImage(
  sourceUrl: string,
  storagePath: string
): Promise<string> {
  const imageRes = await fetch(sourceUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download image: ${imageRes.status}`);
  }

  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await imageRes.arrayBuffer());

  const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const publicDir = publicSearchPaths.split(",")[0]?.trim();
  if (!publicDir) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  }

  const fullPath = `${publicDir}/${storagePath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);

  const uploadUrl = await signObjectURL({
    bucketName,
    objectName,
    method: "PUT",
    ttlSec: 900,
  });

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload to object storage: ${uploadRes.status}`);
  }

  return `/api/objects/${storagePath}`;
}

export async function getPublicObjectUrl(storagePath: string): Promise<string> {
  const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const publicDir = publicSearchPaths.split(",")[0]?.trim();
  if (!publicDir) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  }

  const fullPath = `${publicDir}/${storagePath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);

  return signObjectURL({
    bucketName,
    objectName,
    method: "GET",
    ttlSec: 365 * 24 * 60 * 60,
  });
}
