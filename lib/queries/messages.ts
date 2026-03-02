"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Message } from "@/lib/types";

// In-memory demo messages so chat works without any backend.
let demoMessagesByTicket: Record<string, Message[]> = {};

function ensureDemoMessagesSeeded(ticketId: string) {
  if (demoMessagesByTicket[ticketId]) return;
  const now = new Date().toISOString();
  demoMessagesByTicket[ticketId] = [
    {
      id: "demo-msg-1",
      ticket_id: ticketId,
      sender_id: "demo-user-1",
      content: "This is a demo conversation message.",
      created_at: now,
      sender: {
        id: "demo-user-1",
        email: "demo.user@example.com",
        full_name: "Demo User",
        avatar_url: null,
        role: "dev",
      } as any,
    } as Message,
  ];
}

// ─── Fetch messages for a ticket (demo) ───────────────────
export function useMessages(ticketId: string | null) {
  const key = ticketId ?? "none";

  return useQuery({
    queryKey: ["messages", key],
    enabled: !!ticketId,
    queryFn: async (): Promise<Message[]> => {
      if (!ticketId) return [];
      ensureDemoMessagesSeeded(ticketId);
      return demoMessagesByTicket[ticketId] ?? [];
    },
  });
}

// ─── Send a message (demo, local only) ─────────────────────
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
      if (!content.trim()) {
        throw new Error("Message cannot be empty");
      }
      ensureDemoMessagesSeeded(ticketId);
      const now = new Date().toISOString();
      const newMessage: Message = {
        id: `demo-msg-${(demoMessagesByTicket[ticketId]?.length ?? 0) + 1}`,
        ticket_id: ticketId,
        sender_id: "demo-user-1",
        content: content.trim(),
        created_at: now,
        sender: {
          id: "demo-user-1",
          email: "demo.user@example.com",
          full_name: "Demo User",
          avatar_url: null,
          role: "dev",
        } as any,
      } as Message;
      demoMessagesByTicket[ticketId] = [
        ...(demoMessagesByTicket[ticketId] ?? []),
        newMessage,
      ];
      return newMessage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", data.ticket_id],
      });
    },
  });
}
