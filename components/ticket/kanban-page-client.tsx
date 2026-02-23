"use client";

import { CustomKanban } from "@/components/custom-kanban";
import { TicketDetailPanel } from "@/components/ticket/ticket-detail-panel";

export function KanbanPageClient() {
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      <CustomKanban className="flex-1 min-h-0" />
      <TicketDetailPanel />
    </div>
  );
}
