import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  companyId: string;
}

/**
 * Worker-facing GDPR data export button (art. 15 RGPD — derecho de acceso).
 *
 * Generates a JSON file with all the personal data the company holds about
 * the worker: profile, work sessions, time events (with location), absences,
 * approved adjustments, correction requests and notifications. Machine
 * readable per art. 20 (portabilidad).
 */
export function MyDataExport({ userId, companyId }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    const t = toast.loading("Recopilando tus datos…");
    try {
      // Run all queries in parallel — each one is RLS-protected to the user's
      // own rows so the worker can only read their own data.
      const [
        profileRes,
        sessionsRes,
        eventsRes,
        absencesRes,
        approvedRes,
        requestsRes,
        notificationsRes,
        membershipRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("work_sessions")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("clock_in_time", { ascending: false }),
        supabase
          .from("time_events")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("event_time", { ascending: false }),
        supabase
          .from("absences")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("start_date", { ascending: false }),
        supabase
          .from("approved_absences")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("date", { ascending: false }),
        supabase
          .from("correction_requests")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("memberships")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId),
      ]);

      const dump = {
        meta: {
          generated_at: new Date().toISOString(),
          user_id: userId,
          company_id: companyId,
          legal_basis:
            "Art. 15 RGPD (derecho de acceso) y art. 20 RGPD (portabilidad). Datos exportados por el propio interesado desde GTIQ.",
          notes:
            "Este archivo contiene TODOS los datos personales que GTIQ almacena sobre ti en esta empresa, incluidas coordenadas GPS de fichajes si las autorizaste en su día.",
        },
        profile: profileRes.data || null,
        membership: membershipRes.data || [],
        work_sessions: sessionsRes.data || [],
        time_events: eventsRes.data || [],
        absences: absencesRes.data || [],
        approved_absences: approvedRes.data || [],
        correction_requests: requestsRes.data || [],
        notifications: notificationsRes.data || [],
      };

      const json = JSON.stringify(dump, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `mis-datos-gtiq-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Tus datos han sido descargados", { id: t });
    } catch (err: any) {
      console.error("MyDataExport error:", err);
      toast.error(err?.message || "No se pudieron exportar los datos", { id: t });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Mis datos personales (RGPD)</p>
          <p className="text-xs text-muted-foreground">
            Descarga todos los datos que esta empresa almacena sobre ti
            (perfil, fichajes, ausencias, ubicaciones). Derecho garantizado
            por el art. 15 del RGPD.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="gap-2 shrink-0"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exporting ? "Generando…" : "Exportar mis datos"}
        </Button>
      </div>
    </Card>
  );
}

export default MyDataExport;
