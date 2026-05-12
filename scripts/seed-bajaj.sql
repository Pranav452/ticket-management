-- Bajaj Auto Shipment Management — Realistic Seed Data
-- Run against LinksDB20 (MSSQL)
-- Covers all 5 modules across multiple lifecycle stages

SET NOCOUNT ON;

-- ─── Helper: clear test rows (WO numbers 9000000–9000099) ───────────────────
DELETE FROM bajaj_wo_meta    WHERE wo_id IN (SELECT id FROM bajaj_work_orders WHERE wo LIKE '900000%');
DELETE FROM bajaj_work_orders WHERE wo LIKE '900000%';

-- ─── NIGERIA ────────────────────────────────────────────────────────────────
INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
VALUES
  ('9000001','Nigeria','Apapa Lagos','KSHIP LOGISTICS','Waluj','Pulsar NS200','STD',  80, 2, 'PO-NG-2026-001','LC-NG-8821',NULL),
  ('9000002','Nigeria','Apapa Lagos','KSHIP LOGISTICS','Chakan','CT100B',     'STD', 120, 3, 'PO-NG-2026-002','LC-NG-8822','2026-02-15'),
  ('9000003','Nigeria','Apapa Lagos','DSV AIR & SEA',  'Waluj','Discover 125','DLX', 60, 2, 'PO-NG-2026-003','LC-NG-8823','2026-02-20'),
  ('9000004','Nigeria','Apapa Lagos','DSV AIR & SEA',  'Chakan','Avenger 220','STD', 40, 1, 'PO-NG-2026-004', NULL,       '2026-03-01'),
  ('9000005','Nigeria','Apapa Lagos','KSHIP LOGISTICS','Waluj','Platina 110', 'H',  160, 4, 'PO-NG-2026-005','LC-NG-8824',NULL);

-- ─── SRI LANKA ──────────────────────────────────────────────────────────────
INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
VALUES
  ('9000010','Sri Lanka','Colombo','TRANSWAY INTL',  'Chakan',    'Pulsar NS160','STD', 50, 2, 'PO-SL-2026-001','LC-SL-4401','2026-02-10'),
  ('9000011','Sri Lanka','Colombo','TRANSWAY INTL',  'Waluj',     'CT100B',      'STD',100, 3, 'PO-SL-2026-002','LC-SL-4402','2026-02-18'),
  ('9000012','Sri Lanka','Colombo','FREIGHT CONNECT','Pantnagar',  'Discover 125','DLX', 75, 2, 'PO-SL-2026-003', NULL,       '2026-03-05'),
  ('9000013','Sri Lanka','Colombo','FREIGHT CONNECT','Chakan',    'Platina 110', 'H',  200, 5, 'PO-SL-2026-004','LC-SL-4403','2026-03-10');

-- ─── BANGLADESH ─────────────────────────────────────────────────────────────
INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
VALUES
  ('9000020','Bangladesh','Chattogram','CONCORDE LINES','Waluj',  'Pulsar N250','STD', 30, 1, 'PO-BD-2026-001','LC-BD-7701','2026-01-28'),
  ('9000021','Bangladesh','Chattogram','CONCORDE LINES','Chakan', 'CT100B',     'STD', 90, 3, 'PO-BD-2026-002','LC-BD-7702','2026-02-08'),
  ('9000022','Bangladesh','Chattogram','ATLAS SHIPPING', 'Waluj', 'Discover 125','DLX', 45, 2, 'PO-BD-2026-003', NULL,       '2026-02-22');

-- ─── TRIUMPH (United Kingdom) ────────────────────────────────────────────────
INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
VALUES
  ('9000030','United Kingdom','Felixstowe','CARMICHAEL INTL','Chakan','Triumph Speed 400','STD', 20, 1, 'PO-UK-2026-001', NULL,      '2026-02-01'),
  ('9000031','United Kingdom','Felixstowe','CARMICHAEL INTL','Chakan','Triumph Speed Triple','DLX',10, 1, 'PO-UK-2026-002','LC-UK-001','2026-02-14');

-- ─── VIPAR (Dominican Republic / Morocco / Liberia) ─────────────────────────
INSERT INTO bajaj_work_orders (wo, country, port, agent, plant, veh, type, qty, cont, po_no, lc_no, do_given_dt)
VALUES
  ('9000040','Dominican Republic','Puerto Caucedo','TRANSCARGO','Waluj', 'Pulsar NS200','STD', 70, 2, 'PO-DR-2026-001','LC-DR-5501','2026-01-20'),
  ('9000041','Morocco',           'Casablanca',    'ATLAS TRANS','Chakan','CT100B',     'STD',110, 3, 'PO-MA-2026-001','LC-MA-5502','2026-02-05'),
  ('9000042','Liberia',           'Monrovia',      'TRANSCARGO', 'Waluj', 'Discover 125','DLX', 55, 2, 'PO-LR-2026-001', NULL,      '2026-02-12'),
  ('9000043','Dominican Republic','Puerto Caucedo','ATLAS TRANS','Pantnagar','Platina 110','H', 90, 3, 'PO-DR-2026-002','LC-DR-5503','2026-02-28');

-- ─── Inject meta rows with varied statuses ──────────────────────────────────
-- Status IDs come from bajaj_statuses; we assign NULL (Planning) or a real ID
-- Use stage index 0–9 to spread across lifecycle

-- Pull status IDs dynamically for each module
DECLARE @status_planning   VARCHAR(100),
        @status_booking    VARCHAR(100),
        @status_container  VARCHAR(100),
        @status_si         VARCHAR(100),
        @status_custom     VARCHAR(100),
        @status_gate       VARCHAR(100),
        @status_billing    VARCHAR(100),
        @status_bl         VARCHAR(100),
        @status_completed  VARCHAR(100);

-- Nigeria statuses
SELECT TOP 1 @status_planning  = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Planning%'   ORDER BY display_order;
SELECT TOP 1 @status_booking   = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Booking%'     ORDER BY display_order;
SELECT TOP 1 @status_container = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Container%'   ORDER BY display_order;
SELECT TOP 1 @status_si        = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%SI%'          ORDER BY display_order;
SELECT TOP 1 @status_custom    = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Custom%'      ORDER BY display_order;
SELECT TOP 1 @status_gate      = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Gate%'        ORDER BY display_order;
SELECT TOP 1 @status_billing   = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Billing%'     ORDER BY display_order;
SELECT TOP 1 @status_bl        = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%BL%'          ORDER BY display_order;
SELECT TOP 1 @status_completed = id FROM bajaj_statuses WHERE module_id IN (SELECT id FROM bajaj_modules WHERE slug='nigeria') AND name LIKE '%Complet%'     ORDER BY display_order;

-- Nigeria meta
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, NULL,               NULL, 0, 'nigeria' FROM bajaj_work_orders WHERE wo='9000001';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_booking,    NULL, 1, 'nigeria' FROM bajaj_work_orders WHERE wo='9000002';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_container,  NULL, 2, 'nigeria' FROM bajaj_work_orders WHERE wo='9000003';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_si,         NULL, 3, 'nigeria' FROM bajaj_work_orders WHERE wo='9000004';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_completed,  NULL, 4, 'nigeria' FROM bajaj_work_orders WHERE wo='9000005';

-- Sri Lanka meta (use same status IDs, module_slug differs)
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, NULL,               NULL, 0, 'srilanka' FROM bajaj_work_orders WHERE wo='9000010';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_booking,    NULL, 1, 'srilanka' FROM bajaj_work_orders WHERE wo='9000011';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_gate,       NULL, 2, 'srilanka' FROM bajaj_work_orders WHERE wo='9000012';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_completed,  NULL, 3, 'srilanka' FROM bajaj_work_orders WHERE wo='9000013';

-- Bangladesh meta
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_custom,     NULL, 0, 'bangladesh' FROM bajaj_work_orders WHERE wo='9000020';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, NULL,               NULL, 1, 'bangladesh' FROM bajaj_work_orders WHERE wo='9000021';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_billing,    NULL, 2, 'bangladesh' FROM bajaj_work_orders WHERE wo='9000022';

-- Triumph meta
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_si,         NULL, 0, 'triumph' FROM bajaj_work_orders WHERE wo='9000030';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_completed,  NULL, 1, 'triumph' FROM bajaj_work_orders WHERE wo='9000031';

-- VIPAR meta
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, NULL,               NULL, 0, 'vipar' FROM bajaj_work_orders WHERE wo='9000040';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_container,  NULL, 1, 'vipar' FROM bajaj_work_orders WHERE wo='9000041';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_bl,         NULL, 2, 'vipar' FROM bajaj_work_orders WHERE wo='9000042';
INSERT INTO bajaj_wo_meta (wo_id, status_id, assigned_to, column_order, module_slug)
SELECT id, @status_booking,    NULL, 3, 'vipar' FROM bajaj_work_orders WHERE wo='9000043';

PRINT 'Seed complete. Inserted 20 work orders across 5 modules.';
SELECT wo, country, veh, type, qty, cont FROM bajaj_work_orders WHERE wo LIKE '900000%' ORDER BY wo;
