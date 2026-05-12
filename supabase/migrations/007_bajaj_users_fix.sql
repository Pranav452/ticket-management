-- Fix bajaj_users: add missing columns + make user_id nullable
-- Run this in Supabase SQL Editor after RESET_fresh_schema.sql

ALTER TABLE bajaj_users
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE bajaj_users
  ADD COLUMN IF NOT EXISTS role        text NOT NULL DEFAULT 'viewer'
                                       CHECK (role IN ('superadmin','admin','operator','viewer')),
  ADD COLUMN IF NOT EXISTS department  text,
  ADD COLUMN IF NOT EXISTS supabase_uid text UNIQUE;
