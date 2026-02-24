"use client";

import React, { useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { Download, RefreshCw } from "lucide-react";
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
      <p className="text-3xl font-bold text-neutral-100">{value}</p>
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
    s.colorHex === "FFFF00" || s.statusName.toLowerCase().includes("pending") || s.statusName.toLowerCase().includes("progress")
  )?.count ?? 0;

  // Pie colors derived from status color_hex
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
    <div className="min-h-full bg-neutral-950 px-8 py-8 overflow-y-auto">
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
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-amber-600"
          >
            {MODULE_SLUGS.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 transition-colors"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-sm text-white hover:bg-amber-500 transition-colors"
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
            <KpiCard label="Completed" value={completedCount} sub={totalWOs ? `${Math.round((completedCount / totalWOs) * 100)}% of total` : ""} />
            <KpiCard label="In Progress / Pending" value={inProgressCount} />
            <KpiCard label="Critical / Issues" value={criticalCount} />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status distribution — Pie */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">Status Distribution</h3>
              {data?.byStatus && data.byStatus.length > 0 ? (
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
                      contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                      itemStyle={{ color: "#a3a3a3" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
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
                      contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                      itemStyle={{ color: "#a3a3a3" }}
                    />
                    <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
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
                    contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8 }}
                    labelStyle={{ color: "#e5e5e5" }}
                    itemStyle={{ color: "#a3a3a3" }}
                  />
                  <Line type="monotone" dataKey="addedCount" stroke="#d97706" strokeWidth={2} dot={{ fill: "#d97706", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-module progress bars */}
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
                        className="h-full bg-amber-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
