/**
 * Column-level edit access for the Bajaj ops workbooks.
 *
 * Policy is defined ONCE by FIELD NAME (not column letter) and applied to every
 * country tab — the tabs have different column counts and orders (Vipar 51,
 * Sri Lanka 54, SL parts 48, Nigeria has no owner banner at all), so matching by
 * header text is the only thing that holds across all of them.
 *
 * What --apply does, in order:
 *   1. deletes the staff-name banner row above the headers (it is documented in
 *      the "Column Access" tab instead — and an inserted row above the headers
 *      is exactly what silently broke the dashboard sync for three days)
 *   2. creates/refreshes a "Column Access" tab documenting who owns what
 *   3. locks the header row to the admins
 *   4. protects each role's columns so only that role (plus admins) can edit
 *
 * Usage (from the repo root):
 *   node scripts/protect-sheet-columns.mjs                # dry run: print the plan
 *   node scripts/protect-sheet-columns.mjs --apply        # do it
 *   node scripts/protect-sheet-columns.mjs --list         # show existing protections
 *   node scripts/protect-sheet-columns.mjs --clear        # remove protections this script made
 *   ... --sheet july|august|<id>   --tab Vipar   --keep-banner
 *
 * The service account (GOOGLE_SA_EMAIL) needs EDITOR access on the workbook for
 * this script only; the dashboard's sync client stays read-only.
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import path from "node:path";

// ── who ────────────────────────────────────────────────────────────────────

const P = {
  YOGESH:   "yogeshpednekar2326@gmail.com",
  YASH:     "yashjoshi98908@gmail.com",
  KARISHMA: "karishmaghag1999@gmail.com",
  SAGAR:    "pangamsagar@gmail.com",
  SUSHANT:  "sushantjadhav3112@gmail.com",
  JAYWANT:  "jaywantyesane4455@gmail.com",
  PRAMOD:   "khadepramod253@gmail.com",
};

/** Can edit everything, including the header row and the access tab. */
const ADMINS = [
  "nakultanna1@gmail.com",   // Nakul Tanna
  "pranavnairop090@gmail.com", // Pranav Nair
];

/**
 * Roles, applied identically to every country tab. Anyone with file access who
 * is not listed on a column cannot edit it — that includes the accounts with no
 * name against them in the sheet (deepak.bhura, Vishal Manjare, Yugandhar Naik),
 * who are read-only by design until the CEO says otherwise.
 */
const ROLES = {
  "Ops / Planning":  { who: ["YOGESH", "YASH"] },
  "Booking desk":    { who: ["YOGESH", "YASH", "KARISHMA"] },
  "Ops lead":        { who: ["YOGESH"] },
  "Documentation":   { who: ["SAGAR", "SUSHANT"] },
  "BL desk":         { who: ["SAGAR", "SUSHANT", "JAYWANT"] },
  "Yard / CFS":      { who: ["PRAMOD"] },
  "Everyone":        { who: null },   // no protection — open to all editors
};

/**
 * Canonical field → role. Keys are matched against the tab's header text after
 * normalising (upper-case, collapsed whitespace, punctuation stripped), so the
 * same policy lands on every tab regardless of column position or spelling drift.
 */
const FIELD_POLICY = {
  // Planning + commercial
  "WO": "Ops / Planning", "PORT": "Ops / Planning", "COUNTRY": "Ops / Planning",
  "VEH": "Ops / Planning", "QTY": "Ops / Planning", "CONT": "Ops / Planning",
  "TYPE": "Ops / Planning", "STUFFING DATE": "Ops / Planning",
  "AGENT": "Ops / Planning", "TRANSPORTER": "Ops / Planning", "PLANT": "Ops / Planning",
  "PO NO": "Ops / Planning", "LC NO": "Ops / Planning", "LC DATE": "Ops / Planning",
  "HAZ": "Ops / Planning", "CONSIGNEE": "Ops / Planning",
  "D O GIVEN DT": "Ops / Planning", "BOOKING NO": "Ops / Planning",
  "POL GATE": "Ops / Planning", "GATE OPEN": "Ops / Planning",
  "GATE CUT OFF": "Ops / Planning", "SI CUT OFF": "Ops / Planning",
  "DO ETD": "Ops / Planning", "CURRENT ETD": "Ops / Planning",
  "ETA AT DESTINATION": "Ops / Planning", "FINAL VSL SOB": "Ops / Planning",
  "BL DT": "Ops / Planning", "S LINE PAYMENT STATUS": "Ops / Planning",
  "CNTR DISPATCH": "Ops / Planning", "40 HC": "Ops / Planning", "STD20": "Ops / Planning",
  "ASSY CONFIG": "Ops / Planning", "FOR HBL": "Ops / Planning",

  // Vessel + line nomination
  "VSL NAME": "Booking desk", "S LINE": "Booking desk",

  // Ops lead only
  "CONTAINER NO": "Ops lead", "CLEARANCE POINT": "Ops lead",
  "OPEN ORDER": "Ops lead", "SB NO": "Ops lead", "SB DATE": "Ops lead",
  "BUFFER YARD": "Ops lead",

  // Documentation
  "VGM SUBMITTED": "Documentation", "SI SUBMITTED": "Documentation",
  "COURIER DT": "Documentation", "E DOC STATUS": "Documentation",

  // BL desk
  "BL NO": "BL desk", "BL HAND OVER TIME": "BL desk", "FF JOB": "BL desk",

  // Yard / CFS
  "PICK UP DT": "Yard / CFS", "CNTR REPORT NHAVA SHEVA": "Yard / CFS",
  "CNTR GATED IN PORT": "Yard / CFS",

  // Free for all
  "REMARK 1": "Everyone", "REMARK": "Everyone", "REMARKS": "Everyone",
};

/** Country tabs the policy applies to. Everything else (Price, DGD, KPI…) is untouched. */
const WORK_ORDER_TABS = [
  "vipar", "rk", "sri lanka", "sri lanka parts and frames", "sri lanka parts and frams",
  "bangladesh", "triumph", "nigeria",
];

const ACCESS_TAB = "Column Access";
const DESC = "bajaj-col-access";
const RW_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── plumbing ───────────────────────────────────────────────────────────────

function loadEnvLocal() {
  try {
    for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* none */ }
}

const b64url = (i) => Buffer.from(i).toString("base64url");
const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const normTab = (t) => norm(t).toLowerCase();
/** Header text → policy key: upper-case, punctuation dropped, spaces collapsed. */
const fieldKey = (v) => norm(v).toUpperCase().replace(/['".\/_-]/g, " ").replace(/\s+/g, " ").trim();

function colLetter(i) {
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function getToken() {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  if (!email || !key) throw new Error("GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY missing from .env.local");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: email, scope: RW_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function api(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await res.text();
  if (!res.ok) {
    if (res.status === 403) throw new Error(`403 — share the workbook with ${process.env.GOOGLE_SA_EMAIL} as EDITOR (it only has Viewer today). Raw: ${body.slice(0, 160)}`);
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : {};
}

const emailsFor = (role) => (ROLES[role]?.who ?? []).map((n) => P[n]).filter(Boolean);

/** Consecutive columns sharing a role collapse into one protected range. */
function blocksFor(headers) {
  const out = [];
  headers.forEach((h, i) => {
    const name = norm(h);
    if (!name) return;
    const role = FIELD_POLICY[fieldKey(name)] ?? null;
    const last = out[out.length - 1];
    if (last && last.role === role && last.end === i - 1) { last.end = i; last.fields.push(name); }
    else out.push({ role, start: i, end: i, fields: [name] });
  });
  return out;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

  const mode = has("--apply") ? "apply" : has("--clear") ? "clear" : has("--list") ? "list" : "dry";
  const onlyTab = val("--tab") ? normTab(val("--tab")) : null;
  const keepBanner = has("--keep-banner");

  const SHEETS = { july: process.env.BAJAJ_SHEET_ID, august: "1kyhxcIp4AzEQE1Tptioo-tgFpqgBCNeWbve01Kpq2RQ" };
  const sheetArg = val("--sheet");
  const targets = sheetArg ? [SHEETS[sheetArg] ?? sheetArg] : Object.values(SHEETS).filter(Boolean);

  const token = await getToken();
  const unmapped = new Set();
  let planned = 0;

  for (const id of targets) {
    const meta = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets(properties(sheetId,title,index),protectedRanges(protectedRangeId,description,range,editors))`);
    console.log(`\n📗 ${meta.properties?.title ?? id}`);

    if (mode === "list") {
      for (const sh of meta.sheets ?? []) {
        for (const pr of sh.protectedRanges ?? []) {
          const r = pr.range ?? {};
          const cols = r.startColumnIndex === undefined ? "whole sheet" : `${colLetter(r.startColumnIndex)}:${colLetter((r.endColumnIndex ?? 1) - 1)}`;
          console.log(`  ${sh.properties.title.padEnd(28)} ${cols.padEnd(12)} ${(pr.editors?.users ?? []).length} editor(s)  ${pr.description ?? ""}`);
        }
      }
      continue;
    }

    if (mode === "clear") {
      const requests = (meta.sheets ?? []).flatMap((sh) =>
        (sh.protectedRanges ?? []).filter((pr) => (pr.description ?? "").startsWith(DESC))
          .map((pr) => ({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } })));
      if (!requests.length) { console.log("  nothing this script created"); continue; }
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
      console.log(`  removed ${requests.length} protection(s)`);
      continue;
    }

    // Pass 1 — read every country tab, work out the plan.
    const plans = [];
    for (const sh of meta.sheets ?? []) {
      const title = sh.properties.title;
      if (!WORK_ORDER_TABS.includes(normTab(title))) continue;
      if (onlyTab && normTab(title) !== onlyTab) continue;

      const grid = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:CZ4`)}?majorDimension=ROWS`);
      const rows = grid.values ?? [];
      const headerIdx = rows.findIndex((r) => (r ?? []).some((c) => fieldKey(c) === "WO"));
      if (headerIdx < 0) { console.log(`  ⚠ ${title}: no WO header in the first rows — skipped`); continue; }

      const headers = rows[headerIdx] ?? [];
      const hasBanner = headerIdx > 0;
      const blocks = blocksFor(headers);
      for (const b of blocks) if (!b.role) b.fields.forEach((f) => unmapped.add(f));
      plans.push({ sh, title, headerIdx, hasBanner, headers, blocks });
    }

    // Pass 2 — banner removal first: it shifts every row up by one.
    const bannerReqs = [];
    if (!keepBanner) {
      for (const p of plans) {
        if (!p.hasBanner) continue;
        bannerReqs.push({ deleteDimension: { range: { sheetId: p.sh.properties.sheetId, dimension: "ROWS", startIndex: 0, endIndex: p.headerIdx } } });
        console.log(`  ${p.title}: remove ${p.headerIdx} banner row(s) → headers move to row 1`);
      }
    }
    if (mode === "apply" && bannerReqs.length) {
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: bannerReqs }) });
    }

    // Pass 3 — the access documentation tab.
    const existingAccess = (meta.sheets ?? []).find((s) => normTab(s.properties.title) === normTab(ACCESS_TAB));
    const matrix = [
      ["COLUMN ACCESS — who may edit what", "", ""],
      ["Applies to every country tab. Anyone not listed can read but not edit that column.", "", ""],
      ["", "", ""],
      ["ROLE", "PEOPLE", "COLUMNS THEY OWN"],
      ...Object.entries(ROLES).map(([role, def]) => [
        role,
        def.who ? def.who.map((n) => `${n} (${P[n]})`).join(", ") : "anyone with edit access",
        Object.entries(FIELD_POLICY).filter(([, r]) => r === role).map(([f]) => f).join(", ") || "—",
      ]),
      ["", "", ""],
      ["Admins", ADMINS.join(", "), "everything, incl. the header row and this tab"],
      ["Read-only", "anyone else with the link", "no edit rights on any protected column"],
      ["", "", ""],
      ["The header row is locked: inserting a row above it breaks the dashboard sync.", "", ""],
      [`Generated by scripts/protect-sheet-columns.mjs — ${new Date().toISOString().slice(0, 10)}`, "", ""],
    ];
    if (mode === "apply") {
      if (!existingAccess) {
        await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ACCESS_TAB, index: 0, gridProperties: { rowCount: 40, columnCount: 3 } } } }] }),
        });
      }
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`'${ACCESS_TAB}'!A1:C40`)}?valueInputOption=RAW`, {
        method: "PUT", body: JSON.stringify({ values: matrix }),
      });
      console.log(`  ${existingAccess ? "refreshed" : "created"} the "${ACCESS_TAB}" tab`);
    } else {
      console.log(`  would ${existingAccess ? "refresh" : "create"} the "${ACCESS_TAB}" tab (${matrix.length} rows)`);
    }

    // Pass 4 — protections. Row indexes account for the banner having been removed.
    const requests = [];
    for (const p of plans) {
      const shifted = keepBanner ? p.headerIdx : 0;           // header row index after the delete
      const firstDataRow = shifted + 1;
      console.log(`\n  ${p.title}`);

      const headerDesc = `${DESC}: header row`;
      if (!(p.sh.protectedRanges ?? []).some((pr) => pr.description === headerDesc)) {
        requests.push({ addProtectedRange: { protectedRange: {
          range: { sheetId: p.sh.properties.sheetId, startRowIndex: 0, endRowIndex: firstDataRow },
          description: headerDesc, warningOnly: false,
          editors: { users: ADMINS, domainUsersCanEdit: false },
        } } });
        planned++;
        console.log(`    row ${firstDataRow}        → ADMINS only (header row lock)`);
      }

      for (const b of p.blocks) {
        if (!b.role || b.role === "Everyone") continue;
        const users = [...new Set([...emailsFor(b.role), ...ADMINS])];
        if (!users.length) continue;
        const cols = b.start === b.end ? colLetter(b.start) : `${colLetter(b.start)}:${colLetter(b.end)}`;
        const desc = `${DESC}: ${b.role}`;
        const exists = (p.sh.protectedRanges ?? []).some((pr) => pr.description === desc && pr.range?.startColumnIndex === b.start && pr.range?.endColumnIndex === b.end + 1);
        if (exists) { console.log(`    ${cols.padEnd(9)} → ${b.role} (already protected)`); continue; }
        requests.push({ addProtectedRange: { protectedRange: {
          range: { sheetId: p.sh.properties.sheetId, startColumnIndex: b.start, endColumnIndex: b.end + 1, startRowIndex: firstDataRow },
          description: desc, warningOnly: false,
          editors: { users, domainUsersCanEdit: false },
        } } });
        planned++;
        console.log(`    ${cols.padEnd(9)} → ${b.role.padEnd(16)} ${b.fields.slice(0, 3).join(" / ")}${b.fields.length > 3 ? " …" : ""}`);
      }
      const open = p.blocks.filter((b) => b.role === "Everyone").flatMap((b) => b.fields);
      if (open.length) console.log(`    open to all: ${open.join(", ")}`);
    }

    if (mode === "apply" && requests.length) {
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
      console.log(`\n  ✅ applied ${requests.length} protection(s)`);
    }
  }

  if (unmapped.size) {
    console.log(`\n⚠ headers with no policy (left editable by everyone): ${[...unmapped].join(", ")}`);
    console.log("  add them to FIELD_POLICY if they should be restricted.");
  }
  if (mode === "dry") console.log(`\n(dry run — nothing changed. ${planned} protection(s) would be created. Re-run with --apply)`);
}

main().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
