import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";
import { buildRgpdExportHtml } from "@/lib/pdfTemplates";

interface Props {
  userId: string;
  companyId: string;
}

export function MyDataExport({ userId, companyId }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    const t = toast.loading("Recopilando tus datos…");
    try {
      const [
        profileRes,
        sessionsRes,
        eventsRes,
        absencesRes,
        approvedRes,
        requestsRes,
        notificationsRes,
        companyRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
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
        supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
      ]);

      const profile = (profileRes.data || {}) as any;
      const html = buildRgpdExportHtml({
        generatedAt: new Date().toISOString(),
        companyName: (companyRes.data as any)?.name || "Empresa",
        worker: {
          fullName: profile?.full_name || profile?.email || "Trabajador",
          email: profile?.email || "—",
          dni: profile?.dni ?? null,
          phone: profile?.phone ?? null,
          hireDate: profile?.hire_date ?? null,
        },
        workSessions: sessionsRes.data || [],
        timeEvents: eventsRes.data || [],
        absences: absencesRes.data || [],
        approvedAbsences: approvedRes.data || [],
        correctionRequests: requestsRes.data || [],
        notifications: notificationsRes.data || [],
      });

      const today = new Date().toISOString().slice(0, 10);
      const filename = `mis-datos-gtiq-${today}.pdf`;

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(html)
        .save();

      toast.success("Tus datos se han descargado en PDF", { id: t });
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
            Descarga en PDF todos los datos que esta empresa almacena sobre ti
            (perfil, fichajes, ausencias, ubicaciones). Derecho garantizado por
            el art. 15 del RGPD.
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
