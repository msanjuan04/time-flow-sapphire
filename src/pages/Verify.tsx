import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Building2,
  Calendar,
  User,
  FileText,
  ExternalLink,
} from "lucide-react";

interface VerifyResponse {
  valid: boolean;
  error?: string;
  id?: string;
  company_name?: string;
  company_tax_id?: string;
  generated_by_email?: string;
  generated_at?: string;
  report_type?: string;
  scope?: string;
  period_start?: string;
  period_end?: string;
  content_hash?: string;
  signature?: string;
  payload?: any;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

const fmtDay = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setNetworkError("Falta el token en la URL");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/verify-report?token=${encodeURIComponent(
          token
        )}`;
        const res = await fetch(url, { method: "GET" });
        const json = (await res.json()) as VerifyResponse;
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setNetworkError(err?.message || "Error de red");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>GTIQ — Verificación de informe</span>
          </Link>
          <Badge variant="outline" className="text-xs">
            Verificación pública
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {loading && (
          <Card className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Verificando firma del informe…</p>
          </Card>
        )}

        {!loading && networkError && (
          <Card className="p-8 text-center space-y-3 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <ShieldAlert className="w-10 h-10 mx-auto text-amber-600" />
            <h2 className="text-lg font-semibold">No pudimos contactar con el servidor</h2>
            <p className="text-sm text-muted-foreground">{networkError}</p>
          </Card>
        )}

        {!loading && data && !data.valid && (
          <Card className="p-8 text-center space-y-3 border-red-300 bg-red-50 dark:bg-red-950/30">
            <ShieldAlert className="w-12 h-12 mx-auto text-red-600" />
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">
              Informe NO válido
            </h2>
            <p className="text-sm text-red-700/80 dark:text-red-300/80">
              {data.error === "not_found"
                ? "No se ha encontrado ningún informe firmado con este token. Puede haber sido eliminado o el enlace es incorrecto."
                : data.error === "missing_token"
                  ? "El enlace de verificación es incorrecto."
                  : "El contenido del informe no coincide con la firma almacenada. El documento ha podido ser modificado."}
            </p>
            {data.error && (
              <div className="text-[11px] font-mono text-red-700/60 mt-3">
                error: {data.error}
              </div>
            )}
          </Card>
        )}

        {!loading && data && data.valid && (
          <>
            <Card className="p-8 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 space-y-2 text-center">
              <ShieldCheck className="w-14 h-14 mx-auto text-emerald-600" />
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                Informe válido y auténtico
              </h2>
              <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 max-w-xl mx-auto">
                La firma criptográfica HMAC-SHA256 coincide con el contenido
                almacenado en GTIQ. El informe no ha sido modificado desde su
                emisión.
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Datos del informe</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <Field
                  icon={<Building2 className="w-4 h-4" />}
                  label="Empresa"
                  value={data.company_name || "—"}
                  sub={data.company_tax_id ? `CIF/NIF: ${data.company_tax_id}` : undefined}
                />
                <Field
                  icon={<FileText className="w-4 h-4" />}
                  label="Tipo de informe"
                  value={data.report_type || "—"}
                  sub={
                    data.scope === "user"
                      ? "Ámbito: empleado individual"
                      : "Ámbito: empresa completa"
                  }
                />
                <Field
                  icon={<Calendar className="w-4 h-4" />}
                  label="Periodo"
                  value={`${fmtDay(data.period_start)} → ${fmtDay(data.period_end)}`}
                />
                <Field
                  icon={<User className="w-4 h-4" />}
                  label="Generado por"
                  value={data.generated_by_email || "—"}
                  sub={`el ${fmtDate(data.generated_at)}`}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-3">
              <h3 className="font-semibold text-lg">Huella criptográfica</h3>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="text-muted-foreground mb-1">SHA-256 del contenido</div>
                  <div className="break-all bg-muted p-2 rounded border">
                    {data.content_hash}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Firma HMAC-SHA256</div>
                  <div className="break-all bg-muted p-2 rounded border">
                    {data.signature}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Token de verificación</div>
                  <div className="break-all bg-muted p-2 rounded border">{token}</div>
                </div>
              </div>
            </Card>

            {data.payload && (
              <Card className="p-6 space-y-3">
                <h3 className="font-semibold text-lg">Contenido firmado</h3>
                <p className="text-xs text-muted-foreground">
                  Datos exactos sobre los que se calculó el hash. Cualquier
                  modificación posterior cambiaría la firma.
                </p>
                <pre className="text-[11px] font-mono bg-muted p-3 rounded border overflow-x-auto max-h-96">
                  {JSON.stringify(data.payload, null, 2)}
                </pre>
              </Card>
            )}

            <Card className="p-6 bg-muted/30 text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">¿Qué significa esta verificación?</strong>{" "}
                GTIQ firma cada informe certificado con una clave secreta
                mediante HMAC-SHA256. Esta página recalcula el hash del
                contenido y comprueba que la firma sigue siendo válida. Si
                alguien hubiera modificado el documento PDF tras su emisión,
                aquí verías "Informe NO válido".
              </p>
              <p className="pt-2">
                Esta verificación tiene validez como prueba documental para
                Inspección de Trabajo conforme al art. 34.9 del Estatuto de los
                Trabajadores y al RD-Ley 8/2019.
              </p>
            </Card>
          </>
        )}

        <div className="text-center pt-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              Volver a GTIQ
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
