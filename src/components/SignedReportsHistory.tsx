import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { buildVerifyUrl } from "@/lib/signedReport";

interface SignedReportRow {
  id: string;
  generated_at: string;
  generated_by_email: string | null;
  report_type: string;
  scope: string;
  user_id: string | null;
  period_start: string;
  period_end: string;
  content_hash: string;
  verification_token: string;
}

interface Props {
  companyId: string;
}

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

export function SignedReportsHistory({ companyId }: Props) {
  const [rows, setRows] = useState<SignedReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("signed_reports")
        .select(
          "id, generated_at, generated_by_email, report_type, scope, user_id, period_start, period_end, content_hash, verification_token"
        )
        .eq("company_id", companyId)
        .order("generated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data as SignedReportRow[]) || []);
    } catch (err: any) {
      console.error("Error cargando informes firmados:", err);
      toast.error("No se pudo cargar el historial de informes firmados");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-semibold">Informes certificados emitidos</h3>
            <p className="text-xs text-muted-foreground">
              Historial completo. Cada informe es verificable públicamente.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refrescar
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6">
          Aún no se ha generado ningún informe certificado.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Generado</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Periodo</th>
                <th className="py-2 pr-3 font-medium">Por</th>
                <th className="py-2 pr-3 font-medium">Hash</th>
                <th className="py-2 pr-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const verifyUrl = buildVerifyUrl(r.verification_token);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.generated_at)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[10px]">
                        {r.report_type}
                      </Badge>
                      {r.scope === "user" && (
                        <Badge variant="secondary" className="text-[10px] ml-1">
                          individual
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs">
                      {r.period_start} → {r.period_end}
                    </td>
                    <td className="py-2 pr-3 text-xs">{r.generated_by_email || "—"}</td>
                    <td className="py-2 pr-3">
                      <code
                        title={r.content_hash}
                        className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded"
                      >
                        {r.content_hash.slice(0, 10)}…
                      </code>
                    </td>
                    <td className="py-2 pr-0 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(verifyUrl, "Enlace de verificación")}
                        title="Copiar enlace"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(verifyUrl, "_blank", "noopener")}
                        title="Abrir página de verificación"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default SignedReportsHistory;
