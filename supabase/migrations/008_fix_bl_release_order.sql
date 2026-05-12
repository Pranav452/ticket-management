-- Migration 008: Fix BL Release column order
-- BL Release must come BEFORE Billing in the workflow.
-- Correct order: ... Gate Open (6) → BL Release (7) → Billing (8) → Completed (9)

UPDATE bajaj_statuses SET display_order = 7 WHERE name = 'BL Release';
UPDATE bajaj_statuses SET display_order = 8 WHERE name = 'Billing';
