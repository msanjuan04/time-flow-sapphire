import { describe, it, expect } from "vitest";
import {
  buildMonthSummary,
  canonicalMonthSummary,
  daysInMonth,
} from "../../../supabase/functions/_shared/monthSummary";

// Fechas en hora local para no depender de la zona del ordenador.
const t = (d: number, h: number, mi = 0) => new Date(2026, 8, d, h, mi).toISOString();
const ev = (event_type: string, iso: string) => ({ event_type, event_time: iso });
const sept = (opts: Partial<Parameters<typeof buildMonthSummary>[0]> = {}) =>
  buildMonthSummary({
    year: 2026,
    month: 9,
    events: [],
    schedules: [],
    now: new Date(2026, 8, 30, 23, 0),
    ...opts,
  });

describe("buildMonthSummary: horas extra del mes (art. 35.5 ET)", () => {
  it("septiembre tiene 30 días", () => {
    expect(daysInMonth(2026, 9)).toHaveLength(30);
    expect(daysInMonth(2026, 2)).toHaveLength(28);
    expect(daysInMonth(2024, 2)).toHaveLength(29);
  });

  it("un día clavado al horario no genera extra ni déficit", () => {
    const s = sept({
      events: [ev("clock_in", t(14, 9)), ev("clock_out", t(14, 16))],
      schedules: [{ date: "2026-09-14", expected_hours: 7 }],
    });
    expect(s.totals).toMatchObject({ worked: 7, expected: 7, ordinary: 7, extra: 0, deficit: 0 });
    expect(s.days).toHaveLength(1);
  });

  it("una cirugía que se alarga genera horas extra ese día", () => {
    const s = sept({
      events: [ev("clock_in", t(14, 9)), ev("clock_out", t(14, 18, 30))],
      schedules: [{ date: "2026-09-14", expected_hours: 7 }],
    });
    expect(s.days[0]).toMatchObject({ worked: 9.5, expected: 7, extra: 2.5, deficit: 0 });
    expect(s.totals.extra).toBe(2.5);
    expect(s.totals.ordinary).toBe(7);
  });

  it("las extra de un día no tapan el déficit de otro: se informan por separado", () => {
    const s = sept({
      events: [
        ev("clock_in", t(14, 9)),
        ev("clock_out", t(14, 19)), // 10 h sobre 7 → 3 extra
        ev("clock_in", t(15, 9)),
        ev("clock_out", t(15, 13)), // 4 h sobre 7 → 3 de déficit
      ],
      schedules: [
        { date: "2026-09-14", expected_hours: 7 },
        { date: "2026-09-15", expected_hours: 7 },
      ],
    });
    expect(s.totals.extra).toBe(3);
    expect(s.totals.deficit).toBe(3);
    expect(s.totals.worked).toBe(14);
  });

  it("descuenta las pausas antes de calcular la extra", () => {
    const s = sept({
      events: [
        ev("clock_in", t(14, 9)),
        ev("pause_start", t(14, 14)),
        ev("pause_end", t(14, 15)),
        ev("clock_out", t(14, 18)),
      ],
      schedules: [{ date: "2026-09-14", expected_hours: 7 }],
    });
    expect(s.days[0].worked).toBe(8);
    expect(s.days[0].extra).toBe(1);
  });

  it("turno partido: los dos tramos suman contra el mismo horario", () => {
    const s = sept({
      events: [
        ev("clock_in", t(14, 9)),
        ev("clock_out", t(14, 14)),
        ev("clock_in", t(14, 16)),
        ev("clock_out", t(14, 20, 30)),
      ],
      schedules: [{ date: "2026-09-14", expected_hours: 9 }],
    });
    expect(s.days[0]).toMatchObject({ worked: 9.5, expected: 9, extra: 0.5 });
  });

  it("un día de vacaciones o baja no genera déficit", () => {
    const s = sept({
      schedules: [{ date: "2026-09-14", expected_hours: 7 }],
      absences: [{ start_date: "2026-09-14", end_date: "2026-09-14", absence_type: "vacation" }],
    });
    expect(s.days[0]).toMatchObject({ expected: 7, worked: 0, deficit: 0, absence: "vacation" });
    expect(s.totals.deficit).toBe(0);
    expect(s.totals.daysAbsent).toBe(1);
  });

  it("lo trabajado sin horario asignado no cuenta como extra, se informa aparte", () => {
    const s = sept({ events: [ev("clock_in", t(20, 10)), ev("clock_out", t(20, 14))] });
    expect(s.totals.extra).toBe(0);
    expect(s.totals.withoutSchedule).toBe(4);
    expect(s.totals.worked).toBe(4);
  });

  it("solo aparecen los días con algo que contar", () => {
    const s = sept({
      events: [ev("clock_in", t(14, 9)), ev("clock_out", t(14, 16))],
      schedules: [{ date: "2026-09-14", expected_hours: 7 }, { date: "2026-09-15", expected_hours: 7 }],
    });
    expect(s.days.map((d) => d.date)).toEqual(["2026-09-14", "2026-09-15"]);
    expect(s.days[1]).toMatchObject({ worked: 0, deficit: 7 });
  });

  it("ignora los fichajes de otros meses", () => {
    const s = sept({
      events: [
        { event_type: "clock_in", event_time: new Date(2026, 7, 31, 9).toISOString() },
        { event_type: "clock_out", event_time: new Date(2026, 7, 31, 17).toISOString() },
      ],
      schedules: [],
    });
    expect(s.totals.worked).toBe(0);
  });
});

describe("canonicalMonthSummary: el texto que se firma", () => {
  const base = sept({
    events: [ev("clock_in", t(14, 9)), ev("clock_out", t(14, 18))],
    schedules: [{ date: "2026-09-14", expected_hours: 7 }],
  });

  it("incluye empresa, persona, periodo, totales y cada día", () => {
    const text = canonicalMonthSummary("u1", "c1", base);
    expect(text).toContain("company:c1");
    expect(text).toContain("user:u1");
    expect(text).toContain("period:2026-09");
    expect(text).toContain("2026-09-14|9.00|7.00|2.00|0.00|");
  });

  it("es estable: el mismo mes da el mismo texto", () => {
    expect(canonicalMonthSummary("u1", "c1", base)).toBe(canonicalMonthSummary("u1", "c1", base));
  });

  it("cambia si se corrige un fichaje del mes", () => {
    const corregido = sept({
      events: [ev("clock_in", t(14, 9)), ev("clock_out", t(14, 17))],
      schedules: [{ date: "2026-09-14", expected_hours: 7 }],
    });
    expect(canonicalMonthSummary("u1", "c1", corregido)).not.toBe(canonicalMonthSummary("u1", "c1", base));
  });
});
