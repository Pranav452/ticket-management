 "use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  Ticket,
  CreateTicketPayload,
  UpdateTicketPayload,
} from "@/lib/types";

// In-memory demo data so the UI can run without any backend.
let demoTickets: Ticket[] = [];

function ensureDemoTicketsSeeded() {
  if (demoTickets.length > 0) return;
  const now = new Date().toISOString();
  demoTickets = [
    {
      id: "demo-1",
      title: "Demo: Shipment delay to Nigeria",
      subject: "Delay on VIPAR shipment to Nigeria",
      description: "Example ticket demonstrating backlog status in the board.",
      status: "backlog",
      priority: "medium",
      created_at: now,
      updated_at: now,
      column_order: 0,
      created_by: "demo-user-1",
      assigned_to: null,
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: null as any,
      files: [],
    } as Ticket,
    {
      id: "demo-2",
      title: "Demo: Documentation update for Triumph",
      subject: "Update Triumph process documentation",
      description: "Example ticket currently in progress.",
      status: "doing",
      priority: "high",
      created_at: now,
      updated_at: now,
      column_order: 1,
      created_by: "demo-user-1",
      assigned_to: "demo-user-2",
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: {
        id: "demo-user-2",
        email: "assignee@example.com",
        full_name: "Assignee Demo",
        avatar_url: null,
        role: "dev",
      } as any,
      files: [],
    } as Ticket,
    {
      id: "demo-3",
      title: "BL not generated for Sri Lanka shipment",
      subject: "Follow up on BL for Sri Lanka RE4S",
      description: "Demo ticket showing pending BL generation after ETD.",
      status: "todo",
      priority: "urgent",
      created_at: now,
      updated_at: now,
      column_order: 2,
      created_by: "demo-user-1",
      assigned_to: "demo-user-2",
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: {
        id: "demo-user-2",
        email: "assignee@example.com",
        full_name: "Assignee Demo",
        avatar_url: null,
        role: "dev",
      } as any,
      files: [],
    } as Ticket,
    {
      id: "demo-4",
      title: "Parts and frames split by vessel",
      subject: "Validate parts/frames separation for VIPAR",
      description: "Demo ticket to illustrate container validation rules.",
      status: "doing",
      priority: "medium",
      created_at: now,
      updated_at: now,
      column_order: 3,
      created_by: "demo-user-1",
      assigned_to: null,
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: null as any,
      files: [],
    } as Ticket,
    {
      id: "demo-5",
      title: "Nigeria shipment documentation",
      subject: "Prepare docs for Nigeria VIPAR outbound",
      description: null,
      status: "backlog",
      priority: "low",
      created_at: now,
      updated_at: now,
      column_order: 4,
      created_by: "demo-user-1",
      assigned_to: null,
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: null as any,
      files: [],
    } as Ticket,
    {
      id: "demo-6",
      title: "Bangladesh CT 100 parts import",
      subject: "Check container allocation for BD CT 100 parts",
      description: "Ensure no more than 25 containers per vessel in planning.",
      status: "todo",
      priority: "high",
      created_at: now,
      updated_at: now,
      column_order: 5,
      created_by: "demo-user-1",
      assigned_to: "demo-user-2",
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: {
        id: "demo-user-2",
        email: "assignee@example.com",
        full_name: "Assignee Demo",
        avatar_url: null,
        role: "dev",
      } as any,
      files: [],
    } as Ticket,
    {
      id: "demo-7",
      title: "Triumph frames shipment",
      subject: "Confirm vessel assignment for Triumph frames",
      description: null,
      status: "doing",
      priority: "medium",
      created_at: now,
      updated_at: now,
      column_order: 6,
      created_by: "demo-user-1",
      assigned_to: null,
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: null as any,
      files: [],
    } as Ticket,
    {
      id: "demo-8",
      title: "Close-out for February shipments",
      subject: "Mark all Feb BLs as completed",
      description: "Demo ticket in done column.",
      status: "done",
      priority: "medium",
      created_at: now,
      updated_at: now,
      column_order: 7,
      created_by: "demo-user-1",
      assigned_to: "demo-user-2",
      cc: [],
      bcc: [],
      creator: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
      assignee: {
        id: "demo-user-2",
        email: "assignee@example.com",
        full_name: "Assignee Demo",
        avatar_url: null,
        role: "dev",
      } as any,
      files: [],
    } as Ticket,
  ];
}

// ─── Fetch all accessible tickets (demo) ──────────────────
export function useTickets() {
  ensureDemoTicketsSeeded();

  return useQuery({
    queryKey: ["tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      return demoTickets;
    },
  });
}

// ─── Fetch single ticket (demo) ───────────────────────────
export function useTicket(id: string | null) {
  ensureDemoTicketsSeeded();

  return useQuery({
    queryKey: ["ticket", id],
    enabled: !!id,
    queryFn: async (): Promise<Ticket> => {
      const found = demoTickets.find((t) => t.id === id);
      if (!found) {
        throw new Error("Ticket not found in demo data");
      }
      return found;
    },
  });
}

// ─── Create ticket (demo, local only) ─────────────────────
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payload,
    }: {
      payload: CreateTicketPayload;
      files?: File[];
    }) => {
      ensureDemoTicketsSeeded();
      const now = new Date().toISOString();
      const newTicket: Ticket = {
        ...(payload as any),
        id: `demo-${demoTickets.length + 1}`,
        status: (payload as any).status ?? "backlog",
        cc: (payload as any).cc ?? [],
        bcc: (payload as any).bcc ?? [],
        created_at: now,
        updated_at: now,
        column_order: demoTickets.length,
        created_by: "demo-user-1",
        assigned_to: (payload as any).assigned_to ?? null,
        creator: {
          id: "demo-user-1",
          email: "demo.user@example.com",
          full_name: "Demo User",
          avatar_url: null,
          role: "dev",
        } as any,
        assignee: null as any,
        files: [],
      };
      demoTickets = [...demoTickets, newTicket];
      return newTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ─── Update ticket (demo, local only) ─────────────────────
export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTicketPayload) => {
      ensureDemoTicketsSeeded();
      const { id, ...updates } = payload as any;
      demoTickets = demoTickets.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      );
      const updated = demoTickets.find((t) => t.id === id);
      if (!updated) {
        throw new Error("Ticket not found in demo data");
      }
      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", data.id] });
    },
  });
}

// ─── Delete ticket (demo, local only) ─────────────────────
export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureDemoTicketsSeeded();
      demoTickets = demoTickets.filter((t) => t.id !== id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
