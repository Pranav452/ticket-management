"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  LayoutGrid, BarChart2, Upload, ShieldCheck,
  Search, ChevronDown, ChevronRight as ChevronRightIcon,
  PanelLeft, Settings, Globe,
  Inbox, MessageSquare, Home, Loader2, X,
  Download, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  { slug: "vipar",      name: "VIPAR",      flag: "🌐", desc: "Myanmar · Brazil · Others" },
  { slug: "srilanka",   name: "Sri Lanka",  flag: "🌴", desc: "Colombo · CMNBO" },
  { slug: "nigeria",    name: "Nigeria",    flag: "🟢", desc: "Apapa Lagos" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🔴", desc: "Chattogram" },
  { slug: "triumph",    name: "Triumph",    flag: "⚡", desc: "United Kingdom" },
];

// Sidebar palette — use CSS vars so dark mode applies automatically
const SB_BG      = "var(--sb-bg)";
const SB_ACTIVE  = "var(--sb-active)";
const SB_HOVER   = "var(--sb-hover)";
const SB_TEXT    = "var(--sb-text)";
const SB_MUTED   = "var(--sb-muted)";
const SB_BORDER  = "var(--sb-border)";

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

// ─── Global Search Result type ────────────────────────────────────────────────
interface SearchResult {
  id: string;
  module_slug: string;
  module_name: string;
  module_flag: string;
  wo: string;
  brand: string;
  variant: string;
  port: string;
  vslname: string;
  status_name: string;
  status_color: string;
}

// ─── Sidebar Search Component ─────────────────────────────────────────────────
function SidebarSearch() {
  const router    = useRouter();
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/bajaj/search?q=${encodeURIComponent(query)}&limit=12`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Keyboard shortcut: / to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function navigate(r: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(`/bajaj/work-orders/${r.id}`);
  }

  return (
    <div ref={wrapRef} className="px-2 pt-2.5 pb-1 relative">
      <div className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
        open ? "ring-1 ring-amber-500/40" : ""
      )} style={{ background: "rgba(0,0,0,0.05)", color: SB_MUTED }}>
        {loading
          ? <Loader2 className="size-3.5 flex-shrink-0 animate-spin" />
          : <Search className="size-3.5 flex-shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          placeholder="Search any WO, vessel, BL…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          className="flex-1 bg-transparent text-[13px] outline-none placeholder-current min-w-0"
          style={{ color: SB_MUTED }}
        />
        {query
          ? <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="flex-shrink-0 hover:text-white/70 transition-colors"><X className="size-3" /></button>
          : <span className="text-[11px] font-medium px-1 rounded flex-shrink-0" style={{ background: "rgba(0,0,0,0.08)", color: SB_MUTED }}>/</span>
        }
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border overflow-hidden shadow-xl"
          style={{ background: "var(--sb-bg)", borderColor: SB_BORDER }}>
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => navigate(r)}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/5",
                i !== 0 && "border-t"
              )}
              style={{ borderColor: SB_BORDER }}
            >
              {/* Module flag + status dot */}
              <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                <span className="text-[12px] leading-none">{r.module_flag}</span>
                <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `#${r.status_color}` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold font-mono" style={{ color: SB_TEXT }}>
                    {r.wo || r.id.slice(0, 8)}
                  </span>
                  {r.status_name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `#${r.status_color}22`, color: `#${r.status_color}` }}>
                      {r.status_name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] truncate" style={{ color: SB_MUTED }}>
                  {[r.brand, r.variant].filter(Boolean).join(" · ")}
                  {r.vslname && ` · ${r.vslname}`}
                  {r.port && ` · ${r.port}`}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: SB_MUTED, opacity: 0.6 }}>
                  {r.module_name}
                </p>
              </div>
            </button>
          ))}
          {results.length === 12 && (
            <div className="px-3 py-1.5 text-[10px] text-center border-t" style={{ borderColor: SB_BORDER, color: SB_MUTED }}>
              Showing first 12 — refine your search for more
            </div>
          )}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border px-3 py-3 text-center text-[12px] shadow-xl"
          style={{ background: "var(--sb-bg)", borderColor: SB_BORDER, color: SB_MUTED }}>
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
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
      <div className="flex h-dvh overflow-hidden" style={{ background: "var(--main-bg)" }}>
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
        <main className="bajaj-main flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[18px]" style={{ background: "var(--main-bg)" }}>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--sb-bg)" }}>

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
        <SidebarSearch />

        {/* ── Scrollable nav ────────────────────────────────────────── */}
        <nav className="flex flex-col flex-1 px-1.5 pb-3 overflow-y-auto overflow-x-hidden">

          {/* Top-level */}
          <div className="pt-1">
            <NavItem href="/bajaj/home"      label="Home"         icon={Home}          active={pathname === "/bajaj/home" || pathname === "/bajaj"} />
            <NavItem href="/bajaj/import"    label="Import"       icon={Inbox}         active={pathname.startsWith("/bajaj/import")} />
            <NavItem href="/bajaj/chat"      label="Chat"         icon={MessageSquare} active={pathname.startsWith("/bajaj/chat")} />
            <NavItem href="/bajaj/dashboard" label="Analytics"    icon={BarChart2}     active={pathname.startsWith("/bajaj/dashboard")} />
            <NavItem href="/bajaj/bookings"  label="Bookings"     icon={BookOpen}      active={pathname.startsWith("/bajaj/bookings")} />
            <NavItem href="/bajaj/export"    label="Export"       icon={Download}      active={pathname.startsWith("/bajaj/export")} />
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
          {(bajajUser?.role === "superadmin" || bajajUser?.role === "admin") && (
            <NavItem href="/bajaj/admin" label="Admin" icon={ShieldCheck} active={pathname.startsWith("/bajaj/admin")} />
          )}
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
      <main className="bajaj-main flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[18px]" style={{ background: "var(--main-bg)" }}>
        {children}
      </main>
    </div>
  );
}
