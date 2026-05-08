"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Globe, ChevronDown, ChevronUp } from "lucide-react";

// ─── Test accounts ────────────────────────────────────────────────────────────
const TEST_USERS = [
  { email: "superadmin@links.com", label: "Super Admin",    role: "superadmin", color: "text-red-400"    },
  { email: "admin@links.com",      label: "Admin",           role: "admin",      color: "text-amber-400"  },
  { email: "ops@links.com",        label: "Ops (operator)",  role: "operator",   color: "text-blue-400"   },
  { email: "docs@links.com",       label: "Docs (operator)", role: "operator",   color: "text-purple-400" },
  { email: "viewer@links.com",     label: "Viewer",          role: "viewer",     color: "text-neutral-400"},
];
const TEST_PASSWORD = "Links@2026";

export function LoginForm() {
  const router = useRouter();
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
      const res = await fetch("/api/bajaj/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }

      // Store session in sessionStorage so other components can read it
      sessionStorage.setItem("bajaj_user", JSON.stringify(data));

      router.push("/bajaj/boards/vipar");
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  }

  function quickLogin(testEmail: string) {
    setEmail(testEmail);
    setPassword(TEST_PASSWORD);
    setShowTestBox(false);
  }

  return (
    <div className="min-h-dvh bg-neutral-950 flex">
      {/* ── Left panel — branding ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[420px] flex-col justify-between bg-[#0d0d0d] border-r border-neutral-800 px-12 py-14">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-600">
            <Globe className="size-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-100 leading-none">Bajaj Logistics</p>
            <p className="text-[11px] text-neutral-500 leading-none mt-0.5">Links · Operations</p>
          </div>
        </div>

        {/* Feature list */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100 leading-snug">
              Track every shipment.<br />
              Across every market.
            </h2>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              Bajaj Auto dispatch plans → real-time work order boards for
              Sri Lanka, Nigeria, Bangladesh, Triumph and beyond.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: "🌏", text: "5 country modules — VIPAR, Sri Lanka, Nigeria, Bangladesh, Triumph" },
              { icon: "📋", text: "Paste dispatch plan from email — rows imported in seconds" },
              { icon: "📦", text: "Planning → Booking → SI Filing → Clearance → Billing → BL Release" },
              { icon: "🛡",  text: "Role-based access — superadmin, admin, operator, viewer" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">{icon}</span>
                <p className="text-sm text-neutral-400">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-neutral-700">
          © 2026 Manilal / Links. Internal use only.
        </p>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-md bg-amber-600">
              <Globe className="size-4 text-white" />
            </div>
            <p className="text-sm font-bold text-neutral-100">Bajaj Logistics · Links</p>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-neutral-500">Enter your Links email to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13px] font-medium text-neutral-400">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
                placeholder="yogesh.p@linksin.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-medium text-neutral-400">
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
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 pr-10 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-amber-900/30"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* ── Test accounts ──────────────────────────────────────────── */}
          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTestBox(!showTestBox)}
              className="flex w-full items-center justify-between px-4 py-3 text-[13px] text-neutral-500 hover:bg-neutral-900 transition-colors"
            >
              <span>🧪 Test accounts (dev only)</span>
              {showTestBox ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showTestBox && (
              <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3 space-y-2">
                <p className="text-[11px] text-neutral-600 mb-3">
                  Password for all: <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">{TEST_PASSWORD}</code>
                </p>
                {TEST_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => quickLogin(u.email)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-900 transition-colors text-left"
                  >
                    <div>
                      <p className={`text-[13px] font-medium ${u.color}`}>{u.label}</p>
                      <p className="text-[11px] text-neutral-600">{u.email}</p>
                    </div>
                    <span className="text-[10px] text-neutral-700 bg-neutral-800 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-[13px] text-neutral-600">
            New to Links?{" "}
            <Link href="/signup" className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline transition-colors">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
