import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Eraser, Loader2, Repeat, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getManagerScope, isManagerScopeEmpty } from "@/lib/managerScope";
import { ApplyTemplateButton } from "@/components/owner/ApplyTemplateButton";
import { cn } from "@/lib/utils";
import {
  buildRosterWeek,
  copyWeekPayload,
  dateKey,
  shiftWeeks,
  weekDays,
  weekStartOf,
  type RosterMember,
  type RosterSchedule,
} from "@/lib/roster";

/**
 * Cuadrante semanal del equipo.
 *
 * Una rejilla de personas por días con el turno de cada uno. Las acciones
 * trabajan sobre las personas marcadas: aplicar una plantilla, copiar la
 * semana anterior, repetir esta semana hacia delante (así se montan las
 * rotaciones) o vaciarla.
 */

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const formatWeek = (weekStart: Date) => {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date, withYear = false) =>
    d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  return `${fmt(weekStart)} - ${fmt(end, true)}`;
};

const Roster = () => {
  useDocumentTitle("Cuadrante • GTiQ");
  const { user } = useAuth();
  const { companyId, role } = useMembership();

  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [schedules, setSchedules] = useState<RosterSchedule[]>([]);
  const [previousWeek, setPreviousWeek] = useState<RosterSchedule[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState("3");

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const previousStart = useMemo(() => shiftWeeks(weekStart, -1), [weekStart]);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      let scopeIds: string[] | null = null;
      if (role === "manager") {
        const scope = await getManagerScope(user.id, companyId);
        scopeIds = isManagerScopeEmpty(scope) ? [] : scope.userIds;
      }

      const { data: memberRows, error: membersError } = await supabase
        .from("memberships")
        .select("user_id, role, profiles!inner(full_name, email, is_active)")
        .eq("company_id", companyId);
      if (membersError) throw membersError;

      const people: RosterMember[] = (memberRows ?? [])
        .map((m) => {
          const profile = Array.isArray((m as never as { profiles: unknown }).profiles)
            ? (m as never as { profiles: { full_name: string | null; email: string | null; is_active: boolean }[] }).profiles[0]
            : (m as never as { profiles: { full_name: string | null; email: string | null; is_active: boolean } }).profiles;
          return {
            user_id: m.user_id,
            full_name: profile?.full_name ?? null,
            email: profile?.email ?? null,
            role: m.role,
            is_active: profile?.is_active !== false,
          };
        })
        .filter((p) => (p as { is_active: boolean }).is_active)
        .filter((p) => scopeIds === null || scopeIds.includes(p.user_id));

      const previousDays = weekDays(shiftWeeks(weekStart, -1));
      const [thisWeekRes, prevWeekRes] = await Promise.all([
        supabase
          .from("scheduled_hours")
          .select("user_id, date, start_time, end_time, morning_end_time, afternoon_start_time, expected_hours")
          .eq("company_id", companyId)
          .gte("date", days[0])
          .lte("date", days[6]),
        supabase
          .from("scheduled_hours")
          .select("user_id, date, start_time, end_time, morning_end_time, afternoon_start_time, expected_hours")
          .eq("company_id", companyId)
          .gte("date", previousDays[0])
          .lte("date", previousDays[6]),
      ]);
      if (thisWeekRes.error) throw thisWeekRes.error;

      setMembers(people);
      setSchedules((thisWeekRes.data ?? []) as RosterSchedule[]);
      setPreviousWeek((prevWeekRes.data ?? []) as RosterSchedule[]);
      setError(null);
    } catch (err) {
      console.error("Roster load error:", err);
      setError("No se pudo cargar el cuadrante");
    } finally {
      setLoading(false);
    }
  }, [companyId, days, role, user?.id, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const week = useMemo(() => buildRosterWeek(weekStart, members, schedules), [weekStart, members, schedules]);
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = members.length > 0 && selected.size === members.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(members.map((m) => m.user_id)));

  const toggleOne = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const requireSelection = () => {
    if (selectedIds.length === 0) {
      toast.error("Marca primero a quién se lo aplicas");
      return false;
    }
    return true;
  };

  const savePayload = async (payload: ReturnType<typeof copyWeekPayload>, mensaje: string) => {
    if (payload.length === 0) {
      toast.info("No hay turnos que copiar");
      return;
    }
    setSaving(true);
    try {
      const { error: saveError } = await supabase
        .from("scheduled_hours")
        .upsert(payload, { onConflict: "user_id,date" });
      if (saveError) throw saveError;
      toast.success(mensaje);
      await load();
    } catch (err) {
      console.error("Roster save error:", err);
      toast.error("No se pudo guardar el cuadrante");
    } finally {
      setSaving(false);
    }
  };

  const copiarSemanaAnterior = () => {
    if (!requireSelection() || !companyId || !user?.id) return;
    void savePayload(
      copyWeekPayload({
        sourceSchedules: previousWeek,
        sourceWeekStart: previousStart,
        targetOffsets: [1],
        userIds: selectedIds,
        companyId,
        createdBy: user.id,
      }),
      "Semana copiada desde la anterior"
    );
  };

  const repetirSemana = () => {
    if (!companyId || !user?.id) return;
    const weeks = Math.min(Math.max(Number(repeatWeeks) || 0, 1), 26);
    const offsets = Array.from({ length: weeks }, (_, i) => i + 1);
    setRepeatOpen(false);
    void savePayload(
      copyWeekPayload({
        sourceSchedules: schedules,
        sourceWeekStart: weekStart,
        targetOffsets: offsets,
        userIds: selectedIds,
        companyId,
        createdBy: user.id,
      }),
      `Cuadrante repetido durante ${weeks} ${weeks === 1 ? "semana" : "semanas"}`
    );
  };

  const vaciarSemana = async () => {
    if (!requireSelection() || !companyId) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from("scheduled_hours")
        .delete()
        .eq("company_id", companyId)
        .in("user_id", selectedIds)
        .gte("date", days[0])
        .lte("date", days[6]);
      if (deleteError) throw deleteError;
      toast.success("Semana vaciada para las personas marcadas");
      await load();
    } catch (err) {
      console.error("Roster clear error:", err);
      toast.error("No se pudo vaciar la semana");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        icon={CalendarRange}
        title="Cuadrante"
        description="Turnos de la semana, por persona y día"
      />

      <div className="space-y-4">
        <Card className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart(shiftWeeks(weekStart, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="font-medium min-w-[190px] text-center">{formatWeek(weekStart)}</p>
            <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setWeekStart(shiftWeeks(weekStart, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(weekStartOf(new Date()))}>
              Esta semana
            </Button>
          </div>
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </Card>

        <Card className="glass-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {selected.size === 0
              ? "Marca a las personas sobre las que quieres actuar."
              : `${selected.size} ${selected.size === 1 ? "persona marcada" : "personas marcadas"}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {companyId && (
              <ApplyTemplateButton
                companyId={companyId}
                initialUserIds={selectedIds}
                size="sm"
                variant="default"
                label="Aplicar plantilla"
              />
            )}
            <Button variant="outline" size="sm" onClick={copiarSemanaAnterior} disabled={saving}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar semana anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (requireSelection()) setRepeatOpen(true);
              }}
              disabled={saving}
            >
              <Repeat className="w-4 h-4 mr-2" />
              Repetir esta semana
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void vaciarSemana()} disabled={saving}>
              <Eraser className="w-4 h-4 mr-2" />
              Vaciar semana
            </Button>
            {saving && <Loader2 className="w-4 h-4 animate-spin self-center" />}
          </div>
        </Card>

        <Card className="glass-card p-0 overflow-hidden">
          {error && <p className="text-sm text-destructive p-4">{error}</p>}
          {loading && members.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando el cuadrante…
            </p>
          )}
          {!loading && members.length === 0 && !error && (
            <p className="text-sm text-muted-foreground p-4">No hay personas en tu equipo.</p>
          )}

          {members.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="p-3 text-left font-medium sticky left-0 bg-muted/40 z-10 min-w-[210px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Marcar todos" />
                        Persona
                      </label>
                    </th>
                    {week.days.map((day, index) => (
                      <th key={day} className="p-3 text-left font-medium min-w-[120px]">
                        <span className="block">{DAY_LABELS[index]}</span>
                        <span className="text-[11px] font-normal">
                          {new Date(`${day}T00:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </th>
                    ))}
                    <th className="p-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {week.rows.map((row) => (
                    <tr key={row.userId} className="border-t border-border/50 align-top">
                      <td className="p-3 sticky left-0 bg-card z-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selected.has(row.userId)}
                            onCheckedChange={() => toggleOne(row.userId)}
                            aria-label={`Marcar ${row.name}`}
                          />
                          <span className="font-medium truncate">{row.name}</span>
                        </label>
                        <span className="text-xs text-muted-foreground pl-6">
                          {row.daysWithShift} {row.daysWithShift === 1 ? "día" : "días"}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.date} className="p-3">
                          {cell.schedule ? (
                            <>
                              <span className="block tabular-nums">{cell.label}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{cell.hours} h</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="p-3 text-right font-medium tabular-nums">{row.totalHours} h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30 text-xs">
                    <td className="p-3 sticky left-0 bg-muted/30 z-10 font-medium">Total del día</td>
                    {week.dayTotals.map((total) => (
                      <td key={total.date} className="p-3 tabular-nums">
                        {total.people} {total.people === 1 ? "persona" : "personas"}
                        <span className="block text-muted-foreground">{total.hours} h</span>
                      </td>
                    ))}
                    <td className="p-3 text-right font-medium tabular-nums">{week.totalHours} h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={repeatOpen} onOpenChange={setRepeatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Repetir esta semana</DialogTitle>
            <DialogDescription>
              Copia los turnos de {formatWeek(weekStart)} a las semanas siguientes, para las personas marcadas. Si ya
              había turno en algún día, se sustituye.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="repetir-semanas">Número de semanas</Label>
            <Input
              id="repetir-semanas"
              inputMode="numeric"
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(e.target.value.replace(/\D/g, ""))}
              placeholder="3"
            />
            <p className="text-xs text-muted-foreground">
              Para una rotación de dos semanas, monta la semana A, repítela cada dos, y haz lo mismo con la B.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setRepeatOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={repetirSemana} disabled={saving}>
              Repetir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Roster;
