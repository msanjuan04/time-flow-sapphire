import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { Loader2, CalendarClock, Clock5, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScheduleHistoryRow = Database["public"]["Tables"]["schedule_adjustments_history"]["Row"];

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

const ScheduleHoursDialog = ({ open, onOpenChange, employee }: ScheduleHoursDialogProps) => {
  const { user } = useAuth();
  const { companyId } = useMembership();
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
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [upcomingGroups, setUpcomingGroups] = useState<ScheduleGroup[]>([]);
  const hydrateRef = useRef(true);

  const computeHoursFromTimes = useCallback((start: string, end: string): number => {
    const [sh, sm] = start.split(":").map((v) => Number(v));
    const [eh, em] = end.split(":").map((v) => Number(v));
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, minutes / 60);
  }, []);

  const updateDaySchedule = (day: number, updates: Partial<DaySchedule>) => {
    setDaySchedules((prev) =>
      prev.map((ds) => {
        if (ds.day === day) {
          const updated = { ...ds, ...updates };
          // Auto-calculate hours when times change
          if (updates.startTime || updates.endTime) {
            updated.expectedHours = computeHoursFromTimes(
              updates.startTime ?? ds.startTime,
              updates.endTime ?? ds.endTime
            );
          }
          return updated;
        }
        return ds;
      })
    );
  };

  const loadUpcomingEntries = useCallback(async () => {
    if (!open || !employee?.id || !companyId) return;
    setEntriesLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - HISTORY_DAYS);
      const { data, error } = await supabase
        .from("schedule_adjustments_history")
        .select("id, expected_hours, reason, changed_at, applied_from, start_time, end_time")
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

      // Load existing scheduled hours for next 7 days to determine which days are enabled
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
          .gte("date", today.toISOString().split('T')[0])
          .lte("date", nextWeek.toISOString().split('T')[0])
          .order("date", { ascending: true });

        if (existingSchedules && existingSchedules.length > 0) {
          // Group by day of week
          const dayMap = new Map<number, { start_time: string; end_time: string; expected_hours: number }>();
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
          // Fallback to history if no current schedules
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

    const trimmedReason = changeReason.trim();
    if (!trimmedReason) {
      toast.error("Describe el motivo del ajuste");
      return;
    }

    // Validate that at least one day is enabled
    const enabledDays = daySchedules.filter((ds) => ds.enabled);
    if (enabledDays.length === 0) {
      toast.error("Debes seleccionar al menos un día de trabajo");
      return;
    }

    // Validate all enabled days have valid times
    for (const day of enabledDays) {
      const hours = computeHoursFromTimes(day.startTime, day.endTime);
      if (hours <= 0 || hours > 24) {
        toast.error(`Revisa las horas del ${day.dayName}`);
        return;
      }
    }

    setSaving(true);
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const startIso = startDate.toISOString().slice(0, 10);

      // Delete existing scheduled hours from today forward
      const deleteResult = await supabase
        .from("scheduled_hours")
        .delete()
        .eq("user_id", employee.id)
        .eq("company_id", companyId)
        .gte("date", startIso);
      if (deleteResult.error) throw deleteResult.error;

      // Generate scheduled hours for the next HORIZON_FORWARD_DAYS
      const payload: any[] = [];
      const reasonMetadata = JSON.stringify({
        reason: trimmedReason,
        changed_at: new Date().toISOString(),
        days: enabledDays.map((d) => ({
          day: d.day,
          dayName: d.dayName,
          startTime: d.startTime,
          endTime: d.endTime,
          expectedHours: d.expectedHours,
        })),
      });

      for (let i = 0; i < HORIZON_FORWARD_DAYS; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
        const daySchedule = daySchedules.find((ds) => ds.day === dayOfWeek && ds.enabled);

        if (daySchedule) {
          payload.push({
            user_id: employee.id,
            company_id: companyId,
            date: date.toISOString().slice(0, 10),
            expected_hours: Number(daySchedule.expectedHours.toFixed(2)),
            created_by: user.id,
            notes: reasonMetadata,
            start_time: daySchedule.startTime,
            end_time: daySchedule.endTime,
          });
        }
      }

      if (payload.length > 0) {
        // Insert in batches of 100 to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < payload.length; i += batchSize) {
          const batch = payload.slice(i, i + batchSize);
          const insertResult = await supabase.from("scheduled_hours").insert(batch);
          if (insertResult.error) {
            console.error("Error inserting batch:", insertResult.error);
            throw insertResult.error;
          }
        }
        console.log(`✅ Inserted ${payload.length} scheduled hours records`);
      } else {
        console.warn("⚠️ No payload to insert - no days enabled");
      }

      // Save to history
      const avgHours = enabledDays.reduce((sum, d) => sum + d.expectedHours, 0) / enabledDays.length;
      const historyInsert = await supabase.from("schedule_adjustments_history").insert({
        user_id: employee.id,
        company_id: companyId,
        applied_from: startIso,
        expected_hours: avgHours,
        reason: trimmedReason,
        created_by: user.id,
        changed_at: new Date().toISOString(),
        start_time: enabledDays[0]?.startTime ?? "09:00",
        end_time: enabledDays[0]?.endTime ?? "17:00",
      });
      if (historyInsert.error) {
        console.error("Error inserting history:", historyInsert.error);
        throw historyInsert.error;
      }

      toast.success(`✅ Jornada actualizada para ${enabledDays.length} día(s) de la semana (${payload.length} días programados)`);
      setChangeReason("");
      await loadUpcomingEntries();
      
      // Close dialog after successful save
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch (error: any) {
      console.error("❌ Error saving scheduled hours:", error);
      const errorMessage = error?.message || error?.error?.message || "Error desconocido";
      console.error("Error details:", {
        error,
        employeeId: employee.id,
        companyId,
        payloadLength: payload.length,
        enabledDays: enabledDays.length,
      });
      toast.error(`No se pudieron guardar las horas: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearFuture = async () => {
    if (!companyId || !employee?.id) return;
    const confirmMessage = "¿Eliminar las jornadas planificadas desde hoy en adelante?";
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

  const applyToAllDays = (field: "startTime" | "endTime", value: string) => {
    setDaySchedules((prev) =>
      prev.map((ds) => {
        if (ds.enabled) {
          const updated = { ...ds, [field]: value };
          if (field === "startTime" || field === "endTime") {
            updated.expectedHours = computeHoursFromTimes(
              field === "startTime" ? value : ds.startTime,
              field === "endTime" ? value : ds.endTime
            );
          }
          return updated;
        }
        return ds;
      })
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Ajustar jornada laboral
          </DialogTitle>
          <DialogDescription>
            Configura los días de trabajo y horarios para {employee.full_name || employee.email}. 
            Marca los días que debe trabajar y asigna las horas correspondientes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5 rounded-2xl border bg-card/70 p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Días de la semana</Label>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setDaySchedules((prev) =>
                        prev.map((ds) => ({ ...ds, enabled: ds.day >= 1 && ds.day <= 5 }))
                      );
                    }}
                  >
                    L-V
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setDaySchedules((prev) => prev.map((ds) => ({ ...ds, enabled: true })));
                    }}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setDaySchedules((prev) => prev.map((ds) => ({ ...ds, enabled: false })));
                    }}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {daySchedules.map((daySchedule) => (
                  <Card
                    key={daySchedule.day}
                    className={cn(
                      "p-4 transition-all",
                      daySchedule.enabled
                        ? "border-primary/50 bg-primary/5"
                        : "border-muted bg-muted/30 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Checkbox
                          checked={daySchedule.enabled}
                          onCheckedChange={(checked) =>
                            updateDaySchedule(daySchedule.day, { enabled: checked === true })
                          }
                        />
                        <Label className="font-medium cursor-pointer">
                          {daySchedule.dayName}
                        </Label>
                      </div>

                      {daySchedule.enabled && (
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Entrada</Label>
                            <Input
                              type="time"
                              value={daySchedule.startTime}
                              onChange={(e) =>
                                updateDaySchedule(daySchedule.day, { startTime: e.target.value })
                              }
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Salida</Label>
                            <Input
                              type="time"
                              value={daySchedule.endTime}
                              onChange={(e) =>
                                updateDaySchedule(daySchedule.day, { endTime: e.target.value })
                              }
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Horas</Label>
                            <div className="h-9 rounded-md border bg-background px-3 flex items-center text-sm font-medium">
                              {daySchedule.expectedHours.toFixed(2)}h
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {daySchedules.some((ds) => ds.enabled) && (
                <div className="flex gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const firstEnabled = daySchedules.find((ds) => ds.enabled);
                      if (firstEnabled) {
                        applyToAllDays("startTime", firstEnabled.startTime);
                      }
                    }}
                  >
                    Aplicar entrada a todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const firstEnabled = daySchedules.find((ds) => ds.enabled);
                      if (firstEnabled) {
                        applyToAllDays("endTime", firstEnabled.endTime);
                      }
                    }}
                  >
                    Aplicar salida a todos
                  </Button>
                </div>
              )}
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
                disabled={saving || !changeReason.trim() || !daySchedules.some((ds) => ds.enabled)}
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

          <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
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
                          ? new Date(entry.changed_at).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Ajuste"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Horario: {entry.start_time ?? "—"} – {entry.end_time ?? "—"}
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
