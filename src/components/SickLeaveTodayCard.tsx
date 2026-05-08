import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  companyId: string;
}

interface SickLeaveRow {
  user_id: string;
  full_name: string | null;
  email: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  days_elapsed: number;
  reason: string | null;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const yesterdayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function SickLeaveTodayCard({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SickLeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from("workers_on_sick_leave_today")
        .select("user_id, full_name, email, start_date, end_date, days_remaining, days_elapsed, reason")
        .eq("company_id", companyId)
        .order("end_date", { ascending: true });
      if (error) throw error;
      setRows((data as SickLeaveRow[]) || []);
    } catch (err) {
      console.error("SickLeaveTodayCard error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Acorta la baja al día de ayer → el trabajador puede fichar HOY.
   * Si la baja empezó hoy, la marca rejected directamente.
   */
  const shortenSickLeave = async (row: SickLeaveRow) => {
    const fullName = row.full_name || row.email;
    if (
      !confirm(
        `¿Cerrar la baja de ${fullName}?\n\nA partir de hoy podrá fichar de nuevo. Si te has equivocado, podrás reabrir la baja desde Inspección/Auditoría.`
      )
    )
      return;

    setActing(row.user_id);
    try {
      const newEnd = row.start_date >= todayIso() ? null : yesterdayIso();

      // Buscar la row exacta de la baja activa
      const { data: absences, error: findError } = await supabase
        .from("absences")
        .select("id, start_date, end_date, status")
        .eq("user_id", row.user_id)
        .eq("company_id", companyId)
        .eq("status", "approved")
        .eq("absence_type", "sick_leave")
        .lte("start_date", todayIso())
        .gte("end_date", todayIso())
        .order("start_date", { ascending: false })
        .limit(1);
      if (findError) throw findError;

      const target = absences?.[0];
      if (!target) {
        toast.error("No encontré la baja activa. Refresca la página.");
        return;
      }

      let updateError: any = null;

      if (newEnd === null) {
        // La baja empezaba hoy → mejor anularla
        const { error } = await supabase
          .from("absences")
          .update({
            status: "rejected",
            reason:
              (target as any).reason ||
              "Baja cerrada el mismo día por el responsable",
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id);
        updateError = error;
      } else {
        const { error } = await supabase
          .from("absences")
          .update({
            end_date: newEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id);
        updateError = error;
      }

      if (updateError) throw updateError;

      // Auditoría (best-effort)
      try {
        await (supabase as any).from("audit_logs").insert({
          actor_user_id: user?.id ?? null,
          action: "shorten_sick_leave",
          entity_type: "absences",
          entity_id: target.id,
          diff: {
            before: { end_date: target.end_date, status: target.status },
            after: { end_date: newEnd, status: newEnd === null ? "rejected" : "approved" },
            target_user_id: row.user_id,
            target_user_name: fullName,
          },
        });
      } catch (auditErr) {
        console.warn("audit_logs insert failed (non-blocking):", auditErr);
      }

      // Notificación al trabajador
      try {
        await supabase.from("notifications").insert({
          company_id: companyId,
          user_id: row.user_id,
          title: "Tu baja médica se ha cerrado",
          message: "Ya puedes fichar normalmente. Si crees que es un error, contacta con tu responsable.",
          type: "info",
          entity_type: "absence",
          entity_id: target.id,
        });
      } catch (notifyErr) {
        console.warn("worker notification failed (non-blocking):", notifyErr);
      }

      toast.success(
        newEnd === null
          ? `Baja de ${fullName} anulada. Ya puede fichar.`
          : `Baja de ${fullName} cerrada. Ya puede fichar desde hoy.`
      );
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error al cerrar la baja");
    } finally {
      setActing(null);
    }
  };

  /**
   * Anula completamente la baja (status='rejected'). Útil si se metió por error.
   */
  const cancelSickLeave = async (row: SickLeaveRow) => {
    const fullName = row.full_name || row.email;
    if (
      !confirm(
        `¿Anular completamente la baja de ${fullName}?\n\nLa baja quedará marcada como rechazada (no aparecerá en histórico de bajas válidas). Usar SOLO si se metió por error.`
      )
    )
      return;

    setActing(row.user_id);
    try {
      const { data: absences, error: findError } = await supabase
        .from("absences")
        .select("id, start_date, end_date, status, reason")
        .eq("user_id", row.user_id)
        .eq("company_id", companyId)
        .eq("status", "approved")
        .eq("absence_type", "sick_leave")
        .lte("start_date", todayIso())
        .gte("end_date", todayIso())
        .order("start_date", { ascending: false })
        .limit(1);
      if (findError) throw findError;

      const target = absences?.[0];
      if (!target) {
        toast.error("No encontré la baja activa.");
        return;
      }

      const { error: updateError } = await supabase
        .from("absences")
        .update({
          status: "rejected",
          reason:
            ((target as any).reason || "") +
            ` [Anulada por responsable el ${new Date().toLocaleDateString("es-ES")}]`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (updateError) throw updateError;

      // Auditoría
      try {
        await (supabase as any).from("audit_logs").insert({
          actor_user_id: user?.id ?? null,
          action: "cancel_sick_leave",
          entity_type: "absences",
          entity_id: target.id,
          diff: {
            before: { status: target.status, end_date: target.end_date },
            after: { status: "rejected" },
            target_user_id: row.user_id,
            target_user_name: fullName,
          },
        });
      } catch (auditErr) {
        console.warn("audit_logs insert failed:", auditErr);
      }

      // Notificación al trabajador
      try {
        await supabase.from("notifications").insert({
          company_id: companyId,
          user_id: row.user_id,
          title: "Baja médica anulada",
          message: "Tu baja médica ha sido anulada por el responsable. Ya puedes fichar.",
          type: "warning",
          entity_type: "absence",
          entity_id: target.id,
        });
      } catch (notifyErr) {
        console.warn("worker notification failed:", notifyErr);
      }

      toast.success(`Baja de ${fullName} anulada. Ya puede fichar.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Error al anular");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Comprobando bajas activas…</span>
      </Card>
    );
  }
  if (rows.length === 0) return null;

  return (
    <Card className="p-5 space-y-3 border-red-200 bg-red-50/50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <Stethoscope className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">
            Trabajadores en baja médica hoy
          </h3>
          <p className="text-xs text-red-700/80">
            {rows.length} {rows.length === 1 ? "persona" : "personas"} con baja
            aprobada activa. No podrán fichar hasta el fin de la baja.
          </p>
        </div>
        <Badge variant="destructive" className="text-base px-2.5 py-0.5">
          {rows.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const isActing = acting === r.user_id;
          return (
            <div
              key={r.user_id}
              className="rounded-md bg-white border border-red-100 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    {r.full_name || r.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.reason || "Baja médica"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {r.days_remaining > 0
                        ? `${r.days_remaining} ${r.days_remaining === 1 ? "día" : "días"} restantes`
                        : "Termina hoy"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-red-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7"
                  disabled={isActing}
                  onClick={() => shortenSickLeave(r)}
                  title="Cierra la baja con efecto desde hoy. El trabajador puede fichar."
                >
                  {isActing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Cerrar baja (volver al trabajo)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
                  disabled={isActing}
                  onClick={() => cancelSickLeave(r)}
                  title="Anula completamente (solo si se registró por error)"
                >
                  <XCircle className="w-3 h-3" />
                  Anular (error)
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default SickLeaveTodayCard;
