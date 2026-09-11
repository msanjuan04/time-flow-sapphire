import { describe, it, expect } from "vitest";
import { buildPresence, countPresence, type PresenceInput } from "@/lib/presence";

// Fechas en hora local para que el test no dependa de la zona horaria.
const at = (h: number, m = 0) => new Date(2026, 8, 14, h, m);
const iso = (h: number, m = 0) => at(h, m).toISOString();

const member = (id: string, name: string) => ({ user_id: id, full_name: name, email: `${id}@clinica.es` });
const continuous = { start_time: "09:00", end_time: "17:00", expected_hours: 7 };
const split = {
  start_time: "09:00",
  morning_end_time: "14:00",
  afternoon_start_time: "16:00",
  end_time: "20:00",
  expected_hours: 9,
};

const input = (overrides: Partial<PresenceInput>): PresenceInput => ({
  members: [],
  activeSessions: [],
  todayEvents: [],
  schedules: [],
  absences: [],
  now: at(10),
  entryLateMinutes: 15,
  ...overrides,
});

const rowOf = (rows: ReturnType<typeof buildPresence>, id: string) => rows.find((r) => r.userId === id)!;

describe("buildPresence", () => {
  it("trabajando desde su entrada", () => {
    const rows = buildPresence(
      input({
        members: [member("ana", "Ana")],
        activeSessions: [{ user_id: "ana", clock_in_time: iso(8, 57) }],
        todayEvents: [{ user_id: "ana", event_type: "clock_in", event_time: iso(8, 57) }],
      })
    );
    expect(rowOf(rows, "ana")).toMatchObject({ status: "working", detail: "Desde las 08:57" });
  });

  it("en pausa", () => {
    const rows = buildPresence(
      input({
        members: [member("ana", "Ana")],
        activeSessions: [{ user_id: "ana", clock_in_time: iso(9) }],
        todayEvents: [
          { user_id: "ana", event_type: "clock_in", event_time: iso(9) },
          { user_id: "ana", event_type: "pause_start", event_time: iso(9, 45) },
        ],
      })
    );
    expect(rowOf(rows, "ana")).toMatchObject({ status: "paused", detail: "En pausa desde las 09:45" });
  });

  it("con retraso: tenía que entrar a las 9 y son las 9:25 sin fichar", () => {
    const rows = buildPresence(
      input({
        members: [member("luis", "Luis")],
        schedules: [{ user_id: "luis", ...continuous }],
        now: at(9, 25),
      })
    );
    expect(rowOf(rows, "luis")).toMatchObject({ status: "late", detail: "Debía entrar a las 09:00", minutesLate: 25 });
  });

  it("dentro del margen de cortesía sigue como 'por llegar'", () => {
    const rows = buildPresence(
      input({ members: [member("luis", "Luis")], schedules: [{ user_id: "luis", ...continuous }], now: at(9, 10) })
    );
    expect(rowOf(rows, "luis").status).toBe("expected");
  });

  it("aún no le toca", () => {
    const rows = buildPresence(
      input({ members: [member("eva", "Eva")], schedules: [{ user_id: "eva", ...continuous }], now: at(8) })
    );
    expect(rowOf(rows, "eva")).toMatchObject({ status: "expected", detail: "Entra a las 09:00" });
  });

  it("turno partido: ha salido a comer y vuelve a las 16:00", () => {
    const rows = buildPresence(
      input({
        members: [member("eva", "Eva")],
        schedules: [{ user_id: "eva", ...split }],
        todayEvents: [
          { user_id: "eva", event_type: "clock_in", event_time: iso(9) },
          { user_id: "eva", event_type: "clock_out", event_time: iso(14, 2) },
        ],
        now: at(15),
      })
    );
    expect(rowOf(rows, "eva")).toMatchObject({ status: "left", detail: "Salió a las 14:02 · vuelve a las 16:00" });
  });

  it("turno partido: no ha vuelto de comer a las 16:30 → con retraso", () => {
    const rows = buildPresence(
      input({
        members: [member("eva", "Eva")],
        schedules: [{ user_id: "eva", ...split }],
        todayEvents: [
          { user_id: "eva", event_type: "clock_in", event_time: iso(9) },
          { user_id: "eva", event_type: "clock_out", event_time: iso(14) },
        ],
        now: at(16, 30),
      })
    );
    expect(rowOf(rows, "eva")).toMatchObject({ status: "late", detail: "Debía volver a las 16:00", minutesLate: 30 });
  });

  it("jornada continua terminada → ha salido", () => {
    const rows = buildPresence(
      input({
        members: [member("ana", "Ana")],
        schedules: [{ user_id: "ana", ...continuous }],
        todayEvents: [
          { user_id: "ana", event_type: "clock_in", event_time: iso(9) },
          { user_id: "ana", event_type: "clock_out", event_time: iso(17, 5) },
        ],
        now: at(18),
      })
    );
    expect(rowOf(rows, "ana")).toMatchObject({ status: "left", detail: "Salió a las 17:05" });
  });

  it("de vacaciones o de baja no cuenta como retraso", () => {
    const rows = buildPresence(
      input({
        members: [member("luis", "Luis"), member("sara", "Sara")],
        schedules: [
          { user_id: "luis", ...continuous },
          { user_id: "sara", ...continuous },
        ],
        absences: [
          { user_id: "luis", absence_type: "vacation" },
          { user_id: "sara", absence_type: "sick_leave" },
        ],
        now: at(11),
      })
    );
    expect(rowOf(rows, "luis")).toMatchObject({ status: "absent", detail: "Vacaciones" });
    expect(rowOf(rows, "sara")).toMatchObject({ status: "absent", detail: "Baja médica" });
  });

  it("sin horario ni fichajes", () => {
    const rows = buildPresence(input({ members: [member("pepe", "Pepe")] }));
    expect(rowOf(rows, "pepe")).toMatchObject({ status: "off", detail: "Sin horario hoy" });
  });

  it("ordena: primero los retrasos, luego quien trabaja, y cuenta por estado", () => {
    const rows = buildPresence(
      input({
        members: [member("b", "Berta"), member("a", "Álvaro"), member("c", "Carla")],
        activeSessions: [{ user_id: "b", clock_in_time: iso(9) }],
        todayEvents: [{ user_id: "b", event_type: "clock_in", event_time: iso(9) }],
        schedules: [{ user_id: "c", ...continuous }],
        now: at(9, 40),
      })
    );
    expect(rows.map((r) => r.status)).toEqual(["late", "working", "off"]);
    expect(countPresence(rows)).toMatchObject({ late: 1, working: 1, off: 1, paused: 0 });
  });
});
