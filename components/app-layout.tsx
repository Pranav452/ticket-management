"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Upload,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Module config ────────────────────────────────────────────────────────────
const MODULES = [
  { slug: "vipar",      name: "VIPAR",      flag: "🌏", desc: "Myanmar · Brazil · Others" },
  { slug: "srilanka",   name: "Sri Lanka",  flag: "🇱🇰", desc: "Colombo · CMNBO" },
  { slug: "nigeria",    name: "Nigeria",    flag: "🇳🇬", desc: "Apapa Lagos" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🇧🇩", desc: "Chattogram" },
  { slug: "triumph",    name: "Triumph",    flag: "🇬🇧", desc: "United Kingdom" },
];

const UTILS: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/bajaj/dashboard", label: "Analytics", icon: BarChart2 },
  { href: "/bajaj/import",    label: "Import",    icon: Upload },
  { href: "/bajaj/admin",     label: "Admin",     icon: ShieldCheck },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({
  href,
  active,
  collapsed,
  children,
  title,
}: {
  href: string;
  active?: boolean;
  collapsed: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? title : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 group relative",
        active
          ? "bg-amber-600/15 text-amber-300 border border-amber-700/40"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 border border-transparent"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-amber-500 rounded-r" />
      )}
      {children}
    </Link>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  const activeModule = MODULES.find(
    (m) => pathname.includes(`/bajaj/boards/${m.slug}`)
  )?.slug;

  return (
    <div className="flex h-dvh bg-neutral-950 text-neutral-50 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col flex-shrink-0 border-r border-neutral-800/60 bg-[#0a0a0a] transition-all duration-200 overflow-hidden",
          collapsed ? "w-[52px]" : "w-52"
        )}
      >
        {/* Brand header */}
        <div className={cn(
          "flex items-center border-b border-neutral-800/60 px-3",
          collapsed ? "justify-center py-4" : "justify-between py-3.5"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-7 items-center justify-center rounded-md bg-amber-600 flex-shrink-0">
                <Globe className="size-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-100 leading-none tracking-tight">
                  Bajaj Logistics
                </p>
                <p className="text-[10px] text-neutral-500 leading-none mt-0.5">
                  Links · Operations
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-600">
              <Globe className="size-3.5 text-white" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="size-6 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-2 size-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex flex-col flex-1 gap-0.5 px-1.5 py-3 overflow-y-auto overflow-x-hidden">

          {/* Modules */}
          {!collapsed && (
            <p className="px-2.5 mb-1 text-[9px] uppercase tracking-widest text-neutral-600 font-semibold select-none">
              Modules
            </p>
          )}
          {MODULES.map((m) => {
            const isActive = activeModule === m.slug;
            return (
              <NavItem
                key={m.slug}
                href={`/bajaj/boards/${m.slug}`}
                active={isActive}
                collapsed={collapsed}
                title={m.name}
              >
                <span className="text-sm leading-none flex-shrink-0 select-none">{m.flag}</span>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-[13px] font-medium leading-none",
                      isActive ? "text-amber-300" : "text-neutral-200 group-hover:text-white"
                    )}>
                      {m.name}
                    </p>
                    <p className="text-[10px] text-neutral-600 leading-none mt-0.5 truncate">
                      {m.desc}
                    </p>
                  </div>
                )}
              </NavItem>
            );
          })}

          <div className={cn("my-2 border-t border-neutral-800/60", collapsed && "mx-1")} />

          {/* Tools */}
          {!collapsed && (
            <p className="px-2.5 mb-1 text-[9px] uppercase tracking-widest text-neutral-600 font-semibold select-none">
              Tools
            </p>
          )}
          {UTILS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <NavItem key={href} href={href} active={isActive} collapsed={collapsed} title={label}>
                <Icon className={cn(
                  "size-4 flex-shrink-0",
                  isActive ? "text-amber-400" : "text-neutral-500 group-hover:text-neutral-300"
                )} />
                {!collapsed && (
                  <span className={cn(
                    "text-[13px]",
                    isActive ? "text-amber-300 font-medium" : "text-neutral-400 group-hover:text-neutral-100"
                  )}>
                    {label}
                  </span>
                )}
              </NavItem>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-1.5 py-3 border-t border-neutral-800/60">
          <button
            onClick={() => router.push("/login")}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-600 hover:text-red-400 hover:bg-neutral-800 border border-transparent transition-all w-full",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="size-4 flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
