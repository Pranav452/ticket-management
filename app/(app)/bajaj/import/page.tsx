import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SheetSyncPanel } from "@/components/bajaj/SheetSyncPanel";
import { sheetSyncEnabled, missingSheetSyncEnv } from "@/lib/bajaj/google-sheets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sheet Sync — Bajaj Logistics" };

const ADMIN_ROLES = ["superadmin", "admin"];

export default async function BajajImportPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleSlug } = await searchParams;
  const slug = moduleSlug ?? "vipar";

  /* ── Server-side role guard (same pattern as /bajaj/admin) ─────────────── */
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

  if (
    !bajajUser ||
    bajajUser.status !== "approved" ||
    !ADMIN_ROLES.includes(bajajUser.role ?? "")
  ) {
    redirect("/bajaj/home");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-[#0d0d0d]">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] flex-shrink-0">
        <Link
          href={`/bajaj/boards/${slug}`}
          className="flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Board
        </Link>
        <span className="text-gray-200 dark:text-white/20">/</span>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/20">
            <RefreshCw className="size-3.5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-none">
              Google Sheet Sync
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-white/40 leading-none mt-0.5">
              Boards pull work orders from the shared ops Google Sheet
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <SheetSyncPanel enabled={sheetSyncEnabled()} missingEnv={missingSheetSyncEnv()} />
        </div>
      </div>
    </div>
  );
}
