import html2pdf from "html2pdf.js";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { exportCSV } from "@/lib/exports";
import type { WorkerScheduleDay } from "@/hooks/useWorkerSchedule";

export interface ScheduleDisplayRow {
  isoDate: string;
  dayLabel: string;
  /** Rango mañana (ej. "09:00 - 13:00") o jornada continua ("09:00 - 18:00") */
  morningLabel: string;
  /** Rango tarde en horario partido (ej. "16:00 - 20:00") o "—" si no aplica */
  afternoonLabel: string;
  pauseLabel: string;
  totalLabel: string;
}

const parseTimeToMinutes = (value: string | null): number | null => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTimeLabel = (value: string | null): string => {
  if (!value) return "—";
  try {
    const parsed = parse(value, "HH:mm:ss", new Date());
    return format(parsed, "HH:mm");
  } catch {
    return value.slice(0, 5);
  }
};

const formatPauseLabel = (start: string | null, end: string | null, expectedHours: number | null): string => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || expectedHours === null) return "—";

  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes <= 0) totalMinutes += 24 * 60; // turno nocturno (ej. 20:00–02:00)
  if (totalMinutes <= 0) return "—";

  const pauseMinutes = Math.max(0, Math.round(totalMinutes - expectedHours * 60));
  if (pauseMinutes <= 0) return "—";

  const hours = Math.floor(pauseMinutes / 60);
  const minutes = pauseMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/** Si la hora fin es "anterior" a la de inicio (ej. 02:30 vs 15:00), el turno cruza medianoche. */
const crossesMidnight = (start: string | null, end: string | null): boolean => {
  const sm = parseTimeToMinutes(start);
  const em = parseTimeToMinutes(end);
  if (sm === null || em === null) return false;
  return em < sm;
};

export const buildScheduleRows = (days: WorkerScheduleDay[]): ScheduleDisplayRow[] =>
  days.map((day) => {
    const dayLabel = format(day.date, "EEEE dd/MM", { locale: es });
    const isSplit =
      day.morning_end_time != null &&
      day.morning_end_time !== "" &&
      day.afternoon_start_time != null &&
      day.afternoon_start_time !== "";
    const midnightSuffix = " (día sig.)";
    let morningLabel: string;
    let afternoonLabel: string;
    if (isSplit) {
      morningLabel = `${formatTimeLabel(day.start_time)} - ${formatTimeLabel(day.morning_end_time)}`;
      afternoonLabel =
        day.afternoon_start_time && day.end_time
          ? `${formatTimeLabel(day.afternoon_start_time)} - ${formatTimeLabel(day.end_time)}${crossesMidnight(day.afternoon_start_time, day.end_time) ? midnightSuffix : ""}`
          : "—";
    } else {
      if (day.start_time && day.end_time) {
        const range = `${formatTimeLabel(day.start_time)} - ${formatTimeLabel(day.end_time)}`;
        morningLabel = crossesMidnight(day.start_time, day.end_time) ? `${range}${midnightSuffix}` : range;
      } else {
        morningLabel = "—";
      }
      afternoonLabel = "—";
    }
    const totalLabel =
      day.expected_hours !== null && day.expected_hours !== undefined
        ? `${Number(day.expected_hours).toFixed(2)} h`
        : "—";
    const pauseLabel = formatPauseLabel(day.start_time, day.end_time, day.expected_hours);

    return {
      isoDate: format(day.date, "yyyy-MM-dd"),
      dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
      morningLabel,
      afternoonLabel,
      pauseLabel,
      totalLabel,
    };
  });

export const downloadScheduleCsv = (filename: string, rows: ScheduleDisplayRow[]) => {
  const headers = ["Día", "Mañana", "Tarde", "Pausa", "Total horas"];
  const data = rows.map((row) => [row.dayLabel, row.morningLabel, row.afternoonLabel, row.pauseLabel, row.totalLabel]);
  exportCSV(filename, headers, data);
};

interface PdfOptions {
  filename: string;
  rows: ScheduleDisplayRow[];
  workerName?: string | null;
  periodLabel: string;
}

export const downloadSchedulePdf = async ({ filename, rows, workerName, periodLabel }: PdfOptions) => {
  const container = document.createElement("div");
  container.style.padding = "16px";
  container.style.maxWidth = "800px";
  container.innerHTML = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a;">
      <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">Horario asignado</h1>
      <p style="margin: 0 0 16px; color: #475569;">
        ${workerName ? `<strong>${workerName}</strong> · ` : ""}${periodLabel}
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px;">Día</th>
            <th style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px;">Mañana</th>
            <th style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px;">Tarde</th>
            <th style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px;">Pausa</th>
            <th style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px;">Total horas</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td style="border-bottom: 1px solid #f1f5f9; padding: 8px;">${row.dayLabel}</td>
                  <td style="border-bottom: 1px solid #f1f5f9; padding: 8px;">${row.morningLabel}</td>
                  <td style="border-bottom: 1px solid #f1f5f9; padding: 8px;">${row.afternoonLabel}</td>
                  <td style="border-bottom: 1px solid #f1f5f9; padding: 8px;">${row.pauseLabel}</td>
                  <td style="border-bottom: 1px solid #f1f5f9; padding: 8px;">${row.totalLabel}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(container);

  const options = {
    margin: 10,
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  try {
    await html2pdf().set(options).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
};

