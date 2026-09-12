import {
  localDateKey,
  workedSecondsByDay,
  type ClockEventLite,
} from "../../supabase/functions/_shared/timeMath";

/**
 * Horas trabajadas a partir de los fichajes.
 *
 * El cálculo vive en supabase/functions/_shared/timeMath.ts para que el
 * servidor y la pantalla den exactamente el mismo número: es el que se
 * firma en el cierre mensual.
 */

export { localDateKey, workedSecondsByDay };
export type { ClockEventLite };

export interface ScheduledDayLite {
  date: string;
  expected_hours: number | string | null;
}

/** Lunes 00:00 de la semana de la fecha dada, en hora local. */
export const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

export interface WorkdaySummary {
  todaySeconds: number;
  todayExpectedSeconds: number;
  weekSeconds: number;
  weekExpectedSeconds: number;
}

/** Resumen de hoy y de la semana en curso (lunes a domingo). */
export function summarizeWorkday(
  events: ClockEventLite[],
  schedules: ScheduledDayLite[],
  now: Date = new Date()
): WorkdaySummary {
  const byDay = workedSecondsByDay(events, now);
  const todayKey = localDateKey(now);
  const weekStart = startOfWeekMonday(now);
  const weekKeys = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return localDateKey(d);
    })
  );

  let weekSeconds = 0;
  for (const [day, seconds] of Object.entries(byDay)) if (weekKeys.has(day)) weekSeconds += seconds;

  let todayExpectedSeconds = 0;
  let weekExpectedSeconds = 0;
  for (const s of schedules) {
    const seconds = Math.round(Number(s.expected_hours ?? 0) * 3600);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    if (weekKeys.has(s.date)) weekExpectedSeconds += seconds;
    if (s.date === todayKey) todayExpectedSeconds += seconds;
  }

  return {
    todaySeconds: byDay[todayKey] ?? 0,
    todayExpectedSeconds,
    weekSeconds,
    weekExpectedSeconds,
  };
}

/** 18720 → "5 h 12 min"; 2700 → "45 min"; 0 → "0 min". */
export const formatDuration = (seconds: number): string => {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};
