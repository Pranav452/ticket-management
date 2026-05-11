"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Clock, XCircle, Loader2 } from "lucide-react";

type GateStatus = "not_found" | "pending" | "rejected";

interface BajajAccessGateProps {
  status: GateStatus;
  userId?: string;
  email?: string;
  fullName?: string;
}

export function BajajAccessGate({ status, userId, email, fullName }: BajajAccessGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function requestAccess() {
    if (!userId || !email) return;
    setLoading(true);
    setError(null);
    try {
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: "#F5F5F5" }}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center flex flex-col items-center gap-6 shadow-sm">

        {status === "not_found" && !done && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-amber-50">
              <Shield className="size-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Request Access</h2>
              <p className="mt-2 text-sm text-gray-500">
                The Bajaj Shipment Dashboard requires admin approval. Click below to send your access request.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 w-full border border-red-100">{error}</p>
            )}
            <button
              onClick={requestAccess}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Request Access
            </button>
            <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              ← Back to module selector
            </button>
          </>
        )}

        {(status === "not_found" && done) && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <Clock className="size-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Request Sent</h2>
              <p className="mt-2 text-sm text-gray-500">
                Your access request has been sent to the admin. You'll be able to log in once it's approved.
              </p>
            </div>
            <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              ← Back to module selector
            </button>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-yellow-50">
              <Clock className="size-8 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Awaiting Approval</h2>
              <p className="mt-2 text-sm text-gray-500">
                Your access request is pending admin approval. Please check back later.
              </p>
            </div>
            <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              ← Back to module selector
            </button>
          </>
        )}

        {status === "rejected" && (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
              <XCircle className="size-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
              <p className="mt-2 text-sm text-gray-500">
                Your access request was rejected. Please contact the admin for more information.
              </p>
            </div>
            <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              ← Back to module selector
            </button>
          </>
        )}
      </div>
    </div>
  );
}
