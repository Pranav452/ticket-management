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
    <div className="min-h-dvh bg-neutral-950 flex flex-col items-center justify-center px-6 py-12">
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3 mb-12"
      >
        <div className="size-16 rounded-full overflow-hidden bg-white ring-2 ring-neutral-700">
          <Image
            src="/logo.png"
            alt="Manilal"
            width={64}
            height={64}
            className="size-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">
          Manilal Platform
        </h1>
        <p className="text-sm text-neutral-500">Choose a module to continue</p>
      </motion.div>

      {/* Module cards */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-3xl">
        {/* Bajaj Shipment */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onClick={() => router.push("/bajaj")}
          className="flex-1 group relative flex flex-col items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-left hover:border-amber-600 hover:bg-neutral-800 transition-all duration-200 cursor-pointer"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-600/20 group-hover:bg-amber-600/30 transition-colors">
            <Ship className="size-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 group-hover:text-amber-300 transition-colors">
              Bajaj Shipment Dashboard
            </h2>
            <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
              Manage Bajaj Auto shipment work orders across Vipar, Sri Lanka,
              Nigeria, Bangladesh &amp; Triumph. Import from Excel, track
              status, and collaborate.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-500 group-hover:text-amber-400">
            Open Dashboard →
          </span>
        </motion.button>

        {/* Ticket Management */}
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          onClick={() => router.push(ticketHref)}
          className="flex-1 group relative flex flex-col items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-left hover:border-violet-600 hover:bg-neutral-800 transition-all duration-200 cursor-pointer"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-violet-600/20 group-hover:bg-violet-600/30 transition-colors">
            <Ticket className="size-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 group-hover:text-violet-300 transition-colors">
              Ticket Management
            </h2>
            <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
              Create and track support tickets. Dev team sees the full kanban
              board; users manage their own ticket queue.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-500 group-hover:text-violet-400">
            Open Tickets →
          </span>
        </motion.button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-neutral-700">
        © 2026 Manilal. All rights reserved.
      </p>
    </div>
  );
}
