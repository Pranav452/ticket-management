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
// Maps to exact bajaj_work_orders column names. Unknown headers are dropped.
const EMAIL_COL_MAP: Record<string, string> = {
  "cha":                        "agent",
  "wo no":                      "wo",
  "wo":                         "wo",
  "work order":                 "wo",
  "country":                    "country",
  "plant":                      "plant",
  "brand":                      "veh",
  "variant":                    "type",
  "qty":                        "qty",
  "40 hc":                      "cont",
  "40hc":                       "cont",
  "port (wo/pod)":              "port",
  "port":                       "port",
  "quotation no/ref":           "lc_no",
  "quotation no":               "lc_no",
  "po no":                      "po_no",
  "plant ready / dispatch date":"do_given_dt",
  "plant ready":                "do_given_dt",
  // std 20, lsd, assy config, plan-add/rvsd, ib plan-zord → no DB column, dropped
};

const SPLIT_HEADER_JOINS: string[] = [
  "plant ready / dispatch date",
];

function parseEmailTable(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  rawHeaders: string[];
} {
  const allLines = text.split(/\r?\n/).map((l) => l.trim());
  const hasTab   = allLines[0]?.includes("\t");

  if (hasTab) {
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
      if (!row["wo"] || !/^\d+/.test(row["wo"].trim())) continue;
      rows.push(row);
    }
    return { headers: mappedHeaders, rows, rawHeaders };
  }

  const merged: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const cur  = allLines[i].trim();
    const next = (allLines[i + 1] ?? "").trim();
    const combined = (cur + " " + next).toLowerCase().replace(/\s+/g, " ");
    const isSplit  = SPLIT_HEADER_JOINS.some((h) => combined.startsWith(h));
    if (isSplit) {
      merged.push(cur + " " + next);
      i++;
    } else {
      merged.push(cur);
    }
  }

  const KNOWN_CHA_VALUES = ["LINKS", "BHATIA", "SHARP", "VSP"];
  let colCount   = 0;
  let headerStart = -1;

  for (let i = 0; i < merged.length; i++) {
    if (merged[i].toUpperCase() === "CHA") { headerStart = i; break; }
  }
  if (headerStart === -1) return { headers: [], rows: [], rawHeaders: [] };

  for (let i = headerStart + 1; i < merged.length; i++) {
    if (KNOWN_CHA_VALUES.includes(merged[i].toUpperCase())) {
      colCount = i - headerStart;
      break;
    }
  }
  if (colCount === 0) colCount = 17;

  const rawHeaders: string[] = [];
  for (let i = headerStart; i < headerStart + colCount; i++) {
    rawHeaders.push((merged[i] ?? "").replace(/\s+/g, " "));
  }
  const mappedHeaders = rawHeaders.map((h) => EMAIL_COL_MAP[h.toLowerCase()] ?? h);

  const dataStart = headerStart + colCount;
  const rows: Record<string, string>[] = [];

  for (let i = dataStart; i + colCount <= merged.length; i += colCount) {
    const cells = merged.slice(i, i + colCount).map((c) => c);
    const row: Record<string, string> = {};
    mappedHeaders.forEach((header, idx) => { row[header] = cells[idx] ?? ""; });
    if (!row["wo"] || !/^\d+/.test(row["wo"].trim())) continue;
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

  const [pasteText,    setPasteText]    = useState("");
  const [pastePreview, setPastePreview] = useState<{ headers: string[]; rows: Record<string, string>[]; rawHeaders: string[] } | null>(null);
  const [filterCHA,    setFilterCHA]    = useState(true);

  const [file,     setFile]     = useState<File | null>(null);
  const [step,     setStep]     = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result,   setResult]   = useState<{ added: number; skipped: number } | null>(null);

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

  function handlePasteParse() {
    if (!pasteText.trim()) return;
    const parsed = parseEmailTable(pasteText);
    setPastePreview(parsed);
    setStep("preview");
  }

  function getPasteRows() {
    if (!pastePreview) return [];
    if (!filterCHA) return pastePreview.rows;
    return pastePreview.rows.filter(
      (r) => !r["agent"] || r["agent"].toUpperCase() === "LINKS"
    );
  }

  async function handlePasteImport() {
    const rawRows = getPasteRows();
    if (!rawRows.length) return;
    setStep("importing");
    setErrorMsg(null);

    try {
      const rows = rawRows.map((row) => ({
        wo:          row["wo"]          ?? "",
        country:     row["country"]     ?? "",
        port:        row["port"]        ?? "",
        agent:       row["agent"]       ?? "",
        plant:       row["plant"]       ?? "",
        veh:         row["veh"]         ?? "",
        type:        row["type"]        ?? "",
        qty:         row["qty"]         ?? "",
        cont:        row["cont"]        ?? "",
        po_no:       row["po_no"]       ?? "",
        lc_no:       row["lc_no"]       ?? "",
        do_given_dt: row["do_given_dt"] ?? "",
      }));

      const res  = await fetch("/api/bajaj/work-orders/paste", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows, moduleSlug }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Insert failed");
      setResult({ added: data.added, skipped: data.skipped });
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
        <p className="text-gray-700 dark:text-white/80 text-sm font-medium">Importing work orders…</p>
        {file && <p className="text-[13px] text-gray-400 dark:text-white/40">{file.name}</p>}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-red-500" />
        <p className="text-gray-800 dark:text-white/90 font-medium">Import failed</p>
        <p className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2 max-w-sm border border-red-100 dark:border-red-500/30">{errorMsg}</p>
        <button onClick={reset} className="text-[13px] text-gray-400 dark:text-white/40 hover:text-amber-600 underline transition-colors">
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
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import Complete</h3>
          <p className="text-[13px] text-gray-400 dark:text-white/40 mt-1">Work orders are now on the board</p>
        </div>
        <div className="flex gap-10 mt-2">
          <div>
            <p className="text-3xl font-bold text-amber-500 tabular-nums">{result.added}</p>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-1">Added</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-300 dark:text-white/30 tabular-nums">{result.skipped}</p>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-1">Skipped (duplicate)</p>
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          <a
            href={`/bajaj/boards/${moduleSlug}`}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            View Board <ChevronRight className="size-4" />
          </a>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-white dark:bg-[#0d0d0d] text-sm text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/90 border border-gray-200 dark:border-white/10 transition-colors"
          >
            Import More
          </button>
        </div>
      </div>
    );
  }

  // ── Paste preview ────────────────────────────────────────────────────────
  if (step === "preview" && pastePreview) {
    const rows = getPasteRows();
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Preview — {pastePreview.rows.length} rows parsed
            </h3>
            <p className="text-[13px] text-gray-400 dark:text-white/40 mt-0.5">
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
              <span className="text-[13px] text-gray-500 dark:text-white/50">LINKS rows only</span>
            </label>
            <button onClick={reset} className="text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] px-6 py-10 text-center shadow-sm">
            <p className="text-sm text-gray-400 dark:text-white/40">No LINKS rows found in the pasted data.</p>
            <button
              onClick={() => setFilterCHA(false)}
              className="mt-3 text-[13px] text-amber-500 hover:text-amber-600 underline"
            >
              Show all CHAs
            </button>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-200 dark:border-white/10 max-h-80 shadow-sm">
            <table className="text-[12px] min-w-full">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 sticky top-0">
                <tr>
                  {pastePreview.headers.filter(h => h !== "agent").map((h, idx) => (
                    <th key={`h-${idx}-${h}`} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-white/50 whitespace-nowrap">
                      {h || <span className="text-gray-300 dark:text-white/30 italic">col{idx}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={cn(
                    "border-b border-gray-100 dark:border-white/[0.06]",
                    i % 2 === 0 ? "bg-white dark:bg-[#0d0d0d]" : "bg-gray-50 dark:bg-white/5"
                  )}>
                    {pastePreview.headers.filter(h => h !== "agent").map((h, idx) => (
                      <td key={`c-${i}-${idx}`} className="px-3 py-1.5 text-gray-700 dark:text-white/80 whitespace-nowrap max-w-[140px] truncate">
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handlePasteImport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <Upload className="size-4" />
            Import {rows.length} Rows
          </button>
          <button
            onClick={reset}
            className="px-4 py-2.5 rounded-lg bg-white dark:bg-[#0d0d0d] text-sm text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/90 border border-gray-200 dark:border-white/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Module selector */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-semibold mb-2">
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
                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 border-amber-200"
                  : "bg-white dark:bg-[#0d0d0d] text-gray-500 dark:text-white/50 border-gray-200 dark:border-white/10 hover:text-gray-700 dark:hover:text-white/80 hover:border-gray-300 dark:hover:border-white/20"
              )}
            >
              <span className="text-sm">{m.flag}</span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-white/10">
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
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/80"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PASTE MODE ───────────────────────────────────────────── */}
      {mode === "paste" && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
            <p className="text-[13px] font-semibold text-amber-700 mb-1">
              📧 How to import from the Bajaj dispatch email
            </p>
            <ol className="text-[12px] text-amber-600/80 space-y-1 list-decimal list-inside">
              <li>Open the dispatch plan email from Somandra / Bajaj Auto IB Logistics</li>
              <li>Select all rows in the table (Ctrl+A inside the table)</li>
              <li>Copy (Ctrl+C) and paste below</li>
              <li>We&apos;ll auto-filter LINKS rows and parse CHA, WO NO, COUNTRY, LSD, Port etc.</li>
            </ol>
          </div>

          <div>
            <label className="block text-[12px] text-gray-500 dark:text-white/50 mb-2 uppercase tracking-wider font-semibold">
              Paste dispatch plan table here
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`CHA\tWO NO\tCOUNTRY\tPlant\tBrand\tVariant\tQTY\t40 HC\tSTD 20\tPlant Ready / Dispatch Date\tLSD\tAssy Config\tPort (WO/POD)\tQuotation No/Ref\tPO NO\tPLAN-ADD/RVSD\tIB Plan-ZORD\nLINKS\t5584880\tBangladesh\tWA01\tDISCOVER\t125 DI\t0\t2\t\t\t12-Jun\tPLP\tCHATTOGRAM\t5233061\t5233061\tRVSD\t18-Apr`}
              rows={10}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-4 py-3 text-[13px] text-gray-800 dark:text-white/90 placeholder-gray-300 dark:placeholder-white/30 focus:border-amber-500 focus:outline-none font-mono resize-y transition-colors"
            />
          </div>

          <button
            onClick={handlePasteParse}
            disabled={!pasteText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <ClipboardPaste className="size-4" />
            Parse Table
          </button>
        </div>
      )}

      {/* ── EXCEL MODE ───────────────────────────────────────────── */}
      {mode === "excel" && (
        <div className="max-w-xl">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-2xl px-10 py-16 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-amber-400 bg-amber-50 dark:bg-amber-500/10"
                : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5"
            )}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className={cn("size-10 mx-auto mb-4", isDragActive ? "text-amber-500" : "text-gray-300 dark:text-white/30")} />
            <p className="text-gray-700 dark:text-white/80 font-medium mb-1">
              {isDragActive ? "Drop it here…" : "Drag & drop your Excel file"}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mb-4">Accepts .xlsx files</p>
            <span className="inline-block px-4 py-2 rounded-lg bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-white/10 text-[13px] text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 transition-colors">
              Browse file
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] px-4 py-3 shadow-sm">
            <p className="text-[12px] text-gray-500 dark:text-white/50">
              <span className="text-gray-700 dark:text-white/80 font-medium">Expected columns:</span>{" "}
              FFJOBNO / WO, COUNTRY, port, bookingno, SBNO, BLNO, containerno, vslname, SAILINGDT, REMARK
            </p>
          </div>
        </div>
      )}

      {/* ── MANUAL MODE ──────────────────────────────────────────── */}
      {mode === "manual" && (
        <ManualWorkOrderForm moduleSlug={moduleSlug} />
      )}
    </div>
  );
}
