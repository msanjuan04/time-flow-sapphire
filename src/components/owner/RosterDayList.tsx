import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RosterWeek } from "@/lib/roster";
import type { ShiftEditorTarget } from "@/components/owner/ShiftEditorSheet";

/**
 * El cuadrante en el móvil: un día cada vez.
 *
 * En una pantalla de teléfono no cabe la rejilla de siete días por
 * persona, así que se elige el día arriba y debajo se ve quién trabaja
 * ese día. Tocando a alguien se abre su turno.
 */

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  week: RosterWeek;
  activeDay: string;
  onActiveDayChange: (day: string) => void;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (userId: string) => void;
  onEdit: (target: ShiftEditorTarget) => void;
}

export function RosterDayList({
  week,
  activeDay,
  onActiveDayChange,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onEdit,
}: Props) {
  const activeIndex = Math.max(0, week.days.indexOf(activeDay));
  const total = week.dayTotals[activeIndex];

  return (
    <div className="md:hidden">
      <div className="grid grid-cols-7 gap-1 p-3">
        {week.days.map((day, index) => {
          const dayTotal = week.dayTotals[index];
          const on = day === activeDay;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              onClick={() => onActiveDayChange(day)}
              className={cn(
                "rounded-lg border py-2 text-center transition-colors",
                on ? "border-primary bg-primary/10 text-primary" : "border-border/60"
              )}
            >
              <span className="block text-[11px] font-medium">{DAY_LABELS[index]}</span>
              <span className="block text-sm font-semibold tabular-nums">{day.slice(8)}</span>
              <span
                className={cn("block text-[11px] tabular-nums", on ? "text-primary" : "text-muted-foreground")}
              >
                {dayTotal.people || "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {total.people} {total.people === 1 ? "persona" : "personas"} · {total.hours} h
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Marcar todos" />
          Marcar todos
        </label>
      </div>

      <ul className="divide-y divide-border/50 border-t border-border/50">
        {week.rows.map((row) => {
          const cell = row.cells[activeIndex];
          return (
            <li key={row.userId} className="flex items-center gap-1">
              <div className="pl-3">
                <Checkbox
                  checked={selected.has(row.userId)}
                  onCheckedChange={() => onToggleOne(row.userId)}
                  aria-label={`Marcar ${row.name}`}
                />
              </div>
              <button
                type="button"
                className="flex-1 min-w-0 flex items-center justify-between gap-3 p-3 text-left active:bg-muted/50"
                onClick={() =>
                  onEdit({ userId: row.userId, name: row.name, date: cell.date, schedule: cell.schedule })
                }
              >
                <span className="min-w-0">
                  <span className="block font-medium truncate">{row.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {row.totalHours} h esta semana
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {/* En turno partido, cada tramo en su línea: en el móvil no caben seguidos. */}
                  {cell.label.split(" · ").map((tramo) => (
                    <span
                      key={tramo}
                      className={cn(
                        "block text-sm tabular-nums",
                        cell.schedule ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {tramo}
                    </span>
                  ))}
                  {cell.schedule && (
                    <span className="block text-xs text-muted-foreground tabular-nums">{cell.hours} h</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
