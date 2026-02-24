import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BajajAccessGate } from "@/components/bajaj/BajajAccessGate";

export const dynamic = "force-dynamic";

export default async function BajajLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Admin always has access — bypass bajaj_users check
  const isAdmin = user.email === "pranavnairop090@gmail.com";
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check bajaj_users approval status
  const { data: bajajUser } = await supabase
    .from("bajaj_users")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bajajUser) {
    // No record at all — show request access screen
    return (
      <BajajAccessGate
        status="not_found"
        userId={user.id}
        email={user.email ?? ""}
        fullName={
          (user.user_metadata?.full_name as string | undefined) ??
          (user.email?.split("@")[0] ?? "")
        }
      />
    );
  }

  if (bajajUser.status === "pending") {
    return <BajajAccessGate status="pending" />;
  }

  if (bajajUser.status === "rejected") {
    return <BajajAccessGate status="rejected" />;
  }

  return <>{children}</>;
}
