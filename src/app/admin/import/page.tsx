import { redirect } from "next/navigation";

/** The old import page: Admin → Creators replaced it. */
export default function ImportPage() {
  redirect("/admin/creators");
}
