import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  companyId: string;
}

interface Prefs {
  notify_absence_requests: boolean;
  notify_correction_requests: boolean;
  notify_clock_alerts: boolean;
  notify_general: boolean;
  scope_filter: "all" | "my_scope" | "none";
}

const DEFAULTS: Prefs = {
  notify_absence_requests: true,
  notify_correction_requests: true,
  notify_clock_alerts: true,
  notify_general: true,
  scope_filter: "all",
};

export function NotificationPreferencesCard({ companyId }: Props) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !companyId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("notification_preferences")
        .select(
          "notify_absence_requests, notify_correction_requests, notify_clock_alerts, notify_general, scope_filter"
        )
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setPrefs({
          notify_absence_requests: (data as any).notify_absence_requests ?? true,
          notify_correction_requests: (data as any).notify_correction_requests ?? true,
          notify_clock_alerts: (data as any).notify_clock_alerts ?? true,
          notify_general: (data as any).notify_general ?? true,
          scope_filter: (data as any).scope_filter ?? "all",
        });
      } else {
        setPrefs(DEFAULTS);
      }
    } catch (err) {
      console.error("Notification prefs load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user?.id || !companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            company_id: companyId,
            ...prefs,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,company_id" }
        );
      if (error) throw error;
      toast.success("Preferencias guardadas");
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Mis notificaciones</h3>
          <p className="text-xs text-muted-foreground">
            Decide qué notificaciones recibes y de qué scope. Útil para owners
            que no quieren ahogarse con notificaciones de toda la empresa
            cuando ya hay encargados por departamento.
          </p>
        </div>
      </div>

      {/* Scope filter */}
      <div className="space-y-2">
        <Label htmlFor="scope">Ámbito</Label>
        <Select
          value={prefs.scope_filter}
          onValueChange={(v) => setPrefs({ ...prefs, scope_filter: v as Prefs["scope_filter"] })}
        >
          <SelectTrigger id="scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la empresa (todo me llega)</SelectItem>
            <SelectItem value="my_scope">
              Solo mis equipos / mis centros
            </SelectItem>
            <SelectItem value="none">No recibir notificaciones</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Si eres owner y tienes encargados por equipo, lo más cómodo es
          <em> "Solo mis equipos"</em> para no recibir las solicitudes que
          gestionan ellos.
        </p>
      </div>

      {/* Toggles por categoría */}
      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Categorías</p>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="t-absence" className="cursor-pointer">
              Solicitudes de ausencia / vacaciones
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Cuando un trabajador pide vacaciones o un permiso.
            </p>
          </div>
          <Switch
            id="t-absence"
            checked={prefs.notify_absence_requests}
            onCheckedChange={(v) => setPrefs({ ...prefs, notify_absence_requests: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="t-correction" className="cursor-pointer">
              Solicitudes de corrección de fichaje
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Cuando un trabajador pide corregir una entrada/salida olvidada.
            </p>
          </div>
          <Switch
            id="t-correction"
            checked={prefs.notify_correction_requests}
            onCheckedChange={(v) => setPrefs({ ...prefs, notify_correction_requests: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="t-clock" className="cursor-pointer">
              Alertas de fichaje
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Llegadas tarde, salidas sin fichar, fuera de geofence, etc.
            </p>
          </div>
          <Switch
            id="t-clock"
            checked={prefs.notify_clock_alerts}
            onCheckedChange={(v) => setPrefs({ ...prefs, notify_clock_alerts: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="t-general" className="cursor-pointer">
              Generales
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Avisos del sistema, novedades, recordatorios.
            </p>
          </div>
          <Switch
            id="t-general"
            checked={prefs.notify_general}
            onCheckedChange={(v) => setPrefs({ ...prefs, notify_general: v })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar preferencias
        </Button>
      </div>
    </Card>
  );
}

export default NotificationPreferencesCard;
