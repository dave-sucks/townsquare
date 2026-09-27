import { createClient } from "@/lib/supabase/server";
import { prisma } from "./prisma";

/**
 * Development-only login: under `next dev` with DEV_LOGIN_EMAIL set, every
 * request is that user, so scripts and headless browsers see the app signed
 * in. Production builds run with NODE_ENV=production, so it can never switch
 * on there.
 */
function devLoginEmail(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  return process.env.DEV_LOGIN_EMAIL?.trim() || null;
}

export async function getCurrentUser() {
  const devEmail = devLoginEmail();
  if (devEmail) {
    return prisma.user.findFirst({ where: { email: { equals: devEmail, mode: "insensitive" } } });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return prisma.user.findUnique({ where: { id: user.id } });
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
