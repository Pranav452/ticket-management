"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle, User as UserIcon } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/lib/queries/profiles";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800 last:border-b-0">
      <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-neutral-200 tabular-nums text-right">{value}</div>
    </div>
  );
}

export function ProfilePageClient() {
  const { data: profile, isLoading } = useProfile();
  const { profile: storeProfile, setProfile } = useAuthStore();
  const updateProfile = useUpdateProfile();

  const effectiveProfile = storeProfile ?? profile;

  // nameOverride is null until user edits; falls back to loaded profile name
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const fullName = nameOverride ?? effectiveProfile?.full_name ?? "";

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    const r = effectiveProfile?.role ?? "agent";
    return String(r).toUpperCase();
  }, [effectiveProfile?.role]);

  async function handleSave() {
    if (!effectiveProfile) return;
    setSaved(false);
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({ id: effectiveProfile.id, full_name: fullName.trim() });
      setProfile({ ...effectiveProfile, full_name: fullName.trim() });
      setNameOverride(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-50 text-balance">Profile</h1>
          <p className="mt-1 text-sm text-neutral-500 text-pretty">
            Your account profile.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-neutral-800">
            <div className="size-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0">
              <UserIcon className="size-5 text-neutral-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100 truncate">
                {isLoading ? "Loading…" : (effectiveProfile?.full_name ?? "—")}
              </p>
              <p className="text-xs text-neutral-500 truncate">
                {effectiveProfile?.email ?? "—"}
              </p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] font-medium text-neutral-300 tabular-nums">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Display name
                </p>
                <input
                  value={fullName}
                  onChange={(e) => setNameOverride(e.target.value)}
                  placeholder="Your name…"
                  className={cn(
                    "w-full rounded-lg border bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none",
                    "border-neutral-800 focus:border-neutral-500",
                  )}
                />
                {saveError && (
                  <p className="text-xs text-red-400">{saveError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!effectiveProfile || isLoading || updateProfile.isPending}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  {saved && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="size-3.5" />
                      Saved
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4">
                <FieldRow label="User ID" value={effectiveProfile?.id ?? "—"} />
                <FieldRow label="Email" value={effectiveProfile?.email ?? "—"} />
                <FieldRow label="Created" value={formatDate(effectiveProfile?.created_at)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
