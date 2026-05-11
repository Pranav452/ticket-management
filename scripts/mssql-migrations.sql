-- ═══════════════════════════════════════════════════════════════════════════
-- Bajaj MSSQL Migrations — run these against your SQL Server database
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add supabase_uid to bajaj_users ──────────────────────────────────────
-- Required for the chat module: links MSSQL users to Supabase auth.users(id)
-- After adding this column, have all users log in once so the column gets stamped
-- (the /api/bajaj/auth/me route auto-stamps it on every login).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('bajaj_users') AND name = 'supabase_uid'
)
BEGIN
  ALTER TABLE bajaj_users ADD supabase_uid NVARCHAR(36) NULL;
  PRINT 'Added supabase_uid to bajaj_users';
END
ELSE
  PRINT 'supabase_uid already exists on bajaj_users';
GO

-- ─── 2. Add module_slug to bajaj_wo_meta ─────────────────────────────────────
-- Required for Bangladesh fix: allows NULL-country rows to be filtered by module
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('bajaj_wo_meta') AND name = 'module_slug'
)
BEGIN
  ALTER TABLE bajaj_wo_meta ADD module_slug VARCHAR(50) NULL;
  PRINT 'Added module_slug to bajaj_wo_meta';
END
ELSE
  PRINT 'module_slug already exists on bajaj_wo_meta';
GO

-- ─── 3. (Optional) Fix Bangladesh NULL-country rows ──────────────────────────
-- Only run after confirming all NULL-country rows belong to Bangladesh module.
-- Alternatively use POST /api/bajaj/repair with { "moduleSlug": "bangladesh" }.
-- UPDATE bajaj_work_orders SET country = 'Bangladesh' WHERE country IS NULL OR country = '';
-- GO
