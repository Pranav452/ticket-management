-- ─────────────────────────────────────────────────────────────────────────────
-- Bajaj Column Ownership: direct user-to-column assignment
-- Migration: 004_bajaj_column_assignments.sql
-- Replaces the role/grantee-based bajaj_column_perms with simple user assignment
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old perms table (replaced by assignments)
DROP TABLE IF EXISTS bajaj_column_perms;

-- ─── Column assignments ────────────────────────────────────────────────────────
-- user_email assigned to a specific status column (or status_id IS NULL = all columns in module)
CREATE TABLE IF NOT EXISTS bajaj_column_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text NOT NULL,
  status_id   uuid REFERENCES bajaj_statuses(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  can_edit    bool NOT NULL DEFAULT true,
  can_move    bool NOT NULL DEFAULT true,
  can_assign  bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_id, user_email)
);

ALTER TABLE bajaj_column_assignments ENABLE ROW LEVEL SECURITY;

-- Any approved user can read assignments (to know what they can do)
CREATE POLICY "bajaj_col_assign_select" ON bajaj_column_assignments
  FOR SELECT USING (is_bajaj_approved());

-- Only admin can write
CREATE POLICY "bajaj_col_assign_insert" ON bajaj_column_assignments
  FOR INSERT WITH CHECK (is_bajaj_admin());

CREATE POLICY "bajaj_col_assign_update" ON bajaj_column_assignments
  FOR UPDATE USING (is_bajaj_admin());

CREATE POLICY "bajaj_col_assign_delete" ON bajaj_column_assignments
  FOR DELETE USING (is_bajaj_admin());

CREATE INDEX IF NOT EXISTS bajaj_col_assign_user_idx ON bajaj_column_assignments (user_email, module_slug);

-- ─── Column access requests ───────────────────────────────────────────────────
-- User requests access to a specific column; admin approves → creates assignment
CREATE TABLE IF NOT EXISTS bajaj_column_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text NOT NULL,
  status_id   uuid REFERENCES bajaj_statuses(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  reason      text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_id, user_email)
);

ALTER TABLE bajaj_column_requests ENABLE ROW LEVEL SECURITY;

-- Approved users can read + insert their own requests
CREATE POLICY "bajaj_col_req_select" ON bajaj_column_requests
  FOR SELECT USING (is_bajaj_approved());

CREATE POLICY "bajaj_col_req_insert" ON bajaj_column_requests
  FOR INSERT WITH CHECK (
    is_bajaj_approved() AND
    auth.jwt() ->> 'email' = user_email
  );

-- Admin can update (approve/reject)
CREATE POLICY "bajaj_col_req_update" ON bajaj_column_requests
  FOR UPDATE USING (is_bajaj_admin());
