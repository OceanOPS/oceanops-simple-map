export type EditionCruiseRow = {
  cruise_ref?: string;
  cruise_date?: string;
  ship_name?: string;
  ship_country?: string;
  program_country?: string;
  /** Ship metadata intentionally hidden in DB (hide_metadata = 1). */
  ship_masked?: boolean;
};

export function parseShipMaskedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** Normalize ISO dates or ArcGIS epoch values for display. */
export function formatCruiseDate(value: unknown, displayFallback = ""): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const str = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const num = Number(str);
  if (Number.isFinite(num) && num > 0) {
    const ms = num > 1e11 ? num : num * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const fromDisplay = displayFallback.match(/^(\d{4}-\d{2}-\d{2})/);
  if (fromDisplay) return fromDisplay[1];

  return str || "—";
}

const BASE = import.meta.env.BASE_URL;

const cacheByLayer = new Map<string, Map<string, EditionCruiseRow[]>>();
const loadPromises = new Map<string, Promise<Map<string, EditionCruiseRow[]>>>();

export function parseEditionCruisesRaw(raw: unknown): EditionCruiseRow[] {
  if (raw == null || raw === "") return [];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[]") return [];
    try {
      parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
    } catch {
      return [];
    }
  }

  let rows: unknown[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === "object") {
    rows = Object.values(parsed as Record<string, unknown>);
  }

  const out: EditionCruiseRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    out.push({
      cruise_ref: String(record.cruise_ref ?? "").trim(),
      cruise_date: formatCruiseDate(record.cruise_date),
      ship_name: String(record.ship_name ?? "").trim(),
      ship_country: String(record.ship_country ?? "").trim(),
      program_country: String(record.program_country ?? "").trim(),
      ship_masked: parseShipMaskedFlag(record.ship_masked),
    });
  }
  return out;
}

async function loadEditionCruisesByLine(
  layerId: string
): Promise<Map<string, EditionCruiseRow[]>> {
  const cached = cacheByLayer.get(layerId);
  if (cached) return cached;

  let pending = loadPromises.get(layerId);
  if (!pending) {
    pending = (async () => {
      const byLine = new Map<string, EditionCruiseRow[]>();
      try {
        const response = await fetch(`${BASE}geojson/${layerId}_undensified.geojson`, {
          cache: "no-cache",
        });
        if (!response.ok) return byLine;
        const geo = (await response.json()) as {
          features?: Array<{ properties?: Record<string, unknown> }>;
        };
        for (const feature of geo.features ?? []) {
          const lineName = String(feature.properties?.line_name ?? "").trim();
          if (!lineName) continue;
          const rows = parseEditionCruisesRaw(feature.properties?.edition_cruises);
          if (rows.length > 0) byLine.set(lineName, rows);
        }
      } catch {
        return byLine;
      }
      cacheByLayer.set(layerId, byLine);
      return byLine;
    })();
    loadPromises.set(layerId, pending);
  }

  return pending;
}

/** ArcGIS may drop or stringify nested GeoJSON arrays — fall back to source file. */
export async function getEditionCruisesForLine(
  layerId: string,
  lineName: string,
  attrs: Record<string, unknown>
): Promise<EditionCruiseRow[]> {
  const fromAttrs = parseEditionCruisesRaw(attrs.edition_cruises);
  if (fromAttrs.length >= 2) return fromAttrs;

  const byLine = await loadEditionCruisesByLine(layerId);
  const fromFile = byLine.get(lineName) ?? [];
  return fromFile.length >= fromAttrs.length ? fromFile : fromAttrs;
}
