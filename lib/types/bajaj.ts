// ─── Bajaj Auto Shipment Module — TypeScript Types ────────────────────────────

export type BajajUserStatus = "pending" | "approved" | "rejected";

export interface BajajModule {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
}

export interface BajajStatus {
  id: string;
  module_id: string;
  name: string;
  color_hex: string;
  display_order: number;
}

export interface BajajBoardConfig {
  module_id: string;
  card_face_fields: string[];
  unique_key_field: string | null;
  updated_at: string;
}

export interface BajajImportBatch {
  id: string;
  module_id: string;
  filename: string;
  imported_by: string | null;
  imported_at: string;
  row_count: number;
  added_count: number;
}

export interface BajajWorkOrder {
  id: string;
  module_id: string;
  status_id: string | null;
  data: Record<string, unknown>;
  assigned_to: string | null;
  column_order: number;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  status?: BajajStatus;
  assignee?: { id: string; full_name: string | null; email: string; avatar_url: string | null };
}

export interface BajajComment {
  id: string;
  work_order_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  // Joined
  author?: { id: string; full_name: string | null; email: string; avatar_url: string | null };
}

export type BajajUserRole = "superadmin" | "admin" | "operator" | "viewer";

export interface BajajUser {
  id: string;
  user_id?: string | null;
  email: string;
  full_name: string | null;
  status: BajajUserStatus;
  role: BajajUserRole | null;
  department: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface BajajRolePermission {
  id: string;
  role: BajajUserRole;
  module_slug: string;
  can_view: boolean;
  can_edit_fields: boolean;
  can_move_stage: boolean;
  can_import: boolean;
  can_export: boolean;
  can_manage_users: boolean;
}

export interface BajajAuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

// ─── Reminders (demo) ─────────────────────────────────────────────────────────

export type BajajReminderStatus = "scheduled" | "sent" | "done";

export interface BajajReminder {
  id: string;
  work_order_id: string;
  module_id: string;
  work_order_summary: string;
  created_by: string | null;
  created_at: string;
  due_at: string; // ISO string
  days_offset: number;
  recipients: string[];
  message: string;
  status: BajajReminderStatus;
  sent_at: string | null;
  done_at: string | null;
}

// ─── Import flow types ────────────────────────────────────────────────────────

export interface ImportPreviewStatus {
  colorHex: string;
  name: string;       // from Color Coding Legend sheet
  rowCount: number;   // how many rows have this color
}

export interface ImportPreview {
  statuses: ImportPreviewStatus[];
  columns: string[];              // all Excel header names from row 1
  preview: Record<string, unknown>[]; // first 5 data rows
  totalRows: number;
  moduleSlug: string;
}

export interface ImportConfig {
  moduleSlug: string;
  statuses: { colorHex: string; name: string }[];
  cardFaceFields: string[];
  uniqueKeyField: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface BajajAnalytics {
  totalWorkOrders: number;
  byStatus: { statusName: string; colorHex: string; count: number }[];
  byModule: { moduleName: string; slug: string; count: number }[];
  importTimeline: { date: string; addedCount: number; batchId: string }[];
  // Extended demo metrics
  totalContainers: number;
  totalBLs: number;
  containersByVessel: { vesselName: string; containerCount: number }[];
  containersByLine: { lineName: string; containerCount: number }[];
  blPendingAfterETD: number;
  vesselsOverLimit: { vesselName: string; containerCount: number }[];
}

// ─── Column-level RBAC ───────────────────────────────────────────────────────

export type BajajGranteeType = "role" | "user";
export type BajajRole = "admin" | "manager" | "operator" | "viewer";

export interface BajajColumnPerm {
  id:              string;
  module_slug:     string;
  status_id:       string | null;
  grantee_type:    BajajGranteeType;
  grantee:         string;
  can_view:        boolean;
  can_edit_fields: boolean;
  can_move_cards:  boolean;
  can_assign:      boolean;
  created_at:      string;
}

// ─── Board filters ────────────────────────────────────────────────────────────

export interface WorkOrderFilters {
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
  statusId?: string;
  search?: string;    // searches across all jsonb data fields
}
