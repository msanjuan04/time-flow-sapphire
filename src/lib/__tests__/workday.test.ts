import { describe, it, expect } from "vitest";
import { workedSecondsByDay, summarizeWorkday, formatDuration, startOfWeekMonday, localDateKey } from "@/lib/workday";

// Fechas en hora local para que el test no dependa de la zona horaria.
const t = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();
const ev = (event_type: string, iso: string) => ({ event_type, event_time: iso });

describe("workedSecondsByDay", () => {
  it("jornada continua de 8 a 15 → 7 h", () => {
    const r = workedSecondsByDay([ev("clock_in", t(2026, 9, 14, 8)), ev("clock_out", t(2026, 9, 14, 15))]);
    expect(r["2026-09-14"]).toBe(7 * 3600);
  });

  it("descuenta las pausas", () => {
    const r = workedSecondsByDay([
      ev("clock_in", t(2026, 9, 14, 8)),
      ev("pause_start", t(2026, 9, 14, 11)),
      ev("pause_end", t(2026, 9, 14, 11, 30)),
      ev("clock_out", t(2026, 9, 14, 15)),
    ]);
    expect(r["2026-09-14"]).toBe(6.5 * 3600);
  });

  it("turno partido: dos sesiones el mismo día se suman", () => {
    const r = workedSecondsByDay([
      ev("clock_in", t(2026, 9, 14, 9)),
      ev("clock_out", t(2026, 9, 14, 14)),
      ev("clock_in", t(2026, 9, 14, 16)),
      ev("clock_out", t(2026, 9, 14, 20)),
    ]);
    expect(r["2026-09-14"]).toBe(9 * 3600);
  });

  it("sesión abierta cuenta hasta ahora", () => {
    const now = new Date(2026, 8, 14, 12, 15);
    const r = workedSecondsByDay([ev("clock_in", t(2026, 9, 14, 9))], now);
    expect(r["2026-09-14"]).toBe(3.25 * 3600);
  });

  it("en pausa ahora mismo: no suma el tiempo de pausa", () => {
    const now = new Date(2026, 8, 14, 12, 0);
    const r = workedSecondsByDay([ev("clock_in", t(2026, 9, 14, 9)), ev("pause_start", t(2026, 9, 14, 11))], now);
    expect(r["2026-09-14"]).toBe(2 * 3600);
  });

  it("turno de noche suma al día de la entrada", () => {
    const r = workedSecondsByDay([ev("clock_in", t(2026, 9, 14, 22)), ev("clock_out", t(2026, 9, 15, 6))]);
    expect(r["2026-09-14"]).toBe(8 * 3600);
    expect(r["2026-09-15"]).toBeUndefined();
  });

  it("una entrada sin salida seguida de otra entrada no inventa horas", () => {
    const r = workedSecondsByDay([
      ev("clock_in", t(2026, 9, 14, 9)),
      ev("clock_in", t(2026, 9, 15, 9)),
      ev("clock_out", t(2026, 9, 15, 10)),
    ]);
    expect(r["2026-09-14"]).toBeUndefined();
    expect(r["2026-09-15"]).toBe(3600);
  });

  it("acepta eventos desordenados", () => {
    const r = workedSecondsByDay([ev("clock_out", t(2026, 9, 14, 15)), ev("clock_in", t(2026, 9, 14, 8))]);
    expect(r["2026-09-14"]).toBe(7 * 3600);
  });
});

describe("summarizeWorkday", () => {
  it("hoy y semana, trabajado y previsto", () => {
    const now = new Date(2026, 8, 16, 12, 0); // miércoles
    const events = [
      ev("clock_in", t(2026, 9, 14, 8)),
      ev("clock_out", t(2026, 9, 14, 15)), // lunes 7 h
      ev("clock_in", t(2026, 9, 15, 8)),
      ev("clock_out", t(2026, 9, 15, 16)), // martes 8 h
      ev("clock_in", t(2026, 9, 16, 9)), // hoy, abierta: 3 h
      ev("clock_in", t(2026, 9, 12, 9)),
      ev("clock_out", t(2026, 9, 12, 13)), // sábado anterior: fuera de la semana
    ];
    const schedules = [
      { date: "2026-09-14", expected_hours: 7 },
      { date: "2026-09-15", expected_hours: 7 },
      { date: "2026-09-16", expected_hours: 7 },
      { date: "2026-09-17", expected_hours: 7 },
      { date: "2026-09-18", expected_hours: "5" },
      { date: "2026-09-12", expected_hours: 4 },
    ];
    expect(summarizeWorkday(events, schedules, now)).toEqual({
      todaySeconds: 3 * 3600,
      todayExpectedSeconds: 7 * 3600,
      weekSeconds: 18 * 3600,
      weekExpectedSeconds: 33 * 3600,
    });
  });

  it("sin horario asignado → previsto 0", () => {
    const now = new Date(2026, 8, 16, 12, 0);
    expect(summarizeWorkday([], [], now).todayExpectedSeconds).toBe(0);
  });
});

describe("utilidades", () => {
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(2700)).toBe("45 min");
    expect(formatDuration(7200)).toBe("2 h");
    expect(formatDuration(18720)).toBe("5 h 12 min");
  });

  it("la semana empieza el lunes, también si hoy es domingo", () => {
    expect(localDateKey(startOfWeekMonday(new Date(2026, 8, 20, 10)))).toBe("2026-09-14");
    expect(localDateKey(startOfWeekMonday(new Date(2026, 8, 14, 0, 5)))).toBe("2026-09-14");
  });
});
