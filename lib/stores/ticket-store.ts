import { create } from "zustand";

interface TicketPanelState {
  selectedTicketId: string | null;
  isPanelOpen: boolean;
  setSelectedTicket: (id: string) => void;
  closePanel: () => void;
}

export const useTicketStore = create<TicketPanelState>((set) => ({
  selectedTicketId: null,
  isPanelOpen: false,
  setSelectedTicket: (id) => set({ selectedTicketId: id, isPanelOpen: true }),
  closePanel: () => set({ selectedTicketId: null, isPanelOpen: false }),
}));
