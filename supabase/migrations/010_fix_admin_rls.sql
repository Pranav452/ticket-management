-- Migration 010: Fix is_bajaj_admin() to allow ALL admin/superadmin role users,
-- not just the hardcoded owner email. This unblocks nakul.tanna@linksin.com
-- (and any future admins) from reading all user rows, audit logs, etc.

CREATE OR REPLACE FUNCTION is_bajaj_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    -- original hardcoded owner always stays an admin
    auth.email() = 'pranavnairop090@gmail.com'
    OR
    -- any approved user with admin or superadmin role
    EXISTS (
      SELECT 1 FROM bajaj_users
      WHERE email  = auth.email()
        AND status = 'approved'
        AND role   IN ('admin', 'superadmin')
    )
$$;
