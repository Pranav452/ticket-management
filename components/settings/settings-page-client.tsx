"use client";

import React, { useMemo, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const REMINDERS_STORAGE_KEY = "bajaj-demo-reminders-v1";
const DEMO_NAME_KEY = "demo-profile-full-name-v1";

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
  const [toast, setToast] = useState<string | null>(null);
  const clearRemindersDialogRef = useRef<HTMLDialogElement | null>(null);
  const clearViewsDialogRef = useRef<HTMLDialogElement | null>(null);
  const clearProfileDialogRef = useRef<HTMLDialogElement | null>(null);

  const counts = useMemo(() => {
    if (typeof window === "undefined") return { reminderCount: 0, viewPrefCount: 0 };
    const raw = window.localStorage.getItem(REMINDERS_STORAGE_KEY);
    const reminderCount = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw).length : 0) : 0;
    let viewPrefCount = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("bajaj-card-fields-")) viewPrefCount++;
    }
    return { reminderCount, viewPrefCount };
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }

  function clearReminders() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(REMINDERS_STORAGE_KEY);
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
    clearViewsDialogRef.current?.close();
    showToast("Card views cleared.");
  }

  function clearProfileOverride() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DEMO_NAME_KEY);
    clearProfileDialogRef.current?.close();
    showToast("Profile override cleared.");
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-50 text-balance">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500 text-pretty">
            Demo controls stored locally in this browser.
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
            description={`Stored locally. Current reminders: ${counts.reminderCount}.`}
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
            description={`Per-module “View” preferences. Stored locally. Current saved views: ${counts.viewPrefCount}.`}
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

          <SettingCard
            title="Profile override"
            description="Clears the locally saved display name from the Profile page (demo mode)."
          >
            <button
              type="button"
              onClick={() => clearProfileDialogRef.current?.showModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <Trash2 className="size-4" />
              Clear profile override
            </button>
          </SettingCard>
        </div>
      </div>

      <ConfirmDialog
        dialogRef={clearRemindersDialogRef}
        title="Clear reminders?"
        description="This will remove all scheduled reminders from this browser."
        confirmLabel="Clear reminders"
        onConfirm={clearReminders}
      />

      <ConfirmDialog
        dialogRef={clearViewsDialogRef}
        title="Clear saved card views?"
        description="This will remove all saved “View” preferences across modules for this browser."
        confirmLabel="Clear views"
        onConfirm={clearCardViews}
      />

      <ConfirmDialog
        dialogRef={clearProfileDialogRef}
        title="Clear profile override?"
        description="This will remove your locally saved display name override."
        confirmLabel="Clear override"
        onConfirm={clearProfileOverride}
      />
    </div>
  );
}

