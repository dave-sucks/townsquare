import { redirect } from "next/navigation";

/** A creator's page is History filtered to them. */
export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  redirect(`/admin/history?creator=${encodeURIComponent((await params).handle)}`);
}
