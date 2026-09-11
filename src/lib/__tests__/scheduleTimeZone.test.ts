import { describe, it, expect } from "vitest";
import {
  classifyScheduleDeviation,
  dateKeyInTimeZone,
  minutesInTimeZone,
} from "../../../supabase/functions/_shared/scheduleWindow";

// La edge function corre en UTC. Estos tests fijan el comportamiento con
// instantes UTC explícitos, independientes de la zona del ordenador.
describe("hora de España a partir de un instante UTC", () => {
  it("verano (CEST, UTC+2): 07:00 UTC son las 09:00", () => {
    expect(minutesInTimeZone(new Date("2026-09-14T07:00:00Z"))).toBe(9 * 60);
  });

  it("invierno (CET, UTC+1): 08:00 UTC son las 09:00", () => {
    expect(minutesInTimeZone(new Date("2026-12-01T08:00:00Z"))).toBe(9 * 60);
  });

  it("a las 23:30 UTC en verano ya es el día siguiente en España", () => {
    expect(dateKeyInTimeZone(new Date("2026-09-14T23:30:00Z"))).toBe("2026-09-15");
  });

  it("medianoche en España es 00:00, no 24:00", () => {
    expect(minutesInTimeZone(new Date("2026-09-14T22:00:00Z"))).toBe(0);
  });

  it("fichar a las 09:00 de España con horario de 09:00 no es desviación (antes salía 2 h antes)", () => {
    const schedule = { start_time: "09:00", end_time: "17:00", expected_hours: 7 };
    const margins = { entryEarly: 10, entryLate: 15, exitEarly: 10, exitLate: 15 };
    const minutes = minutesInTimeZone(new Date("2026-09-14T07:00:00Z"));
    expect(classifyScheduleDeviation(schedule, "in", minutes, margins)).toBeNull();
  });
});
