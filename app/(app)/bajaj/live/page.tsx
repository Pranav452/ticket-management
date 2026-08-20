import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Manrope } from "next/font/google";

import { createAdminClient } from "@/lib/supabase/admin";
import { MONTH_RE, resolveSheetSources } from "@/lib/bajaj/sheet-sources";
import {
  compareByVoyage,
  routesForShipments,
  toFleetDot,
  toLiveShipment,
  type BoardOption,
  type FleetDot,
  type LiveShipment,
  type StatusMeta,
  type WorkOrderRow,
} from "@/lib/bajaj/live-shipments";
import LiveShipmentsShell from "@/components/bajaj/LiveShipmentsShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Shipments — Bajaj Logistics" };

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/** Short labels so the floating pill bar still fits the 330px list column. */
const BOARDS: BoardOption[] = [
  { slug: "all", label: "All" },
  { slug: "vipar", label: "VPR" },
  { slug: "srilanka", label: "SL" },
  { slug: "bangladesh", label: "BD" },
  { slug: "nigeria", label: "NG" },
  { slug: "triumph", label: "TRI" },
];

const BOARD_NAMES: Record<string, string> = {
  vipar: "VIPAR",
  srilanka: "Sri Lanka",
  bangladesh: "Bangladesh",
  nigeria: "Nigeria",
  triumph: "Triumph",
};

const CHUNK = 1000;
const MAX_CLIENT_ROWS = 250;

type EmbeddedStatus = { name: string | null; display_order: number | null };
type Row = WorkOrderRow & {
  bajaj_statuses: EmbeddedStatus | EmbeddedStatus[] | null;
};

function statusOf(row: Row): StatusMeta | null {
  const s = Array.isArray(row.bajaj_statuses) ? row.bajaj_statuses[0] : row.bajaj_statuses;
  if (!s || !s.name) return null;
  return { name: s.name, display_order: s.display_order ?? 0 };
}

export default async function BajajLivePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // ── auth gate (same pattern as bookings/archive) ──────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: bajajUser } = await supabase
    .from("bajaj_users")
    .select("status")
    .eq("email", user.email)
    .maybeSingle();

  if (!bajajUser || bajajUser.status !== "approved") redirect("/bajaj/home");

  // ── month resolution ──────────────────────────────────────────────
  const sb = createAdminClient();
  const { sources } = await resolveSheetSources(sb);

  const allMonths = sources.map((s) => s.month).sort();
  const activeMonths = sources
    .filter((s) => s.status === "active")
    .map((s) => s.month)
    .sort();
  const latest = activeMonths[activeMonths.length - 1] ?? allMonths[allMonths.length - 1] ?? null;
  const oldest = allMonths[0] ?? null;

  const requested = (await searchParams)?.month;
  const month = requested && MONTH_RE.test(requested) ? requested : latest;
  const monthLabel = sources.find((s) => s.month === month)?.label ?? month ?? "All months";

  // ── paginated fetch (table exceeds PostgREST's 1000-row ceiling) ───
  const rows: Row[] = [];
  for (let page = 0; ; page++) {
    let q = sb
      .from("bajaj_work_orders")
      .select("id, module_slug, status_id, updated_at, data, bajaj_statuses(name, display_order)")
      .is("data->>archived_at", null)
      .order("updated_at", { ascending: false })
      .range(page * CHUNK, page * CHUNK + CHUNK - 1);

    if (month) {
      // Legacy rows have a NULL sheet_month and belong to the oldest month.
      q =
        month === oldest
          ? q.or(`data->>sheet_month.eq.${month},data->>sheet_month.is.null`)
          : q.eq("data->>sheet_month", month);
    }

    const { data, error } = await q;
    if (error) break;
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < CHUNK) break;
    if (page > 40) break; // hard safety stop
  }

  // ── map + rank + cap ──────────────────────────────────────────────
  const now = new Date();
  const shipments: LiveShipment[] = rows
    .map((row) =>
      toLiveShipment(
        row,
        statusOf(row),
        BOARD_NAMES[row.module_slug ?? ""] ?? row.module_slug ?? "—",
        now,
      ),
    )
    // Under way first, then arrived, then still at the quay. The old rank-only
    // order put COMPLETED rows last, so the 250-row cap sliced off nearly every
    // arrived vessel — the map would draw a green dot the list could not open.
    .sort(compareByVoyage);

  const capped = shipments.slice(0, MAX_CLIENT_ROWS);

  // The MAP gets the whole month, not just the 250 rows the list can hold —
  // seven scalar fields per work order, no journey / details / search blob.
  // Rows whose POD has no sea corridor are dropped (they have no position).
  const fleet: FleetDot[] = rows
    .map((row) =>
      toFleetDot(
        row,
        statusOf(row),
        BOARD_NAMES[row.module_slug ?? ""] ?? row.module_slug ?? "—",
        now,
      ),
    )
    .filter((d): d is FleetDot => d !== null);

  return (
    <div className="h-full overflow-hidden p-4" style={{ background: "var(--main-bg)" }}>
      <LiveShipmentsShell
        shipments={capped}
        fleet={fleet}
        routes={routesForShipments(capped)}
        boards={BOARDS}
        totalCount={shipments.length}
        monthLabel={monthLabel}
        fontClassName={manrope.className}
      />
    </div>
  );
}
