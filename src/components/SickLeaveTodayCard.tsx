import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Tarjeta para el dashboard del owner: lista de trabajadores con baja
 * médica aprobada activa hoy. Útil para tener visibilidad rápida
 * sin tener que cruzar el calendario de cada empleado.
 *
 * Si la lista está vacía, no se renderiza nada (evita ruido visual).
 */
export function SickLeaveTodayCard({ companyId }: Props) {
  const [rows, setRows] = useState<SickLeaveRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  // No renderizamos nada si hay 0 bajas activas (limpio visualmente)
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

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.user_id}
            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-white border border-red-100"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {r.full_name || r.email}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {r.reason || "Baja médica"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <Badge variant="outline" className="text-[10px] gap-1">
                {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {r.days_remaining > 0
                  ? `${r.days_remaining} ${r.days_remaining === 1 ? "día" : "días"} restantes`
                  : "Termina hoy"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default SickLeaveTodayCard;
