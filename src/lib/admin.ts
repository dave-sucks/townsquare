import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Admins are the users whose email is in ADMIN_EMAILS (comma-separated). */
export function isAdmin(user: { email: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email);
}

/**
 * The guard on every /api/admin/* handler: the signed-in admin, or the
 * response to return instead (401 signed out, 403 not an admin).
 *
 *   const { user, error } = await requireAdmin();
 *   if (error) return error;
 */
export async function requireAdmin(): Promise<
  { user: CurrentUser; error: undefined } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(user)) return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, error: undefined };
}
