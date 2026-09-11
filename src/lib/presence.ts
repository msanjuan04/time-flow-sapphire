import {
  type DaySchedule,
  entryReferences,
  formatMinutesAsTime,
  hasUsableSchedule,
  isSplitShift,
} from "../../supabase/functions/_shared/scheduleWindow";

/**
 * Quién está dentro ahora. Vista para el responsable.
 *
 * Combina, para cada miembro del equipo: sesión activa, fichajes de hoy,
 * horario de hoy y ausencias aprobadas de hoy. Función pura para poder
 * probarla sin base de datos.
 */

export type PresenceStatus = "late" | "working" | "paused" | "expected" | "left" | "absent" | "off";

export interface PresenceMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface PresenceInput {
  members: PresenceMember[];
  activeSessions: { user_id: string; clock_in_time: string }[];
  todayEvents: { user_id: string; event_type: string; event_time: string }[];
  schedules: ({ user_id: string } & DaySchedule)[];
  absences: { user_id: string; absence_type: string }[];
  now: Date;
  /** Minutos de cortesía antes de marcar a alguien como "con retraso". */
  entryLateMinutes: number;
}

export interface PresenceRow {
  userId: string;
  name: string;
  status: PresenceStatus;
  detail: string;
  minutesLate?: number;
}

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  late: "Con retraso",
  working: "Trabajando",
  paused: "En pausa",
  expected: "Por llegar",
  left: "Ha salido",
  absent: "Ausente",
  off: "Sin horario hoy",
};

const ORDER: PresenceStatus[] = ["late", "working", "paused", "expected", "left", "absent", "off"];

const ABSENCE_LABELS: Record<string, string> = {
  vacation: "Vacaciones",
  sick_leave: "Baja médica",
  personal: "Asuntos propios",
  other: "Ausencia",
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

export function buildPresence(input: PresenceInput): PresenceRow[] {
  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
  const activeByUser = new Map(input.activeSessions.map((s) => [s.user_id, s]));
  const scheduleByUser = new Map(input.schedules.map((s) => [s.user_id, s]));
  const absenceByUser = new Map(input.absences.map((a) => [a.user_id, a]));
  const eventsByUser = new Map<string, { event_type: string; event_time: string }[]>();
  for (const e of input.todayEvents) {
    const list = eventsByUser.get(e.user_id) ?? [];
    list.push(e);
    eventsByUser.set(e.user_id, list);
  }
  for (const list of eventsByUser.values()) {
    list.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
  }

  const rows = input.members.map((member): PresenceRow => {
    const name = member.full_name?.trim() || member.email || "Sin nombre";
    const base = { userId: member.user_id, name };
    const events = eventsByUser.get(member.user_id) ?? [];
    const last = events[events.length - 1];
    const active = activeByUser.get(member.user_id);

    if (active) {
      if (last?.event_type === "pause_start") {
        return { ...base, status: "paused", detail: `En pausa desde las ${hhmm(last.event_time)}` };
      }
      const since = last && ["clock_in", "pause_end"].includes(last.event_type) ? last.event_time : active.clock_in_time;
      return { ...base, status: "working", detail: `Desde las ${hhmm(since)}` };
    }

    const absence = absenceByUser.get(member.user_id);
    if (absence) {
      return { ...base, status: "absent", detail: ABSENCE_LABELS[absence.absence_type] ?? "Ausencia" };
    }

    const clockIns = events.filter((e) => e.event_type === "clock_in").length;
    const lastOut = [...events].reverse().find((e) => e.event_type === "clock_out");
    const schedule = scheduleByUser.get(member.user_id);

    // Hora a la que debería (re)entrar ahora mismo, si le toca.
    let expectedEntry: number | null = null;
    if (schedule && hasUsableSchedule(schedule)) {
      const refs = entryReferences(schedule);
      if (clockIns === 0) expectedEntry = refs[0] ?? null;
      else if (clockIns === 1 && lastOut && isSplitShift(schedule)) expectedEntry = refs[1] ?? null;
    }

    if (expectedEntry !== null) {
      const delay = nowMinutes - expectedEntry;
      if (delay > input.entryLateMinutes) {
        const what = clockIns === 0 ? "Debía entrar" : "Debía volver";
        return {
          ...base,
          status: "late",
          detail: `${what} a las ${formatMinutesAsTime(expectedEntry)}`,
          minutesLate: delay,
        };
      }
      if (lastOut) {
        return {
          ...base,
          status: "left",
          detail: `Salió a las ${hhmm(lastOut.event_time)} · vuelve a las ${formatMinutesAsTime(expectedEntry)}`,
        };
      }
      return { ...base, status: "expected", detail: `Entra a las ${formatMinutesAsTime(expectedEntry)}` };
    }

    if (lastOut) return { ...base, status: "left", detail: `Salió a las ${hhmm(lastOut.event_time)}` };
    return { ...base, status: "off", detail: PRESENCE_LABELS.off };
  });

  return rows.sort((a, b) => {
    const byStatus = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
    return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name, "es");
  });
}

export const countPresence = (rows: PresenceRow[]): Record<PresenceStatus, number> => {
  const counts = Object.fromEntries(ORDER.map((s) => [s, 0])) as Record<PresenceStatus, number>;
  for (const r of rows) counts[r.status] += 1;
  return counts;
};
