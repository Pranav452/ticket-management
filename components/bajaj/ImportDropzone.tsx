"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle, AlertCircle, Loader2, ChevronDown, X } from "lucide-react";
import type { ImportPreview, ImportConfig } from "@/lib/types/bajaj";

const MODULES = [
  { slug: "vipar", name: "Vipar" },
  { slug: "srilanka", name: "Sri Lanka" },
  { slug: "nigeria", name: "Nigeria" },
  { slug: "bangladesh", name: "Bangladesh" },
  { slug: "triumph", name: "Triumph" },
];

interface ImportDropzoneProps {
  defaultModule?: string;
  userId: string;
}

type Step = "upload" | "configure" | "importing" | "done" | "error";

export function ImportDropzone({ defaultModule, userId }: ImportDropzoneProps) {
  const [moduleSlug, setModuleSlug] = useState(defaultModule ?? "vipar");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  // Config state
  const [configStatuses, setConfigStatuses] = useState<{ colorHex: string; name: string }[]>([]);
  const [uniqueKeyField, setUniqueKeyField] = useState<string>("");
  const [cardFaceFields, setCardFaceFields] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setStep("importing"); // use "importing" as "uploading for preview"
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("file", f);

    try {
      const res = await fetch(`/api/bajaj/import?module=${moduleSlug}&phase=preview`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      setPreview(data as ImportPreview);
      setConfigStatuses(data.statuses.map((s: { colorHex: string; name: string }) => ({ colorHex: s.colorHex, name: s.name })));
      setCardFaceFields(data.columns.slice(0, 4));
      setUniqueKeyField(data.columns[0] ?? "");
      setStep("configure");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
      setStep("error");
    }
  }, [moduleSlug]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: step !== "upload",
  });

  async function handleConfirmImport() {
    if (!file || !preview) return;
    setStep("importing");
    setErrorMsg(null);

    const config: ImportConfig & { importedBy: string } = {
      moduleSlug,
      statuses: configStatuses,
      cardFaceFields,
      uniqueKeyField,
      importedBy: userId,
    };

    const fd = new FormData();
    fd.append("file", file);
    fd.append("config", JSON.stringify(config));

    try {
      const res = await fetch(`/api/bajaj/import?module=${moduleSlug}&phase=confirm`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult({ added: data.added, skipped: data.skipped });
      setStep("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed");
      setStep("error");
    }
  }

  function reset() {
    setFile(null);
    setStep("upload");
    setPreview(null);
    setErrorMsg(null);
    setResult(null);
    setConfigStatuses([]);
    setCardFaceFields([]);
    setUniqueKeyField("");
  }

  // ── Upload step ─────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Module selector */}
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            Which board/sheet are you importing?
          </label>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => (
              <button
                key={m.slug}
                onClick={() => setModuleSlug(m.slug)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  m.slug === moduleSlug
                    ? "bg-amber-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-amber-500 bg-amber-950/20"
              : "border-neutral-700 hover:border-neutral-500 bg-neutral-900"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="size-10 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-300 font-medium mb-1">
            {isDragActive ? "Drop it here…" : "Drag & drop your Excel file"}
          </p>
          <p className="text-sm text-neutral-600">
            Accepts .xlsx files only — &quot;Bajaj Auto FEB Shipment Data.xlsx&quot;
          </p>
        </div>
      </div>
    );
  }

  // ── Loading / importing ─────────────────────────────────────────────────────
  if (step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center max-w-2xl">
        <Loader2 className="size-10 text-amber-500 animate-spin" />
        <p className="text-neutral-300">
          {preview ? "Importing work orders…" : "Analysing your Excel file…"}
        </p>
        <p className="text-sm text-neutral-600">{file?.name}</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center max-w-2xl">
        <AlertCircle className="size-10 text-red-500" />
        <p className="text-neutral-200 font-medium">Something went wrong</p>
        <p className="text-sm text-red-400 bg-red-950/30 rounded-lg px-4 py-2">{errorMsg}</p>
        <button onClick={reset} className="text-sm text-neutral-500 hover:text-neutral-300 underline">
          Try again
        </button>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center max-w-2xl">
        <CheckCircle className="size-12 text-emerald-500" />
        <h3 className="text-xl font-semibold text-neutral-100">Import Complete</h3>
        <div className="flex gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-emerald-400">{result.added}</p>
            <p className="text-sm text-neutral-500 mt-1">Added</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-neutral-500">{result.skipped}</p>
            <p className="text-sm text-neutral-500 mt-1">Skipped (duplicate)</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <a
            href={`/bajaj/boards/${moduleSlug}`}
            className="px-6 py-2.5 rounded-lg bg-amber-600 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
          >
            View Board →
          </a>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg bg-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 transition-colors"
          >
            Import Another
          </button>
        </div>
      </div>
    );
  }

  // ── Configure ───────────────────────────────────────────────────────────────
  if (step === "configure" && preview) {
    const totalSelected = cardFaceFields.length;

    return (
      <div className="max-w-2xl space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100 mb-1">Configure Import</h3>
          <p className="text-sm text-neutral-500">
            We detected <strong className="text-neutral-300">{preview.totalRows}</strong> rows and{" "}
            <strong className="text-neutral-300">{preview.statuses.length}</strong> status types
            from <span className="text-amber-400">{file?.name}</span>.
            Review the settings below before importing.
          </p>
        </div>

        {/* Status columns */}
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-3">
            Status Columns (from Color Coding Legend)
          </label>
          <div className="space-y-2">
            {configStatuses.map((s, i) => (
              <div key={`status-${i}`} className="flex items-center gap-3 bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-800">
                <span
                  className="size-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `#${s.colorHex}` }}
                />
                <span className="text-xs text-neutral-600 font-mono">{s.colorHex}</span>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => {
                    const updated = [...configStatuses];
                    updated[i] = { ...s, name: e.target.value };
                    setConfigStatuses(updated);
                  }}
                  className="flex-1 bg-transparent text-sm text-neutral-200 focus:outline-none border-b border-transparent focus:border-amber-600"
                />
                <span className="text-xs text-neutral-700 ml-auto">
                  {preview.statuses.find((ps) => ps.colorHex === s.colorHex)?.rowCount ?? 0} rows
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Unique key field */}
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            Unique Key Field (for deduplication)
          </label>
          <p className="text-xs text-neutral-600 mb-2">
            When re-importing, rows with the same value in this column will be skipped.
          </p>
          <div className="relative">
            <select
              value={uniqueKeyField}
              onChange={(e) => setUniqueKeyField(e.target.value)}
              className="w-full appearance-none bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-amber-600"
            >
              {preview.columns.map((col, i) => (
                <option key={`opt-${i}`} value={col}>{col}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-600 pointer-events-none" />
          </div>
        </div>

        {/* Card face fields */}
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            Card Face Fields ({totalSelected} selected — pick 3–5)
          </label>
          <p className="text-xs text-neutral-600 mb-3">
            These fields appear on each work order card at a glance.
          </p>
          <div className="flex flex-wrap gap-2">
            {preview.columns.map((col, i) => {
              const selected = cardFaceFields.includes(col);
              return (
                <button
                  key={`face-${i}`}
                  onClick={() => {
                    if (selected) {
                      setCardFaceFields((f) => f.filter((c) => c !== col));
                    } else if (cardFaceFields.length < 6) {
                      setCardFaceFields((f) => [...f, col]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selected
                      ? "bg-amber-600 text-white"
                      : "bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-neutral-700"
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview rows */}
        {preview.preview.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Data Preview (first 5 rows)
            </label>
            <div className="overflow-x-auto rounded-lg border border-neutral-800">
              <table className="text-xs text-neutral-400 min-w-full">
                <thead className="bg-neutral-900 border-b border-neutral-800">
                  <tr>
                    {cardFaceFields.map((col, i) => (
                      <th key={`th-${i}`} className="px-3 py-2 text-left font-medium text-neutral-500">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-900/50">
                      {cardFaceFields.map((col, ci) => (
                        <td key={`td-${ci}`} className="px-3 py-2 text-neutral-300 max-w-[140px] truncate">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
          <button
            onClick={handleConfirmImport}
            disabled={!uniqueKeyField || cardFaceFields.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-600 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            <Upload className="size-4" />
            Import {preview.totalRows} Rows
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 transition-colors"
          >
            <X className="size-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
