"use client";

import React, { useState } from "react";
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  RefreshCw, Download, TrendingUp, Package, FileText,
  Clock, AlertTriangle, Ship, Globe, ChevronRight,
} from "lucide-react";
import { useBajajAnalytics } from "@/lib/queries/bajaj";
import { cn } from "@/lib/utils";

/* ─── module filter ──────────────────────────────────────────── */
const MODULES = [
  { slug: "",           name: "All Modules" },
  { slug: "vipar",      name: "Vipar" },
  { slug: "srilanka",   name: "Sri Lanka" },
  { slug: "nigeria",    name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph",    name: "Triumph" },
];

/* ─── palette ────────────────────────────────────────────────── */
const AMBER  = "#F59E0B";
const GRID   = "#F3F4F6";
const AXIS   = { fill: "#9CA3AF", fontSize: 11 };
const TT     = {
  contentStyle: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,.06)" },
  labelStyle:   { color: "#111827", fontWeight: 600, fontSize: 12 },
  itemStyle:    { color: "#6B7280", fontSize: 12 },
};

/* ─── reusable primitives ────────────────────────────────────── */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">{children}</p>;
}

interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}
function KpiCard({ icon, label, value, sub, accent = AMBER }: KpiProps) {
  return (
    <Card className="px-5 py-5 flex items-start gap-4">
      <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: `${accent}18` }}>
        <div style={{ color: accent }} className="size-5">{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 font-medium leading-none mb-1.5">{label}</p>
        <p className="text-[26px] font-semibold text-gray-900 leading-none tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1.5 leading-none">{sub}</p>}
      </div>
    </Card>
  );
}

/* ─── custom tooltip ─────────────────────────────────────────── */
function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-gray-500 tabular-nums">{payload[0].value} work orders</p>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────── */
export function BajajDashboard() {
  const [mod, setMod] = useState("");
  const { data, isLoading, refetch } = useBajajAnalytics(mod || undefined);

  /* derived counts */
  const totalWOs   = data?.totalWorkOrders ?? 0;
  const completed  = data?.byStatus.find(s => /complet/i.test(s.statusName))?.count ?? 0;
  const critical   = data?.byStatus.find(s => /critical|issue/i.test(s.statusName))?.count ?? 0;
  const inProgress = (data?.byStatus ?? [])
    .filter(s => /pending|progress|booking|planned/i.test(s.statusName))
    .reduce((acc, s) => acc + s.count, 0);

  const pieColors = (data?.byStatus ?? []).map(s => `#${s.colorHex.replace(/^#/, "")}`);

  /* CSV export */
  function exportCSV() {
    if (!data) return;
    const rows = [["Module","Work Orders"], ...data.byModule.map(m => [m.moduleName, m.count])];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const a    = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "bajaj_analytics.csv",
    });
    a.click();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "#F7F7F8" }}>

      {/* ── top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 leading-none tracking-tight">Analytics</h1>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-none">Bajaj Auto · Shipment Overview</p>
        </div>

        <div className="flex items-center gap-2">
          {/* module selector */}
          <div className="relative">
            <select
              value={mod}
              onChange={e => setMod(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all cursor-pointer"
            >
              {MODULES.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
            </select>
            <ChevronRight className="size-3 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[13px] font-medium transition-all shadow-sm"
          >
            <Download className="size-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* ── scrollable body ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            <RefreshCw className="size-4 mr-2 animate-spin" />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* ── KPI row 1 ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={<TrendingUp className="size-full" />}
                label="Total Work Orders"
                value={totalWOs.toLocaleString()}
              />
              <KpiCard
                icon={<Package className="size-full" />}
                label="Total Containers"
                value={(data?.totalContainers ?? 0).toLocaleString()}
                accent="#3B82F6"
              />
              <KpiCard
                icon={<FileText className="size-full" />}
                label="Total BLs"
                value={(data?.totalBLs ?? 0).toLocaleString()}
                accent="#10B981"
              />
              <KpiCard
                icon={<Clock className="size-full" />}
                label="BL Pending after ETD"
                value={data?.blPendingAfterETD ?? 0}
                sub="Shipped but no BL number"
                accent="#EF4444"
              />
            </div>

            {/* ── KPI row 2 ────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={<Globe className="size-full" />}
                label="Completed"
                value={completed.toLocaleString()}
                sub={totalWOs ? `${Math.round((completed / totalWOs) * 100)}% of total` : ""}
                accent="#10B981"
              />
              <KpiCard
                icon={<TrendingUp className="size-full" />}
                label="In Progress"
                value={inProgress.toLocaleString()}
                accent="#3B82F6"
              />
              <KpiCard
                icon={<AlertTriangle className="size-full" />}
                label="Critical / Issues"
                value={critical.toLocaleString()}
                accent="#EF4444"
              />
              <KpiCard
                icon={<Ship className="size-full" />}
                label="Vessels Over 25 Containers"
                value={data?.vesselsOverLimit.length ?? 0}
                sub="Exceeding capacity limit"
                accent="#8B5CF6"
              />
            </div>

            {/* ── charts row 1 ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Status pie — 2 cols */}
              <Card className="lg:col-span-2 p-6">
                <SectionTitle>Status Distribution</SectionTitle>
                {data?.byStatus?.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={data.byStatus}
                          dataKey="count"
                          nameKey="statusName"
                          cx="50%" cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          isAnimationActive={false}
                          strokeWidth={0}
                        >
                          {data.byStatus.map((entry, i) => (
                            <Cell key={entry.statusName} fill={pieColors[i] ?? "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* donut centre label */}
                    <div className="mt-4 space-y-2">
                      {data.byStatus.map((s, i) => (
                        <div key={s.statusName} className="flex items-center gap-2">
                          <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: pieColors[i] ?? "#6b7280" }} />
                          <span className="text-[12px] text-gray-600 truncate flex-1">{s.statusName}</span>
                          <span className="text-[12px] text-gray-400 tabular-nums font-medium">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-300 text-center py-16">No data yet.</p>
                )}
              </Card>

              {/* Work orders by module — 3 cols */}
              <Card className="lg:col-span-3 p-6">
                <SectionTitle>Work Orders by Module</SectionTitle>
                {data?.byModule?.some(m => m.count > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byModule} margin={{ top: 0, right: 0, left: -24, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="moduleName" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                      <Tooltip {...TT} cursor={{ fill: "#F9FAFB" }} />
                      <Bar dataKey="count" fill={AMBER} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-300 text-center py-16">No data yet.</p>
                )}

                {/* Module progress bars */}
                <div className="mt-5 space-y-3">
                  {data?.byModule.map(m => {
                    const pct = totalWOs > 0 ? Math.round((m.count / totalWOs) * 100) : 0;
                    return (
                      <div key={m.slug}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-gray-600 font-medium">{m.moduleName}</span>
                          <span className="text-gray-400 tabular-nums">{m.count} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: AMBER }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* ── Import timeline (area) ────────────────────── */}
            {(data?.importTimeline?.length ?? 0) > 1 && (
              <Card className="p-6">
                <SectionTitle>Import Timeline · Work Orders Added per Month</SectionTitle>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data!.importTimeline} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AMBER} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} />
                    <Area
                      type="monotone" dataKey="addedCount"
                      stroke={AMBER} strokeWidth={2}
                      fill="url(#amberGrad)"
                      dot={{ fill: AMBER, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: AMBER, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* ── shipping line + vessels ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Containers by shipping line */}
              <Card className="p-6">
                <SectionTitle>Containers by Shipping Line</SectionTitle>
                {data?.containersByLine?.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.containersByLine}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="lineName" tick={AXIS} axisLine={false} tickLine={false} width={80} />
                      <Tooltip {...TT} cursor={{ fill: "#F9FAFB" }} />
                      <Bar dataKey="containerCount" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-300 text-center py-16">No container data yet.</p>
                )}
              </Card>

              {/* Vessels over limit + top vessels */}
              <Card className="p-6">
                <SectionTitle>Top Vessels · Container Load</SectionTitle>
                {data?.containersByVessel?.filter(v => v.vesselName)?.length ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {data.containersByVessel.filter(v => v.vesselName).slice(0, 12).map(v => {
                      const isOver = v.containerCount > 25;
                      return (
                        <div key={v.vesselName} className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-colors",
                          isOver ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                        )}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isOver && <AlertTriangle className="size-3 flex-shrink-0 text-red-500" />}
                            <span className="truncate font-medium">{v.vesselName}</span>
                          </div>
                          <span className="tabular-nums font-semibold flex-shrink-0 ml-4">
                            {v.containerCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 text-center py-16">No vessel data yet.</p>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
