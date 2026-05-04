import { supabase } from "@/integrations/supabase/client";

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAY_KEYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export interface DaySchedule {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  morning_end?: string | null;
  afternoon_start?: string | null;
  expected_hours?: number | null;
}

export interface ScheduleTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  monday: DaySchedule | null;
  tuesday: DaySchedule | null;
  wednesday: DaySchedule | null;
  thursday: DaySchedule | null;
  friday: DaySchedule | null;
  saturday: DaySchedule | null;
  sunday: DaySchedule | null;
  skip_holidays: boolean;
  created_at: string;
}

/**
 * Calculate effective hours per day from a DaySchedule. Handles split shifts.
 */
export function calcDayHours(d: DaySchedule | null): number {
  if (!d || !d.start || !d.end) return 0;
  if (d.expected_hours != null) return d.expected_hours;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };
  const startMin = toMin(d.start);
  const endMin = toMin(d.end);
  let totalMin = endMin - startMin;
  if (totalMin <= 0) return 0;

  if (d.morning_end && d.afternoon_start) {
    const mEnd = toMin(d.morning_end);
    const aStart = toMin(d.afternoon_start);
    if (aStart > mEnd && mEnd > startMin && aStart < endMin) {
      totalMin -= (aStart - mEnd);
    }
  }
  return Math.max(0, totalMin / 60);
}

/**
 * Total weekly hours across all days.
 */
export function calcWeeklyHours(t: Partial<ScheduleTemplate>): number {
  return DAY_KEYS.reduce((acc, k) => acc + calcDayHours((t as any)[k] ?? null), 0);
}

/**
 * Apply a template to a list of users in a date range, via SQL RPC.
 */
export async function applyScheduleTemplate(opts: {
  templateId: string;
  userIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  overwrite?: boolean;
}): Promise<{ ok: boolean; insertedOrUpdated?: number; templateName?: string; error?: string }> {
  const { data, error } = await supabase.rpc("apply_schedule_template" as any, {
    p_template_id: opts.templateId,
    p_user_ids: opts.userIds,
    p_start_date: opts.startDate,
    p_end_date: opts.endDate,
    p_overwrite: opts.overwrite ?? true,
  } as any);

  if (error) return { ok: false, error: error.message };
  const payload = (data || {}) as any;
  if (payload.ok === false) return { ok: false, error: payload.error };
  return {
    ok: true,
    insertedOrUpdated: payload.inserted_or_updated,
    templateName: payload.template_name,
  };
}

/**
 * Build the short summary row shown in lists, e.g.
 *  "L 09-17 · M 09-17 · X 09-17 · J 09-17 · V 09-17 · S — · D —"
 */
export function buildTemplateSummary(t: Partial<ScheduleTemplate>): string {
  const labels: Record<DayKey, string> = {
    monday: "L",
    tuesday: "M",
    wednesday: "X",
    thursday: "J",
    friday: "V",
    saturday: "S",
    sunday: "D",
  };
  return DAY_KEYS.map((k) => {
    const d = (t as any)[k] as DaySchedule | null | undefined;
    if (!d || !d.start || !d.end) return `${labels[k]} —`;
    const fmt = (s: string) => s.replace(":00", "");
    return `${labels[k]} ${fmt(d.start)}-${fmt(d.end)}`;
  }).join(" · ");
}
