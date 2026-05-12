-- 005_column_required_fields.sql
-- Stores which fields must be filled in each lifecycle column before
-- a work order card auto-advances to the next column.

CREATE TABLE IF NOT EXISTS bajaj_column_required_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text NOT NULL,
  status_name text NOT NULL,   -- must match LIFECYCLE stage name exactly
  field_key   text NOT NULL,   -- DB column key on bajaj_work_orders
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_slug, status_name, field_key)
);

CREATE INDEX IF NOT EXISTS bajaj_crf_module_status_idx
  ON bajaj_column_required_fields (module_slug, status_name);

-- Seed default required fields for all modules
-- "Planning" and "Completed" have no requirements (cards placed manually).

DO $$
DECLARE
  slugs text[] := ARRAY['vipar','srilanka','nigeria','bangladesh','triumph'];
  s text;
BEGIN
  FOREACH s IN ARRAY slugs LOOP

    -- Booking Request: carrier (s_line), agent, vessel name (vslname)
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Booking Request', 's_line'),
      (s, 'Booking Request', 'agent'),
      (s, 'Booking Request', 'vslname')
    ON CONFLICT DO NOTHING;

    -- Booking: booking number, vessel ETD, port cut-off, SI cut-off, docs cut-off, DO ETD, VGM cut-off
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Booking', 'booking_no'),
      (s, 'Booking', 'vessel_etd'),
      (s, 'Booking', 'port_cut_off'),
      (s, 'Booking', 'si_cutoff'),
      (s, 'Booking', 'docs_cut_off'),
      (s, 'Booking', 'do_etd'),
      (s, 'Booking', 'vgm_cut_off')
    ON CONFLICT DO NOTHING;

    -- Container Allocation: transporter, current ETD, ERP-EXP number
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Container Allocation', 'transporter'),
      (s, 'Container Allocation', 'current_etd'),
      (s, 'Container Allocation', 'erp_exp_no')
    ON CONFLICT DO NOTHING;

    -- SI Filing: container numbers, SB number, HBL number, gross weight, net weight, pkgs/cases
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'SI Filing', 'container_no'),
      (s, 'SI Filing', 'sbno'),
      (s, 'SI Filing', 'hbl_no'),
      (s, 'SI Filing', 'gross_weight'),
      (s, 'SI Filing', 'net_weight'),
      (s, 'SI Filing', 'pkgs_cases')
    ON CONFLICT DO NOTHING;

    -- Custom Clearance: MBL number, POL, LEO date
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Custom Clearance', 'mbl_no'),
      (s, 'Custom Clearance', 'pol'),
      (s, 'Custom Clearance', 'leo_date')
    ON CONFLICT DO NOTHING;

    -- Gate Open: gate-in date, gate details
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Gate Open', 'gate_in_date'),
      (s, 'Gate Open', 'gate_details')
    ON CONFLICT DO NOTHING;

    -- BL Release: e-docs, BL date
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'BL Release', 'e_doc'),
      (s, 'BL Release', 'bldt')
    ON CONFLICT DO NOTHING;

    -- Billing: invoice number
    INSERT INTO bajaj_column_required_fields (module_slug, status_name, field_key)
    VALUES
      (s, 'Billing', 'invoice_no')
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;
