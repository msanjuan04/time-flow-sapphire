/**
 * Horas trabajadas a partir de los fichajes.
 *
 * Se calcula desde time_events (entrada, pausa, fin de pausa, salida) y no
 * desde work_sessions, porque las sesiones antiguas no guardan las pausas.
 * Cada tramo cuenta para el día en que empezó la sesión: un turno de noche
 * de 22:00 a 06:00 suma al día de la entrada, como la jornada laboral.
 */

export interface ClockEventLite {
  event_type: string;
  event_time: string;
}

export interface ScheduledDayLite {
  date: string;
  expected_hours: number | string | null;
}

export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Lunes 00:00 de la semana de la fecha dada, en hora local. */
export const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

/**
 * Segundos trabajados por día local, descontando pausas. Una sesión abierta
 * cuenta hasta `now`. Una entrada sin salida seguida de otra entrada se
 * descarta: no sabemos cuándo terminó y es mejor no inventar horas.
 */
export function workedSecondsByDay(events: ClockEventLite[], now: Date = new Date()): Record<string, number> {
  const sorted = events
    .map((e) => ({ type: e.event_type, t: new Date(e.event_time).getTime() }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

  const totalsMs: Record<string, number> = {};
  let sessionDay: string | null = null;
  let segmentStart: number | null = null;
  let paused = false;

  const addUntil = (end: number) => {
    if (sessionDay && segmentStart !== null && end > segmentStart) {
      totalsMs[sessionDay] = (totalsMs[sessionDay] ?? 0) + (end - segmentStart);
    }
  };

  for (const e of sorted) {
    switch (e.type) {
      case "clock_in":
        sessionDay = localDateKey(new Date(e.t));
        segmentStart = e.t;
        paused = false;
        break;
      case "pause_start":
        if (sessionDay && !paused) {
          addUntil(e.t);
          segmentStart = null;
          paused = true;
        }
        break;
      case "pause_end":
        if (sessionDay && paused) {
          segmentStart = e.t;
          paused = false;
        }
        break;
      case "clock_out":
        if (sessionDay && !paused) addUntil(e.t);
        sessionDay = null;
        segmentStart = null;
        paused = false;
        break;
      default:
        break;
    }
  }

  if (sessionDay && !paused) addUntil(now.getTime());

  const totals: Record<string, number> = {};
  for (const [day, ms] of Object.entries(totalsMs)) totals[day] = Math.floor(ms / 1000);
  return totals;
}

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
