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
import { Download, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { useBajajAnalytics } from "@/lib/queries/bajaj";

const MODULE_SLUGS = [
  { slug: "", name: "All Modules" },
  { slug: "vipar", name: "Vipar" },
  { slug: "srilanka", name: "Sri Lanka" },
  { slug: "nigeria", name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph", name: "Triumph" },
];

function KpiCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`border rounded-xl px-5 py-4 ${
        alert && Number(value) > 0
          ? "bg-red-950/40 border-red-800"
          : "bg-neutral-900 border-neutral-800"
      }`}
    >
      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{label}</p>
      <p
        className={`text-3xl font-semibold tabular-nums ${
          alert && Number(value) > 0 ? "text-red-400" : "text-neutral-50"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

export function BajajDashboard() {
  const [selectedModule, setSelectedModule] = useState("");
  const { data, isLoading, refetch } = useBajajAnalytics(selectedModule || undefined);

  const totalWOs = data?.totalWorkOrders ?? 0;
  const completedCount =
    data?.byStatus.find(
      (s) =>
        s.statusName.toLowerCase().includes("complet") || s.colorHex === "99CC00",
    )?.count ?? 0;
  const criticalCount =
    data?.byStatus.find(
      (s) =>
        s.statusName.toLowerCase().includes("critical") ||
        s.statusName.toLowerCase().includes("issue") ||
        s.colorHex === "FF0000",
    )?.count ?? 0;
  const inProgressCount =
    data?.byStatus.find(
      (s) =>
        s.statusName.toLowerCase().includes("pending") ||
        s.statusName.toLowerCase().includes("progress") ||
        s.statusName.toLowerCase().includes("booking") ||
        s.statusName.toLowerCase().includes("planned"),
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
          <p className="text-sm text-neutral-500 mt-1">
            Bajaj Auto Shipment — Work Order Overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
          >
            {MODULE_SLUGS.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
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
        <div className="flex items-center justify-center py-32 text-neutral-600">
          Loading analytics…
        </div>
      ) : (
        <>
          {/* BL Alert Banner */}
          {(data?.blPendingAfterETD ?? 0) > 0 && (
            <div className="flex items-center gap-3 bg-red-950/50 border border-red-700 rounded-xl px-5 py-3 mb-6">
              <AlertTriangle className="size-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  BL Not Generated — {data!.blPendingAfterETD} shipment
                  {data!.blPendingAfterETD > 1 ? "s" : ""} past ETD by more than 48 hours
                </p>
                <p className="text-xs text-red-500 mt-0.5">
                  These work orders have a CURRENT ETD that has passed but no BL NO assigned.
                </p>
              </div>
            </div>
          )}

          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Total Work Orders" value={totalWOs} />
            <KpiCard label="Total Containers" value={data?.totalContainers ?? 0} />
            <KpiCard label="Total Bills of Lading" value={data?.totalBLs ?? 0} />
            <KpiCard
              label="BL Not Generated > 48h After ETD"
              value={data?.blPendingAfterETD ?? 0}
              sub="Rows with CURRENT ETD past but no BL NO"
              alert
            />
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="Shipment Complete"
              value={completedCount}
              sub={totalWOs ? `${Math.round((completedCount / totalWOs) * 100)}% of total` : ""}
            />
            <KpiCard label="In Progress / Pending" value={inProgressCount} />
            <KpiCard label="Critical / Issues" value={criticalCount} />
            <KpiCard
              label="Vessels > 25 Containers"
              value={data?.vesselsOverLimit.length ?? 0}
              sub="Maximum 25 containers per vessel"
              alert
            />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status distribution — Pie */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Status Distribution
              </h3>
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
                          <Cell
                            key={entry.statusName}
                            fill={PIE_COLORS[index] ?? "#6b7280"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0a0a0a",
                          border: "1px solid #404040",
                          borderRadius: 8,
                        }}
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
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Work Orders by Module
              </h3>
              {data?.byModule && data.byModule.some((m) => m.count > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.byModule}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="moduleName" tick={{ fill: "#737373", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#0a0a0a",
                        border: "1px solid #404040",
                        borderRadius: 8,
                      }}
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
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Import Timeline (rows added per batch)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={data.importTimeline}
                  margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" tick={{ fill: "#737373", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #404040",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#e5e5e5" }}
                    itemStyle={{ color: "#a3a3a3" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="addedCount"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={{ fill: "#22C55E", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Row: Module progress + Shipping line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Completion progress by module */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Work Orders by Module
              </h3>
              <div className="space-y-4">
                {data?.byModule.map((m) => {
                  const pct =
                    totalWOs > 0 ? Math.round((m.count / totalWOs) * 100) : 0;
                  return (
                    <div key={m.slug}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-neutral-400">{m.moduleName}</span>
                        <span className="text-neutral-500">
                          {m.count} WOs ({pct}%)
                        </span>
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

            {/* Containers by Shipping Line */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Containers by Shipping Line
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data?.containersByLine && data.containersByLine.length > 0 ? (
                  data.containersByLine.map((l) => (
                    <div
                      key={l.lineName}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-neutral-400">{l.lineName || "Unknown"}</span>
                      <span className="text-neutral-500 tabular-nums font-medium">
                        {l.containerCount} containers
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-600">No container data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Row: Containers per vessel + Parts & Frames */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Containers per vessel */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-300 mb-4">
                Containers per Vessel
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data?.containersByVessel && data.containersByVessel.length > 0 ? (
                  data.containersByVessel.map((v) => {
                    const overLimit = v.containerCount > 25;
                    return (
                      <div
                        key={v.vesselName}
                        className="flex items-center justify-between text-sm"
                      >
                        <span
                          className={`truncate max-w-[65%] ${overLimit ? "text-red-400" : "text-neutral-400"}`}
                        >
                          {overLimit && (
                            <AlertTriangle className="size-3 inline mr-1" />
                          )}
                          {v.vesselName}
                        </span>
                        <span
                          className={`tabular-nums font-medium flex-shrink-0 ${overLimit ? "text-red-400" : "text-neutral-500"}`}
                        >
                          {v.containerCount} containers
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-neutral-600">No vessel data yet.</p>
                )}
              </div>
              {data?.vesselsOverLimit && data.vesselsOverLimit.length > 0 && (
                <p className="text-xs text-red-500 mt-3 border-t border-neutral-800 pt-3">
                  {data.vesselsOverLimit.length} vessel
                  {data.vesselsOverLimit.length > 1 ? "s" : ""} exceed the 25-container limit.
                </p>
              )}
              {data?.vesselsOverLimit && data.vesselsOverLimit.length === 0 && (data?.containersByVessel?.length ?? 0) > 0 && (
                <p className="text-xs text-neutral-600 mt-3 border-t border-neutral-800 pt-3">
                  All vessels within the 25-container limit.
                </p>
              )}
            </div>

            {/* Parts & Frames */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="size-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-neutral-300">
                  Parts & Frames Shipments
                </h3>
                <span className="ml-auto text-xs text-neutral-600 tabular-nums">
                  {data?.partsAndFrames.length ?? 0} rows
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data?.partsAndFrames && data.partsAndFrames.length > 0 ? (
                  data.partsAndFrames.map((pf, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 text-sm py-1.5 border-b border-neutral-800/60 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-neutral-300 truncate">{pf.vehType}</p>
                        <p className="text-xs text-neutral-600 truncate mt-0.5">
                          {pf.vesselName}
                        </p>
                      </div>
                      <span className="text-neutral-500 tabular-nums text-xs flex-shrink-0 mt-0.5">
                        {pf.containerCount} cont.
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-600">
                    No parts or frames shipments found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
