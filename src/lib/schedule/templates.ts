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
