import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plane, ArrowRight } from "lucide-react";

interface Balance {
  assigned_days: number;
  accrued_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

interface Props {
  userId: string;
  companyId: string;
}

const fmt = (n: number) => Number(n).toFixed(1).replace(/\.0$/, "");

export function MyVacationWidget({ userId, companyId }: Props) {
  const navigate = useNavigate();
  const [bal, setBal] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_vacation_balance", {
          p_user_id: userId,
          p_company_id: companyId,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setBal(row ?? null);
      } catch (err) {
        console.error("Error cargando saldo de vacaciones:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, companyId]);

  if (loading || !bal) return null;

  const pctUsed = bal.assigned_days
    ? Math.min(100, ((bal.used_days + bal.pending_days) / bal.assigned_days) * 100)
    : 0;

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Plane className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Mis vacaciones</p>
          <p className="font-semibold text-foreground">
            <span className="text-2xl tabular-nums text-emerald-600">
              {fmt(bal.available_days)}
            </span>{" "}
            <span className="text-sm text-muted-foreground">
              de {fmt(bal.assigned_days)} días disponibles
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/absences")}
          className="shrink-0"
        >
          Solicitar
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pctUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            Disfrutados: <span className="font-medium">{fmt(bal.used_days)}</span>
          </span>
          <span>
            Pendientes: <span className="font-medium">{fmt(bal.pending_days)}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

export default MyVacationWidget;
