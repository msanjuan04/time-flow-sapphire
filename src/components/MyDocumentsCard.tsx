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
import html2pdf from "html2pdf.js";
import { buildSignedAcceptancePdfHtml } from "@/lib/pdfTemplates";

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

  const handleDownloadSignature = async (sig: SignatureRow) => {
    const t = toast.loading("Generando PDF…");
    try {
      // Resolver datos del firmante para enriquecer el PDF
      const [profileRes, companyRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, dni")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
      ]);
      const profile = (profileRes.data || {}) as any;
      const company = (companyRes.data || {}) as any;

      const html = buildSignedAcceptancePdfHtml({
        companyName: company?.name || "Empresa",
        fullName: profile?.full_name || profile?.email || "Trabajador",
        dni: profile?.dni ?? null,
        documentTitle: sig.document_title,
        documentHtml: sig.document_html,
        signatureImage: sig.signature_image,
        signedAt: sig.signed_at,
        documentHash: sig.document_hash,
      });

      const filename = `firma-${sig.document_type}-${sig.signed_at.slice(0, 10)}.pdf`;
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

      toast.success("PDF descargado", { id: t });
    } catch (err: any) {
      console.error("Signature PDF error:", err);
      toast.error(err?.message || "No se pudo generar el PDF", { id: t });
    }
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
