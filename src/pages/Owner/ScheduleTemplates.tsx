import { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Users,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import {
  DAY_KEYS,
  DAY_LABELS,
  buildTemplateSummary,
  calcWeeklyHours,
  type DayKey,
  type DaySchedule,
  type ScheduleTemplate,
} from "@/lib/scheduleTemplates";
import ApplyTemplateDialog from "@/components/owner/ApplyTemplateDialog";

interface DayFormState {
  enabled: boolean;
  start: string;
  end: string;
  splitShift: boolean;
  morning_end: string;
  afternoon_start: string;
}

const emptyDay = (): DayFormState => ({
  enabled: false,
  start: "09:00",
  end: "17:00",
  splitShift: false,
  morning_end: "13:00",
  afternoon_start: "15:00",
});

const fromTemplate = (t: ScheduleTemplate | null): Record<DayKey, DayFormState> => {
  const result = {} as Record<DayKey, DayFormState>;
  for (const k of DAY_KEYS) {
    const d: DaySchedule | null | undefined = t ? (t as any)[k] : null;
    if (!d || !d.start || !d.end) {
      result[k] = emptyDay();
    } else {
      result[k] = {
        enabled: true,
        start: d.start,
        end: d.end,
        splitShift: !!(d.morning_end && d.afternoon_start),
        morning_end: d.morning_end || "13:00",
        afternoon_start: d.afternoon_start || "15:00",
      };
    }
  }
  return result;
};

const toDaySchedule = (d: DayFormState): DaySchedule | null => {
  if (!d.enabled) return null;
  return {
    start: d.start,
    end: d.end,
    morning_end: d.splitShift ? d.morning_end : null,
    afternoon_start: d.splitShift ? d.afternoon_start : null,
  };
};

const PRESETS: { name: string; description: string; days: Record<DayKey, DayFormState> }[] = [
  {
    name: "Turno mañana 40h",
    description: "Lunes a viernes, jornada continua de 9:00 a 17:00",
    days: {
      ...DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {}),
      monday:    { enabled: true, start: "09:00", end: "17:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      tuesday:   { enabled: true, start: "09:00", end: "17:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      wednesday: { enabled: true, start: "09:00", end: "17:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      thursday:  { enabled: true, start: "09:00", end: "17:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      friday:    { enabled: true, start: "09:00", end: "17:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      saturday:  emptyDay(),
      sunday:    emptyDay(),
    } as Record<DayKey, DayFormState>,
  },
  {
    name: "Jornada partida",
    description: "L-V con descanso de 13:00 a 15:00",
    days: {
      ...DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {}),
      monday:    { enabled: true, start: "09:00", end: "18:00", splitShift: true, morning_end: "13:00", afternoon_start: "15:00" },
      tuesday:   { enabled: true, start: "09:00", end: "18:00", splitShift: true, morning_end: "13:00", afternoon_start: "15:00" },
      wednesday: { enabled: true, start: "09:00", end: "18:00", splitShift: true, morning_end: "13:00", afternoon_start: "15:00" },
      thursday:  { enabled: true, start: "09:00", end: "18:00", splitShift: true, morning_end: "13:00", afternoon_start: "15:00" },
      friday:    { enabled: true, start: "09:00", end: "18:00", splitShift: true, morning_end: "13:00", afternoon_start: "15:00" },
      saturday:  emptyDay(),
      sunday:    emptyDay(),
    } as Record<DayKey, DayFormState>,
  },
  {
    name: "Turno tarde",
    description: "L-V de 14:00 a 22:00",
    days: {
      ...DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {}),
      monday:    { enabled: true, start: "14:00", end: "22:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      tuesday:   { enabled: true, start: "14:00", end: "22:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      wednesday: { enabled: true, start: "14:00", end: "22:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      thursday:  { enabled: true, start: "14:00", end: "22:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      friday:    { enabled: true, start: "14:00", end: "22:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      saturday:  emptyDay(),
      sunday:    emptyDay(),
    } as Record<DayKey, DayFormState>,
  },
  {
    name: "Hostelería FDS",
    description: "Jueves a domingo, jornada partida",
    days: {
      ...DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {}),
      thursday:  { enabled: true, start: "16:00", end: "23:00", splitShift: false, morning_end: "13:00", afternoon_start: "15:00" },
      friday:    { enabled: true, start: "12:00", end: "23:00", splitShift: true, morning_end: "16:00", afternoon_start: "20:00" },
      saturday:  { enabled: true, start: "12:00", end: "23:00", splitShift: true, morning_end: "16:00", afternoon_start: "20:00" },
      sunday:    { enabled: true, start: "12:00", end: "23:00", splitShift: true, morning_end: "16:00", afternoon_start: "20:00" },
    } as Record<DayKey, DayFormState>,
  },
];

const ScheduleTemplatesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId, role, loading: membershipLoading } = useMembership();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [days, setDays] = useState<Record<DayKey, DayFormState>>(() => {
    return DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {} as Record<DayKey, DayFormState>);
  });

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTemplate, setApplyTemplate] = useState<ScheduleTemplate | null>(null);

  const allowed = role === "owner" || role === "admin" || role === "manager";

  useEffect(() => {
    if (membershipLoading) return;
    if (!user) navigate("/auth", { replace: true });
    else if (!allowed) navigate("/access-issue?reason=no-role", { replace: true });
  }, [user, allowed, membershipLoading, navigate]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTemplates((data as ScheduleTemplate[]) || []);
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron cargar las plantillas");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!membershipLoading && companyId) void load();
  }, [companyId, membershipLoading, load]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSkipHolidays(true);
    setDays(DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {} as Record<DayKey, DayFormState>));
    setEditorOpen(true);
  };

  const openEdit = (t: ScheduleTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || "");
    setSkipHolidays(t.skip_holidays);
    setDays(fromTemplate(t));
    setEditorOpen(true);
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setName(preset.name);
    setDescription(preset.description);
    setDays(preset.days);
  };

  const save = async () => {
    if (!companyId) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const payload: any = {
      company_id: companyId,
      name: name.trim(),
      description: description.trim() || null,
      skip_holidays: skipHolidays,
      monday: toDaySchedule(days.monday),
      tuesday: toDaySchedule(days.tuesday),
      wednesday: toDaySchedule(days.wednesday),
      thursday: toDaySchedule(days.thursday),
      friday: toDaySchedule(days.friday),
      saturday: toDaySchedule(days.saturday),
      sunday: toDaySchedule(days.sunday),
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editing) {
        const { error } = await supabase.from("schedule_templates").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Plantilla actualizada");
      } else {
        const { error } = await supabase.from("schedule_templates").insert(payload);
        if (error) throw error;
        toast.success("Plantilla creada");
      }
      setEditorOpen(false);
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Error guardando");
    }
  };

  const deleteTemplate = async (t: ScheduleTemplate) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"? Los horarios ya aplicados no se borran.`)) return;
    try {
      const { error } = await supabase.from("schedule_templates").delete().eq("id", t.id);
      if (error) throw error;
      toast.success("Plantilla eliminada");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  };

  const openApply = (t: ScheduleTemplate) => {
    setApplyTemplate(t);
    setApplyOpen(true);
  };

  const previewWeekly = useMemo(() => {
    const partialTemplate: any = {};
    for (const k of DAY_KEYS) partialTemplate[k] = toDaySchedule(days[k]);
    return calcWeeklyHours(partialTemplate);
  }, [days]);

  if (membershipLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pt-4 sm:pt-8 space-y-6">
        <PageHeader
          icon={Calendar}
          title="Plantillas de horario"
          description="Crea patrones reutilizables y aplícalos a empleados o equipos en un rango de fechas"
          actions={
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> Nueva plantilla
            </Button>
          }
        />

        {templates.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Aún no hay plantillas</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Crea tu primera plantilla (turno mañana, tarde, jornada partida…) y
              aplícala masivamente a tu plantilla de trabajadores en lugar de
              configurar día a día.
            </p>
            <Button onClick={openNew}>Crear primera plantilla</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const weeklyHours = calcWeeklyHours(t);
              return (
                <Card key={t.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{t.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">
                          {weeklyHours.toFixed(1)}h/semana
                        </Badge>
                        {t.skip_holidays && (
                          <Badge variant="outline" className="text-[10px]">
                            Salta festivos
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      )}
                      <p className="text-xs font-mono text-muted-foreground mt-2">
                        {buildTemplateSummary(t)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="default" size="sm" onClick={() => openApply(t)} className="gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Aplicar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteTemplate(t)} title="Eliminar">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar plantilla" : "Nueva plantilla de horario"}
            </DialogTitle>
            <DialogDescription>
              Configura cada día de la semana. Los días sin horario se consideran libres.
            </DialogDescription>
          </DialogHeader>

          {/* Presets */}
          {!editing && (
            <div className="space-y-2">
              <p className="text-xs font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Empezar desde una plantilla común
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(p)}
                    className="text-xs"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label htmlFor="t-name">Nombre *</Label>
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Turno mañana 40h"
              />
            </div>
            <div>
              <Label htmlFor="t-desc">Descripción</Label>
              <Textarea
                id="t-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Configuración semanal</p>
                <Badge variant="secondary">Total: {previewWeekly.toFixed(1)}h/semana</Badge>
              </div>

              {DAY_KEYS.map((k) => {
                const d = days[k];
                return (
                  <div
                    key={k}
                    className={`border rounded-md p-3 ${d.enabled ? "bg-muted/20" : "bg-muted/5"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Label className="cursor-pointer flex items-center gap-2">
                        <Switch
                          checked={d.enabled}
                          onCheckedChange={(v) =>
                            setDays({ ...days, [k]: { ...d, enabled: v } })
                          }
                        />
                        <span className="font-semibold">{DAY_LABELS[k]}</span>
                      </Label>
                      {d.enabled && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Switch
                            id={`split-${k}`}
                            checked={d.splitShift}
                            onCheckedChange={(v) =>
                              setDays({ ...days, [k]: { ...d, splitShift: v } })
                            }
                            className="scale-75"
                          />
                          Jornada partida
                        </Badge>
                      )}
                    </div>
                    {d.enabled && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Inicio</Label>
                          <Input
                            type="time"
                            value={d.start}
                            onChange={(e) =>
                              setDays({ ...days, [k]: { ...d, start: e.target.value } })
                            }
                          />
                        </div>
                        {d.splitShift && (
                          <>
                            <div>
                              <Label className="text-xs">Fin mañana</Label>
                              <Input
                                type="time"
                                value={d.morning_end}
                                onChange={(e) =>
                                  setDays({ ...days, [k]: { ...d, morning_end: e.target.value } })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Inicio tarde</Label>
                              <Input
                                type="time"
                                value={d.afternoon_start}
                                onChange={(e) =>
                                  setDays({ ...days, [k]: { ...d, afternoon_start: e.target.value } })
                                }
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <Label className="text-xs">Fin</Label>
                          <Input
                            type="time"
                            value={d.end}
                            onChange={(e) =>
                              setDays({ ...days, [k]: { ...d, end: e.target.value } })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label className="cursor-pointer">Saltar festivos al aplicar</Label>
                <p className="text-[11px] text-muted-foreground">
                  No se asigna horario en festivos nacionales, autonómicos o locales.
                </p>
              </div>
              <Switch checked={skipHolidays} onCheckedChange={setSkipHolidays} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Guardar" : "Crear plantilla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply modal */}
      {applyTemplate && companyId && (
        <ApplyTemplateDialog
          open={applyOpen}
          onOpenChange={(o) => {
            setApplyOpen(o);
            if (!o) setApplyTemplate(null);
          }}
          template={applyTemplate}
          companyId={companyId}
        />
      )}
    </AppLayout>
  );
};

export default ScheduleTemplatesPage;
