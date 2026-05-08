// scripts/migrate-stages.js
// Run: node scripts/migrate-stages.js

const sql = require("mssql");

const config = {
  server: "180.179.207.163",
  port: 1433,
  user: "jolly_a",
  password: "Mpprod51",
  database: "LinksDB20",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

// Module IDs from DB
const MODULES = [
  { slug: "vipar",      id: "872CA1CC-7F0E-454D-AEC6-2783BEB6B5A6" },
  { slug: "srilanka",   id: "368F5AB4-0388-486C-832B-493D3EA865B8" },
  { slug: "nigeria",    id: "AA41BD18-EE57-49FA-A22D-F0517B655D98" },
  { slug: "bangladesh", id: "0CCE3091-E713-4504-8B6A-1D0B8DB91EE1" },
  { slug: "triumph",    id: "C32F3C67-97FE-466D-A1D0-8682E752B0FD" },
];

const STAGES = [
  { name: "Planning",             color_hex: "3b82f6", display_order: 1 },
  { name: "Booking",              color_hex: "06b6d4", display_order: 2 },
  { name: "Container Allocation", color_hex: "8b5cf6", display_order: 3 },
  { name: "SI Filing",            color_hex: "eab308", display_order: 4 },
  { name: "Custom Clearance",     color_hex: "f97316", display_order: 5 },
  { name: "Billing",              color_hex: "ec4899", display_order: 6 },
  { name: "BL Release",           color_hex: "22c55e", display_order: 7 },
  { name: "Completed",            color_hex: "6b7280", display_order: 8 },
];

const TEST_USERS = [
  { email: "superadmin@links.com", full_name: "Super Admin",   role: "superadmin",  department: null },
  { email: "admin@links.com",      full_name: "Admin User",    role: "admin",       department: null },
  { email: "ops@links.com",        full_name: "Ops Team",      role: "operator",    department: "Operations" },
  { email: "docs@links.com",       full_name: "Docs Team",     role: "operator",    department: "Documentation" },
  { email: "viewer@links.com",     full_name: "Viewer User",   role: "viewer",      department: null },
];

// Default permissions per role
// [can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users]
const ROLE_PERMISSIONS = [
  { role: "superadmin", can_view: 1, can_edit_fields: 1, can_move_stage: 1, can_import: 1, can_export: 1, can_manage_users: 1 },
  { role: "admin",      can_view: 1, can_edit_fields: 1, can_move_stage: 1, can_import: 1, can_export: 1, can_manage_users: 0 },
  { role: "operator",   can_view: 1, can_edit_fields: 1, can_move_stage: 1, can_import: 0, can_export: 0, can_manage_users: 0 },
  { role: "viewer",     can_view: 1, can_edit_fields: 0, can_move_stage: 0, can_import: 0, can_export: 0, can_manage_users: 0 },
];

const MODULE_SLUGS = MODULES.map(m => m.slug);

async function run() {
  console.log("Connecting to MSSQL…");
  const pool = await sql.connect(config);
  console.log("Connected.\n");

  try {
    // ── 1. Delete old statuses ──────────────────────────────────────────────
    console.log("Deleting old statuses from bajaj_statuses…");
    const delResult = await pool.request().query(`DELETE FROM bajaj_statuses`);
    console.log(`  Deleted ${delResult.rowsAffected[0]} rows.\n`);

    // ── 2. Insert 8 new stages per module (40 rows total) ──────────────────
    console.log("Inserting new stages…");
    let insertedCount = 0;
    for (const mod of MODULES) {
      for (const stage of STAGES) {
        await pool.request()
          .input("id",            sql.NVarChar(36),  `${mod.id}-${stage.display_order}`.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 36))
          .input("module_id",     sql.NVarChar(36),  mod.id)
          .input("name",          sql.NVarChar(100), stage.name)
          .input("color_hex",     sql.NVarChar(20),  stage.color_hex)
          .input("display_order", sql.Int,           stage.display_order)
          .query(`
            INSERT INTO bajaj_statuses (id, module_id, name, color_hex, display_order)
            VALUES (NEWID(), @module_id, @name, @color_hex, @display_order)
          `);
        insertedCount++;
      }
      console.log(`  Inserted 8 stages for ${mod.slug}`);
    }
    console.log(`  Total inserted: ${insertedCount} rows.\n`);

    // ── 3. Add role & department columns to bajaj_users if missing ──────────
    console.log("Checking bajaj_users columns…");
    const colCheck = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'bajaj_users'
      AND COLUMN_NAME IN ('role', 'department')
    `);
    const existingCols = colCheck.recordset.map(r => r.COLUMN_NAME);

    if (!existingCols.includes("role")) {
      await pool.request().query(`ALTER TABLE bajaj_users ADD role VARCHAR(20) NULL`);
      console.log("  Added column: role");
    } else {
      console.log("  Column 'role' already exists.");
    }

    if (!existingCols.includes("department")) {
      await pool.request().query(`ALTER TABLE bajaj_users ADD department VARCHAR(50) NULL`);
      console.log("  Added column: department");
    } else {
      console.log("  Column 'department' already exists.");
    }
    console.log();

    // ── 4. Create bajaj_role_permissions table if not exists ────────────────
    console.log("Creating bajaj_role_permissions table if not exists…");
    const tblCheck = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'bajaj_role_permissions'
    `);
    if (tblCheck.recordset.length === 0) {
      await pool.request().query(`
        CREATE TABLE bajaj_role_permissions (
          id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          role            VARCHAR(20)      NOT NULL,
          module_slug     VARCHAR(50)      NOT NULL DEFAULT '*',
          can_view        BIT              NOT NULL DEFAULT 1,
          can_edit_fields BIT              NOT NULL DEFAULT 0,
          can_move_stage  BIT              NOT NULL DEFAULT 0,
          can_import      BIT              NOT NULL DEFAULT 0,
          can_export      BIT              NOT NULL DEFAULT 0,
          can_manage_users BIT             NOT NULL DEFAULT 0,
          created_at      DATETIME         DEFAULT GETDATE(),
          CONSTRAINT UQ_role_module UNIQUE (role, module_slug)
        )
      `);
      console.log("  Created table bajaj_role_permissions.\n");
    } else {
      console.log("  Table already exists.\n");
    }

    // ── 5. Insert default role permissions (skip if exists) ─────────────────
    console.log("Inserting default role permissions…");
    for (const perm of ROLE_PERMISSIONS) {
      const exists = await pool.request()
        .input("role",        sql.VarChar(20),  perm.role)
        .input("module_slug", sql.VarChar(50),  "*")
        .query(`SELECT COUNT(*) AS cnt FROM bajaj_role_permissions WHERE role=@role AND module_slug=@module_slug`);
      if (exists.recordset[0].cnt === 0) {
        await pool.request()
          .input("role",             sql.VarChar(20), perm.role)
          .input("module_slug",      sql.VarChar(50), "*")
          .input("can_view",         sql.Bit,         perm.can_view)
          .input("can_edit_fields",  sql.Bit,         perm.can_edit_fields)
          .input("can_move_stage",   sql.Bit,         perm.can_move_stage)
          .input("can_import",       sql.Bit,         perm.can_import)
          .input("can_export",       sql.Bit,         perm.can_export)
          .input("can_manage_users", sql.Bit,         perm.can_manage_users)
          .query(`
            INSERT INTO bajaj_role_permissions
              (id, role, module_slug, can_view, can_edit_fields, can_move_stage, can_import, can_export, can_manage_users)
            VALUES
              (NEWID(), @role, @module_slug, @can_view, @can_edit_fields, @can_move_stage, @can_import, @can_export, @can_manage_users)
          `);
        console.log(`  Inserted permissions for role: ${perm.role}`);
      } else {
        console.log(`  Permissions for role '${perm.role}' already exist, skipping.`);
      }
    }
    console.log();

    // ── 6. Insert test users ────────────────────────────────────────────────
    console.log("Inserting test users…");
    for (const u of TEST_USERS) {
      const exists = await pool.request()
        .input("email", sql.NVarChar(255), u.email)
        .query(`SELECT COUNT(*) AS cnt FROM bajaj_users WHERE email=@email`);
      if (exists.recordset[0].cnt === 0) {
        const req = pool.request()
          .input("email",      sql.NVarChar(255), u.email)
          .input("full_name",  sql.NVarChar(255), u.full_name)
          .input("role",       sql.VarChar(20),   u.role)
          .input("status",     sql.VarChar(20),   "approved");
        if (u.department) {
          req.input("department", sql.VarChar(50), u.department);
          await req.query(`
            INSERT INTO bajaj_users (id, email, full_name, status, role, department, created_at)
            VALUES (NEWID(), @email, @full_name, @status, @role, @department, GETDATE())
          `);
        } else {
          await req.query(`
            INSERT INTO bajaj_users (id, email, full_name, status, role, created_at)
            VALUES (NEWID(), @email, @full_name, @status, @role, GETDATE())
          `);
        }
        console.log(`  Inserted user: ${u.email} (${u.role})`);
      } else {
        // Update role and status to make sure they're correct
        await pool.request()
          .input("email",  sql.NVarChar(255), u.email)
          .input("role",   sql.VarChar(20),   u.role)
          .input("status", sql.VarChar(20),   "approved")
          .query(`UPDATE bajaj_users SET role=@role, status=@status WHERE email=@email`);
        console.log(`  Updated user: ${u.email} (${u.role}) - already existed`);
      }
    }
    console.log();

    console.log("Migration complete!");
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
