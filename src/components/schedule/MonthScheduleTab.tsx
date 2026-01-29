import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";
import {
  DayTemplate,
  WeekTemplate,
  createEmptyWeekTemplate,
  parseDateOnlyUtc,
} from "@/lib/schedule/templates";
import {
  MonthWeek,
  getPreviousMonth,
  getWeeksForMonth,
} from "@/lib/schedule/month";

interface MonthScheduleTabProps {
  employeeId: string;
  companyId: string | null;
  createdBy: string | null;
  businessTimezone?: string | null;
}

type WeekTemplateMap = Record<string, WeekTemplate>; // key = weekStart ISO

const cloneWeek = (week: WeekTemplate): WeekTemplate => ({
  days: week.days.map((d) => ({ ...d })),
});

const computeHoursFromTimes = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes <= 0 ? 0 : minutes / 60;
};

const validateDay = (day: DayTemplate): boolean => {
  const morningSet = day.morningStart && day.morningEnd;
  const afternoonSet = day.afternoonStart && day.afternoonEnd;
  if (!morningSet && !afternoonSet) return false;

  const morningHours = morningSet ? computeHoursFromTimes(day.morningStart, day.morningEnd) : 0;
  const afternoonHours = afternoonSet ? computeHoursFromTimes(day.afternoonStart, day.afternoonEnd) : 0;
  if (morningHours <= 0 && afternoonHours <= 0) return false;

  // Validar solapes: mañana debe terminar antes que tarde si ambas existen
  if (morningSet && afternoonSet) {
    const [mh, mm] = day.morningEnd.split(":").map(Number);
    const [ah, am] = day.afternoonStart.split(":").map(Number);
    const endMorning = mh * 60 + mm;
    const startAfternoon = ah * 60 + am;
    if (startAfternoon < endMorning) return false;
  }

  return morningHours + afternoonHours <= 24;
};

const buildWeekTemplateFromRows = (
  weekStartIso: string,
  rows: { date: string; start_time: string | null; end_time: string | null }[]
): WeekTemplate => {
  const base = parseDateOnlyUtc(weekStartIso);
  const template = createEmptyWeekTemplate();
  rows.forEach((row) => {
    const date = parseDateOnlyUtc(row.date);
    const deltaDays = Math.floor((date.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    if (deltaDays < 0 || deltaDays > 6) return;
    const weekday = date.getUTCDay();
    const idx = template.days.findIndex((d) => d.day === weekday);
    if (idx === -1) return;
    template.days[idx] = {
      ...template.days[idx],
      enabled: true,
      morningStart: row.start_time ?? "",
      morningEnd: row.end_time ?? "",
      afternoonStart: "",
      afternoonEnd: "",
    };
  });
  return template;
};

const MonthScheduleTab = ({
  employeeId,
  companyId,
  createdBy,
  businessTimezone: _businessTimezone,
}: MonthScheduleTabProps) => {
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(() => today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => today.getMonth() + 1); // 1-12
  const [weeks, setWeeks] = useState<MonthWeek[]>(() =>
    getWeeksForMonth(today.getFullYear(), today.getMonth() + 1)
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(
    () => weeks[0]?.weekStartDate ?? null
  );
  const [weekTemplates, setWeekTemplates] = useState<WeekTemplateMap>({});
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthLabel = useMemo(() => {
    const date = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    return format(date, "LLLL yyyy", { locale: es });
  }, [selectedMonth, selectedYear]);

  // Recalcula semanas al cambiar mes
  useEffect(() => {
    const newWeeks = getWeeksForMonth(selectedYear, selectedMonth);
    setWeeks(newWeeks);
    setSelectedWeekStart(newWeeks[0]?.weekStartDate ?? null);
  }, [selectedMonth, selectedYear]);

  const selectedWeek = selectedWeekStart ? weekTemplates[selectedWeekStart] : null;

  const ensureWeekLoaded = async (weekStartIso: string, weekEndIso: string) => {
    if (!employeeId || !companyId) return;
    if (weekTemplates[weekStartIso]) return;
    setLoadingWeek(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_hours")
        .select("date, start_time, end_time")
        .eq("user_id", employeeId)
        .eq("company_id", companyId)
        .gte("date", weekStartIso)
        .lte("date", weekEndIso);

      if (error) throw error;
      const template = buildWeekTemplateFromRows(weekStartIso, (data as any[]) || []);
      setWeekTemplates((prev) => ({ ...prev, [weekStartIso]: template }));
    } catch (error) {
      console.error("Error fetching week schedule", error);
      toast.error("No se pudo cargar esta semana");
    } finally {
      setLoadingWeek(false);
    }
  };

  const handleSelectWeek = async (week: MonthWeek) => {
    setSelectedWeekStart(week.weekStartDate);
    await ensureWeekLoaded(week.weekStartDate, week.weekEndDate);
  };

  const handleMonthShift = (delta: number) => {
    const base = new Date(Date.UTC(selectedYear, selectedMonth - 1 + delta, 1));
    setSelectedYear(base.getUTCFullYear());
    setSelectedMonth(base.getUTCMonth() + 1);
  };

  const handleUpdateDay = (weekIndex: number, dayIndex: number, updates: Partial<DayTemplate>) => {
    if (!selectedWeekStart) return;
    setWeekTemplates((prev) => {
      const existing = prev[selectedWeekStart] ?? createEmptyWeekTemplate();
      const clone = cloneWeek(existing);
      clone.days[dayIndex] = { ...clone.days[dayIndex], ...updates };
      return { ...prev, [selectedWeekStart]: clone };
    });
  };

  const handleCopySelectedToMonth = () => {
    if (!selectedWeekStart) return;
    const template = weekTemplates[selectedWeekStart];
    if (!template) {
      toast.error("Primero carga/edita la semana seleccionada");
      return;
    }
    setWeekTemplates((prev) => {
      const next: WeekTemplateMap = { ...prev };
      weeks.forEach((w) => {
        next[w.weekStartDate] = cloneWeek(template);
      });
      return next;
    });
    toast.success("Semana aplicada a todas las semanas del mes");
  };

  const copyFromPreviousMonth = async () => {
    if (!companyId) return;
    const { year, month } = getPreviousMonth(selectedYear, selectedMonth);
    const prevWeeks = getWeeksForMonth(year, month);
    setCopying(true);
    try {
      const loadedPrev: WeekTemplate[] = [];
      for (const w of prevWeeks) {
        const { data, error } = await supabase
          .from("scheduled_hours")
          .select("date, start_time, end_time")
          .eq("user_id", employeeId)
          .eq("company_id", companyId)
          .gte("date", w.weekStartDate)
          .lte("date", w.weekEndDate);
        if (error) throw error;
        loadedPrev.push(buildWeekTemplateFromRows(w.weekStartDate, (data as any[]) || []));
      }

      // Map por posición; si el mes actual tiene más semanas, las extra quedan vacías
      setWeekTemplates((prev) => {
        const next: WeekTemplateMap = { ...prev };
        weeks.forEach((w, idx) => {
          const template = loadedPrev[idx];
          next[w.weekStartDate] = template ? cloneWeek(template) : createEmptyWeekTemplate();
        });
        return next;
      });
      toast.success("Copiado desde mes anterior");
    } catch (error) {
      console.error("Error copying previous month", error);
      toast.error("No se pudo copiar el mes anterior");
    } finally {
      setCopying(false);
    }
  };

  const saveWeek = async (week: MonthWeek, template: WeekTemplate) => {
    if (!companyId || !createdBy) {
      toast.error("Falta empresa o usuario");
      return;
    }

    // Validación por día
    for (const day of template.days) {
      if (!day.enabled) continue;
      if (!validateDay(day)) {
        throw new Error(`Revisa las horas de ${day.name}`);
      }
    }

    // Borrado previo para la semana
    const { error: delError } = await supabase
      .from("scheduled_hours")
      .delete()
      .eq("user_id", employeeId)
      .eq("company_id", companyId)
      .gte("date", week.weekStartDate)
      .lte("date", week.weekEndDate);
    if (delError) throw delError;

    const payload: any[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(parseDateOnlyUtc(week.weekStartDate), i);
      const dayIdx = currentDate.getUTCDay();
      const dayTemplate = template.days.find((d) => d.day === dayIdx);
      if (!dayTemplate || !dayTemplate.enabled) continue;

      const morningHours =
        dayTemplate.morningStart && dayTemplate.morningEnd
          ? computeHoursFromTimes(dayTemplate.morningStart, dayTemplate.morningEnd)
          : 0;
      const afternoonHours =
        dayTemplate.afternoonStart && dayTemplate.afternoonEnd
          ? computeHoursFromTimes(dayTemplate.afternoonStart, dayTemplate.afternoonEnd)
          : 0;
      const expected_hours = Number((morningHours + afternoonHours).toFixed(2));
      if (expected_hours <= 0) continue;

      const start_time = dayTemplate.morningStart || dayTemplate.afternoonStart || null;
      const end_time = dayTemplate.afternoonEnd || dayTemplate.morningEnd || null;

      payload.push({
        user_id: employeeId,
        company_id: companyId,
        date: format(currentDate, "yyyy-MM-dd"),
        expected_hours,
        created_by: createdBy,
        notes: `Mes ${monthLabel}`,
        start_time,
        end_time,
      });
    }

    if (payload.length === 0) return;
    const { error: insertError } = await supabase.from("scheduled_hours").insert(payload);
    if (insertError) throw insertError;
  };

  const handleSaveSelectedWeek = async () => {
    if (!selectedWeekStart) return;
    const week = weeks.find((w) => w.weekStartDate === selectedWeekStart);
    const template = selectedWeekStart ? weekTemplates[selectedWeekStart] : null;
    if (!week || !template) {
      toast.error("Carga primero la semana");
      return;
    }

    setSaving(true);
    try {
      await saveWeek(week, template);
      toast.success("Semana guardada");
    } catch (error: any) {
      console.error("Error saving week", error);
      toast.error(error?.message || "No se pudo guardar la semana");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonth = async () => {
    setSaving(true);
    try {
      for (const week of weeks) {
        const template = weekTemplates[week.weekStartDate];
        if (!template) continue;
        await saveWeek(week, template);
      }
      toast.success("Mes guardado por semanas");
    } catch (error: any) {
      console.error("Error saving month", error);
      toast.error(error?.message || "No se pudo guardar el mes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => handleMonthShift(-1)} aria-label="Mes anterior">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold">◀ {monthLabel} ▶</div>
          <Button variant="ghost" size="sm" onClick={() => handleMonthShift(1)} aria-label="Mes siguiente">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Mes seleccionado: {monthLabel} · Semanas: {weeks.length}
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {weeks.map((week) => (
          <Button
            key={week.weekStartDate}
            variant={week.weekStartDate === selectedWeekStart ? "default" : "outline"}
            size="sm"
            onClick={() => handleSelectWeek(week)}
          >
            {week.label}
            {week.crossesMonth && (
              <Badge variant="secondary" className="ml-2">
                cruza mes
              </Badge>
            )}
          </Button>
        ))}
        {weeks.length === 0 && <span className="text-sm text-muted-foreground">No hay semanas en este mes</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={copyFromPreviousMonth} disabled={copying || loadingWeek}>
          {copying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          Copiar desde mes anterior
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopySelectedToMonth} disabled={!selectedWeekStart}>
          Copiar semana seleccionada a todo el mes
        </Button>
      </div>

      <Separator />

      {loadingWeek ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando semana...
        </div>
      ) : !selectedWeek ? (
        <div className="text-sm text-muted-foreground">
          Selecciona una semana para editar. Si no hay datos, prueba "Copiar desde mes anterior".
        </div>
      ) : (
        <WeeklyScheduleEditor
          weeklySchedules={[selectedWeek]}
          weekCount={weeks.length}
          copyWeekTargets={[1]}
          onChangeCopyTarget={() => {}}
          onCopyWeek={() => {}}
          onUpdateDay={handleUpdateDay}
          showCopyControls={false}
          renderWeekLabel={() => selectedWeekStart ?? ""}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSaveSelectedWeek} disabled={saving || !selectedWeekStart || loadingWeek}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Guardar semana
        </Button>
        <Button variant="outline" onClick={handleSaveMonth} disabled={saving || loadingWeek || weeks.length === 0}>
          Guardar mes (por semanas)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Se reutiliza el guardado por semanas en scheduled_hours sin cambios de esquema. Las semanas se calculan lunes a
        domingo (ISO) y, si cruzan de mes, se muestran con etiqueta. Los intervalos solapados en un día se bloquean.
      </p>
    </div>
  );
};

export default MonthScheduleTab;
