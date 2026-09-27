import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/** Every /admin page is for admins only; everyone else gets a 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!isAdmin(user)) notFound();
  return children;
}
