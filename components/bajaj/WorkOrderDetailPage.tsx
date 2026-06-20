"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check,
  MessageSquare, Clock, Send, Bell, Mail,
  ChevronDown, AlertTriangle, Edit2,
  X, CheckCircle, BellPlus, CalendarClock, Monitor,
} from "lucide-react";
import {
  useWorkOrder, useUpdateWorkOrder, useBajajComments,
  useAddBajajComment, useBajajStatuses,
  useBajajAuditLogs, useColumnRequiredFields,
  useCreateBajajReminder, useMyColumnPerms,
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
  { title: "Cargo",         fields: ["veh", "type", "qty", "cont", "std20", "plant"] },
  { title: "Shipping",      fields: ["s_line", "vessel_name", "agent", "transporter", "consignee", "booking_no", "container_no"] },
  { title: "Route & Dates", fields: ["port", "country", "wodt", "stuffing_on", "gate_open", "gate_cut_off", "do_etd", "current_etd", "eta_at_destination", "sailingdt"] },
  { title: "Documents",     fields: ["po_no", "lc_no", "lc_date", "ff_job", "booking_no", "sbno", "sb_date", "blno", "bldt", "bl_handover_time", "for_hbl"] },
  { title: "Status Flags",  fields: ["haz", "vgm_submitted", "si_submitted"] },
  { title: "Port Tracking", fields: ["pol_gate", "pick_up_dt", "cntr_dispatch", "cntr_report_nhava_sheva", "cntr_gated_in_port", "final_vsl_sob", "s_line_payment_status", "e_doc_status"] },
  { title: "Notes",         fields: ["clearance_point", "open_order", "buffer_yard", "courier_dt", "assy_config", "remark"] },
];


// ─── Inline editable field ────────────────────────────────────────────────────
function EditField({ fieldKey, label, value, onSave, boolean: isBool = false, canEdit = true }: {
  fieldKey: string; label: string; value: unknown;
  onSave: (key: string, val: string | boolean) => void; boolean?: boolean; canEdit?: boolean;
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
          onClick={canEdit ? () => onSave(fieldKey, !isTrueish) : undefined}
          disabled={!canEdit}
          className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-md border w-fit transition-colors",
            !canEdit && "cursor-default",
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
      {!canEdit ? (
        <span className={cn("text-[13px]", displayVal ? "text-gray-800 dark:text-white/90" : "text-gray-300 dark:text-white/25 italic")}>{displayVal ?? "—"}</span>
      ) : editing ? (
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

function countryToSlug(country: string): string {
  const c = country?.toLowerCase() ?? "";
  if (c === "sri lanka") return "srilanka";
  if (c === "nigeria") return "nigeria";
  if (c === "bangladesh" || c === "bangaldesh") return "bangladesh";
  if (c === "united kingdom") return "triumph";
  return "vipar";
}

// ─── Shared dialog helpers ────────────────────────────────────────────────────
const DIALOG_INPUT =
  "w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors";
const DIALOG_CHIP =
  "px-2.5 py-1 rounded-md text-[12px] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:border-amber-400 hover:text-amber-600 transition-colors";

const REMINDER_REASONS = ["Follow up", "Document due", "Payment due", "Booking deadline", "ETA / sailing check", "Custom"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
/** Format a Date as a value for <input type="datetime-local"> in the user's local time. */
function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseEmails(raw: string): string[] {
  const set = new Set<string>();
  for (const part of raw.split(/[\s,;]+/g)) { const t = part.trim().toLowerCase(); if (t) set.add(t); }
  return Array.from(set);
}
function atHour(daysFromNow: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ─── Set Reminder dialog ──────────────────────────────────────────────────────
function ReminderDialog({
  workOrderId, moduleId, defaultSubject, defaultEmail, createdBy, onClose,
}: {
  workOrderId: string; moduleId: string;
  defaultSubject: string; defaultEmail: string; createdBy: string | null;
  onClose: () => void;
}) {
  const createReminder = useCreateBajajReminder();

  const [reason,  setReason]  = useState<string>(REMINDER_REASONS[0]);
  const [subject, setSubject] = useState(defaultSubject);
  const [channel, setChannel] = useState<"inapp" | "email">("inapp");
  const [when,    setWhen]    = useState(() => toLocalInputValue(atHour(1)));
  const [emails,  setEmails]  = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setQuick(days: number) { setWhen(toLocalInputValue(atHour(days))); }

  async function submit() {
    setError(null);
    const due = new Date(when);
    if (Number.isNaN(due.getTime())) { setError("Pick a valid date and time."); return; }
    if (due.getTime() <= Date.now()) { setError("Reminder time must be in the future."); return; }

    const recipients = channel === "email" ? parseEmails(emails) : [];
    if (channel === "email" && recipients.length === 0) { setError("Add at least one recipient email."); return; }

    const label = subject.trim() || defaultSubject;
    const reasonPrefix = reason && reason !== "Custom" ? `${reason} — ` : "";
    try {
      await createReminder.mutateAsync({
        workOrderId, moduleId,
        workOrderSummary: label,
        due_at: due.toISOString(),
        recipients,
        message: message.trim() || `${reasonPrefix}${label}`,
        createdBy,
      });
      setDone(true);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set reminder.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <BellPlus className="size-4 text-amber-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Set Reminder</p>
          </div>
          <button onClick={onClose} className="size-7 inline-flex items-center justify-center rounded-md text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* What for */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold">What&apos;s this reminder for?</label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={cn("px-2.5 py-1 rounded-full text-[12px] border transition-colors",
                    reason === r
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-white/70 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20")}>
                  {r}
                </button>
              ))}
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (which work order / what to do)" className={DIALOG_INPUT} />
          </div>

          {/* When */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold flex items-center gap-1.5">
              <CalendarClock className="size-3.5" /> Remind me on
            </label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={DIALOG_INPUT} />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setQuick(1)} className={DIALOG_CHIP}>Tomorrow</button>
              <button type="button" onClick={() => setQuick(3)} className={DIALOG_CHIP}>In 3 days</button>
              <button type="button" onClick={() => setQuick(7)} className={DIALOG_CHIP}>Next week</button>
            </div>
          </div>

          {/* How */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold">How do you want to be notified?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setChannel("inapp")}
                className={cn("flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] transition-colors",
                  channel === "inapp"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:border-gray-300 dark:hover:border-white/20")}>
                <Monitor className="size-4" /> In-app
              </button>
              <button type="button" onClick={() => setChannel("email")}
                className={cn("flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] transition-colors",
                  channel === "email"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:border-gray-300 dark:hover:border-white/20")}>
                <Mail className="size-4" /> Email
              </button>
            </div>
            {channel === "email" ? (
              <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Recipient emails (comma separated)" className={DIALOG_INPUT} />
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-white/40">Appears in the bell at the top when due — no email is sent.</p>
            )}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold">Message (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="What should the reminder say?" className={cn(DIALOG_INPUT, "resize-none")} />
          </div>

          {error && <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/10">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[13px] text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
          <button onClick={submit} disabled={createReminder.isPending || done}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-[13px] font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {done ? <CheckCircle className="size-4" /> : createReminder.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellPlus className="size-4" />}
            {done ? "Reminder set" : "Set reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Email Notify dialog (send now) ───────────────────────────────────────────
function NotifyDialog({
  workOrderId, summary, defaultEmail, senderName, onClose,
}: {
  workOrderId: string; summary: string; defaultEmail: string; senderName: string; onClose: () => void;
}) {
  const [emails,  setEmails]  = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    setError(null);
    const recipients = parseEmails(emails);
    if (recipients.length === 0) { setError("Add at least one recipient email."); return; }
    if (!message.trim()) { setError("Message is required."); return; }
    setSending(true);
    try {
      for (const to of recipients) {
        const res = await fetch("/api/bajaj/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, workOrderId, workOrderSummary: summary, message: message.trim(), senderName }),
        });
        if (!res.ok) throw new Error("Failed to send email.");
      }
      setDone(true);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Email Notify</p>
          </div>
          <button onClick={onClose} className="size-7 inline-flex items-center justify-center rounded-md text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold">Recipients</label>
            <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Recipient emails (comma separated)" className={DIALOG_INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40 font-semibold">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={`Update on ${summary}…`} className={cn(DIALOG_INPUT, "resize-none")} />
          </div>
          {error && <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/10">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[13px] text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
          <button onClick={send} disabled={sending || done}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-[13px] font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {done ? <CheckCircle className="size-4" /> : sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {done ? "Sent" : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function WorkOrderDetailPage({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const { data: workOrder, isLoading } = useWorkOrder(workOrderId);
  const { data: comments = [] }  = useBajajComments(workOrderId);
  const { data: auditLogs = [] } = useBajajAuditLogs({ limit: 50, targetId: workOrderId });
  const updateWorkOrder = useUpdateWorkOrder();
  const addComment      = useAddBajajComment();
  const { bajajUser }   = useAuthStore();

  // Derive module slug from work order country so we fetch the right status IDs
  const moduleSlug = workOrder
    ? countryToSlug(String((workOrder.data as Record<string, unknown>)?.country ?? ""))
    : undefined;
  const { data: allStatuses = [] }          = useBajajStatuses(moduleSlug);
  const { data: columnRequiredFields = [] } = useColumnRequiredFields(moduleSlug ?? "");
  const { data: myPerms = new Map() }       = useMyColumnPerms(moduleSlug ?? "");

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [commentText,      setCommentText]      = useState("");
  const [savingField,      setSavingField]      = useState<string | null>(null);
  const [autoAdvanced,     setAutoAdvanced]     = useState(false);
  const [showReminder,     setShowReminder]     = useState(false);
  const [showNotify,       setShowNotify]       = useState(false);
  const [allBookings,      setAllBookings]      = useState<Record<string, string>[]>([]);

  const handleFieldSave = useCallback((key: string, val: string | boolean) => {
    setSavingField(key);
    const merged = { ...(workOrder?.data as Record<string, unknown> ?? {}), [key]: val };
    updateWorkOrder.mutate(
      { id: workOrderId, updates: { data: { [key]: val } }, baseUpdatedAt: workOrder?.updated_at },
      {
        onSettled: () => setSavingField(null),
        onSuccess: () => {
          const statusName = workOrder?.status?.name
            ?? allStatuses.find((s) => s.id === workOrder?.status_id)?.name
            ?? "";
          const reqEntry = columnRequiredFields.find((r) => r.status_name === statusName);
          const required = reqEntry?.field_keys ?? [];
          const allFilled = required.length > 0 && required.every((f) => {
            const v = merged[f];
            return v != null && v !== "" && v !== false;
          });
          if (allFilled) {
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
  }, [workOrderId, workOrder, allStatuses, columnRequiredFields, updateWorkOrder]);

  async function handleComment() {
    if (!commentText.trim() || !bajajUser) return;
    await addComment.mutateAsync({ workOrderId, authorEmail: bajajUser.email, authorName: bajajUser.full_name ?? undefined, content: commentText.trim() });
    setCommentText("");
  }

  // Booking desk rows (Sheet8), fetched once; matched to this WO below.
  useEffect(() => {
    let alive = true;
    fetch("/api/bajaj/reference?type=bookings")
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((data) => { if (alive) setAllBookings(Array.isArray(data.rows) ? data.rows : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Bookings linked to this work order — matched on the booking's WO Ref or its
  // booking number == the WO's booking_no.
  const linkedBookings = useMemo(() => {
    const wd = (workOrder?.data ?? {}) as Record<string, unknown>;
    const woNo  = String(wd.wo ?? "").trim();
    const bkgNo = String(wd.booking_no ?? "").trim();
    if (!woNo && !bkgNo) return [];
    return allBookings.filter((b) => {
      const ref   = String(b.wo_ref ?? "").trim();
      const bk    = String(b.bkg_no ?? "").trim();
      const bkAlt = String(b.bkg_no_alt ?? "").trim();
      return (woNo && ref && ref.includes(woNo)) || (bkgNo && (bk === bkgNo || bkAlt === bkgNo));
    });
  }, [allBookings, workOrder?.data]);

  if (isLoading) return <div className="flex h-full items-center justify-center bg-white dark:bg-black"><Loader2 className="size-6 text-amber-500 animate-spin" /></div>;
  if (!workOrder) return (
    <div className="flex h-full items-center justify-center flex-col gap-3 bg-white dark:bg-black">
      <p className="text-gray-500 dark:text-white/50">Work order not found</p>
      <button onClick={() => router.back()} className="text-amber-600 text-sm hover:underline">← Go back</button>
    </div>
  );

  const d            = workOrder.data as Record<string, unknown>;
  const wo           = String(d.wo ?? workOrderId);
  const brand        = d.veh  ? String(d.veh)  : (d.brand   ? String(d.brand)   : "");
  const variant      = d.type ? String(d.type) : (d.variant ? String(d.variant) : "");
  const title        = [brand, variant].filter(Boolean).join(" · ") || `WO ${wo}`;
  // workOrder.status is returned directly by the API — always correct
  // allStatuses lookup is fallback for after a status change (optimistic update)
  const currentStatus = workOrder.status ?? allStatuses.find((s) => s.id === workOrder.status_id) ?? null;

  // Edit / move permission for this work order's column (admins always allowed).
  const isAdmin = bajajUser?.role === "admin" || bajajUser?.role === "superadmin";
  const myPerm  = myPerms.get(currentStatus?.name ?? "") ?? myPerms.get(null) ?? null;
  const canEdit = isAdmin || !!myPerm?.can_edit;
  const canMove = isAdmin || !!myPerm?.can_move;

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

            {/* Status */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative">
                <button
                  onClick={canMove ? () => setShowStatusPicker((v) => !v) : undefined}
                  disabled={!canMove}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] transition-colors shadow-sm", canMove ? "hover:border-gray-300 dark:hover:border-white/20" : "cursor-default")}
                >
                  <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatus ? `#${currentStatus.color_hex}` : "#D1D5DB" }} />
                  <span className="text-[13px] font-medium text-gray-700 dark:text-white/80">{currentStatus?.name ?? "No Status"}</span>
                  {canMove && <ChevronDown className="size-3 text-gray-400 dark:text-white/40" />}
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
                          <EditField fieldKey={f} label={FIELD_LABELS[f] ?? f} value={d[f]} onSave={handleFieldSave} boolean={isBool} canEdit={canEdit} />
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
                  <div className="size-7 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">
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
            <button onClick={canMove ? () => setShowStatusPicker((v) => !v) : undefined} disabled={!canMove}
              className={cn("flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1a1a1a] transition-colors", canMove ? "hover:border-gray-300 dark:hover:border-white/20" : "cursor-default")}>
              <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatus ? `#${currentStatus.color_hex}` : "#D1D5DB" }} />
              <span className="text-[13px] text-gray-700 dark:text-white/80 truncate flex-1 text-left">{currentStatus?.name ?? "No Status"}</span>
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

        {/* Linked bookings (from the booking desk / Sheet8) */}
        {linkedBookings.length > 0 && (
          <div className="px-4 py-4 border-b dark:border-white/6" style={{ borderColor: "var(--border-color, #F3F4F6)" }}>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-3">
              Linked Bookings ({linkedBookings.length})
            </p>
            <div className="space-y-2">
              {linkedBookings.map((b, i) => (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1a1a1a] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono font-medium text-gray-800 dark:text-white/90 truncate">{b.bkg_no || "—"}</span>
                    {b.remark && (
                      <span className="text-[10px] font-medium text-gray-500 dark:text-white/50 uppercase tracking-wide shrink-0">{b.remark}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5 truncate">
                    {[b.line, b.pod, b.received_vsl || b.place_req_vsl].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <p className="text-[18px] font-bold text-gray-900 dark:text-white tabular-nums">{String(d.cont ?? "—")}</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-3">Quick Actions</p>
          <div className="space-y-2">
            <button onClick={() => setShowReminder(true)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 text-[13px] text-gray-600 dark:text-white/70 transition-colors">
              <Bell className="size-3.5 text-amber-500" /> Set Reminder
            </button>
            <button onClick={() => setShowNotify(true)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 text-[13px] text-gray-600 dark:text-white/70 transition-colors">
              <Mail className="size-3.5 text-blue-500" /> Email Notify
            </button>
          </div>
        </div>
      </div>

      {showReminder && (
        <ReminderDialog
          workOrderId={workOrderId}
          moduleId={workOrder.module_id}
          defaultSubject={title}
          defaultEmail={bajajUser?.email ?? ""}
          createdBy={bajajUser?.email ?? null}
          onClose={() => setShowReminder(false)}
        />
      )}
      {showNotify && (
        <NotifyDialog
          workOrderId={workOrderId}
          summary={title}
          defaultEmail={bajajUser?.email ?? ""}
          senderName={bajajUser?.full_name ?? bajajUser?.email ?? "Team"}
          onClose={() => setShowNotify(false)}
        />
      )}
    </div>
  );
}
