import { startOfWeek } from "date-fns";

// Orden fijo de la semana: lunes (1) a domingo (0) para alinearnos con ISO
export const WEEKDAYS = [
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
  { day: 6, name: "Sábado", short: "Sáb" },
  { day: 0, name: "Domingo", short: "Dom" },
];

export type DayTemplate = {
  day: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  name: string;
  short: string;
  enabled: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
};

export type WeekTemplate = {
  days: DayTemplate[];
};

const createEmptyDayTemplate = (wd: (typeof WEEKDAYS)[number]): DayTemplate => ({
  day: wd.day,
  name: wd.name,
  short: wd.short,
  enabled: false,
  morningStart: "",
  morningEnd: "",
  afternoonStart: "",
  afternoonEnd: "",
});

export const createEmptyWeekTemplate = (): WeekTemplate => ({
  days: WEEKDAYS.map(createEmptyDayTemplate),
});

// Evitar desajustes de zona horaria: parseamos fechas yyyy-mm-dd en UTC.
export const parseDateOnlyUtc = (value: string): Date => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

// Alinea una fecha al lunes de esa semana (semana ISO) en UTC
export const startOfIsoWeekUtc = (date: Date) =>
  startOfWeek(date, { weekStartsOn: 1 });

/** Convierte "HH:mm" o "HH:mm:ss" a minutos desde medianoche (0-1439). */
export const timeToMinutes = (t: string): number | null => {
  const parts = t.trim().split(":").map(Number);
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (h % 24) * 60 + (m % 60);
};

/**
 * Horas entre hora inicio y hora fin.
 * Si fin < inicio (ej. 20:00 → 02:00), se asume que el turno cruza medianoche.
 */
export const hoursBetween = (start: string, end: string): number => {
  const sm = timeToMinutes(start);
  const em = timeToMinutes(end);
  if (sm === null || em === null) return 0;
  let diff = em - sm;
  if (diff < 0) diff += 24 * 60; // turno nocturno
  return Math.max(0, diff) / 60;
};
