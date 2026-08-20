// Mapping layer: bajaj_work_orders -> the "Live Shipments" record shape used by
// the tracking list / detail panel / MapLibre route on app/(app)/bajaj/live.
//
// Pure functions only (no Supabase, no React) so both the server page and any
// future callers can reuse it.

export type LiveStatus = "COMPLETED" | "IN TRANSIT" | "PENDING" | "DELAYED";

export type LiveShipment = {
  key: string;
  id: string;
  moduleSlug: string;
  boardLabel: string;
  status: LiveStatus;
  /** status colour, exact hexes from the design spec */
  sc: string;
  mode: "ship";
  /** short transit pill on the list card, e.g. "18D" */
  dur: string;

  oCode: string;
  oCity: string;
  oDate: string;
  oCc: string;
  dCode: string;
  dCity: string;
  dDate: string;
  dCc: string;

  headline: string;
  carrier: string;
  coords: string;
  oSched: string;
  oActual: string;
  dSched: string;
  dEst: string;

  onway: string;
  progress: number;
  agent: string;
  caseId: string;
  etaConf: "HIGH" | "MEDIUM" | "LOW";
  weight: string;
  container: string;

  route: [number, number][];
  cur: [number, number];

  /** extra haystack for the client-side search box */
  search: string;
  /** sort key: lower = more relevant (on-water first, then recently updated) */
  rank: number;
};

/* ------------------------------------------------------------------ */
/* Port + country reference data                                       */
/* ------------------------------------------------------------------ */

export const ORIGIN_PORT = {
  code: "NSA",
  city: "Nhava Sheva, India",
  cc: "in",
  coord: [72.95, 18.95] as [number, number],
};

/** POD name (upper-cased, punctuation-stripped) -> 3-letter code */
const PORT_CODES: Record<string, string> = {
  COLOMBO: "CMB",
  CHATTOGRAM: "CGP",
  CHITTAGONG: "CGP",
  YANGON: "RGN",
  LUANDA: "LAD",
  "APAPA LAGOS": "LOS",
  APAPA: "LOS",
  LAGOS: "LOS",
  LEKKI: "LOS",
  TINCAN: "LOS",
  "TIN CAN": "LOS",
  ONNE: "ONN",
  SOUTHAMPTON: "SOU",
  SIHANOUKVILLE: "KOS",
  DHAKA: "DAC",
  MANAUS: "MAO",
  "BEIRA PORT": "BEW",
  BEIRA: "BEW",
  DJIBOUTI: "JIB",
  TAMATAVE: "TMM",
  TOAMASINA: "TMM",
  "LOS ANGELES": "LAX",
  NORFOLK: "ORF",
  SINGAPORE: "SIN",
  TOKYO: "TYO",
  KEELUNG: "KEL",
  "LAEM CHABANG": "LCH",
  BELAWAN: "BLW",
  "DKI JAKARTA": "JKT",
  JAKARTA: "JKT",
  "TANJUNG PRIOK": "JKT",
  AUCKLAND: "AKL",
  BUDAPEST: "BUD",
  "SAN ANTONIO": "SAI",
  "BUENOS AIRES": "BUE",
  // sensible extras seen on Bajaj lanes
  MOMBASA: "MBA",
  "DAR ES SALAAM": "DAR",
  DURBAN: "DUR",
  "PORT LOUIS": "PLU",
  "JEBEL ALI": "JEA",
  DUBAI: "JEA",
  HAMBURG: "HAM",
  ROTTERDAM: "RTM",
  ANTWERP: "ANR",
  FELIXSTOWE: "FXT",
  "PORT KLANG": "PKG",
  "HO CHI MINH": "SGN",
  "HO CHI MINH CITY": "SGN",
  HAIPHONG: "HPH",
  BUSAN: "PUS",
  SHANGHAI: "SHA",
  NINGBO: "NGB",
  QINGDAO: "TAO",
  MANILA: "MNL",
  KARACHI: "KHI",
  "UMM QASR": "UQR",
  DAMMAM: "DMM",
  JEDDAH: "JED",
  ASHDOD: "ASH",
  CALLAO: "CLL",
  VALPARAISO: "VAP",
  SANTOS: "SSZ",
  MONTEVIDEO: "MVD",
  GUAYAQUIL: "GYE",
  CARTAGENA: "CTG",
  VERACRUZ: "VER",
  HOUSTON: "HOU",
  "NEW YORK": "NYC",
  SAVANNAH: "SAV",
  MELBOURNE: "MEL",
  SYDNEY: "SYD",
  "PORT SUDAN": "PZU",
  MASSAWA: "MSW",
  MATADI: "MAT",
  TEMA: "TEM",
  ABIDJAN: "ABJ",
  DAKAR: "DKR",
  CONAKRY: "CKY",
  DOUALA: "DLA",
  WALVIS: "WVB",
  "WALVIS BAY": "WVB",
  NACALA: "MNC",
  MAPUTO: "MPM",
  TRIPOLI: "TIP",
  ALEXANDRIA: "ALY",
  MERSIN: "MER",
  IZMIR: "IZM",
  GEMLIK: "GEM",
  CONSTANTA: "CND",
  ODESSA: "ODS",
  KLAIPEDA: "KLJ",
  "ST PETERSBURG": "LED",
  NOVOROSSIYSK: "NVS",
};

/** POD name -> [lng, lat] (real port coordinates) */
const PORT_COORDS: Record<string, [number, number]> = {
  COLOMBO: [79.85, 6.95],
  CHATTOGRAM: [91.8, 22.3],
  CHITTAGONG: [91.8, 22.3],
  YANGON: [96.17, 16.77],
  LUANDA: [13.24, -8.78],
  "APAPA LAGOS": [3.36, 6.44],
  APAPA: [3.36, 6.44],
  LAGOS: [3.36, 6.44],
  LEKKI: [4.03, 6.42],
  TINCAN: [3.34, 6.44],
  "TIN CAN": [3.34, 6.44],
  ONNE: [7.15, 4.72],
  SOUTHAMPTON: [-1.42, 50.9],
  SIHANOUKVILLE: [103.52, 10.63],
  DHAKA: [90.41, 23.71],
  MANAUS: [-60.02, -3.13],
  "BEIRA PORT": [34.84, -19.83],
  BEIRA: [34.84, -19.83],
  DJIBOUTI: [43.14, 11.6],
  TAMATAVE: [49.41, -18.15],
  TOAMASINA: [49.41, -18.15],
  "LOS ANGELES": [-118.26, 33.73],
  NORFOLK: [-76.33, 36.92],
  SINGAPORE: [103.85, 1.27],
  TOKYO: [139.78, 35.62],
  KEELUNG: [121.74, 25.14],
  "LAEM CHABANG": [100.89, 13.08],
  BELAWAN: [98.69, 3.79],
  "DKI JAKARTA": [106.88, -6.1],
  JAKARTA: [106.88, -6.1],
  "TANJUNG PRIOK": [106.88, -6.1],
  AUCKLAND: [174.78, -36.84],
  BUDAPEST: [19.04, 47.5],
  "SAN ANTONIO": [-71.62, -33.59],
  "BUENOS AIRES": [-58.37, -34.6],
  MOMBASA: [39.66, -4.06],
  "DAR ES SALAAM": [39.29, -6.82],
  DURBAN: [31.03, -29.87],
  "PORT LOUIS": [57.5, -20.16],
  "JEBEL ALI": [55.06, 25.01],
  DUBAI: [55.06, 25.01],
  HAMBURG: [9.94, 53.54],
  ROTTERDAM: [4.4, 51.92],
  ANTWERP: [4.4, 51.26],
  FELIXSTOWE: [1.32, 51.95],
  "PORT KLANG": [101.36, 3.0],
  "HO CHI MINH": [106.75, 10.77],
  "HO CHI MINH CITY": [106.75, 10.77],
  HAIPHONG: [106.7, 20.86],
  BUSAN: [129.06, 35.1],
  SHANGHAI: [121.8, 31.23],
  NINGBO: [121.85, 29.87],
  QINGDAO: [120.32, 36.07],
  MANILA: [120.96, 14.6],
  KARACHI: [67.0, 24.83],
  "UMM QASR": [47.94, 30.03],
  DAMMAM: [50.2, 26.5],
  JEDDAH: [39.15, 21.48],
  ASHDOD: [34.64, 31.81],
  CALLAO: [-77.13, -12.05],
  VALPARAISO: [-71.63, -33.03],
  SANTOS: [-46.31, -23.96],
  MONTEVIDEO: [-56.21, -34.9],
  GUAYAQUIL: [-79.89, -2.27],
  CARTAGENA: [-75.52, 10.4],
  VERACRUZ: [-96.13, 19.2],
  HOUSTON: [-95.28, 29.73],
  "NEW YORK": [-74.05, 40.67],
  SAVANNAH: [-81.14, 32.08],
  MELBOURNE: [144.91, -37.83],
  SYDNEY: [151.2, -33.85],
  "PORT SUDAN": [37.22, 19.61],
  MASSAWA: [39.45, 15.61],
  MATADI: [13.46, -5.82],
  TEMA: [0.0, 5.63],
  ABIDJAN: [-4.01, 5.29],
  DAKAR: [-17.42, 14.68],
  CONAKRY: [-13.7, 9.51],
  DOUALA: [9.68, 4.05],
  WALVIS: [14.5, -22.95],
  "WALVIS BAY": [14.5, -22.95],
  NACALA: [40.68, -14.54],
  MAPUTO: [32.58, -25.97],
  TRIPOLI: [13.19, 32.9],
  ALEXANDRIA: [29.87, 31.2],
  MERSIN: [34.64, 36.8],
  IZMIR: [27.14, 38.44],
  GEMLIK: [29.13, 40.42],
  CONSTANTA: [28.65, 44.17],
  ODESSA: [30.73, 46.49],
  KLAIPEDA: [21.13, 55.7],
  "ST PETERSBURG": [30.24, 59.9],
  NOVOROSSIYSK: [37.79, 44.72],
};

/** country (upper-cased) -> ISO2 for flagcdn */
const COUNTRY_CC: Record<string, string> = {
  "SRI LANKA": "lk",
  BANGLADESH: "bd",
  MYANMAR: "mm",
  BURMA: "mm",
  ANGOLA: "ao",
  NIGERIA: "ng",
  "UNITED KINGDOM": "gb",
  UK: "gb",
  ENGLAND: "gb",
  CAMBODIA: "kh",
  BRAZIL: "br",
  USA: "us",
  "UNITED STATES": "us",
  "UNITED STATES OF AMERICA": "us",
  MADAGASCAR: "mg",
  ETHIOPIA: "et",
  MOZAMBIQUE: "mz",
  ZIMBABWE: "zw",
  DJIBOUTI: "dj",
  INDIA: "in",
  SINGAPORE: "sg",
  JAPAN: "jp",
  TAIWAN: "tw",
  THAILAND: "th",
  INDONESIA: "id",
  "NEW ZEALAND": "nz",
  HUNGARY: "hu",
  CHILE: "cl",
  ARGENTINA: "ar",
  KENYA: "ke",
  TANZANIA: "tz",
  "SOUTH AFRICA": "za",
  MAURITIUS: "mu",
  UAE: "ae",
  "UNITED ARAB EMIRATES": "ae",
  GERMANY: "de",
  NETHERLANDS: "nl",
  BELGIUM: "be",
  MALAYSIA: "my",
  VIETNAM: "vn",
  "VIET NAM": "vn",
  "SOUTH KOREA": "kr",
  KOREA: "kr",
  CHINA: "cn",
  PHILIPPINES: "ph",
  PAKISTAN: "pk",
  IRAQ: "iq",
  "SAUDI ARABIA": "sa",
  ISRAEL: "il",
  PERU: "pe",
  URUGUAY: "uy",
  ECUADOR: "ec",
  COLOMBIA: "co",
  MEXICO: "mx",
  AUSTRALIA: "au",
  SUDAN: "sd",
  ERITREA: "er",
  CONGO: "cd",
  "DR CONGO": "cd",
  GHANA: "gh",
  "IVORY COAST": "ci",
  "COTE DIVOIRE": "ci",
  SENEGAL: "sn",
  GUINEA: "gn",
  CAMEROON: "cm",
  NAMIBIA: "na",
  LIBYA: "ly",
  EGYPT: "eg",
  TURKEY: "tr",
  ROMANIA: "ro",
  UKRAINE: "ua",
  LITHUANIA: "lt",
  RUSSIA: "ru",
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const norm = (v: unknown): string =>
  String(v ?? "")
    .toUpperCase()
    .replace(/[.,_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function titleCase(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function portCode(port: unknown): string {
  const n = norm(port);
  if (!n) return "—";
  if (PORT_CODES[n]) return PORT_CODES[n];
  // try progressively shorter prefixes ("APAPA LAGOS PORT" -> "APAPA LAGOS")
  const parts = n.split(" ");
  for (let len = parts.length - 1; len >= 1; len--) {
    const k = parts.slice(0, len).join(" ");
    if (PORT_CODES[k]) return PORT_CODES[k];
  }
  for (const key of Object.keys(PORT_CODES)) {
    if (n.includes(key)) return PORT_CODES[key];
  }
  return n.replace(/[^A-Z]/g, "").slice(0, 3) || "—";
}

export function portCoord(port: unknown): [number, number] | null {
  const n = norm(port);
  if (!n) return null;
  if (PORT_COORDS[n]) return PORT_COORDS[n];
  const parts = n.split(" ");
  for (let len = parts.length - 1; len >= 1; len--) {
    const k = parts.slice(0, len).join(" ");
    if (PORT_COORDS[k]) return PORT_COORDS[k];
  }
  for (const key of Object.keys(PORT_COORDS)) {
    if (n.includes(key)) return PORT_COORDS[key];
  }
  return null;
}

export function countryCc(country: unknown): string {
  const n = norm(country);
  if (!n) return "in";
  if (COUNTRY_CC[n]) return COUNTRY_CC[n];
  for (const key of Object.keys(COUNTRY_CC)) {
    if (n.includes(key)) return COUNTRY_CC[key];
  }
  return "in";
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Parses the loose date shapes found in the ops sheet jsonb. */
export function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    if (v > 20000 && v < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s || s === "-" || s === "—") return null;
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, Number(dmy[2]) - 1, Number(dmy[1])));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** "AUG 28, 2025" */
export function fmtLong(v: unknown): string {
  const d = parseDate(v);
  if (!d) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()}`;
}

/** "AUG 28" */
export function fmtShort(v: unknown): string {
  const d = parseDate(v);
  if (!d) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** "12D 06H 10M" */
export function fmtDuration(from: Date | null, to: Date | null): string {
  if (!from || !to) return "00D 00H 00M";
  let ms = to.getTime() - from.getTime();
  if (ms < 0) ms = 0;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(d).padStart(2, "0")}D ${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}M`;
}

/** "41.72°N, 154.38°E" */
export function fmtCoords([lng, lat]: [number, number]): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

export function normalizeCarrier(v: unknown): string {
  const n = norm(v);
  if (!n) return "—";
  if (n.startsWith("EVEGRREN") || n.startsWith("EVERGREEN") || n.startsWith("EVERGREN")) return "EVERGREEN";
  if (n === "CMA" || n.startsWith("CMA CGM") || n.startsWith("CMACGM")) return "CMA CGM";
  return n;
}

/* ------------------------------------------------------------------ */
/* Status derivation                                                   */
/* ------------------------------------------------------------------ */

export const STATUS_COLORS: Record<LiveStatus, string> = {
  COMPLETED: "#45d483",
  "IN TRANSIT": "#4aa8f0",
  PENDING: "#8a94a3",
  DELAYED: "#e9b64a",
};

const IN_TRANSIT_STAGES = new Set([
  "BL RELEASE",
  "BILLING",
  "GATE OPEN",
  "CUSTOM CLEARANCE",
  "CUSTOMS CLEARANCE",
  "SI FILING",
  "CONTAINER ALLOCATION",
]);
const PENDING_STAGES = new Set(["PLANNING", "BOOKING REQUEST", "BOOKING"]);

/** Stage ordering used for the "before Gate Open" delay test. */
const STAGE_ORDER = [
  "PLANNING",
  "BOOKING REQUEST",
  "BOOKING",
  "CONTAINER ALLOCATION",
  "SI FILING",
  "CUSTOM CLEARANCE",
  "GATE OPEN",
  "BILLING",
  "BL RELEASE",
  "COMPLETED",
];
const GATE_OPEN_INDEX = STAGE_ORDER.indexOf("GATE OPEN");

export function deriveStatus(
  statusName: unknown,
  data: Record<string, unknown>,
  now: Date,
): LiveStatus {
  const n = norm(statusName);
  const stageIdx = STAGE_ORDER.indexOf(n);

  // DELAYED wins: a cutoff has passed while the WO is still pre-Gate-Open.
  if (stageIdx >= 0 && stageIdx < GATE_OPEN_INDEX) {
    const si = parseDate(data.si_cutoff);
    const gate = parseDate(data.gate_cut_off);
    if ((si && si.getTime() < now.getTime()) || (gate && gate.getTime() < now.getTime())) {
      return "DELAYED";
    }
  }

  if (n === "COMPLETED") return "COMPLETED";
  if (IN_TRANSIT_STAGES.has(n)) return "IN TRANSIT";
  if (PENDING_STAGES.has(n)) return "PENDING";
  return "PENDING";
}

/* ------------------------------------------------------------------ */
/* Route geometry                                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds a plausible sea route: a quadratic bezier from origin to destination
 * through a midpoint pushed perpendicular to the straight line, sampled at
 * `steps` points so it renders as a smooth dotted arc.
 */
export function buildRoute(
  from: [number, number],
  to: [number, number],
  steps = 13,
): [number, number][] {
  const [x0, y0] = from;
  const y1 = to[1];
  let x1 = to[0];

  // take the short way around the antimeridian
  if (x1 - x0 > 180) x1 -= 360;
  if (x0 - x1 > 180) x1 += 360;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return [from, to];

  // perpendicular offset ~11% of span, capped so long lanes don't balloon
  const bow = Math.min(len * 0.11, 12);
  const mx = (x0 + x1) / 2 - (dy / len) * bow;
  const my = (y0 + y1) / 2 + (dx / len) * bow;

  const pts: [number, number][] = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * mx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * my + t * t * y1;
    pts.push([Number(x.toFixed(4)), Number(Math.max(-85, Math.min(85, y)).toFixed(4))]);
  }
  return pts;
}

/** Point at `progress` (0..1) along a polyline, by cumulative segment length. */
export function pointAt(route: [number, number][], progress: number): [number, number] {
  if (route.length === 0) return [0, 0];
  if (route.length === 1) return route[0];
  const p = Math.max(0, Math.min(1, progress));
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    segs.push(d);
    total += d;
  }
  if (total === 0) return route[0];
  let target = total * p;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : target / segs[i];
      const a = route[i];
      const b = route[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= segs[i];
  }
  return route[route.length - 1];
}

/* ------------------------------------------------------------------ */
/* Board (module) labels                                               */
/* ------------------------------------------------------------------ */

export type BoardOption = { slug: string; label: string };

/* ------------------------------------------------------------------ */
/* Main mapper                                                         */
/* ------------------------------------------------------------------ */

export type WorkOrderRow = {
  id: string;
  module_slug: string | null;
  status_id: string | null;
  data: Record<string, unknown> | null;
  updated_at?: string | null;
};

export type StatusMeta = { name: string; display_order: number };

const MAX_ORDER = 9;

export function toLiveShipment(
  row: WorkOrderRow,
  status: StatusMeta | null,
  boardLabel: string,
  now: Date,
): LiveShipment {
  const data = (row.data ?? {}) as Record<string, unknown>;

  const statusLabel = deriveStatus(status?.name, data, now);
  const displayOrder = status?.display_order ?? 0;
  const progress = Math.max(0, Math.min(1, displayOrder / MAX_ORDER));

  const dCoord = portCoord(data.port);
  // Unknown port -> degenerate 2-point line; the map hides the route + markers.
  const route: [number, number][] = dCoord
    ? buildRoute(ORIGIN_PORT.coord, dCoord)
    : [ORIGIN_PORT.coord, ORIGIN_PORT.coord];
  const cur = pointAt(route, progress);

  const sailing = parseDate(data.sailingdt) ?? parseDate(data.stuffing_dt);
  const eta =
    parseDate(data.eta_at_destination) ?? parseDate(data.current_etd) ?? parseDate(data.sailingdt);

  const oDateRaw = data.stuffing_dt;
  const dDateRaw = data.eta_at_destination ?? data.current_etd ?? data.sailingdt;

  const transitDays =
    sailing && eta ? Math.max(0, Math.round((eta.getTime() - sailing.getTime()) / 86400000)) : null;

  // NOTE: the ops sheet has no `gross_wt_kg` key; the closest real field is
  // `gross_weight` (only present on some modules). Fall back to unit count.
  const grossWt = data.gross_weight ?? data.gross_wt_kg;
  const weight =
    grossWt != null && String(grossWt).trim() !== "" && String(grossWt).trim() !== "-"
      ? `${String(grossWt).trim()} KG`
      : `${data.qty != null && String(data.qty).trim() !== "" ? String(data.qty).trim() : "—"} UNITS`;

  const contCount = data.cont != null && String(data.cont).trim() !== "" ? String(data.cont).trim() : "";
  const contType =
    data.cont_type != null && String(data.cont_type).trim() !== ""
      ? String(data.cont_type).trim().toUpperCase()
      : "40FT";
  const container = `${contCount}${contCount ? "× " : ""}${contType}`.trim();

  const etaConf: LiveShipment["etaConf"] = parseDate(data.sailingdt) && parseDate(data.eta_at_destination)
    ? "HIGH"
    : parseDate(data.current_etd) || parseDate(data.do_etd)
      ? "MEDIUM"
      : "LOW";

  const woId = String(data.wo ?? "").trim() || row.id.slice(0, 8).toUpperCase();
  const dCode = portCode(data.port);
  const country = String(data.country ?? "").trim();
  const dCity = [titleCase(data.port), titleCase(country)].filter(Boolean).join(", ") || "—";
  const carrier = normalizeCarrier(data.s_line);

  // rank: on-water/active stages first, then most recently updated
  const stageRank =
    statusLabel === "DELAYED" ? 0 : statusLabel === "IN TRANSIT" ? 1 : statusLabel === "PENDING" ? 2 : 3;
  const updated = parseDate(row.updated_at)?.getTime() ?? 0;
  const rank = stageRank * 1e13 + (1e13 - Math.min(updated, 1e13 - 1));

  return {
    key: row.id,
    id: woId,
    moduleSlug: row.module_slug ?? "",
    boardLabel,
    status: statusLabel,
    sc: STATUS_COLORS[statusLabel],
    mode: "ship",
    dur: transitDays != null ? `${transitDays}D` : "—",

    oCode: ORIGIN_PORT.code,
    oCity: ORIGIN_PORT.city,
    oDate: fmtLong(oDateRaw),
    oCc: ORIGIN_PORT.cc,
    dCode,
    dCity,
    dDate: fmtLong(dDateRaw),
    dCc: countryCc(country),

    headline: `${statusLabel} • ${fmtLong(data.sailingdt ?? data.current_etd ?? data.stuffing_dt)}`,
    carrier,
    coords: fmtCoords(cur),
    oSched: fmtShort(data.gate_open),
    oActual: fmtShort(data.cntr_gated ?? data.gate_open),
    dSched: fmtShort(data.do_etd ?? data.current_etd),
    dEst: fmtShort(data.eta_at_destination ?? data.current_etd),

    onway: fmtDuration(sailing, now),
    progress,
    agent: String(data.agent ?? "").trim() || "—",
    caseId: String(data.ff_job ?? "").trim() || String(data.booking_no ?? "").trim() || "—",
    etaConf,
    weight,
    container: container || "—",

    route,
    cur: [Number(cur[0].toFixed(4)), Number(cur[1].toFixed(4))],

    search: [
      woId,
      data.vslname,
      data.port,
      country,
      data.booking_no,
      data.blno,
      data.ff_job,
      carrier,
      dCode,
      boardLabel,
    ]
      .map((v) => String(v ?? ""))
      .join(" ")
      .toLowerCase(),
    rank,
  };
}
