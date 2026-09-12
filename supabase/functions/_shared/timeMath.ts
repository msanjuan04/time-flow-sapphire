/**
 * Cálculo de horas trabajadas a partir de los fichajes.
 *
 * Compartido entre las edge functions (Deno) y el navegador: TypeScript
 * puro, sin dependencias. El servidor y la pantalla tienen que dar el mismo
 * número, porque ese número es el que se firma.
 */

export interface ClockEventLite {
  event_type: string;
  event_time: string;
}

/** Clave de día en hora local del navegador. */
export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Segundos trabajados por día, descontando pausas. Cada tramo cuenta para el
 * día en que empezó la sesión: un turno de 22:00 a 06:00 suma al día de la
 * entrada, como la jornada laboral. Una sesión abierta cuenta hasta `now`.
 *
 * `dateKey` permite fijar la zona horaria: el servidor corre en UTC y pasa
 * la de España, el navegador usa la suya.
 */
export function workedSecondsByDay(
  events: ClockEventLite[],
  now: Date = new Date(),
  dateKey: (d: Date) => string = localDateKey
): Record<string, number> {
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
        sessionDay = dateKey(new Date(e.t));
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

/** Segundos a horas con dos decimales. */
export const toHours = (seconds: number): number => Math.round((seconds / 3600) * 100) / 100;
