import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LegalInfo {
  legal_name: string;
  tax_id: string;
  legal_address: string;
  legal_representative_name: string;
  legal_representative_id: string;
  contact_email: string;
}

const EMPTY: LegalInfo = {
  legal_name: "",
  tax_id: "",
  legal_address: "",
  legal_representative_name: "",
  legal_representative_id: "",
  contact_email: "",
};

interface Props {
  companyId: string;
  canEdit: boolean;
}

const CompanyLegalInfoCard = ({ companyId, canEdit }: Props) => {
  const [info, setInfo] = useState<LegalInfo>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("companies")
          .select(
            "legal_name, tax_id, legal_address, legal_representative_name, legal_representative_id, contact_email"
          )
          .eq("id", companyId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setInfo({
          legal_name: (data as any)?.legal_name ?? "",
          tax_id: (data as any)?.tax_id ?? "",
          legal_address: (data as any)?.legal_address ?? "",
          legal_representative_name: (data as any)?.legal_representative_name ?? "",
          legal_representative_id: (data as any)?.legal_representative_id ?? "",
          contact_email: (data as any)?.contact_email ?? "",
        });
      } catch (err) {
        console.error("Error loading legal info:", err);
        if (!cancelled) toast.error("No pudimos cargar los datos legales");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchInfo();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        legal_name: info.legal_name.trim() || null,
        tax_id: info.tax_id.trim() || null,
        legal_address: info.legal_address.trim() || null,
        legal_representative_name: info.legal_representative_name.trim() || null,
        legal_representative_id: info.legal_representative_id.trim() || null,
        contact_email: info.contact_email.trim() || null,
      };
      const { error } = await supabase
        .from("companies")
        .update(payload as any)
        .eq("id", companyId);
      if (error) throw error;
      toast.success("Datos legales guardados");
    } catch (err) {
      console.error("Error saving legal info:", err);
      toast.error("Error al guardar los datos legales");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof LegalInfo, value: string) =>
    setInfo((prev) => ({ ...prev, [key]: value }));

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Datos legales de la empresa</h2>
          <p className="text-sm text-muted-foreground">
            Necesarios para generar contratos, política de privacidad y documentación
            obligatoria del registro horario (RD-Ley 8/2019 y RGPD). Si los dejas vacíos
            la documentación legal no podrá generarse.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_name">Razón social / Nombre legal</Label>
              <Input
                id="legal_name"
                value={info.legal_name}
                onChange={(e) => update("legal_name", e.target.value)}
                disabled={!canEdit}
                placeholder="p. ej. Restauración Fulanito S.L."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">CIF / NIF</Label>
              <Input
                id="tax_id"
                value={info.tax_id}
                onChange={(e) => update("tax_id", e.target.value)}
                disabled={!canEdit}
                placeholder="B12345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal_address">Dirección fiscal</Label>
            <Textarea
              id="legal_address"
              value={info.legal_address}
              onChange={(e) => update("legal_address", e.target.value)}
              disabled={!canEdit}
              placeholder="C/ Ejemplo 123, 08001 Barcelona"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_representative_name">Representante legal</Label>
              <Input
                id="legal_representative_name"
                value={info.legal_representative_name}
                onChange={(e) => update("legal_representative_name", e.target.value)}
                disabled={!canEdit}
                placeholder="Nombre y apellidos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_representative_id">DNI/NIE del representante</Label>
              <Input
                id="legal_representative_id"
                value={info.legal_representative_id}
                onChange={(e) => update("legal_representative_id", e.target.value)}
                disabled={!canEdit}
                placeholder="00000000A"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Email de contacto (RGPD / DPO)</Label>
            <Input
              id="contact_email"
              type="email"
              value={info.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
              disabled={!canEdit}
              placeholder="rrhh@empresa.com"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar datos legales
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default CompanyLegalInfoCard;
