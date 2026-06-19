/**
 * Shared Bajaj Excel → work-order mapping logic.
 *
 * Used by both the one-off June refill script (scripts/import-june-2026.mjs)
 * and the production import route (app/api/bajaj/import/route.ts) so there is a
 * single source of truth for header mapping, value coercion, status derivation
 * and the parts/frames category tag.
 *
 * Plain ESM JavaScript (no TS) so Node scripts can import it directly.
 */

/* ── Header → canonical data key ──────────────────────────────────────────────
 * Keys are normalized (lower-case, single-spaced). The canonical keys reproduce
 * the vocabulary already present in the live board data so cards render the same.
 * NOTE: "type" is intentionally absent — it appears twice in the sheet and is
 * disambiguated by occurrence in buildColMap (1st → cont_type, 2nd → veh_category).
 */
export const HEADER_MAP = {
  "wo": "wo",
  "wo no": "wo",
  "wo no.": "wo",
  "work order": "wo",
  "work order no": "wo",
  "wodt": "wodt",
  "wo date": "wodt",
  "port": "port",
  "port (wo/pod)": "port",
  "pod": "port",
  "country": "country",
  "veh": "veh",
  "qty": "qty",
  "quantity": "qty",
  "cont": "cont",
  "40hc": "hc40",
  "40 hc": "hc40",
  "40hc qty": "hc40",
  "std20": "std20",
  "std 20": "std20",
  "stuffing date": "stuffing_dt",
  "vsl name": "vslname",
  "s/line": "s_line",
  "s line": "s_line",
  "agent": "agent",
  "cha": "agent",
  "transporter": "transporter",
  "plant": "plant",
  "po no": "po_no",
  "po no.": "po_no",
  "lc no": "lc_no",
  "lc date": "lc_date",
  "haz": "haz",
  "consignee": "consignee",
  "remark": "remark",
  "remarks": "remark",
  "remark 1": "remark",
  "d/o given dt": "do_given_dt",
  "booking no": "booking_no",
  "booking no.": "booking_no",
  "bookingno": "booking_no",
  "container no": "container_no",
  "pol gate": "pol_gate",
  "gate open": "gate_open",
  "gate cut off": "gate_cut_off",
  "si cut off": "si_cutoff",
  "do etd": "do_etd",
  "current etd": "current_etd",
  "eta at destination": "eta_at_destination",
  "final vsl sob": "final_vsl_sob",
  "vgm submitted": "vgm_submitted",
  "si submitted": "si_submitted",
  "bl no": "blno",
  "blno": "blno",
  "bl dt": "bldt",
  "bl date": "bldt",
  "bl hand over time": "bl_handover_time",
  "ff job": "ff_job",
  "s/line payment status": "sline_payment",
  "s line payment status": "sline_payment",
  "clearance point": "clearance_point",
  "open order": "open_order",
  "buffer yard": "buffer_yard",
  "e doc status": "e_doc_status",
  "courier dt": "courier_dt",
  "pick up dt": "pickup_dt",
  "cntr dispatch": "cntr_dispatch",
  "cntr report nhava sheva": "cntr_report",
  "cntr gated in port": "cntr_gated",
  "sb no": "sbno",
  "sbno": "sbno",
  "sb date": "sb_date",
  "sailing date": "sailingdt",
  "etd": "sailingdt",
  "for hbl": "for_hbl",
  "assy config": "assy_config",
};

/* Sheet name → module slug. parts/frames flag drives the category tag. */
export const SHEET_MODULE_MAP = {
  "vipar": { slug: "vipar" },
  "sri lanka": { slug: "srilanka" },
  "sri lanka parts and frams": { slug: "srilanka", partsFrames: true },
  "bangladesh": { slug: "bangladesh" },
  "nigeria": { slug: "nigeria" },
  "trimph": { slug: "triumph" },
  "triumph": { slug: "triumph" },
};

/* Integer fields. */
const INT_KEYS = new Set(["qty", "cont", "hc40", "std20"]);

export function normHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build { colIndex(1-based) → canonicalKey } from an ExcelJS header row's
 * `.values` array (index 0 is empty). Disambiguates the two "Type" columns.
 */
export function buildColMap(headerValues) {
  const map = {};
  let typeSeen = 0;
  headerValues.forEach((h, idx) => {
    if (idx === 0 || h == null) return;
    const norm = normHeader(h);
    if (norm === "type") {
      map[idx] = typeSeen === 0 ? "cont_type" : "veh_category";
      typeSeen++;
      return;
    }
    const key = HEADER_MAP[norm];
    if (key) map[idx] = key;
  });
  return map;
}

/** Format any ExcelJS cell value to a clean scalar (dates → YYYY-MM-DD). */
export function formatCell(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return formatCell(v.text);
    if ("result" in v) return formatCell(v.result);
    if ("richText" in v && Array.isArray(v.richText)) {
      return formatCell(v.richText.map((r) => r.text).join(""));
    }
    if ("hyperlink" in v && v.hyperlink) return formatCell(v.hyperlink);
  }
  return String(v).trim() || null;
}

/** Coerce a raw cell value for a given canonical key. */
export function coerceValue(key, raw) {
  if (INT_KEYS.has(key)) {
    if (raw == null || raw === "") return null;
    const n = parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return formatCell(raw);
}

/**
 * Build the `data` jsonb for one row.
 * @param colMap   { colIndex → canonicalKey }
 * @param rowValues ExcelJS row.values (1-based)
 * @param opts     { partsFrames?: bool }
 * @returns data object, or null when the row has no WO number.
 */
export function buildRecord(colMap, rowValues, opts = {}) {
  const data = {};
  for (const [idxStr, key] of Object.entries(colMap)) {
    const v = coerceValue(key, rowValues[parseInt(idxStr, 10)]);
    if (v !== null && v !== undefined && v !== "") data[key] = v;
  }
  const wo = data.wo != null ? String(data.wo).trim() : "";
  if (!wo) return null;

  // Card title shows brand · variant — surface the cargo name via variant.
  if (data.veh && !data.variant) data.variant = data.veh;

  // Parts vs frames tag (only meaningful on the dedicated SL sheet).
  if (opts.partsFrames) {
    data.category = deriveCategory(data.veh);
    data.source_sheet = "SL Parts & Frames";
  }
  return data;
}

/** PARTS / FRAMES / VEHICLE from the vehicle description text. */
export function deriveCategory(veh) {
  const s = String(veh ?? "");
  if (/fram/i.test(s)) return "FRAMES";
  if (/part/i.test(s)) return "PARTS";
  return "VEHICLE";
}

/**
 * Derive a lifecycle status NAME from the row data. Most-advanced match wins;
 * everything else falls back to Planning. Caller maps the name → status UUID.
 */
export function deriveStatusName(d) {
  const has = (k) => d[k] != null && String(d[k]).trim() !== "";
  const sl = String(d.sline_payment ?? "").toUpperCase();

  if (has("bl_handover_time") && sl.includes("INV")) return "Completed";
  if (sl.includes("INV") || has("courier_dt")) return "Billing";
  if (has("blno") && has("bldt")) return "BL Release";
  if (has("cntr_gated") || has("gate_open")) return "Gate Open";
  if (has("sbno") && has("sb_date")) return "Custom Clearance";
  if (has("si_submitted") || has("si_cutoff")) return "SI Filing";
  if (has("container_no")) return "Container Allocation";
  if (has("booking_no")) return "Booking";
  if (has("vslname") || has("s_line")) return "Booking Request";
  return "Planning";
}

/** Default card-face configuration applied to every module after refill. */
export const DEFAULT_CARD_FACE_FIELDS = [
  "category", "veh", "cont", "cont_type", "vslname", "port", "current_etd", "haz",
];
