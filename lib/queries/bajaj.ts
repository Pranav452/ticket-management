"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  BajajModule,
  BajajStatus,
  BajajBoardConfig,
  BajajWorkOrder,
  BajajComment,
  BajajUser,
  BajajAuditLog,
  BajajAnalytics,
  BajajReminder,
  WorkOrderFilters,
} from "@/lib/types/bajaj";

const supabase = createClient();

// ─── Modules ──────────────────────────────────────────────────────────────────
export function useBajajModules() {
  return useQuery({
    queryKey: ["bajaj_modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bajaj_modules")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as BajajModule[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Statuses ─────────────────────────────────────────────────────────────────
export function useBajajStatuses(moduleSlug: string) {
  return useQuery({
    queryKey: ["bajaj_statuses", moduleSlug],
    queryFn: async () => {
      const { data: mod } = await supabase
        .from("bajaj_modules")
        .select("id")
        .eq("slug", moduleSlug)
        .single();
      if (!mod) return [] as BajajStatus[];

      const { data, error } = await supabase
        .from("bajaj_statuses")
        .select("*")
        .eq("module_id", mod.id)
        .order("display_order");
      if (error) throw error;
      return data as BajajStatus[];
    },
    enabled: !!moduleSlug,
  });
}

// ─── Board config ─────────────────────────────────────────────────────────────
export function useBajajBoardConfig(moduleSlug: string) {
  return useQuery({
    queryKey: ["bajaj_board_config", moduleSlug],
    queryFn: async () => {
      const { data: mod } = await supabase
        .from("bajaj_modules")
        .select("id")
        .eq("slug", moduleSlug)
        .single();
      if (!mod) return null;

      const { data, error } = await supabase
        .from("bajaj_board_config")
        .select("*")
        .eq("module_id", mod.id)
        .maybeSingle();
      if (error) throw error;
      return data as BajajBoardConfig | null;
    },
    enabled: !!moduleSlug,
  });
}

// ─── Work orders ──────────────────────────────────────────────────────────────
export function useWorkOrders(moduleSlug: string, filters?: WorkOrderFilters) {
  return useQuery({
    queryKey: ["bajaj_work_orders", moduleSlug, filters],
    queryFn: async () => {
      const { data: mod } = await supabase
        .from("bajaj_modules")
        .select("id")
        .eq("slug", moduleSlug)
        .single();
      if (!mod) return [] as BajajWorkOrder[];

      let query = supabase
        .from("bajaj_work_orders")
        .select(
          `*, status:bajaj_statuses(*), assignee:profiles!bajaj_work_orders_assigned_to_fkey(id, full_name, email, avatar_url)`
        )
        .eq("module_id", mod.id)
        .order("column_order", { ascending: true });

      if (filters?.statusId) query = query.eq("status_id", filters.statusId);
      if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
      if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
      if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as BajajWorkOrder[];
    },
    enabled: !!moduleSlug,
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ["bajaj_work_order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bajaj_work_orders")
        .select(
          `*, status:bajaj_statuses(*), assignee:profiles!bajaj_work_orders_assigned_to_fkey(id, full_name, email, avatar_url)`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as BajajWorkOrder;
    },
    enabled: !!id,
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<BajajWorkOrder>;
    }) => {
      const { data, error } = await supabase
        .from("bajaj_work_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["bajaj_work_order", data.id] });
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────
export function useBajajComments(workOrderId: string) {
  return useQuery({
    queryKey: ["bajaj_comments", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bajaj_comments")
        .select(`*, author:profiles!bajaj_comments_author_id_fkey(id, full_name, email, avatar_url)`)
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BajajComment[];
    },
    enabled: !!workOrderId,
  });
}

export function useAddBajajComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workOrderId,
      authorId,
      content,
    }: {
      workOrderId: string;
      authorId: string;
      content: string;
    }) => {
      const { data, error } = await supabase
        .from("bajaj_comments")
        .insert({ work_order_id: workOrderId, author_id: authorId, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["bajaj_comments", data.work_order_id],
      });
    },
  });
}

// ─── Bajaj users (admin) ──────────────────────────────────────────────────────
export function useBajajUsers(status?: string) {
  return useQuery({
    queryKey: ["bajaj_users", status],
    queryFn: async () => {
      let query = supabase
        .from("bajaj_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as BajajUser[];
    },
  });
}

export function useApproveBajajUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bajajUserId,
      adminId,
    }: {
      bajajUserId: string;
      adminId: string;
    }) => {
      const { error } = await supabase
        .from("bajaj_users")
        .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString() })
        .eq("id", bajajUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_users"] });
    },
  });
}

export function useRejectBajajUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bajajUserId }: { bajajUserId: string }) => {
      const { error } = await supabase
        .from("bajaj_users")
        .update({ status: "rejected" })
        .eq("id", bajajUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bajaj_users"] });
    },
  });
}

// ─── Audit logs ───────────────────────────────────────────────────────────────
export function useBajajAuditLogs(filters?: {
  actorEmail?: string;
  action?: string;
  targetId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["bajaj_audit_logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("bajaj_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 100);

      if (filters?.actorEmail) query = query.ilike("actor_email", `%${filters.actorEmail}%`);
      if (filters?.action) query = query.eq("action", filters.action);
      if (filters?.targetId) query = query.eq("target_id", filters.targetId);

      const { data, error } = await query;
      if (error) throw error;
      return data as BajajAuditLog[];
    },
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export function useBajajAnalytics(moduleSlug?: string) {
  return useQuery({
    queryKey: ["bajaj_analytics", moduleSlug],
    queryFn: async () => {
      // Counts per module
      const { data: modules } = await supabase
        .from("bajaj_modules")
        .select("id, name, slug")
        .order("display_order");

      const byModule: BajajAnalytics["byModule"] = [];
      let totalWorkOrders = 0;

      for (const mod of modules ?? []) {
        const { count } = await supabase
          .from("bajaj_work_orders")
          .select("*", { count: "exact", head: true })
          .eq("module_id", mod.id);
        const c = count ?? 0;
        byModule.push({ moduleName: mod.name, slug: mod.slug, count: c });
        totalWorkOrders += c;
      }

      // Status breakdown (for selected module or all)
      let statusQuery = supabase
        .from("bajaj_work_orders")
        .select("status_id, bajaj_statuses(name, color_hex)");
      if (moduleSlug) {
        const { data: mod } = await supabase
          .from("bajaj_modules")
          .select("id")
          .eq("slug", moduleSlug)
          .single();
        if (mod) statusQuery = statusQuery.eq("module_id", mod.id);
      }
      const { data: workOrdersWithStatus } = await statusQuery;
      const statusMap = new Map<string, { name: string; colorHex: string; count: number }>();
      for (const wo of workOrdersWithStatus ?? []) {
        const s = (wo as unknown as { bajaj_statuses: { name: string; color_hex: string } | null }).bajaj_statuses;
        if (!s || !wo.status_id) continue;
        const key = wo.status_id as string;
        if (!statusMap.has(key)) {
          statusMap.set(key, { name: s.name, colorHex: s.color_hex, count: 0 });
        }
        statusMap.get(key)!.count++;
      }
      const byStatus = Array.from(statusMap.values()).map((s) => ({
        statusName: s.name,
        colorHex: s.colorHex,
        count: s.count,
      }));

      // Import timeline
      const { data: batches } = await supabase
        .from("bajaj_import_batches")
        .select("id, imported_at, added_count")
        .order("imported_at", { ascending: true })
        .limit(30);
      const importTimeline = (batches ?? []).map((b) => ({
        date: b.imported_at.slice(0, 10),
        addedCount: b.added_count,
        batchId: b.id,
      }));

      // Fetch all work orders with data for container/BL analytics
      let allWOQuery = supabase.from("bajaj_work_orders").select("data");
      if (moduleSlug) {
        const { data: modForAll } = await supabase
          .from("bajaj_modules").select("id").eq("slug", moduleSlug).single();
        if (modForAll) allWOQuery = allWOQuery.eq("module_id", modForAll.id);
      }
      const { data: allWorkOrders } = await allWOQuery;

      const totalContainers = (allWorkOrders ?? []).reduce((s, wo) => s + (Number((wo.data as Record<string, unknown>)?.Cont) || 0), 0);
      const totalBLs = (allWorkOrders ?? []).filter(wo => (wo.data as Record<string, unknown>)?.["BL NO"]).length;

      const vesselMap = new Map<string, number>();
      for (const wo of allWorkOrders ?? []) {
        const d = wo.data as Record<string, unknown>;
        const v = d?.["Vessel Name"] as string | undefined;
        const c = Number(d?.Cont) || 0;
        if (v) vesselMap.set(v, (vesselMap.get(v) ?? 0) + c);
      }
      const containersByVessel = [...vesselMap.entries()]
        .map(([vesselName, containerCount]) => ({ vesselName, containerCount }))
        .sort((a, b) => b.containerCount - a.containerCount);

      const lineMap = new Map<string, number>();
      for (const wo of allWorkOrders ?? []) {
        const d = wo.data as Record<string, unknown>;
        const l = d?.["S/LINE"] as string | undefined;
        const c = Number(d?.Cont) || 0;
        if (l) lineMap.set(l, (lineMap.get(l) ?? 0) + c);
      }
      const containersByLine = [...lineMap.entries()]
        .map(([lineName, containerCount]) => ({ lineName, containerCount }))
        .sort((a, b) => b.containerCount - a.containerCount);

      const now = Date.now();
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
      const blPendingAfterETD = (allWorkOrders ?? []).filter(wo => {
        const d = wo.data as Record<string, unknown>;
        const etd = d?.["CURRENT ETD"] as string | undefined;
        const bl = d?.["BL NO"] as string | undefined;
        if (!etd || bl) return false;
        const etdDate = new Date(etd);
        return !isNaN(etdDate.getTime()) && (now - etdDate.getTime()) > FORTY_EIGHT_HOURS_MS;
      }).length;

      const vesselsOverLimit = containersByVessel.filter(v => v.containerCount > 25);

      // Parts & frames: rows where Veh contains "FRAME" or "PART"
      const partsAndFrames: { vesselName: string; vehType: string; containerCount: number }[] = [];
      for (const wo of allWorkOrders ?? []) {
        const d = wo.data as Record<string, unknown>;
        const veh = String(d?.["Veh"] ?? "").toUpperCase();
        if (veh.includes("FRAME") || veh.includes("PART")) {
          partsAndFrames.push({
            vesselName: String(d?.["Vessel Name"] ?? "Unknown").trim() || "Unknown",
            vehType: String(d?.["Veh"] ?? "").trim(),
            containerCount: Number(d?.["Cont"]) || 0,
          });
        }
      }

      return {
        totalWorkOrders,
        byStatus,
        byModule,
        importTimeline,
        totalContainers,
        totalBLs,
        containersByVessel,
        containersByLine,
        blPendingAfterETD,
        vesselsOverLimit,
        partsAndFrames,
      } as BajajAnalytics;
    },
    staleTime: 60 * 1000,
  });
}

// ─── Create work order (manual entry) ────────────────────────────────────────
export function useCreateWorkOrder() {
  const qc = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ moduleSlug, data }: { moduleSlug: string; data: Record<string, string> }) => {
      const { data: mod, error: modErr } = await supabase
        .from('bajaj_modules').select('id').eq('slug', moduleSlug).single();
      if (modErr || !mod) throw modErr ?? new Error('Module not found');
      const { data: statuses, error: stErr } = await supabase
        .from('bajaj_statuses').select('id').eq('module_id', mod.id).order('display_order').limit(1);
      if (stErr || !statuses?.length) throw stErr ?? new Error('No statuses for module');
      const { error } = await supabase.from('bajaj_work_orders')
        .insert({ module_id: mod.id, status_id: statuses[0].id, data });
      if (error) throw error;
    },
    onSuccess: (_, { moduleSlug }) =>
      qc.invalidateQueries({ queryKey: ['bajaj-work-orders', moduleSlug] }),
  });
}

// ─── Reminders ────────────────────────────────────────────────────────────────
export function useBajajReminders() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['bajaj-reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bajaj_reminders').select('*').order('due_at');
      if (error) throw error;
      return (data ?? []) as BajajReminder[];
    },
  });
}

export function useCreateBajajReminder() {
  const qc = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async (payload: Omit<BajajReminder, 'id' | 'created_at' | 'sent_at' | 'done_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bajaj_reminders')
        .insert({ ...payload, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bajaj-reminders'] }),
  });
}

export function useUpdateBajajReminder() {
  const qc = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BajajReminder> }) => {
      const { error } = await supabase.from('bajaj_reminders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bajaj-reminders'] }),
  });
}

export function useDeleteUserReminders() {
  const qc = useQueryClient();
  const supabase = createClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('bajaj_reminders').delete().eq('created_by', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bajaj-reminders'] }),
  });
}
