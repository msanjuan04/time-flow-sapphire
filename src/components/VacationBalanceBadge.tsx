import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import {
  checkVacationApproval,
  type VacationCheckResult,
} from "@/lib/vacationGuard";

interface Props {
  userId: string;
  companyId: string;
  startDate: string;
  endDate: string;
  /** Notifies the parent of the latest check result so it can decide button disabled state. */
  onCheck?: (result: VacationCheckResult) => void;
  className?: string;
}

/**
 * Renders a small badge next to a pending vacation request showing whether
 * the requested days fit in the user's current balance, and whether
 * approval would be blocked by company policy.
 */
export function VacationBalanceBadge({
  userId,
  companyId,
  startDate,
  endDate,
  onCheck,
  className,
}: Props) {
  const [result, setResult] = useState<VacationCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    checkVacationApproval({ userId, companyId, startDate, endDate })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        onCheck?.(r);
      })
      .catch((err) => {
        console.error("VacationBalanceBadge error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally do not include onCheck in deps so it doesn't refetch
    // every render if the parent passes an inline arrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyId, startDate, endDate]);

  if (loading) {
    return (
      <Badge variant="outline" className={`gap-1 ${className || ""}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Calculando saldo…
      </Badge>
    );
  }

  if (!result) return null;

  if (result.shouldBlock) {
    return (
      <Badge
        variant="destructive"
        className={`gap-1 ${className || ""}`}
        title={result.message}
      >
        <ShieldAlert className="w-3 h-3" />
        Bloqueado: excede saldo en {result.excessDays.toFixed(1)} días
      </Badge>
    );
  }

  if (!result.withinBalance) {
    return (
      <Badge
        className={`gap-1 bg-amber-500 hover:bg-amber-500/90 ${className || ""}`}
        title={result.message}
      >
        <AlertTriangle className="w-3 h-3" />
        Excede saldo en {result.excessDays.toFixed(1)} días (permitido)
      </Badge>
    );
  }

  return (
    <Badge
      className={`gap-1 bg-emerald-600 hover:bg-emerald-600/90 ${className || ""}`}
      title={result.message}
    >
      <CheckCircle2 className="w-3 h-3" />
      {result.requestedDays} {result.requestedDays === 1 ? "día" : "días"} ·{" "}
      {result.availableDays.toFixed(1)} disponibles
    </Badge>
  );
}

export default VacationBalanceBadge;
