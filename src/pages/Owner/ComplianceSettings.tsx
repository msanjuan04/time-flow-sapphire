import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getComplianceSettings, updateComplianceSettings, ComplianceSettings } from "@/lib/compliance";

interface FormState {
  max_week_hours: string;
  max_month_hours: string;
  min_hours_between_shifts: string;
  allowed_checkin_start: string;
  allowed_checkin_end: string;
}

const toFormState = (settings: ComplianceSettings | null): FormState => ({
  max_week_hours: settings?.max_week_hours?.toString() ?? "",
  max_month_hours: settings?.max_month_hours?.toString() ?? "",
  min_hours_between_shifts: settings?.min_hours_between_shifts?.toString() ?? "",
  allowed_checkin_start: settings?.allowed_checkin_start?.slice(0, 5) ?? "",
  allowed_checkin_end: settings?.allowed_checkin_end?.slice(0, 5) ?? "",
});

const normalizeNumber = (value: string) => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const OwnerComplianceSettings = () => {
  const { company, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(null));

  useEffect(() => {
    const load = async () => {
      if (!company?.id) return;
      setLoading(true);
      try {
        const current = await getComplianceSettings(company.id);
        setForm(toFormState(current));
      } catch (err) {
        console.error("[compliance] load error", err);
        toast({
          title: "No se pudieron cargar los ajustes",
          description: "Revisa tu conexión o permisos.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [company?.id, toast]);

  const handleChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    try {
      await updateComplianceSettings(company.id, {
        max_week_hours: normalizeNumber(form.max_week_hours),
        max_month_hours: normalizeNumber(form.max_month_hours),
        min_hours_between_shifts: normalizeNumber(form.min_hours_between_shifts),
        allowed_checkin_start: form.allowed_checkin_start ? `${form.allowed_checkin_start}:00` : null,
        allowed_checkin_end: form.allowed_checkin_end ? `${form.allowed_checkin_end}:00` : null,
      });
      toast({ title: "Cambios guardados", description: "Las restricciones legales se han actualizado." });
    } catch (err) {
      console.error("[compliance] save error", err);
      toast({
        title: "No se pudieron guardar los cambios",
        description: "Revisa los datos e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user?.id || !company?.id) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Owner Compliance Settings</CardTitle>
            <CardDescription>Debes seleccionar una empresa para configurar.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Owner Compliance Settings</CardTitle>
          <CardDescription>
            Define los parámetros legales que aplican a todos los trabajadores de la empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Límite de horas semanales</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_week_hours}
                  onChange={handleChange("max_week_hours")}
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Límite de horas mensuales</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_month_hours}
                  onChange={handleChange("max_month_hours")}
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Tiempo mínimo entre turnos (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_hours_between_shifts}
                  onChange={handleChange("min_hours_between_shifts")}
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora mínima de fichaje</Label>
                <Input
                  type="time"
                  value={form.allowed_checkin_start}
                  onChange={handleChange("allowed_checkin_start")}
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora máxima de fichaje</Label>
                <Input
                  type="time"
                  value={form.allowed_checkin_end}
                  onChange={handleChange("allowed_checkin_end")}
                  disabled={loading || saving}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || loading}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerComplianceSettings;

