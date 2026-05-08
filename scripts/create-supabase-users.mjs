/**
 * Creates test Supabase auth users via the REST signUp endpoint.
 * Run with: node scripts/create-supabase-users.mjs
 */

const SUPABASE_URL = "https://scjldsyvikxsbefhzrua.supabase.co";
const ANON_KEY     = "sb_publishable_NneawjlDn9aEx-K3o649wg_tmApz13H";
const PASSWORD     = "Links@2026";

const USERS = [
  { email: "superadmin@links.com", full_name: "Super Admin" },
  { email: "admin@links.com",      full_name: "Admin" },
  { email: "ops@links.com",        full_name: "Ops Operator" },
  { email: "docs@links.com",       full_name: "Docs Operator" },
  { email: "viewer@links.com",     full_name: "Viewer" },
];

for (const user of USERS) {
  console.log(`Creating: ${user.email} ...`);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "apikey":       ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:    user.email,
        password: PASSWORD,
        data:     { full_name: user.full_name },
      }),
    });

    const data = await res.json();

    if (data.id || data.user?.id) {
      console.log(`  ✓ Created / already exists: ${user.email}`);
    } else if (data.error || data.msg) {
      console.log(`  ! ${user.email}: ${data.error ?? data.msg}`);
    } else {
      console.log(`  ? ${user.email}: status ${res.status}`, JSON.stringify(data).slice(0, 120));
    }
  } catch (err) {
    console.error(`  ✗ ${user.email}:`, err.message);
  }
}

console.log("\nDone.");
