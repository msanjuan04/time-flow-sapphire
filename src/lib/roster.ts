import { toMinutes } from "../../supabase/functions/_shared/scheduleWindow";

/**
 * Cuadrante semanal del equipo.
 *
 * Monta la rejilla de personas por días a partir de los horarios asignados
 * y prepara las copias de semana, que es como se hacen las rotaciones: se
 * define una semana y se repite.
 */

export interface RosterMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
}

export interface RosterSchedule {
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  morning_end_time: string | null;
  afternoon_start_time: string | null;
  expected_hours: number | string | null;
  notes?: string | null;
}

export interface RosterCell {
  date: string;
  schedule: RosterSchedule | null;
  hours: number;
  label: string;
}

export interface RosterRow {
  userId: string;
  name: string;
  cells: RosterCell[];
  totalHours: number;
  daysWithShift: number;
}

export interface RosterWeek {
  weekStart: string;
  days: string[];
  rows: RosterRow[];
  dayTotals: { date: string; hours: number; people: number }[];
  totalHours: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Lunes de la semana de esa fecha. */
export const weekStartOf = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

export const shiftWeeks = (weekStart: Date, weeks: number): Date => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

export const weekDays = (weekStart: Date): string[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return dateKey(d);
  });

const hhmm = (value?: string | null) => (value ? String(value).slice(0, 5) : null);

/** "09:00 - 14:00 · 16:00 - 20:00" en turno partido, "09:00 - 17:00" si es continuo. */
export const describeShift = (schedule: RosterSchedule | null): string => {
  if (!schedule) return "—";
  const start = hhmm(schedule.start_time);
  const end = hhmm(schedule.end_time);
  const morningEnd = hhmm(schedule.morning_end_time);
  const afternoonStart = hhmm(schedule.afternoon_start_time);
  if (!start || !end) return "—";
  if (morningEnd && afternoonStart) return `${start} - ${morningEnd} · ${afternoonStart} - ${end}`;
  return `${start} - ${end}`;
};

/** Horas previstas del día; si no vienen, se estiman del horario. */
export const cellHours = (schedule: RosterSchedule | null): number => {
  if (!schedule) return 0;
  const declared = Number(schedule.expected_hours ?? 0);
  if (Number.isFinite(declared) && declared > 0) return Math.round(declared * 100) / 100;

  const start = toMinutes(schedule.start_time);
  const end = toMinutes(schedule.end_time);
  if (start === null || end === null) return 0;
  const morningEnd = toMinutes(schedule.morning_end_time);
  const afternoonStart = toMinutes(schedule.afternoon_start_time);
  const span = (from: number, to: number) => (to >= from ? to - from : to + 1440 - from);
  const minutes =
    morningEnd !== null && afternoonStart !== null
      ? span(start, morningEnd) + span(afternoonStart, end)
      : span(start, end);
  return Math.round((minutes / 60) * 100) / 100;
};

export function buildRosterWeek(
  weekStart: Date,
  members: RosterMember[],
  schedules: RosterSchedule[]
): RosterWeek {
  const days = weekDays(weekStart);
  const byUserDay = new Map<string, RosterSchedule>();
  for (const s of schedules) byUserDay.set(`${s.user_id}|${s.date}`, s);

  const rows: RosterRow[] = members
    .map((member) => {
      const cells = days.map((date) => {
        const schedule = byUserDay.get(`${member.user_id}|${date}`) ?? null;
        return { date, schedule, hours: cellHours(schedule), label: describeShift(schedule) };
      });
      return {
        userId: member.user_id,
        name: member.full_name?.trim() || member.email || "Sin nombre",
        cells,
        totalHours: Math.round(cells.reduce((sum, c) => sum + c.hours, 0) * 100) / 100,
        daysWithShift: cells.filter((c) => c.schedule).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const dayTotals = days.map((date, index) => {
    const cells = rows.map((r) => r.cells[index]);
    return {
      date,
      hours: Math.round(cells.reduce((sum, c) => sum + c.hours, 0) * 100) / 100,
      people: cells.filter((c) => c.schedule).length,
    };
  });

  return {
    weekStart: dateKey(weekStart),
    days,
    rows,
    dayTotals,
    totalHours: Math.round(rows.reduce((sum, r) => sum + r.totalHours, 0) * 100) / 100,
  };
}

export interface SchedulePayload {
  user_id: string;
  company_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  morning_end_time: string | null;
  afternoon_start_time: string | null;
  expected_hours: number;
  created_by: string;
}

/**
 * Copia los horarios de una semana a otra u otras. Es la pieza de las
 * rotaciones: se define una semana y se repite hacia delante.
 *
 * `offsets` son semanas de distancia respecto a la de origen: [1] copia a
 * la siguiente, [1,2,3] a las tres siguientes, [0] a la misma semana (se
 * usa al copiar desde la anterior).
 */
export function copyWeekPayload(input: {
  sourceSchedules: RosterSchedule[];
  sourceWeekStart: Date;
  targetOffsets: number[];
  userIds: string[];
  companyId: string;
  createdBy: string;
}): SchedulePayload[] {
  const selected = new Set(input.userIds);
  const sourceDays = weekDays(input.sourceWeekStart);
  const payload: SchedulePayload[] = [];

  for (const offset of input.targetOffsets) {
    const targetDays = weekDays(shiftWeeks(input.sourceWeekStart, offset));
    for (const schedule of input.sourceSchedules) {
      if (!selected.has(schedule.user_id)) continue;
      const index = sourceDays.indexOf(schedule.date);
      if (index === -1) continue;
      const hours = cellHours(schedule);
      if (hours <= 0) continue;
      payload.push({
        user_id: schedule.user_id,
        company_id: input.companyId,
        date: targetDays[index],
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        morning_end_time: schedule.morning_end_time,
        afternoon_start_time: schedule.afternoon_start_time,
        expected_hours: hours,
        created_by: input.createdBy,
      });
    }
  }

  return payload;
}
