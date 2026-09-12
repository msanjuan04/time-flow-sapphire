import { describe, it, expect } from "vitest";
import { PRESETS, presetWeeklyHours, toDaySchedule } from "@/lib/schedulePresets";
import { DAY_KEYS, buildTemplateSummary } from "@/lib/scheduleTemplates";

/**
 * Los ejemplos son lo primero que toca el owner al crear una plantilla.
 * Si uno propone una semana ilegal, se copia tal cual a la plantilla real
 * y de ahí a las horas previstas de cada persona.
 */

const JORNADA_MAXIMA_SEMANAL = 40; // art. 34.1 ET, en cómputo anual

describe("ejemplos de horario", () => {
  it("ninguno propone más de la jornada máxima", () => {
    for (const preset of PRESETS) {
      expect(
        presetWeeklyHours(preset),
        `"${preset.name}" propone ${presetWeeklyHours(preset)} h`
      ).toBeLessThanOrEqual(JORNADA_MAXIMA_SEMANAL);
    }
  });

  it("todos tienen algún día de trabajo y descansan al menos un día", () => {
    for (const preset of PRESETS) {
      const trabajados = DAY_KEYS.filter((k) => preset.days[k].enabled);
      expect(trabajados.length, preset.name).toBeGreaterThan(0);
      expect(trabajados.length, preset.name).toBeLessThan(7);
    }
  });

  it("el nombre de cada uno es distinto", () => {
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  it("las horas salen del propio patrón", () => {
    const partida = PRESETS.find((p) => p.name === "Jornada partida 40 h")!;
    expect(presetWeeklyHours(partida)).toBe(40);

    const manana = PRESETS.find((p) => p.name === "Consulta de mañana")!;
    expect(presetWeeklyHours(manana)).toBe(25);
  });

  it("el turno partido guarda los dos tramos y el continuo no", () => {
    const partida = PRESETS.find((p) => p.name === "Jornada partida 40 h")!;
    expect(toDaySchedule(partida.days.monday)).toEqual({
      start: "09:00",
      end: "19:00",
      morning_end: "14:00",
      afternoon_start: "16:00",
    });

    const manana = PRESETS.find((p) => p.name === "Consulta de mañana")!;
    expect(toDaySchedule(manana.days.monday)).toMatchObject({
      morning_end: null,
      afternoon_start: null,
    });
  });

  it("un día libre no se guarda", () => {
    const manana = PRESETS.find((p) => p.name === "Consulta de mañana")!;
    expect(toDaySchedule(manana.days.sunday)).toBeNull();
  });

  it("se resumen para leerlos de un vistazo", () => {
    const partial: Record<string, unknown> = {};
    const manana = PRESETS.find((p) => p.name === "Consulta de mañana")!;
    for (const k of DAY_KEYS) partial[k] = toDaySchedule(manana.days[k]);
    expect(buildTemplateSummary(partial)).toBe("L 09-14 · M 09-14 · X 09-14 · J 09-14 · V 09-14 · S — · D —");
  });
});
