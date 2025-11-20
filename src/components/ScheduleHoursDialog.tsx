import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { Loader2, CalendarClock, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ScheduleHistoryRow =
  Database["public"]["Tables"]["schedule_adjustments_history"]["Row"];

interface ScheduleHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

interface ScheduleGroup {
  id: string;
  start_date: string;
  end_date: string | null;
  expected_hours: number;
  reason: string | null;
  changed_at: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface DaySchedule {
  day: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  dayName: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  expectedHours: number;
}

const WEEKDAYS = [
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
  { day: 6, name: "Sábado", short: "Sáb" },
  { day: 0, name: "Domingo", short: "Dom" },
];

const HORIZON_FORWARD_DAYS = 180;
const PREVIEW_GROUPS = 12;
const HISTORY_DAYS = 120;

type WeekSchedule = {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
};

const createEmptyWeekSchedule = (): WeekSchedule => ({
  morningStart: "",
  morningEnd: "",
  afternoonStart: "",
  afternoonEnd: "",
});

const ScheduleHoursDialog = ({
  open,
  onOpenChange,
  employee,
}: ScheduleHoursDialogProps) => {
  const { user } = useAuth();
  const { companyId } = useMembership();

  // Días habilitados (aunque no se muestren, se usan para saber qué días trabajan)
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(() =>
    WEEKDAYS.map((wd) => ({
      day: wd.day,
      dayName: wd.name,
      enabled: wd.day >= 1 && wd.day <= 5, // Lunes a Viernes por defecto
      startTime: "09:00",
      endTime: "17:00",
      expectedHours: 8,
    }))
  );

  // Fecha desde la que se aplican las semanas
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  });

  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [upcomingGroups, setUpcomingGroups] = useState<ScheduleGroup[]>([]);
  const hydrateRef = useRef(true);

  const [weeklySchedules, setWeeklySchedules] = useState<WeekSchedule[]>(
    () => Array.from({ length: 4 }, createEmptyWeekSchedule)
  );
  const [copyWeekTargets, setCopyWeekTargets] = useState<number[]>([2, 3, 4, 1]);

  const computeHoursFromTimes = useCallback((start: string, end: string): number => {
    const [sh, sm] = start.split(":").map((v) => Number(v));
    const [eh, em] = end.split(":").map((v) => Number(v));
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, minutes / 60);
  }, []);

  // Actualizar una semana concreta con nuevos valores
  const updateWeekSchedule = (
    weekIndex: number,
    updates: Partial<WeekSchedule>
  ) => {
    setWeeklySchedules((prev) => {
      const next = [...prev];
      next[weekIndex] = { ...next[weekIndex], ...updates };
      return next;
    });
  };

  // Copiar los horarios de una semana a otra
  const handleCopyWeek = (fromWeekIndex: number, toWeekNumber: number) => {
    const toIndex = toWeekNumber - 1;
    if (toIndex < 0 || toIndex >= weeklySchedules.length) return;
    setWeeklySchedules((prev) => {
      const next = [...prev];
      next[toIndex] = { ...prev[fromWeekIndex] };
      return next;
    });
  };

  // Label "20 nov – 26 nov" para cada semana
  const getWeekRangeLabel = (weekIndex: number): string => {
    if (!startDate) return "";
    const base = new Date(startDate);
    if (Number.isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + weekIndex * 7);

    const end = new Date(base);
    end.setDate(end.getDate() + 6);

    const format = (d: Date) =>
      d.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });

    return `${format(base)} – ${format(end)}`;
  };

  const loadUpcomingEntries = useCallback(async () => {
    if (!open || !employee?.id || !companyId) return;
    setEntriesLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - HISTORY_DAYS);
      const { data, error } = await supabase
        .from("schedule_adjustments_history")
        .select(
          "id, expected_hours, reason, changed_at, applied_from, start_time, end_time"
        )
        .eq("user_id", employee.id)
        .eq("company_id", companyId)
        .gte("changed_at", since.toISOString())
        .order("changed_at", { ascending: false })
        .limit(PREVIEW_GROUPS);

      if (error) throw error;
      const rows: ScheduleHistoryRow[] = (data as ScheduleHistoryRow[]) ?? [];
      const limitedGroups: ScheduleGroup[] = rows.map((entry) => ({
        id: entry.id,
        start_date: entry.applied_from,
        end_date: entry.applied_from,
        expected_hours: Number(entry.expected_hours ?? 0),
        reason: entry.reason ?? null,
        changed_at: entry.changed_at,
        start_time: entry.start_time ?? null,
        end_time: entry.end_time ?? null,
      }));

      setUpcomingGroups(limitedGroups);

      // Cargar horarios actuales para saber qué días están habilitados
      if (hydrateRef.current) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const { data: existingSchedules } = await supabase
          .from("scheduled_hours")
          .select("date, start_time, end_time, expected_hours")
          .eq("user_id", employee.id)
          .eq("company_id", companyId)
          .gte("date", today.toISOString().split("T")[0])
          .lte("date", nextWeek.toISOString().split("T")[0])
          .order("date", { ascending: true });

        if (existingSchedules && existingSchedules.length > 0) {
          const dayMap = new Map<
            number,
            { start_time: string; end_time: string; expected_hours: number }
          >();
          (existingSchedules as any[]).forEach((sh: any) => {
            const date = new Date(sh.date);
            const dayOfWeek = date.getDay();
            if (!dayMap.has(dayOfWeek)) {
              dayMap.set(dayOfWeek, {
                start_time: sh.start_time ?? "09:00",
                end_time: sh.end_time ?? "17:00",
                expected_hours: Number(sh.expected_hours ?? 8),
              });
            }
          });

          setDaySchedules((prev) =>
            prev.map((ds) => {
              const existing = dayMap.get(ds.day);
              if (existing) {
                return {
                  ...ds,
                  enabled: true,
                  startTime: existing.start_time,
                  endTime: existing.end_time,
                  expectedHours: existing.expected_hours,
                };
              }
              return ds;
            })
          );
        } else if (rows.length > 0) {
          // Fallback al historial si no hay horarios actuales
          const latest = rows[0];
          const defaultStart = latest.start_time ?? "09:00";
          const defaultEnd = latest.end_time ?? "17:00";
          const defaultHours = Number(latest.expected_hours ?? 8);

          setDaySchedules((prev) =>
            prev.map((ds) => ({
              ...ds,
              startTime: defaultStart,
              endTime: defaultEnd,
              expectedHours: defaultHours,
            }))
          );
        }

        // Si el último ajuste tiene applied_from, la usamos como valor inicial
        if (rows.length > 0 && rows[0].applied_from) {
          setStartDate(rows[0].applied_from);
        }

        hydrateRef.current = false;
      }
    } catch (error) {
      console.error("Error loading upcoming scheduled hours:", error);
      toast.error("No se pudieron cargar las horas programadas");
    } finally {
      setEntriesLoading(false);
    }
  }, [open, employee?.id, companyId]);

  useEffect(() => {
    if (open) {
      hydrateRef.current = true;
      loadUpcomingEntries();
    } else {
      setChangeReason("");
      hydrateRef.current = true;
    }
  }, [open, loadUpcomingEntries]);

  const handleSave = async () => {
    if (!user?.id || !companyId || !employee?.id) {
      toast.error("Falta información de la empresa o del usuario");
      return;
    }

    if (!startDate) {
      toast.error("Selecciona una fecha de inicio");
      return;
    }

    const baseDate = new Date(startDate);
    if (Number.isNaN(baseDate.getTime())) {
      toast.error("Fecha de inicio no válida");
      return;
    }
    baseDate.setHours(0, 0, 0, 0);
    const startIso = baseDate.toISOString().slice(0, 10);

    const trimmedReason = changeReason.trim();
    if (!trimmedReason) {
      toast.error("Describe el motivo del ajuste");
      return;
    }

    const enabledDays = daySchedules.filter((ds) => ds.enabled);
    if (enabledDays.length === 0) {
      toast.error("Debes seleccionar al menos un día de trabajo");
      return;
    }

    for (const day of enabledDays) {
      const hours = computeHoursFromTimes(day.startTime, day.endTime);
      if (hours <= 0 || hours > 24) {
        toast.error(`Revisa las horas del ${day.dayName}`);
        return;
      }
    }

    setSaving(true);
    try {
      // Borramos desde la fecha seleccionada en adelante
      const deleteResult = await supabase
        .from("scheduled_hours")
        .delete()
        .eq("user_id", employee.id)
        .eq("company_id", companyId)
        .gte("date", startIso);
      if (deleteResult.error) throw deleteResult.error;

      const payload: any[] = [];
      const reasonMetadata = JSON.stringify({
        reason: trimmedReason,
        changed_at: new Date().toISOString(),
        template: weeklySchedules,
      });

      const computeHours = (start: string, end: string) => {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 0;
        return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
      };

      const isDayEnabled = (dayOfWeek: number) =>
        daySchedules.some((ds) => ds.day === dayOfWeek && ds.enabled);

      for (let i = 0; i < HORIZON_FORWARD_DAYS; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dayOfWeek = date.getDay();
        if (!isDayEnabled(dayOfWeek)) continue;

        const weekIndex = Math.floor(i / 7) % weeklySchedules.length;
        const weekTemplate = weeklySchedules[weekIndex];

        const morningHours =
          weekTemplate.morningStart && weekTemplate.morningEnd
            ? computeHours(weekTemplate.morningStart, weekTemplate.morningEnd)
            : 0;
        const afternoonHours =
          weekTemplate.afternoonStart && weekTemplate.afternoonEnd
            ? computeHours(
                weekTemplate.afternoonStart,
                weekTemplate.afternoonEnd
              )
            : 0;

        const expected_hours = Number((morningHours + afternoonHours).toFixed(2));
        if (expected_hours <= 0) continue;

        const start_time =
          weekTemplate.morningStart ||
          weekTemplate.afternoonStart ||
          daySchedules.find((ds) => ds.day === dayOfWeek)?.startTime ||
          "09:00";

        const end_time =
          weekTemplate.afternoonEnd ||
          weekTemplate.morningEnd ||
          daySchedules.find((ds) => ds.day === dayOfWeek)?.endTime ||
          "17:00";

        const noteSegments = [
          `Semana ${weekIndex + 1}`,
          weekTemplate.morningStart && weekTemplate.morningEnd
            ? `Mañana ${weekTemplate.morningStart}-${weekTemplate.morningEnd}`
            : null,
          weekTemplate.afternoonStart && weekTemplate.afternoonEnd
            ? `Tarde ${weekTemplate.afternoonStart}-${weekTemplate.afternoonEnd}`
            : null,
        ]
          .filter(Boolean)
          .join(" • ");

        payload.push({
          user_id: employee.id,
          company_id: companyId,
          date: date.toISOString().slice(0, 10),
          expected_hours,
          created_by: user.id,
          notes: `${reasonMetadata} | ${noteSegments}`,
          start_time,
          end_time,
        });
      }

      if (payload.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < payload.length; i += batchSize) {
          const batch = payload.slice(i, i + batchSize);
          const insertResult = await supabase
            .from("scheduled_hours")
            .insert(batch);
          if (insertResult.error) {
            console.error("Error inserting batch:", insertResult.error);
            throw insertResult.error;
          }
        }
        console.log(`✅ Inserted ${payload.length} scheduled hours records`);
      } else {
        console.warn("⚠️ No payload to insert - no days enabled");
      }

      const avgHours =
        enabledDays.reduce((sum, d) => sum + d.expectedHours, 0) /
        enabledDays.length;

      const historyInsert = await supabase
        .from("schedule_adjustments_history")
        .insert({
          user_id: employee.id,
          company_id: companyId,
          applied_from: startIso,
          expected_hours: avgHours,
          reason: trimmedReason,
          created_by: user.id,
          changed_at: new Date().toISOString(),
          start_time: enabledDays[0]?.startTime ?? "09:00",
          end_time: enabledDays[0]?.endTime ?? "17:00",
        } as any); // cast por si TS se queja
      if (historyInsert.error) {
        console.error("Error inserting history:", historyInsert.error);
        throw historyInsert.error;
      }

      toast.success(
        `✅ Jornada actualizada desde ${startIso} (${payload.length} días programados)`
      );
      setChangeReason("");
      await loadUpcomingEntries();

      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch (error: any) {
      console.error("❌ Error saving scheduled hours:", error);
      const errorMessage =
        error?.message || error?.error?.message || "Error desconocido";
      console.error("Error details:", {
        error,
        employeeId: employee.id,
        companyId,
      });
      toast.error(`No se pudieron guardar las horas: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearFuture = async () => {
    if (!companyId || !employee?.id) return;
    const confirmMessage =
      "¿Eliminar las jornadas planificadas desde hoy en adelante?";
    if (!window.confirm(confirmMessage)) return;

    setSaving(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { error } = await supabase
        .from("scheduled_hours")
        .delete()
        .eq("user_id", employee.id)
        .eq("company_id", companyId)
        .gte("date", today.toISOString().slice(0, 10));
      if (error) throw error;
      toast.success("Se eliminaron las jornadas próximas");
      hydrateRef.current = true;
      await loadUpcomingEntries();
    } catch (error) {
      console.error("Error clearing scheduled hours:", error);
      toast.error("No se pudieron eliminar las jornadas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Ajustar jornada laboral
          </DialogTitle>
          <DialogDescription>
            Configura turnos semanales y horarios para{" "}
            {employee.full_name || employee.email}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[2fr,0.9fr]">
          {/* COLUMNA IZQUIERDA: SEMANAS ROTATIVAS + FECHA + MOTIVO + BOTONES */}
          <div className="space-y-5 rounded-2xl border bg-card/70 p-5">
            {/* Fecha de inicio */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Aplicar desde</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Las semanas se generarán a partir de esta fecha. Semana 1
                corresponde a los primeros 7 días desde aquí.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Semanas rotativas
                  </p>
                  <h3 className="text-lg font-semibold">
                    Configura turnos por semana
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estas 4 semanas se repiten de forma rotativa a partir de la
                    fecha seleccionada.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Duplicar mañanas/tardes entre semanas
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {weeklySchedules.map((week, index) => (
                  <div
                    key={`week-block-${index}`}
                    className="rounded-2xl border border-border/60 bg-muted/40 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          Semana {index + 1}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {getWeekRangeLabel(index)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Select
                          value={copyWeekTargets[index].toString()}
                          onValueChange={(value) => {
                            const numeric = Number(value);
                            setCopyWeekTargets((prev) => {
                              const next = [...prev];
                              next[index] = numeric;
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Copiar a" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((weekNumber) => (
                              <SelectItem
                                key={`copy-${index}-${weekNumber}`}
                                value={weekNumber.toString()}
                                disabled={weekNumber === index + 1}
                              >
                                Semana {weekNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            handleCopyWeek(index, copyWeekTargets[index])
                          }
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Mañana
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={week.morningStart}
                            onChange={(e) =>
                              updateWeekSchedule(index, {
                                morningStart: e.target.value,
                              })
                            }
                          />
                          <Input
                            type="time"
                            value={week.morningEnd}
                            onChange={(e) =>
                              updateWeekSchedule(index, {
                                morningEnd: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Tarde
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={week.afternoonStart}
                            onChange={(e) =>
                              updateWeekSchedule(index, {
                                afternoonStart: e.target.value,
                              })
                            }
                          />
                          <Input
                            type="time"
                            value={week.afternoonEnd}
                            onChange={(e) =>
                              updateWeekSchedule(index, {
                                afternoonEnd: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="change-reason">Motivo del ajuste</Label>
              <Textarea
                id="change-reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ej. Cambio a jornada reducida por estudios, cobertura de temporada, horario flexible, etc."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !changeReason.trim() ||
                  !daySchedules.some((ds) => ds.enabled)
                }
                className="hover-scale"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Guardar jornada
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearFuture}
                disabled={saving}
                className="text-destructive hover-scale"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar jornadas futuras
              </Button>
            </div>
          </div>

          {/* COLUMNA DERECHA: HISTORIAL */}
          <div className="space-y-3 rounded-2xl border bg-muted/40 p-3 md:p-4 max-w-sm w-full lg:ml-auto">
            <div>
              <p className="text-sm font-semibold">Historial de ajustes</p>
              <p className="text-xs text-muted-foreground">
                Últimos cambios aplicados y el motivo indicado por el owner.
              </p>
            </div>
            {entriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </div>
            ) : upcomingGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay jornadas ajustadas en los próximos días.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {upcomingGroups.map((entry) => (
                  <div
                    key={`${entry.id}-${entry.start_date}`}
                    className="rounded-xl border bg-background px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">
                        {entry.changed_at
                          ? new Date(entry.changed_at).toLocaleDateString(
                              "es-ES",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "Ajuste"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Horario: {entry.start_time ?? "—"} –{" "}
                        {entry.end_time ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Jornada: {entry.expected_hours ?? 0} h/día
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Motivo: {entry.reason || "No especificado"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleHoursDialog;