"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Ship, Ticket } from "lucide-react";
import Image from "next/image";
import type { Profile } from "@/lib/types";

interface ModuleSelectorProps {
  profile: Profile | null;
}

export function ModuleSelector({ profile }: ModuleSelectorProps) {
  const router = useRouter();
  const ticketHref = profile?.role === "dev" ? "/dashboard" : "/tickets";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F5F5F5" }}>
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3 mb-12"
      >
        <div className="size-16 rounded-full overflow-hidden bg-white ring-2 ring-gray-200 shadow-sm">
          <Image src="/logo.png" alt="Manilal" width={64} height={64} className="size-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manilal Platform</h1>
        <p className="text-sm text-gray-400">Choose a module to continue</p>
      </motion.div>

      {/* Module cards */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-3xl">
        {/* Bajaj Shipment */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onClick={() => router.push("/bajaj")}
          className="flex-1 group relative flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-8 text-left hover:border-amber-300 hover:shadow-md transition-all duration-200 cursor-pointer shadow-sm"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors">
            <Ship className="size-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
              Bajaj Shipment Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Manage Bajaj Auto shipment work orders across Vipar, Sri Lanka,
              Nigeria, Bangladesh &amp; Triumph. Import from Excel, track status, and collaborate.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-500 group-hover:text-amber-600">
            Open Dashboard →
          </span>
        </motion.button>

        {/* Ticket Management */}
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          onClick={() => router.push(ticketHref)}
          className="flex-1 group relative flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-8 text-left hover:border-violet-300 hover:shadow-md transition-all duration-200 cursor-pointer shadow-sm"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-violet-50 group-hover:bg-violet-100 transition-colors">
            <Ticket className="size-6 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
              Ticket Management
            </h2>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Create and track support tickets. Dev team sees the full kanban board; users manage their own ticket queue.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-500 group-hover:text-violet-600">
            Open Tickets →
          </span>
        </motion.button>
      </div>

      <p className="mt-12 text-xs text-gray-300">© 2026 Manilal. All rights reserved.</p>
    </div>
  );
}
