"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

const supabase = createClient();

// ─── Fetch messages for a ticket ─────────────────────────
export function useMessages(ticketId: string | null) {
  const queryClient = useQueryClient();

  // Supabase Realtime subscription for live chat updates
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`messages:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["messages", ticketId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return useQuery({
    queryKey: ["messages", ticketId],
    enabled: !!ticketId,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles(id, email, full_name, avatar_url, role)
        `)
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });
}

// ─── Send a message ───────────────────────────────────────
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      content,
    }: {
      ticketId: string;
      content: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messages")
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          content: content.trim(),
        })
        .select(`
          *,
          sender:profiles(id, email, full_name, avatar_url, role)
        `)
        .single();

      if (error) throw error;
      return data as Message;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", data.ticket_id],
      });
    },
  });
}
