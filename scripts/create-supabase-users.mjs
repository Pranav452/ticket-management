/**
 * Creates / ensures all test users exist in Supabase Auth.
 * Uses the admin API (service role key) — bypasses email confirmation.
 * 
 * Run: node scripts/create-supabase-users.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);

const SUPABASE_URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const TEST_USERS = [
  { email: "superadmin@links.com", full_name: "Super Admin"  },
  { email: "admin@links.com",      full_name: "Admin User"   },
  { email: "ops@links.com",        full_name: "Ops Team"     },
  { email: "docs@links.com",       full_name: "Docs Team"    },
  { email: "viewer@links.com",     full_name: "Viewer User"  },
];

for (const u of TEST_USERS) {
  process.stdout.write(`Creating: ${u.email} ... `);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: u.email,
      password: "Links@2026",
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    }),
  });
  const d = await res.json();
  if (res.ok)                          console.log(`✓ created (${d.id})`);
  else if (d.code === 422 || d.msg?.includes("already")) console.log("· already exists");
  else                                 console.log(`✗ ${JSON.stringify(d)}`);
}

console.log("\nDone. Password for all: Links@2026");
