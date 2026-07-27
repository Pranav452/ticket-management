
<!-- second-brain spoke (auto-added 2026-07-14) -->
## Project context (second brain)

Bajaj work-order/ticket tracker (kanban boards, imports/exports, reminders, RBAC, audit logs) plus a team chat module.
Stack: Next.js 16/React 19/TS, Tailwind 4, Supabase (ssr) auth/DB/realtime, mssql migration, Zustand, TanStack Query, Framer Motion, Radix, ExcelJS, Resend/Nodemailer, Recharts.
Run: npm run dev → :3000. Routes under app/(app)/bajaj/* and app/(app)/chats.
Watch out: .env & .env.local live Supabase/MSSQL/email creds — don't commit. scripts/ has risky one-off DB migration/seed/wipe (e.g. wipe-bajaj-data.mjs) — don't run against prod. README is boilerplate; real docs in code/commits.

Cross-project brain: `C:\Users\Manilal\second-brain` — full card `notes/projects/ticket-page.md`, recent context `hot.md`. Read the brain for cross-project/domain knowledge; do NOT read it for general coding questions.
