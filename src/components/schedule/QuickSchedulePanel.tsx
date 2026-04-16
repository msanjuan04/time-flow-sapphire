import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Zap, Settings2, Loader2, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_PRESETS,
  applyWeeklyPattern,
  type SchedulePreset,
} from "@/lib/schedule/applyWeeklyPattern";

/* ─────────────────── Props ─────────────────── */

interface QuickSchedulePanelProps {
  employeeId: string;
  employeeName: string;
  companyId: string;
  userId: string;
  selectedDate: Date;
  onScheduleApplied: () => void;
  onOpenFullEditor: () => void;
}

/* ─────────────────── Detectar patrón actual ─────────────────── */

interface ScheduleRow {
  date: string;
  expected_hours: number;
  start_time: string | null;
  end_time: string | null;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function detectPattern(rows: ScheduleRow[]): string {
  if (rows.length === 0) return "Sin jornada asignada";

  // Agrupar por day-of-week
  const byDow = new Map<number, ScheduleRow>();
  for (const r of rows) {
    const dow = new Date(r.date + "T00:00:00").getDay();
    if (!byDow.has(dow)) byDow.set(dow, r);
  }

  // Identificar días activos
  const activeDows = Array.from(byDow.keys()).sort();
  if (activeDows.length === 0) return "Sin jornada asignada";

  // Verificar si todos tienen mismas horas
  const firstRow = byDow.get(activeDows[0])!;
  const allSameHours = activeDows.every(
    (d) => byDow.get(d)?.expected_hours === firstRow.expected_hours
  );
  const allSameTimes = activeDows.every(
    (d) =>
      byDow.get(d)?.start_time === firstRow.start_time &&
      byDow.get(d)?.end_time === firstRow.end_time
  );

  // Construir etiqueta de días
  let daysLabel: string;
  const isConsecutive =
    activeDows.length > 1 &&
    activeDows.every(
      (d, i) => i === 0 || d === activeDows[i - 1] + 1
    );

  if (isConsecutive) {
    daysLabel = `${DAY_NAMES[activeDows[0]]}-${DAY_NAMES[activeDows[activeDows.length - 1]]}`;
  } else {
    daysLabel = activeDows.map((d) => DAY_NAMES[d]).join(", ");
  }

  const hours = firstRow.expected_hours;
  const time =
    allSameTimes && firstRow.start_time && firstRow.end_time
      ? `${firstRow.start_time}-${firstRow.end_time}`
      : "";

  if (allSameHours && time) {
    return `${daysLabel} ${time} (${hours}h)`;
  }
  if (allSameHours) {
    return `${daysLabel} (${hours}h/día)`;
  }
  return `${daysLabel} (horario variable)`;
}

/* ─────────────────── Componente ─────────────────── */

export function QuickSchedulePanel({
  employeeId,
  employeeName,
  companyId,
  userId,
  selectedDate,
  onScheduleApplied,
  onOpenFullEditor,
}: QuickSchedulePanelProps) {
  const [currentPattern, setCurrentPattern] = useState<string>("Cargando...");
  const [applying, setApplying] = useState<string | null>(null); // preset id being applied
  const [confirming, setConfirming] = useState<SchedulePreset | null>(null);

  const loadCurrentPattern = useCallback(async () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const { data } = await supabase
      .from("scheduled_hours")
      .select("date, expected_hours, start_time, end_time")
      .eq("user_id", employeeId)
      .eq("company_id", companyId)
      .gte("date", format(today, "yyyy-MM-dd"))
      .lte("date", format(nextWeek, "yyyy-MM-dd"))
      .order("date", { ascending: true });

    setCurrentPattern(detectPattern((data as ScheduleRow[]) || []));
  }, [employeeId, companyId]);

  useEffect(() => {
    loadCurrentPattern();
  }, [loadCurrentPattern]);

  const handleApplyPreset = async (preset: SchedulePreset) => {
    setApplying(preset.id);
    setConfirming(null);
    try {
      await applyWeeklyPattern({
        employeeId,
        companyId,
        createdBy: userId,
        startDate: format(new Date(), "yyyy-MM-dd"),
        weeksToGenerate: 52,
        dayPatterns: preset.days,
        reason: preset.label,
      });
      await loadCurrentPattern();
      onScheduleApplied();
    } catch (e) {
      console.error("Error applying preset:", e);
    } finally {
      setApplying(null);
    }
  };

  const firstName = employeeName.split(" ")[0];

  return (
    <Card className="glass-card p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              Jornada de {firstName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentPattern}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenFullEditor}
          className="text-xs text-primary hover:underline font-medium shrink-0 flex items-center gap-1"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Personalizar
        </button>
      </div>

      {/* Confirmación inline */}
      {confirming && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-sm text-center">
            ¿Aplicar <span className="font-semibold">{confirming.label}</span> a{" "}
            <span className="font-semibold">{firstName}</span> desde hoy?
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {confirming.description} · 52 semanas
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirming(null)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleApplyPreset(confirming)}
              disabled={!!applying}
            >
              {applying === confirming.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Presets */}
      {!confirming && (
        <div className="grid grid-cols-3 gap-2">
          {SCHEDULE_PRESETS.map((preset) => {
            const isApplying = applying === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={!!applying}
                onClick={() => setConfirming(preset)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200",
                  "hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97]",
                  "border-border/50 bg-background/60",
                  isApplying && "opacity-50 pointer-events-none"
                )}
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Zap className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-semibold">{preset.shortLabel}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
