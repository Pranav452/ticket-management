export type UserRole = "user" | "dev";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "backlog" | "todo" | "doing" | "done";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: string | null;
  assigned_to: string | null;
  cc: string[];
  bcc: string[];
  column_order: number;
  created_at: string;
  updated_at: string;
  // Joined relations (optional)
  creator?: Profile;
  assignee?: Profile;
  files?: TicketFile[];
}

export interface TicketFile {
  id: string;
  ticket_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  // Joined
  sender?: Profile;
}

export interface CreateTicketPayload {
  title: string;
  subject: string;
  description?: string;
  priority: TicketPriority;
  assigned_to?: string | null;
  cc?: string[];
  bcc?: string[];
}

export interface UpdateTicketPayload {
  id: string;
  title?: string;
  subject?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  assigned_to?: string | null;
  cc?: string[];
  bcc?: string[];
  column_order?: number;
}
