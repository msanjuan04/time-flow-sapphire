import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plane, Calendar as CalendarIcon } from "lucide-react";

interface Balance {
  assigned_days: number;
  accrued_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

interface AbsenceRow {
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface Props {
  userId: string;
  companyId: string;
  canEdit: boolean;
}

const currentYear = new Date().getFullYear();

export function EmployeeVacationCard({ userId, companyId, canEdit }: Props) {
  const [year, setYear] = useState<number>(currentYear);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hireDate, setHireDate] = useState<string>("");
  const [override, setOverride] = useState<string>("");
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prof }, { data: bal, error: balErr }, { data: abs }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("hire_date, vacation_days_override")
            .eq("id", userId)
            .maybeSingle(),
          supabase.rpc("get_vacation_balance", {
            p_user_id: userId,
            p_company_id: companyId,
            p_year: year,
          }),
          supabase
            .from("approved_absences")
            .select("start_date, end_date, reason")
            .eq("user_id", userId)
            .eq("company_id", companyId)
            .eq("category", "vacation")
            .gte("end_date", `${year}-01-01`)
            .lte("start_date", `${year}-12-31`)
            .order("start_date", { ascending: false }),
        ]);
      if (balErr) throw balErr;
      setHireDate(prof?.hire_date ?? "");
      setOverride(
        prof?.vacation_days_override != null ? String(prof.vacation_days_override) : ""
      );
      const row = Array.isArray(bal) ? bal[0] : bal;
      setBalance(row ?? null);
      setAbsences((abs as AbsenceRow[]) ?? []);
    } catch (err) {
      console.error("Error cargando saldo de vacaciones:", err);
      toast.error("No pudimos cargar el saldo de vacaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyId, year]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const overrideNum = override.trim() === "" ? null : parseInt(override, 10);
      if (overrideNum != null && (Number.isNaN(overrideNum) || overrideNum < 0)) {
        toast.error("Días asignados inválidos");
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          hire_date: hireDate || null,
          vacation_days_override: overrideNum,
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Datos de vacaciones actualizados");
      await load();
    } catch (err) {
      console.error("Error guardando vacaciones:", err);
      toast.error("No pudimos guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    {
      label: "Asignados",
      value: balance?.assigned_days ?? 0,
      tone: "text-foreground",
    },
    {
      label: "Devengados",
      value: balance?.accrued_days ?? 0,
      tone: "text-blue-600",
    },
    {
      label: "Disfrutados",
      value: balance?.used_days ?? 0,
      tone: "text-amber-600",
    },
    {
      label: "Pendientes",
      value: balance?.pending_days ?? 0,
      tone: "text-purple-600",
    },
    {
      label: "Disponibles",
      value: balance?.available_days ?? 0,
      tone: "text-emerald-600 font-bold",
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Saldo de vacaciones</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Año</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
              className="w-24 h-8 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className={`text-2xl mt-1 tabular-nums ${s.tone}`}>
                  {Number(s.value).toFixed(1).replace(/\.0$/, "")}
                </p>
                <p className="text-[10px] text-muted-foreground">días</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Configuración del empleado</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="hire_date">Fecha de alta</Label>
            <Input
              id="hire_date"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              disabled={!canEdit}
            />
            <p className="text-[11px] text-muted-foreground">
              Si se introduce, los días del primer año se prorratean.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vac_override">Días asignados (override)</Label>
            <Input
              id="vac_override"
              type="number"
              min={0}
              max={365}
              placeholder="Por defecto (política de empresa)"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              disabled={!canEdit}
            />
            <p className="text-[11px] text-muted-foreground">
              Vacío = usa los días definidos en la política de empresa.
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Vacaciones de {year}</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {absences.length} períodos
          </Badge>
        </div>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay vacaciones registradas en este año.
          </p>
        ) : (
          <div className="space-y-2">
            {absences.map((a, i) => {
              const days =
                Math.round(
                  (new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) /
                    86400000
                ) + 1;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(a.start_date).toLocaleDateString("es-ES")} →{" "}
                      {new Date(a.end_date).toLocaleDateString("es-ES")}
                    </p>
                    {a.reason && (
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    )}
                  </div>
                  <Badge variant="secondary">{days} días</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default EmployeeVacationCard;
