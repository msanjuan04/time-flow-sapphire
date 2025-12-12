import { useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMembership } from "@/hooks/useMembership";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CompanyDayRules,
  HolidayPolicy,
  SpecialDayPolicy,
  WorkerDayRules,
  getCompanyDayRules,
  getWorkerDayRules,
  upsertCompanyDayRules,
  upsertWorkerDayRule,
} from "@/lib/dayRules";
import OwnerQuickNav from "@/components/OwnerQuickNav";

type PolicyWithInherit<T> = T | "inherit";

interface WorkerRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

const defaultGlobal: Pick<CompanyDayRules, "allow_sunday_clock" | "holiday_clock_policy" | "special_day_policy"> = {
  allow_sunday_clock: false,
  holiday_clock_policy: "block",
  special_day_policy: "restrict",
};

const DayRulesPage = () => {
  useDocumentTitle("Reglas por tipo de día • GTiQ");
  const { role, companyId } = useMembership();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workerSaving, setWorkerSaving] = useState(false);

  const [globalRules, setGlobalRules] = useState(defaultGlobal);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workerRules, setWorkerRules] = useState<Record<string, WorkerDayRules>>({});
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null);
  const [workerAllowSunday, setWorkerAllowSunday] = useState<PolicyWithInherit<boolean>>("inherit");
  const [workerHolidayPolicy, setWorkerHolidayPolicy] = useState<PolicyWithInherit<HolidayPolicy>>("inherit");
  const [workerSpecialPolicy, setWorkerSpecialPolicy] = useState<PolicyWithInherit<SpecialDayPolicy>>("inherit");

  const filteredWorkers = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return workers;
    return workers.filter(
      (w) =>
        w.full_name.toLowerCase().includes(term) ||
        w.email.toLowerCase().includes(term)
    );
  }, [workers, search]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const rules = await getCompanyDayRules(companyId);
        if (rules) {
          setGlobalRules({
            allow_sunday_clock: rules.allow_sunday_clock,
            holiday_clock_policy: rules.holiday_clock_policy,
            special_day_policy: rules.special_day_policy,
          });
        } else {
          setGlobalRules(defaultGlobal);
        }
      } catch (err) {
        console.error("[day-rules] load global", err);
        toast({
          title: "No se pudieron cargar las reglas",
          description: "Revisa tu conexión e inténtalo de nuevo.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId, toast]);

  useEffect(() => {
    if (!companyId) return;
    const loadWorkers = async () => {
      setWorkersLoading(true);
      try {
        const { data, error } = await supabase
          .from("memberships")
          .select("user_id, role, profiles(full_name, email)")
          .eq("company_id", companyId);
        if (error) throw error;
        const list: WorkerRow[] =
          (data || [])
            .filter((row: any) => row.role === "worker")
            .map((row: any) => ({
              user_id: row.user_id,
              role: row.role,
              full_name: row.profiles?.full_name || "Sin nombre",
              email: row.profiles?.email || "Sin email",
            })) ?? [];
        setWorkers(list);
      } catch (err) {
        console.error("[day-rules] load workers", err);
        toast({
          title: "No se pudieron cargar los trabajadores",
          description: "Revisa tu conexión e inténtalo de nuevo.",
          variant: "destructive",
        });
      } finally {
        setWorkersLoading(false);
      }
    };

    const loadWorkerRules = async () => {
      try {
        const rules = await getWorkerDayRules(companyId);
        const map: Record<string, WorkerDayRules> = {};
        rules.forEach((r) => {
          map[r.user_id] = r;
        });
        setWorkerRules(map);
      } catch (err) {
        console.error("[day-rules] load worker rules", err);
      }
    };

    loadWorkers();
    loadWorkerRules();
  }, [companyId, toast]);

  const handleSaveGlobal = async () => {
    if (!companyId) return;
    setSavingGlobal(true);
    try {
      await upsertCompanyDayRules(companyId, globalRules);
      toast({ title: "Reglas guardadas", description: "Se aplicarán a todos los trabajadores sin override." });
    } catch (err) {
      console.error("[day-rules] save global", err);
      toast({
        title: "No se pudieron guardar las reglas",
        description: "Revisa los datos e inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  const openWorkerDialog = (worker: WorkerRow) => {
    setSelectedWorker(worker);
    const current = workerRules[worker.user_id];
    setWorkerAllowSunday(
      typeof current?.allow_sunday_clock === "boolean" ? current.allow_sunday_clock : "inherit"
    );
    setWorkerHolidayPolicy(current?.holiday_clock_policy ?? "inherit");
    setWorkerSpecialPolicy(current?.special_day_policy ?? "inherit");
    setDialogOpen(true);
  };

  const handleSaveWorker = async () => {
    if (!companyId || !selectedWorker) return;
    setWorkerSaving(true);
    try {
      const payload = {
        allow_sunday_clock: workerAllowSunday === "inherit" ? null : Boolean(workerAllowSunday),
        holiday_clock_policy: workerHolidayPolicy === "inherit" ? null : workerHolidayPolicy,
        special_day_policy: workerSpecialPolicy === "inherit" ? null : workerSpecialPolicy,
      };
      const saved = await upsertWorkerDayRule(companyId, selectedWorker.user_id, payload);
      setWorkerRules((prev) => ({ ...prev, [selectedWorker.user_id]: saved }));
      toast({ title: "Override guardado", description: `${selectedWorker.full_name} actualizado.` });
      setDialogOpen(false);
    } catch (err) {
      console.error("[day-rules] save worker", err);
      toast({
        title: "No se pudo guardar",
        description: "Revisa la conexión e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setWorkerSaving(false);
    }
  };

  if (role !== "owner") {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>Solo los owners pueden configurar reglas por tipo de día.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reglas por tipo de día</h1>
            <p className="text-sm text-muted-foreground">
              Define cómo se fichan domingos, festivos y días especiales. Las reglas individuales prevalecen sobre la global.
            </p>
          </div>
        </div>
        <OwnerQuickNav />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Regla global de empresa</CardTitle>
          <CardDescription>Aplica a todos los trabajadores que no tengan configuración individual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando regla global...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Fichar domingos</Label>
                  <p className="text-sm text-muted-foreground">Activa para permitir fichajes en domingo.</p>
                </div>
                <Switch
                  checked={globalRules.allow_sunday_clock}
                  onCheckedChange={(v) =>
                    setGlobalRules((prev) => ({ ...prev, allow_sunday_clock: v }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fichar festivos</Label>
                  <Select
                    value={globalRules.holiday_clock_policy}
                    onValueChange={(v: HolidayPolicy) =>
                      setGlobalRules((prev) => ({ ...prev, holiday_clock_policy: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona política" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Permitido</SelectItem>
                      <SelectItem value="require_reason">Permitido con motivo</SelectItem>
                      <SelectItem value="block">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    “Permitido con motivo” obliga a introducir nota en el fichaje.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Días especiales</Label>
                  <Select
                    value={globalRules.special_day_policy}
                    onValueChange={(v: SpecialDayPolicy) =>
                      setGlobalRules((prev) => ({ ...prev, special_day_policy: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona política" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Permitido</SelectItem>
                      <SelectItem value="restrict">Modo restrictivo (bloquea)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Usa días especiales para cierres o eventos internos.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveGlobal} disabled={savingGlobal}>
                  {savingGlobal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar regla global
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle>Overrides individuales</CardTitle>
          </div>
          <CardDescription>Si existe configuración individual, prevalece sobre la regla global.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar trabajador por nombre o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            {workersLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-2">
            {filteredWorkers.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay trabajadores para mostrar.</p>
            )}
            {filteredWorkers.map((w) => {
              const override = workerRules[w.user_id];
              const hasOverride =
                override &&
                (override.allow_sunday_clock !== null ||
                  override.holiday_clock_policy !== null ||
                  override.special_day_policy !== null);
              return (
                <div
                  key={w.user_id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{w.full_name}</p>
                    <p className="text-sm text-muted-foreground">{w.email}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={hasOverride ? "default" : "outline"}>
                        {hasOverride ? "Override activo" : "Heredando regla global"}
                      </Badge>
                      {hasOverride && (
                        <span className="text-xs text-muted-foreground">
                          Domingos: {override.allow_sunday_clock === null ? "hereda" : override.allow_sunday_clock ? "permitido" : "bloqueado"} · Festivos: {override.holiday_clock_policy || "hereda"} · Especiales: {override.special_day_policy || "hereda"}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => openWorkerDialog(w)}>
                    Configurar
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configurar reglas para {selectedWorker?.full_name || "trabajador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domingos</Label>
              <Select
                value={String(workerAllowSunday)}
                onValueChange={(v) =>
                  setWorkerAllowSunday(v === "inherit" ? "inherit" : v === "true")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="true">Permitir</SelectItem>
                  <SelectItem value="false">Bloquear</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Festivos</Label>
              <Select
                value={workerHolidayPolicy || "inherit"}
                onValueChange={(v) =>
                  setWorkerHolidayPolicy(v as PolicyWithInherit<HolidayPolicy>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="allow">Permitido</SelectItem>
                  <SelectItem value="require_reason">Permitido con motivo</SelectItem>
                  <SelectItem value="block">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Días especiales</Label>
              <Select
                value={workerSpecialPolicy || "inherit"}
                onValueChange={(v) =>
                  setWorkerSpecialPolicy(v as PolicyWithInherit<SpecialDayPolicy>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="allow">Permitido</SelectItem>
                  <SelectItem value="restrict">Modo restrictivo (bloquea)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveWorker} disabled={workerSaving}>
              {workerSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayRulesPage;
