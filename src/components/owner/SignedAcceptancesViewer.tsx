import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  FileText,
  Eye,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Acceptance {
  id: string;
  user_id: string;
  document_type: string;
  document_title: string;
  document_html: string;
  document_hash: string;
  signature_image: string;
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  full_name_snapshot: string | null;
  dni_snapshot: string | null;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  companyId: string;
}

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

export function SignedAcceptancesViewer({ companyId }: Props) {
  const [rows, setRows] = useState<Acceptance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Acceptance | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("worker_signed_acceptances")
        .select("*")
        .eq("company_id", companyId)
        .order("signed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const records = (data as Acceptance[]) || [];
      setRows(records);

      const userIds = Array.from(new Set(records.map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const map: Record<string, ProfileLite> = {};
        for (const p of (ps as ProfileLite[]) || []) map[p.id] = p;
        setProfiles(map);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudieron cargar las firmas");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadAsHtml = (a: Acceptance) => {
    const profile = profiles[a.user_id];
    const fullName = a.full_name_snapshot || profile?.full_name || profile?.email || "—";
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${a.document_title}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
  h1 { font-size: 18px; }
  .meta { background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 12px; line-height: 1.6; }
  .signature { border: 1px solid #d1d5db; padding: 16px; margin-top: 24px; border-radius: 8px; }
  .hash { font-family: monospace; font-size: 10px; word-break: break-all; }
</style></head><body>
<h1>${a.document_title}</h1>
<div class="meta">
  <strong>Trabajador/a:</strong> ${fullName}<br/>
  ${a.dni_snapshot ? `<strong>DNI:</strong> ${a.dni_snapshot}<br/>` : ""}
  <strong>Firmado el:</strong> ${fmt(a.signed_at)}<br/>
  ${a.geo_lat ? `<strong>Ubicación:</strong> ${a.geo_lat}, ${a.geo_lng}<br/>` : ""}
  <strong>Hash SHA-256:</strong> <span class="hash">${a.document_hash}</span>
</div>
<div>${a.document_html}</div>
<div class="signature">
  <p><strong>Firma del trabajador/a:</strong></p>
  <img src="${a.signature_image}" alt="Firma" style="max-width: 320px;" />
</div>
<p style="margin-top:32px; font-size: 11px; color: #6b7280;">
  Documento generado por GTIQ. La autenticidad se verifica recalculando el
  hash SHA-256 del contenido y comparándolo con el registrado en la base de
  datos en el momento de la firma.
</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = `firma-${a.document_type}-${a.signed_at.slice(0, 10)}.html`;
    a2.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-semibold">Aceptaciones firmadas por trabajadores</h3>
            <p className="text-xs text-muted-foreground">
              Documentos legales firmados digitalmente al alta. Inmutables y
              accesibles 4 años (RGPD + RD-Ley 8/2019).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Aún no hay firmas registradas. Cuando los trabajadores entren al
            sistema por primera vez, deberán firmar antes de poder fichar.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Trabajador</th>
                  <th className="py-2 pr-3 font-medium">Documento</th>
                  <th className="py-2 pr-3 font-medium">Fecha firma</th>
                  <th className="py-2 pr-3 font-medium">Hash</th>
                  <th className="py-2 pr-0 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = profiles[r.user_id];
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <div className="font-medium">
                          {r.full_name_snapshot || p?.full_name || p?.email || "—"}
                        </div>
                        {r.dni_snapshot && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            DNI {r.dni_snapshot}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-[10px]">
                          <FileText className="w-3 h-3 mr-1" />
                          {r.document_title}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs">
                        {fmt(r.signed_at)}
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded" title={r.document_hash}>
                          {r.document_hash.slice(0, 10)}…
                        </code>
                      </td>
                      <td className="py-2 pr-0 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => setViewing(r)} title="Ver firma">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadAsHtml(r)} title="Descargar HTML">
                          <Download className="w-3.5 h-3.5" />
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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.document_title}</DialogTitle>
                <DialogDescription>
                  Firmado por{" "}
                  {viewing.full_name_snapshot ||
                    profiles[viewing.user_id]?.full_name ||
                    profiles[viewing.user_id]?.email}{" "}
                  el {fmt(viewing.signed_at)}
                </DialogDescription>
              </DialogHeader>
              <div
                className="prose prose-sm max-w-none border rounded p-4 bg-muted/20"
                dangerouslySetInnerHTML={{ __html: viewing.document_html }}
              />
              <div className="border rounded p-3 bg-white space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Firma:</p>
                <img
                  src={viewing.signature_image}
                  alt="Firma"
                  className="max-h-32 border rounded"
                />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground space-y-1">
                <div>SHA-256: {viewing.document_hash}</div>
                {viewing.geo_lat && (
                  <div>
                    Geo: {viewing.geo_lat}, {viewing.geo_lng}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SignedAcceptancesViewer;
