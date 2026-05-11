"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BajajModule,
  BajajStatus,
  BajajBoardConfig,
  BajajWorkOrder,
  BajajComment,
  BajajUser,
  BajajAuditLog,
  BajajAnalytics,
  WorkOrderFilters,
  BajajReminder,
  BajajRolePermission,
  BajajUserRole,
} from "@/lib/types/bajaj";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

function buildQS(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export function useBajajModules() {
  return useQuery<BajajModule[]>({
    queryKey: ["bajaj", "modules"],
    queryFn:  () => apiFetch("/api/bajaj/modules"),
    staleTime: 60_000,
  });
}

// ─── Board Config ─────────────────────────────────────────────────────────────
// Components call useBajajBoardConfig(moduleSlug) — we map slug → module_id
// via a two-step fetch.

export function useBajajBoardConfig(moduleSlug: string) {
  return useQuery<BajajBoardConfig | null>({
    queryKey: ["bajaj", "board-config", moduleSlug],
    queryFn:  async () => {
      // fetch all modules to resolve slug → id
      const modules: BajajModule[] = await apiFetch("/api/bajaj/modules");
      const mod = modules.find((m) => m.slug === moduleSlug);
      if (!mod) return null;
      return apiFetch<BajajBoardConfig>(
        `/api/bajaj/board-config${buildQS({ module_id: mod.id })}`
      );
    },
    staleTime: 60_000,
  });
}

// ─── Statuses ─────────────────────────────────────────────────────────────────
// Components pass module_id directly; also accept slug (for board client).

export function useBajajStatuses(moduleIdOrSlug?: string) {
  return useQuery<BajajStatus[]>({
    queryKey: ["bajaj", "statuses", moduleIdOrSlug],
    queryFn:  async () => {
      if (!moduleIdOrSlug) return apiFetch("/api/bajaj/statuses");
      // Try as module_id first (UUID pattern)
      const isUUID = /^[0-9a-f-]{36}$/i.test(moduleIdOrSlug);
      if (isUUID) {
        return apiFetch(`/api/bajaj/statuses?module_id=${moduleIdOrSlug}`);
      }
      // It's a slug — resolve to id first
      const modules: BajajModule[] = await apiFetch("/api/bajaj/modules");
      const mod = modules.find((m) => m.slug === moduleIdOrSlug);
      if (!mod) return [];
      return apiFetch(`/api/bajaj/statuses?module_id=${mod.id}`);
    },
    staleTime: 60_000,
  });
}

// ─── Work Orders ──────────────────────────────────────────────────────────────
// Return flat array (components don't handle pagination object).

export function useWorkOrders(moduleSlug: string, filters?: WorkOrderFilters) {
  return useQuery<BajajWorkOrder[]>({
    queryKey: ["bajaj", "work-orders", moduleSlug, filters],
    queryFn:  async () => {
      const result: { data: BajajWorkOrder[] } = await apiFetch(
        `/api/bajaj/work-orders${buildQS({
          module:     moduleSlug,
          statusId:   filters?.statusId,
          assignedTo: filters?.assignedTo,
          search:     filters?.search,
          dateFrom:   filters?.dateFrom,
          dateTo:     filters?.dateTo,
          pageSize:   200, // load up to 200 per board view
        })}`
      );
      return result.data;
    },
    staleTime: 30_000,
  });
}

export function useWorkOrder(id: string | null) {
  return useQuery<BajajWorkOrder>({
    queryKey: ["bajaj", "work-order", id],
    enabled:  !!id,
    queryFn:  () => apiFetch(`/api/bajaj/work-orders/${id}`),
  });
}

// Components call: mutate({ id, updates: { status_id, column_order, ... } })
export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BajajWorkOrder> & { status_id?: string | null; column_order?: number; assigned_to?: string | null } }) =>
      apiFetch(`/api/bajaj/work-orders/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bajaj", "work-orders"] });
      qc.invalidateQueries({ queryKey: ["bajaj", "work-order"] });
    },
  });
}

// Components call: mutate({ moduleSlug, data: {...} })
export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<BajajWorkOrder> & { moduleSlug?: string }) =>
      apiFetch("/api/bajaj/work-orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bajaj", "work-orders"] });
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────
// Components pass workOrderId (camelCase string)

export function useBajajComments(workOrderId: string | null) {
  return useQuery<BajajComment[]>({
    queryKey: ["bajaj", "comments", workOrderId],
    enabled:  !!workOrderId,
    queryFn:  () => apiFetch(`/api/bajaj/comments?work_order_id=${workOrderId}`),
  });
}

// Components call: mutate({ workOrderId, authorId, authorEmail, authorName, content })
// authorId is treated as email (profile id = email in this system)
export function useAddBajajComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      workOrderId:  string;
      authorId?:    string | null;   // legacy — treated as email
      authorEmail?: string | null;
      authorName?:  string | null;
      content:      string;
    }) =>
      apiFetch<BajajComment>("/api/bajaj/comments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          work_order_id: payload.workOrderId,
          author_email:  payload.authorEmail ?? payload.authorId ?? "unknown",
          author_name:   payload.authorName,
          content:       payload.content,
        }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bajaj", "comments", vars.workOrderId] });
    },
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useBajajUsers() {
  return useQuery<BajajUser[]>({
    queryKey: ["bajaj", "users"],
    queryFn:  () => apiFetch("/api/bajaj/users"),
  });
}

// Components call: mutate({ bajajUserId, adminId })
export function useApproveBajajUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bajajUserId, adminId }: { bajajUserId: string; adminId?: string }) =>
      apiFetch(`/api/bajaj/users/${bajajUserId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "approve", approved_by: adminId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "users"] }),
  });
}

export function useRejectBajajUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bajajUserId, adminId }: { bajajUserId: string; adminId?: string }) =>
      apiFetch(`/api/bajaj/users/${bajajUserId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "reject", approved_by: adminId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "users"] }),
  });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
// Components call: useBajajAuditLogs({ actorEmail, action, limit })

export function useBajajAuditLogs(params?: { actorEmail?: string; action?: string; limit?: number; targetId?: string } | number) {
  const resolved = typeof params === "number"
    ? { limit: params }
    : (params ?? {});

  return useQuery<BajajAuditLog[]>({
    queryKey: ["bajaj", "audit-logs", resolved],
    queryFn:  () =>
      apiFetch(
        `/api/bajaj/audit-logs${buildQS({
          limit:       resolved.limit ?? 50,
          actor_email: (resolved as { actorEmail?: string }).actorEmail,
          action:      (resolved as { action?: string }).action,
          target_id:   (resolved as { targetId?: string }).targetId,
        })}`
      ),
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function useBajajAnalytics(moduleSlug?: string) {
  return useQuery<BajajAnalytics>({
    queryKey: ["bajaj", "analytics", moduleSlug],
    queryFn:  () => apiFetch(`/api/bajaj/analytics${buildQS({ module: moduleSlug })}`),
    staleTime: 60_000,
  });
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export function useBajajReminders(params?: { work_order_id?: string; module_id?: string }) {
  return useQuery<BajajReminder[]>({
    queryKey: ["bajaj", "reminders", params],
    queryFn:  () => apiFetch(`/api/bajaj/reminders${buildQS(params ?? {})}`),
  });
}

// Components call with camelCase: { workOrderId, moduleId, workOrderSummary, daysOffset, recipients, message, createdBy, due_at }
export function useCreateBajajReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      workOrderId?:       string;
      work_order_id?:     string;
      moduleId?:          string;
      module_id?:         string;
      workOrderSummary?:  string;
      work_order_summary?:string;
      daysOffset?:        number;
      days_offset?:       number;
      recipients?:        string[];
      message?:           string;
      createdBy?:         string | null;
      created_by?:        string | null;
      due_at?:            string;
    }) =>
      apiFetch<BajajReminder>("/api/bajaj/reminders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          work_order_id:      payload.work_order_id  ?? payload.workOrderId,
          module_id:          payload.module_id       ?? payload.moduleId,
          work_order_summary: payload.work_order_summary ?? payload.workOrderSummary ?? "",
          days_offset:        payload.days_offset     ?? payload.daysOffset    ?? 0,
          recipients:         payload.recipients      ?? [],
          message:            payload.message         ?? "",
          created_by:         payload.created_by      ?? payload.createdBy     ?? null,
          due_at:             payload.due_at           ?? new Date(Date.now() + (payload.daysOffset ?? payload.days_offset ?? 0) * 86400_000).toISOString(),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "reminders"] }),
  });
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export function useBajajRolePermissions() {
  return useQuery<BajajRolePermission[]>({
    queryKey: ["bajaj", "role-permissions"],
    queryFn:  () => apiFetch("/api/bajaj/role-permissions"),
    staleTime: 30_000,
  });
}

export function useUpdateBajajRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (perm: Partial<BajajRolePermission> & { role: BajajUserRole }) =>
      apiFetch("/api/bajaj/role-permissions", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(perm),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "role-permissions"] }),
  });
}

export function useUpdateBajajUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BajajUserRole }) =>
      apiFetch(`/api/bajaj/users/${userId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "users"] }),
  });
}

// Components call: mutate({ id, updates: { status, sent_at, ... } })
export function useUpdateBajajReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BajajReminder> }) =>
      apiFetch(`/api/bajaj/reminders/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bajaj", "reminders"] }),
  });
}
