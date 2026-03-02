CREATE TABLE bajaj_reminders (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id    UUID        REFERENCES bajaj_work_orders(id) ON DELETE CASCADE,
  module_id        UUID        NOT NULL REFERENCES bajaj_modules(id) ON DELETE CASCADE,
  work_order_summary TEXT      NOT NULL DEFAULT '',
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at           TIMESTAMPTZ NOT NULL,
  days_offset      INTEGER     NOT NULL DEFAULT 0,
  recipients       TEXT[]      NOT NULL DEFAULT '{}',
  message          TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','sent','done')),
  sent_at          TIMESTAMPTZ,
  done_at          TIMESTAMPTZ
);
CREATE INDEX bajaj_reminders_due_at_idx     ON bajaj_reminders(due_at);
CREATE INDEX bajaj_reminders_status_idx     ON bajaj_reminders(status);
CREATE INDEX bajaj_reminders_created_by_idx ON bajaj_reminders(created_by);

ALTER TABLE bajaj_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_select" ON bajaj_reminders FOR SELECT
  USING (created_by = auth.uid() OR is_bajaj_admin());
CREATE POLICY "reminders_insert" ON bajaj_reminders FOR INSERT
  WITH CHECK (created_by = auth.uid() AND is_bajaj_approved());
CREATE POLICY "reminders_update" ON bajaj_reminders FOR UPDATE
  USING (created_by = auth.uid() OR is_bajaj_admin());
CREATE POLICY "reminders_delete" ON bajaj_reminders FOR DELETE
  USING (created_by = auth.uid() OR is_bajaj_admin());
