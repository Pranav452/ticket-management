"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Send, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, BellPlus } from "lucide-react";
import { useWorkOrder, useUpdateWorkOrder, useBajajComments, useAddBajajComment, useCreateBajajReminder, useBajajUsers } from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajWorkOrder } from "@/lib/types/bajaj";
import { cn } from "@/lib/utils";

interface WorkOrderDetailPanelProps {
  workOrderId: string;
  onClose: () => void;
  isAdmin: boolean;
  isLight?: boolean;
}

const FIELD_NAMES: string[] = [
  "wo", "wodt", "country", "port", "plant", "brand", "variant",
  "qty", "hc40", "std20", "veh", "cont", "type",
  "s_line", "vessel_name", "agent", "transporter", "consignee",
  "po_no", "lc_no", "lc_date", "ff_job", "booking_no",
  "sbno", "sb_date", "blno", "bldt", "bl_handover_time", "for_hbl",
  "haz", "vgm_submitted", "si_submitted",
  "container_no", "pol_gate", "stuffing_on",
  "do_given_dt", "pick_up_dt", "cntr_dispatch",
  "gate_open", "gate_cut_off", "si_cut_off",
  "cntr_report_nhava_sheva", "cntr_gated_in_port", "final_vsl_sob",
  "do_etd", "current_etd", "eta_at_destination", "sailingdt",
  "s_line_payment_status", "e_doc_status",
  "clearance_point", "open_order", "buffer_yard", "courier_dt",
  "assy_config", "remark",
];

function EditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  function handleBlur() {
    setEditing(false);
    if (val !== value) onSave(val);
  }

  return (
    <div className="group">
      <p className="text-[10px] uppercase tracking-wide mb-0.5 text-gray-400">{label}</p>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleBlur();
            if (e.key === "Escape") { setVal(value); setEditing(false); }
          }}
          className="w-full border border-amber-400 rounded px-2 py-1 text-sm focus:outline-none bg-white text-gray-900"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-sm cursor-text transition-colors py-0.5 truncate text-gray-700 hover:text-amber-600"
          title={val || "Click to edit"}
        >
          {val || <span className="italic text-gray-300">empty</span>}
        </p>
      )}
    </div>
  );
}

export function WorkOrderDetailPanel({ workOrderId, onClose, isAdmin, isLight = false }: WorkOrderDetailPanelProps) {
  const { data: workOrder, isLoading } = useWorkOrder(workOrderId);
  const { data: comments = [] } = useBajajComments(workOrderId);
  const { data: bajajUsers = [] } = useBajajUsers();
  const updateWorkOrder = useUpdateWorkOrder();
  const addComment = useAddBajajComment();
  const createReminder = useCreateBajajReminder();
  const { bajajUser: currentProfile } = useAuthStore();

  const [commentText,  setCommentText]  = useState("");
  const [notifyEmail,  setNotifyEmail]  = useState("");
  const [notifyMsg,    setNotifyMsg]    = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<"sent" | "error" | null>(null);
  const [remindInDays, setRemindInDays] = useState("2");
  const [remindEmails, setRemindEmails] = useState("");
  const [remindMsg,    setRemindMsg]    = useState("");
  const [remindResult, setRemindResult] = useState<"scheduled" | "error" | null>(null);
  const [remindError,  setRemindError]  = useState<string | null>(null);
  const [showAudit,    setShowAudit]    = useState(false);
  const [assignee,     setAssignee]     = useState<string | null>(workOrder?.assigned_to ?? null);
  const [updateError,  setUpdateError]  = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => { setAssignee(workOrder?.assigned_to ?? null); }, [workOrder?.assigned_to]);

  function handleFieldSave(field: string, newValue: string) {
    if (!workOrder) return;
    setUpdateError(null);
    updateWorkOrder.mutate(
      { id: workOrderId, updates: { data: { ...workOrder.data, [field]: newValue } } },
      { onError: (err) => setUpdateError(err instanceof Error ? err.message : "Update failed") },
    );
  }

  function handleAssigneeChange(profileId: string) {
    setAssignee(profileId || null);
    setUpdateError(null);
    updateWorkOrder.mutate(
      { id: workOrderId, updates: { assigned_to: profileId || null } },
      { onError: (err) => setUpdateError(err instanceof Error ? err.message : "Update failed") },
    );
  }

  async function handleSendComment() {
    if (!commentText.trim() || !currentProfile) return;
    await addComment.mutateAsync({
      workOrderId,
      authorEmail: currentProfile.email ?? currentProfile.id,
      authorName:  currentProfile.full_name ?? undefined,
      content:     commentText.trim(),
    });
    setCommentText("");
  }

  async function handleSendEmail() {
    if (!notifyEmail.trim() || !notifyMsg.trim()) return;
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const uniqueKeyValue = workOrder?.data ? Object.values(workOrder.data)[0] : workOrderId;
      const res = await fetch("/api/bajaj/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: notifyEmail, workOrderId,
          workOrderSummary: String(uniqueKeyValue),
          message: notifyMsg,
          senderName: (currentProfile as { full_name?: string | null; email?: string } | null)?.full_name
            ?? (currentProfile as { email?: string } | null)?.email ?? "Team",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNotifyResult("sent");
      setNotifyEmail("");
      setNotifyMsg("");
    } catch {
      setNotifyResult("error");
    } finally {
      setNotifySending(false);
    }
  }

  function parseEmails(raw: string): string[] {
    const parts = raw.split(/[\s,;]+/g).map((p) => p.trim()).filter(Boolean);
    const unique = new Set<string>();
    for (const p of parts) unique.add(p.toLowerCase());
    return Array.from(unique);
  }

  async function handleScheduleReminder() {
    if (!workOrder) return;
    setRemindResult(null);
    setRemindError(null);
    const days = Number(remindInDays);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      setRemindError("Days must be between 1 and 365."); return;
    }
    const recipients = Array.from(new Set<string>([...parseEmails(notifyEmail), ...parseEmails(remindEmails)]));
    if (recipients.length === 0) { setRemindError("Add at least one recipient email."); return; }
    if (!remindMsg.trim()) { setRemindError("Reminder message is required."); return; }
    const uniqueKeyValue = workOrder?.data ? Object.values(workOrder.data)[0] : workOrderId;
    try {
      await createReminder.mutateAsync({
        workOrderId, moduleId: workOrder.module_id,
        workOrderSummary: String(uniqueKeyValue),
        daysOffset: days, recipients,
        message: remindMsg.trim(),
        createdBy: (currentProfile as { email?: string } | null)?.email ?? (currentProfile as { id?: string } | null)?.id ?? null,
      });
      setRemindResult("scheduled");
      setRemindEmails("");
      setRemindMsg("");
    } catch (err) {
      setRemindResult("error");
      setRemindError(err instanceof Error ? err.message : "Failed to schedule reminder.");
    }
  }

  const fieldEntries = workOrder
    ? Array.from(new Set<string>([...FIELD_NAMES, ...Object.keys(workOrder.data ?? {})])).map(
        (key) => [key, workOrder.data?.[key]] as [string, unknown],
      )
    : [];

  function handleAddField() {
    if (!workOrder) return;
    const key = newFieldName.trim();
    if (!key) return;
    if (Object.prototype.hasOwnProperty.call(workOrder.data ?? {}, key)) { setNewFieldName(""); return; }
    setUpdateError(null);
    updateWorkOrder.mutate(
      { id: workOrderId, updates: { data: { ...workOrder.data, [key]: "" } } },
      { onSuccess: () => setNewFieldName(""), onError: (err) => setUpdateError(err instanceof Error ? err.message : "Update failed") },
    );
  }

  // Shared input classes
  const inp = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-amber-500 transition-colors";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
        className="w-[420px] flex-shrink-0 flex flex-col border-l border-gray-200 bg-white overflow-hidden h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {workOrder?.status && (
              <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: `#${workOrder.status.color_hex}` }} />
            )}
            <h2 className="text-sm font-semibold truncate text-gray-900">
              {workOrder ? String(fieldEntries[0]?.[1] ?? "Work Order") : "Loading…"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 text-amber-500 animate-spin" />
          </div>
        ) : workOrder ? (
          <div className="flex-1 overflow-y-auto">
            {/* Assign */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Assigned To</p>
              <select
                value={assignee ?? ""}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className={inp}
              >
                <option value="">Unassigned</option>
                {bajajUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                ))}
              </select>
            </div>

            {/* Fields */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-medium uppercase tracking-wide mb-3 text-gray-400">Work Order Fields</p>
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add custom field name..."
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddField(); } }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 bg-white text-gray-800 placeholder:text-gray-300 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddField}
                  className="px-3 py-2 rounded-lg text-xs transition-colors border bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Add Field
                </button>
              </div>
              {updateError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{updateError}</div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {fieldEntries.map(([key, val]) => (
                  <EditableField key={key} label={key} value={String(val ?? "")} onSave={(v) => handleFieldSave(key, v)} />
                ))}
              </div>
            </div>

            {/* Email notification */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Send Email Notification</p>
              <div className="space-y-2">
                <input type="email" placeholder="Recipient email…" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} className={inp} />
                <textarea placeholder="Message…" value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} rows={3} className={`${inp} resize-none`} />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendEmail}
                    disabled={!notifyEmail.trim() || !notifyMsg.trim() || notifySending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {notifySending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Send
                  </button>
                  {notifyResult === "sent"  && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="size-3.5" /> Sent</span>}
                  {notifyResult === "error" && <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="size-3.5" /> Failed</span>}
                </div>
              </div>

              {/* Reminder */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Set Reminder</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Remind in (days)</label>
                    <input inputMode="numeric" placeholder="e.g. 2" value={remindInDays} onChange={(e) => setRemindInDays(e.target.value)} className={inp} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Additional recipients</label>
                    <input type="text" placeholder="comma/space separated…" value={remindEmails} onChange={(e) => setRemindEmails(e.target.value)} className={inp} />
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide">Reminder message</label>
                  <textarea placeholder="What should the reminder say?" value={remindMsg} onChange={(e) => setRemindMsg(e.target.value)} rows={3} className={`${inp} resize-none`} />
                  <p className="text-[11px] text-gray-400">Reminder will appear in the top bell and be emailed to all recipients.</p>
                </div>
                {remindError && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{remindError}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScheduleReminder}
                    disabled={createReminder.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors border border-gray-200"
                  >
                    {createReminder.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <BellPlus className="size-3.5" />}
                    Schedule
                  </button>
                  {remindResult === "scheduled" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="size-3.5" /> Scheduled</span>}
                  {remindResult === "error" && !remindError && <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="size-3.5" /> Failed</span>}
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Comments ({comments.length})</p>
              <div className="space-y-3 mb-3 max-h-56 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="size-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {c.author?.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="size-full rounded-full object-cover" />
                      ) : (
                        <User className="size-3 text-gray-400" aria-hidden />
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-medium text-gray-700">{c.author?.full_name ?? c.author?.email ?? "Unknown"}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 leading-snug">{c.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-xs text-gray-300">No comments yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  className={`flex-1 ${inp}`}
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Audit */}
            <div className="px-5 py-4">
              <button
                onClick={() => setShowAudit((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
              >
                {showAudit ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                Audit History
              </button>
              {showAudit && (
                <div className="mt-3 text-xs text-gray-400">
                  <p>Full audit log is available in the Admin panel.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
