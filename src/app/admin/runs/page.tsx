import { redirect } from "next/navigation";

/** Runs became History, a list of posts; old links land on it, filtered the same way. */
export default async function RunsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  if (sp.place) next.set("place", sp.place);
  if (sp.post) next.set("open", sp.post);
  if (sp.source) next.set("creator", sp.source);
  if (sp.status === "needs_review" || sp.status === "failed") next.set("status", sp.status);
  redirect(`/admin/history${next.toString() ? `?${next}` : ""}`);
}
