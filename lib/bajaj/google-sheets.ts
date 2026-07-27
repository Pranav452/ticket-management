import { createSign } from "node:crypto";

// ---------------------------------------------------------------------------
// Dependency-free Google Sheets API v4 client (read-only, service account).
// Auth: self-signed RS256 JWT exchanged at the OAuth token endpoint. Degrades
// gracefully — sheetSyncEnabled() is false unless all env vars are present.
//
// Env: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (PEM; literal \n allowed),
//      BAJAJ_SHEET_ID.
// ---------------------------------------------------------------------------

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export function sheetSyncEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.BAJAJ_SHEET_ID,
  );
}

/** Env vars still missing for sheet sync — for the admin UI setup hint. */
export function missingSheetSyncEnv(): string[] {
  return (["GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "BAJAJ_SHEET_ID"] as const).filter(
    (name) => !process.env[name],
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function normalizePrivateKey(raw: string): string {
  // .env files often hold the key with literal "\n" sequences.
  return raw.replace(/\\n/g, "\n").trim();
}

interface CachedToken {
  accessToken: string;
  /** Epoch ms after which the token should not be reused. */
  staleAt: number;
}

// Survives module re-evaluation across dev recompiles.
const g = globalThis as { __bajajSheetsToken?: CachedToken };

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Google Sheets sync is not configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY missing).");
  }

  const cached = g.__bajajSheetsToken;
  if (cached && Date.now() < cached.staleAt) return cached.accessToken;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(normalizePrivateKey(key), "base64url");
  } catch {
    throw new Error(
      "Invalid GOOGLE_SA_PRIVATE_KEY — expected the PEM private key from the service-account JSON file.",
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 400 || res.status === 401) {
      throw new Error(
        "Google rejected the service-account credentials — check GOOGLE_SA_EMAIL and GOOGLE_SA_PRIVATE_KEY match the downloaded JSON key.",
      );
    }
    throw new Error(`Google token endpoint error (HTTP ${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google token endpoint returned no access token.");

  g.__bajajSheetsToken = {
    accessToken: data.access_token,
    // Refresh ~1 minute before actual expiry.
    staleAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
  };
  return data.access_token;
}

/**
 * Fetch raw grid rows from the sheet. UNFORMATTED_VALUE + SERIAL_NUMBER means
 * date cells arrive as Excel-style serial numbers, so the existing ingest
 * date logic applies unchanged.
 */
export async function fetchSheetRows(sheetId: string, tab?: string): Promise<unknown[][]> {
  const token = await getAccessToken();

  const range = tab ? `'${tab.replace(/'/g, "''")}'!A1:AZ10000` : "A1:AZ10000";
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}` +
    `?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 403) {
      throw new Error(
        `Access denied (403) — share the Google Sheet (viewer access) with the service account: ${process.env.GOOGLE_SA_EMAIL}`,
      );
    }
    if (res.status === 404) {
      throw new Error(`Sheet not found (404) — check BAJAJ_SHEET_ID "${sheetId}" (the long id in the sheet URL).`);
    }
    if (res.status === 400 && tab) {
      throw new Error(`Tab "${tab}" not found in the sheet (case-sensitive).`);
    }
    throw new Error(`Google Sheets API error (HTTP ${res.status}): ${body}`);
  }

  const data = (await res.json()) as { values?: unknown[][] };
  return data.values ?? [];
}

/** Titles of all tabs in the spreadsheet, in sheet order. */
export async function listSheetTabs(sheetId: string): Promise<string[]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google Sheets API error (HTTP ${res.status}) while listing tabs.`);
  const data = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}
