"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  LayoutGrid, BarChart2, Upload, ShieldCheck, LogOut,
  Search, ChevronDown, ChevronRight as ChevronRightIcon,
  PanelLeft, HelpCircle, Settings, Globe,
  Inbox, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  { slug: "vipar",      name: "VIPAR",      flag: "🌏", desc: "Myanmar · Brazil · Others" },
  { slug: "srilanka",   name: "Sri Lanka",  flag: "🇱🇰", desc: "Colombo · CMNBO" },
  { slug: "nigeria",    name: "Nigeria",    flag: "🇳🇬", desc: "Apapa Lagos" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🇧🇩", desc: "Chattogram" },
  { slug: "triumph",    name: "Triumph",    flag: "🇬🇧", desc: "United Kingdom" },
];

// Sidebar background + item palette (Linear-style warm beige)
const SB_BG      = "#EDECEA";
const SB_ACTIVE  = "rgba(0,0,0,0.07)";
const SB_HOVER   = "rgba(0,0,0,0.04)";
const SB_TEXT    = "#1C1C1E";
const SB_MUTED   = "#8A8A8E";
const SB_BORDER  = "rgba(0,0,0,0.07)";

function NavItem({
  href,
  label,
  icon: Icon,
  emoji,
  badge,
  depth = 0,
  active,
}: {
  href: string;
  label: string;
  icon?: React.ElementType;
  emoji?: string;
  badge?: number;
  depth?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] font-medium transition-colors select-none w-full"
      style={{
        paddingLeft: depth === 1 ? 28 : depth === 2 ? 44 : 8,
        background: active ? SB_ACTIVE : "transparent",
        color: active ? SB_TEXT : SB_MUTED,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = SB_HOVER; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {emoji && <span className="text-[14px] leading-none w-4 text-center flex-shrink-0">{emoji}</span>}
      {Icon && !emoji && <Icon className="size-[15px] flex-shrink-0" style={{ color: active ? SB_TEXT : SB_MUTED }} />}
      <span className="flex-1 truncate" style={{ color: active ? SB_TEXT : SB_MUTED }}>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto text-[11px] font-semibold tabular-nums rounded-full px-1.5 py-0.5 min-w-[18px] text-center"
          style={{ background: "rgba(0,0,0,0.08)", color: SB_MUTED }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider select-none"
      style={{ color: SB_MUTED }}>
      {label}
    </p>
  );
}

function Divider() {
  return <div className="mx-2 my-1" style={{ borderTop: `1px solid ${SB_BORDER}` }} />;
}

function ModuleGroup({ module, isActiveBoard }: { module: typeof MODULES[0]; isActiveBoard: boolean }) {
  const [open, setOpen] = useState(isActiveBoard);
  const pathname = usePathname();
  const isBoardActive = pathname === `/bajaj/boards/${module.slug}`;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-md px-2 py-[5px] w-full transition-colors select-none"
        style={{
          background: isActiveBoard && !open ? SB_ACTIVE : "transparent",
          color: SB_TEXT,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = SB_HOVER; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActiveBoard && !open ? SB_ACTIVE : "transparent"; }}
      >
        <span className="text-[14px] leading-none w-4 text-center flex-shrink-0">{module.flag}</span>
        <span className="flex-1 text-left text-[13px] font-medium truncate">{module.name}</span>
        {open
          ? <ChevronDown className="size-3.5 flex-shrink-0" style={{ color: SB_MUTED }} />
          : <ChevronRightIcon className="size-3.5 flex-shrink-0" style={{ color: SB_MUTED }} />
        }
      </button>

      {open && (
        <div>
          <NavItem href={`/bajaj/boards/${module.slug}`} label="Board" icon={LayoutGrid} depth={1} active={isBoardActive} />
          <NavItem href={`/bajaj/import?module=${module.slug}`} label="Import" icon={Upload} depth={1}
            active={pathname.startsWith("/bajaj/import") && (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("module") === module.slug : false)} />
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const pathname  = usePathname();
  const router    = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const bajajUser = useAuthStore((s) => s.bajajUser);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    sessionStorage.removeItem("bajaj_user");
    router.push("/login");
  }

  const activeModule = MODULES.find((m) => pathname.includes(`/bajaj/boards/${m.slug}`))?.slug;

  if (collapsed) {
    return (
      <div className="flex h-dvh overflow-hidden" style={{ background: "#F5F5F5" }}>
        {/* Collapsed sidebar */}
        <aside className="flex flex-col flex-shrink-0 w-12 items-center py-3 gap-3" style={{ background: SB_BG, borderRight: `1px solid ${SB_BORDER}` }}>
          <button onClick={() => setCollapsed(false)} className="size-7 flex items-center justify-center rounded-md transition-colors hover:bg-black/5">
            <PanelLeft className="size-4" style={{ color: SB_MUTED }} />
          </button>
          <div className="flex size-7 items-center justify-center rounded-md bg-amber-500 flex-shrink-0">
            <Globe className="size-3.5 text-white" />
          </div>
          <Divider />
          {MODULES.map((m) => (
            <Link key={m.slug} href={`/bajaj/boards/${m.slug}`} title={m.name}
              className="size-7 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 text-sm"
              style={{ background: activeModule === m.slug ? SB_ACTIVE : "transparent" }}>
              {m.flag}
            </Link>
          ))}
        </aside>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[18px] bg-white">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "#EDECEA" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="bajaj-sidebar flex flex-col flex-shrink-0 w-[220px] overflow-hidden"
        style={{ background: SB_BG, borderRight: `1px solid ${SB_BORDER}` }}
      >

        {/* ── Workspace header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: `1px solid ${SB_BORDER}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 items-center justify-center rounded-md bg-amber-500 flex-shrink-0">
              <Globe className="size-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-none truncate" style={{ color: SB_TEXT }}>Bajaj Logistics</p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="size-6 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 flex-shrink-0"
          >
            <PanelLeft className="size-4" style={{ color: SB_MUTED }} />
          </button>
        </div>

        {/* ── Search ────────────────────────────────────────────────── */}
        <div className="px-2 pt-2.5 pb-1">
          <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
            style={{ background: "rgba(0,0,0,0.05)", color: SB_MUTED }}>
            <Search className="size-3.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder-current min-w-0"
              style={{ color: SB_MUTED }}
            />
            <span className="text-[11px] font-medium px-1 rounded" style={{ background: "rgba(0,0,0,0.08)", color: SB_MUTED }}>/</span>
          </div>
        </div>

        {/* ── Scrollable nav ────────────────────────────────────────── */}
        <nav className="flex flex-col flex-1 px-1.5 pb-3 overflow-y-auto overflow-x-hidden">

          {/* Top-level */}
          <div className="pt-1">
            <NavItem href="/bajaj/import"    label="Import"       icon={Inbox}         active={pathname.startsWith("/bajaj/import")} />
            <NavItem href="/bajaj/chat"      label="Chat"         icon={MessageSquare} active={pathname.startsWith("/bajaj/chat")} />
            <NavItem href="/bajaj/dashboard" label="Analytics"    icon={BarChart2}     active={pathname.startsWith("/bajaj/dashboard")} />
          </div>

          <Divider />

          {/* Modules section */}
          <SectionHeader label="Modules" />

          {MODULES.map((m) => (
            <ModuleGroup
              key={m.slug}
              module={m}
              isActiveBoard={activeModule === m.slug}
            />
          ))}

          <Divider />

          {/* Tools */}
          <SectionHeader label="Tools" />
          <NavItem href="/bajaj/admin"    label="Admin"    icon={ShieldCheck}  active={pathname.startsWith("/bajaj/admin")} />
          <NavItem href="/bajaj/settings" label="Settings" icon={Settings}     active={pathname.startsWith("/bajaj/settings")} />

        </nav>

        {/* ── Bottom footer ─────────────────────────────────────────── */}
        <div className="px-2 py-2" style={{ borderTop: `1px solid ${SB_BORDER}` }}>
          {bajajUser && (
            <Link
              href="/bajaj/settings"
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors w-full group"
              style={{ color: SB_TEXT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = SB_HOVER; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div className="size-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white">
                  {(bajajUser.full_name ?? bajajUser.email ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate" style={{ color: SB_TEXT }}>{bajajUser.full_name ?? bajajUser.email}</p>
                <p className="text-[10px] truncate" style={{ color: SB_MUTED }}>{bajajUser.email}</p>
              </div>
              <Settings className="size-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: SB_MUTED }} />
            </Link>
          )}
        </div>
      </aside>

      {/* ── Page content ────────────────────────────────────────────── */}
      <main className="bajaj-main flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[18px]" style={{ background: "#F8F8F7" }}>
        {children}
      </main>
    </div>
  );
}
