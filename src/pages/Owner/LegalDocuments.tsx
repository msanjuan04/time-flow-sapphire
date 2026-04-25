import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Download, Eye, AlertTriangle, Loader2 } from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import { LEGAL_DOCS } from "@/legal/registry";
import { PROVIDER_INFO } from "@/legal/providerInfo";
import type { CompanyLegalData, LegalDoc, LegalDocContext } from "@/legal/types";

const REQUIRED_FIELDS: (keyof CompanyLegalData)[] = [
  "legal_name",
  "tax_id",
  "legal_address",
  "legal_representative_name",
  "legal_representative_id",
];

const LegalDocuments = () => {
  const navigate = useNavigate();
  const { companyId } = useMembership();
  const [company, setCompany] = useState<CompanyLegalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<LegalDoc | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const fetchCompany = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("companies")
          .select(
            "id, name, legal_name, tax_id, legal_address, legal_representative_name, legal_representative_id, contact_email"
          )
          .eq("id", companyId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setCompany((data as any) ?? null);
      } catch (err) {
        console.error("Error fetching company legal data:", err);
        if (!cancelled) toast.error("No pudimos cargar los datos de la empresa");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchCompany();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const missingFields = useMemo(() => {
    if (!company) return REQUIRED_FIELDS;
    return REQUIRED_FIELDS.filter((f) => !company[f] || String(company[f]).trim() === "");
  }, [company]);

  const isLegalComplete = missingFields.length === 0;

  const ctx: LegalDocContext | null = useMemo(() => {
    if (!company) return null;
    return {
      provider: PROVIDER_INFO,
      company,
      todayLabel: new Date().toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [company]);

  const canDownload = (doc: LegalDoc) =>
    doc.requiresCompanyLegal ? isLegalComplete : true;

  const handlePreview = (doc: LegalDoc) => {
    if (!canDownload(doc)) {
      toast.error("Completa los datos legales de la empresa primero");
      return;
    }
    setPreviewDoc(doc);
  };

  const handleDownload = async () => {
    if (!previewDoc || !previewRef.current) return;
    setGenerating(true);
    try {
      const fileBase = previewDoc.id;
      const companySlug = (company?.legal_name || company?.name || "empresa")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      await html2pdf()
        .set({
          margin: 0,
          filename: `${fileBase}__${companySlug}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(previewRef.current)
        .save();
      toast.success("PDF descargado");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("No pudimos generar el PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pt-4 sm:pt-8 space-y-4 sm:space-y-6">
        <PageHeader
          icon={FileText}
          title="Documentos legales"
          description="Plantillas para cumplir con el registro horario (RD-Ley 8/2019) y el RGPD."
        />

        {!loading && !isLegalComplete && (
          <Card className="p-4 border-amber-300 bg-amber-50 text-amber-900 flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm space-y-2">
              <p className="font-medium">
                Faltan datos legales de la empresa para generar la mayoría de
                documentos.
              </p>
              <p>
                Campos pendientes:{" "}
                {missingFields
                  .map((f) =>
                    f === "legal_name"
                      ? "razón social"
                      : f === "tax_id"
                        ? "CIF/NIF"
                        : f === "legal_address"
                          ? "dirección fiscal"
                          : f === "legal_representative_name"
                            ? "representante legal"
                            : "DNI del representante"
                  )
                  .join(", ")}
                .
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/company-settings")}
              >
                Ir a Ajustes de empresa
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-4 border-blue-200 bg-blue-50 text-blue-900 text-sm">
          <strong>Aviso:</strong> estas plantillas son orientativas, redactadas con
          base en la normativa vigente (RGPD, LOPDGDD, RD-Ley 8/2019). Antes de
          firmarlas o publicarlas a tu plantilla revisa el contenido con tu asesor
          laboral o jurídico. {PROVIDER_INFO.brand} actúa como encargado del
          tratamiento de los datos.
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LEGAL_DOCS.map((doc) => {
            const blocked = !canDownload(doc);
            return (
              <Card key={doc.id} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{doc.title}</h3>
                      {doc.requiresCompanyLegal && (
                        <Badge variant="outline" className="text-[10px]">
                          requiere datos legales
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.description}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(doc)}
                    disabled={blocked || loading}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Vista previa
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
          </DialogHeader>

          {previewDoc && ctx && (
            <div ref={previewRef} className="bg-white rounded-md border">
              <previewDoc.Component ctx={ctx} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              Cerrar
            </Button>
            <Button onClick={handleDownload} disabled={generating}>
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default LegalDocuments;
