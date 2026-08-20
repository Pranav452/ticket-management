/**
 * Apply column-level edit protection to the Bajaj ops workbooks.
 *
 * Each tab carries a banner row above the headers naming who owns each column
 * (e.g. "YOGESH YASH", "SAGAR SUSHANT JAYWANT", "PRAMOD"). This script reads
 * that banner, groups consecutive columns with the same owner set, and creates
 * Google Sheets protected ranges so only those people can edit their columns.
 *
 * The header rows themselves are always locked to the admins — an inserted row
 * above the headers is what silently broke the sync for three days in Aug 2026.
 *
 * Usage (from the repo root):
 *   node scripts/protect-sheet-columns.mjs                 # dry run: print the plan
 *   node scripts/protect-sheet-columns.mjs --apply         # create the protections
 *   node scripts/protect-sheet-columns.mjs --list          # show existing protections
 *   node scripts/protect-sheet-columns.mjs --clear         # remove protections this script made
 *   ... --sheet july|august|<spreadsheetId>   --tab Vipar  # narrow the scope
 *   ... --all-columns    # also protect the majority-owner columns (default: handoff columns only)
 *
 * Requirements:
 *   - PEOPLE below filled in with real Google account emails
 *   - the service account (GOOGLE_SA_EMAIL) must have EDITOR access on the workbook
 *     (it only needs Viewer for the dashboard sync — this is the one exception)
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import path from "node:path";

// ── config ─────────────────────────────────────────────────────────────────

/** Banner name → Google account email. Fill these in before --apply. */
const PEOPLE = {
  YOGESH:   "",
  YASH:     "",
  KARISHMA: "",
  SAGAR:    "",
  SUSHANT:  "",
  JAYWANT:  "",
  PRAMOD:   "",
};

/** Always able to edit everything, including the header rows. */
const ADMINS = [
  // "nakul.tanna@linksin.com",
  // "you@linksin.com",
];

/** Marks a column as open to everyone (no protection). */
const OPEN_TOKENS = new Set(["ALL", "EVERYONE", "OPEN"]);

/** Tabs that hold work orders (others — Price, DGD, KPI — are left alone). */
const WORK_ORDER_TABS = [
  "vipar", "sri lanka", "sri lanka parts and frames", "sri lanka parts and frams",
  "bangladesh", "triumph", "nigeria",
];

const DESCRIPTION_PREFIX = "bajaj-col-access";
const RW_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── env ────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  try {
    const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* no .env.local */ }
}

const b64url = (input) => Buffer.from(input).toString("base64url");

/** Read-write access token — deliberately separate from the app's read-only client. */
async function getToken() {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  if (!email || !key) throw new Error("GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY missing from .env.local");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: email, scope: RW_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function api(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `403 from Sheets API. The service account needs EDITOR access on this workbook ` +
        `(share it with ${process.env.GOOGLE_SA_EMAIL} as Editor). Raw: ${body.slice(0, 200)}`,
      );
    }
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : {};
}

// ── helpers ────────────────────────────────────────────────────────────────

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const normTab = (t) => norm(t).toLowerCase();

function colLetter(i) {
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** "YOGESH YASH" → sorted key + email list. Unknown names are reported, never silently dropped. */
function ownersOf(cell, unknown) {
  const names = norm(cell).toUpperCase().replace(/PPRAMOD/g, "PRAMOD").split(/[\s,/]+/).filter(Boolean);
  if (names.length === 0) return null;
  if (names.some((n) => OPEN_TOKENS.has(n))) return { key: "ALL", names: ["ALL"], emails: null };
  const emails = [];
  for (const n of names) {
    const email = PEOPLE[n];
    if (!email) { unknown.add(n); continue; }
    emails.push(email);
  }
  if (emails.length === 0) return null;
  return { key: [...names].sort().join("+"), names, emails };
}

/** Consecutive columns sharing an owner set collapse into one protected range. */
function blocksFrom(banner, headers, unknown) {
  const blocks = [];
  const width = Math.max(banner.length, headers.length);
  for (let i = 0; i < width; i++) {
    if (!norm(headers[i])) continue;
    const owners = ownersOf(banner[i], unknown);
    const key = owners?.key ?? "(none)";
    const last = blocks[blocks.length - 1];
    if (last && last.key === key && last.end === i - 1) { last.end = i; last.headers.push(norm(headers[i])); }
    else blocks.push({ key, owners, start: i, end: i, headers: [norm(headers[i])] });
  }
  return blocks;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

  const mode = has("--apply") ? "apply" : has("--clear") ? "clear" : has("--list") ? "list" : "dry";
  const onlyTab = val("--tab") ? normTab(val("--tab")) : null;
  const allColumns = has("--all-columns");

  const SHEETS = {
    july: process.env.BAJAJ_SHEET_ID,
    august: "1kyhxcIp4AzEQE1Tptioo-tgFpqgBCNeWbve01Kpq2RQ",
  };
  const sheetArg = val("--sheet");
  const targets = sheetArg
    ? [SHEETS[sheetArg] ?? sheetArg]
    : Object.values(SHEETS).filter(Boolean);

  const token = await getToken();
  const unknown = new Set();
  let planned = 0;

  for (const spreadsheetId of targets) {
    const meta = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description,range,editors))`);
    console.log(`\n📗 ${meta.properties?.title ?? spreadsheetId}`);

    if (mode === "list") {
      for (const sh of meta.sheets ?? []) {
        const prs = sh.protectedRanges ?? [];
        if (prs.length === 0) continue;
        console.log(`  ${sh.properties.title}`);
        for (const pr of prs) {
          const r = pr.range ?? {};
          const cols = r.startColumnIndex === undefined ? "whole sheet" : `${colLetter(r.startColumnIndex)}:${colLetter((r.endColumnIndex ?? 1) - 1)}`;
          const rows = r.startRowIndex === undefined ? "" : ` rows ${r.startRowIndex + 1}-${r.endRowIndex}`;
          console.log(`    #${pr.protectedRangeId} ${cols}${rows} — ${(pr.editors?.users ?? []).join(", ") || "(owner only)"} — ${pr.description ?? ""}`);
        }
      }
      continue;
    }

    if (mode === "clear") {
      const requests = [];
      for (const sh of meta.sheets ?? []) {
        for (const pr of sh.protectedRanges ?? []) {
          if ((pr.description ?? "").startsWith(DESCRIPTION_PREFIX)) {
            requests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
          }
        }
      }
      if (requests.length === 0) { console.log("  nothing to clear (only protections made by this script are removed)"); continue; }
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST", body: JSON.stringify({ requests }),
      });
      console.log(`  removed ${requests.length} protection(s)`);
      continue;
    }

    const requests = [];

    for (const sh of meta.sheets ?? []) {
      const title = sh.properties.title;
      if (!WORK_ORDER_TABS.includes(normTab(title))) continue;
      if (onlyTab && normTab(title) !== onlyTab) continue;

      const grid = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:BZ3`)}?majorDimension=ROWS`);
      const rows = grid.values ?? [];
      // Find the header row (the one containing WO) — the banner sits above it.
      let headerIdx = rows.findIndex((r) => (r ?? []).some((c) => norm(c).toUpperCase() === "WO"));
      if (headerIdx < 0) { console.log(`  ⚠ ${title}: no WO header in the first 3 rows — skipped`); continue; }
      const headers = rows[headerIdx] ?? [];
      const banner = headerIdx > 0 ? (rows[headerIdx - 1] ?? []) : [];

      console.log(`\n  ${title}  (headers on row ${headerIdx + 1}${banner.length ? ", banner above" : ", no banner"})`);

      // 1. Header rows — admins only. This is the rule that protects the sync.
      const headerDesc = `${DESCRIPTION_PREFIX}: header rows`;
      const already = (sh.protectedRanges ?? []).some((pr) => pr.description === headerDesc);
      if (!already) {
        requests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId: sh.properties.sheetId, startRowIndex: 0, endRowIndex: headerIdx + 1 },
              description: headerDesc,
              warningOnly: false,
              editors: { users: ADMINS, domainUsersCanEdit: false },
            },
          },
        });
        planned++;
        console.log(`    rows 1-${headerIdx + 1}  → ADMINS only  (locks the header row)`);
      }

      if (banner.length === 0) continue;

      const blocks = blocksFrom(banner, headers, unknown);
      // Columns owned by the largest group stay open to the whole ops team unless
      // --all-columns is passed: protecting them adds rules without adding safety.
      const tally = new Map();
      for (const b of blocks) if (b.owners && b.key !== "ALL") tally.set(b.key, (tally.get(b.key) ?? 0) + (b.end - b.start + 1));
      const majority = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      for (const b of blocks) {
        if (!b.owners || b.key === "ALL") continue;
        if (!allColumns && b.key === majority) continue;
        const desc = `${DESCRIPTION_PREFIX}: ${b.owners.names.join("+")}`;
        const exists = (sh.protectedRanges ?? []).some(
          (pr) => pr.description === desc && pr.range?.startColumnIndex === b.start && pr.range?.endColumnIndex === b.end + 1,
        );
        const cols = b.start === b.end ? colLetter(b.start) : `${colLetter(b.start)}:${colLetter(b.end)}`;
        if (exists) { console.log(`    ${cols.padEnd(7)} → ${b.owners.names.join(", ")}  (already protected)`); continue; }
        requests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId: sh.properties.sheetId, startColumnIndex: b.start, endColumnIndex: b.end + 1, startRowIndex: headerIdx + 1 },
              description: desc,
              warningOnly: false,
              editors: { users: [...new Set([...b.owners.emails, ...ADMINS])], domainUsersCanEdit: false },
            },
          },
        });
        planned++;
        console.log(`    ${cols.padEnd(7)} → ${b.owners.names.join(", ").padEnd(26)} ${b.headers.slice(0, 3).join(" / ")}${b.headers.length > 3 ? " …" : ""}`);
      }
      const open = blocks.filter((b) => b.key === "ALL").flatMap((b) => b.headers);
      const unowned = blocks.filter((b) => !b.owners).flatMap((b) => b.headers);
      if (open.length) console.log(`    open to all: ${open.join(", ")}`);
      if (unowned.length) console.log(`    ⚠ no owner in banner (left unprotected): ${unowned.join(", ")}`);
      if (majority && !allColumns) console.log(`    left open for the ops team (${majority.split("+").join(", ")}) — pass --all-columns to lock these too`);
    }

    if (mode === "apply" && requests.length > 0) {
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST", body: JSON.stringify({ requests }),
      });
      console.log(`\n  ✅ applied ${requests.length} protection(s)`);
    }
  }

  if (unknown.size > 0) {
    console.log(`\n⚠ names in the banner with no email in PEOPLE: ${[...unknown].join(", ")}`);
    console.log("  add them to the PEOPLE map at the top of this script — their columns were skipped.");
  }
  if (mode === "dry") {
    console.log(`\n(dry run — nothing changed. ${planned} protection(s) would be created. Re-run with --apply)`);
  }
}

main().catch((err) => { console.error("\n❌", err.message); process.exit(1); });
