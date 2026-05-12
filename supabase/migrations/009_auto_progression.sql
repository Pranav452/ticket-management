-- Migration 009: Admin-configurable field → stage auto-progression rules
-- Each row says: "for module X, when trigger_field goes from empty → filled,
-- auto-move the work order to target_status_name (if not already past it)."

CREATE TABLE IF NOT EXISTS bajaj_auto_progression (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug         text        NOT NULL,
  trigger_field       text        NOT NULL,   -- field key in WO data JSONB
  target_status_name  text        NOT NULL,   -- destination stage name (matched with ILIKE)
  description         text,                   -- human-readable explanation
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, trigger_field)
);

ALTER TABLE bajaj_auto_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read auto_progression"  ON bajaj_auto_progression FOR SELECT USING (is_bajaj_approved() OR is_bajaj_admin());
CREATE POLICY "admin auto_progression" ON bajaj_auto_progression FOR ALL    USING (is_bajaj_admin());

-- Seed: LINKS invoice_no → Completed is already hard-coded in workflow.ts (Rule 3).
-- Add any additional default rules here.
-- Example (uncomment to activate):
-- INSERT INTO bajaj_auto_progression (module_slug, trigger_field, target_status_name, description) VALUES
--   ('srilanka', 'booking_no', 'Booking', 'Booking number filled → move to Booking stage'),
--   ('srilanka', 'sbno',       'Custom Clearance', 'SB number filled → move to Custom Clearance');
