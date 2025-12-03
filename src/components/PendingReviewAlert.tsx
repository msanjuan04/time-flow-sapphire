import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const PendingReviewAlert = () => {
  const { companyId, role } = useMembership();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const storageKey = companyId ? `pendingReviewDismissed_${companyId}` : null;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      if (!companyId || !["owner", "admin", "manager"].includes(role ?? "")) return;
      const dismissed = storageKey ? localStorage.getItem(storageKey) === "true" : false;
      const { data: rows, error } = await supabase
        .from("work_sessions")
        .select("id")
        .eq("company_id", companyId)
        .or("review_status.eq.exceeded_limit,review_status.eq.pending_review,review_status.is.null,status.eq.auto_closed")
        .limit(1);
      if (!error && rows && rows.length > 0) {
        setShow(!dismissed);
      } else {
        if (storageKey) localStorage.removeItem(storageKey);
        setShow(false);
      }
    };
    check();
    timer = setInterval(check, 30000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [companyId, role]);

  if (!show) return null;

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">Tienes fichajes pendientes de revisar</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 text-amber-800">
        Algunos fichajes superaron el límite de horas y necesitan tu revisión.
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (storageKey) localStorage.setItem(storageKey, "true");
              setShow(false);
              navigate("/reports");
            }}
          >
            Ir a Reportes y Métricas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShow(false)}>
            Ver más tarde
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PendingReviewAlert;
