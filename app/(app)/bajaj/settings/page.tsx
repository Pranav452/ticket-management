"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import {
  LogOut, User, Shield, Bell, Palette, ChevronRight, Check,
  Globe, Moon, Sun,
} from "lucide-react";

type Tab = "profile" | "appearance" | "notifications" | "security";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: User    },
  { id: "appearance",    label: "Appearance",    icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell    },
  { id: "security",      label: "Security",      icon: Shield  },
];

const NOTIF_KEY = "bajaj-notif-prefs";
type NotifPrefs = { reminders: boolean; updates: boolean; digest: boolean };
const DEFAULT_NOTIF: NotifPrefs = { reminders: true, updates: false, digest: true };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 dark:border-white/[0.06] py-8 first:pt-0 last:border-0">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && <p className="text-[13px] text-gray-500 dark:text-white/40 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-8 py-3">
      <div className="flex-1">
        <p className="text-[13px] font-medium text-gray-800 dark:text-white/80">{label}</p>
        {description && <p className="text-[12px] text-gray-400 dark:text-white/30 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router    = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const bajajUser = useAuthStore((s) => s.bajajUser);
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<Tab>("profile");
  const [notifications, setNotifications] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIF_KEY);
      if (stored) setNotifications(JSON.parse(stored));
    } catch {}
  }, []);

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifications((n) => {
      const next = { ...n, [key]: !n[key] };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    sessionStorage.removeItem("bajaj_user");
    router.push("/login");
  }

  async function handlePasswordReset() {
    setResetLoading(true);
    setResetMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(bajajUser?.email ?? "", {
      redirectTo: `${window.location.origin}/bajaj/settings`,
    });
    setResetLoading(false);
    if (error) {
      setResetMsg({ type: "error", text: error.message });
    } else {
      setResetMsg({ type: "success", text: "Reset email sent!" });
    }
  }

  const inputCls = "w-52 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:outline-none transition-colors dark:bg-[#111] dark:border-white/10 dark:text-white dark:placeholder-white/30";

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ background: "var(--main-bg, white)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-8 py-5 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0"
        style={{ background: "var(--card-bg)" }}
      >
        <div>
          <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-[13px] text-gray-400 dark:text-white/40 mt-0.5">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left tab list */}
        <aside
          className="w-52 flex-shrink-0 border-r border-gray-100 dark:border-white/[0.06] py-4 px-3 overflow-y-auto"
          style={{ background: "var(--card-bg)" }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5",
                  active
                    ? "bg-gray-100 text-gray-900 dark:bg-white/8 dark:text-white"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5"
                )}
              >
                <Icon className="size-4 flex-shrink-0" />
                {t.label}
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="size-4 flex-shrink-0" />
              {signOutLoading ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Right content */}
        <main className="flex-1 overflow-y-auto px-10 py-8 max-w-2xl">

          {/* ── Profile tab ─────────────────────────────────────────── */}
          {tab === "profile" && (
            <div>
              <Section title="Personal information" description="Update your display name and contact details.">
                <div className="flex items-center gap-4 mb-6">
                  <div className="size-16 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-white">
                      {(bajajUser?.full_name ?? bajajUser?.email ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{bajajUser?.full_name ?? "—"}</p>
                    <p className="text-[13px] text-gray-500 dark:text-white/50">{bajajUser?.email}</p>
                    <p className="text-[12px] text-gray-400 dark:text-white/30 mt-1 capitalize">{bajajUser?.role ?? "user"} · Bajaj Logistics</p>
                  </div>
                </div>

                <Field label="Full name">
                  <input
                    defaultValue={bajajUser?.full_name ?? ""}
                    className={inputCls}
                    placeholder="Your name"
                  />
                </Field>
                <Field label="Email address" description="This is your login email and cannot be changed here.">
                  <input
                    defaultValue={bajajUser?.email ?? ""}
                    readOnly
                    className="w-52 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[13px] text-gray-400 cursor-not-allowed dark:bg-[#111] dark:border-white/10 dark:text-white/30"
                  />
                </Field>
                <Field label="Role" description="Your assigned role in the system.">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[12px] font-semibold border border-amber-100 capitalize dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                    {bajajUser?.role ?? "user"}
                  </span>
                </Field>

                <div className="mt-4">
                  <button className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm">
                    Save changes
                  </button>
                </div>
              </Section>
            </div>
          )}

          {/* ── Appearance tab ──────────────────────────────────────── */}
          {tab === "appearance" && (
            <div>
              <Section title="Theme" description="Choose how the interface looks to you.">
                <div className="grid grid-cols-3 gap-3">
                  {(["light", "dark", "system"] as const).map((t) => {
                    const Icon = t === "light" ? Sun : t === "dark" ? Moon : Globe;
                    const active = (theme ?? "light") === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                          active
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-500/10"
                            : "border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20"
                        )}
                      >
                        <div className={cn("size-10 rounded-lg flex items-center justify-center", active ? "bg-amber-100 dark:bg-amber-500/20" : "bg-gray-100 dark:bg-white/5")}>
                          <Icon className={cn("size-5", active ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-white/40")} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[12px] font-medium capitalize", active ? "text-gray-700 dark:text-white" : "text-gray-500 dark:text-white/50")}>{t}</span>
                          {active && <Check className="size-3 text-amber-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-[12px] text-gray-400 dark:text-white/30">Changes apply immediately across the entire app.</p>
              </Section>
            </div>
          )}

          {/* ── Notifications tab ───────────────────────────────────── */}
          {tab === "notifications" && (
            <div>
              <Section title="Email notifications" description="Choose what you want to be notified about.">
                {([
                  { key: "reminders" as const, label: "Shipment reminders", description: "Get alerted when sailing dates approach" },
                  { key: "updates"   as const, label: "Status updates",     description: "Notify when a work order status changes" },
                  { key: "digest"    as const, label: "Daily digest",        description: "A daily summary of all active work orders" },
                ] as const).map(({ key, label, description }) => (
                  <Field key={key} label={label} description={description}>
                    <button
                      onClick={() => toggleNotif(key)}
                      className={cn(
                        "relative w-9 h-5 rounded-full transition-colors",
                        notifications[key] ? "bg-amber-500" : "bg-gray-200 dark:bg-white/10"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                        notifications[key] ? "translate-x-4" : "translate-x-0.5"
                      )} />
                    </button>
                  </Field>
                ))}
              </Section>
            </div>
          )}

          {/* ── Security tab ────────────────────────────────────────── */}
          {tab === "security" && (
            <div>
              <Section title="Password" description="Manage your authentication settings.">
                <p className="text-[13px] text-gray-500 dark:text-white/40 mb-4">
                  Password changes are handled through your authentication provider. Use the link below to reset your password.
                </p>
                <button
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors dark:border-white/10 dark:text-white/80 dark:hover:bg-white/5 disabled:opacity-50"
                >
                  {resetLoading ? "Sending…" : "Send password reset email"}
                  <ChevronRight className="size-4 text-gray-400 dark:text-white/30" />
                </button>
                {resetMsg && (
                  <p className={cn("mt-3 text-[13px]", resetMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                    {resetMsg.text}
                  </p>
                )}
              </Section>

              <Section title="Sessions" description="Manage where you're logged in.">
                <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/[0.03]">
                    <div>
                      <p className="text-[13px] font-medium text-gray-800 dark:text-white/80">Current session</p>
                      <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">Active now · {typeof window !== "undefined" ? window.location.hostname : "localhost"}</p>
                    </div>
                    <span className="size-2 rounded-full bg-emerald-400" />
                  </div>
                </div>
              </Section>

              <Section title="Danger zone">
                <div className="rounded-xl border border-red-100 dark:border-red-500/20 p-4">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-white/80 mb-1">Sign out everywhere</p>
                  <p className="text-[12px] text-gray-500 dark:text-white/30 mb-3">This will sign you out of all active sessions.</p>
                  <button
                    onClick={handleSignOut}
                    disabled={signOutLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-100 transition-colors dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <LogOut className="size-4" />
                    {signOutLoading ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </Section>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
