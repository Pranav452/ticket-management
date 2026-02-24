import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/bajaj/AdminPanel";

export const dynamic = "force-dynamic";

export default async function BajajAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== "pranavnairop090@gmail.com") {
    redirect("/bajaj");
  }

  return <AdminPanel />;
}
