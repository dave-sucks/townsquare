import { createClient } from "@supabase/supabase-js";

// Service-role client — never expose to the browser.
// Used for server-side storage operations that bypass RLS.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
