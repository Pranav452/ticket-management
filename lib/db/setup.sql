-- ─── Bajaj Module Support Tables ──────────────────────────────────────────────
-- Run once against LinksDB20 to provision metadata tables.
-- TMP_TBL_BAJAJ_WO is left untouched (read-only source).

USE LinksDB20;
GO

-- Modules (country group buckets)
IF OBJECT_ID('bajaj_modules','U') IS NULL
CREATE TABLE bajaj_modules (
  id            VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  name          NVARCHAR(100) NOT NULL,
  slug          VARCHAR(50)   NOT NULL UNIQUE,
  display_order INT           NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Statuses per module
IF OBJECT_ID('bajaj_statuses','U') IS NULL
CREATE TABLE bajaj_statuses (
  id            VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  module_id     VARCHAR(36)   NOT NULL,
  name          NVARCHAR(100) NOT NULL,
  color_hex     VARCHAR(7)    NOT NULL DEFAULT '#6b7280',
  display_order INT           NOT NULL DEFAULT 0
);

-- Board config (which fields show on card face)
IF OBJECT_ID('bajaj_board_config','U') IS NULL
CREATE TABLE bajaj_board_config (
  module_id        VARCHAR(36)    NOT NULL PRIMARY KEY,
  card_face_fields NVARCHAR(MAX)  NOT NULL DEFAULT '[]', -- JSON array
  unique_key_field NVARCHAR(100)  NULL,
  updated_at       DATETIME       NOT NULL DEFAULT GETDATE()
);

-- Per-work-order overrides (status + assignee)
IF OBJECT_ID('bajaj_wo_meta','U') IS NULL
CREATE TABLE bajaj_wo_meta (
  pkid        INT           NOT NULL PRIMARY KEY,  -- FK → TMP_TBL_BAJAJ_WO.PKID
  status_id   VARCHAR(36)   NULL,
  assigned_to NVARCHAR(200) NULL,                  -- user email
  column_order INT          NOT NULL DEFAULT 0,
  updated_at  DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Comments
IF OBJECT_ID('bajaj_comments','U') IS NULL
CREATE TABLE bajaj_comments (
  id              VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  work_order_pkid INT           NOT NULL,
  author_email    NVARCHAR(200) NOT NULL,
  author_name     NVARCHAR(200) NULL,
  content         NVARCHAR(MAX) NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Reminders
IF OBJECT_ID('bajaj_reminders','U') IS NULL
CREATE TABLE bajaj_reminders (
  id                   VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  work_order_pkid      INT           NOT NULL,
  module_id            VARCHAR(36)   NOT NULL,
  work_order_summary   NVARCHAR(500) NOT NULL DEFAULT '',
  created_by           NVARCHAR(200) NULL,
  due_at               DATETIME      NOT NULL,
  days_offset          INT           NOT NULL DEFAULT 0,
  recipients           NVARCHAR(MAX) NOT NULL DEFAULT '[]', -- JSON array
  message              NVARCHAR(MAX) NOT NULL DEFAULT '',
  status               VARCHAR(20)   NOT NULL DEFAULT 'scheduled',
  sent_at              DATETIME      NULL,
  done_at              DATETIME      NULL,
  created_at           DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Users / access control
IF OBJECT_ID('bajaj_users','U') IS NULL
CREATE TABLE bajaj_users (
  id          VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  email       NVARCHAR(200) NOT NULL UNIQUE,
  full_name   NVARCHAR(200) NULL,
  status      VARCHAR(20)   NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  approved_by NVARCHAR(200) NULL,
  approved_at DATETIME      NULL,
  created_at  DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Audit log
IF OBJECT_ID('bajaj_audit_log','U') IS NULL
CREATE TABLE bajaj_audit_log (
  id          VARCHAR(36)   NOT NULL DEFAULT NEWID() PRIMARY KEY,
  actor_email NVARCHAR(200) NOT NULL DEFAULT 'system',
  action      NVARCHAR(200) NOT NULL,
  target_type NVARCHAR(100) NULL,
  target_id   NVARCHAR(200) NULL,
  old_value   NVARCHAR(MAX) NULL,  -- JSON
  new_value   NVARCHAR(MAX) NULL,  -- JSON
  created_at  DATETIME      NOT NULL DEFAULT GETDATE()
);

-- ─── Seed Modules ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM bajaj_modules WHERE slug='vipar')
INSERT INTO bajaj_modules (id,name,slug,display_order) VALUES
  (NEWID(),'VIPAR','vipar',1),
  (NEWID(),'Sri Lanka','srilanka',2),
  (NEWID(),'Nigeria','nigeria',3),
  (NEWID(),'Bangladesh','bangladesh',4),
  (NEWID(),'Triumph','triumph',5);

-- ─── Seed Statuses for each module ────────────────────────────────────────────
DECLARE @vId VARCHAR(36), @slId VARCHAR(36), @ngId VARCHAR(36), @bdId VARCHAR(36), @trId VARCHAR(36);
SELECT @vId=id FROM bajaj_modules WHERE slug='vipar';
SELECT @slId=id FROM bajaj_modules WHERE slug='srilanka';
SELECT @ngId=id FROM bajaj_modules WHERE slug='nigeria';
SELECT @bdId=id FROM bajaj_modules WHERE slug='bangladesh';
SELECT @trId=id FROM bajaj_modules WHERE slug='triumph';

IF NOT EXISTS (SELECT 1 FROM bajaj_statuses WHERE module_id=@vId)
BEGIN
  -- shared status set; replicate per module
  INSERT INTO bajaj_statuses (id,module_id,name,color_hex,display_order) VALUES
    (NEWID(),@vId,'WO Received','#3b82f6',1),
    (NEWID(),@vId,'SB Filed','#8b5cf6',2),
    (NEWID(),@vId,'Cargo Stuffed','#f59e0b',3),
    (NEWID(),@vId,'BL Issued','#10b981',4),
    (NEWID(),@vId,'Completed','#6b7280',5);

  INSERT INTO bajaj_statuses (id,module_id,name,color_hex,display_order) VALUES
    (NEWID(),@slId,'WO Received','#3b82f6',1),
    (NEWID(),@slId,'SB Filed','#8b5cf6',2),
    (NEWID(),@slId,'Cargo Stuffed','#f59e0b',3),
    (NEWID(),@slId,'BL Issued','#10b981',4),
    (NEWID(),@slId,'Completed','#6b7280',5);

  INSERT INTO bajaj_statuses (id,module_id,name,color_hex,display_order) VALUES
    (NEWID(),@ngId,'WO Received','#3b82f6',1),
    (NEWID(),@ngId,'SB Filed','#8b5cf6',2),
    (NEWID(),@ngId,'Cargo Stuffed','#f59e0b',3),
    (NEWID(),@ngId,'BL Issued','#10b981',4),
    (NEWID(),@ngId,'Completed','#6b7280',5);

  INSERT INTO bajaj_statuses (id,module_id,name,color_hex,display_order) VALUES
    (NEWID(),@bdId,'WO Received','#3b82f6',1),
    (NEWID(),@bdId,'SB Filed','#8b5cf6',2),
    (NEWID(),@bdId,'Cargo Stuffed','#f59e0b',3),
    (NEWID(),@bdId,'BL Issued','#10b981',4),
    (NEWID(),@bdId,'Completed','#6b7280',5);

  INSERT INTO bajaj_statuses (id,module_id,name,color_hex,display_order) VALUES
    (NEWID(),@trId,'WO Received','#3b82f6',1),
    (NEWID(),@trId,'SB Filed','#8b5cf6',2),
    (NEWID(),@trId,'Cargo Stuffed','#f59e0b',3),
    (NEWID(),@trId,'BL Issued','#10b981',4),
    (NEWID(),@trId,'Completed','#6b7280',5);
END

-- ─── Seed board config (default card-face fields) ──────────────────────────────
IF NOT EXISTS (SELECT 1 FROM bajaj_board_config WHERE module_id=@vId)
  INSERT INTO bajaj_board_config (module_id,card_face_fields,unique_key_field)
  SELECT id,
    '["WO","port","vslname","BLNO","containerno"]',
    'WO'
  FROM bajaj_modules;
GO
