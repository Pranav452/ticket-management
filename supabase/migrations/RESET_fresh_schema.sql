-- =============================================================================
-- FRESH SCHEMA — Run this in Supabase SQL Editor
-- Drops everything and rebuilds clean. Safe to re-run.
-- =============================================================================

-- ── Drop old tables in dependency order ───────────────────────────────────────
DROP TABLE IF EXISTS bajaj_column_required_fields CASCADE;
DROP TABLE IF EXISTS bajaj_column_requests        CASCADE;
DROP TABLE IF EXISTS bajaj_column_assignments     CASCADE;
DROP TABLE IF EXISTS bajaj_audit_logs             CASCADE;
DROP TABLE IF EXISTS bajaj_comments               CASCADE;
DROP TABLE IF EXISTS bajaj_reminders              CASCADE;
DROP TABLE IF EXISTS bajaj_import_batches         CASCADE;
DROP TABLE IF EXISTS bajaj_work_orders            CASCADE;
DROP TABLE IF EXISTS bajaj_board_config           CASCADE;
DROP TABLE IF EXISTS bajaj_role_permissions       CASCADE;
DROP TABLE IF EXISTS bajaj_statuses               CASCADE;
DROP TABLE IF EXISTS bajaj_users                  CASCADE;
DROP TABLE IF EXISTS bajaj_modules                CASCADE;
-- Old unused tables
DROP TABLE IF EXISTS tickets      CASCADE;
DROP TABLE IF EXISTS ticket_files CASCADE;
DROP TABLE IF EXISTS messages     CASCADE;

-- ── Drop old functions ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS is_bajaj_admin()   CASCADE;
DROP FUNCTION IF EXISTS is_bajaj_approved() CASCADE;
DROP FUNCTION IF EXISTS bajaj_set_updated_at() CASCADE;

-- =============================================================================
-- TABLES
-- =============================================================================

-- ── bajaj_modules ─────────────────────────────────────────────────────────────
CREATE TABLE bajaj_modules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  display_order int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bajaj_modules (name, slug, display_order) VALUES
  ('VIPAR',       'vipar',      0),
  ('Sri Lanka',   'srilanka',   1),
  ('Nigeria',     'nigeria',    2),
  ('Bangladesh',  'bangladesh', 3),
  ('Triumph',     'triumph',    4);

-- ── bajaj_statuses (10 lifecycle stages per module) ───────────────────────────
CREATE TABLE bajaj_statuses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid        NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  color_hex     text        NOT NULL DEFAULT '6b7280',
  display_order int         NOT NULL DEFAULT 0,
  UNIQUE (module_id, name)
);

INSERT INTO bajaj_statuses (module_id, name, color_hex, display_order)
SELECT m.id, s.name, s.color_hex, s.display_order
FROM bajaj_modules m
CROSS JOIN (VALUES
  ('Planning',             '3b82f6', 0),
  ('Booking Request',      '06b6d4', 1),
  ('Booking',              '8b5cf6', 2),
  ('Container Allocation', 'f59e0b', 3),
  ('SI Filing',            'f97316', 4),
  ('Custom Clearance',     'ef4444', 5),
  ('Gate Open',            'ec4899', 6),
  ('Billing',              '6366f1', 7),
  ('BL Release',           '10b981', 8),
  ('Completed',            '22c55e', 9)
) AS s(name, color_hex, display_order);

-- ── bajaj_users (access control / approval) ───────────────────────────────────
CREATE TABLE bajaj_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL UNIQUE,
  full_name   text,
  status      text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_work_orders ─────────────────────────────────────────────────────────
-- data JSONB holds all flexible field values (wo, port, brand, booking_no, etc.)
-- Status and order are explicit columns for efficient board queries.
CREATE TABLE bajaj_work_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid        NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  module_slug     text        NOT NULL,
  status_id       uuid        REFERENCES bajaj_statuses(id) ON DELETE SET NULL,
  data            jsonb       NOT NULL DEFAULT '{}',
  column_order    float8      NOT NULL DEFAULT 0,
  import_batch_id uuid,                          -- filled by import endpoint
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_board_config ────────────────────────────────────────────────────────
CREATE TABLE bajaj_board_config (
  module_id        uuid    PRIMARY KEY REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  card_face_fields text[]  NOT NULL DEFAULT '{}',
  unique_key_field text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_import_batches ──────────────────────────────────────────────────────
CREATE TABLE bajaj_import_batches (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid        NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  module_slug   text        NOT NULL,
  filename      text        NOT NULL,
  imported_by   text,                            -- email of importer
  imported_at   timestamptz NOT NULL DEFAULT now(),
  row_count     int         NOT NULL DEFAULT 0,
  added_count   int         NOT NULL DEFAULT 0,
  skipped_count int         NOT NULL DEFAULT 0
);

-- ── bajaj_comments ────────────────────────────────────────────────────────────
CREATE TABLE bajaj_comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid        NOT NULL REFERENCES bajaj_work_orders(id) ON DELETE CASCADE,
  author_email  text,
  author_name   text,
  content       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_audit_logs ──────────────────────────────────────────────────────────
CREATE TABLE bajaj_audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text        NOT NULL,
  action      text        NOT NULL,
  target_type text,
  target_id   text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_column_assignments ──────────────────────────────────────────────────
CREATE TABLE bajaj_column_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text        NOT NULL,
  status_id   uuid        REFERENCES bajaj_statuses(id) ON DELETE CASCADE,
  status_name text,                              -- denormalised for cross-DB matching
  user_email  text        NOT NULL,
  can_edit    bool        NOT NULL DEFAULT true,
  can_move    bool        NOT NULL DEFAULT true,
  can_assign  bool        NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_id, user_email)
);

-- ── bajaj_column_requests ─────────────────────────────────────────────────────
CREATE TABLE bajaj_column_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text        NOT NULL,
  status_id   uuid        REFERENCES bajaj_statuses(id) ON DELETE CASCADE,
  status_name text,
  user_email  text        NOT NULL,
  reason      text,
  status      text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_id, user_email)
);

-- ── bajaj_column_required_fields ──────────────────────────────────────────────
-- Admin configures which fields must be filled per lifecycle column
-- before a card auto-advances to the next column.
CREATE TABLE bajaj_column_required_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text        NOT NULL,
  status_name text        NOT NULL,
  field_key   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_name, field_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX bajaj_wo_module_idx       ON bajaj_work_orders (module_id);
CREATE INDEX bajaj_wo_module_slug_idx  ON bajaj_work_orders (module_slug);
CREATE INDEX bajaj_wo_status_idx       ON bajaj_work_orders (status_id);
CREATE INDEX bajaj_wo_order_idx        ON bajaj_work_orders (module_id, status_id, column_order);
CREATE INDEX bajaj_wo_data_gin_idx     ON bajaj_work_orders USING gin (data);
CREATE INDEX bajaj_comments_wo_idx     ON bajaj_comments (work_order_id);
CREATE INDEX bajaj_audit_created_idx   ON bajaj_audit_logs (created_at DESC);
CREATE INDEX bajaj_audit_target_idx    ON bajaj_audit_logs (target_type, target_id);
CREATE INDEX bajaj_col_assign_user_idx ON bajaj_column_assignments (user_email, module_slug);
CREATE INDEX bajaj_crf_lookup_idx      ON bajaj_column_required_fields (module_slug, status_name);

-- =============================================================================
-- TRIGGER — auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION bajaj_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bajaj_work_orders_updated_at
  BEFORE UPDATE ON bajaj_work_orders
  FOR EACH ROW EXECUTE FUNCTION bajaj_set_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS (used in RLS policies)
-- =============================================================================

CREATE OR REPLACE FUNCTION is_bajaj_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth.email() = 'pranavnairop090@gmail.com'
$$;

CREATE OR REPLACE FUNCTION is_bajaj_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM bajaj_users
    WHERE email = auth.email() AND status = 'approved'
  )
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE bajaj_modules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_statuses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_work_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_board_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_comments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_column_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_column_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_column_required_fields ENABLE ROW LEVEL SECURITY;

-- modules + statuses: read by any approved user, write admin only
CREATE POLICY "read modules"   ON bajaj_modules  FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "write modules"  ON bajaj_modules  FOR ALL    USING (is_bajaj_admin());
CREATE POLICY "read statuses"  ON bajaj_statuses FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "write statuses" ON bajaj_statuses FOR ALL    USING (is_bajaj_admin());

-- work orders: approved users read + insert + update; admin also deletes
CREATE POLICY "read work_orders"   ON bajaj_work_orders FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "insert work_orders" ON bajaj_work_orders FOR INSERT WITH CHECK (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "update work_orders" ON bajaj_work_orders FOR UPDATE USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "delete work_orders" ON bajaj_work_orders FOR DELETE USING (is_bajaj_admin());

-- bajaj_users: self-register + read own; admin manages all
CREATE POLICY "user self register"   ON bajaj_users FOR INSERT WITH CHECK (auth.email() = email);
CREATE POLICY "user read own"        ON bajaj_users FOR SELECT USING (auth.email() = email OR is_bajaj_admin());
CREATE POLICY "admin manage users"   ON bajaj_users FOR ALL    USING (is_bajaj_admin());

-- comments: approved read + insert
CREATE POLICY "read comments"   ON bajaj_comments FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "insert comments" ON bajaj_comments FOR INSERT WITH CHECK (is_bajaj_approved() OR is_bajaj_admin());

-- audit logs: approved insert, admin reads all
CREATE POLICY "insert audit" ON bajaj_audit_logs FOR INSERT WITH CHECK (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "admin read audit" ON bajaj_audit_logs FOR SELECT USING (is_bajaj_admin());

-- column assignments: users see own, admin manages all
CREATE POLICY "user read own assignments" ON bajaj_column_assignments FOR SELECT USING (user_email = auth.email() OR is_bajaj_admin());
CREATE POLICY "admin manage assignments"  ON bajaj_column_assignments FOR ALL    USING (is_bajaj_admin());

-- column requests: user manages own, admin manages all
CREATE POLICY "user read own requests"   ON bajaj_column_requests FOR SELECT USING (user_email = auth.email() OR is_bajaj_admin());
CREATE POLICY "user insert requests"     ON bajaj_column_requests FOR INSERT WITH CHECK (user_email = auth.email());
CREATE POLICY "admin manage requests"    ON bajaj_column_requests FOR ALL    USING (is_bajaj_admin());

-- required fields: approved read, admin write
CREATE POLICY "read required fields"  ON bajaj_column_required_fields FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "admin write req fields" ON bajaj_column_required_fields FOR ALL   USING (is_bajaj_admin());

-- board config: approved read, admin write
CREATE POLICY "read board config"  ON bajaj_board_config FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "admin write config" ON bajaj_board_config FOR ALL    USING (is_bajaj_admin());

-- import batches: approved read + insert
CREATE POLICY "read import batches"   ON bajaj_import_batches FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "insert import batches" ON bajaj_import_batches FOR INSERT WITH CHECK (is_bajaj_approved() OR is_bajaj_admin());

-- ── bajaj_reminders ───────────────────────────────────────────────────────────
CREATE TABLE bajaj_reminders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id       uuid        REFERENCES bajaj_work_orders(id) ON DELETE CASCADE,
  module_id           uuid        REFERENCES bajaj_modules(id),
  work_order_summary  text,
  created_by          text,
  due_at              timestamptz NOT NULL,
  days_offset         int         NOT NULL DEFAULT 0,
  recipients          jsonb       NOT NULL DEFAULT '[]',
  message             text,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','sent','done','cancelled')),
  sent_at             timestamptz,
  done_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── bajaj_role_permissions ────────────────────────────────────────────────────
CREATE TABLE bajaj_role_permissions (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  role             text  NOT NULL,
  module_slug      text  NOT NULL DEFAULT '*',
  can_view         bool  NOT NULL DEFAULT true,
  can_edit_fields  bool  NOT NULL DEFAULT false,
  can_move_stage   bool  NOT NULL DEFAULT false,
  can_import       bool  NOT NULL DEFAULT false,
  can_export       bool  NOT NULL DEFAULT false,
  can_manage_users bool  NOT NULL DEFAULT false,
  UNIQUE (role, module_slug)
);

-- RLS
ALTER TABLE bajaj_reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_role_permissions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read reminders"   ON bajaj_reminders FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "write reminders"  ON bajaj_reminders FOR ALL    USING (is_bajaj_approved() OR is_bajaj_admin());

CREATE POLICY "read role_perms"  ON bajaj_role_permissions FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "admin role_perms" ON bajaj_role_permissions FOR ALL    USING (is_bajaj_admin());
