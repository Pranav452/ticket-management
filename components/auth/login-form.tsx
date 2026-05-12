"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Globe, ArrowRight, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";

const TEST_USERS = [
  { email: "superadmin@links.com", label: "Super Admin", role: "superadmin" },
  { email: "admin@links.com",      label: "Admin",       role: "admin"      },
  { email: "ops@links.com",        label: "Operator",    role: "operator"   },
  { email: "viewer@links.com",     label: "Viewer",      role: "viewer"     },
];
const TEST_PASSWORD = "Links@2026";

export function LoginForm() {
  const router       = useRouter();
  const setBajajUser = useAuthStore((s) => s.setBajajUser);
  const setUser      = useAuthStore((s) => s.setUser);

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [showTestBox, setShowTestBox] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.user) { setError(signInError?.message ?? "Login failed"); setLoading(false); return; }
      setUser(data.user);
      const meRes  = await fetch("/api/bajaj/auth/me");
      const meData = await meRes.json() as { id?: string; email?: string; full_name?: string | null; role?: string; department?: string | null; status?: string; error?: string; };
      if (!meRes.ok) { setError(meData.error ?? "Could not load profile"); setLoading(false); return; }
      if (meData.status === "pending") { setError("Your account is pending admin approval."); await supabase.auth.signOut(); setLoading(false); return; }
      const bajajUser = { id: meData.id!, email: meData.email!, full_name: meData.full_name ?? null, role: meData.role ?? "viewer", department: meData.department ?? null };
      setBajajUser(bajajUser);
      sessionStorage.setItem("bajaj_user", JSON.stringify(bajajUser));
      router.push("/bajaj/boards/vipar");
      router.refresh();
    } catch { setError("Network error. Check your connection."); setLoading(false); }
  }

  return (
    <div className="min-h-dvh flex" style={{ background: "#F5F5F5" }}>

      {/* Left branding — dark teal, desktop only */}
      <div className="hidden lg:flex lg:w-[420px] flex-col justify-between px-12 py-12 flex-shrink-0" style={{ background: "#0B2D29" }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500">
              <Globe className="size-6 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-white leading-none">Bajaj Logistics</p>
              <p className="text-sm leading-none mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Links Operations Hub</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Track every shipment.<br /><span className="text-amber-400">Across every market.</span>
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Real-time dispatch boards for Sri Lanka, Nigeria, Bangladesh, Triumph, VIPAR and beyond.
          </p>
          <div className="space-y-4">
            {[
              { icon: "🌍", text: "5 country modules with real-time tracking" },
              { icon: "📋", text: "Paste dispatch plans from email in seconds" },
              { icon: "📦", text: "8-stage workflow: Planning → Booking → BL Release" },
              { icon: "🔐", text: "Role-based access control for teams" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-xl leading-none flex-shrink-0">{icon}</span>
                <p className="text-sm leading-relaxed pt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>© 2026 Manilal / Links. Internal use only.</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-10">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500">
              <Globe className="size-6 text-white" />
            </div>
            <p className="text-lg font-bold text-gray-900">Bajaj Logistics</p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to your Links account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input id="email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@linksin.com"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input id="password" type={showPwd ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm">
              {loading ? <><Loader2 className="size-4 animate-spin" />Signing in…</> : <>Sign in <ArrowRight className="size-4" /></>}
            </button>
          </form>

          {/* Test accounts */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <button type="button" onClick={() => setShowTestBox(!showTestBox)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <span className="font-medium">🧪 Test accounts <span className="text-gray-400 font-normal">(dev)</span></span>
              <ChevronDown className={`size-4 text-gray-400 transition-transform ${showTestBox ? "rotate-180" : ""}`} />
            </button>
            {showTestBox && (
              <div className="border-t border-gray-100 p-3 space-y-1.5">
                <p className="text-xs text-gray-400 mb-2">Password: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-amber-600 font-mono text-xs">{TEST_PASSWORD}</code></p>
                {TEST_USERS.map((u) => (
                  <button key={u.email} type="button" onClick={() => { setEmail(u.email); setPassword(TEST_PASSWORD); setShowTestBox(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-amber-50 border border-gray-100 hover:border-amber-200 transition-all group">
                    <div className="text-left">
                      <p className="text-xs font-semibold text-gray-800">{u.label}</p>
                      <p className="text-[11px] text-gray-400">{u.email}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors uppercase tracking-wide">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            New to Links?{" "}
            <Link href="/signup" className="text-amber-600 hover:text-amber-700 font-semibold transition-colors">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
