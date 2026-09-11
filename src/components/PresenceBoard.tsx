import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { localDateKey } from "@/lib/workday";
import {
  buildPresence,
  countPresence,
  PRESENCE_LABELS,
  type PresenceInput,
  type PresenceStatus,
} from "@/lib/presence";

/**
 * Quién está ahora. Para el owner, admin o manager: de un vistazo, quién ha
 * llegado, quién está en pausa, quién va tarde y quién está de vacaciones o
 * de baja. Se actualiza cada minuto.
 */

interface Props {
  companyId: string;
  /** null = toda la empresa (owner/admin). Lista = ámbito del manager. */
  scopeUserIds: string[] | null;
}

type LoadedData = Omit<PresenceInput, "now">;

const DOT: Record<PresenceStatus, string> = {
  late: "bg-red-500",
  working: "bg-emerald-500",
  paused: "bg-amber-500",
  expected: "bg-sky-400",
  left: "bg-slate-400",
  absent: "bg-violet-400",
  off: "bg-slate-300",
};

const CHIP_TEXT: Partial<Record<PresenceStatus, (n: number) => string>> = {
  working: (n) => `${n} trabajando`,
  paused: (n) => `${n} en pausa`,
  late: (n) => `${n} con retraso`,
  expected: (n) => `${n} por llegar`,
  absent: (n) => `${n} ${n === 1 ? "ausente" : "ausentes"}`,
};

type MemberRow = {
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

const PresenceBoard = ({ companyId, scopeUserIds }: Props) => {
  const [data, setData] = useState<LoadedData | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOff, setShowOff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const todayKey = localDateKey(today);
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);

      const [membersRes, sessionsRes, eventsRes, schedulesRes, absencesRes, companyRes] = await Promise.all([
        supabase.from("memberships").select("user_id, profiles!inner(full_name, email)").eq("company_id", companyId),
        supabase.from("work_sessions").select("user_id, clock_in_time").eq("company_id", companyId).eq("is_active", true),
        supabase
          .from("time_events")
          .select("user_id, event_type, event_time")
          .eq("company_id", companyId)
          .gte("event_time", startOfToday.toISOString()),
        supabase
          .from("scheduled_hours")
          .select("user_id, start_time, end_time, morning_end_time, afternoon_start_time, expected_hours")
          .eq("company_id", companyId)
          .eq("date", todayKey),
        supabase
          .from("absences")
          .select("user_id, absence_type")
          .eq("company_id", companyId)
          .eq("status", "approved")
          .lte("start_date", todayKey)
          .gte("end_date", todayKey),
        supabase.from("companies").select("entry_late_minutes").eq("id", companyId).maybeSingle(),
      ]);

      const firstError = [membersRes, sessionsRes, eventsRes, schedulesRes, absencesRes].find((r) => r.error)?.error;
      if (firstError) throw firstError;

      const inScope = (id: string) => scopeUserIds === null || scopeUserIds.includes(id);
      const members = ((membersRes.data ?? []) as unknown as MemberRow[])
        .filter((m) => inScope(m.user_id))
        .map((m) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return { user_id: m.user_id, full_name: profile?.full_name ?? null, email: profile?.email ?? null };
        });
      const lateMargin = Number(companyRes.data?.entry_late_minutes);

      setData({
        members,
        activeSessions: (sessionsRes.data ?? []).filter((s) => inScope(s.user_id)),
        todayEvents: (eventsRes.data ?? []).filter((e) => inScope(e.user_id)),
        schedules: (schedulesRes.data ?? []).filter((s) => inScope(s.user_id)),
        absences: (absencesRes.data ?? []).filter((a) => inScope(a.user_id)),
        entryLateMinutes: Number.isFinite(lateMargin) && lateMargin >= 0 ? lateMargin : 15,
      });
      setError(null);
      setNow(new Date());
    } catch (err) {
      console.error("PresenceBoard load error:", err);
      setError("No se pudo cargar quién está ahora.");
    } finally {
      setLoading(false);
    }
  }, [companyId, scopeUserIds]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const rows = useMemo(() => (data ? buildPresence({ ...data, now }) : []), [data, now]);
  const counts = useMemo(() => countPresence(rows), [rows]);
  const visibleRows = showOff ? rows : rows.filter((r) => r.status !== "off");

  if (!data && !error) {
    return (
      <Card className="glass-card p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">Cargando quién está ahora…</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Quién está ahora
          </h2>
          <p className="text-xs text-muted-foreground">
            Actualizado a las {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      {data && data.members.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-3">No hay personas en tu equipo.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mt-3">
            {(Object.keys(CHIP_TEXT) as PresenceStatus[])
              .filter((status) => counts[status] > 0)
              .map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                >
                  <span className={cn("w-2 h-2 rounded-full", DOT[status])} />
                  {CHIP_TEXT[status]!(counts[status])}
                </span>
              ))}
          </div>

          <ul className="mt-3 divide-y divide-border/60">
            {visibleRows.map((row) => (
              <li key={row.userId} className="flex items-center gap-3 py-2">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", DOT[row.status])} aria-hidden />
                <span className="font-medium text-sm truncate flex-1 min-w-0">{row.name}</span>
                <span
                  className={cn(
                    "text-xs text-right shrink-0 max-w-[60%]",
                    row.status === "late" ? "text-red-600 font-medium" : "text-muted-foreground"
                  )}
                >
                  {row.detail === PRESENCE_LABELS[row.status]
                    ? row.detail
                    : `${PRESENCE_LABELS[row.status]} · ${row.detail}`}
                  {row.status === "late" && row.minutesLate ? ` (${row.minutesLate} min)` : ""}
                </span>
              </li>
            ))}
          </ul>

          {counts.off > 0 && (
            <Button variant="link" size="sm" className="px-0 mt-1" onClick={() => setShowOff((v) => !v)}>
              {showOff ? "Ocultar quien no tiene horario hoy" : `Mostrar ${counts.off} sin horario hoy`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
};

export default PresenceBoard;
