"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-4 border-b border-neutral-800 bg-neutral-900 px-4 md:px-6",
        className
      )}
    >
      <Link
        href="/"
        className="flex items-center gap-4 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900 rounded"
        aria-label="Manilal Ticket Management System home"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded bg-white p-1">
          <Image
            src="/logo.png"
            alt=""
            width={30}
            height={30}
            className="size-12 object-contain"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold tracking-tight text-neutral-50 text-balance">
            Manilal Ticket Management System
          </span>
          <span className="text-sm text-neutral-400 text-pretty">
            by Manilal Patel
          </span>
        </div>
      </Link>
    </header>
  );
}
