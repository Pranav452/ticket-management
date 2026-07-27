import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getArchived } from "@/lib/bajaj/archive";
import { ArchiveClient } from "@/components/bajaj/ArchiveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive — Bajaj Logistics" };

export default async function BajajArchivePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: bajajUser } = await supabase
    .from("bajaj_users")
    .select("status")
    .eq("email", user.email)
    .maybeSingle();

  if (!bajajUser || bajajUser.status !== "approved") redirect("/bajaj/home");

  const rows = await getArchived();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ArchiveClient rows={rows} />
    </div>
  );
}
