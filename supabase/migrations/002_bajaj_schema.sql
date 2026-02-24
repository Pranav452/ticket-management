-- ─────────────────────────────────────────────────────────────────────────────
-- Bajaj Auto Shipment Management Module
-- Migration: 002_bajaj_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Modules (the 5 Excel sheets / boards) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bajaj_modules (name, slug, display_order) VALUES
  ('Vipar',      'vipar',      1),
  ('Sri Lanka',  'srilanka',   2),
  ('Nigeria',    'nigeria',    3),
  ('Bangladesh', 'bangladesh', 4),
  ('Triumph',    'triumph',    5)
ON CONFLICT (slug) DO NOTHING;

-- ─── Status/Column definitions ───────────────────────────────────────────────
-- Populated automatically from the Excel "Color Coding Legend" sheet on first import.
CREATE TABLE IF NOT EXISTS bajaj_statuses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color_hex     text NOT NULL,       -- e.g. "FFFF00"
  display_order int  NOT NULL DEFAULT 0,
  UNIQUE (module_id, color_hex)
);

-- ─── Per-module board configuration ──────────────────────────────────────────
-- Set once during the first import for a module.
CREATE TABLE IF NOT EXISTS bajaj_board_config (
  module_id        uuid PRIMARY KEY REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  card_face_fields text[]  NOT NULL DEFAULT '{}',   -- column keys to display on card
  unique_key_field text,                            -- Excel column used for deduplication
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Import batches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_import_batches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid        NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  filename    text        NOT NULL,
  imported_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_count   int         NOT NULL DEFAULT 0,
  added_count int         NOT NULL DEFAULT 0
);

-- ─── Work orders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_work_orders (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid     NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  status_id       uuid     REFERENCES bajaj_statuses(id) ON DELETE SET NULL,
  data            jsonb    NOT NULL DEFAULT '{}',  -- all Excel columns as key/value
  assigned_to     uuid     REFERENCES profiles(id) ON DELETE SET NULL,
  column_order    float8   NOT NULL DEFAULT 0,
  import_batch_id uuid     REFERENCES bajaj_import_batches(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION bajaj_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bajaj_work_orders_updated_at ON bajaj_work_orders;
CREATE TRIGGER bajaj_work_orders_updated_at
  BEFORE UPDATE ON bajaj_work_orders
  FOR EACH ROW EXECUTE FUNCTION bajaj_set_updated_at();

-- ─── Comments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES bajaj_work_orders(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Bajaj module user approvals ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email       text NOT NULL,
  full_name   text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajaj_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action      text NOT NULL,
    -- 'moved_card' | 'edited_field' | 'assigned' | 'commented'
    -- | 'imported' | 'approved_user' | 'rejected_user' | 'requested_access'
  target_type text,   -- 'work_order' | 'bajaj_user' | 'import_batch'
  target_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS bajaj_work_orders_module_id_idx   ON bajaj_work_orders (module_id);
CREATE INDEX IF NOT EXISTS bajaj_work_orders_status_id_idx   ON bajaj_work_orders (status_id);
CREATE INDEX IF NOT EXISTS bajaj_work_orders_assigned_to_idx ON bajaj_work_orders (assigned_to);
CREATE INDEX IF NOT EXISTS bajaj_work_orders_column_order_idx ON bajaj_work_orders (module_id, status_id, column_order);
CREATE INDEX IF NOT EXISTS bajaj_comments_work_order_idx     ON bajaj_comments (work_order_id);
CREATE INDEX IF NOT EXISTS bajaj_audit_logs_actor_idx        ON bajaj_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS bajaj_audit_logs_created_at_idx   ON bajaj_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS bajaj_audit_logs_target_idx       ON bajaj_audit_logs (target_type, target_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE bajaj_modules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_statuses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_board_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_import_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_work_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajaj_audit_logs       ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user the Bajaj admin?
CREATE OR REPLACE FUNCTION is_bajaj_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = 'pranavnairop090@gmail.com'
  );
$$;

-- Helper: is the current user an approved Bajaj user?
CREATE OR REPLACE FUNCTION is_bajaj_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM bajaj_users
    WHERE user_id = auth.uid()
      AND status = 'approved'
  ) OR is_bajaj_admin();
$$;

-- bajaj_modules: all approved users can read; admin can manage
CREATE POLICY "bajaj_modules_select" ON bajaj_modules FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_modules_admin"  ON bajaj_modules USING (is_bajaj_admin());

-- bajaj_statuses: all approved users can read; admin can manage
CREATE POLICY "bajaj_statuses_select" ON bajaj_statuses FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_statuses_admin"  ON bajaj_statuses USING (is_bajaj_admin());

-- bajaj_board_config: approved users read; admin full
CREATE POLICY "bajaj_board_config_select" ON bajaj_board_config FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_board_config_admin"  ON bajaj_board_config USING (is_bajaj_admin());

-- bajaj_import_batches: approved users read; admin full
CREATE POLICY "bajaj_import_batches_select" ON bajaj_import_batches FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_import_batches_admin"  ON bajaj_import_batches USING (is_bajaj_admin());
-- Allow approved users to insert their own import batches
CREATE POLICY "bajaj_import_batches_insert" ON bajaj_import_batches FOR INSERT
  WITH CHECK (is_bajaj_approved() AND imported_by = auth.uid());

-- bajaj_work_orders: approved users read/update; admin full
CREATE POLICY "bajaj_work_orders_select" ON bajaj_work_orders FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_work_orders_update" ON bajaj_work_orders FOR UPDATE USING (is_bajaj_approved());
CREATE POLICY "bajaj_work_orders_insert" ON bajaj_work_orders FOR INSERT WITH CHECK (is_bajaj_approved());
CREATE POLICY "bajaj_work_orders_admin"  ON bajaj_work_orders USING (is_bajaj_admin());

-- bajaj_comments: approved users read + insert own; admin full
CREATE POLICY "bajaj_comments_select" ON bajaj_comments FOR SELECT USING (is_bajaj_approved());
CREATE POLICY "bajaj_comments_insert" ON bajaj_comments FOR INSERT
  WITH CHECK (is_bajaj_approved() AND author_id = auth.uid());
CREATE POLICY "bajaj_comments_admin"  ON bajaj_comments USING (is_bajaj_admin());

-- bajaj_users: admin full; users can see their own row + insert their own pending row
CREATE POLICY "bajaj_users_own_select" ON bajaj_users FOR SELECT
  USING (user_id = auth.uid() OR is_bajaj_admin());
CREATE POLICY "bajaj_users_own_insert" ON bajaj_users FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bajaj_users_admin"      ON bajaj_users USING (is_bajaj_admin());

-- bajaj_audit_logs: admin read only; service role inserts via API routes
CREATE POLICY "bajaj_audit_logs_admin" ON bajaj_audit_logs FOR SELECT USING (is_bajaj_admin());

-- ─── Allow API routes (service role) to bypass RLS for audit log inserts ──────
-- (Service role key bypasses RLS by default in Supabase — no extra policy needed)
