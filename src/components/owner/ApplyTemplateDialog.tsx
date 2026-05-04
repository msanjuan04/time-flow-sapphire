import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyScheduleTemplate,
  buildTemplateSummary,
  type ScheduleTemplate,
} from "@/lib/scheduleTemplates";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: ScheduleTemplate;
  companyId: string;
  /** If you want to pre-select specific users (e.g. coming from employee detail) */
  initialUserIds?: string[];
}

interface Person {
  id: string;
  full_name: string | null;
  email: string;
  team_id: string | null;
  center_id: string | null;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  center_id: string | null;
}

interface Center {
  id: string;
  name: string;
}

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  template,
  companyId,
  initialUserIds,
}: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [filterCenter, setFilterCenter] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // start of current month
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0); // end of current month
    return d.toISOString().slice(0, 10);
  });
  const [overwrite, setOverwrite] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [mRes, tRes, cRes] = await Promise.all([
        supabase
          .from("memberships")
          .select("user_id, profiles!inner(id, full_name, email, team_id, center_id, is_active)")
          .eq("company_id", companyId),
        supabase.from("teams").select("id, name, center_id").eq("company_id", companyId).order("name"),
        supabase.from("centers").select("id, name").eq("company_id", companyId).order("name"),
      ]);

      const list: Person[] = ((mRes.data as any[]) || [])
        .map((m) => ({
          id: m.user_id,
          full_name: m.profiles?.full_name ?? null,
          email: m.profiles?.email ?? "",
          team_id: m.profiles?.team_id ?? null,
          center_id: m.profiles?.center_id ?? null,
          is_active: m.profiles?.is_active !== false,
        }))
        .filter((p) => p.is_active);

      setPeople(list);
      setTeams((tRes.data as Team[]) || []);
      setCenters((cRes.data as Center[]) || []);

      // Pre-selection
      if (initialUserIds && initialUserIds.length > 0) {
        setSelectedIds(new Set(initialUserIds));
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [companyId, initialUserIds]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (filterCenter !== "all" && p.center_id !== filterCenter) return false;
      if (filterTeam !== "all" && p.team_id !== filterTeam) return false;
      return true;
    });
  }, [people, filterCenter, filterTeam]);

  const toggleAllVisible = () => {
    const allSelected = filtered.every((p) => selectedIds.has(p.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      filtered.forEach((p) => next.delete(p.id));
    } else {
      filtered.forEach((p) => next.add(p.id));
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un trabajador");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Indica fechas de inicio y fin");
      return;
    }
    if (endDate < startDate) {
      toast.error("La fecha de fin debe ser posterior al inicio");
      return;
    }

    setSubmitting(true);
    const t = toast.loading(`Aplicando plantilla a ${selectedIds.size} trabajador(es)…`);
    try {
      const result = await applyScheduleTemplate({
        templateId: template.id,
        userIds: Array.from(selectedIds),
        startDate,
        endDate,
        overwrite,
      });
      if (!result.ok) throw new Error(result.error || "error");
      toast.success(
        `Plantilla aplicada: ${result.insertedOrUpdated} día(s) configurado(s)`,
        { id: t }
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Error al aplicar", { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Aplicar plantilla "{template.name}"
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {buildTemplateSummary(template)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Periodo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="apt-start" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Desde
              </Label>
              <Input
                id="apt-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="apt-end">Hasta</Label>
              <Input
                id="apt-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Filtros + lista de trabajadores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Trabajadores ({selectedIds.size} seleccionados)
              </Label>
              <div className="flex gap-2">
                {centers.length > 0 && (
                  <Select
                    value={filterCenter}
                    onValueChange={(v) => {
                      setFilterCenter(v);
                      setFilterTeam("all");
                    }}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los centros</SelectItem>
                      {centers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {teams.length > 0 && (
                  <Select value={filterTeam} onValueChange={setFilterTeam}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los equipos</SelectItem>
                      {teams
                        .filter((t) => filterCenter === "all" || t.center_id === filterCenter)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="border rounded-md max-h-72 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground italic">
                  No hay trabajadores con esos filtros
                </p>
              ) : (
                <>
                  <div className="sticky top-0 bg-muted/50 px-3 py-1.5 border-b flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={filtered.every((p) => selectedIds.has(p.id))}
                      onCheckedChange={toggleAllVisible}
                    />
                    <span className="text-muted-foreground">
                      Seleccionar todos los visibles ({filtered.length})
                    </span>
                  </div>
                  {filtered.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-muted/20 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {p.full_name || p.email}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.email}
                        </div>
                      </div>
                      {p.team_id && (
                        <Badge variant="outline" className="text-[10px]">
                          {teams.find((t) => t.id === p.team_id)?.name || "Equipo"}
                        </Badge>
                      )}
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Overwrite toggle */}
          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <Label className="cursor-pointer">Sobrescribir horarios existentes</Label>
              <p className="text-[11px] text-muted-foreground">
                Si está activo, reemplaza horarios ya asignados en esas fechas. Si está
                desactivo, conserva los días que ya tienen horario y solo añade los vacíos.
              </p>
            </div>
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={submitting || selectedIds.size === 0} className="gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {submitting ? "Aplicando…" : `Aplicar a ${selectedIds.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplyTemplateDialog;
