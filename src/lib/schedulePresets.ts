import { DAY_KEYS, calcWeeklyHours, type DayKey, type DaySchedule, type ScheduleTemplate } from "@/lib/scheduleTemplates";

/**
 * Ejemplos de horario y el estado del formulario que los edita.
 *
 * Viven fuera de la página para poder comprobarlos: son el primer
 * contacto del owner con las plantillas y no deberían proponer una
 * semana que pase de la jornada máxima legal.
 */

export interface DayFormState {
  enabled: boolean;
  start: string;
  end: string;
  splitShift: boolean;
  morning_end: string;
  afternoon_start: string;
}

export const emptyDay = (): DayFormState => ({
  enabled: false,
  start: "09:00",
  end: "17:00",
  splitShift: false,
  morning_end: "13:00",
  afternoon_start: "15:00",
});

/**
 * Puntos de partida al crear una plantilla. No son horarios de nadie:
 * rellenan el formulario para no empezar de cero, y luego se ajustan.
 * Son los turnos habituales de una consulta: mañana, tarde, partida y
 * media jornada, con el sábado suelto para las guardias.
 */
const semana = (
  dias: Partial<Record<DayKey, DayFormState>>
): Record<DayKey, DayFormState> => ({
  ...(DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {}) as Record<DayKey, DayFormState>),
  ...dias,
});

const turno = (start: string, end: string): DayFormState => ({
  enabled: true,
  start,
  end,
  splitShift: false,
  morning_end: "14:00",
  afternoon_start: "16:00",
});

const turnoPartido = (
  start: string,
  morning_end: string,
  afternoon_start: string,
  end: string
): DayFormState => ({ enabled: true, start, end, splitShift: true, morning_end, afternoon_start });

const deLunesAViernes = (dia: DayFormState) => ({
  monday: dia,
  tuesday: { ...dia },
  wednesday: { ...dia },
  thursday: { ...dia },
  friday: { ...dia },
});

export const PRESETS: { name: string; description: string; days: Record<DayKey, DayFormState> }[] = [
  {
    name: "Consulta de mañana",
    description: "Lunes a viernes de 9:00 a 14:00",
    days: semana(deLunesAViernes(turno("09:00", "14:00"))),
  },
  {
    name: "Consulta de tarde",
    description: "Lunes a viernes de 15:00 a 20:00",
    days: semana(deLunesAViernes(turno("15:00", "20:00"))),
  },
  {
    name: "Jornada partida 40 h",
    description: "Lunes a viernes, 9:00 a 14:00 y 16:00 a 19:00",
    days: semana(deLunesAViernes(turnoPartido("09:00", "14:00", "16:00", "19:00"))),
  },
  {
    name: "Partida con viernes corto",
    description: "De lunes a jueves 9:00-14:00 y 16:00-20:00, viernes solo mañana",
    days: semana({
      ...deLunesAViernes(turnoPartido("09:00", "14:00", "16:00", "20:00")),
      friday: turno("09:00", "13:00"),
    }),
  },
  {
    name: "Media jornada de mañana",
    description: "Lunes a viernes de 9:00 a 13:00",
    days: semana(deLunesAViernes(turno("09:00", "13:00"))),
  },
  {
    name: "Mañanas con sábado",
    description: "Lunes a sábado de 9:00 a 14:00",
    days: semana({
      ...deLunesAViernes(turno("09:00", "14:00")),
      saturday: turno("09:00", "14:00"),
    }),
  },
];


/** El día del formulario, tal y como se guarda en la plantilla. */
export const toDaySchedule = (d: DayFormState): DaySchedule | null => {
  if (!d.enabled) return null;
  return {
    start: d.start,
    end: d.end,
    morning_end: d.splitShift ? d.morning_end : null,
    afternoon_start: d.splitShift ? d.afternoon_start : null,
  };
};

/** Horas que suma un ejemplo en una semana. */
export const presetWeeklyHours = (preset: { days: Record<DayKey, DayFormState> }): number => {
  const partial: Partial<ScheduleTemplate> = {};
  for (const k of DAY_KEYS) (partial as Record<string, unknown>)[k] = toDaySchedule(preset.days[k]);
  return calcWeeklyHours(partial);
};
