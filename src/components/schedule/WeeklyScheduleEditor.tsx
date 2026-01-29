import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DayTemplate, WeekTemplate, WEEKDAYS } from "@/lib/schedule/templates";

interface Props {
  weeklySchedules: WeekTemplate[];
  weekCount?: number;
  copyWeekTargets: number[];
  onChangeCopyTarget: (weekIndex: number, targetWeek: number) => void;
  onCopyWeek: (fromWeek: number, toWeek: number) => void;
  onUpdateDay: (weekIndex: number, dayIndex: number, updates: Partial<DayTemplate>) => void;
  renderWeekLabel?: (weekIndex: number) => string;
  showCopyControls?: boolean;
}

// Editor desacoplado para reutilizar en pestaña Semana y Mes
const WeeklyScheduleEditor = ({
  weeklySchedules,
  weekCount = 4,
  copyWeekTargets,
  onChangeCopyTarget,
  onCopyWeek,
  onUpdateDay,
  renderWeekLabel,
  showCopyControls = true,
}: Props) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {weeklySchedules.map((week, index) => (
        <div
          key={`week-block-${index}`}
          className="rounded-2xl border border-border/60 bg-muted/40 p-3 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-semibold">Semana {index + 1}</span>
              {renderWeekLabel && (
                <span className="text-[11px] text-muted-foreground">
                  {renderWeekLabel(index)}
                </span>
              )}
            </div>
            {showCopyControls && (
              <div className="flex items-center gap-2 text-[11px]">
                <Select
                  value={copyWeekTargets[index].toString()}
                  onValueChange={(value) => onChangeCopyTarget(index, Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Copiar a" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: weekCount }, (_, i) => i + 1).map((weekNumber) => (
                      <SelectItem
                        key={`copy-${index}-${weekNumber}`}
                        value={weekNumber.toString()}
                        disabled={weekNumber === index + 1}
                      >
                        Semana {weekNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="xs" variant="outline" onClick={() => onCopyWeek(index, copyWeekTargets[index])}>
                  Copiar
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {week.days.map((day, dayIdx) => (
              <div
                key={`${index}-${day.day}`}
                className={`rounded-xl border p-3 ${day.enabled ? "bg-background" : "bg-muted/60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) =>
                        onUpdateDay(index, dayIdx, {
                          enabled: e.target.checked,
                        })
                      }
                    />
                    {day.name}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {day.enabled ? "Trabaja" : "Libre"}
                  </span>
                </div>

                {day.enabled && (
                  <div className="mt-3 grid gap-2">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Mañana</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="time"
                          value={day.morningStart}
                          onChange={(e) =>
                            onUpdateDay(index, dayIdx, {
                              morningStart: e.target.value,
                            })
                          }
                        />
                        <Input
                          type="time"
                          value={day.morningEnd}
                          onChange={(e) =>
                            onUpdateDay(index, dayIdx, {
                              morningEnd: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Tarde</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="time"
                          value={day.afternoonStart}
                          onChange={(e) =>
                            onUpdateDay(index, dayIdx, {
                              afternoonStart: e.target.value,
                            })
                          }
                        />
                        <Input
                          type="time"
                          value={day.afternoonEnd}
                          onChange={(e) =>
                            onUpdateDay(index, dayIdx, {
                              afternoonEnd: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeeklyScheduleEditor;
