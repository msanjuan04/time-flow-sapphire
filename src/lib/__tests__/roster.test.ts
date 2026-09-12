import { describe, it, expect } from "vitest";
import {
  buildRosterWeek,
  cellHours,
  copyWeekPayload,
  dateKey,
  describeShift,
  weekDays,
  weekStartOf,
  type RosterSchedule,
} from "@/lib/roster";

const lunes = new Date(2026, 8, 14); // 14 de septiembre de 2026, lunes
const turno = (over: Partial<RosterSchedule> & { user_id: string; date: string }): RosterSchedule => ({
  start_time: "09:00:00",
  end_time: "17:00:00",
  morning_end_time: null,
  afternoon_start_time: null,
  expected_hours: 7,
  ...over,
});

const ana = { user_id: "ana", full_name: "Ana", email: "ana@clinica.es" };
const luis = { user_id: "luis", full_name: null, email: "luis@clinica.es" };

describe("semana del cuadrante", () => {
  it("la semana empieza el lunes, también si se pide desde el domingo", () => {
    expect(dateKey(weekStartOf(new Date(2026, 8, 20)))).toBe("2026-09-14");
    expect(dateKey(weekStartOf(new Date(2026, 8, 14)))).toBe("2026-09-14");
  });

  it("son siete días consecutivos", () => {
    expect(weekDays(lunes)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});

describe("cómo se lee cada turno", () => {
  it("jornada continua", () => {
    expect(describeShift(turno({ user_id: "ana", date: "2026-09-14" }))).toBe("09:00 - 17:00");
  });

  it("jornada partida muestra los dos tramos", () => {
    const partido = turno({
      user_id: "ana",
      date: "2026-09-14",
      morning_end_time: "14:00:00",
      afternoon_start_time: "16:00:00",
      end_time: "20:00:00",
      expected_hours: 9,
    });
    expect(describeShift(partido)).toBe("09:00 - 14:00 · 16:00 - 20:00");
  });

  it("día libre", () => {
    expect(describeShift(null)).toBe("—");
  });

  it("si no hay horas declaradas se calculan del horario, también en turno partido", () => {
    expect(cellHours(turno({ user_id: "a", date: "2026-09-14", expected_hours: null }))).toBe(8);
    expect(
      cellHours(
        turno({
          user_id: "a",
          date: "2026-09-14",
          expected_hours: null,
          morning_end_time: "14:00",
          afternoon_start_time: "16:00",
          end_time: "20:00",
        })
      )
    ).toBe(9);
  });

  it("turno de noche que cruza medianoche", () => {
    expect(
      cellHours(turno({ user_id: "a", date: "2026-09-14", start_time: "22:00", end_time: "06:00", expected_hours: null }))
    ).toBe(8);
  });
});

describe("buildRosterWeek", () => {
  const schedules = [
    turno({ user_id: "ana", date: "2026-09-14" }),
    turno({ user_id: "ana", date: "2026-09-15" }),
    turno({ user_id: "luis", date: "2026-09-15", expected_hours: 5 }),
  ];

  it("una fila por persona, siete celdas, ordenadas por nombre", () => {
    const week = buildRosterWeek(lunes, [luis, ana], schedules);
    expect(week.rows.map((r) => r.name)).toEqual(["Ana", "luis@clinica.es"]);
    expect(week.rows[0].cells).toHaveLength(7);
  });

  it("suma las horas por persona y por día", () => {
    const week = buildRosterWeek(lunes, [ana, luis], schedules);
    expect(week.rows[0]).toMatchObject({ name: "Ana", totalHours: 14, daysWithShift: 2 });
    expect(week.dayTotals[0]).toMatchObject({ date: "2026-09-14", hours: 7, people: 1 });
    expect(week.dayTotals[1]).toMatchObject({ date: "2026-09-15", hours: 12, people: 2 });
    expect(week.totalHours).toBe(19);
  });

  it("los días sin turno quedan vacíos", () => {
    const week = buildRosterWeek(lunes, [ana], schedules);
    expect(week.rows[0].cells[6]).toMatchObject({ schedule: null, hours: 0, label: "—" });
  });

  it("ignora horarios de otras semanas", () => {
    const week = buildRosterWeek(lunes, [ana], [turno({ user_id: "ana", date: "2026-09-07" })]);
    expect(week.totalHours).toBe(0);
  });
});

describe("copiar y repetir semanas", () => {
  const source = [
    turno({ user_id: "ana", date: "2026-09-14" }),
    turno({ user_id: "ana", date: "2026-09-16", morning_end_time: "14:00", afternoon_start_time: "16:00", end_time: "20:00", expected_hours: 9 }),
    turno({ user_id: "luis", date: "2026-09-14" }),
  ];
  const base = { sourceSchedules: source, sourceWeekStart: lunes, companyId: "c1", createdBy: "jefe" };

  it("copia a la semana siguiente conservando el día de la semana", () => {
    const payload = copyWeekPayload({ ...base, targetOffsets: [1], userIds: ["ana", "luis"] });
    expect(payload).toHaveLength(3);
    expect(payload.map((p) => p.date).sort()).toEqual(["2026-09-21", "2026-09-21", "2026-09-23"]);
  });

  it("repetir varias semanas multiplica las filas", () => {
    const payload = copyWeekPayload({ ...base, targetOffsets: [1, 2, 3], userIds: ["ana"] });
    expect(payload).toHaveLength(6);
    expect(new Set(payload.map((p) => p.user_id))).toEqual(new Set(["ana"]));
  });

  it("solo copia las personas seleccionadas", () => {
    const payload = copyWeekPayload({ ...base, targetOffsets: [1], userIds: ["luis"] });
    expect(payload).toEqual([
      expect.objectContaining({ user_id: "luis", date: "2026-09-21", expected_hours: 7 }),
    ]);
  });

  it("mantiene el turno partido y sus horas", () => {
    const payload = copyWeekPayload({ ...base, targetOffsets: [1], userIds: ["ana"] });
    const miercoles = payload.find((p) => p.date === "2026-09-23")!;
    expect(miercoles).toMatchObject({
      morning_end_time: "14:00",
      afternoon_start_time: "16:00",
      end_time: "20:00",
      expected_hours: 9,
    });
  });

  it("no copia días sin horas", () => {
    const vacio = [turno({ user_id: "ana", date: "2026-09-14", start_time: null, end_time: null, expected_hours: 0 })];
    expect(copyWeekPayload({ ...base, sourceSchedules: vacio, targetOffsets: [1], userIds: ["ana"] })).toEqual([]);
  });
});
