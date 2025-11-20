import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarRange, ChevronLeft, ChevronRight, Download, FileDown, Loader2 } from "lucide-react";
import { useWorkerSchedule } from "@/hooks/useWorkerSchedule";
import { buildScheduleRows, downloadScheduleCsv, downloadSchedulePdf } from "@/lib/workerSchedule";

interface Props {
  userId?: string | null;
  companyId?: string | null;
  workerName?: string | null;
}

const formatPeriodLabel = (start: Date, end: Date) => {
  const startLabel = format(start, "d MMM", { locale: es });
  const endLabel = format(end, "d MMM yyyy", { locale: es });
  return `${startLabel} - ${endLabel}`;
};

const sanitize = (value?: string | null) =>
  (value || "empleado")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, "-")
    .replace(/^-+|-+$/g, "");

const WorkerScheduleSection = ({ userId, companyId, workerName }: Props) => {
  const { weekStart, weekEnd, scheduleDays, loading, goToNextWeek, goToPreviousWeek } = useWorkerSchedule({
    userId,
    companyId,
  });
  const rows = useMemo(() => buildScheduleRows(scheduleDays), [scheduleDays]);
  const periodLabel = useMemo(() => formatPeriodLabel(weekStart, weekEnd), [weekStart, weekEnd]);
  const filenameBase = `horario-worker-${sanitize(workerName)}-${format(weekStart, "yyyyMMdd")}-${format(
    weekEnd,
    "yyyyMMdd"
  )}`;

  const handleCsv = () => downloadScheduleCsv(filenameBase, rows);
  const handlePdf = async () => {
    await downloadSchedulePdf({
      filename: filenameBase,
      rows,
      workerName,
      periodLabel,
    });
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mi horario</h2>
          <p className="text-sm text-muted-foreground">Este es tu horario actual asignado por la empresa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} disabled={loading}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold min-w-[170px] text-center flex items-center justify-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            <span>{periodLabel}</span>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextWeek} disabled={loading}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Horario asignado</p>
          <p className="text-sm text-muted-foreground">
            Cambia de semana según necesites y descarga la tabla que ves en pantalla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleCsv} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Descargar horario (CSV)
          </Button>
          <Button size="sm" onClick={handlePdf} disabled={loading}>
            <FileDown className="w-4 h-4 mr-2" />
            Descargar horario (PDF)
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/80 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Día de la semana</TableHead>
                <TableHead>Hora inicio</TableHead>
                <TableHead>Hora fin</TableHead>
                <TableHead>Pausa</TableHead>
                <TableHead className="text-right">Total horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.isoDate}>
                  <TableCell className="font-medium">{row.dayLabel}</TableCell>
                  <TableCell>{row.startLabel}</TableCell>
                  <TableCell>{row.endLabel}</TableCell>
                  <TableCell>{row.pauseLabel}</TableCell>
                  <TableCell className="text-right">{row.totalLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
};

export default WorkerScheduleSection;
