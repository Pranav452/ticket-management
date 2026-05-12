"use client"; 

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [company,  setCompany]  = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !fullName || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Create pending bajaj_users record
      await fetch("/api/bajaj/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, full_name: fullName }),
      });

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <CheckCircle className="mx-auto size-14 text-amber-500" />
          <h2 className="text-2xl font-bold text-neutral-50">Request submitted!</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Your access request for{" "}
            <span className="text-neutral-200 font-medium">{email}</span>{" "}
            has been received. An admin will approve your account — you&apos;ll be notified once approved.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 rounded-lg bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-7">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-600">
            <Globe className="size-4 text-white" />
          </div>
          <p className="text-sm font-bold text-neutral-100">Bajaj Logistics · Links</p>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Request Access</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Submit your details and an admin will approve your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-[13px] font-medium text-neutral-400">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
              placeholder="Yogesh Pednekar"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[13px] font-medium text-neutral-400">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
              placeholder="you@linksin.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[13px] font-medium text-neutral-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company" className="block text-[13px] font-medium text-neutral-400">
              Company / Role <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-50 placeholder-neutral-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors"
              placeholder="Links Bom · Operations"
            />
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
            {loading ? "Submitting…" : "Request Access"}
          </button>
        </form>

        <p className="text-center text-[13px] text-neutral-600">
          Already have access?{" "}
          <Link
            href="/login"
            className="text-amber-500 hover:text-amber-400 underline-offset-4 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
