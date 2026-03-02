"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <CheckCircle className="mx-auto size-12 text-emerald-400" />
        <h2 className="text-xl font-semibold text-neutral-50">
          Check your email
        </h2>
        <p className="text-sm text-neutral-400">
          We sent a confirmation link to{" "}
          <span className="text-neutral-200">{email}</span>. Click it to
          activate your account.
        </p>
        <p className="text-xs text-neutral-500">
          (If email confirmation is disabled in your setup, you can{" "}
          <Link href="/login" className="text-violet-400 hover:underline">
            sign in directly
          </Link>
          .)
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">
          Create account
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Join the ticket management system
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="fullName"
            className="block text-sm text-neutral-300"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Manilal Patel"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-neutral-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm text-neutral-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 pr-10 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-sm text-neutral-300"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Repeat password"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-neutral-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
