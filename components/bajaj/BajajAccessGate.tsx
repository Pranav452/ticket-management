"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, Clock, XCircle, Loader2 } from "lucide-react";

type GateStatus = "not_found" | "pending" | "rejected";

interface BajajAccessGateProps {
  status: GateStatus;
  userId?: string;
  email?: string;
  fullName?: string;
}

export function BajajAccessGate({
  status,
  userId,
  email,
  fullName,
}: BajajAccessGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestAccess() {
    if (!userId || !email) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("bajaj_users").insert({
        user_id: userId,
        email,
        full_name: fullName ?? email.split("@")[0],
        status: "pending",
      });
      if (err) throw err;
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center flex flex-col items-center gap-6">
        {status === "not_found" && !done && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-amber-600/20">
              <Shield className="size-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Request Access
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                The Bajaj Shipment Dashboard requires admin approval. Click
                below to send your access request.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2 w-full">
                {error}
              </p>
            )}
            <button
              onClick={requestAccess}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Request Access
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              ← Back to module selector
            </button>
          </>
        )}

        {(status === "not_found" && done) && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-600/20">
              <Clock className="size-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Request Sent
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Your access request has been sent to the admin. You&apos;ll be able
                to log in once it&apos;s approved.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ← Back to module selector
            </button>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-yellow-600/20">
              <Clock className="size-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Awaiting Approval
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Your access request is pending admin approval. Please check
                back later.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ← Back to module selector
            </button>
          </>
        )}

        {status === "rejected" && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-red-600/20">
              <XCircle className="size-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Access Denied
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Your access request was rejected. Please contact the admin
                for more information.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ← Back to module selector
            </button>
          </>
        )}
      </div>
    </div>
  );
}
