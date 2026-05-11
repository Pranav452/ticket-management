"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check,
  MessageSquare, Clock, User, Send, Bell, Mail,
  ChevronDown, AlertTriangle, Edit2, X,
} from "lucide-react";
import {
  useWorkOrder, useUpdateWorkOrder, useBajajComments,
  useAddBajajComment, useBajajStatuses, useBajajUsers,
  useBajajAuditLogs,
} from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import type { BajajAuditLog } from "@/lib/types/bajaj";

const FIELD_LABELS: Record<string, string> = {
  wo: "WO No", wodt: "WO Date", country: "Country", port: "Port",
  plant: "Plant", brand: "Brand", variant: "Variant",
  qty: "Quantity", hc40: "40 HC", std20: "20 STD",
  veh: "Vehicle", cont: "Containers", type: "Type",
  s_line: "Shipping Line", vessel_name: "Vessel Name",
  booking_no: "Booking No", container_no: "Container No",
  agent: "Agent", transporter: "Transporter", consignee: "Consignee",
  po_no: "PO No", lc_no: "LC No", lc_date: "LC Date",
  ff_job: "FF Job No", sbno: "SB No", sb_date: "SB Date",
  blno: "BL No", bldt: "BL Date", bl_handover_time: "BL Handover Time",
  for_hbl: "For HBL", haz: "Hazardous", vgm_submitted: "VGM Submitted", si_submitted: "SI Submitted",
  pol_gate: "POL Gate", stuffing_on: "Stuffing On", do_given_dt: "DO Given Date",
  pick_up_dt: "Pick Up Date", cntr_dispatch: "Cntr Dispatch", gate_open: "Gate Open",
  gate_cut_off: "Gate Cut Off", si_cut_off: "SI Cut Off",
  cntr_report_nhava_sheva: "Cntr Report Nhava Sheva", cntr_gated_in_port: "Cntr Gated In Port",
  final_vsl_sob: "Final VSL SOB", do_etd: "DO ETD", current_etd: "Current ETD",
  eta_at_destination: "ETA at Destination", sailingdt: "Sailing Date",
  s_line_payment_status: "S/Line Payment Status", e_doc_status: "E-Doc Status",
  clearance_point: "Clearance Point", open_order: "Open Order", buffer_yard: "Buffer Yard",
  courier_dt: "Courier Date", assy_config: "Assy Config", remark: "Remark",
};

const SECTIONS = [
  { title: "Cargo",         fields: ["brand", "variant", "qty", "hc40", "std20", "plant", "type", "veh", "cont"] },
  { title: "Shipping",      fields: ["s_line", "vessel_name", "agent", "transporter", "consignee", "booking_no", "container_no"] },
  { title: "Route & Dates", fields: ["port", "country", "wodt", "stuffing_on", "gate_open", "gate_cut_off", "do_etd", "current_etd", "eta_at_destination", "sailingdt"] },
  { title: "Documents",     fields: ["po_no", "lc_no", "lc_date", "ff_job", "booking_no", "sbno", "sb_date", "blno", "bldt", "bl_handover_time", "for_hbl"] },
  { title: "Status Flags",  fields: ["haz", "vgm_submitted", "si_submitted"] },
  { title: "Port Tracking", fields: ["pol_gate", "pick_up_dt", "cntr_dispatch", "cntr_report_nhava_sheva", "cntr_gated_in_port", "final_vsl_sob", "s_line_payment_status", "e_doc_status"] },
  { title: "Notes",         fields: ["clearance_point", "open_order", "buffer_yard", "courier_dt", "assy_config", "remark"] },
];

const STAGE_REQUIRED_FIELDS: Array<{ match: string; fields: string[] }> = [
  { match: "planning",    fields: ["wo", "plant", "brand", "variant", "qty", "country"] },
  { match: "booking req", fields: ["s_line", "vessel_name", "agent"] },
  { match: "booking",     fields: ["booking_no", "s_line", "vessel_name"] },
  { match: "container",   fields: ["container_no", "transporter"] },
  { match: "si",          fields: ["sbno", "ff_job"] },
  { match: "clearance",   fields: ["blno"] },
  { match: "gate",        fields: ["pol_gate"] },
  { match: "billing",     fields: [] },
];

function getRequiredFields(statusName: string): string[] {
  const lower = statusName.toLowerCase();
  const entry = STAGE_REQUIRED_FIELDS.find((e) => lower.includes(e.match));
  return entry?.fields ?? [];
}

// ─── Inline editable field ────────────────────────────────────────────────────
function EditField({ fieldKey, label, value, onSave, boolean: isBool = false }: {
  fieldKey: string; label: string; value: unknown;
  onSave: (key: string, val: string | boolean) => void; boolean?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value != null ? String(value) : "");
  const displayVal = value != null && value !== "" ? String(value) : null;
  const isTrueish  = value === true || value === 1 || value === "true";

  if (isBool) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 font-semibold">{label}</span>
        <button
          onClick={() => onSave(fieldKey, !isTrueish)}
          className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-md border w-fit transition-colors",
            isTrueish ? "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-500/30" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-white/5 dark:text-white/50 dark:border-white/10 dark:hover:bg-white/8")}
        >
          {isTrueish ? <AlertTriangle className="size-3" /> : <div className="size-3 rounded-full border border-gray-400 dark:border-white/30" />}
          {isTrueish ? "Yes" : "No"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 group">
      <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 font-semibold">{label}</span>
      {editing ? (
        <input
          autoFocus value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val !== String(value ?? "")) onSave(fieldKey, val); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setEditing(false); if (val !== String(value ?? "")) onSave(fieldKey, val); }
            if (e.key === "Escape") { setVal(String(value ?? "")); setEditing(false); }
          }}
          className="bg-white dark:bg-[#1a1a1a] border border-amber-400 rounded-md px-2 py-1 text-[13px] text-gray-800 dark:text-white/90 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
      ) : (
        <button onClick={() => { setVal(String(value ?? "")); setEditing(true); }} className="flex items-center gap-1.5 text-[13px] text-left group/field">
          <span className={displayVal ? "text-gray-800 dark:text-white/90" : "text-gray-300 dark:text-white/25 italic"}>{displayVal ?? "—"}</span>
          <Edit2 className="size-2.5 text-gray-300 dark:text-white/25 opacity-0 group-hover/field:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      )}
    </div>
  );
}

// ─── Activity item ────────────────────────────────────────────────────────────
function ActivityItem({ log }: { log: BajajAuditLog }) {
  const actionMap: Record<string, { label: string; color: string }> = {
    moved_card:          { label: "moved to",      color: "text-blue-500"   },
    assigned:            { label: "assigned to",   color: "text-amber-500"  },
    edited_field:        { label: "updated field", color: "text-violet-500" },
    approved_user:       { label: "approved user", color: "text-green-500"  },
    rejected_user:       { label: "rejected user", color: "text-red-500"    },
    imported:            { label: "imported",      color: "text-green-500"  },
    "work_order.update": { label: "updated",       color: "text-gray-500"   },
  };
  const info       = actionMap[log.action] ?? { label: log.action.replace(/_/g, " "), color: "text-gray-500" };
  const actor      = log.actor_email ?? "System";
  const shortActor = actor.split("@")[0];
  const newVal     = log.new_value;
  let detail = "";
  if (newVal && typeof newVal === "object") {
    const v = newVal as Record<string, unknown>;
    if (v.status_id) detail = `status → ${v.status_id}`;
    else if (v.assigned_to) detail = `→ ${v.assigned_to}`;
    else if (v.data) detail = Object.keys(v.data as object).join(", ");
  }

  return (
    <div className="flex items-start gap-3">
      <div className="size-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-gray-500 dark:text-white/50">
        {shortActor[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-700 dark:text-white/80">
          <span className="font-medium text-gray-900 dark:text-white">{shortActor}</span>{" "}
          <span className={info.color}>{info.label}</span>
          {detail && <span className="text-gray-400 dark:text-white/40 ml-1 text-[12px]">{detail}</span>}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">
          {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function WorkOrderDetailPage({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const { data: workOrder, isLoading } = useWorkOrder(workOrderId);
  const { data: comments = [] }        = useBajajComments(workOrderId);
  const { data: bajajUsers = [] }      = useBajajUsers();
  const { data: auditLogs = [] }       = useBajajAuditLogs({ limit: 50, targetId: workOrderId });
  const updateWorkOrder = useUpdateWorkOrder();
  const addComment      = useAddBajajComment();
  const { bajajUser }   = useAuthStore();

  const [allStatuses,        setAllStatuses]        = useState<{ id: string; name: string; color_hex: string }[]>([]);
  const [showStatusPicker,   setShowStatusPicker]   = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [commentText,        setCommentText]        = useState("");
  const [savingField,        setSavingField]        = useState<string | null>(null);
  const [autoAdvanced,       setAutoAdvanced]       = useState(false);

  useEffect(() => {
    fetch("/api/bajaj/statuses")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Deduplicate by name — all modules share the same status names
          const seen = new Set<string>();
          const unique = data.filter((s: { name: string }) => seen.has(s.name) ? false : (seen.add(s.name), true));
          setAllStatuses(unique);
        }
      })
      .catch(() => {});
  }, []);

  const handleFieldSave = useCallback((key: string, val: string | boolean) => {
    setSavingField(key);
    const merged = { ...(workOrder?.data as Record<string, unknown> ?? {}), [key]: val };
    updateWorkOrder.mutate(
      { id: workOrderId, updates: { data: { [key]: val } } },
      {
        onSettled: () => setSavingField(null),
        onSuccess: () => {
          // Resolve currentStatus inside callback to avoid TDZ
          const resolvedStatus = allStatuses.find((s) => s.id === workOrder?.status_id);
          const statusName = resolvedStatus?.name ?? "";
          const required = getRequiredFields(statusName);
          const allFilled = required.every((f) => {
            const v = merged[f];
            return v != null && v !== "" && v !== false;
          });
          if (allFilled && required.length > 0) {
            const idx = allStatuses.findIndex((s) => s.id === workOrder?.status_id);
            const next = allStatuses[idx + 1];
            if (next) {
              updateWorkOrder.mutate({ id: workOrderId, updates: { status_id: next.id } });
              setAutoAdvanced(true);
              setTimeout(() => setAutoAdvanced(false), 3000);
            }
          }
        },
      }
    );
  }, [workOrderId, workOrder, allStatuses, updateWorkOrder]);

  async function handleComment() {
    if (!commentText.trim() || !bajajUser) return;
    await addComment.mutateAsync({ workOrderId, authorEmail: bajajUser.email, authorName: bajajUser.full_name ?? undefined, content: commentText.trim() });
    setCommentText("");
  }

  if (isLoading) return <div className="flex h-full items-center justify-center bg-white dark:bg-black"><Loader2 className="size-6 text-amber-500 animate-spin" /></div>;
  if (!workOrder) return (
    <div className="flex h-full items-center justify-center flex-col gap-3 bg-white dark:bg-black">
      <p className="text-gray-500 dark:text-white/50">Work order not found</p>
      <button onClick={() => router.back()} className="text-amber-600 text-sm hover:underline">← Go back</button>
    </div>
  );

  const d            = workOrder.data as Record<string, unknown>;
  const wo           = String(d.wo ?? workOrderId);
  const brand        = d.brand   ? String(d.brand)   : "";
  const variant      = d.variant ? String(d.variant) : "";
  const title        = [brand, variant].filter(Boolean).join(" · ") || `WO ${wo}`;
  const currentStatus = allStatuses.find((s) => s.id === workOrder.status_id);
  const assignedUser  = bajajUsers.find((u) => u.id === workOrder.assigned_to || u.email === workOrder.assigned_to);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--main-bg, #F5F5F5)" }}>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-white dark:bg-[#0d0d0d] flex-shrink-0" style={{ borderColor: "var(--border-color, #E5E7EB)" }}>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors">
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <span className="text-gray-300 dark:text-white/25">/</span>
          <span className="text-[13px] text-gray-400 dark:text-white/40">{d.country ? String(d.country) : "Work Orders"}</span>
          <span className="text-gray-300 dark:text-white/25">/</span>
          <span className="text-[13px] font-mono text-gray-600 dark:text-white/70">{wo}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => router.back()} className="flex items-center justify-center size-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 hover:border-gray-300 dark:hover:border-white/20 transition-colors">
              <ChevronLeft className="size-3.5" />
            </button>
            <button className="flex items-center justify-center size-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 hover:border-gray-300 dark:hover:border-white/20 transition-colors">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Auto-advance banner */}
        {autoAdvanced && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-[13px] font-medium animate-pulse flex-shrink-0">
            ✓ Auto-advanced to next stage
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0d0d0d]">
          <div className="max-w-3xl mx-auto px-8 py-8">

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h1>
            <p className="text-[13px] text-gray-400 dark:text-white/40 mb-6 font-mono">{wo}</p>

            {/* Status + Assignee */}
            <div className="flex items-center gap-3 mb-8">
              {/* Status picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusPicker((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-sm"
                >
                  <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatus ? `#${currentStatus.color_hex}` : "#D1D5DB" }} />
                  <span className="text-[13px] font-medium text-gray-700 dark:text-white/80">{currentStatus?.name ?? "No Status"}</span>
                  <ChevronDown className="size-3 text-gray-400 dark:text-white/40" />
                </button>
                {showStatusPicker && (
                  <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/5 py-1.5 min-w-[180px]">
                    {allStatuses.map((s) => (
                      <button key={s.id} onClick={() => { updateWorkOrder.mutate({ id: workOrderId, updates: { status_id: s.id } }); setShowStatusPicker(false); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left">
                        <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: `#${s.color_hex}` }} />
                        {s.name}
                        {workOrder.status_id === s.id && <Check className="size-3 text-amber-500 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee picker */}
              <div className="relative">
                <button
                  onClick={() => setShowAssigneePicker((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-sm"
                >
                  <div className="size-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-500 dark:text-white/50 flex-shrink-0">
                    {assignedUser ? (assignedUser.full_name ?? assignedUser.email)[0].toUpperCase() : <User className="size-3 text-gray-400 dark:text-white/40" aria-hidden />}
                  </div>
                  <span className="text-[13px] text-gray-700 dark:text-white/80">{assignedUser ? (assignedUser.full_name ?? assignedUser.email.split("@")[0]) : "Unassigned"}</span>
                  <ChevronDown className="size-3 text-gray-400 dark:text-white/40" />
                </button>
                {showAssigneePicker && (
                  <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/5 py-1.5 min-w-[200px]">
                    <button onClick={() => { updateWorkOrder.mutate({ id: workOrderId, updates: { assigned_to: null } }); setShowAssigneePicker(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-500 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <div className="size-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center"><X className="size-2.5 text-gray-400 dark:text-white/40" /></div>
                      Unassigned
                    </button>
                    {bajajUsers.map((u) => (
                      <button key={u.id} onClick={() => { updateWorkOrder.mutate({ id: workOrderId, updates: { assigned_to: u.id } }); setShowAssigneePicker(false); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <div className="size-5 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700">
                          {(u.full_name ?? u.email)[0].toUpperCase()}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="truncate">{u.full_name ?? u.email.split("@")[0]}</p>
                          <p className="text-[10px] text-gray-400 dark:text-white/40 truncate">{u.email}</p>
                        </div>
                        {(workOrder.assigned_to === u.id || workOrder.assigned_to === u.email) && <Check className="size-3 text-amber-500 ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Field sections */}
            {SECTIONS.map((section, sectionIdx) => {
              const hasValues = section.fields.some((f) => d[f] != null && d[f] !== "" && d[f] !== false);
              return (
                <div key={section.title} className={cn("mb-6", sectionIdx > 0 && "mt-2")}>
                  {/* Section divider — Linear style */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                      {section.title}
                      {!hasValues && <span className="normal-case font-normal tracking-normal text-gray-300 dark:text-white/25">(empty)</span>}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-white/6" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    {section.fields.map((f) => {
                      const isBool = ["haz", "vgm_submitted", "si_submitted"].includes(f);
                      return (
                        <div key={f} className="relative">
                          <EditField fieldKey={f} label={FIELD_LABELS[f] ?? f} value={d[f]} onSave={handleFieldSave} boolean={isBool} />
                          {savingField === f && <Loader2 className="size-3 text-amber-500 animate-spin absolute right-0 top-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Comments */}
            <div className="mb-8 mt-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" /> Comments
                  <span className="normal-case font-normal tracking-normal text-gray-300 dark:text-white/25">({comments.length})</span>
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/6" />
              </div>

              {comments.length === 0
                ? <p className="text-[13px] text-gray-400 dark:text-white/40 mb-4">No comments yet.</p>
                : (
                  <div className="space-y-4 mb-4">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-3">
                        <div className="size-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-white/50 flex-shrink-0">
                          {(c.author?.full_name ?? c.author?.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-medium text-gray-800 dark:text-white/90">{c.author?.full_name ?? c.author?.email}</span>
                            <span className="text-[11px] text-gray-400 dark:text-white/40">
                              {new Date(c.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-700 dark:text-white/80 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {bajajUser && (
                <div className="flex items-start gap-3">
                  <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 flex-shrink-0">
                    {(bajajUser.full_name ?? bajajUser.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={commentText} onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment…" rows={2}
                      className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/30 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment(); }}
                    />
                    <div className="flex justify-end mt-1.5">
                      <button onClick={handleComment} disabled={!commentText.trim() || addComment.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-[13px] font-medium text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {addComment.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Activity feed */}
            {auditLogs.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Activity
                  </span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/6" />
                </div>
                <div className="space-y-4">
                  {auditLogs.map((log) => <ActivityItem key={log.id} log={log} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right sidebar ─────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-l border-gray-100 dark:border-white/6 bg-white dark:bg-[#0d0d0d] flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b dark:border-white/6" style={{ borderColor: "var(--border-color, #F3F4F6)" }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-3">Work Order Info</p>

          {/* Status */}
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1.5">Status</p>
            <button onClick={() => setShowStatusPicker((v) => !v)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-white/20 transition-colors">
              <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatus ? `#${currentStatus.color_hex}` : "#D1D5DB" }} />
              <span className="text-[13px] text-gray-700 dark:text-white/80 truncate flex-1 text-left">{currentStatus?.name ?? "No Status"}</span>
            </button>
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1.5">Assignee</p>
            <button onClick={() => setShowAssigneePicker((v) => !v)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-white/20 transition-colors">
              <div className="size-5 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-white/60 flex-shrink-0">
                {assignedUser ? (assignedUser.full_name ?? assignedUser.email)[0].toUpperCase() : <User className="size-3 text-gray-400 dark:text-white/40" aria-hidden />}
              </div>
              <span className="text-[13px] text-gray-700 dark:text-white/80 truncate flex-1 text-left">
                {assignedUser ? (assignedUser.full_name ?? assignedUser.email.split("@")[0]) : "Unassigned"}
              </span>
            </button>
          </div>

          <div className="mb-3">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Module</p>
            <p className="text-[13px] text-gray-700 dark:text-white/80">{d.country ? String(d.country) : "—"}</p>
          </div>
          <div className="mb-3">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Port</p>
            <p className="text-[13px] text-gray-700 dark:text-white/80">{d.port ? String(d.port) : "—"}</p>
          </div>
          <div className="mb-3">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">WO Date</p>
            <p className="text-[13px] text-gray-700 dark:text-white/80">{d.wodt ? String(d.wodt) : "—"}</p>
          </div>
          <div className="mb-3">
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-1">Sailing Date</p>
            <p className="text-[13px] text-gray-700 dark:text-white/80">{d.sailingdt ? String(d.sailingdt) : "—"}</p>
          </div>
        </div>

        {/* Cargo metrics */}
        <div className="px-4 py-4 border-b dark:border-white/6" style={{ borderColor: "var(--border-color, #F3F4F6)" }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-3">Cargo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">Qty</p>
              <p className="text-[18px] font-bold text-gray-900 dark:text-white tabular-nums">{String(d.qty ?? "—")}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">40 HC</p>
              <p className="text-[18px] font-bold text-gray-900 dark:text-white tabular-nums">{String(d.hc40 ?? "—")}</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-3">Quick Actions</p>
          <div className="space-y-2">
            <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 text-[13px] text-gray-600 dark:text-white/70 transition-colors">
              <Bell className="size-3.5 text-amber-500" /> Set Reminder
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 text-[13px] text-gray-600 dark:text-white/70 transition-colors">
              <Mail className="size-3.5 text-blue-500" /> Email Notify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
