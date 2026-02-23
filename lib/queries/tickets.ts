"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Ticket,
  CreateTicketPayload,
  UpdateTicketPayload,
} from "@/lib/types";

const supabase = createClient();

// ─── Fetch all accessible tickets ────────────────────────
export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          creator:profiles!tickets_created_by_fkey(id, email, full_name, avatar_url, role),
          assignee:profiles!tickets_assigned_to_fkey(id, email, full_name, avatar_url, role),
          files:ticket_files(*)
        `)
        .order("column_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });
}

// ─── Fetch single ticket ──────────────────────────────────
export function useTicket(id: string | null) {
  return useQuery({
    queryKey: ["ticket", id],
    enabled: !!id,
    queryFn: async (): Promise<Ticket> => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          creator:profiles!tickets_created_by_fkey(id, email, full_name, avatar_url, role),
          assignee:profiles!tickets_assigned_to_fkey(id, email, full_name, avatar_url, role),
          files:ticket_files(*)
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as Ticket;
    },
  });
}

// ─── Create ticket ────────────────────────────────────────
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payload,
      files,
    }: {
      payload: CreateTicketPayload;
      files?: File[];
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert ticket
      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          ...payload,
          created_by: user.id,
          status: "backlog",
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files if any
      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${ticket.id}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage
            .from("ticket-attachments")
            .getPublicUrl(filePath);

          await supabase.from("ticket_files").insert({
            ticket_id: ticket.id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });
        }
      }

      return ticket as Ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ─── Update ticket ────────────────────────────────────────
export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTicketPayload) => {
      const { id, ...updates } = payload;
      const { data, error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Ticket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", data.id] });
    },
  });
}

// ─── Delete ticket ────────────────────────────────────────
export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
