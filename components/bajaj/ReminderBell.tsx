"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle, Mail, Send, X } from "lucide-react";
import { useBajajReminders, useUpdateBajajReminder } from "@/lib/queries/bajaj";
import { useAuthStore } from "@/lib/stores/auth-store";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReminderBell() {
  const { data: reminders = [] } = useBajajReminders();
  const updateReminder = useUpdateBajajReminder();
  const { profile: currentProfile } = useAuthStore();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { due, upcoming } = useMemo(() => {
    const now = Date.now();
    const active = reminders.filter((r) => r.status !== "done");
    const dueItems = active.filter((r) => new Date(r.due_at).getTime() <= now);
    const upcomingItems = active.filter((r) => new Date(r.due_at).getTime() > now);
    return { due: dueItems, upcoming: upcomingItems };
  }, [reminders]);

  const badgeCount = due.length;

  function openDialog() {
    setSendError(null);
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === "function") d.showModal();
  }

  function closeDialog() {
    const d = dialogRef.current;
    if (!d) return;
    d.close();
  }

  async function sendReminder(reminderId: string) {
    const reminder = reminders.find((r) => r.id === reminderId);
    if (!reminder) return;
    setSendError(null);
    setSendingId(reminderId);
    try {
      for (const to of reminder.recipients) {
        const res = await fetch("/api/bajaj/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            workOrderId: reminder.work_order_id,
            workOrderSummary: reminder.work_order_summary,
            message: reminder.message,
            senderName: currentProfile?.full_name ?? currentProfile?.email ?? "Team",
            subject: `Reminder — ${reminder.work_order_summary}`,
          }),
        });
        if (!res.ok) {
          throw new Error("Failed to send reminder email.");
        }
      }
      await updateReminder.mutateAsync({
        id: reminderId,
        updates: {
          status: "sent",
          sent_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send reminder.");
    } finally {
      setSendingId(null);
    }
  }

  async function markDone(reminderId: string) {
    setSendError(null);
    await updateReminder.mutateAsync({
      id: reminderId,
      updates: { status: "done", done_at: new Date().toISOString() },
    });
  }

  // Auto-send any due reminders while app is open (demo behavior).
  useEffect(() => {
    if (!due.length) return;
    const toSend = due.filter((r) => r.status === "scheduled");
    if (toSend.length === 0) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      for (const r of toSend) {
        await sendReminder(r.id);
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due.map((d) => `${d.id}:${d.status}`).join("|")]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="relative inline-flex items-center justify-center size-9 rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900 transition-colors"
        aria-label="Open reminders"
      >
        <Bell className="size-4" />
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-[11px] font-semibold text-white tabular-nums flex items-center justify-center">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 p-0 backdrop:bg-black/60"
        onClose={() => setSendError(null)}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-100">Reminders</p>
            <p className="text-xs text-neutral-500">
              Due: <span className="tabular-nums text-neutral-300">{due.length}</span> · Upcoming:{" "}
              <span className="tabular-nums text-neutral-300">{upcoming.length}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="size-8 inline-flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
            aria-label="Close reminders"
          >
            <X className="size-4" />
          </button>
        </div>

        {sendError && (
          <div className="mx-5 mt-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {sendError}
          </div>
        )}

        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Due
              </p>
              <p className="text-xs text-neutral-600 tabular-nums">{due.length}</p>
            </div>

            {due.length === 0 ? (
              <p className="text-sm text-neutral-600">No due reminders.</p>
            ) : (
              <div className="space-y-2">
                {due.map((r) => (
                  <div key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-100 truncate">
                          {r.work_order_summary}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Due {formatWhen(r.due_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => sendReminder(r.id)}
                          disabled={sendingId === r.id || updateReminder.isPending}
                          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                          aria-label="Send reminder email now"
                        >
                          {sendingId === r.id ? (
                            <Send className="size-3.5" />
                          ) : (
                            <Mail className="size-3.5" />
                          )}
                          Send now
                        </button>
                        <button
                          type="button"
                          onClick={() => markDone(r.id)}
                          disabled={updateReminder.isPending}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                          aria-label="Mark reminder as done"
                        >
                          <CheckCircle className="size-3.5" />
                          Done
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-300 mt-2 text-pretty">
                      {r.message}
                    </p>
                    <p className="text-xs text-neutral-600 mt-2 tabular-nums">
                      Recipients: {r.recipients.length}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Upcoming
              </p>
              <p className="text-xs text-neutral-600 tabular-nums">{upcoming.length}</p>
            </div>

            {upcoming.length === 0 ? (
              <p className="text-sm text-neutral-600">No upcoming reminders.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 20).map((r) => (
                  <div key={r.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-100 truncate">
                          {r.work_order_summary}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Scheduled for {formatWhen(r.due_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => markDone(r.id)}
                        disabled={updateReminder.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900 disabled:opacity-50 transition-colors flex-shrink-0"
                        aria-label="Cancel reminder"
                      >
                        <CheckCircle className="size-3.5" />
                        Done
                      </button>
                    </div>
                    <p className="text-sm text-neutral-400 mt-2 text-pretty">
                      {r.message}
                    </p>
                    <p className="text-xs text-neutral-600 mt-2 tabular-nums">
                      Recipients: {r.recipients.length}
                    </p>
                  </div>
                ))}
                {upcoming.length > 20 && (
                  <p className="text-xs text-neutral-600">
                    Showing 20 of {upcoming.length} upcoming reminders.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}

