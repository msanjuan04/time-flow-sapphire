import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  describeDraft,
  draftFromSchedule,
  draftHours,
  draftProblem,
  emptyDraft,
  weekDays,
  type RosterSchedule,
  type ShiftDraft,
} from "@/lib/roster";

/**
 * El turno de una persona en un día, editable con el pulgar.
 *
 * Se abre desde el cuadrante tocando un día. Lleva los turnos que ya se
 * repiten en el equipo como atajo, y permite dejar el mismo turno en
 * varios días de la semana sin salir de aquí.
 */

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export interface ShiftEditorTarget {
  userId: string;
  name: string;
  date: string;
  schedule: RosterSchedule | null;
}

interface Props {
  target: ShiftEditorTarget | null;
  weekStart: Date;
  suggestions: ShiftDraft[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ShiftDraft, dates: string[]) => Promise<void> | void;
  onRemove: (dates: string[]) => Promise<void> | void;
}

const longDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export function ShiftEditorSheet({ target, weekStart, suggestions, saving, onClose, onSave, onRemove }: Props) {
  const [draft, setDraft] = useState<ShiftDraft>(emptyDraft);
  const [split, setSplit] = useState(false);
  const [dates, setDates] = useState<string[]>([]);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  useEffect(() => {
    if (!target) return;
    const initial = draftFromSchedule(target.schedule);
    setDraft(initial);
    setSplit(Boolean(initial.morningEnd && initial.afternoonStart));
    setDates([target.date]);
  }, [target]);

  const set = (patch: Partial<ShiftDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const effective: ShiftDraft = split ? draft : { ...draft, morningEnd: "", afternoonStart: "" };
  const problem = draftProblem(effective);
  const hours = draftHours(effective);

  const toggleDate = (date: string) =>
    setDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

  if (!target) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-xl sm:mx-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="truncate">{target.name}</SheetTitle>
          <SheetDescription className="first-letter:uppercase">{longDate(target.date)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Turnos que ya usáis</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((shift) => {
                  const label = describeDraft(shift);
                  return (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="tabular-nums"
                      onClick={() => {
                        setDraft(shift);
                        setSplit(Boolean(shift.morningEnd && shift.afternoonStart));
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="turno-entrada">Entrada</Label>
              <Input
                id="turno-entrada"
                type="time"
                className="h-12 text-base"
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turno-salida">Salida</Label>
              <Input
                id="turno-salida"
                type="time"
                className="h-12 text-base"
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
            <span className="text-sm font-medium">Turno partido</span>
            <Switch
              checked={split}
              onCheckedChange={(value) => {
                setSplit(value);
                if (value && !draft.morningEnd && !draft.afternoonStart) {
                  set({ morningEnd: "14:00", afternoonStart: "16:00" });
                }
              }}
            />
          </label>

          {split && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="turno-mediodia">Sale a mediodía</Label>
                <Input
                  id="turno-mediodia"
                  type="time"
                  className="h-12 text-base"
                  value={draft.morningEnd}
                  onChange={(e) => set({ morningEnd: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="turno-vuelve">Vuelve por la tarde</Label>
                <Input
                  id="turno-vuelve"
                  type="time"
                  className="h-12 text-base"
                  value={draft.afternoonStart}
                  onChange={(e) => set({ afternoonStart: e.target.value })}
                />
              </div>
            </div>
          )}

          <p className={cn("text-sm", problem ? "text-destructive" : "text-muted-foreground")}>
            {problem ?? `${hours} h de jornada`}
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Ponerlo también en</p>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const on = dates.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDate(day)}
                    className={cn(
                      "h-12 rounded-lg border text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground"
                    )}
                  >
                    <span className="block">{DAY_LABELS[index]}</span>
                    <span className="block text-[11px] font-normal tabular-nums">{day.slice(8)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="h-12 text-base"
              disabled={saving || Boolean(problem) || dates.length === 0}
              onClick={() => void onSave(effective, dates)}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dates.length > 1 ? `Guardar en ${dates.length} días` : "Guardar turno"}
            </Button>
            {target.schedule && (
              <Button
                variant="ghost"
                className="h-11 text-destructive"
                disabled={saving}
                onClick={() => void onRemove(dates)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {dates.length > 1 ? "Dejar libres esos días" : "Dejar el día libre"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
