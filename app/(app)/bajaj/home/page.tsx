"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useBajajModules } from "@/lib/queries/bajaj";
import { cn } from "@/lib/utils";
import {
  Upload,
  BarChart2,
  Users,
  Settings,
  ArrowRight,
  Activity,
  ShieldCheck,
  Eye,
  Briefcase,
  Package,
  ChevronRight,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { emoji: string; label: string }> = {
  vipar: { emoji: "🌐", label: "VIPAR" },
  srilanka: { emoji: "🌴", label: "Sri Lanka" },
  nigeria: { emoji: "🟢", label: "Nigeria" },
  bangladesh: { emoji: "🔴", label: "Bangladesh" },
  triumph: { emoji: "⚡", label: "Triumph" },
};

const SLUG_ORDER = ["vipar", "srilanka", "nigeria", "bangladesh", "triumph"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const config: Record<string, { label: string; className: string }> = {
    admin: {
      label: "Admin",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    },
    manager: {
      label: "Manager",
      className:
        "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-400",
    },
    viewer: {
      label: "Viewer",
      className:
        "bg-gray-100 text-gray-700 dark:bg-white/8 dark:text-gray-400",
    },
  };
  const c = config[role] ?? {
    label: role,
    className: "bg-gray-100 text-gray-700 dark:bg-white/8 dark:text-gray-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

function RoleDescription({ role }: { role?: string }) {
  const roleInfo: Record<string, { icon: React.ReactNode; description: string }> = {
    admin: {
      icon: <ShieldCheck className="w-4 h-4 text-amber-500" />,
      description:
        "Full access — manage users, import data, view all boards and analytics.",
    },
    manager: {
      icon: <Briefcase className="w-4 h-4 text-violet-400" />,
      description: "Can import and manage work orders across all boards.",
    },
    viewer: {
      icon: <Eye className="w-4 h-4 text-gray-400" />,
      description: "Read-only access to all boards and work orders.",
    },
  };
  const info = roleInfo[role ?? ""] ?? {
    icon: <Eye className="w-4 h-4 text-gray-400" />,
    description: "Access to assigned boards and work orders.",
  };
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4 dark:border-white/8"
      style={{ background: "var(--card-bg)" }}
    >
      <div className="mt-0.5 shrink-0">{info.icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Your access level
        </p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--muted-fg)" }}>
          {info.description}
        </p>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WORow = {
  id: string;
  status_id: string | null;
  data: Record<string, unknown>;
  module_slug?: string;
};

// ─── My Shipments section ─────────────────────────────────────────────────────

function MyShipments({
  wos,
  isLoading,
  email,
  router,
}: {
  wos: WORow[];
  isLoading: boolean;
  email?: string;
  router: ReturnType<typeof useRouter>;
}) {
  const MAX = 10;
  const visible = wos.slice(0, MAX);
  const hasMore = wos.length > MAX;

  const getString = (v: unknown): string =>
    v != null ? String(v) : "";

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <Package className="w-4 h-4 text-amber-500" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-500">
          My Shipments
        </h2>
        {!isLoading && wos.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            {wos.length}
          </span>
        )}
      </div>

      <div
        className="overflow-hidden rounded-xl border dark:border-white/8"
        style={{ background: "var(--card-bg)" }}
      >
        {isLoading ? (
          // Skeleton rows
          <div className="divide-y dark:divide-white/6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-white/10 shrink-0" />
                <div className="h-3.5 w-20 rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-white/10" />
                <div className="ml-auto h-3 w-16 rounded bg-gray-200 dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Package className="w-8 h-8 opacity-20" style={{ color: "var(--muted-fg)" }} />
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              No work orders assigned to you
            </p>
          </div>
        ) : (
          <div className="divide-y dark:divide-white/6">
            {visible.map((wo) => {
              const woNum = getString(wo.data.wo) || String(wo.id);
              const brand = getString(wo.data.brand);
              const variant = getString(wo.data.variant);
              const port = getString(wo.data.port);
              const country = getString(wo.data.country);
              const sailingdt = getString(wo.data.sailingdt);
              const brandVariant =
                brand && variant
                  ? `${brand} · ${variant}`
                  : brand || variant || "—";

              return (
                <button
                  key={wo.id}
                  onClick={() => router.push(`/bajaj/work-orders/${wo.id}`)}
                  className={cn(
                    "group w-full flex items-center gap-3 px-4 py-3.5 text-left",
                    "transition-colors duration-100",
                    "hover:bg-amber-50/60 dark:hover:bg-amber-500/6"
                  )}
                >
                  {/* amber status dot */}
                  <span className="mt-px h-2 w-2 shrink-0 rounded-full bg-amber-400" />

                  {/* WO number */}
                  <span className="w-24 shrink-0 truncate text-xs font-mono font-medium text-gray-900 dark:text-white">
                    {woNum}
                  </span>

                  {/* Brand · Variant */}
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300"
                  >
                    {brandVariant}
                  </span>

                  {/* Port */}
                  {port && (
                    <span
                      className="hidden sm:block shrink-0 truncate text-xs max-w-[100px]"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {port}
                    </span>
                  )}

                  {/* Country */}
                  {country && (
                    <span className="hidden md:block shrink-0 rounded-full border px-2 py-0.5 text-xs dark:border-white/10 dark:text-gray-400 text-gray-500">
                      {country}
                    </span>
                  )}

                  {/* Sailing date */}
                  {sailingdt && (
                    <span
                      className="hidden lg:block shrink-0 text-xs tabular-nums"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {sailingdt}
                    </span>
                  )}

                  <ChevronRight
                    className="ml-2 w-3.5 h-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                    style={{ color: "var(--muted-fg)" }}
                  />
                </button>
              );
            })}

            {hasMore && (
              <button
                onClick={() => {
                  if (!email) return;
                  // Route to the board where most of the user's shipments live,
                  // instead of always defaulting to vipar.
                  const counts = new Map<string, number>();
                  for (const w of wos) {
                    if (w.module_slug) counts.set(w.module_slug, (counts.get(w.module_slug) ?? 0) + 1);
                  }
                  let slug = "vipar", best = -1;
                  counts.forEach((n, s) => { if (n > best) { best = n; slug = s; } });
                  router.push(`/bajaj/boards/${slug}?assignedTo=${encodeURIComponent(email)}`);
                }}
                className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-500/6 transition-colors"
              >
                Show all {wos.length} shipments
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BajajHomePage() {
  const router = useRouter();
  const bajajUser = useAuthStore(
    (s) =>
      s.bajajUser as {
        full_name?: string;
        email?: string;
        role?: string;
        status?: string;
      } | null | undefined
  );
  const { data: modules = [] } = useBajajModules();

  // My Work Orders
  const { data: myWOs = [], isLoading: myWOLoading } = useQuery({
    queryKey: ["bajaj", "my-work-orders", bajajUser?.email],
    enabled: !!bajajUser?.email,
    queryFn: async () => {
      const sp = new URLSearchParams({
        assignedTo: bajajUser!.email!,
        pageSize: "100",
      });
      const res = await fetch(`/api/bajaj/work-orders?${sp}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? json) as WORow[];
    },
    staleTime: 30_000,
  });

  const firstName = bajajUser?.full_name?.split(" ")[0] ?? "there";
  const greeting = getGreeting();
  const isAdmin = bajajUser?.role === "admin";

  const orderedModules = SLUG_ORDER.map((slug) => {
    const found = modules.find(
      (m: { slug: string; name: string }) => m.slug === slug
    );
    return { slug, name: found?.name ?? MODULE_META[slug]?.label ?? slug };
  });

  const quickActions = [
    {
      label: "Import Data",
      icon: <Upload className="w-4 h-4" />,
      href: "/bajaj/import",
      show: true,
    },
    {
      label: "View Analytics",
      icon: <BarChart2 className="w-4 h-4" />,
      href: "/bajaj/dashboard",
      show: true,
    },
    {
      label: "Manage Users",
      icon: <Users className="w-4 h-4" />,
      href: "/bajaj/admin",
      show: isAdmin,
    },
    {
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
      href: "/bajaj/settings",
      show: true,
    },
  ].filter((a) => a.show);

  return (
    <div
      className="h-full overflow-y-auto text-gray-900 dark:text-white"
      style={{ background: "var(--main-bg)" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Hero greeting */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {greeting}, {firstName}!
            </h1>
            <RoleBadge role={bajajUser?.role} />
          </div>
          {bajajUser?.email && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--muted-fg)" }}>
              {bajajUser.email}
            </p>
          )}
          <p
            className="mt-3 max-w-xl text-sm leading-relaxed"
            style={{ color: "var(--muted-fg)" }}
          >
            Welcome to the Bajaj Logistics workspace. Use the boards below to
            track and manage shipment work orders across all regions.
          </p>
        </div>

        {/* My Shipments — primary section */}
        <MyShipments
          wos={myWOs}
          isLoading={myWOLoading}
          email={bajajUser?.email}
          router={router}
        />

        {/* Module overview cards */}
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-500">
            Boards
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedModules.map(({ slug, name }) => {
              const meta = MODULE_META[slug];
              return (
                <button
                  key={slug}
                  onClick={() => router.push(`/bajaj/boards/${slug}`)}
                  className={cn(
                    "group flex flex-col gap-3 rounded-xl border p-5 text-left transition-all duration-150",
                    "hover:border-amber-400/60 hover:shadow-sm dark:border-white/8 dark:hover:border-amber-500/40"
                  )}
                  style={{ background: "var(--card-bg)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl leading-none">
                      {meta?.emoji ?? "📋"}
                    </span>
                    <ArrowRight
                      className="w-4 h-4 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--muted-fg)" }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {meta?.label ?? name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                      Open Board →
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick actions */}
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-500">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150",
                  "hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400",
                  "border-gray-200 text-gray-700 dark:border-white/8 dark:text-gray-300"
                )}
                style={{ background: "var(--card-bg)" }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </section>

        {/* Role explanation */}
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-500">
            Your Permissions
          </h2>
          <RoleDescription role={bajajUser?.role} />
        </section>

        {/* Recent activity teaser */}
        <section>
          <div
            className="flex items-center gap-3 rounded-xl border p-4 dark:border-white/8"
            style={{ background: "var(--card-bg)" }}
          >
            <Activity className="w-4 h-4 shrink-0 text-amber-500" />
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              View activity logs and status history on individual work orders by
              opening a card on any board.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
