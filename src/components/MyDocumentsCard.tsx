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
  FolderOpen,
  Download,
  FileText,
  PenLine,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  companyId: string;
}

interface DocRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  document_date: string | null;
  expires_at: string | null;
  // Discriminator
  __kind: "doc";
}

interface SignatureRow {
  id: string;
  document_type: string;
  document_title: string;
  document_html: string;
  document_hash: string;
  signature_image: string;
  signed_at: string;
  // Discriminator
  __kind: "signature";
}

type Item = DocRow | SignatureRow;

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contrato",
  addendum: "Anexo",
  training: "Formación",
  medical: "Médico",
  prl: "PRL",
  rgpd: "RGPD",
  id_document: "DNI / NIE",
  other: "Otro",
};

const CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 border-blue-300",
  addendum: "bg-cyan-100 text-cyan-700 border-cyan-300",
  training: "bg-purple-100 text-purple-700 border-purple-300",
  medical: "bg-rose-100 text-rose-700 border-rose-300",
  prl: "bg-amber-100 text-amber-700 border-amber-300",
  rgpd: "bg-slate-100 text-slate-700 border-slate-300",
  id_document: "bg-indigo-100 text-indigo-700 border-indigo-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtSize = (bytes: number | null): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MyDocumentsCard({ userId, companyId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<SignatureRow | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !userId) return;
    setLoading(true);
    try {
      const [docsRes, sigsRes] = await Promise.all([
        supabase
          .from("employee_documents")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("worker_signed_acceptances")
          .select("id, document_type, document_title, document_html, document_hash, signature_image, signed_at")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .order("signed_at", { ascending: false }),
      ]);

      const docs: DocRow[] = ((docsRes.data as any[]) || []).map((d) => ({ ...d, __kind: "doc" as const }));
      const sigs: SignatureRow[] = ((sigsRes.data as any[]) || []).map((s) => ({ ...s, __kind: "signature" as const }));

      // Mezclar y ordenar por fecha (uploaded_at o signed_at) descendente
      const merged: Item[] = [...docs, ...sigs].sort((a, b) => {
        const dateA = a.__kind === "doc" ? a.uploaded_at : a.signed_at;
        const dateB = b.__kind === "doc" ? b.uploaded_at : b.signed_at;
        return dateB.localeCompare(dateA);
      });
      setItems(merged);
    } catch (err: any) {
      console.error("MyDocuments load error:", err);
      toast.error("No se pudieron cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownloadDoc = async (doc: DocRow) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("No se pudo generar el enlace");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo descargar");
    }
  };

  const handleDownloadSignature = (sig: SignatureRow) => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${sig.document_title}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
  h1 { font-size: 18px; }
  .meta { background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 12px; line-height: 1.6; }
  .signature { border: 1px solid #d1d5db; padding: 16px; margin-top: 24px; border-radius: 8px; }
  .hash { font-family: monospace; font-size: 10px; word-break: break-all; }
</style></head><body>
<h1>${sig.document_title}</h1>
<div class="meta">
  <strong>Firmado el:</strong> ${fmtDate(sig.signed_at)}<br/>
  <strong>Hash SHA-256:</strong> <span class="hash">${sig.document_hash}</span>
</div>
<div>${sig.document_html}</div>
<div class="signature">
  <p><strong>Mi firma:</strong></p>
  <img src="${sig.signature_image}" alt="Firma" style="max-width: 320px;" />
</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firma-${sig.document_type}-${sig.signed_at.slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Mis documentos y firmas</h3>
            <p className="text-xs text-muted-foreground">
              Documentos que la empresa te ha entregado y los que tú has firmado
              digitalmente.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Aún no hay nada guardado.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              if (item.__kind === "doc") {
                return (
                  <div
                    key={`doc-${item.id}`}
                    className="border rounded-md p-3 flex items-start gap-3 hover:bg-muted/30"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${CATEGORY_COLORS[item.category] || ""}`}
                        >
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                        <p className="font-medium text-sm truncate">{item.title}</p>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>{item.file_name}</span>
                        <span>{fmtSize(item.file_size)}</span>
                        <span>Subido {fmtDate(item.uploaded_at)}</span>
                        {item.document_date && <span>Fecha doc: {fmtDate(item.document_date)}</span>}
                        {item.expires_at && (
                          <span className="text-amber-600">Caduca: {fmtDate(item.expires_at)}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadDoc(item)} title="Descargar">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                );
              } else {
                return (
                  <div
                    key={`sig-${item.id}`}
                    className="border rounded-md p-3 flex items-start gap-3 hover:bg-muted/30 bg-emerald-50/40"
                  >
                    <PenLine className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300"
                        >
                          Firma digital
                        </Badge>
                        <p className="font-medium text-sm truncate">{item.document_title}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>Firmado {fmtDate(item.signed_at)}</span>
                        <span className="font-mono">SHA-256: {item.document_hash.slice(0, 12)}…</span>
                      </div>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(item)} title="Ver">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadSignature(item)} title="Descargar">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              }
            })}
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
                  Firmado el {fmtDate(viewing.signed_at)}
                </DialogDescription>
              </DialogHeader>
              <div
                className="prose prose-sm max-w-none border rounded p-4 bg-muted/20"
                dangerouslySetInnerHTML={{ __html: viewing.document_html }}
              />
              <div className="border rounded p-3 bg-white space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Tu firma:</p>
                <img src={viewing.signature_image} alt="Firma" className="max-h-32 border rounded" />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                SHA-256: {viewing.document_hash}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MyDocumentsCard;
