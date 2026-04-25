import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SPAIN_REGIONS,
  DEFAULT_REGION,
  getHolidaysForRegion,
} from "@/data/spainHolidays";
import {
  loadEffectiveHolidays,
  type CompanyHolidayRow,
} from "@/lib/companyHolidays";

interface Props {
  companyId: string;
}

export function HolidayCalendarCard({ companyId }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [region, setRegion] = useState<string>(DEFAULT_REGION);
  const [savingRegion, setSavingRegion] = useState(false);
  const [customRows, setCustomRows] = useState<CompanyHolidayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Load region + custom rows
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    loadEffectiveHolidays(companyId, year)
      .then((eff) => {
        if (cancelled) return;
        setRegion(eff.region);
        setCustomRows(eff.customRows);
      })
      .catch((err) => {
        console.error("Error cargando festivos:", err);
        toast.error("No se pudo cargar la configuración de festivos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, year]);

  const regionalForYear = useMemo(
    () =>
      getHolidaysForRegion(region, year).filter((h) => h.scope === "regional"),
    [region, year]
  );
  const nationalForYear = useMemo(
    () =>
      getHolidaysForRegion(region, year).filter((h) => h.scope === "national"),
    [region, year]
  );

  const handleSaveRegion = async () => {
    if (!companyId) return;
    setSavingRegion(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ holiday_region: region } as any)
        .eq("id", companyId);
      if (error) throw error;
      toast.success("Comunidad autónoma guardada");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo guardar la comunidad");
    } finally {
      setSavingRegion(false);
    }
  };

  const handleAddLocal = async () => {
    if (!newDate || !newName.trim()) {
      toast.error("Indica fecha y nombre del festivo");
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("company_holidays")
        .insert({
          company_id: companyId,
          holiday_date: newDate,
          name: newName.trim(),
        } as any)
        .select("id, company_id, holiday_date, name, notes")
        .single();
      if (error) throw error;
      setCustomRows((rows) =>
        [...rows, data as CompanyHolidayRow].sort((a, b) =>
          a.holiday_date.localeCompare(b.holiday_date)
        )
      );
      setNewDate("");
      setNewName("");
      toast.success("Festivo local añadido");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo añadir el festivo");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLocal = async (id: string) => {
    try {
      const { error } = await supabase
        .from("company_holidays")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setCustomRows((rows) => rows.filter((r) => r.id !== id));
      toast.success("Festivo eliminado");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo eliminar el festivo");
    }
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Calendario de festivos</h3>
          <p className="text-xs text-muted-foreground">
            Festivos nacionales (automáticos) + autonómicos según comunidad +
            locales propios. Se descuentan del cómputo de días laborables al
            aprobar vacaciones.
          </p>
        </div>
      </div>

      {/* Region selector */}
      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <Label htmlFor="holiday-region">Comunidad autónoma</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="holiday-region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPAIN_REGIONS.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="holiday-year">Año</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger id="holiday-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSaveRegion} disabled={savingRegion} className="gap-2">
          {savingRegion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar comunidad
        </Button>
      </div>

      {/* Preview of national + regional */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Cargando…</div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Festivos del año {year}</h4>
              <Badge variant="outline" className="text-[10px]">
                {nationalForYear.length} nacionales · {regionalForYear.length} autonómicos · {customRows.length} locales
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {[...nationalForYear, ...regionalForYear, ...customRows.map((r) => ({
                date: r.holiday_date,
                name: r.name,
                scope: "local" as const,
              }))]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h, idx) => (
                  <div
                    key={`${h.date}-${idx}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30"
                  >
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {h.date.slice(5)}
                    </span>
                    <span className="flex-1">{h.name}</span>
                    <Badge
                      variant="outline"
                      className={
                        h.scope === "national"
                          ? "text-[10px] bg-red-50 border-red-300 text-red-700"
                          : h.scope === "regional"
                            ? "text-[10px] bg-amber-50 border-amber-300 text-amber-700"
                            : "text-[10px] bg-emerald-50 border-emerald-300 text-emerald-700"
                      }
                    >
                      {h.scope === "national"
                        ? "nacional"
                        : h.scope === "regional"
                          ? "autonómico"
                          : "local"}
                    </Badge>
                  </div>
                ))}
            </div>
          </section>

          {/* Custom local holidays editor */}
          <section className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold">Festivos locales propios</h4>
              <p className="text-xs text-muted-foreground">
                Festivos del municipio o de la empresa (Festa Major, patrón…).
                Cada ayuntamiento tiene 2 al año.
              </p>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end">
              <div>
                <Label htmlFor="new-holiday-date" className="text-xs">Fecha</Label>
                <Input
                  id="new-holiday-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="new-holiday-name" className="text-xs">Nombre</Label>
                <Input
                  id="new-holiday-name"
                  placeholder="Festa Major, Patrón…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button onClick={handleAddLocal} disabled={adding} className="gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Añadir
              </Button>
            </div>

            {customRows.length > 0 ? (
              <div className="space-y-1">
                {customRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border"
                  >
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {r.holiday_date}
                    </span>
                    <span className="flex-1 text-sm">{r.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLocal(r.id)}
                      title="Eliminar festivo"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No hay festivos locales añadidos.
              </p>
            )}
          </section>
        </>
      )}
    </Card>
  );
}

export default HolidayCalendarCard;
