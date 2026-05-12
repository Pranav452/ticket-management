import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AdminPanel } from "@/components/bajaj/AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Bajaj Logistics" };

const ADMIN_ROLES = ["superadmin", "admin"];

export default async function BajajAdminPage() {
  /* ── Server-side role guard ─────────────────────────────────────────────── */
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
    .select("role, status")
    .eq("email", user.email)
    .maybeSingle();

  // Redirect viewers, operators, unapproved users, and anyone not in the DB
  if (
    !bajajUser ||
    bajajUser.status !== "approved" ||
    !ADMIN_ROLES.includes(bajajUser.role ?? "")
  ) {
    redirect("/bajaj/home");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F5F5F5" }}>
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-white flex-shrink-0" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex size-7 items-center justify-center rounded-md bg-amber-50">
          <span className="text-sm">🛡</span>
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 leading-none">Admin</h1>
          <p className="text-[11px] text-gray-400 leading-none mt-0.5">User access · Audit log</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AdminPanel />
      </div>
    </div>
  );
}
