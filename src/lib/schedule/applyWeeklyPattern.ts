import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnlyUtc, hoursBetween } from "./templates";
import { toast } from "sonner";

/* ─────────────────── Tipos ─────────────────── */

export interface DayPattern {
  /** 0 = Domingo, 1 = Lunes, …, 6 = Sábado */
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  expectedHours?: number; // si no se indica, se calcula de start/end
}

export interface SchedulePreset {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  days: DayPattern[];
}

/* ─────────────────── Presets ─────────────────── */

const MON_TO_FRI_8: DayPattern[] = [1, 2, 3, 4, 5].map((d) => ({
  dayOfWeek: d,
  startTime: "09:00",
  endTime: "17:00",
  expectedHours: 8,
}));

const MON_TO_FRI_6: DayPattern[] = [1, 2, 3, 4, 5].map((d) => ({
  dayOfWeek: d,
  startTime: "08:00",
  endTime: "14:00",
  expectedHours: 6,
}));

const MON_TO_SAT_8: DayPattern[] = [1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  startTime: "09:00",
  endTime: "17:00",
  expectedHours: 8,
}));

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "lv8",
    label: "Lunes a Viernes · 8h",
    shortLabel: "L-V 8h",
    description: "09:00 – 17:00",
    days: MON_TO_FRI_8,
  },
  {
    id: "lv6",
    label: "Lunes a Viernes · 6h",
    shortLabel: "L-V 6h",
    description: "08:00 – 14:00",
    days: MON_TO_FRI_6,
  },
  {
    id: "ls8",
    label: "Lunes a Sábado · 8h",
    shortLabel: "L-S 8h",
    description: "09:00 – 17:00",
    days: MON_TO_SAT_8,
  },
];

/* ─────────────────── Función principal ─────────────────── */

interface ApplyOptions {
  employeeId: string;
  companyId: string;
  createdBy: string | null;
  startDate: string; // "yyyy-MM-dd"
  weeksToGenerate?: number; // default 52
  dayPatterns: DayPattern[];
  reason?: string;
  showToast?: boolean;
}

/**
 * Aplica un patrón semanal a `scheduled_hours` mediante upsert en batches.
 * Reutiliza la misma lógica que SimpleScheduleTab (batches de 100, onConflict).
 * Devuelve el nº de filas insertadas/actualizadas.
 */
export async function applyWeeklyPattern({
  employeeId,
  companyId,
  createdBy,
  startDate,
  weeksToGenerate = 52,
  dayPatterns,
  reason = "",
  showToast = true,
}: ApplyOptions): Promise<number> {
  const base = parseDateOnlyUtc(startDate);
  const totalDays = weeksToGenerate * 7;
  const reasonNote = reason || "Asignación rápida";

  // Crear mapa dayOfWeek → pattern para O(1) lookup
  const patternMap = new Map<number, DayPattern>();
  for (const p of dayPatterns) {
    patternMap.set(p.dayOfWeek, p);
  }

  // Generar payload
  const payload: {
    user_id: string;
    company_id: string;
    date: string;
    expected_hours: number;
    start_time: string;
    end_time: string;
    created_by: string | null;
    notes: string;
  }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(base, i);
    const dow = date.getUTCDay();
    const pattern = patternMap.get(dow);
    if (!pattern) continue;

    const hours =
      pattern.expectedHours ??
      hoursBetween(pattern.startTime, pattern.endTime);
    if (!Number.isFinite(hours) || hours <= 0) continue;

    payload.push({
      user_id: employeeId,
      company_id: companyId,
      date: format(date, "yyyy-MM-dd"),
      expected_hours: Number(hours.toFixed(2)),
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      created_by: createdBy,
      notes: reasonNote,
    });
  }

  if (payload.length === 0) {
    if (showToast) toast.error("No hay días válidos con horario configurado.");
    return 0;
  }

  // Upsert en batches de 100
  const batchSize = 100;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { error } = await supabase.from("scheduled_hours").upsert(batch, {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }

  if (showToast) {
    toast.success(
      `Horario guardado: ${payload.length} días desde ${format(base, "d MMM yyyy", { locale: es })}`
    );
  }

  return payload.length;
}
