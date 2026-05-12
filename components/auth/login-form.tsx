"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export function LoginForm() {
  const router       = useRouter();
  const setBajajUser = useAuthStore((s) => s.setBajajUser);
  const setUser      = useAuthStore((s) => s.setUser);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        setError(signInError?.message ?? "Login failed");
        setLoading(false);
        return;
      }
      setUser(data.user);

      const meRes  = await fetch("/api/bajaj/auth/me");
      const meData = await meRes.json() as {
        id?: string; email?: string; full_name?: string | null;
        role?: string; department?: string | null; status?: string; error?: string;
      };

      if (!meRes.ok) {
        setError(meData.error ?? "Could not load profile");
        setLoading(false);
        return;
      }
      if (meData.status === "pending") {
        setError("Your account is pending admin approval.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const bajajUser = {
        id:         meData.id!,
        email:      meData.email!,
        full_name:  meData.full_name ?? null,
        role:       meData.role ?? "viewer",
        department: meData.department ?? null,
      };
      setBajajUser(bajajUser);
      sessionStorage.setItem("bajaj_user", JSON.stringify(bajajUser));
      router.push("/bajaj/boards/vipar");
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex">

      {/* Left panel — solid dark, desktop only */}
      <div
        className="hidden lg:flex lg:w-[400px] flex-col justify-between px-12 py-14 flex-shrink-0"
        style={{ background: "#0a0a0a" }}
      >
        {/* Logo mark */}
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div
              className="size-9 rounded-sm flex items-center justify-center flex-shrink-0"
              style={{ background: "#d97706" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1" fill="white" />
                <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="10" y="10" width="6" height="6" rx="1" fill="white" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white leading-none tracking-tight">Bajaj Logistics</p>
              <p className="text-[12px] mt-0.5 leading-none" style={{ color: "rgba(255,255,255,0.35)" }}>Links Operations</p>
            </div>
          </div>

          <h2 className="text-[28px] font-semibold text-white leading-snug tracking-tight mb-4">
            Shipment management<br />for global markets.
          </h2>
          <p className="text-[14px] leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Track work orders across Sri Lanka, Nigeria, Bangladesh, Triumph, and VIPAR — from dispatch to BL release.
          </p>

          <div className="space-y-5">
            {[
              ["Kanban board", "10-stage lifecycle with drag-and-drop card movement"],
              ["Column access", "Role-based permissions per team and per column"],
              ["Auto-advance", "Cards move automatically when required fields are filled"],
              ["Import", "Paste dispatch plans from email or upload Excel directly"],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3">
                <div
                  className="mt-1 size-1.5 rounded-full flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.25)" }}
                />
                <div>
                  <p className="text-[13px] font-medium text-white">{title}</p>
                  <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          Manilal / Links — Internal use only
        </p>
      </div>

      {/* Right panel — form */}
      <div
        className="flex flex-1 items-center justify-center px-6 py-12"
        style={{ background: "#fafafa" }}
      >
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-10">
            <div
              className="size-8 rounded-sm flex items-center justify-center"
              style={{ background: "#d97706" }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1" fill="white" />
                <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="10" y="10" width="6" height="6" rx="1" fill="white" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-gray-900">Bajaj Logistics</p>
          </div>

          <div className="mb-8">
            <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight mb-1">Sign in</h1>
            <p className="text-[13px] text-gray-500">Enter your credentials to access the workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@links.com"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[14px] text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-11 text-[14px] text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: loading ? "#a3a3a3" : "#0a0a0a" }}
            >
              {loading ? (
                <><Loader2 className="size-4 animate-spin" />Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-[13px] text-gray-500 text-center">
              Need access?{" "}
              <Link
                href="/signup"
                className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700 transition-colors"
              >
                Request an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
