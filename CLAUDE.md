# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Next.js dev server
npm run build     # Production build
npm run lint      # ESLint (next/core-web-vitals + typescript)
```

There is no test runner configured. Lint is the only static check available.

To start the full Supabase backend (required for the app to function):
```bash
docker compose up -d
```

## Architecture Overview

This is a **dual-module application** with two separate business domains sharing the same Supabase DB:

1. **Ticket Management System** — support ticket CRUD with Kanban board and real-time chat
2. **Bajaj Auto Shipment Tracking** — Excel-driven work order boards with approval workflow

The root `/` renders a `ModuleSelector` hero page for authenticated users to choose between modules.

### Next.js 16 Specifics

- **Middleware** uses `proxy.ts` exporting `proxy()` (not the deprecated `middleware.ts`/`middleware()`)
- Pages that call `auth.getUser()` require `export const dynamic = "force-dynamic"` to prevent prerender failures
- Route groups: `(auth)` for public pages, `(app)` for authenticated pages

### Authentication & Role System

- Supabase SSR with `@supabase/ssr` — auth cookies managed server-side
- `profiles.role`: `'user'` (default) or `'dev'`; auto-assigned on signup via `handle_new_user()` Postgres trigger
- Dev email sourced from `app_config` table (env var `DEV_EMAIL` seeds the trigger)
- **Dev** → `/dashboard` (Kanban, all tickets); **User** → `/tickets` (list, own tickets only)
- Bajaj admin (`pranavnairop090@gmail.com`) bypasses `bajaj_users` approval check

### State Management Pattern

- **Zustand** for UI state: `useTicketStore` (selected ticket + panel open/closed), `useAuthStore` (user + profile), `useUIStore`
- **TanStack Query** for all server data: hooks in `lib/queries/` — do not use `useEffect`+`fetch` for data fetching

### Supabase Client Usage

- `lib/supabase/client.ts` — browser client (use in Client Components)
- `lib/supabase/server.ts` — server client reading cookies (use in Server Components and API routes)
- Real-time chat via Supabase Realtime subscriptions in `lib/queries/messages.ts`

### Drag-and-Drop

Both Kanban boards use **custom HTML5 DnD** (not `@dnd-kit`). Do not use `framer-motion`'s `motion.div` as the drag element — it conflicts with HTML `onDragStart` typings. Use a plain `div`.

### Bajaj Module

- 5 boards identified by slug: `vipar`, `srilanka`, `nigeria`, `bangladesh`, `triumph`
- Excel import: `app/api/bajaj/import/route.ts` uses ExcelJS; reads a "Color Coding Legend" sheet to determine status colors. Cast ExcelJS fill as `{ fgColor?: { argb?: string } }` (do not use `ExcelJS.PatternFill` — not exported)
- Email notifications: `app/api/bajaj/notify/route.ts` uses Resend (`RESEND_API_KEY` in `.env.local`)

### Database Migrations

- `supabase/migrations/001_initial_schema.sql` — ticket system tables, RLS, triggers
- `supabase/migrations/002_bajaj_schema.sql` — all `bajaj_*` tables, RLS, audit logs

### Key Type Patterns

- Ticket/Profile/Message types: `lib/types/index.ts`
- Bajaj types (32 interfaces/enums): `lib/types/bajaj.ts`
- Utility: `lib/utils.ts` exports `cn()` (clsx + tailwind-merge)

### UI Conventions

- Tailwind CSS v4 — configured via `@theme` inline in `app/globals.css`, no separate `tailwind.config.ts`
- Framer Motion for slide-in panels and sidebar animations
- Sidebar: logo at bottom with `rounded-full overflow-hidden`; nav links at top; logout calls `supabase.auth.signOut()` then `router.push('/login')`
- Ticket detail panel: Framer Motion slide-in from right (`x: "100%" → 0`), controlled by `useTicketStore`
- `SidebarLink`: destructure `href` as `_href` in props to avoid TS2783 duplicate href error
