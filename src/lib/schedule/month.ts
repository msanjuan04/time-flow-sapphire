import {
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type MonthWeek = {
  weekStartDate: string; // yyyy-MM-dd (UTC)
  weekEndDate: string; // yyyy-MM-dd (UTC)
  label: string; // Semana 1, Semana 2 (cruza mes), etc.
  crossesMonth: boolean;
};

// Devuelve las semanas que tocan un mes dado. Semanas ISO (lunes-domingo).
// Una semana que cruza de mes se incluye en ambos meses y se etiqueta como "(cruza mes)".
export const getWeeksForMonth = (year: number, month: number): MonthWeek[] => {
  if (month < 1 || month > 12) {
    throw new Error("month debe estar en rango 1-12");
  }

  const monthStart = startOfMonth(new Date(Date.UTC(year, month - 1, 1)));
  const monthEnd = endOfMonth(monthStart);

  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks: MonthWeek[] = [];
  let counter = 1;

  while (cursor <= monthEnd) {
    const weekStart = cursor;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const crossesMonth =
      weekStart.getUTCMonth() !== monthStart.getUTCMonth() ||
      weekEnd.getUTCMonth() !== monthStart.getUTCMonth();

    weeks.push({
      weekStartDate: format(weekStart, "yyyy-MM-dd"),
      weekEndDate: format(weekEnd, "yyyy-MM-dd"),
      label: `Semana ${counter}${crossesMonth ? " (cruza mes)" : ""}`,
      crossesMonth,
    });

    counter += 1;
    cursor = addWeeks(cursor, 1);
  }

  return weeks;
};

export const getPreviousMonth = (year: number, month: number) => {
  if (month === 1) return { year: year - 1, month: 12 } as const;
  return { year, month: month - 1 } as const;
};

// Enlaza semanas del mes con claves de almacenamiento actuales (startDate ISO)
export const mapMonthWeeksToExistingWeekKeys = (weeks: MonthWeek[]) =>
  weeks.map((w) => w.weekStartDate);
