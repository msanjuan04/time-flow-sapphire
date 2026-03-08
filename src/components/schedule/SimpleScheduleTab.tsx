import { useState, useCallback } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, parseDateOnlyUtc, hoursBetween } from "@/lib/schedule/templates";

const DEFAULT_WEEKS = 52;

export type DaySchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  expectedHours: string;
};

const defaultDaySchedule = (): DaySchedule => ({
  enabled: false,
  startTime: "09:00",
  endTime: "17:00",
  expectedHours: "8",
});

interface SimpleScheduleTabProps {
  employeeId: string;
  companyId: string | null;
  createdBy: string | null;
  onSaved?: () => void;
}

const toTimeString = (value: string): string => {
  if (!value) return "";
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0");
  return `${h}:${m}:00`;
};

const initialDaysSchedule = (): Record<number, DaySchedule> => {
  const record: Record<number, DaySchedule> = {};
  WEEKDAYS.forEach(({ day }) => {
    record[day] = {
      ...defaultDaySchedule(),
      enabled: day >= 1 && day <= 5,
      startTime: "09:00",
      endTime: "17:00",
      expectedHours: "8",
    };
  });
  return record;
};

const SimpleScheduleTab = ({
  employeeId,
  companyId,
  createdBy,
  onSaved,
}: SimpleScheduleTabProps) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [daysSchedule, setDaysSchedule] = useState<Record<number, DaySchedule>>(initialDaysSchedule);
  const [weeksToGenerate, setWeeksToGenerate] = useState(DEFAULT_WEEKS);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const updateDay = useCallback((day: number, updates: Partial<DaySchedule>) => {
    setDaysSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  }, []);

  const getHoursForDay = useCallback(
    (day: number): number | null => {
      const d = daysSchedule[day];
      if (!d?.startTime || !d?.endTime) return null;
      const computed = hoursBetween(d.startTime, d.endTime);
      if (d.expectedHours.trim()) {
        const parsed = parseFloat(d.expectedHours);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : computed;
      }
      return computed > 0 ? computed : null;
    },
    [daysSchedule]
  );

  const enabledDaysWithValidHours = WEEKDAYS.filter(({ day }) => {
    const d = daysSchedule[day];
    return d?.enabled && d?.startTime && d?.endTime && (getHoursForDay(day) ?? 0) > 0;
  });

  const totalSemanal = enabledDaysWithValidHours.reduce(
    (sum, { day }) => sum + (getHoursForDay(day) ?? 0),
    0
  );
  const totalMensual = totalSemanal * (52 / 12);

  const handleSave = async () => {
    if (!companyId || !employeeId) return;
    if (enabledDaysWithValidHours.length === 0) {
      toast.error("Activa al menos un día e indica entrada y salida (y horas si quieres).");
      return;
    }

    setSaving(true);
    try {
      const base = parseDateOnlyUtc(startDate);
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
      const totalDays = weeksToGenerate * 7;
      const reasonNote = reason.trim() ? `Horario simple | ${reason.trim()}` : "Horario simple";

      for (let i = 0; i < totalDays; i++) {
        const date = addDays(base, i);
        const dayOfWeek = date.getUTCDay();
        const schedule = daysSchedule[dayOfWeek];
        if (!schedule?.enabled || !schedule.startTime || !schedule.endTime) continue;
        const hours = getHoursForDay(dayOfWeek);
        if (!Number.isFinite(hours) || hours <= 0) continue;

        payload.push({
          user_id: employeeId,
          company_id: companyId,
          date: format(date, "yyyy-MM-dd"),
          expected_hours: Number(hours.toFixed(2)),
          start_time: toTimeString(schedule.startTime),
          end_time: toTimeString(schedule.endTime),
          created_by: createdBy,
          notes: reasonNote,
        });
      }

      if (payload.length === 0) {
        toast.error("No hay días válidos con horario configurado.");
        setSaving(false);
        return;
      }

      const batchSize = 100;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        const { error } = await supabase.from("scheduled_hours").upsert(batch, {
          onConflict: "user_id,date",
          ignoreDuplicates: false,
        });
        if (error) throw error;
      }

      toast.success(
        `Horario simple guardado: ${payload.length} días desde ${format(base, "d MMM yyyy", { locale: es })}`
      );
      onSaved?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configura entrada y salida por cada día de la semana (ej. Lunes 6:00–14:00, Martes 7:00–15:00). Sin turno
        partido.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="simple-start-date">Aplicar desde</Label>
          <Input
            id="simple-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="simple-weeks">Semanas a generar</Label>
          <Input
            id="simple-weeks"
            type="number"
            min={1}
            max={104}
            value={weeksToGenerate}
            onChange={(e) => setWeeksToGenerate(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
          <p className="text-xs text-muted-foreground">Por defecto 1 año (52 semanas)</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Horario por día</Label>
        <p className="text-xs text-muted-foreground">
          Activa cada día y define entrada/salida. Las horas se calculan si dejas el campo vacío. Turno nocturno:
          salida menor que entrada (ej. 20:00 → 02:00).
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Día</th>
                <th className="text-left p-2 font-medium w-20">Activo</th>
                <th className="text-left p-2 font-medium">Entrada</th>
                <th className="text-left p-2 font-medium">Salida</th>
                <th className="text-left p-2 font-medium w-24">Horas</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map(({ day, name }) => {
                const d = daysSchedule[day] ?? defaultDaySchedule();
                const computed =
                  d.startTime && d.endTime ? hoursBetween(d.startTime, d.endTime) : null;
                const effectiveHours = getHoursForDay(day);
                return (
                  <tr key={day} className="border-b last:border-b-0">
                    <td className="p-2">{name}</td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                        className="rounded border-input"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="time"
                        value={d.startTime}
                        onChange={(e) => updateDay(day, { startTime: e.target.value })}
                        className="h-8 w-full"
                        disabled={!d.enabled}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="time"
                        value={d.endTime}
                        onChange={(e) => updateDay(day, { endTime: e.target.value })}
                        className="h-8 w-full"
                        disabled={!d.enabled}
                      />
                    </td>
                    <td className="p-2">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          min={0.5}
                          max={24}
                          step={0.5}
                          value={d.expectedHours}
                          onChange={(e) => updateDay(day, { expectedHours: e.target.value })}
                          placeholder={computed != null ? computed.toFixed(1) : "—"}
                          className="h-8 w-full"
                          disabled={!d.enabled}
                        />
                        {d.enabled && computed != null && computed > 0 && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            = {computed.toFixed(2)} h
                            {d.expectedHours.trim() &&
                              Math.abs(parseFloat(d.expectedHours) - computed) > 0.01 && (
                                <span className="ml-1">(manual: {effectiveHours?.toFixed(2)} h)</span>
                              )}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          <span className="font-medium tabular-nums">
            Total semanal: {totalSemanal.toFixed(2)} h
          </span>
          <span className="text-muted-foreground tabular-nums">
            Total mensual (ref.): {totalMensual.toFixed(2)} h
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="simple-reason">Motivo (opcional)</Label>
        <Textarea
          id="simple-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. Jornada estándar oficina"
          rows={2}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || enabledDaysWithValidHours.length === 0}
        className="gap-2"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        Guardar horario simple
      </Button>
    </div>
  );
};

export default SimpleScheduleTab;
