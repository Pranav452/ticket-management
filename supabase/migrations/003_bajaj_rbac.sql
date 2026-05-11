-- ─────────────────────────────────────────────────────────────────────────────
-- Bajaj RBAC: role field + column-level permissions
-- Migration: 003_bajaj_rbac.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Role on bajaj_users ──────────────────────────────────────────────────────
ALTER TABLE bajaj_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'operator'
    CHECK (role IN ('admin', 'manager', 'operator', 'viewer'));

-- ─── Column-level permissions ─────────────────────────────────────────────────
-- Applies to a Kanban column (status) within a module.
-- status_id = NULL means "all columns in the module".
-- grantee_type = 'role'  → grantee is a role name ('admin'|'manager'|'operator'|'viewer')
-- grantee_type = 'user'  → grantee is an email address (user-specific override)
-- User-specific entries take precedence over role entries.
CREATE TABLE IF NOT EXISTS bajaj_column_perms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug     text NOT NULL,
  status_id       uuid REFERENCES bajaj_statuses(id) ON DELETE CASCADE,
  grantee_type    text NOT NULL CHECK (grantee_type IN ('role', 'user')),
  grantee         text NOT NULL,
  can_view        bool NOT NULL DEFAULT true,
  can_edit_fields bool NOT NULL DEFAULT false,
  can_move_cards  bool NOT NULL DEFAULT false,
  can_assign      bool NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_id, grantee_type, grantee)
);

ALTER TABLE bajaj_column_perms ENABLE ROW LEVEL SECURITY;

-- Admin can read/write; approved users can read (to render their own UI)
CREATE POLICY "bajaj_column_perms_select" ON bajaj_column_perms
  FOR SELECT USING (is_bajaj_approved());

CREATE POLICY "bajaj_column_perms_insert" ON bajaj_column_perms
  FOR INSERT WITH CHECK (is_bajaj_admin());

CREATE POLICY "bajaj_column_perms_update" ON bajaj_column_perms
  FOR UPDATE USING (is_bajaj_admin());

CREATE POLICY "bajaj_column_perms_delete" ON bajaj_column_perms
  FOR DELETE USING (is_bajaj_admin());

CREATE INDEX IF NOT EXISTS bajaj_column_perms_module_idx
  ON bajaj_column_perms (module_slug, status_id);

-- ─── Default role grants ──────────────────────────────────────────────────────
-- Managers can edit fields and move cards across all modules (status_id NULL = all columns).
-- Operators can only edit fields.
-- Viewers are read-only.
-- Admin is always unrestricted (bypassed in code).

INSERT INTO bajaj_column_perms (module_slug, status_id, grantee_type, grantee, can_view, can_edit_fields, can_move_cards, can_assign)
SELECT slug, NULL, 'role', 'viewer',   true,  false, false, false FROM bajaj_modules
ON CONFLICT (module_slug, status_id, grantee_type, grantee) DO NOTHING;

INSERT INTO bajaj_column_perms (module_slug, status_id, grantee_type, grantee, can_view, can_edit_fields, can_move_cards, can_assign)
SELECT slug, NULL, 'role', 'operator', true,  true,  false, false FROM bajaj_modules
ON CONFLICT (module_slug, status_id, grantee_type, grantee) DO NOTHING;

INSERT INTO bajaj_column_perms (module_slug, status_id, grantee_type, grantee, can_view, can_edit_fields, can_move_cards, can_assign)
SELECT slug, NULL, 'role', 'manager',  true,  true,  true,  true  FROM bajaj_modules
ON CONFLICT (module_slug, status_id, grantee_type, grantee) DO NOTHING;
