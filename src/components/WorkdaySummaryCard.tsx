import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDuration,
  localDateKey,
  startOfWeekMonday,
  summarizeWorkday,
  type ClockEventLite,
  type ScheduledDayLite,
} from "@/lib/workday";

/**
 * Resumen de horas del trabajador: hoy y esta semana, trabajado frente a
 * previsto. Es lo que más ayuda a que la gente abra la app cada día y se fíe
 * del registro. Se calcula desde los fichajes, descontando pausas.
 */

interface Props {
  userId: string;
  companyId: string;
  /** Cambia tras cada fichaje para recargar al momento. */
  refreshKey?: string;
}

const ProgressBar = ({ ratio, over }: { ratio: number; over: boolean }) => (
  <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
    <div
      className={over ? "h-full bg-amber-500" : "h-full bg-primary"}
      style={{ width: `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%` }}
    />
  </div>
);

const describeGap = (worked: number, expected: number, noScheduleText: string) => {
  if (expected <= 0) return noScheduleText;
  const diff = expected - worked;
  if (diff > 60) return `Te quedan ${formatDuration(diff)}`;
  if (diff < -60) return `${formatDuration(-diff)} por encima de lo previsto`;
  return "Completado";
};

const WorkdaySummaryCard = ({ userId, companyId, refreshKey }: Props) => {
  const [events, setEvents] = useState<ClockEventLite[] | null>(null);
  const [schedules, setSchedules] = useState<ScheduledDayLite[]>([]);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const weekStart = startOfWeekMonday(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    // Un día antes por si la semana empieza con un turno de noche abierto.
    const from = new Date(weekStart);
    from.setDate(from.getDate() - 1);

    const [eventsRes, schedulesRes] = await Promise.all([
      supabase
        .from("time_events")
        .select("event_type, event_time")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .gte("event_time", from.toISOString())
        .order("event_time", { ascending: true }),
      supabase
        .from("scheduled_hours")
        .select("date, expected_hours")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .gte("date", localDateKey(weekStart))
        .lte("date", localDateKey(weekEnd)),
    ]);

    if (!eventsRes.error) setEvents(eventsRes.data ?? []);
    if (!schedulesRes.error) setSchedules(schedulesRes.data ?? []);
    setNow(new Date());
  }, [userId, companyId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!events) return null;

  const s = summarizeWorkday(events, schedules, now);

  return (
    <Card className="glass-card p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4 text-primary" />
            Hoy
          </div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {formatDuration(s.todaySeconds)}
            {s.todayExpectedSeconds > 0 && (
              <span className="text-sm font-normal text-muted-foreground"> de {formatDuration(s.todayExpectedSeconds)}</span>
            )}
          </p>
          {s.todayExpectedSeconds > 0 && (
            <ProgressBar
              ratio={s.todaySeconds / s.todayExpectedSeconds}
              over={s.todaySeconds - s.todayExpectedSeconds > 60}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {describeGap(s.todaySeconds, s.todayExpectedSeconds, "Hoy no tienes horario asignado")}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="w-4 h-4 text-primary" />
            Esta semana
          </div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {formatDuration(s.weekSeconds)}
            {s.weekExpectedSeconds > 0 && (
              <span className="text-sm font-normal text-muted-foreground"> de {formatDuration(s.weekExpectedSeconds)}</span>
            )}
          </p>
          {s.weekExpectedSeconds > 0 && (
            <ProgressBar
              ratio={s.weekSeconds / s.weekExpectedSeconds}
              over={s.weekSeconds - s.weekExpectedSeconds > 60}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {describeGap(s.weekSeconds, s.weekExpectedSeconds, "Sin horario asignado esta semana")}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default WorkdaySummaryCard;
