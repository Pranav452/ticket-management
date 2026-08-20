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

  /** remaining voyage time when at sea, e.g. "12D 06H" ("" otherwise) */
  onway: string;
  /**
   * DATE-DRIVEN position along the sea route, 0..1 — how far the vessel is from
   * its POD given its actual sail-away date and its ETA. NOT a lifecycle-stage
   * fraction: a WO parked at "Gate Open" in Nhava Sheva is still at 0.
   */
  voyageProgress: number;
  /** no sail-away date yet (or it is in the future) — still docked at the POL */
  atOrigin: boolean;
  /** stage is Completed, or the ETA has passed */
  arrived: boolean;
  /** the ETA was derived from route length ÷ service speed, not from the sheet */
  etaEstimated: boolean;
  /** whole days from departure to arrival, null when either is unknown */
  transitDaysTotal: number | null;
  /** whole days from now to arrival, null when not at sea */
  daysRemaining: number | null;
  /**
   * Fraction along the route where the MARKER is drawn. Equals voyageProgress
   * except for river PODs at sea, where it is capped at the seaward anchorage.
   */
  markerProgress: number;
  /** "AUG 28" — planned departure, shown while the vessel has not sailed */
  departsOn: string;
  /** "SEP 14" — arrival date (actual or estimated) */
  arrivesOn: string;
  agent: string;
  caseId: string;
  etaConf: "HIGH" | "MEDIUM" | "LOW";
  weight: string;
  container: string;

  /** Key into the routes lookup (see routesForShipments) — routes are shared
   * per destination port, never duplicated per work order. */
  routeKey: string;
  cur: [number, number];
  /** false when the POD has no sea corridor — map hides the line + ship */
  hasRoute: boolean;

  /** index into STAGE_NAMES of the stage this WO is currently sitting in */
  stageIndex: number;
  /** ten entries, aligned to STAGE_NAMES */
  journey: JourneyStep[];

  /** Pre-formatted raw-sheet fields for the "Full details" drawer. Only the
   * keys listed in DETAIL_GROUPS (plus `container_no`) are ever populated, so
   * the client never receives the whole `data` jsonb. */
  details: Record<string, string>;

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
  SOUTHAMPTON: [-1.457, 50.907], // DP World Southampton container terminal
  SIHANOUKVILLE: [103.52, 10.63],
  // Dhaka has no seaport: the actual container facility is Pangaon ICT,
  // a river terminal on the Buriganga ~250 km inland (see RIVER_ANCHORAGE).
  DHAKA: [90.456, 23.657],
  MANAUS: [-60.02, -3.13],
  "BEIRA PORT": [34.84, -19.83],
  BEIRA: [34.84, -19.83],
  DJIBOUTI: [43.069, 11.601], // Doraleh container terminal
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

/**
 * Ports whose container terminal is materially inland — reached only after a
 * long river / estuary passage. Value is the SEAWARD ANCHORAGE: the open-water
 * point a vessel would sit off before making that passage.
 *
 * While a shipment is AT SEA its marker is clamped to this anchorage, so the
 * boat never appears to be steaming across a landmass (Manaus is ~1,500 km up
 * the Amazon; Dhaka is ~250 km up the Meghna/Buriganga). The dotted route line
 * is still drawn all the way to the terminal, and once the vessel has ARRIVED
 * it sits on the terminal coordinate itself.
 */
const RIVER_ANCHORAGE: Record<string, [number, number]> = {
  // ~1,500 km up the Amazon. Hold at the Canal Norte / river mouth.
  MANAUS: [-49.3, 0.6],
  // Yangon River; the pilot station alone sits 32 km seaward of Elephant Point.
  YANGON: [96.37, 15.97],
  // Pangaon ICT is ~250 km inland — hold in the outer Meghna estuary.
  DHAKA: [90.7, 21.4],
  // ~15 km up the Karnaphuli — hold at the Patenga outer anchorage.
  CHATTOGRAM: [91.803, 22.226],
  // ~220 km of dredged Rio de la Plata channel; hold at the Recalada pilot station.
  "BUENOS AIRES": [-56.0, -35.07],
};
RIVER_ANCHORAGE.CHITTAGONG = RIVER_ANCHORAGE.CHATTOGRAM;

/** true when the POD's terminal sits materially inland up a river */
export function isRiverPort(key: string | null): boolean {
  return !!key && RIVER_ANCHORAGE[key] != null;
}

export function anchorageForPortKey(key: string | null): [number, number] | null {
  return key ? (RIVER_ANCHORAGE[key] ?? null) : null;
}

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

/**
 * Resolves a loose POD string to the canonical PORT_COORDS key (or null when
 * the port is unknown — typos like "COBUN", landlocked entries, blanks).
 */
export function portKey(port: unknown): string | null {
  const n = norm(port);
  if (!n) return null;
  if (PORT_COORDS[n]) return n;
  const parts = n.split(" ");
  for (let len = parts.length - 1; len >= 1; len--) {
    const k = parts.slice(0, len).join(" ");
    if (PORT_COORDS[k]) return k;
  }
  for (const key of Object.keys(PORT_COORDS)) {
    if (n.includes(key)) return key;
  }
  return null;
}

export function portCoord(port: unknown): [number, number] | null {
  const k = portKey(port);
  return k ? PORT_COORDS[k] : null;
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
  // routes that cross the antimeridian carry continuous (unwrapped) longitudes
  const l = ((((lng + 180) % 360) + 360) % 360) - 180;
  const ns = lat >= 0 ? "N" : "S";
  const ew = l >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(l).toFixed(2)}°${ew}`;
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
 * Waypoint-corridor routing.
 *
 * Every voyage leaves Nhava Sheva (JNPT). A route is composed as
 *   JNPT -> outbound -> shared corridor waypoints -> destination approach -> port
 * where every waypoint sits in open water, so no leg cuts across a landmass.
 * The composed waypoint chain is then densified (30-48 points) so the polyline
 * reads as a smooth line and `pointAt` can place the ship exactly on it.
 */
type Pt = [number, number];

/** concat helper that keeps the tuple type without `as Pt` noise everywhere */
const cat = (...parts: (Pt[] | number[][])[]): Pt[] => parts.flat() as Pt[];

/* ── shared corridors ─────────────────────────────────────────────── */

// Arabian Sea outbound (west of the Indian coast)
const ARABIAN_OUT: Pt[] = [
  [72.0, 18.0],
  [68.5, 15.5],
];

// Gulf of Aden
const ADEN: Pt[] = [
  [60, 13.5],
  [52, 12.6],
  [46, 12],
];
// ... continuing to Bab-el-Mandeb
const BAB: Pt[] = [
  [60, 13.5],
  [52, 12.6],
  [45, 12.3],
  [43.4, 12.6],
];
// Red Sea -> Gulf of Suez -> canal -> Port Said
const RED_SEA: Pt[] = [
  [39.5, 17.5],
  [36.5, 23.5],
  [33.8, 27.5],
  [32.56, 29.9],
  [32.35, 31.3],
];
// Mediterranean, Port Said -> Gibraltar
const MED_W: Pt[] = [
  [30, 32.5],
  [24, 33.8],
  [15, 35.2],
  [5, 37.3],
  [-5.6, 35.95],
];

const RED_SEA_IN = cat(ARABIAN_OUT, BAB); // ends at Bab-el-Mandeb
const SUEZ_MED = cat(RED_SEA_IN, RED_SEA); // ends at Port Said
const SUEZ = cat(SUEZ_MED, MED_W); // ends at Gibraltar

// Atlantic: Iberia -> Biscay -> Western Approaches -> Channel -> North Sea
const IBERIA: Pt[] = [
  [-9.9, 38.9],
  [-10.0, 41.5],
  [-10.2, 43.6],
];
const BISCAY: Pt[] = [
  [-6, 47.5],
  [-6, 48.8],
  [-4.5, 49.8],
];
const EUROPE_NORTH = cat(SUEZ, IBERIA, BISCAY);
const CHANNEL = cat(EUROPE_NORTH, [[-2.5, 50.3]]);
const DOVER = cat(CHANNEL, [
  [0.5, 50.4],
  [1.5, 51.1],
]);
const NORTH_SEA = cat(DOVER, [
  [2.6, 51.5],
  [3.6, 52.0],
]);

// North Atlantic to the US east coast, and the Caribbean approach
const US_EAST = cat(SUEZ, [
  [-20, 36],
  [-40, 36.5],
  [-60, 36.8],
]);
const CARIB = cat(SUEZ, [
  [-20, 32],
  [-45, 25],
  [-62, 17],
  [-70, 13],
]);

// Indian Ocean south-west: Mozambique Channel and the Cape
const MOZ_ENTRY = cat(ARABIAN_OUT, [
  [65, 8],
  [58, 0],
  [52, -7],
  [48, -11],
]);
const MOZ_CHANNEL = cat(MOZ_ENTRY, [
  [45, -13],
  [41, -18],
]);
const CAPE = cat(MOZ_CHANNEL, [
  [38, -25],
  [33, -32],
  [26, -35.5],
  [18.5, -35.5], // Cape of Good Hope, offshore
  [12, -30],
]);
const WEST_AFRICA = cat(CAPE, [
  [11, -20],
  [11.5, -12],
]);
const BONNY = cat(WEST_AFRICA, [[8, -3]]);
const GUINEA = cat(BONNY, [[5, 3]]);

// South Atlantic and Cape Horn
const S_ATLANTIC = cat(CAPE, [
  [5, -33],
  [-15, -30],
  [-30, -25],
]);
const HORN = cat(CAPE, [
  [-20, -40],
  [-45, -52],
  [-67, -56], // Cape Horn, offshore
  [-75, -56],
  [-77, -50],
  [-76, -45],
  [-74.5, -38],
]);

// Sri Lanka / Bay of Bengal / Malacca / South China Sea
const LANKA_BASE: Pt[] = [
  [72.5, 16],
  [74, 11],
  [77, 7.5],
];
const LANKA = cat(LANKA_BASE, [[79, 5.2]]); // clears Sri Lanka to the south
const BENGAL = cat(LANKA, [
  [81.5, 5.3],
  [83, 7],
  [85, 10],
]);
const MALACCA_N = cat(LANKA, [
  [83, 4.5],
  [90, 4.5],
  [95, 6], // north of the Aceh tip
  [97.5, 5.6],
  [99.5, 4.6],
]);
const MALACCA = cat(MALACCA_N, [
  [101, 3.2],
  [102.2, 1.9],
  [103.4, 1.2],
]);
const SG = cat(MALACCA, [[103.85, 1.27]]); // Singapore
const SG_EAST = cat(SG, [[105, 3]]);
const SCS = cat(SG_EAST, [[110, 8]]);
const GULF_THAI = cat(SG_EAST, [
  [104.3, 6.0],
  [103.8, 9.0],
]);
const VIETNAM = cat(SG_EAST, [[106, 8]]);
const LUZON_N = cat(SCS, [
  [117, 13],
  [119.5, 18.5],
  [121.5, 21],
]);
const PHIL_SEA = cat(LUZON_N, [[124, 22.5]]);
const EAST_CHINA = cat(PHIL_SEA, [[124, 27]]);

// Trans-Pacific. Longitudes stay continuous past 180 (see `unwrap`).
const PACIFIC = cat(PHIL_SEA, [
  [135, 30],
  [150, 34],
  [170, 38],
  [-175, 40],
  [-150, 38],
  [-130, 35],
]);

// Indian Ocean south of Sumatra/Java, then along southern Australia
const INDIAN_S = cat(LANKA, [
  [83, 4.5],
  [90, 4.5],
  [95, 6],
  [93, 3],
  [96, -2],
  [100, -6],
  [105, -9],
  [112, -11],
]);
const AUSTRALIA_S = cat(INDIAN_S, [
  [112, -25],
  [115, -35],
  [120, -36],
  [130, -36],
  [140, -39],
]);
const TASMAN = cat(AUSTRALIA_S, [[147, -44]]);

// Persian Gulf via the Gulf of Oman and Hormuz
const HORMUZ: Pt[] = [
  [70, 20],
  [63, 22.5],
  [59, 24.5],
  [56.7, 26.8],
  [55.5, 25.5],
];
const GULF_MID = cat(HORMUZ, [
  [53, 26.5],
  [51.3, 27.0],
]);

// Aegean / Marmara / Black Sea (coarse — never seen on a Bajaj lane)
const AEGEAN = cat(SUEZ_MED, [
  [30, 32.5],
  [26, 33.5],
  [25, 34.5],
  [24.5, 36.5],
  [24.2, 37.5],
  [24.3, 38.5],
]);
const MARMARA = cat(AEGEAN, [
  [25.2, 39.6],
  [26.0, 40.0],
  [26.7, 40.4],
  [27.5, 40.55],
]);
const BLACK_SEA = cat(MARMARA, [
  [28.6, 40.85],
  [29.1, 41.05],
  [29.2, 41.5],
]);

// Baltic via the Skagerrak / Kattegat / Oresund
const BALTIC = cat(NORTH_SEA, [
  [5, 54.5],
  [7.5, 57.3],
  [10.2, 57.8],
  [11.2, 57.3],
  [12.0, 56.6],
  [12.65, 56.05],
  [12.75, 55.6],
  [12.9, 55.3],
  [13.5, 55.0],
  [19, 55.6],
]);

/**
 * POD key (a PORT_COORDS key) -> corridor waypoints, ORIGIN and the port
 * coordinate excluded (both are added by `routeForPort`).
 */
const SEA_ROUTES: Record<string, Pt[]> = {
  /* ── Indian sub-continent / Bay of Bengal ── */
  COLOMBO: cat(LANKA_BASE, [[78.9, 6.9]]),
  CHATTOGRAM: cat(BENGAL, [
    [88, 15],
    [90.5, 20.5],
    [91.3, 21.9],
  ]),
  YANGON: cat(BENGAL, [
    [90, 12],
    [94, 15.5],
    [96, 15.9],
    [96.2, 16.3],
  ]),
  DHAKA: cat(BENGAL, [
    [88, 15],
    [90.5, 20.5],
    [90.8, 22.2],
    [90.6, 23.0],
  ]),
  KARACHI: cat([
    [70, 20],
    [67.5, 23.5],
  ]),

  /* ── Persian Gulf ── */
  "JEBEL ALI": HORMUZ,
  DAMMAM: cat(GULF_MID, [[50.4, 26.7]]),
  "UMM QASR": cat(GULF_MID, [
    [50, 29],
    [48.6, 29.6],
  ]),

  /* ── Red Sea / Horn of Africa ── */
  DJIBOUTI: cat(ARABIAN_OUT, ADEN),
  MASSAWA: cat(RED_SEA_IN, [[40.5, 14.8]]),
  JEDDAH: cat(RED_SEA_IN, [
    [39.5, 17.5],
    [38.8, 21.3],
  ]),
  "PORT SUDAN": cat(RED_SEA_IN, [
    [39.5, 17.5],
    [37.8, 19.4],
  ]),

  /* ── Mediterranean ── */
  ALEXANDRIA: cat(SUEZ_MED, [[30.5, 31.7]]),
  ASHDOD: cat(SUEZ_MED, [
    [33.0, 31.6],
    [34.4, 31.9],
  ]),
  MERSIN: cat(SUEZ_MED, [
    [33.0, 32.5],
    [34.9, 35.0],
    [35.0, 36.3],
  ]),
  TRIPOLI: cat(SUEZ_MED, [
    [30, 32.5],
    [24, 33.8],
    [16, 33.5],
    [13.2, 33.5],
  ]),
  IZMIR: cat(AEGEAN, [
    [25.5, 38.6],
    [26.4, 38.5],
  ]),
  GEMLIK: MARMARA,
  CONSTANTA: cat(BLACK_SEA, [[29.0, 44.1]]),
  ODESSA: cat(BLACK_SEA, [
    [30.5, 44.5],
    [30.9, 45.9],
  ]),
  NOVOROSSIYSK: cat(BLACK_SEA, [
    [33, 43],
    [37.5, 44.5],
  ]),

  /* ── North-west Europe ── */
  SOUTHAMPTON: cat(CHANNEL, [[-1.3, 50.72]]),
  FELIXSTOWE: cat(DOVER, [
    [1.7, 51.5],
    [1.5, 51.9],
  ]),
  ANTWERP: cat(DOVER, [
    [2.6, 51.5],
    [3.3, 51.6],
    [3.6, 51.45],
  ]),
  ROTTERDAM: cat(NORTH_SEA, [[4.0, 52.0]]),
  HAMBURG: cat(NORTH_SEA, [
    [4.5, 53.2],
    [7.0, 54.0],
    [8.2, 54.0],
    [8.5, 53.9],
  ]),
  KLAIPEDA: BALTIC,
  "ST PETERSBURG": cat(BALTIC, [
    [20.5, 57.5],
    [21.5, 58.8],
    [24, 59.6],
    [28, 60.1],
    [29.6, 59.95],
  ]),

  /* ── Americas ── */
  NORFOLK: cat(US_EAST, [[-75.9, 36.95]]),
  "NEW YORK": cat(US_EAST, [
    [-72, 39.5],
    [-73.9, 40.4],
  ]),
  SAVANNAH: cat(US_EAST, [
    [-75, 33],
    [-80.5, 31.9],
  ]),
  CARTAGENA: cat(CARIB, [[-75.6, 10.6]]),
  VERACRUZ: cat(CARIB, [
    [-79, 19.5],
    [-84.5, 20.5],
    [-92, 20.3],
    [-95.8, 19.4],
  ]),
  HOUSTON: cat(CARIB, [
    [-79, 19.5],
    [-84.5, 20.5],
    [-88, 25],
    [-94.5, 29.3],
  ]),
  "LOS ANGELES": PACIFIC,
  MANAUS: cat(S_ATLANTIC, [
    [-40, -10],
    [-45, -2],
    [-48, -0.6], // Amazon mouth; the last legs run up the river
    [-55, -2.2],
  ]),
  SANTOS: cat(S_ATLANTIC, [
    [-40, -25],
    [-45.5, -24.5],
  ]),
  MONTEVIDEO: cat(S_ATLANTIC, [
    [-40, -33],
    [-53, -36],
    [-55.8, -35.2],
  ]),
  "BUENOS AIRES": cat(S_ATLANTIC, [
    [-40, -33],
    [-53, -36],
    [-56.5, -35.5],
  ]),
  "SAN ANTONIO": cat(HORN, [[-73.0, -34.5]]),
  VALPARAISO: cat(HORN, [[-73.0, -34.2]]),
  CALLAO: cat(HORN, [
    [-73, -30],
    [-72, -20],
    [-77.5, -12.2],
  ]),
  GUAYAQUIL: cat(HORN, [
    [-73, -30],
    [-72, -20],
    [-80, -8],
    [-81.5, -4],
    [-81.0, -2.6],
  ]),

  /* ── East / southern Africa & the Indian Ocean islands ── */
  MOMBASA: cat(ARABIAN_OUT, [
    [65, 8],
    [58, 0],
    [52, -2],
    [45, -3.5],
    [40.5, -4.0],
  ]),
  "DAR ES SALAAM": cat(ARABIAN_OUT, [
    [65, 8],
    [58, 0],
    [52, -2],
    [45, -5.5],
    [40.0, -6.9],
  ]),
  "PORT LOUIS": cat(ARABIAN_OUT, [
    [65, 8],
    [58, 0],
    [57, -10],
    [57.6, -19.5],
  ]),
  NACALA: cat(MOZ_ENTRY, [
    [45, -13],
    [41.5, -14.4],
  ]),
  BEIRA: cat(MOZ_ENTRY, [
    [45, -13],
    [41, -16],
    [38, -19],
    [36, -19.9],
  ]),
  TAMATAVE: cat(MOZ_ENTRY, [
    [50.3, -11.6], // round the northern tip of Madagascar
    [51.0, -14.0],
    [50.5, -17.0],
  ]),
  MAPUTO: cat(MOZ_CHANNEL, [
    [38, -25],
    [33.5, -25.9],
  ]),
  DURBAN: cat(MOZ_CHANNEL, [
    [38, -25],
    [32.5, -29.5],
  ]),

  /* ── West Africa ── */
  "WALVIS BAY": cat(CAPE, [
    [13.5, -25],
    [14.2, -23.2],
  ]),
  LUANDA: WEST_AFRICA,
  MATADI: cat(WEST_AFRICA, [
    [11.5, -6.5],
    [12.3, -6.05],
  ]),
  ONNE: cat(BONNY, [
    [7.2, 3.0],
    [7.2, 4.2],
  ]),
  DOUALA: cat(BONNY, [
    [8.5, 2.5],
    [9.4, 3.6],
  ]),
  "APAPA LAGOS": cat(GUINEA, [[3.5, 6.0]]),
  LEKKI: cat(GUINEA, [[4.1, 6.0]]),
  TEMA: cat(GUINEA, [[0.2, 5.0]]),
  ABIDJAN: cat(GUINEA, [
    [0, 4.0],
    [-4.0, 4.7],
  ]),
  CONAKRY: cat(GUINEA, [
    [0, 4.0],
    [-4.0, 4.7],
    [-9, 6],
    [-14, 8.8],
  ]),
  DAKAR: cat(GUINEA, [
    [0, 4.0],
    [-4.0, 4.7],
    [-9, 6],
    [-14, 8.8],
    [-17.5, 11],
    [-17.9, 14.6],
  ]),

  /* ── South-east / east Asia ── */
  BELAWAN: cat(MALACCA_N, [[99.0, 4.1]]),
  "PORT KLANG": cat(MALACCA_N, [[101, 3.2]]),
  SINGAPORE: MALACCA,
  JAKARTA: cat(SG, [
    [107.5, -2],
    [107, -4.5],
  ]),
  SIHANOUKVILLE: GULF_THAI,
  "LAEM CHABANG": cat(GULF_THAI, [
    [102.5, 11],
    [101.5, 12.2],
  ]),
  "HO CHI MINH": cat(VIETNAM, [[107, 10.3]]),
  HAIPHONG: cat(VIETNAM, [
    [110, 13],
    [109.5, 16.5],
    [107.8, 18.0],
    [107.2, 20.3],
  ]),
  MANILA: cat(SCS, [
    [117, 13],
    [119.8, 14.6],
    [120.6, 14.4],
  ]),
  KEELUNG: cat(LUZON_N, [
    [119.5, 22.3],
    [119.8, 24.5],
    [121.3, 25.6],
  ]),
  NINGBO: cat(EAST_CHINA, [[122.8, 29.5]]),
  SHANGHAI: cat(EAST_CHINA, [
    [123.5, 31.0],
    [122.3, 31.3],
  ]),
  QINGDAO: cat(EAST_CHINA, [
    [124, 33],
    [122.5, 35.5],
  ]),
  BUSAN: cat(PHIL_SEA, [
    [126, 27],
    [127, 31],
    [128, 33],
  ]),
  TOKYO: cat(PHIL_SEA, [
    [126, 26],
    [130, 30],
    [135, 32.5],
    [138, 34],
  ]),

  /* ── Oceania ── */
  MELBOURNE: cat(AUSTRALIA_S, [[144.3, -38.6]]),
  SYDNEY: cat(TASMAN, [
    [152, -38],
    [151.5, -34.2],
  ]),
  AUCKLAND: cat(TASMAN, [
    [155, -42],
    [170, -38],
    [174, -34.5],
    [175.6, -36.3],
  ]),
};

/* aliases that share a corridor with their canonical port */
SEA_ROUTES.CHITTAGONG = SEA_ROUTES.CHATTOGRAM;
SEA_ROUTES.TOAMASINA = SEA_ROUTES.TAMATAVE;
SEA_ROUTES["BEIRA PORT"] = SEA_ROUTES.BEIRA;
SEA_ROUTES.DUBAI = SEA_ROUTES["JEBEL ALI"];
SEA_ROUTES.WALVIS = SEA_ROUTES["WALVIS BAY"];
SEA_ROUTES.APAPA = SEA_ROUTES["APAPA LAGOS"];
SEA_ROUTES.LAGOS = SEA_ROUTES["APAPA LAGOS"];
SEA_ROUTES.TINCAN = SEA_ROUTES["APAPA LAGOS"];
SEA_ROUTES["TIN CAN"] = SEA_ROUTES["APAPA LAGOS"];
SEA_ROUTES["DKI JAKARTA"] = SEA_ROUTES.JAKARTA;
SEA_ROUTES["TANJUNG PRIOK"] = SEA_ROUTES.JAKARTA;
SEA_ROUTES["HO CHI MINH CITY"] = SEA_ROUTES["HO CHI MINH"];

/* ------------------------------------------------------------------ */
/* Densification                                                       */
/* ------------------------------------------------------------------ */

/** Keeps longitudes continuous so trans-Pacific lanes don't wrap the globe. */
function unwrap(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let lng = pts[i][0];
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    out.push([lng, pts[i][1]]);
  }
  return out;
}

const MIN_POINTS = 34;
const MAX_POINTS = 48;

/** Linear interpolation between the corridor waypoints, ~34-48 points total. */
function densify(wp: Pt[]): Pt[] {
  if (wp.length < 2) return wp.slice();
  const segs = wp.slice(1).map((p, i) => Math.hypot(p[0] - wp[i][0], p[1] - wp[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  if (total === 0) return wp.slice();

  const target = Math.max(MIN_POINTS, Math.min(MAX_POINTS, wp.length * 2)) - 1;
  const out: Pt[] = [];
  for (let i = 0; i < segs.length; i++) {
    const n = Math.max(1, Math.round((segs[i] / total) * target));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([
        Number((wp[i][0] + (wp[i + 1][0] - wp[i][0]) * t).toFixed(2)),
        Number((wp[i][1] + (wp[i + 1][1] - wp[i][1]) * t).toFixed(2)),
      ]);
    }
  }
  out.push([Number(wp[wp.length - 1][0].toFixed(2)), Number(wp[wp.length - 1][1].toFixed(2))]);
  return out;
}

const routeCache = new Map<string, Pt[]>();

/**
 * Densified sea route from Nhava Sheva to `port`, or null when the POD has no
 * corridor (unknown / mis-typed / landlocked) — callers hide the line + ship.
 */
export function routeForPortKey(key: string): Pt[] | null {
  if (!key) return null;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const wps = SEA_ROUTES[key];
  const coord = PORT_COORDS[key];
  if (!wps || !coord) return null;
  const dense = densify(unwrap(cat([ORIGIN_PORT.coord], wps, [coord])));
  routeCache.set(key, dense);
  return dense;
}

export function routeForPort(port: unknown): Pt[] | null {
  const key = portKey(port);
  return key ? routeForPortKey(key) : null;
}

/** Ports that resolve to a coordinate but have no hand-built corridor. */
export function hasSeaRoute(port: unknown): boolean {
  const key = portKey(port);
  return !!key && !!SEA_ROUTES[key];
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
/* Voyage distance / speed                                             */
/* ------------------------------------------------------------------ */

const EARTH_NM = 3440.065; // mean Earth radius in nautical miles
const RAD = Math.PI / 180;

/** Great-circle distance between two [lng,lat] points, in nautical miles. */
export function haversineNm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Total great-circle length of a densified polyline, in nautical miles. */
export function routeLengthNm(route: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += haversineNm(route[i - 1], route[i]);
  return total;
}

/**
 * Service speed assumed when the ops sheet carries no ETA. 330 nm/day
 * ≈ 13.75 kn, a realistic door-to-door average for the container services on
 * these lanes once port time and slow steaming are absorbed.
 */
export const SERVICE_SPEED_NM_PER_DAY = 330;

/**
 * Fraction (0..1) along `route` of the point closest to `target`, measured by
 * the same cumulative-segment walk `pointAt` uses. Used to convert a seaward
 * anchorage coordinate into a progress ceiling for river ports.
 */
export function progressOfNearest(route: [number, number][], target: [number, number]): number {
  if (route.length < 2) return 0;
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    segs.push(d);
    total += d;
  }
  if (total === 0) return 0;

  let best = Infinity;
  let bestAt = 0;
  let walked = 0;
  for (let i = 0; i < segs.length; i++) {
    const [ax, ay] = route[i];
    const [bx, by] = route[i + 1];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    // projection of `target` onto this segment, clamped to its endpoints
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((target[0] - ax) * vx + (target[1] - ay) * vy) / len2));
    const px = ax + vx * t;
    const py = ay + vy * t;
    const d2 = (target[0] - px) ** 2 + (target[1] - py) ** 2;
    if (d2 < best) {
      best = d2;
      bestAt = (walked + segs[i] * t) / total;
    }
    walked += segs[i];
  }
  return bestAt;
}

/**
 * Bearing (deg, clockwise from north, minus 90 so the ship glyph — which points
 * east at rest — lines up) of the route at `progress`, measured by the same
 * cumulative-distance walk `pointAt` uses so the icon matches the drawn line.
 */
export function headingAtProgress(route: [number, number][], progress: number): number {
  if (route.length < 2) return 0;
  const p = Math.max(0, Math.min(1, progress));
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    segs.push(d);
    total += d;
  }
  if (total === 0) return 0;
  let target = total * p;
  let idx = segs.length - 1;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      idx = i;
      break;
    }
    target -= segs[i];
  }
  const [x0, y0] = route[idx];
  const [x1, y1] = route[idx + 1];
  return (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI - 90;
}

/* ------------------------------------------------------------------ */
/* Board (module) labels                                               */
/* ------------------------------------------------------------------ */

export type BoardOption = { slug: string; label: string };

/* ------------------------------------------------------------------ */
/* Lifecycle journey (per work order)                                  */
/* ------------------------------------------------------------------ */

/** Exactly the `bajaj_statuses` names, in `display_order` order (0..9). */
export const STAGE_NAMES = [
  "Planning",
  "Booking Request",
  "Booking",
  "Container Allocation",
  "SI Filing",
  "Custom Clearance",
  "Gate Open",
  "BL Release",
  "Billing",
  "Completed",
] as const;

/** One rung of the ladder: `d` = short date (or "—"), `n` = subtitle. */
export type JourneyStep = { d: string; n: string };

/** first value that actually parses as a date (blank/"-" cells are skipped) */
function firstDate(...vals: unknown[]): unknown {
  for (const v of vals) if (parseDate(v) != null) return v;
  return null;
}

const txt = (v: unknown): string => String(v ?? "").trim();

/**
 * All ten lifecycle stages for one work order, aligned to STAGE_NAMES.
 * Dates come from the ops-sheet keys defined in lib/bajaj/import-map.mjs.
 */
export function buildJourney(data: Record<string, unknown>): JourneyStep[] {
  const cont = txt(data.cont);
  const pay = txt(data.sline_payment);
  const vessel = txt(data.vslname) || txt(data.s_line);
  const sb = txt(data.sbno);
  const bl = txt(data.blno);
  const booking = txt(data.booking_no);

  return [
    { d: fmtShort(firstDate(data.wodt, data.stuffing_dt)), n: "" },
    { d: fmtShort(data.do_given_dt), n: vessel ? "Vessel nominated" : "" },
    { d: fmtShort(data.do_given_dt), n: booking },
    {
      d: fmtShort(data.cntr_dispatch),
      n: cont ? `${cont} container${cont === "1" ? "" : "s"}` : "",
    },
    { d: fmtShort(firstDate(data.si_submitted, data.si_cutoff)), n: "" },
    { d: fmtShort(data.sb_date), n: sb ? `SB ${sb}` : "" },
    { d: fmtShort(firstDate(data.gate_open, data.cntr_gated)), n: "" },
    { d: fmtShort(data.bldt), n: bl },
    { d: fmtShort(data.courier_dt), n: pay.toUpperCase().includes("INV") ? pay : "" },
    { d: fmtShort(data.bl_handover_time), n: "" },
  ];
}

/* ------------------------------------------------------------------ */
/* Full-details drawer: field groups                                   */
/* ------------------------------------------------------------------ */

export type DetailRow = { key: string; label: string };
export type DetailGroup = { title: string; rows: DetailRow[] };

/**
 * Everything the drawer can show, grouped. Every `key` is either a canonical
 * ops-sheet key from lib/bajaj/import-map.mjs HEADER_MAP, or one of the two
 * synthesised keys (`pol`, `updated`). A group with no populated key is skipped
 * client-side; individual missing fields render as "—".
 */
export const DETAIL_GROUPS: DetailGroup[] = [
  {
    title: "Shipment",
    rows: [
      { key: "wo", label: "WO number" },
      { key: "consignee", label: "Consignee" },
      { key: "veh", label: "Vehicle / cargo" },
      { key: "veh_category", label: "Vehicle type" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Quantity" },
      { key: "assy_config", label: "Assembly config" },
      { key: "for_hbl", label: "For HBL" },
      { key: "po_no", label: "PO no" },
      { key: "plant", label: "Plant" },
      { key: "haz", label: "HAZ" },
    ],
  },
  {
    title: "Route",
    rows: [
      { key: "pol", label: "POL" },
      { key: "pol_gate", label: "POL gate / terminal" },
      { key: "port", label: "POD" },
      { key: "country", label: "Country" },
      { key: "transporter", label: "Transporter" },
      { key: "agent", label: "Agent / CHA" },
      { key: "buffer_yard", label: "Buffer yard" },
    ],
  },
  {
    title: "Vessel & booking",
    rows: [
      { key: "vslname", label: "Vessel" },
      { key: "s_line", label: "Shipping line" },
      { key: "booking_no", label: "Booking no" },
      { key: "cont", label: "Containers" },
      { key: "cont_type", label: "Container type" },
      { key: "hc40", label: "40HC" },
      { key: "std20", label: "STD20" },
    ],
  },
  {
    title: "Dates",
    rows: [
      { key: "wodt", label: "WO date" },
      { key: "stuffing_dt", label: "Stuffing" },
      { key: "do_given_dt", label: "D/O given" },
      { key: "gate_open", label: "Gate open" },
      { key: "gate_cut_off", label: "Gate cut-off" },
      { key: "si_cutoff", label: "SI cut-off" },
      { key: "si_submitted", label: "SI submitted" },
      { key: "vgm_submitted", label: "VGM submitted" },
      { key: "do_etd", label: "D/O ETD" },
      { key: "current_etd", label: "Current ETD" },
      { key: "eta_at_destination", label: "ETA at destination" },
      { key: "sailingdt", label: "Sailing / ETD" },
      { key: "final_vsl_sob", label: "Final vessel SOB" },
      { key: "bldt", label: "BL date" },
      { key: "bl_handover_time", label: "BL handover" },
      { key: "sb_date", label: "SB date" },
      { key: "courier_dt", label: "Courier" },
      { key: "pickup_dt", label: "Pickup" },
      { key: "cntr_dispatch", label: "Container dispatch" },
      { key: "cntr_report", label: "Container report NSA" },
      { key: "cntr_gated", label: "Container gated in" },
    ],
  },
  {
    title: "Documents & billing",
    rows: [
      { key: "blno", label: "BL no" },
      { key: "sbno", label: "SB no" },
      { key: "ff_job", label: "FF job" },
      { key: "sline_payment", label: "S/Line payment" },
      { key: "e_doc_status", label: "E-doc status" },
      { key: "clearance_point", label: "Clearance point" },
      { key: "open_order", label: "Open order" },
      { key: "lc_no", label: "LC no" },
      { key: "lc_date", label: "LC date" },
      { key: "remark", label: "Remarks" },
    ],
  },
  {
    title: "Sync",
    rows: [
      { key: "sheet_month", label: "Sheet month" },
      { key: "updated", label: "Last updated" },
    ],
  },
];

/** Keys inside DETAIL_GROUPS that are dates (formatted with fmtLong). */
const DETAIL_DATE_KEYS = new Set([
  "wodt",
  "stuffing_dt",
  "do_given_dt",
  "gate_open",
  "gate_cut_off",
  "si_cutoff",
  "si_submitted",
  "vgm_submitted",
  "do_etd",
  "current_etd",
  "eta_at_destination",
  "sailingdt",
  "final_vsl_sob",
  "bldt",
  "bl_handover_time",
  "sb_date",
  "courier_dt",
  "pickup_dt",
  "cntr_dispatch",
  "cntr_report",
  "cntr_gated",
  "lc_date",
]);

/** Rendered as monospace chips rather than a label/value row. */
export const DETAIL_CHIPS_KEY = "container_no";
/** Rendered as a wrapping free-text block. */
export const DETAIL_LONG_KEYS = new Set(["remark"]);

const EMPTY_CELL = new Set(["", "-", "—", "N/A", "NA", "NIL", "NULL"]);

/**
 * Pre-formats every drawer field from the raw jsonb. Empty / placeholder cells
 * are dropped so the client can decide which groups to skip entirely.
 */
export function buildDetails(
  data: Record<string, unknown>,
  updatedAt: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    const s = String(value ?? "").trim();
    if (!s || EMPTY_CELL.has(s.toUpperCase())) return;
    out[key] = s;
  };

  for (const group of DETAIL_GROUPS) {
    for (const { key } of group.rows) {
      if (key === "pol" || key === "updated") continue;
      const raw = data[key];
      if (DETAIL_DATE_KEYS.has(key) && parseDate(raw) != null) put(key, fmtLong(raw));
      else put(key, raw);
    }
  }
  put(DETAIL_CHIPS_KEY, data[DETAIL_CHIPS_KEY]);

  out.pol = `${ORIGIN_PORT.city} (${ORIGIN_PORT.code})`;

  const upd = parseDate(updatedAt);
  if (upd) {
    const hh = String(upd.getUTCHours()).padStart(2, "0");
    const mm = String(upd.getUTCMinutes()).padStart(2, "0");
    out.updated = `${fmtLong(upd)} · ${hh}:${mm} UTC`;
  }

  return out;
}

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

const DAY_MS = 86400000;

/** Clamp used while the vessel is at sea so the marker never sits on a port dot. */
const AT_SEA_MIN = 0.02;
const AT_SEA_MAX = 0.98;

export type VoyageFix = {
  /** date-driven fraction of the voyage completed, 0..1 */
  voyageProgress: number;
  /** where the marker is drawn — anchorage-clamped for river PODs while at sea */
  markerProgress: number;
  atOrigin: boolean;
  arrived: boolean;
  etaEstimated: boolean;
  departure: Date | null;
  plannedDep: Date | null;
  arrival: Date | null;
  transitDaysTotal: number | null;
  daysRemaining: number | null;
};

/**
 * DATE-DRIVEN vessel position.
 *
 * The old model placed the ship at `display_order / 9` — a lifecycle-stage
 * fraction — so a work order still sitting at "Gate Open" in Nhava Sheva was
 * drawn 67% of the way to its POD, i.e. mid-Atlantic. Position now comes from
 * how close the vessel actually is to its destination in TIME:
 *
 *   1. NOT SAILED  — no sail-away date, or it is still in the future.
 *                    progress 0, docked at the POL.
 *   2. ARRIVED     — stage is Completed, or the ETA has passed. progress 1.
 *   3. AT SEA      — (now − departure) / (arrival − departure), clamped so the
 *                    marker never overlaps either port dot. With no ETA in the
 *                    sheet, one is estimated from route length ÷ service speed.
 */
export function voyageFix(
  data: Record<string, unknown>,
  statusName: unknown,
  route: [number, number][],
  routeKey: string | null,
  now: Date,
): VoyageFix {
  // actual sail-away, then the planned ETD as a fallback intent
  const departure = parseDate(data.final_vsl_sob) ?? parseDate(data.sailingdt);
  const plannedDep = parseDate(data.current_etd) ?? parseDate(data.do_etd);
  const sheetArrival = parseDate(data.eta_at_destination);

  const completed = norm(statusName) === "COMPLETED";
  const hasSailed = departure != null && departure.getTime() <= now.getTime();

  // ETA: from the sheet, else estimated from the corridor length at service speed
  let arrival = sheetArrival;
  let etaEstimated = false;
  if (!arrival && departure && route.length > 1) {
    const days = routeLengthNm(route) / SERVICE_SPEED_NM_PER_DAY;
    arrival = new Date(departure.getTime() + days * DAY_MS);
    etaEstimated = true;
  }

  const base = {
    etaEstimated,
    departure,
    plannedDep,
    arrival,
    transitDaysTotal:
      departure && arrival
        ? Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / DAY_MS))
        : null,
  };

  // 1. not sailed — still alongside at Nhava Sheva
  if (!hasSailed && !completed) {
    return {
      ...base,
      voyageProgress: 0,
      markerProgress: 0,
      atOrigin: true,
      arrived: false,
      daysRemaining: null,
    };
  }

  // 2. arrived — completed, or the ETA is behind us
  if (completed || (arrival != null && arrival.getTime() <= now.getTime())) {
    return {
      ...base,
      voyageProgress: 1,
      markerProgress: 1,
      atOrigin: false,
      arrived: true,
      daysRemaining: 0,
    };
  }

  // 3. at sea — linear in time between departure and arrival
  let voyageProgress = 0.5;
  if (departure && arrival) {
    const span = arrival.getTime() - departure.getTime();
    voyageProgress = span > 0 ? (now.getTime() - departure.getTime()) / span : 1;
  }
  voyageProgress = Math.max(AT_SEA_MIN, Math.min(AT_SEA_MAX, voyageProgress));

  // River PODs: hold the marker at the seaward anchorage until it has arrived,
  // so the vessel never appears to steam 1,500 km up the Amazon.
  let markerProgress = voyageProgress;
  const anchor = anchorageForPortKey(routeKey);
  if (anchor && route.length > 1) {
    markerProgress = Math.min(markerProgress, progressOfNearest(route, anchor));
  }

  return {
    ...base,
    voyageProgress,
    markerProgress,
    atOrigin: false,
    arrived: false,
    daysRemaining: arrival
      ? Math.max(0, Math.round((arrival.getTime() - now.getTime()) / DAY_MS))
      : null,
  };
}

export function toLiveShipment(
  row: WorkOrderRow,
  status: StatusMeta | null,
  boardLabel: string,
  now: Date,
): LiveShipment {
  const data = (row.data ?? {}) as Record<string, unknown>;

  const statusLabel = deriveStatus(status?.name, data, now);
  const displayOrder = status?.display_order ?? 0;

  // Waypoint-corridor route. Unknown / landlocked PODs keep the degenerate
  // 2-point line (so the camera still frames Nhava Sheva) but hasRoute=false
  // makes the map hide the line and both markers instead of drawing over land.
  const pKey = portKey(data.port);
  const seaRoute = routeForPort(data.port);
  const hasRoute = seaRoute != null;
  const route: [number, number][] = seaRoute ?? [ORIGIN_PORT.coord, ORIGIN_PORT.coord];

  // DATE-driven position (see voyageFix) — never the lifecycle-stage fraction.
  const fix = voyageFix(data, status?.name, route, hasRoute ? pKey : null, now);
  const cur = pointAt(route, fix.markerProgress);

  const oDateRaw = data.stuffing_dt;
  const dDateRaw = data.eta_at_destination ?? data.current_etd ?? data.sailingdt;

  const transitDays = fix.transitDaysTotal;

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

    // remaining voyage time, e.g. "12D 06H" — blank unless actually at sea
    onway:
      fix.atOrigin || fix.arrived || !fix.arrival
        ? ""
        : fmtDuration(now, fix.arrival).replace(/ \d{2}M$/, ""),
    voyageProgress: Number(fix.voyageProgress.toFixed(4)),
    atOrigin: fix.atOrigin,
    arrived: fix.arrived,
    etaEstimated: fix.etaEstimated,
    transitDaysTotal: fix.transitDaysTotal,
    daysRemaining: fix.daysRemaining,
    markerProgress: Number(fix.markerProgress.toFixed(4)),
    departsOn: fmtShort(fix.plannedDep ?? fix.departure),
    arrivesOn: fmtShort(fix.arrival),
    agent: String(data.agent ?? "").trim() || "—",
    caseId: String(data.ff_job ?? "").trim() || String(data.booking_no ?? "").trim() || "—",
    etaConf,
    weight,
    container: container || "—",

    routeKey: hasRoute ? (portKey(data.port) ?? "") : "",
    cur: [Number(cur[0].toFixed(4)), Number(cur[1].toFixed(4))],
    hasRoute,

    stageIndex: Math.max(0, Math.min(STAGE_NAMES.length - 1, displayOrder)),
    journey: buildJourney(data),

    details: buildDetails(data, row.updated_at),

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


/* ------------------------------------------------------------------ */
/* Voyage state — the axis both the list and the map are grouped on    */
/* ------------------------------------------------------------------ */

export type VoyageState = "sea" | "arrived" | "origin";

export function voyageStateOf(s: Pick<LiveShipment, "atOrigin" | "arrived">): VoyageState {
  return s.atOrigin ? "origin" : s.arrived ? "arrived" : "sea";
}

const VOYAGE_ORDER: Record<VoyageState, number> = { sea: 0, arrived: 1, origin: 2 };

/**
 * Under way first, then arrived, then still-at-the-quay — each group most
 * recently updated first.
 *
 * `rank` packs stage priority into the top digits and (1e13 − updated_at) into
 * the bottom ones, so `rank % 1e13` recovers recency without shipping the
 * timestamp separately. Used BOTH server-side (to decide which rows survive the
 * client-row cap) and client-side (list order), so the list can never be
 * missing a vessel the map is drawing.
 */
export function compareByVoyage(a: LiveShipment, b: LiveShipment): number {
  return (
    VOYAGE_ORDER[voyageStateOf(a)] - VOYAGE_ORDER[voyageStateOf(b)] ||
    (a.rank % 1e13) - (b.rank % 1e13)
  );
}

/* ------------------------------------------------------------------ */
/* Fleet dots — EVERY live work order, as a map-only position           */
/* ------------------------------------------------------------------ */

/**
 * The whole month's fleet, in the smallest shape the map can draw.
 *
 * The tracking list is capped at a few hundred `LiveShipment` objects (each one
 * carries a ten-stage journey, a details map and a search haystack — ~2 KB a
 * row). The MAP, though, wants every live work order at once so the user can
 * see the vessels spread across the oceans, so the page ships this parallel
 * array instead: seven scalar fields, no geometry, no nested objects.
 */
export type FleetDot = {
  /** bajaj_work_orders.id — matches LiveShipment.key, so a click can select it */
  key: string;
  lng: number;
  lat: number;
  /** "sea" = under way, "arrived" = at the POD, "origin" = not sailed yet */
  state: "sea" | "arrived" | "origin";
  /** board label, e.g. "VIPAR" */
  board: string;
  /** WO number */
  id: string;
  /** 3-letter POD code */
  port: string;
};

/**
 * One fleet dot, or null when the POD has no sea corridor (unknown / mis-typed
 * / landlocked) — exactly the rows the map already refuses to draw, which would
 * otherwise all pile up on the Nhava Sheva coordinate.
 */
export function toFleetDot(
  row: WorkOrderRow,
  status: StatusMeta | null,
  boardLabel: string,
  now: Date,
): FleetDot | null {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const seaRoute = routeForPort(data.port);
  if (!seaRoute) return null;

  const fix = voyageFix(data, status?.name, seaRoute, portKey(data.port), now);
  const cur = pointAt(seaRoute, fix.markerProgress);

  // Trans-Pacific corridors carry continuous (unwrapped) longitudes past 180 so
  // the polyline does not wrap the globe; a lone POINT has no such need, and an
  // unwrapped 241° would drag the fleet bounding box across the whole world.
  const lng = ((((cur[0] + 180) % 360) + 360) % 360) - 180;

  return {
    key: row.id,
    // 3 decimals ≈ 100 m — far finer than any zoom this map reaches, and it
    // keeps each number to 6-8 characters in the RSC payload.
    lng: Number(lng.toFixed(3)),
    lat: Number(cur[1].toFixed(3)),
    state: fix.atOrigin ? "origin" : fix.arrived ? "arrived" : "sea",
    board: boardLabel,
    id: String(data.wo ?? "").trim() || row.id.slice(0, 8).toUpperCase(),
    port: portCode(data.port),
  };
}

/**
 * Routes shared by destination port. A month can hold hundreds of work orders
 * bound for the same POD; shipping one polyline per row would repeat the same
 * 30-60 coordinate pairs over and over in the RSC payload, so the page sends
 * this lookup once and each shipment references it by `routeKey`.
 */
export function routesForShipments(shipments: LiveShipment[]): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {};
  for (const s of shipments) {
    if (!s.routeKey || out[s.routeKey]) continue;
    const r = routeForPortKey(s.routeKey);
    if (r) out[s.routeKey] = r;
  }
  return out;
}
