import { cn } from "@/lib/utils";

export type DayStatusKey = "work" | "absence" | "vacation" | "incomplete" | "holiday";

const statusMeta: Record<DayStatusKey, { label: string; className: string }> = {
  work: {
    label: "Día trabajado",
    className: "calendar-indicator-pill-work",
  },
  absence: {
    label: "Ausencia registrada",
    className: "calendar-indicator-pill-absence",
  },
  vacation: {
    label: "Vacaciones",
    className: "calendar-indicator-pill-vacation",
  },
  incomplete: {
    label: "Horas incompletas",
    className: "calendar-indicator-pill-incomplete",
  },
  holiday: {
    label: "Festivo nacional",
    className: "calendar-indicator-pill-holiday",
  },
};

const MAX_INDICATORS = 3;

interface CalendarDayIndicatorsProps {
  statuses: DayStatusKey[];
}

const CalendarDayIndicators = ({ statuses }: CalendarDayIndicatorsProps) => {
  const normalizedStatuses = statuses
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, MAX_INDICATORS);

  return (
    <div className="calendar-day-indicators" aria-hidden={normalizedStatuses.length === 0}>
      {normalizedStatuses.length > 0 ? (
        normalizedStatuses.map((status) => (
          <span
            key={status}
            className={cn("calendar-indicator-pill", statusMeta[status].className)}
            title={statusMeta[status].label}
          />
        ))
      ) : (
        <span className="calendar-indicator-pill calendar-indicator-pill-empty" />
      )}
    </div>
  );
};

export default CalendarDayIndicators;
