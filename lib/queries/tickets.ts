"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Ticket, CreateTicketPayload, UpdateTicketPayload } from "@/lib/types";

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useTickets(status?: string) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", status],
    queryFn:  () => apiFetch(`/api/tickets${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    staleTime: 30_000,
  });
}

export function useTicket(id: string | null) {
  return useQuery<Ticket>({
    queryKey: ["ticket", id],
    enabled:  !!id,
    queryFn:  () => apiFetch(`/api/tickets/${id}`),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, files }: { payload: CreateTicketPayload; files?: File[] }) => {
      if (files && files.length > 0) {
        // Multipart upload
        const form = new FormData();
        form.append("data", JSON.stringify(payload));
        files.forEach((f) => form.append("files", f));
        return apiFetch<Ticket>("/api/tickets", { method: "POST", body: form });
      }
      return apiFetch<Ticket>("/api/tickets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTicketPayload) => {
      const { id, ...patch } = payload as { id: string } & Record<string, unknown>;
      return apiFetch<Ticket>(`/api/tickets/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket", (data as Ticket).id] });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/tickets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
