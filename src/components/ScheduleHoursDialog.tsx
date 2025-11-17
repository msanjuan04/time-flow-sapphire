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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { Loader2, CalendarClock, Clock5, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

const formatDateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const HORIZON_FORWARD_DAYS = 180;
const HORIZON_BACKWARD_DAYS = 0;
const PREVIEW_GROUPS = 12;
const HISTORY_DAYS = 120;

const ScheduleHoursDialog = ({ open, onOpenChange, employee }: ScheduleHoursDialogProps) => {
  const { user } = useAuth();
  const { companyId } = useMembership();
  const [expectedHours, setExpectedHours] = useState("8");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [upcomingGroups, setUpcomingGroups] = useState<ScheduleGroup[]>([]);
  const hydrateHoursRef = useRef(true);

  const resetForm = () => {
    setExpectedHours("8");
    setChangeReason("");
    setStartTime("09:00");
    setEndTime("17:00");
    setUpcomingGroups([]);
  };

  const computeHoursFromTimes = useCallback((start: string, end: string) => {
    const [sh, sm] = start.split(":").map((v) => Number(v));
    const [eh, em] = end.split(":").map((v) => Number(v));
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, minutes / 60);
  }, []);

  useEffect(() => {
    const computed = computeHoursFromTimes(startTime, endTime);
    if (computed > 0) {
      setExpectedHours(computed.toFixed(2));
    }
  }, [startTime, endTime, computeHoursFromTimes]);

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
      if (hydrateHoursRef.current) {
        const fallback = limitedGroups.length > 0 ? limitedGroups[0].expected_hours : 8;
        setExpectedHours(String(fallback));
        setStartTime(limitedGroups[0]?.start_time ?? "09:00");
        setEndTime(limitedGroups[0]?.end_time ?? "17:00");
        hydrateHoursRef.current = false;
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
      hydrateHoursRef.current = true;
      loadUpcomingEntries();
    } else {
      resetForm();
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

    const computedHours = computeHoursFromTimes(startTime, endTime);
    if (computedHours <= 0 || computedHours > 24) {
      toast.error("Revisa las horas de entrada y salida");
      return;
    }

    setSaving(true);
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const totalDays = HORIZON_BACKWARD_DAYS + HORIZON_FORWARD_DAYS || HORIZON_FORWARD_DAYS;

      const startIso = startDate.toISOString().slice(0, 10);
      const deleteResult = await supabase
        .from("scheduled_hours")
        .delete()
        .eq("user_id", employee.id)
        .eq("company_id", companyId)
        .gte("date", startIso);
      if (deleteResult.error) throw deleteResult.error;

      const reasonMetadata = JSON.stringify({
        reason: trimmedReason,
        changed_at: new Date().toISOString(),
        start_time: startTime,
        end_time: endTime,
      });

      const payload = Array.from({ length: totalDays }, (_, idx) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + idx);
        return {
          user_id: employee.id,
          company_id: companyId,
          date: date.toISOString().slice(0, 10),
          expected_hours: Number(computedHours.toFixed(2)),
          created_by: user.id,
          notes: reasonMetadata,
          start_time: startTime,
          end_time: endTime,
        };
      });

      const insertResult = await supabase.from("scheduled_hours").insert(payload);
      if (insertResult.error) throw insertResult.error;

      const historyInsert = await supabase.from("schedule_adjustments_history").insert({
        user_id: employee.id,
        company_id: companyId,
        applied_from: startIso,
        expected_hours: Number(computedHours.toFixed(2)),
        reason: trimmedReason,
        created_by: user.id,
        changed_at: new Date().toISOString(),
        start_time: startTime,
        end_time: endTime,
      });
      if (historyInsert.error) throw historyInsert.error;

      toast.success("Jornada actualizada");
      setChangeReason("");
      await loadUpcomingEntries();
    } catch (error) {
      console.error("Error saving scheduled hours:", error);
      toast.error("No se pudieron guardar las horas");
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
      hydrateHoursRef.current = true;
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
      <DialogContent className="max-w-4xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Ajustar jornada
          </DialogTitle>
          <DialogDescription>
            Configura las horas previstas para {employee.full_name || employee.email}. Puedes ajustar, actualizar o
            eliminar jornadas futuras según corresponda.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5 rounded-2xl border bg-card/70 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="start-time">Hora de entrada</Label>
                <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-time">Hora de salida</Label>
                <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm flex flex-col gap-1">
              <span>Jornada diaria: <strong>{Number(expectedHours).toFixed(2)} h</strong></span>
              <span>Horario previsto: {startTime} – {endTime}</span>
              <p className="text-xs text-muted-foreground">
                Aplicaremos este horario a los próximos días laborables. Para cambios puntuales usa el calendario del empleado.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-reason">Motivo del ajuste</Label>
              <Textarea
                id="change-reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ej. Cambio a jornada reducida por estudios, cobertura de temporada, etc."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !changeReason.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock5 className="w-4 h-4" />}
                Guardar jornada
              </Button>
              <Button type="button" variant="ghost" onClick={handleClearFuture} disabled={saving} className="text-destructive">
                <Trash2 className="w-4 h-4" />
                Eliminar jornadas futuras
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
            <div>
              <p className="text-sm font-semibold">Historial de ajustes de jornada</p>
              <p className="text-xs text-muted-foreground">Últimos cambios aplicados y el motivo indicado por el owner.</p>
            </div>
            {entriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </div>
            ) : upcomingGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay jornadas ajustadas en los próximos días.</p>
            ) : (
              <div className="space-y-2">
                {upcomingGroups.map((entry) => (
                  <div key={`${entry.id}-${entry.start_date}`} className="rounded-xl border bg-background px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">
                        Ajuste registrado el{" "}
                        {entry.changed_at
                          ? new Date(entry.changed_at).toLocaleString("es-ES")
                          : formatDateLabel(entry.start_date)}
                      </p>
                      <p className="text-xs text-muted-foreground">Horario: {entry.start_time ?? "—"} – {entry.end_time ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Jornada: {entry.expected_hours ?? 0} h/día</p>
                      <p className="text-xs text-muted-foreground">Motivo: {entry.reason || "No especificado"}</p>
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
