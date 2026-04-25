import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plane, Users } from "lucide-react";

interface Policy {
  annual_days: number;
  count_type: "working" | "natural";
  carry_over: "none" | "unlimited" | "until_month";
  carry_over_until_month: number | null;
  fiscal_year_start: "natural" | "anniversary";
  block_over_balance: boolean;
}

interface SummaryRow {
  user_id: string;
  full_name: string;
  email: string;
  assigned: number;
  used: number;
  pending: number;
  available: number;
}

const DEFAULT_POLICY: Policy = {
  annual_days: 22,
  count_type: "working",
  carry_over: "none",
  carry_over_until_month: null,
  fiscal_year_start: "natural",
  block_over_balance: true,
};

export function VacationPolicyCard({ companyId }: { companyId: string }) {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vacation_policies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setPolicy({
          annual_days: data.annual_days,
          count_type: data.count_type,
          carry_over: data.carry_over,
          carry_over_until_month: data.carry_over_until_month,
          fiscal_year_start: data.fiscal_year_start,
          block_over_balance: data.block_over_balance,
        });
      }
    } catch (err) {
      console.error("Error cargando política:", err);
      toast.error("No pudimos cargar la política");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data: members, error: memErr } = await supabase
        .from("memberships")
        .select("user_id, profiles(full_name, email)")
        .eq("company_id", companyId);
      if (memErr) throw memErr;

      const rows: SummaryRow[] = [];
      for (const m of members ?? []) {
        const { data: bal } = await supabase.rpc("get_vacation_balance", {
          p_user_id: m.user_id,
          p_company_id: companyId,
          p_year: year,
        });
        const r = Array.isArray(bal) ? bal[0] : bal;
        const profile = (m as any).profiles;
        rows.push({
          user_id: m.user_id,
          full_name: profile?.full_name || "—",
          email: profile?.email || "",
          assigned: r?.assigned_days ?? 0,
          used: Number(r?.used_days ?? 0),
          pending: Number(r?.pending_days ?? 0),
          available: Number(r?.available_days ?? 0),
        });
      }
      rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setSummary(rows);
    } catch (err) {
      console.error("Error cargando resumen:", err);
      toast.error("No pudimos cargar el resumen");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    void loadPolicy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    void loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, year]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        annual_days: policy.annual_days,
        count_type: policy.count_type,
        carry_over: policy.carry_over,
        carry_over_until_month:
          policy.carry_over === "until_month" ? policy.carry_over_until_month : null,
        fiscal_year_start: policy.fiscal_year_start,
        block_over_balance: policy.block_over_balance,
      };
      const { error } = await supabase
        .from("vacation_policies")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
      toast.success("Política guardada");
      await loadSummary();
    } catch (err) {
      console.error("Error guardando política:", err);
      toast.error("No pudimos guardar la política");
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, r) => ({
        assigned: acc.assigned + r.assigned,
        used: acc.used + r.used,
        pending: acc.pending + r.pending,
        available: acc.available + r.available,
      }),
      { assigned: 0, used: 0, pending: 0, available: 0 }
    );
  }, [summary]);

  return (
    <Card className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <Plane className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Política de vacaciones</h2>
          <p className="text-sm text-muted-foreground">
            Reglas que se aplican a toda la plantilla. Los empleados con valor manual en
            su ficha tienen prioridad.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="annual_days">Días anuales por defecto</Label>
              <Input
                id="annual_days"
                type="number"
                min={0}
                max={365}
                value={policy.annual_days}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, annual_days: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                En España lo habitual son 30 naturales o 22 laborables.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de cómputo</Label>
              <Select
                value={policy.count_type}
                onValueChange={(v) =>
                  setPolicy((p) => ({ ...p, count_type: v as Policy["count_type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Días laborables</SelectItem>
                  <SelectItem value="natural">Días naturales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Inicio del año fiscal</Label>
              <Select
                value={policy.fiscal_year_start}
                onValueChange={(v) =>
                  setPolicy((p) => ({
                    ...p,
                    fiscal_year_start: v as Policy["fiscal_year_start"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Año natural (1 enero)</SelectItem>
                  <SelectItem value="anniversary">Aniversario del empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Arrastre de días no disfrutados</Label>
              <Select
                value={policy.carry_over}
                onValueChange={(v) =>
                  setPolicy((p) => ({ ...p, carry_over: v as Policy["carry_over"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No se acumulan (caducan)</SelectItem>
                  <SelectItem value="unlimited">Se acumulan sin límite</SelectItem>
                  <SelectItem value="until_month">
                    Disfrutar antes de un mes concreto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {policy.carry_over === "until_month" && (
              <div className="space-y-1.5">
                <Label htmlFor="carry_month">Mes límite del año siguiente</Label>
                <Input
                  id="carry_month"
                  type="number"
                  min={1}
                  max={12}
                  value={policy.carry_over_until_month ?? 3}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      carry_over_until_month: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Bloquear solicitudes que superen el saldo</p>
              <p className="text-xs text-muted-foreground">
                Si está activo, no se podrán aprobar vacaciones que dejen el saldo en negativo.
              </p>
            </div>
            <Switch
              checked={policy.block_over_balance}
              onCheckedChange={(c) => setPolicy((p) => ({ ...p, block_over_balance: c }))}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar política
            </Button>
          </div>
        </>
      )}

      <div className="border-t pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Resumen de toda la plantilla</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Año</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) =>
                setYear(parseInt(e.target.value, 10) || new Date().getFullYear())
              }
              className="w-24 h-8 text-sm"
            />
          </div>
        </div>

        {loadingSummary ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando resumen…
          </div>
        ) : summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay empleados.</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Asignados</TableHead>
                  <TableHead className="text-right">Disfrutados</TableHead>
                  <TableHead className="text-right">Pendientes</TableHead>
                  <TableHead className="text-right">Disponibles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <p className="font-medium">{r.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.email}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.used.toFixed(1).replace(/\.0$/, "")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.pending.toFixed(1).replace(/\.0$/, "")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={r.available <= 0 ? "destructive" : "secondary"}
                        className="tabular-nums"
                      >
                        {r.available.toFixed(1).replace(/\.0$/, "")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Totales</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.assigned}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.used.toFixed(1).replace(/\.0$/, "")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.pending.toFixed(1).replace(/\.0$/, "")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.available.toFixed(1).replace(/\.0$/, "")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
}

export default VacationPolicyCard;
