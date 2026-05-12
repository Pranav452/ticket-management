-- 006_column_assignments_status_name.sql
-- Add status_name to column assignments so the client can match permissions
-- against the MSSQL status name without cross-DB UUID lookups.

ALTER TABLE bajaj_column_assignments
  ADD COLUMN IF NOT EXISTS status_name text;

CREATE INDEX IF NOT EXISTS bajaj_col_assign_status_name_idx
  ON bajaj_column_assignments (module_slug, status_name);
