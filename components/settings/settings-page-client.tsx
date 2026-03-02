"use client";

import React, { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBajajReminders, useDeleteUserReminders } from "@/lib/queries/bajaj";

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="mb-4">
        <p className="text-sm font-medium text-neutral-100">{title}</p>
        <p className="mt-1 text-sm text-neutral-500 text-pretty">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ConfirmDialog({
  dialogRef,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 p-0 backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-800">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          <p className="mt-1 text-sm text-neutral-500 text-pretty">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="size-8 inline-flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors flex-shrink-0"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50",
            "bg-red-600 hover:bg-red-500",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function SettingsPageClient() {
  const { data: reminders = [] } = useBajajReminders();
  const deleteReminders = useDeleteUserReminders();

  const [toast, setToast] = useState<string | null>(null);
  const clearRemindersDialogRef = useRef<HTMLDialogElement | null>(null);
  const clearViewsDialogRef = useRef<HTMLDialogElement | null>(null);

  const [viewPrefCount, setViewPrefCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    let count = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("bajaj-card-fields-")) count++;
    }
    return count;
  });

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }

  async function clearReminders() {
    await deleteReminders.mutateAsync();
    clearRemindersDialogRef.current?.close();
    showToast("Reminders cleared.");
  }

  function clearCardViews() {
    if (typeof window === "undefined") return;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("bajaj-card-fields-")) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    setViewPrefCount(0);
    clearViewsDialogRef.current?.close();
    showToast("Card views cleared.");
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-50 text-balance">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500 text-pretty">
            Manage your preferences.
          </p>
        </div>

        {toast && (
          <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm text-neutral-200">
            {toast}
          </div>
        )}

        <div className="space-y-4">
          <SettingCard
            title="Reminders"
            description={`Your scheduled work order reminders. Current count: ${reminders.length}.`}
          >
            <button
              type="button"
              onClick={() => clearRemindersDialogRef.current?.showModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <Trash2 className="size-4" />
              Clear reminders
            </button>
          </SettingCard>

          <SettingCard
            title="Bajaj card views"
            description={`Per-module "View" preferences. Stored locally. Current saved views: ${viewPrefCount}.`}
          >
            <button
              type="button"
              onClick={() => clearViewsDialogRef.current?.showModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <Trash2 className="size-4" />
              Clear saved card views
            </button>
          </SettingCard>
        </div>
      </div>

      <ConfirmDialog
        dialogRef={clearRemindersDialogRef}
        title="Clear reminders?"
        description="This will permanently delete all your scheduled reminders from the database."
        confirmLabel="Clear reminders"
        onConfirm={clearReminders}
        isPending={deleteReminders.isPending}
      />

      <ConfirmDialog
        dialogRef={clearViewsDialogRef}
        title="Clear saved card views?"
        description='This will remove all saved "View" preferences across modules for this browser.'
        confirmLabel="Clear views"
        onConfirm={clearCardViews}
      />
    </div>
  );
}
