import { redirect } from "next/navigation";

/** Sources became Admin → Creators. */
export default function SourcesPage() {
  redirect("/admin/creators");
}
