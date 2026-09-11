import { describe, it, expect } from "vitest";
import {
  classifyScheduleDeviation,
  isSplitShift,
  toMinutes,
} from "../../../supabase/functions/_shared/scheduleWindow";

const margins = { entryEarly: 10, entryLate: 15, exitEarly: 10, exitLate: 15 };
const at = (hhmm: string) => toMinutes(hhmm)!;

const continuous = { start_time: "08:00", end_time: "15:00", expected_hours: 7 };
const split = {
  start_time: "09:00",
  morning_end_time: "14:00",
  afternoon_start_time: "16:00",
  end_time: "20:00",
  expected_hours: 9,
};

describe("classifyScheduleDeviation: nunca bloquea, solo clasifica", () => {
  it("dentro de márgenes → sin desviación", () => {
    expect(classifyScheduleDeviation(continuous, "in", at("08:05"), margins)).toBeNull();
    expect(classifyScheduleDeviation(continuous, "in", at("07:55"), margins)).toBeNull();
    expect(classifyScheduleDeviation(continuous, "out", at("15:10"), margins)).toBeNull();
  });

  it("entrada tarde y temprana", () => {
    expect(classifyScheduleDeviation(continuous, "in", at("08:40"), margins)).toEqual({
      kind: "late_entry",
      minutes: 40,
      reference: "08:00",
    });
    expect(classifyScheduleDeviation(continuous, "in", at("07:30"), margins)).toEqual({
      kind: "early_entry",
      minutes: 30,
      reference: "08:00",
    });
  });

  it("salida tardía por una cirugía que se alarga: se registra como desviación, no se rechaza", () => {
    expect(classifyScheduleDeviation(continuous, "out", at("17:00"), margins)).toEqual({
      kind: "late_exit",
      minutes: 120,
      reference: "15:00",
    });
  });

  it("salida anticipada", () => {
    expect(classifyScheduleDeviation(continuous, "out", at("13:00"), margins)).toEqual({
      kind: "early_exit",
      minutes: 120,
      reference: "15:00",
    });
  });

  it("turno partido: volver de comer a las 16:05 no es retraso respecto a las 09:00", () => {
    expect(isSplitShift(split)).toBe(true);
    expect(classifyScheduleDeviation(split, "in", at("16:05"), margins)).toBeNull();
  });

  it("turno partido: salir a comer a las 14:02 no es salida anticipada respecto a las 20:00", () => {
    expect(classifyScheduleDeviation(split, "out", at("14:02"), margins)).toBeNull();
  });

  it("turno partido: volver tarde de comer se compara con el inicio de la tarde", () => {
    expect(classifyScheduleDeviation(split, "in", at("16:45"), margins)).toEqual({
      kind: "late_entry",
      minutes: 45,
      reference: "16:00",
    });
  });

  it("turno de noche que cruza medianoche", () => {
    const night = { start_time: "22:00", end_time: "06:00", expected_hours: 8 };
    expect(classifyScheduleDeviation(night, "in", at("21:55"), margins)).toBeNull();
    expect(classifyScheduleDeviation(night, "out", at("06:10"), margins)).toBeNull();
    expect(classifyScheduleDeviation(night, "out", at("07:00"), margins)?.kind).toBe("late_exit");
  });

  it("sin horario, sin horas previstas o acción de pausa → sin desviación", () => {
    expect(classifyScheduleDeviation(null, "in", at("03:00"), margins)).toBeNull();
    expect(classifyScheduleDeviation({ ...continuous, expected_hours: 0 }, "in", at("03:00"), margins)).toBeNull();
    expect(classifyScheduleDeviation(continuous, "break_start", at("03:00"), margins)).toBeNull();
  });

  it("acepta horas con segundos (formato de la base de datos)", () => {
    const withSeconds = { start_time: "08:00:00", end_time: "15:00:00", expected_hours: "7" };
    expect(classifyScheduleDeviation(withSeconds, "in", at("08:30"), margins)?.minutes).toBe(30);
  });
});
