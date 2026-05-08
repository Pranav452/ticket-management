"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, CheckCircle, AlertCircle, Loader2, X,
  ClipboardPaste, FileSpreadsheet, ChevronRight,
} from "lucide-react";
import { ManualWorkOrderForm } from "@/components/bajaj/ManualWorkOrderForm";
import { cn } from "@/lib/utils";

const MODULES = [
  { slug: "vipar",      name: "VIPAR",      flag: "🌏" },
  { slug: "srilanka",   name: "Sri Lanka",  flag: "🇱🇰" },
  { slug: "nigeria",    name: "Nigeria",    flag: "🇳🇬" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🇧🇩" },
  { slug: "triumph",    name: "Triumph",    flag: "🇬🇧" },
];

// ── Dispatch-plan email column headers → DB column names ──────────────────
const EMAIL_COL_MAP: Record<string, string> = {
  "cha":                       "CHA",
  "wo no":                     "WO",
  "wo":                        "WO",
  "work order":                "WO",
  "country":                   "country",
  "plant":                     "Plant",
  "brand":                     "Brand",
  "variant":                   "Variant",
  "qty":                       "QTY",
  "40 hc":                     "40HC",
  "40hc":                      "40HC",
  "std 20":                    "STD20",
  "std20":                     "STD20",
  "plant ready / dispatch date":"WODT",
  "plant ready":               "WODT",
  "lsd":                       "SAILINGDT",
  "assy config":                "AssyConfig",
  "port (wo/pod)":             "port",
  "port":                      "port",
  "quotation no/ref":          "bookingno",
  "quotation no":              "bookingno",
  "po no":                     "SBNO",
  "po":                        "SBNO",
  "plan-add/rvsd":             "PLAN_STATUS",
  "ib plan-zord":              "BLDT",
};

// Headers that are genuinely split across 2 lines when copying an HTML email table.
// "Port (WO/POD)" always arrives as a single line so it is NOT listed here.
const SPLIT_HEADER_JOINS: string[] = [
  "plant ready / dispatch date",
];

function parseEmailTable(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  rawHeaders: string[];
} {
  // ── Format detection ───────────────────────────────────────────────────────
  // Case 1: Tab-separated (copy from Excel or Outlook table copy with tabs)
  // Case 2: One cell per line (copy from HTML email in most mail clients —
  //         blank cells become empty lines, split headers become 2 lines)

  const allLines = text.split(/\r?\n/).map((l) => l.trim());
  const hasTab   = allLines[0]?.includes("\t");

  if (hasTab) {
    // ── TAB-SEPARATED ────────────────────────────────────────────────────────
    const lines = allLines.filter(Boolean);
    if (lines.length < 2) return { headers: [], rows: [], rawHeaders: [] };

    const sep        = "\t";
    const rawHeaders = lines[0].split(sep).map((h) => h.trim().replace(/\s+/g, " "));
    const mappedHeaders = rawHeaders.map((h) => EMAIL_COL_MAP[h.toLowerCase()] ?? h);

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim());
      if (cols.length < 2) continue;
      const row: Record<string, string> = {};
      mappedHeaders.forEach((header, idx) => { row[header] = cols[idx] ?? ""; });
      if (!row["WO"]) continue;
      rows.push(row);
    }
    return { headers: mappedHeaders, rows, rawHeaders };
  }

  // ── ONE-CELL-PER-LINE (email HTML table copy) ─────────────────────────────
  // Keep blank lines so empty cells preserve column alignment.
  // First step: merge split headers like "Plant Ready /" + "Dispatch Date"
  const merged: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const cur  = allLines[i].trim();
    const next = (allLines[i + 1] ?? "").trim();
    // Detect a line that is the first half of a known split header
    const combined = (cur + " " + next).toLowerCase().replace(/\s+/g, " ");
    const isSplit  = SPLIT_HEADER_JOINS.some((h) => combined.startsWith(h));
    if (isSplit) {
      merged.push(cur + " " + next); // merge the two lines
      i++; // skip next
    } else {
      merged.push(cur);
    }
  }

  // Determine column count: the header row is the first row.
  // Known column count for the Bajaj dispatch plan = 17.
  // Detect by finding the "CHA" cell and counting until a cell that looks like
  // a CHA value (LINKS/BHATIA/SHARP) appears again.
  const KNOWN_CHA_VALUES = ["LINKS", "BHATIA", "SHARP", "VSP"];
  let colCount   = 0;
  let headerStart = -1;

  for (let i = 0; i < merged.length; i++) {
    if (merged[i].toUpperCase() === "CHA") { headerStart = i; break; }
  }
  if (headerStart === -1) return { headers: [], rows: [], rawHeaders: [] };

  // Count cells until we hit the first data cell (a CHA value)
  for (let i = headerStart + 1; i < merged.length; i++) {
    if (KNOWN_CHA_VALUES.includes(merged[i].toUpperCase())) {
      colCount = i - headerStart;
      break;
    }
  }
  if (colCount === 0) colCount = 17; // fallback

  // Extract headers
  const rawHeaders: string[] = [];
  for (let i = headerStart; i < headerStart + colCount; i++) {
    rawHeaders.push((merged[i] ?? "").replace(/\s+/g, " "));
  }
  const mappedHeaders = rawHeaders.map((h) => EMAIL_COL_MAP[h.toLowerCase()] ?? h);

  // Extract data rows (groups of colCount cells starting after headers)
  const dataStart = headerStart + colCount;
  const rows: Record<string, string>[] = [];

  for (let i = dataStart; i + colCount <= merged.length; i += colCount) {
    const cells = merged.slice(i, i + colCount).map((c) => c);
    const row: Record<string, string> = {};
    mappedHeaders.forEach((header, idx) => { row[header] = cells[idx] ?? ""; });
    if (!row["WO"] || row["WO"].trim() === "") continue;
    rows.push(row);
  }

  return { headers: mappedHeaders, rows, rawHeaders };
}

interface ImportDropzoneProps {
  defaultModule?: string;
  userId: string;
}

type Mode = "paste" | "excel" | "manual";
type Step = "idle" | "preview" | "importing" | "done" | "error";

export function ImportDropzone({ defaultModule, userId: _userId }: ImportDropzoneProps) {
  const [mode,       setMode]       = useState<Mode>("paste");
  const [moduleSlug, setModuleSlug] = useState(defaultModule ?? "vipar");

  // Paste mode state
  const [pasteText,    setPasteText]    = useState("");
  const [pastePreview, setPastePreview] = useState<{ headers: string[]; rows: Record<string, string>[]; rawHeaders: string[] } | null>(null);
  const [filterCHA,    setFilterCHA]    = useState(true);

  // Excel mode state
  const [file,   setFile]   = useState<File | null>(null);

  // Shared
  const [step,    setStep]    = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result,   setResult]   = useState<{ added: number; skipped: number } | null>(null);

  // ── Excel dropzone ───────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setStep("importing");
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("file", f);
    fd.append("moduleSlug", moduleSlug);

    try {
      const res  = await fetch("/api/bajaj/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult({ added: data.addedCount, skipped: data.skippedCount });
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed");
      setStep("error");
    }
  }, [moduleSlug]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: step !== "idle",
  });

  // ── Paste preview ────────────────────────────────────────────────────────
  function handlePasteParse() {
    if (!pasteText.trim()) return;
    const parsed = parseEmailTable(pasteText);
    setPastePreview(parsed);
    setStep("preview");
  }

  function getPasteRows() {
    if (!pastePreview) return [];
    if (!filterCHA) return pastePreview.rows;
    // Filter to rows where CHA = "LINKS" (our company)
    return pastePreview.rows.filter(
      (r) => !r["CHA"] || r["CHA"].toUpperCase() === "LINKS"
    );
  }

  async function handlePasteImport() {
    const rows = getPasteRows();
    if (!rows.length) return;
    setStep("importing");
    setErrorMsg(null);

    let added = 0;
    let skipped = 0;

    try {
      for (const row of rows) {
        const body = {
          FFJOBNO:    row["bookingno"]  ?? "",
          WO:         row["WO"]         ?? "",
          WODT:       row["WODT"]       ?? "",
          port:       row["port"]       ?? "",
          country:    row["country"]    ?? "",
          bookingno:  row["bookingno"]  ?? "",
          SBNO:       row["SBNO"]       ?? "",
          SBDT:       "",
          BLNO:       "",
          BLDT:       row["BLDT"]       ?? "",
          containerno:"",
          vslname:    "",
          SAILINGDT:  row["SAILINGDT"]  ?? "",
          REMARK:     [
            row["Brand"] ? `Brand: ${row["Brand"]}` : "",
            row["Variant"] ? `Variant: ${row["Variant"]}` : "",
            row["AssyConfig"] ? `Assy: ${row["AssyConfig"]}` : "",
            row["QTY"] ? `Qty: ${row["QTY"]}` : "",
            row["40HC"] ? `40HC: ${row["40HC"]}` : "",
            row["PLAN_STATUS"] ? `Plan: ${row["PLAN_STATUS"]}` : "",
          ].filter(Boolean).join(" | "),
        };

        const res  = await fetch("/api/bajaj/work-orders/paste", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...body, moduleSlug }),
        });

        const data = await res.json();
        if (data.skipped) skipped++;
        else added++;
      }

      setResult({ added, skipped });
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setFile(null);
    setPasteText("");
    setPastePreview(null);
    setErrorMsg(null);
    setResult(null);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Loader2 className="size-10 text-amber-500 animate-spin" />
        <p className="text-neutral-300 text-sm font-medium">Importing work orders…</p>
        {file && <p className="text-[13px] text-neutral-600">{file.name}</p>}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-red-500" />
        <p className="text-neutral-200 font-medium">Import failed</p>
        <p className="text-[13px] text-red-400 bg-red-950/30 rounded-lg px-4 py-2 max-w-sm">{errorMsg}</p>
        <button onClick={reset} className="text-[13px] text-neutral-500 hover:text-amber-400 underline transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <CheckCircle className="size-14 text-amber-500" />
        <div>
          <h3 className="text-xl font-bold text-neutral-100">Import Complete</h3>
          <p className="text-[13px] text-neutral-500 mt-1">Work orders are now on the board</p>
        </div>
        <div className="flex gap-10 mt-2">
          <div>
            <p className="text-3xl font-bold text-amber-400 tabular-nums">{result.added}</p>
            <p className="text-[12px] text-neutral-500 mt-1">Added</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-neutral-600 tabular-nums">{result.skipped}</p>
            <p className="text-[12px] text-neutral-500 mt-1">Skipped (duplicate)</p>
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          <a
            href={`/bajaj/boards/${moduleSlug}`}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            View Board <ChevronRight className="size-4" />
          </a>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-neutral-900 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
          >
            Import More
          </button>
        </div>
      </div>
    );
  }

  // ── Paste preview (step === "preview") ───────────────────────────────────
  if (step === "preview" && pastePreview) {
    const rows = getPasteRows();
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              Preview — {pastePreview.rows.length} rows parsed
            </h3>
            <p className="text-[13px] text-neutral-500 mt-0.5">
              {filterCHA
                ? `Showing ${rows.length} LINKS rows only.`
                : `Showing all ${rows.length} rows (all CHAs).`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterCHA}
                onChange={(e) => setFilterCHA(e.target.checked)}
                className="accent-amber-500"
              />
              <span className="text-[13px] text-neutral-400">LINKS rows only</span>
            </label>
            <button onClick={reset} className="text-neutral-600 hover:text-neutral-300 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No LINKS rows found in the pasted data.</p>
            <button
              onClick={() => setFilterCHA(false)}
              className="mt-3 text-[13px] text-amber-500 hover:text-amber-400 underline"
            >
              Show all CHAs
            </button>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-neutral-800 max-h-80">
            <table className="text-[12px] min-w-full">
              <thead className="bg-neutral-900 border-b border-neutral-800 sticky top-0">
                <tr>
                  {pastePreview.headers.filter(h => h !== "CHA").map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-neutral-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={cn(
                    "border-b border-neutral-800/50",
                    i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/30"
                  )}>
                    {pastePreview.headers.filter(h => h !== "CHA").map((h) => (
                      <td key={h} className="px-3 py-1.5 text-neutral-300 whitespace-nowrap max-w-[140px] truncate">
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handlePasteImport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            <Upload className="size-4" />
            Import {rows.length} Rows
          </button>
          <button
            onClick={reset}
            className="px-4 py-2.5 rounded-lg bg-neutral-900 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Idle: mode selector ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Module selector */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-neutral-600 font-semibold mb-2">
          Target Module
        </p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button
              key={m.slug}
              onClick={() => setModuleSlug(m.slug)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
                m.slug === moduleSlug
                  ? "bg-amber-600/15 text-amber-300 border-amber-700/40"
                  : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
              )}
            >
              <span className="text-sm">{m.flag}</span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-neutral-800">
        {[
          { id: "paste",  label: "Paste from Email",  icon: ClipboardPaste },
          { id: "excel",  label: "Upload Excel",       icon: FileSpreadsheet },
          { id: "manual", label: "Manual Entry",       icon: Upload },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id as Mode)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px",
              mode === id
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PASTE MODE ───────────────────────────────────────────────────── */}
      {mode === "paste" && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 px-4 py-3">
            <p className="text-[13px] font-semibold text-amber-300 mb-1">
              📧 How to import from the Bajaj dispatch email
            </p>
            <ol className="text-[12px] text-neutral-400 space-y-1 list-decimal list-inside">
              <li>Open the dispatch plan email from Somandra / Bajaj Auto IB Logistics</li>
              <li>Select all rows in the table (Ctrl+A inside the table)</li>
              <li>Copy (Ctrl+C) and paste below</li>
              <li>We&apos;ll auto-filter LINKS rows and parse CHA, WO NO, COUNTRY, LSD, Port etc.</li>
            </ol>
          </div>

          <div>
            <label className="block text-[12px] text-neutral-500 mb-2 uppercase tracking-wider font-semibold">
              Paste dispatch plan table here
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`CHA\tWO NO\tCOUNTRY\tPlant\tBrand\tVariant\tQTY\t40 HC\tSTD 20\tPlant Ready / Dispatch Date\tLSD\tAssy Config\tPort (WO/POD)\tQuotation No/Ref\tPO NO\tPLAN-ADD/RVSD\tIB Plan-ZORD\nLINKS\t5584880\tBangladesh\tWA01\tDISCOVER\t125 DI\t0\t2\t\t\t12-Jun\tPLP\tCHATTOGRAM\t5233061\t5233061\tRVSD\t18-Apr`}
              rows={10}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 focus:border-amber-600 focus:outline-none font-mono resize-y transition-colors"
            />
          </div>

          <button
            onClick={handlePasteParse}
            disabled={!pasteText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            <ClipboardPaste className="size-4" />
            Parse Table
          </button>
        </div>
      )}

      {/* ── EXCEL MODE ───────────────────────────────────────────────────── */}
      {mode === "excel" && (
        <div className="max-w-xl">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-2xl px-10 py-16 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-amber-600 bg-amber-950/10"
                : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50"
            )}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className={cn("size-10 mx-auto mb-4", isDragActive ? "text-amber-500" : "text-neutral-700")} />
            <p className="text-neutral-300 font-medium mb-1">
              {isDragActive ? "Drop it here…" : "Drag & drop your Excel file"}
            </p>
            <p className="text-[12px] text-neutral-600 mb-4">Accepts .xlsx files</p>
            <span className="inline-block px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-[13px] text-neutral-400 hover:text-neutral-200 transition-colors">
              Browse file
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
            <p className="text-[12px] text-neutral-500">
              <span className="text-neutral-300 font-medium">Expected columns:</span>{" "}
              FFJOBNO / WO, COUNTRY, port, bookingno, SBNO, BLNO, containerno, vslname, SAILINGDT, REMARK
            </p>
          </div>
        </div>
      )}

      {/* ── MANUAL MODE ──────────────────────────────────────────────────── */}
      {mode === "manual" && (
        <ManualWorkOrderForm moduleSlug={moduleSlug} />
      )}
    </div>
  );
}
