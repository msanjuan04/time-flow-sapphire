import { type ClockEventLite, localDateKey, toHours, workedSecondsByDay } from "./timeMath.ts";

/**
 * Resumen mensual de jornada y horas extra.
 *
 * El artículo 35.5 del Estatuto de los Trabajadores obliga a registrar la
 * jornada día a día, totalizar las horas extraordinarias en el periodo de
 * abono y entregar copia del resumen al trabajador. Esto calcula ese
 * resumen a partir de los fichajes y del horario asignado.
 *
 * Reglas:
 *  - Extra de un día = trabajado por encima de su horario previsto.
 *  - Déficit = horario previsto no cubierto. No se compensa con las extra
 *    de otro día: se informan por separado, que es como se abona.
 *  - Un día con ausencia aprobada no genera déficit.
 *  - Lo trabajado en un día sin horario asignado no se cuenta como extra;
 *    se informa aparte para que el responsable lo revise.
 */

export interface MonthScheduleRow {
  date: string;
  expected_hours: number | string | null;
}

export interface MonthAbsenceRow {
  start_date: string;
  end_date: string;
  absence_type: string;
}

export interface MonthDay {
  date: string;
  worked: number;
  expected: number;
  extra: number;
  deficit: number;
  absence: string | null;
}

export interface MonthTotals {
  worked: number;
  expected: number;
  ordinary: number;
  extra: number;
  deficit: number;
  withoutSchedule: number;
  daysWorked: number;
  daysAbsent: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  days: MonthDay[];
  totals: MonthTotals;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export const daysInMonth = (year: number, month: number): string[] => {
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildMonthSummary(input: {
  year: number;
  month: number;
  events: ClockEventLite[];
  schedules: MonthScheduleRow[];
  absences?: MonthAbsenceRow[];
  now?: Date;
  dateKey?: (d: Date) => string;
}): MonthSummary {
  const { year, month, events, schedules, absences = [], now = new Date(), dateKey = localDateKey } = input;

  const workedByDay = workedSecondsByDay(events, now, dateKey);
  const expectedByDay = new Map<string, number>();
  for (const row of schedules) {
    const hours = Number(row.expected_hours ?? 0);
    if (Number.isFinite(hours) && hours > 0) {
      expectedByDay.set(row.date, (expectedByDay.get(row.date) ?? 0) + hours);
    }
  }

  const absenceByDay = new Map<string, string>();
  for (const a of absences) {
    for (const day of daysInMonth(year, month)) {
      if (day >= a.start_date && day <= a.end_date && !absenceByDay.has(day)) {
        absenceByDay.set(day, a.absence_type);
      }
    }
  }

  const days: MonthDay[] = [];
  const totals: MonthTotals = {
    worked: 0,
    expected: 0,
    ordinary: 0,
    extra: 0,
    deficit: 0,
    withoutSchedule: 0,
    daysWorked: 0,
    daysAbsent: 0,
  };

  for (const date of daysInMonth(year, month)) {
    const worked = toHours(workedByDay[date] ?? 0);
    const expected = round2(expectedByDay.get(date) ?? 0);
    const absence = absenceByDay.get(date) ?? null;

    let extra = 0;
    let deficit = 0;

    if (expected > 0) {
      extra = round2(Math.max(0, worked - expected));
      deficit = absence ? 0 : round2(Math.max(0, expected - worked));
      totals.ordinary = round2(totals.ordinary + Math.min(worked, expected));
    } else if (worked > 0) {
      totals.withoutSchedule = round2(totals.withoutSchedule + worked);
    }

    if (worked > 0 || expected > 0 || absence) {
      days.push({ date, worked, expected, extra, deficit, absence });
    }

    totals.worked = round2(totals.worked + worked);
    totals.expected = round2(totals.expected + expected);
    totals.extra = round2(totals.extra + extra);
    totals.deficit = round2(totals.deficit + deficit);
    if (worked > 0) totals.daysWorked += 1;
    if (absence) totals.daysAbsent += 1;
  }

  return { year, month, days, totals };
}

/**
 * Texto canónico del resumen para firmarlo. Cualquier cambio posterior en
 * los fichajes del mes cambia el hash, y la firma deja de cuadrar.
 */
export function canonicalMonthSummary(userId: string, companyId: string, summary: MonthSummary): string {
  const rows = summary.days.map(
    (d) => `${d.date}|${d.worked.toFixed(2)}|${d.expected.toFixed(2)}|${d.extra.toFixed(2)}|${d.deficit.toFixed(2)}|${d.absence ?? ""}`
  );
  const t = summary.totals;
  return [
    `v1`,
    `company:${companyId}`,
    `user:${userId}`,
    `period:${summary.year}-${pad2(summary.month)}`,
    `totals:${t.worked.toFixed(2)}|${t.expected.toFixed(2)}|${t.ordinary.toFixed(2)}|${t.extra.toFixed(2)}|${t.deficit.toFixed(2)}|${t.withoutSchedule.toFixed(2)}`,
    ...rows,
  ].join("\n");
}
