export type HolidayScope = "national" | "regional" | "local";

export interface HolidayDef {
  /** ISO yyyy-MM-dd */
  date: string;
  name: string;
  scope: HolidayScope;
  /** Two-letter ISO 3166-2 region code (e.g. "CT" for Catalunya). Only set when scope==='regional' */
  region?: string;
}

/**
 * Backward-compatibility shape used by older calendar code.
 */
export interface SpanishHoliday {
  date: string;
  name: string;
}

/** Spanish autonomous communities — used in the region selector. */
export const SPAIN_REGIONS: { code: string; name: string }[] = [
  { code: "AN", name: "Andalucía" },
  { code: "AR", name: "Aragón" },
  { code: "AS", name: "Asturias" },
  { code: "CB", name: "Cantabria" },
  { code: "CL", name: "Castilla y León" },
  { code: "CM", name: "Castilla-La Mancha" },
  { code: "CN", name: "Canarias" },
  { code: "CT", name: "Catalunya" },
  { code: "EX", name: "Extremadura" },
  { code: "GA", name: "Galicia" },
  { code: "IB", name: "Illes Balears" },
  { code: "MC", name: "Región de Murcia" },
  { code: "MD", name: "Comunidad de Madrid" },
  { code: "NC", name: "Navarra" },
  { code: "PV", name: "País Vasco" },
  { code: "RI", name: "La Rioja" },
  { code: "VC", name: "Comunitat Valenciana" },
];

export const DEFAULT_REGION = "CT";

/** Festivos nacionales (todos los años). */
export const NATIONAL_HOLIDAYS: HolidayDef[] = [
  // 2024
  { date: "2024-01-01", name: "Año Nuevo", scope: "national" },
  { date: "2024-01-06", name: "Epifanía", scope: "national" },
  { date: "2024-03-29", name: "Viernes Santo", scope: "national" },
  { date: "2024-05-01", name: "Día del Trabajador", scope: "national" },
  { date: "2024-08-15", name: "Asunción de la Virgen", scope: "national" },
  { date: "2024-10-12", name: "Fiesta Nacional de España", scope: "national" },
  { date: "2024-11-01", name: "Día de Todos los Santos", scope: "national" },
  { date: "2024-12-06", name: "Día de la Constitución", scope: "national" },
  { date: "2024-12-08", name: "Inmaculada Concepción", scope: "national" },
  { date: "2024-12-25", name: "Navidad", scope: "national" },
  // 2025
  { date: "2025-01-01", name: "Año Nuevo", scope: "national" },
  { date: "2025-01-06", name: "Epifanía", scope: "national" },
  { date: "2025-04-18", name: "Viernes Santo", scope: "national" },
  { date: "2025-05-01", name: "Día del Trabajador", scope: "national" },
  { date: "2025-08-15", name: "Asunción de la Virgen", scope: "national" },
  { date: "2025-10-12", name: "Fiesta Nacional de España", scope: "national" },
  { date: "2025-11-01", name: "Día de Todos los Santos", scope: "national" },
  { date: "2025-12-06", name: "Día de la Constitución", scope: "national" },
  { date: "2025-12-08", name: "Inmaculada Concepción", scope: "national" },
  { date: "2025-12-25", name: "Navidad", scope: "national" },
  // 2026
  { date: "2026-01-01", name: "Año Nuevo", scope: "national" },
  { date: "2026-01-06", name: "Epifanía", scope: "national" },
  { date: "2026-04-03", name: "Viernes Santo", scope: "national" },
  { date: "2026-05-01", name: "Día del Trabajador", scope: "national" },
  { date: "2026-08-15", name: "Asunción de la Virgen", scope: "national" },
  { date: "2026-10-12", name: "Fiesta Nacional de España", scope: "national" },
  { date: "2026-11-01", name: "Día de Todos los Santos", scope: "national" },
  { date: "2026-12-06", name: "Día de la Constitución", scope: "national" },
  { date: "2026-12-08", name: "Inmaculada Concepción", scope: "national" },
  { date: "2026-12-25", name: "Navidad", scope: "national" },
  // 2027
  { date: "2027-01-01", name: "Año Nuevo", scope: "national" },
  { date: "2027-01-06", name: "Epifanía", scope: "national" },
  { date: "2027-03-26", name: "Viernes Santo", scope: "national" },
  { date: "2027-05-01", name: "Día del Trabajador", scope: "national" },
  { date: "2027-08-15", name: "Asunción de la Virgen", scope: "national" },
  { date: "2027-10-12", name: "Fiesta Nacional de España", scope: "national" },
  { date: "2027-11-01", name: "Día de Todos los Santos", scope: "national" },
  { date: "2027-12-06", name: "Día de la Constitución", scope: "national" },
  { date: "2027-12-08", name: "Inmaculada Concepción", scope: "national" },
  { date: "2027-12-25", name: "Navidad", scope: "national" },
];

/**
 * Festivos autonómicos. Por defecto incluido Catalunya completo. Otras CCAA
 * añadirán entradas a medida que tengamos datos confirmados oficialmente.
 */
export const REGIONAL_HOLIDAYS: HolidayDef[] = [
  // ===== CATALUNYA (CT) =====
  // 2024
  { date: "2024-04-01", name: "Lunes de Pascua", scope: "regional", region: "CT" },
  { date: "2024-06-24", name: "Sant Joan", scope: "regional", region: "CT" },
  { date: "2024-09-11", name: "Diada Nacional de Catalunya", scope: "regional", region: "CT" },
  { date: "2024-12-26", name: "Sant Esteve", scope: "regional", region: "CT" },
  // 2025
  { date: "2025-04-21", name: "Lunes de Pascua", scope: "regional", region: "CT" },
  { date: "2025-06-24", name: "Sant Joan", scope: "regional", region: "CT" },
  { date: "2025-09-11", name: "Diada Nacional de Catalunya", scope: "regional", region: "CT" },
  { date: "2025-12-26", name: "Sant Esteve", scope: "regional", region: "CT" },
  // 2026
  { date: "2026-04-06", name: "Lunes de Pascua", scope: "regional", region: "CT" },
  { date: "2026-06-24", name: "Sant Joan", scope: "regional", region: "CT" },
  { date: "2026-09-11", name: "Diada Nacional de Catalunya", scope: "regional", region: "CT" },
  // (en 2026 Sant Esteve cae en sábado — algunas comarcas no lo recuperan)
  { date: "2026-12-26", name: "Sant Esteve", scope: "regional", region: "CT" },
  // 2027
  { date: "2027-03-29", name: "Lunes de Pascua", scope: "regional", region: "CT" },
  { date: "2027-06-24", name: "Sant Joan", scope: "regional", region: "CT" },
  { date: "2027-09-11", name: "Diada Nacional de Catalunya", scope: "regional", region: "CT" },
  { date: "2027-12-27", name: "Sant Esteve (recuperado)", scope: "regional", region: "CT" },
];

/**
 * Returns all holidays (national + regional for the given region) within
 * an optional year. Sorted ascending by date.
 */
export function getHolidaysForRegion(
  region: string | null | undefined,
  year?: number
): HolidayDef[] {
  const r = region || DEFAULT_REGION;
  const all = [
    ...NATIONAL_HOLIDAYS,
    ...REGIONAL_HOLIDAYS.filter((h) => h.region === r),
  ];
  const filtered = year
    ? all.filter((h) => h.date.startsWith(String(year)))
    : all;
  return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Tells whether a given ISO date is a holiday for the region (and optional
 * extra custom local holidays).
 */
export function isHoliday(
  isoDate: string,
  opts: {
    region?: string | null;
    customDates?: string[]; // ISO dates from company_holidays
  } = {}
): boolean {
  if (!isoDate) return false;
  if (opts.customDates && opts.customDates.includes(isoDate)) return true;
  const list = getHolidaysForRegion(opts.region);
  return list.some((h) => h.date === isoDate);
}

/**
 * Returns a Set<string> of ISO dates of all holidays for a region (+ optional
 * custom dates) for a specific year. Useful for fast lookups in calendars.
 */
export function holidayDateSet(
  region: string | null | undefined,
  customDates: string[] = [],
  year?: number
): Set<string> {
  const list = getHolidaysForRegion(region, year);
  return new Set([...list.map((h) => h.date), ...customDates]);
}

// ===== Backward compatibility =====
// Older code imports { SPANISH_HOLIDAYS } expecting a flat list of {date,name}.
// We keep it exported as the union of national + Catalunya (current default)
// so calendars that haven't been migrated yet still show something useful.
export const SPANISH_HOLIDAYS: SpanishHoliday[] = [
  ...NATIONAL_HOLIDAYS,
  ...REGIONAL_HOLIDAYS.filter((h) => h.region === DEFAULT_REGION),
].map((h) => ({ date: h.date, name: h.name }));
