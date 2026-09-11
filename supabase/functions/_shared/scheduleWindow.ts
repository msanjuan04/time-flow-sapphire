/**
 * Comparación de un fichaje con el horario del día.
 *
 * Compartido entre la edge function `clock` (Deno) y el frontend/tests
 * (Vite/Vitest): TypeScript puro, sin dependencias ni APIs de plataforma.
 *
 * Regla de negocio (2026-09-11): un fichaje NUNCA se rechaza por la hora.
 * El registro de jornada tiene que reflejar la hora real en que se empieza
 * y se termina (art. 34.9 ET). Si la hora se sale de los márgenes de la
 * empresa, se guarda la desviación en el evento y se avisa al responsable.
 *
 * Turno partido: si el horario tiene tramo de mañana y de tarde, la entrada
 * se compara con el inicio más cercano (mañana o tarde) y la salida con el
 * final más cercano. Así volver de comer a las 16:00 no cuenta como retraso
 * respecto a las 09:00.
 */

export interface DaySchedule {
  start_time?: string | null;
  end_time?: string | null;
  morning_end_time?: string | null;
  afternoon_start_time?: string | null;
  expected_hours?: number | string | null;
}

export interface ScheduleMargins {
  entryEarly: number;
  entryLate: number;
  exitEarly: number;
  exitLate: number;
}

export type DeviationKind = "early_entry" | "late_entry" | "early_exit" | "late_exit";

export interface ScheduleDeviation {
  kind: DeviationKind;
  /** Minutos respecto a la hora de referencia del horario (siempre positivo). */
  minutes: number;
  /** Hora del horario con la que se ha comparado, en formato HH:mm. */
  reference: string;
}

export const DEVIATION_LABELS: Record<DeviationKind, string> = {
  early_entry: "entrada anticipada",
  late_entry: "entrada con retraso",
  early_exit: "salida anticipada",
  late_exit: "salida tardía",
};

/** "09:30" o "09:30:00" → 570. Devuelve null si no es una hora válida. */
export const toMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const [h, m] = String(value).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

export const formatMinutesAsTime = (minutes: number): string => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Zona horaria de las empresas. La edge function corre en UTC: sin esto, en
 * verano el horario de las 09:00 se comparaba con las 07:00.
 */
export const COMPANY_TIME_ZONE = "Europe/Madrid";

const partsInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: Number(get("hour")), minute: Number(get("minute")) };
};

/** Minutos desde medianoche en la zona horaria de la empresa. */
export const minutesInTimeZone = (date: Date, timeZone: string = COMPANY_TIME_ZONE): number => {
  const p = partsInTimeZone(date, timeZone);
  return p.hour * 60 + p.minute;
};

/** Fecha YYYY-MM-DD en la zona horaria de la empresa. */
export const dateKeyInTimeZone = (date: Date, timeZone: string = COMPANY_TIME_ZONE): string => {
  const p = partsInTimeZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
};

/** Diferencia con signo en minutos, en [-720, 720). Tolera turnos que cruzan medianoche. */
const signedDiff = (current: number, reference: number): number =>
  ((((current - reference) % 1440) + 1440 + 720) % 1440) - 720;

export const isSplitShift = (schedule: DaySchedule | null | undefined): boolean =>
  toMinutes(schedule?.morning_end_time) !== null && toMinutes(schedule?.afternoon_start_time) !== null;

/** Un horario cuenta si tiene horas previstas y hora de inicio y fin. */
export const hasUsableSchedule = (schedule: DaySchedule | null | undefined): boolean =>
  Boolean(schedule) &&
  Number(schedule?.expected_hours ?? 0) > 0 &&
  toMinutes(schedule?.start_time) !== null &&
  toMinutes(schedule?.end_time) !== null;

/** Horas de entrada previstas del día: una en jornada continua, dos en turno partido. */
export const entryReferences = (schedule: DaySchedule): number[] => {
  const start = toMinutes(schedule.start_time);
  const afternoon = toMinutes(schedule.afternoon_start_time);
  const refs: number[] = [];
  if (start !== null) refs.push(start);
  if (isSplitShift(schedule) && afternoon !== null) refs.push(afternoon);
  return refs;
};

/** Horas de salida previstas del día: una en jornada continua, dos en turno partido. */
export const exitReferences = (schedule: DaySchedule): number[] => {
  const end = toMinutes(schedule.end_time);
  const morningEnd = toMinutes(schedule.morning_end_time);
  const refs: number[] = [];
  if (isSplitShift(schedule) && morningEnd !== null) refs.push(morningEnd);
  if (end !== null) refs.push(end);
  return refs;
};

/**
 * Devuelve la desviación de un fichaje respecto al horario, o null si está
 * dentro de márgenes, no hay horario o la acción no es entrada/salida.
 */
export function classifyScheduleDeviation(
  schedule: DaySchedule | null | undefined,
  action: string,
  currentMinutes: number,
  margins: ScheduleMargins
): ScheduleDeviation | null {
  if (!schedule || !hasUsableSchedule(schedule)) return null;
  if (action !== "in" && action !== "out") return null;

  const refs = action === "in" ? entryReferences(schedule) : exitReferences(schedule);
  if (refs.length === 0) return null;

  let best = refs[0];
  let bestDiff = signedDiff(currentMinutes, best);
  for (const ref of refs.slice(1)) {
    const diff = signedDiff(currentMinutes, ref);
    if (Math.abs(diff) < Math.abs(bestDiff)) {
      best = ref;
      bestDiff = diff;
    }
  }

  const earlyMargin = action === "in" ? margins.entryEarly : margins.exitEarly;
  const lateMargin = action === "in" ? margins.entryLate : margins.exitLate;

  if (bestDiff < -earlyMargin) {
    return {
      kind: action === "in" ? "early_entry" : "early_exit",
      minutes: -bestDiff,
      reference: formatMinutesAsTime(best),
    };
  }
  if (bestDiff > lateMargin) {
    return {
      kind: action === "in" ? "late_entry" : "late_exit",
      minutes: bestDiff,
      reference: formatMinutesAsTime(best),
    };
  }
  return null;
}
