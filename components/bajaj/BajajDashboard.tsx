"use client";

import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Download, RefreshCw, AlertTriangle } from "lucide-react";
import { useBajajAnalytics } from "@/lib/queries/bajaj";

const MODULE_SLUGS = [
  { slug: "", name: "All Modules" },
  { slug: "vipar", name: "Vipar" },
  { slug: "srilanka", name: "Sri Lanka" },
  { slug: "nigeria", name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph", name: "Triumph" },
];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-semibold text-neutral-50 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

export function BajajDashboard() {
  const [selectedModule, setSelectedModule] = useState("");
  const { data, isLoading, refetch } = useBajajAnalytics(selectedModule || undefined);

  const totalWOs = data?.totalWorkOrders ?? 0;
  const completedCount = data?.byStatus.find((s) =>
    s.statusName.toLowerCase().includes("complet") || s.colorHex === "99CC00"
  )?.count ?? 0;
  const criticalCount = data?.byStatus.find((s) =>
    s.statusName.toLowerCase().includes("critical") || s.statusName.toLowerCase().includes("issue") || s.colorHex === "FF0000"
  )?.count ?? 0;
  const inProgressCount = data?.byStatus.find((s) =>
    s.statusName.toLowerCase().includes("pending") ||
    s.statusName.toLowerCase().includes("progress") ||
    s.statusName.toLowerCase().includes("booking") ||
    s.statusName.toLowerCase().includes("planned")
  )?.count ?? 0;

  const PIE_COLORS = data?.byStatus.map((s) => `#${s.colorHex}`) ?? [];

  function downloadCSV() {
    if (!data) return;
    const rows = [
      ["Module", "Total Work Orders"],
      ...data.byModule.map((m) => [m.moduleName, m.count]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bajaj_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-neutral-950 px-8 py-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Analytics Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Bajaj Auto Shipment — Work Order Overview</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
          >
            {MODULE_SLUGS.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 text-sm text-neutral-300 hover:text-neutral-50 border border-neutral-700 transition-colors"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 text-sm text-neutral-200 hover:text-neutral-50 border border-neutral-700 transition-colors"
          >
            <Download className="size-4" />
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 text-neutral-600">Loading analytics…</div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Total Work Orders" value={totalWOs} />
            <KpiCard
              label="Total Containers"
              value={data?.totalContainers ?? 0}
            />
            <KpiCard
              label="Total BLs"
              value={data?.totalBLs ?? 0}
            />
            <KpiCard
              label="BL Pending > 48h (demo)"
              value={data?.blPendingAfterETD ?? 0}
              sub="Rows with CURRENT ETD but no BL NO"
            />
          </div>

          {/* Secondary KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Completed" value={completedCount} sub={totalWOs ? `${Math.round((completedCount / totalWOs) * 100)}% of total` : ""} />
            <KpiCard label="In Progress / Pending" value={inProgressCount} />
            <KpiCard label="Critical / Issues" value={criticalCount} />
            <KpiCard
              label="Vessels > 25 Containers"
              value={data?.vesselsOverLimit.length ?? 0}
              sub="Validation prevents this in demo"
            />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status distribution — Pie */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Status Distribution</h3>
              {data?.byStatus && data.byStatus.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.byStatus}
                        dataKey="count"
                        nameKey="statusName"
                        isAnimationActive={false}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={false}
                        labelLine={false}
                      >
                        {data.byStatus.map((entry, index) => (
                          <Cell key={entry.statusName} fill={PIE_COLORS[index] ?? "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #404040", borderRadius: 8 }}
                        labelStyle={{ color: "#e5e5e5" }}
                        itemStyle={{ color: "#a3a3a3" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                    {data.byStatus.map((s) => (
                      <div key={s.statusName} className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `#${s.colorHex}` }}
                        />
                        <span className="text-xs text-neutral-400 truncate">
                          {s.statusName}
                        </span>
                        <span className="ml-auto text-xs text-neutral-600 tabular-nums">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-600 text-center py-16">No data yet.</p>
              )}
            </div>

            {/* Work orders per module — Bar */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Work Orders by Module</h3>
              {data?.byModule && data.byModule.some((m) => m.count > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.byModule} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="moduleName" tick={{ fill: "#737373", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #404040", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                      itemStyle={{ color: "#a3a3a3" }}
                    />
                    <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-neutral-600 text-center py-16">No data yet.</p>
              )}
            </div>
          </div>

          {/* Import timeline — Line */}
          {data?.importTimeline && data.importTimeline.length > 1 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Import Timeline (rows added per batch)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.importTimeline} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" tick={{ fill: "#737373", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid #404040", borderRadius: 8 }}
                    labelStyle={{ color: "#e5e5e5" }}
                    itemStyle={{ color: "#a3a3a3" }}
                  />
                  <Line type="monotone" dataKey="addedCount" stroke="#22C55E" strokeWidth={2} dot={{ fill: "#22C55E", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-module progress bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Completion progress by module */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Completion Progress by Module</h3>
              <div className="space-y-4">
                {data?.byModule.map((m) => {
                  const pct = totalWOs > 0 ? Math.round((m.count / totalWOs) * 100) : 0;
                  return (
                    <div key={m.slug}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-neutral-400">{m.moduleName}</span>
                        <span className="text-neutral-500">{m.count} WOs ({pct}%)</span>
                      </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-200 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shipping line & vessel summary */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Containers by Shipping Line & Vessel</h3>
              <div className="space-y-4 text-xs text-neutral-300 max-h-64 overflow-y-auto">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">By Shipping Line</p>
                  {data?.containersByLine.map((l) => (
                    <div key={l.lineName} className="flex justify-between">
                      <span className="text-neutral-400">{l.lineName || "Unknown"}</span>
                      <span className="text-neutral-500 tabular-nums">{l.containerCount} containers</span>
                    </div>
                  ))}
                  {(!data?.containersByLine || data.containersByLine.length === 0) && (
                    <p className="text-neutral-600">No container data yet.</p>
                  )}
                </div>
                <div className="pt-3 border-t border-neutral-800">
                  <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">Vessels over container limit</p>
                  {data?.vesselsOverLimit.length ? (
                    data.vesselsOverLimit.map((v) => (
                      <div key={v.vesselName} className="flex items-center justify-between text-red-400">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          <span>{v.vesselName}</span>
                        </span>
                        <span className="tabular-nums">{v.containerCount} containers</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-neutral-600">No vessels above 25 containers in demo data.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
