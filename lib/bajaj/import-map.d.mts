/** Type declarations for the shared JS import-map module (import-map.mjs). */

export type WorkOrderData = Record<string, string | number | null>;

export const HEADER_MAP: Record<string, string>;
export const SHEET_MODULE_MAP: Record<string, { slug: string; partsFrames?: boolean }>;
export const DEFAULT_CARD_FACE_FIELDS: string[];

export function normHeader(h: unknown): string;
export function buildColMap(headerValues: unknown[]): Record<number, string>;
export function formatCell(v: unknown): string | null;
export function coerceValue(key: string, raw: unknown): string | number | null;
export function buildRecord(
  colMap: Record<number, string>,
  rowValues: unknown[],
  opts?: { partsFrames?: boolean },
): WorkOrderData | null;
export function deriveCategory(veh: unknown): "PARTS" | "FRAMES" | "VEHICLE";
export function deriveStatusName(d: Record<string, unknown>): string;
