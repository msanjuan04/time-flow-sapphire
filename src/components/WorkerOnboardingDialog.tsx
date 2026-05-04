import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/SignaturePad";

interface Props {
  userId: string;
  companyId: string;
  /** Worker name + DNI snapshots — useful for legal traceability */
  fullName?: string | null;
  dni?: string | null;
  /** Called once the worker has completed all required acceptances */
  onCompleted?: () => void;
}

interface DocumentDef {
  type: string;
  title: string;
  html: string;
}

const buildDocuments = (companyName: string, fullName: string): DocumentDef[] => {
  const today = new Date().toLocaleDateString("es-ES");
  return [
    {
      type: "registro_horario_info",
      title: "Información sobre el sistema de registro horario",
      html: `
        <h2>Información sobre el sistema de registro horario</h2>
        <p><strong>Empresa:</strong> ${companyName}</p>
        <p><strong>Trabajador/a:</strong> ${fullName}</p>
        <p><strong>Fecha:</strong> ${today}</p>
        <p>Conforme al Real Decreto-ley 8/2019 y el artículo 34.9 del Estatuto
        de los Trabajadores, esta empresa dispone de un sistema de control horario
        digital (GTIQ).</p>
        <h3>Mediante esta firma reconozco:</h3>
        <ul>
          <li>Haber sido informado/a del sistema de fichaje y de mi obligación de utilizarlo
          al iniciar y finalizar mi jornada laboral.</li>
          <li>Que mi código personal de fichaje y/o tarjeta NFC son personales e
          intransferibles.</li>
          <li>Que ceder mi código a un compañero o permitir que otra persona fiche
          por mí constituye <strong>falsificación documental</strong> (art. 392 del
          Código Penal) y motivo de <strong>despido disciplinario procedente</strong>.</li>
          <li>Que tengo derecho a acceder a mis propios datos de fichaje en cualquier
          momento (art. 15 RGPD), incluyendo descarga de mi historial completo.</li>
          <li>Que la empresa conservará los registros durante 4 años conforme a la
          normativa vigente.</li>
        </ul>
      `,
    },
    {
      type: "rgpd_clause",
      title: "Cláusula informativa de protección de datos (RGPD)",
      html: `
        <h2>Cláusula informativa de protección de datos</h2>
        <p>De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica
        3/2018 de Protección de Datos Personales y Garantía de Derechos Digitales,
        se le informa de:</p>
        <ul>
          <li><strong>Responsable del tratamiento:</strong> ${companyName}.</li>
          <li><strong>Finalidad:</strong> gestión laboral, registro horario, control
          de presencia, gestión de vacaciones y permisos, y emisión de certificados
          frente a Inspección de Trabajo.</li>
          <li><strong>Base jurídica:</strong> ejecución del contrato laboral y
          obligación legal (RD-Ley 8/2019).</li>
          <li><strong>Destinatarios:</strong> los datos no se ceden a terceros salvo
          obligación legal o requerimiento judicial. El proveedor tecnológico GTIQ
          (encargado del tratamiento) accede a los datos exclusivamente para
          prestar el servicio.</li>
          <li><strong>Conservación:</strong> 4 años desde el cese de la relación
          laboral (plazo legal de prescripción).</li>
          <li><strong>Derechos:</strong> puede ejercer los derechos de acceso,
          rectificación, supresión, limitación, portabilidad y oposición desde su
          panel personal o solicitándolo a la empresa por escrito.</li>
        </ul>
        <p>Mediante esta firma manifiesto haber recibido y comprendido esta
        información.</p>
      `,
    },
  ];
};

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getClientGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const t = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  });
}

export function WorkerOnboardingDialog({
  userId,
  companyId,
  fullName,
  dni,
  onCompleted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [pendingDocs, setPendingDocs] = useState<DocumentDef[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    if (!userId || !companyId) return;
    setLoading(true);
    try {
      // Cargar nombre de la empresa
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();
      const cName = (company as any)?.name || "Empresa";
      setCompanyName(cName);

      // Cargar aceptaciones ya firmadas
      const { data: existing } = await supabase
        .from("worker_signed_acceptances")
        .select("document_type")
        .eq("user_id", userId)
        .eq("company_id", companyId);
      const signedTypes = new Set((existing || []).map((r: any) => r.document_type));

      const allDocs = buildDocuments(cName, fullName || "Trabajador");
      const pending = allDocs.filter((d) => !signedTypes.has(d.type));
      setPendingDocs(pending);
      setCurrentIndex(0);
      setOpen(pending.length > 0);
    } catch (err) {
      console.error("WorkerOnboarding error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, companyId, fullName]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSign = async () => {
    if (!signature) {
      toast.error("Debes firmar antes de continuar");
      return;
    }
    setSubmitting(true);
    const t = toast.loading("Registrando firma…");
    try {
      const doc = pendingDocs[currentIndex];
      const hash = await sha256Hex(doc.html);
      const geo = await getClientGeo();

      const { error } = await supabase
        .from("worker_signed_acceptances")
        .insert({
          company_id: companyId,
          user_id: userId,
          document_type: doc.type,
          document_title: doc.title,
          document_html: doc.html,
          document_hash: hash,
          signature_image: signature,
          ip: null, // se puede capturar server-side via edge function si se necesita
          user_agent: navigator.userAgent,
          geo_lat: geo?.lat ?? null,
          geo_lng: geo?.lng ?? null,
          full_name_snapshot: fullName ?? null,
          dni_snapshot: dni ?? null,
        } as any);

      if (error) throw error;

      toast.success("Documento firmado correctamente", { id: t });

      // Pasar al siguiente
      const nextIndex = currentIndex + 1;
      if (nextIndex < pendingDocs.length) {
        setCurrentIndex(nextIndex);
        setSignature(null);
      } else {
        // Marcamos onboarding como completado
        await supabase
          .from("profiles")
          .update({ onboarding_completed_at: new Date().toISOString() } as any)
          .eq("id", userId);
        setOpen(false);
        onCompleted?.();
        toast.success("Onboarding completado. Ya puedes empezar a fichar.");
      }
    } catch (err: any) {
      console.error("WorkerOnboarding sign error:", err);
      toast.error(err?.message || "No se pudo registrar la firma", { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || pendingDocs.length === 0) return null;
  const current = pendingDocs[currentIndex];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* No cerrable: el trabajador debe firmar */ }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Bienvenido — completar alta
          </DialogTitle>
          <DialogDescription>
            Documento {currentIndex + 1} de {pendingDocs.length}: lee y firma para
            poder empezar a fichar.
          </DialogDescription>
        </DialogHeader>

        <Card className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none bg-muted/20">
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="text-xs">{current.title}</span>
          </div>
          <div dangerouslySetInnerHTML={{ __html: current.html }} />
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-medium">Tu firma:</p>
          <SignaturePad onChange={setSignature} disabled={submitting} />
        </div>

        <DialogFooter>
          <Button
            onClick={handleSign}
            disabled={!signature || submitting}
            className="gap-2 w-full sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {submitting
              ? "Firmando…"
              : currentIndex < pendingDocs.length - 1
                ? "Firmar y siguiente"
                : "Firmar y completar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkerOnboardingDialog;
