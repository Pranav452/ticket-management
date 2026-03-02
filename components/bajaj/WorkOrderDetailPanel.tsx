"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Send, Loader2, AlertTriangle, CheckCircle, BellPlus } from "lucide-react";
import { useWorkOrder, useUpdateWorkOrder, useBajajComments, useAddBajajComment, useCreateBajajReminder } from "@/lib/queries/bajaj";
import { useProfiles } from "@/lib/queries/profiles";
import { useAuthStore } from "@/lib/stores/auth-store";

interface WorkOrderDetailPanelProps {
  workOrderId: string;
  onClose: () => void;
  isAdmin: boolean;
}

// ─── Inline editable field ────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  function handleBlur() {
    setEditing(false);
    if (val !== value) onSave(val);
  }

  return (
    <div className="group">
      <p className="text-[10px] text-neutral-600 uppercase tracking-wide mb-0.5">{label}</p>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === "Enter") handleBlur(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
          className="w-full bg-neutral-800 border border-amber-600 rounded px-2 py-1 text-sm text-neutral-100 focus:outline-none"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-sm text-neutral-200 cursor-text hover:text-amber-300 transition-colors py-0.5 truncate"
          title={val || "Click to edit"}
        >
          {val || <span className="text-neutral-700 italic">empty</span>}
        </p>
      )}
    </div>
  );
}

export function WorkOrderDetailPanel({ workOrderId, onClose, isAdmin: _isAdmin }: WorkOrderDetailPanelProps) {
  const { data: workOrder, isLoading } = useWorkOrder(workOrderId);
  const { data: comments = [] } = useBajajComments(workOrderId);
  const { data: profiles = [] } = useProfiles();
  const updateWorkOrder = useUpdateWorkOrder();
  const addComment = useAddBajajComment();
  const createReminder = useCreateBajajReminder();
  const { profile: currentProfile } = useAuthStore();

  const [commentText, setCommentText] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<"sent" | "error" | null>(null);
  const [remindInDays, setRemindInDays] = useState("2");
  const [remindEmails, setRemindEmails] = useState("");
  const [remindMsg, setRemindMsg] = useState("");
  const [remindResult, setRemindResult] = useState<"scheduled" | "error" | null>(null);
  const [remindError, setRemindError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(workOrder?.assigned_to ?? null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleFieldSave(field: string, newValue: string) {
    if (!workOrder) return;
    setUpdateError(null);
    updateWorkOrder.mutate(
      {
        id: workOrderId,
        updates: { data: { ...workOrder.data, [field]: newValue } },
      },
      {
        onError: (err) => {
          setUpdateError(err instanceof Error ? err.message : "Update failed");
        },
      },
    );
  }

  function handleAssigneeChange(profileId: string) {
    setAssignee(profileId || null);
    setUpdateError(null);
    updateWorkOrder.mutate(
      {
        id: workOrderId,
        updates: { assigned_to: profileId || null },
      },
      {
        onError: (err) => {
          setUpdateError(err instanceof Error ? err.message : "Update failed");
        },
      },
    );
  }

  async function handleSendComment() {
    if (!commentText.trim() || !currentProfile) return;
    await addComment.mutateAsync({
      workOrderId,
      authorId: currentProfile.id,
      content: commentText.trim(),
    });
    setCommentText("");
  }

  async function handleSendEmail() {
    if (!notifyEmail.trim() || !notifyMsg.trim()) return;
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const uniqueKeyValue = workOrder?.data
        ? Object.values(workOrder.data)[0]
        : workOrderId;
      const res = await fetch("/api/bajaj/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: notifyEmail,
          workOrderId,
          workOrderSummary: String(uniqueKeyValue),
          message: notifyMsg,
          senderName: currentProfile?.full_name ?? currentProfile?.email ?? "Team",
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
    const parts = raw
      .split(/[\s,;]+/g)
      .map((p) => p.trim())
      .filter(Boolean);
    const unique = new Set<string>();
    for (const p of parts) {
      unique.add(p.toLowerCase());
    }
    return Array.from(unique);
  }

  async function handleScheduleReminder() {
    if (!workOrder) return;
    setRemindResult(null);
    setRemindError(null);

    const days = Number(remindInDays);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      setRemindError("Days must be between 1 and 365.");
      return;
    }

    const recipients = Array.from(
      new Set<string>([
        ...parseEmails(notifyEmail),
        ...parseEmails(remindEmails),
      ]),
    );
    if (recipients.length === 0) {
      setRemindError("Add at least one recipient email to schedule a reminder.");
      return;
    }
    if (!remindMsg.trim()) {
      setRemindError("Reminder message is required.");
      return;
    }

    const uniqueKeyValue = workOrder?.data
      ? Object.values(workOrder.data)[0]
      : workOrderId;

    try {
      await createReminder.mutateAsync({
        work_order_id: workOrderId,
        module_id: workOrder.module_id,
        work_order_summary: String(uniqueKeyValue),
        days_offset: days,
        due_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        recipients,
        message: remindMsg.trim(),
        status: "scheduled",
        created_by: currentProfile?.id ?? null,
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
    ? Object.entries(workOrder.data)
    : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
        className="w-[420px] flex-shrink-0 flex flex-col border-l border-neutral-800 bg-neutral-950 overflow-hidden h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {workOrder?.status && (
              <span
                className="size-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: `#${workOrder.status.color_hex}` }}
              />
            )}
            <h2 className="text-sm font-semibold text-neutral-100 truncate">
              {workOrder ? String(fieldEntries[0]?.[1] ?? "Work Order") : "Loading…"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors flex-shrink-0"
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
            {/* ── Assign section ──────────────────────────────── */}
            <div className="px-5 py-4 border-b border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Assigned To
              </p>
              <select
                value={assignee ?? ""}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-600"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </select>
            </div>

            {/* ── All fields (editable) ────────────────────────── */}
            <div className="px-5 py-4 border-b border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                Work Order Fields
              </p>
              {updateError && (
                <div className="mb-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                  {updateError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {fieldEntries.map(([key, val]) => (
                  <EditableField
                    key={key}
                    label={key}
                    value={String(val ?? "")}
                    onSave={(v) => handleFieldSave(key, v)}
                  />
                ))}
              </div>
            </div>

            {/* ── Email notification ────────────────────────────── */}
            <div className="px-5 py-4 border-b border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                Send Email Notification
              </p>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Recipient email…"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
                />
                <textarea
                  placeholder="Message…"
                  value={notifyMsg}
                  onChange={(e) => setNotifyMsg(e.target.value)}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendEmail}
                    disabled={!notifyEmail.trim() || !notifyMsg.trim() || notifySending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  >
                    {notifySending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Send
                  </button>
                  {notifyResult === "sent" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="size-3.5" /> Sent
                    </span>
                  )}
                  {notifyResult === "error" && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="size-3.5" /> Failed
                    </span>
                  )}
                </div>
              </div>

              {/* ── Reminder ─────────────────────────────────────── */}
              <div className="mt-5 pt-4 border-t border-neutral-800">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                  Set Reminder
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-600 uppercase tracking-wide">
                      Remind in (days)
                    </label>
                    <input
                      inputMode="numeric"
                      placeholder="e.g. 2"
                      value={remindInDays}
                      onChange={(e) => setRemindInDays(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-600 uppercase tracking-wide">
                      Additional recipients
                    </label>
                    <input
                      type="text"
                      placeholder="comma/space separated…"
                      value={remindEmails}
                      onChange={(e) => setRemindEmails(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <label className="text-[10px] text-neutral-600 uppercase tracking-wide">
                    Reminder message
                  </label>
                  <textarea
                    placeholder="What should the reminder say?"
                    value={remindMsg}
                    onChange={(e) => setRemindMsg(e.target.value)}
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 resize-none"
                  />
                  <p className="text-[11px] text-neutral-600">
                    Reminder will appear in the top bell and be emailed to all recipients (includes the email above if provided).
                  </p>
                </div>

                {remindError && (
                  <div className="mt-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                    {remindError}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScheduleReminder}
                    disabled={createReminder.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-800 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                  >
                    {createReminder.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellPlus className="size-3.5" />
                    )}
                    Schedule
                  </button>
                  {remindResult === "scheduled" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="size-3.5" /> Scheduled
                    </span>
                  )}
                  {remindResult === "error" && !remindError && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="size-3.5" /> Failed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Comments ────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                Comments ({comments.length})
              </p>
              <div className="space-y-3 mb-3 max-h-56 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="size-6 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {c.author?.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="size-full rounded-full object-cover" />
                      ) : (
                        <User className="size-3 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-medium text-neutral-300">
                          {c.author?.full_name ?? c.author?.email ?? "Unknown"}
                        </span>
                        <span className="text-[10px] text-neutral-600">
                          {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400 leading-snug">{c.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-neutral-700">No comments yet.</p>
                )}
              </div>

              {/* Comment input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
