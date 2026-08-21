/**
 * Plain-language AI diagnostic for the Google-Sheet sync.
 *
 * After a sync run we know exactly WHAT happened (rows, inserts, moves,
 * per-tab errors, missing work orders) but ops staff — who are expert in
 * shipping, not in software — cannot read that table and tell what they need
 * to fix in the workbook. explainSync() turns the raw result into a short,
 * actionable briefing: a headline, a status, and up to 6 issues each with a
 * likely cause and a concrete fix naming the workbook / tab / cell.
 *
 * Design rules:
 *   - NEVER throws and NEVER blocks a sync. No key, nothing worth explaining,
 *     API failure, bad JSON → returns null and the UI simply shows nothing.
 *   - The model gets a COMPACT facts payload, not the whole result. Big lists
 *     (missing WOs) are counted and sampled.
 *   - Anything that needs exact reasoning over lists (the duplicate-card
 *     signal) is computed HERE in code and handed to the model as a fact —
 *     the model narrates, it never has to spot patterns in raw data.
 */

import type { SheetSyncResult } from "@/lib/bajaj/sheet-sync";

const MODEL = process.env.OPENAI_SYNC_MODEL ?? "gpt-5-mini";
const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 5000;
const MAX_ISSUES = 6;
const SAMPLE_WOS = 25;

export interface SyncIssue {
  title: string;
  what_happened: string;
  likely_cause: string;
  how_to_fix: string;
  who_fixes: "ops team" | "admin";
  affected: string;
  severity: "high" | "medium" | "low";
}

export interface SyncExplanation {
  headline: string;
  status: "healthy" | "attention" | "problem";
  issues: SyncIssue[];
  all_good: string | null;
  /** Model that wrote it + when — shown as the "AI" provenance line. */
  model: string;
  generated_at: string;
}

/* ── Compact facts payload ──────────────────────────────────────────────── */

interface TabFacts {
  tab: string;
  board: string;
  rows: number;
  inserted: number;
  updated: number;
  moved: number;
  unchanged: number;
  violationCount: number;
  error?: string;
}

interface MonthFacts {
  month: string;
  label: string;
  error?: string;
  tabs: TabFacts[];
  bookings?: { tab: string; rows: number; previouslyStored: number; error?: string };
}

interface MissingFacts {
  board: string;
  month: string;
  count: number;
  sampleWorkOrders: string[];
}

interface SyncFacts {
  runType: "preview (nothing written)" | "real sync";
  totals: SheetSyncResult["totals"];
  months: MonthFacts[];
  missingFromSheet: MissingFacts[];
  duplicateSuspects: { board: string; month: string; wo: string }[];
  emptyTabs: { month: string; tab: string; board: string }[];
  violationSamples: string[];
}

function buildFacts(result: SheetSyncResult): SyncFacts {
  const months: MonthFacts[] = (result.months ?? []).map((m) => ({
    month: m.month,
    label: m.label,
    ...(m.error ? { error: m.error } : {}),
    tabs: m.tabs.map((t) => ({
      tab: t.tab,
      board: t.module,
      rows: t.rows,
      inserted: t.inserted,
      updated: t.updated,
      moved: t.moved,
      unchanged: t.unchanged,
      violationCount: t.violations.length,
      ...(t.error ? { error: t.error } : {}),
    })),
    ...(m.bookings
      ? {
          bookings: {
            tab: m.bookings.tab,
            rows: m.bookings.rows,
            previouslyStored: m.bookings.previous,
            ...(m.bookings.error ? { error: m.bookings.error } : {}),
          },
        }
      : {}),
  }));

  // Missing / unclaimed work orders, grouped per board + month.
  const missingMap = new Map<string, MissingFacts>();
  for (const u of result.unclaimedRows ?? []) {
    const key = `${u.module}|${u.month}`;
    let entry = missingMap.get(key);
    if (!entry) {
      entry = { board: u.module, month: u.month, count: 0, sampleWorkOrders: [] };
      missingMap.set(key, entry);
    }
    entry.count++;
    if (entry.sampleWorkOrders.length < SAMPLE_WOS && u.wo) entry.sampleWorkOrders.push(u.wo);
  }

  // DUPLICATE SIGNAL (computed here, never asked of the model): a WO that is
  // both touched by a sheet row AND reported missing for the same board+month
  // means two cards exist for one work order — the sheet row matched one of
  // them and orphaned its twin, which happens when a container or booking
  // number on that row changed at some point.
  const touched = new Map<string, Set<string>>(); // board|month → WOs seen in the sheet
  const missingWos = new Map<string, Set<string>>(); // board|month → WOs reported missing
  for (const t of result.tabs ?? []) {
    const key = `${t.module}|${t.month ?? ""}`;
    const seen = touched.get(key) ?? new Set<string>();
    for (const wo of [...t.wouldInsert, ...t.wouldUpdate]) {
      const v = wo.trim().toUpperCase();
      if (v) seen.add(v);
    }
    touched.set(key, seen);

    const miss = missingWos.get(key) ?? new Set<string>();
    for (const wo of t.missingFromSheet) {
      const v = wo.trim().toUpperCase();
      if (v) miss.add(v);
    }
    missingWos.set(key, miss);
  }
  const duplicateSuspects: SyncFacts["duplicateSuspects"] = [];
  for (const [key, miss] of missingWos) {
    const seen = touched.get(key);
    if (!seen) continue;
    const [board, month] = key.split("|");
    for (const wo of miss) {
      if (!seen.has(wo)) continue;
      if (duplicateSuspects.length >= SAMPLE_WOS) break;
      duplicateSuspects.push({ board, month, wo });
    }
  }

  // Tabs that came back with no rows and no error at all — nothing to import
  // and nothing complained, which is itself worth flagging.
  const emptyTabs = (result.tabs ?? [])
    .filter((t) => t.rows === 0 && !t.error)
    .map((t) => ({ month: t.month ?? "", tab: t.tab, board: t.module }));

  const violationSamples = (result.tabs ?? [])
    .flatMap((t) => t.violations.map((v) => `${t.month ?? ""} · ${t.tab}: ${v}`))
    .slice(0, 10);

  return {
    runType: result.dryRun ? "preview (nothing written)" : "real sync",
    totals: result.totals,
    months,
    missingFromSheet: [...missingMap.values()],
    duplicateSuspects,
    emptyTabs,
    violationSamples,
  };
}

/** Is there anything a person would actually need to know about? */
function worthExplaining(facts: SyncFacts): boolean {
  if (facts.months.some((m) => m.error)) return true;
  if (facts.months.some((m) => m.tabs.some((t) => t.error))) return true;
  if (facts.months.some((m) => m.bookings?.error)) return true;
  if (facts.missingFromSheet.length > 0) return true;
  if (facts.duplicateSuspects.length > 0) return true;
  if (facts.emptyTabs.length > 0) return true;
  if (facts.totals.violations > 0) return true;
  return false;
}

/* ── The prompt ─────────────────────────────────────────────────────────── */

export const SYNC_EXPLAIN_SYSTEM_PROMPT = `You explain Google-Sheet sync results to logistics operations staff at a freight forwarder. Your readers are experts in shipping, bookings, containers and vessels. They are NOT software people. They will read what you write and then go and fix something in a spreadsheet. Write for them.

HOW THIS SYSTEM WORKS (use this to reason about what the numbers mean; do not repeat it back)
- The operations team keeps one Google workbook per month. Several months are open at once because shipments finish at different times.
- Each workbook has tabs. The recognised tabs are Vipar, Sri Lanka, Sri Lanka parts and frames, Bangladesh, Nigeria and Triumph. Each one feeds the board of the same name.
- For each tab the sync looks for the header row — the row that has a "WO" column, searched in the first 8 rows of the tab — and treats every row below it as one work order.
- A card already on the board is matched to a row in the sheet by WO number first, then container number, then booking number. If the WO number, the container number and the booking number on a row all change, the card can no longer be matched to that row.
- Cards move FORWARD through ten stages on their own as the sheet gets filled in: Planning, Booking Request, Booking, Container Allocation, SI Filing, Custom Clearance, Gate Open, BL Release, Billing, Completed. Cards never move backwards and are never deleted.
- A card with no matching row in the sheet is reported as "missing from the sheet" and is left exactly as it is. Only an admin removes it, by archiving it.
- A tab whose header row has no "WO" column is skipped completely. Every row in that tab quietly fails to reach the board, and nobody is told unless we say so.

KNOWN CAUSES (name the likely one instead of being vague)
- Work orders missing from the sheet: the row was deleted after the shipment finished — this is the most common reason and is usually harmless; or the WO number was edited or given a suffix such as /L1 or /L2; or the row was moved to a different tab, or into another month's workbook.
- The same WO number both updated and missing at once: there are two cards for that one work order. The container number or the booking number on that row was changed at some point, which created a second card. The old twin should be archived.
- A tab skipped: the "WO" heading cell was typed over (we have seen it replaced with the word "sea"), or a row was inserted above the headings, or the tab was renamed or emptied.
- A tab that returned 0 rows with no error: the tab was cleared, or its shipments were moved into another month's workbook.
- Violations: a business rule was broken on that row, for example the Sri Lanka limit on containers per vessel. The row is still imported; it is only flagged so someone checks it.

HOW TO WRITE
- Plain English. Short sentences. No software words at all. Never use: sync engine, dedup, key, jsonb, payload, null, parse, API, schema, record, field, string, log.
- Say "the sheet", "the tab", "the board", "the card", "the WO number", "the heading row".
- Talk to the operations team directly: "someone changed…", "ask the team to…", "open the July workbook and…".
- Never invent a number. Every figure you write must appear exactly as given in the facts — if you cannot find it there, describe it in words instead of guessing ("most rows", not "709 rows").
- Never leave a part of an issue blank. Every issue needs its own steps in "how_to_fix"; if the fix is the same as another issue's, say so in words rather than leaving it empty.
- If you are not certain of the cause, say which one is most likely AND say what to check to confirm it.
- Every issue must end with something a person can actually do, naming the workbook (by its month label), the tab, and the cell or column where you know it.
- Do not report the same problem twice under two titles. Group it.

HOW SERIOUS IS IT (do not cry wolf — ops read this after every run)
- Work orders that are not reaching a board at all — a skipped tab, or a whole workbook that could not be read: "high", and the overall status is "problem".
- Work orders missing from the sheet, on their own, with every tab read successfully: "medium" at most, and the overall status is "attention". Most of them are simply finished shipments whose rows were tidied away. Say that plainly, and tell the team an admin can park those cards using the "Archive missing" button further down this page once they have checked the list.
- Two cards for one work order: "medium". The tidying up (archiving the twin) is done by an admin in the app, so "who_fixes" is "admin", while correcting the sheet row is for the ops team.
- Rows flagged by a business rule: "low" unless many rows are flagged. Those rows are already on the board.

EXAMPLE OF A GOOD ISSUE (match this tone and level of detail)
{
  "title": "60 work orders in July are not reaching the board",
  "what_happened": "The Sri Lanka parts and frames tab in the July workbook was skipped completely, so none of its rows reached the board.",
  "likely_cause": "The heading cell that should say WO was typed over — last time this happened someone had replaced it with the word \\"sea\\".",
  "how_to_fix": "Open the July workbook, go to the Sri Lanka parts and frames tab, and look at the heading row near the top. Put WO back in the heading cell above the work-order numbers, then run the sync again.",
  "who_fixes": "ops team",
  "affected": "July · Sri Lanka parts and frames · 60 rows",
  "severity": "high"
}

BEFORE YOU ANSWER, RE-READ YOUR OWN DRAFT AND CORRECT IT
1. Delete any sentence an operations person cannot act on.
2. Replace any word that is still technical with an everyday one.
3. Check every number you wrote appears in the facts you were given. Delete or reword any that does not.
4. Check no issue has an empty title, cause, fix, affected line or severity.
5. Put the most serious issue first.
Only output the corrected version.

OUTPUT
Reply with JSON only, exactly these keys:
{
  "headline": "one sentence saying what this sync did overall",
  "status": "healthy" | "attention" | "problem",
  "issues": [
    {
      "title": "short title, e.g. 60 work orders in July are not reaching the board",
      "what_happened": "one or two plain sentences",
      "likely_cause": "the most probable cause, named plainly",
      "how_to_fix": "concrete steps naming the workbook, tab and cell",
      "who_fixes": "ops team" | "admin",
      "affected": "e.g. July · Sri Lanka parts and frames · 60 rows",
      "severity": "high" | "medium" | "low"
    }
  ],
  "all_good": "one line about what IS working, or null"
}
At most ${MAX_ISSUES} issues, most serious first. Use "problem" when work orders are not reaching the boards at all, "attention" when something needs checking but the boards are up to date, "healthy" when nothing needs doing.`;

/* ── Model call ─────────────────────────────────────────────────────────── */

interface ChatBody {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  response_format: { type: "json_object" };
  max_completion_tokens: number;
  /** Keep the wording steady between runs — dropped for models that reject it. */
  temperature?: number;
  /** Short deliberation: this is a summarising job on facts we pre-computed. */
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
}

/** Remembered per process: some models only accept their default temperature. */
let temperatureAccepted = true;

async function callModel(body: ChatBody): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function coerceIssue(raw: unknown): SyncIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(o.title);
  const what = str(o.what_happened);
  if (!title || !what) return null;
  const who = str(o.who_fixes) === "admin" ? "admin" : "ops team";
  const sevRaw = str(o.severity).toLowerCase();
  const severity: SyncIssue["severity"] =
    sevRaw === "high" || sevRaw === "low" ? sevRaw : "medium";
  return {
    title,
    what_happened: what,
    likely_cause: str(o.likely_cause),
    how_to_fix: str(o.how_to_fix),
    who_fixes: who,
    affected: str(o.affected),
    severity,
  };
}

const SEVERITY_RANK: Record<SyncIssue["severity"], number> = { high: 0, medium: 1, low: 2 };

/**
 * Turn a sync result into a plain-language briefing.
 * Returns null (never throws) when there is no key, nothing worth explaining,
 * or the model call fails in any way.
 */
export async function explainSync(result: SheetSyncResult): Promise<SyncExplanation | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null;
    if (!result.ok) return null;

    const facts = buildFacts(result);
    if (!worthExplaining(facts)) return null;

    const body: ChatBody = {
      model: MODEL,
      messages: [
        { role: "system", content: SYNC_EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(facts) },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: MAX_TOKENS,
      reasoning_effort: "low",
      ...(temperatureAccepted ? { temperature: 0.2 } : {}),
    };

    let res = await callModel(body);
    if (res.status === 400 && temperatureAccepted) {
      // Some models only accept their default temperature — retry without it
      // rather than losing the explanation, and remember for next time.
      const detail = (await res.text()).slice(0, 300);
      if (!detail.toLowerCase().includes("temperature")) {
        console.error("[sync-explain] model error", res.status, detail);
        return null;
      }
      temperatureAccepted = false;
      const { temperature: _omit, ...rest } = body;
      void _omit;
      res = await callModel(rest as ChatBody);
    }
    if (!res.ok) {
      console.error("[sync-explain] model error", res.status, (await res.text()).slice(0, 300));
      return null;
    }

    const json = (await res.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const choice = json.choices?.[0];
    if (choice?.finish_reason === "length") {
      console.error("[sync-explain] answer cut short by the token cap");
    }
    const content = choice?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    if (!headline) return null;

    const statusRaw = typeof parsed.status === "string" ? parsed.status.trim().toLowerCase() : "";
    const status: SyncExplanation["status"] =
      statusRaw === "problem" || statusRaw === "healthy" ? statusRaw : "attention";

    const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
      .map(coerceIssue)
      .filter((i): i is SyncIssue => i !== null)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .slice(0, MAX_ISSUES);

    const allGood =
      typeof parsed.all_good === "string" && parsed.all_good.trim() ? parsed.all_good.trim() : null;

    return { headline, status, issues, all_good: allGood, model: MODEL, generated_at: new Date().toISOString() };
  } catch (err) {
    console.error("[sync-explain] failed", err);
    return null;
  }
}
