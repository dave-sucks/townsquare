import { redirect } from "next/navigation";

/** The Admin page opens on its first tab. */
export default function AdminPage() {
  redirect("/admin/review");
}
