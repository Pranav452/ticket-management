import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuleSelector } from "@/components/bajaj/ModuleSelector";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, avatar_url, id, created_at")
    .eq("id", user.id)
    .single();

  return <ModuleSelector profile={profile} />;
}
