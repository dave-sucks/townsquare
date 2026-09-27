import { redirect } from "next/navigation";

/** The old import page: Sources replaced it. */
export default function ImportPage() {
  redirect("/admin/sources");
}
