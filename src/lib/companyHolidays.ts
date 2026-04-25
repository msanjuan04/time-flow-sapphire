import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_REGION,
  getHolidaysForRegion,
  type HolidayDef,
} from "@/data/spainHolidays";

export interface CompanyHolidayRow {
  id: string;
  company_id: string;
  holiday_date: string; // ISO yyyy-MM-dd
  name: string;
  notes: string | null;
}

export interface EffectiveHolidays {
  region: string;
  /** All holidays applying to the company (national + regional + local), sorted ascending */
  list: HolidayDef[];
  /** Set of ISO dates for fast lookups */
  dates: Set<string>;
  /** Just the local custom rows for editing */
  customRows: CompanyHolidayRow[];
}

/**
 * Loads the company's holiday region (from companies.holiday_region) and the
 * list of custom local holidays from company_holidays. Then merges with the
 * national + regional defaults defined in spainHolidays.ts.
 *
 * Returns sensible defaults if the company row is missing or the region
 * column doesn't exist yet (DB without the migration applied).
 */
export async function loadEffectiveHolidays(
  companyId: string,
  year?: number
): Promise<EffectiveHolidays> {
  if (!companyId) {
    const list = getHolidaysForRegion(DEFAULT_REGION, year);
    return {
      region: DEFAULT_REGION,
      list,
      dates: new Set(list.map((h) => h.date)),
      customRows: [],
    };
  }

  // Fetch region (gracefully handle column missing)
  let region = DEFAULT_REGION;
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("holiday_region")
      .eq("id", companyId)
      .maybeSingle();
    if (company && (company as any).holiday_region) {
      region = (company as any).holiday_region as string;
    }
  } catch (err) {
    console.warn("loadEffectiveHolidays: region fetch failed", err);
  }

  // Fetch local custom holidays
  let customRows: CompanyHolidayRow[] = [];
  try {
    let query = supabase
      .from("company_holidays")
      .select("id, company_id, holiday_date, name, notes")
      .eq("company_id", companyId)
      .order("holiday_date", { ascending: true });
    if (year) {
      query = query
        .gte("holiday_date", `${year}-01-01`)
        .lte("holiday_date", `${year}-12-31`);
    }
    const { data, error } = await query;
    if (error) throw error;
    customRows = (data as CompanyHolidayRow[]) || [];
  } catch (err) {
    console.warn("loadEffectiveHolidays: custom holidays fetch failed", err);
  }

  const baseList = getHolidaysForRegion(region, year);
  const customAsDef: HolidayDef[] = customRows.map((r) => ({
    date: r.holiday_date,
    name: r.name,
    scope: "local" as const,
  }));

  const merged = [...baseList, ...customAsDef].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const dates = new Set(merged.map((h) => h.date));

  return { region, list: merged, dates, customRows };
}

/**
 * Convenience wrapper that returns just the Set of holiday ISO dates.
 * Used by vacationGuard to exclude holidays from working-day counts.
 */
export async function loadCompanyHolidayDates(
  companyId: string,
  year?: number
): Promise<Set<string>> {
  const eff = await loadEffectiveHolidays(companyId, year);
  return eff.dates;
}
