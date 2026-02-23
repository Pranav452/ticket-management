"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useCreateTicket } from "@/lib/queries/tickets";
import { useProfiles, useProfile } from "@/lib/queries/profiles";
import type { TicketPriority } from "@/lib/types";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS: { value: TicketPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-emerald-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "high", label: "High", color: "text-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const val = input.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm text-neutral-300">{label}</label>
      <div className="min-h-[42px] flex flex-wrap gap-1.5 items-center rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs text-neutral-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-neutral-400 hover:text-neutral-50"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-neutral-50 placeholder-neutral-500 focus:outline-none"
        />
      </div>
      <p className="text-xs text-neutral-500">
        Press Enter or comma to add
      </p>
    </div>
  );
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="size-4 text-blue-400" />;
  if (type.startsWith("video/")) return <Film className="size-4 text-purple-400" />;
  if (type === "application/pdf") return <FileText className="size-4 text-red-400" />;
  return <File className="size-4 text-neutral-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketForm() {
  const router = useRouter();
  const createTicket = useCreateTicket();
  const { data: profiles = [] } = useProfiles();
  const { data: currentProfile } = useProfile();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isDev = currentProfile?.role === "dev";

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024, // 50 MB
    accept: {
      "image/*": [],
      "video/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
      "application/vnd.ms-excel": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "text/plain": [],
      "text/csv": [],
      "application/zip": [],
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !subject.trim()) {
      setError("Title and subject are required");
      return;
    }

    try {
      await createTicket.mutateAsync({
        payload: {
          title: title.trim(),
          subject: subject.trim(),
          description: description.trim() || undefined,
          priority,
          assigned_to: assignedTo || null,
          cc,
          bcc,
        },
        files,
      });
      router.push(isDev ? "/dashboard" : "/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm text-neutral-300">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of the issue"
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* Subject */}
      <div className="space-y-1">
        <label htmlFor="subject" className="block text-sm text-neutral-300">
          Subject <span className="text-red-400">*</span>
        </label>
        <input
          id="subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Login page crash, API timeout, UI glitch"
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label
          htmlFor="description"
          className="block text-sm text-neutral-300"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behaviour, environment info..."
          className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label className="block text-sm text-neutral-300">Priority</label>
        <div className="flex gap-2 flex-wrap">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={cn(
                "rounded-full border px-4 py-1 text-sm font-medium transition-colors",
                priority === opt.value
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-500"
              )}
            >
              <span className={opt.color}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Assigned To (dev only) */}
      {isDev && (
        <div className="space-y-1">
          <label
            htmlFor="assignedTo"
            className="block text-sm text-neutral-300"
          >
            Assigned To
          </label>
          <select
            id="assignedTo"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email} {p.role === "dev" ? "(dev)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CC */}
      <TagInput
        label="CC"
        tags={cc}
        onChange={setCc}
        placeholder="Add email addresses…"
      />

      {/* BCC */}
      <TagInput
        label="BCC"
        tags={bcc}
        onChange={setBcc}
        placeholder="Add email addresses…"
      />

      {/* File attachments */}
      <div className="space-y-2">
        <label className="block text-sm text-neutral-300">
          Attachments
          <span className="ml-1 text-neutral-500">(images, videos, PDFs, docs — max 50 MB each)</span>
        </label>

        <div
          {...getRootProps()}
          className={cn(
            "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-neutral-700 hover:border-neutral-500"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto size-8 text-neutral-500 mb-2" />
          <p className="text-sm text-neutral-400">
            {isDragActive
              ? "Drop files here…"
              : "Drag & drop files here, or click to browse"}
          </p>
        </div>

        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(file.type)}
                  <span className="text-sm text-neutral-200 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-neutral-500 flex-shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                  className="text-neutral-500 hover:text-neutral-200 flex-shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={createTicket.isPending}
          className="flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {createTicket.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {createTicket.isPending ? "Submitting…" : "Submit Ticket"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-neutral-700 px-5 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
