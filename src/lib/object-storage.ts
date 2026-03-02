import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "photos";

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

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function getPublicObjectUrl(storagePath: string): string {
  const supabase = createAdminClient();
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
