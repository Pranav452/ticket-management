import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { KanbanPageClient } from "@/components/ticket/kanban-page-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Regular users don't see the kanban — send them to their ticket list
  if (profile?.role !== "dev") {
    redirect("/tickets");
  }

  return <KanbanPageClient />;
}
