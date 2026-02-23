import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TicketListPageClient } from "@/components/ticket/ticket-list-page-client";

export const metadata = {
  title: "My Tickets — Manilal Ticket System",
};

export default async function TicketsPage() {
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

  // Dev sees all tickets on the kanban board
  if (profile?.role === "dev") {
    redirect("/dashboard");
  }

  return <TicketListPageClient />;
}
