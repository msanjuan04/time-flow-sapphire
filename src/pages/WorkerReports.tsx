import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Calendar, Clock, TrendingUp, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportCSV } from "@/lib/exports";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import html2pdf from "html2pdf.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

interface WorkSession {
  clock_in_time: string;
  clock_out_time: string | null;
  total_work_duration: unknown;
}

interface ApprovedAbsenceRecord {
  id: string;
  date: string;
  absence_type: string;
  time_change: string | null;
  notes: string | null;
  approved_by: string;
  approved_at: string;
  approver?: {
    full_name: string | null;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_ENTRIES = 30;

type ScheduleHistoryRow = Database["public"]["Tables"]["schedule_adjustments_history"]["Row"];

const parseTimeToMinutes = (time: string | null) => {
  if (!time) return null;
  const [h, m] = time.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const hoursFromHistory = (entry: ScheduleHistoryRow) => {
  const expected = Number(entry.expected_hours ?? 0);
  if (!Number.isNaN(expected) && expected > 0) {
    return expected;
  }
  const start = parseTimeToMinutes(entry.start_time ?? null);
  const end = parseTimeToMinutes(entry.end_time ?? null);
  if (start === null || end === null) return expected;
  return Math.max(0, (end - start) / 60);
};

const isWeekday = (date: Date) => {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
};

const WorkerReports = () => {
  const { user } = useAuth();
  const { companyId, membership } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [totalHours, setTotalHours] = useState(0);
  const [expectedHours, setExpectedHours] = useState(40); // Default fallback
  const [currentSchedule, setCurrentSchedule] = useState<{ hours: number; reason: string | null; changedAt: string | null; startTime: string | null; endTime: string | null } | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<Array<{ date: Date; sessions: WorkSession[] }>>([]);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [approvedAdjustments, setApprovedAdjustments] = useState<ApprovedAbsenceRecord[]>([]);
  const defaultRangeEnd = new Date();
  const defaultRangeStart = new Date();
  defaultRangeStart.setDate(defaultRangeEnd.getDate() - 30);
  const [customStartDate, setCustomStartDate] = useState<string>(defaultRangeStart.toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState<string>(defaultRangeEnd.toISOString().slice(0, 10));
  const [exportingRange, setExportingRange] = useState(false);

  const fetchWorkerData = useCallback(async () => {
    if (!user?.id || !companyId) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (period === "week") {
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const { data: eventsData } = await supabase
        .from("time_events")
        .select("event_time, event_type")
        .eq("user_id", user?.id)
        .eq("company_id", companyId)
        .gte("event_time", startDate.toISOString())
        .lte("event_time", endDate.toISOString())
        .order("event_time", { ascending: true });

      const events = eventsData || [];
      const computedSessions: { clock_in_time: string; clock_out_time: string | null }[] = [];
      let current: { clock_in_time: string; clock_out_time: string | null } | null = null;
      events.forEach((ev) => {
        if (ev.event_type === "clock_in") {
          if (current) {
            computedSessions.push(current);
          }
          current = { clock_in_time: ev.event_time, clock_out_time: null };
        }
        if (ev.event_type === "clock_out" && current) {
          current.clock_out_time = ev.event_time;
          computedSessions.push(current);
          current = null;
        }
      });
      if (current) {
        computedSessions.push(current);
      }

      setSessions(computedSessions);

      // Calculate total hours desde eventos
      let total = 0;
      computedSessions.forEach((session) => {
        if (session.clock_in_time) {
          const start = new Date(session.clock_in_time).getTime();
          const end = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
          const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
          total += hours;
        }
      });

      setTotalHours(total);

      // Fetch expected hours from scheduled_hours for the same range
      const startDateISO = startDate.toISOString().slice(0, 10);
      const endDateISO = endDate.toISOString().slice(0, 10);
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data: scheduledRows, error: scheduledError } = await supabase
        .from("scheduled_hours")
        .select("expected_hours, date, start_time, end_time")
        .eq("user_id", user?.id)
        .gte("date", startDateISO)
        .lte("date", todayISO);

      if (scheduledError) {
        console.error("Error fetching scheduled hours:", scheduledError);
      }

      let adjustments: ApprovedAbsenceRecord[] = [];
      try {
        const { data: adjustmentsData, error: adjustmentsError } = await supabase
          .from("approved_absences")
          .select(
            "id, date, absence_type, time_change, notes, approved_by, approved_at, approver:approved_by(full_name)"
          )
          .eq("company_id", companyId)
          .eq("user_id", user?.id)
          .gte("date", startDateISO)
          .lte("date", endDateISO);
        if (adjustmentsError) {
          console.error("Error fetching approved adjustments:", adjustmentsError);
        } else {
          adjustments = (adjustmentsData as ApprovedAbsenceRecord[]) || [];
        }
      } catch (adjustmentsException) {
        console.error("Unexpected error loading approved adjustments:", adjustmentsException);
      }

      let historyRows: ScheduleHistoryRow[] = [];
      let latestScheduleSummary: { hours: number; reason: string | null; changedAt: string | null; startTime: string | null; endTime: string | null } | null = null;
      try {
        const { data: historyData, error: historyError } = await supabase
          .from("schedule_adjustments_history")
          .select("expected_hours, reason, changed_at, applied_from, start_time, end_time")
          .eq("user_id", user?.id)
          .eq("company_id", companyId)
          .order("changed_at", { ascending: false })
          .limit(HISTORY_ENTRIES);

        if (historyError) {
          if (historyError.code !== "PGRST205") {
            console.error("Error fetching schedule history:", historyError);
          }
        } else {
          historyRows = historyData ?? [];
        }
      } catch (historyException) {
        console.error("Unexpected error loading schedule history:", historyException);
      }

      // Prioridad: si hay filas en scheduled_hours dentro del rango, usa la más reciente
      let latestScheduledRow: { expected_hours: number; start_time: string | null; end_time: string | null; date: string } | null =
        null;
      if (scheduledRows && scheduledRows.length > 0) {
        const sorted = [...scheduledRows].sort((a, b) => (a.date < b.date ? 1 : -1));
        const row = sorted[0];
        latestScheduledRow = {
          expected_hours: Number(row.expected_hours ?? 0),
          start_time: row.start_time ?? null,
          end_time: row.end_time ?? null,
          date: row.date,
        };
        latestScheduleSummary = {
          hours: latestScheduledRow.expected_hours,
          reason: `Horario diario (${latestScheduledRow.date})`,
          changedAt: latestScheduledRow.date,
          startTime: latestScheduledRow.start_time,
          endTime: latestScheduledRow.end_time,
        };
        setCurrentSchedule(latestScheduleSummary);
      } else if (historyRows.length > 0) {
        const latest = historyRows[0];
        latestScheduleSummary = {
          hours: hoursFromHistory(latest),
          reason: latest.reason,
          changedAt: latest.changed_at,
          startTime: latest.start_time ?? null,
          endTime: latest.end_time ?? null,
        };
        setCurrentSchedule(latestScheduleSummary);
      } else {
        latestScheduleSummary = null;
        setCurrentSchedule(null);
      }

      const scheduleMap = new Map<string, number>();
      (scheduledRows || []).forEach((row) => {
        const hours = Number(row.expected_hours ?? 0);
        scheduleMap.set(row.date, hours);
      });

      const daysInPeriod = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
      let computedExpected = 0;
      let workdayCount = 0;

      const fallbackDailyHours = latestScheduleSummary?.hours ?? 8;

      for (let i = 0; i < daysInPeriod; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        if (!isWeekday(day)) continue;
        workdayCount += 1;
        const iso = day.toISOString().slice(0, 10);
        const explicit = scheduleMap.get(iso);
        if (explicit !== undefined) {
          computedExpected += Number(explicit ?? fallbackDailyHours);
        } else {
          computedExpected += fallbackDailyHours;
        }
      }

      const fallbackValue =
        workdayCount > 0
          ? computedExpected
          : fallbackDailyHours * (period === "week" ? 5 : Math.max(20, Math.round((daysInPeriod * 5) / 7)));
      setExpectedHours(workdayCount > 0 ? computedExpected : fallbackValue);
      setApprovedAdjustments(adjustments);

      if (period === "week") {
        const sessionsList = computedSessions as WorkSession[];
        const buckets: Array<{ date: Date; sessions: WorkSession[] }> = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(startDate);
          day.setDate(startDate.getDate() + i);
          day.setHours(0, 0, 0, 0);
          const daySessions = sessionsList.filter((session) => {
            if (!session.clock_in_time) return false;
            const sessionDate = new Date(session.clock_in_time);
            return (
              sessionDate.getFullYear() === day.getFullYear() &&
              sessionDate.getMonth() === day.getMonth() &&
              sessionDate.getDate() === day.getDate()
            );
          });
          buckets.push({ date: new Date(day), sessions: daySessions });
        }
        setWeeklyEntries(buckets);
      } else {
        setWeeklyEntries([]);
      }
    } catch (error) {
      console.error("Error fetching worker data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [companyId, period, user?.id]);

  useEffect(() => {
    fetchWorkerData();
  }, [fetchWorkerData]);

  // Subscribe to scheduled_hours changes in real-time
  useEffect(() => {
    if (!user?.id || !companyId) return;

    const channel = supabase
      .channel(`worker-reports-scheduled-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_hours",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("🔄 Scheduled hours updated, refreshing reports...");
          fetchWorkerData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, companyId, fetchWorkerData]);

  // Export helpers (cliente, no tocan backend)
  const exportCSVLocal = () => {
    const headers = ["Fecha", "Entrada", "Salida", "Horas", "Estado"];
    const rows = sessions.map((s) => {
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const hours =
        start && (end || true)
          ? (
              ((end ? end.getTime() : Date.now()) - start.getTime()) /
              (1000 * 60 * 60)
            ).toFixed(2)
          : "";
      return [
        start ? start.toISOString().slice(0, 10) : "",
        start ? start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        hours,
        "",
      ];
    });

    approvedAdjustments.forEach((adj) => {
      rows.push([
        adj.date,
        "-",
        "-",
        "",
        `Ausencia: ${adj.absence_type}${adj.notes ? ` (${adj.notes})` : ""}`,
      ]);
    });

    rows.push(["", "", "Total horas", (totalHours || 0).toFixed(2), ""]);
    exportCSV(`mis_horas_${period}`, headers, rows);
    toast.success("CSV exportado");
  };

  const exportCustomRangeCsv = async () => {
    if (!user?.id || !companyId) {
      toast.error("No se encontró usuario o empresa");
      return;
    }
    if (!customStartDate || !customEndDate) {
      toast.error("Selecciona una fecha de inicio y fin");
      return;
    }
    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999);
    if (endDate < startDate) {
      toast.error("La fecha fin debe ser mayor o igual a la fecha inicio");
      return;
    }

    setExportingRange(true);
    try {
      const { data: rangeSessions, error } = await supabase
        .from("work_sessions")
        .select("clock_in_time, clock_out_time, total_work_duration")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .gte("clock_in_time", startDate.toISOString())
        .lte("clock_in_time", endDate.toISOString())
        .order("clock_in_time", { ascending: true });

      if (error) throw error;

      const headers = ["Fecha", "Entrada", "Salida", "Horas", "Estado"];
      let total = 0;
      const rows = (rangeSessions || []).map((s) => {
        const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
        const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
        const hours =
          start && (end || true)
            ? (
                ((end ? end.getTime() : Date.now()) - start.getTime()) /
                (1000 * 60 * 60)
              )
            : 0;
        total += hours;
        return [
          start ? start.toISOString().slice(0, 10) : "",
          start ? start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
          end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
          hours ? hours.toFixed(2) : "",
          "",
        ];
      });

      const { data: rangeAbsences, error: absenceError } = await supabase
        .from("approved_absences")
        .select("date, absence_type, notes")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .gte("date", customStartDate)
        .lte("date", customEndDate);

      if (absenceError) {
        console.error("Error fetching range absences", absenceError);
      } else {
        (rangeAbsences || []).forEach((adj) => {
          rows.push([
            adj.date,
            "-",
            "-",
            "",
            `Ausencia: ${adj.absence_type}${adj.notes ? ` (${adj.notes})` : ""}`,
          ]);
        });
      }

      rows.push(["", "", "Total horas", total.toFixed(2), ""]);

      const filename = `mis_horas_${customStartDate}_${customEndDate}`;
      exportCSV(filename, headers, rows);
      toast.success("CSV exportado");
    } catch (err) {
      console.error("Error exportando CSV de rango", err);
      toast.error("No pudimos exportar ese rango. Revisa las fechas.");
    } finally {
      setExportingRange(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) {
      toast.error("No se encontró el contenido a exportar.");
      return;
    }
    const options = {
      margin: 10,
      filename: "informe-gtiq.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(options).from(reportRef.current).save();
    setPreviewOpen(false);
  };

  const handlePreviewPDF = () => {
    if (!reportRef.current) {
      toast.error("No se encontró el contenido del informe.");
      return;
    }
    setPreviewHtml(reportRef.current.innerHTML);
    setPreviewOpen(true);
  };


  const hoursRemaining = Math.max(0, expectedHours - totalHours);
  const progress = expectedHours > 0 ? Math.min(100, (totalHours / expectedHours) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto pt-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mis Informes</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {membership?.company?.logo_url ? (
                  <img
                    src={membership.company.logo_url}
                    alt={`Logo ${membership.company.name ?? ""}`}
                    className="h-10 w-10 rounded object-contain border border-border/50 bg-white"
                  />
                ) : null}
                <span>{membership?.company?.name ?? "Control de horas trabajadas"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hover-scale" onClick={handlePreviewPDF}>
              <Download className="w-4 h-4 mr-2" /> Descargar PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSVLocal}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
        <Card className="glass-card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar por rango de fechas
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <Button size="sm" onClick={exportCustomRangeCsv} disabled={exportingRange}>
              {exportingRange ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Descargar CSV (rango)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes elegir cualquier rango, por ejemplo hasta 365 días, y el CSV incluirá el total al final.
          </p>
        </Card>
        <div ref={reportRef} className="space-y-6">
        {/* Jornada asignada */}
        <Card className="glass-card p-6 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Jornada asignada</p>
                <h2 className="text-xl font-semibold">
                  {currentSchedule ? `${currentSchedule.hours.toFixed(2)} h/día` : "Sin definir"}
                </h2>
                {currentSchedule?.startTime && currentSchedule?.endTime && (
                  <p className="text-sm text-muted-foreground">
                    Horario: {currentSchedule.startTime} – {currentSchedule.endTime}
                  </p>
                )}
              </div>
            </div>
            {currentSchedule?.changedAt && (
              <p className="text-xs text-muted-foreground">
                Actualizado el {new Date(currentSchedule.changedAt).toLocaleString("es-ES")}
              </p>
            )}
          </div>
          {currentSchedule?.reason ? (
            <p className="text-sm text-muted-foreground">Motivo: {currentSchedule.reason}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta jornada se actualizará automáticamente cuando tu empresa realice cambios.
            </p>
          )}
        </Card>

        {/* Period Selector */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Período</h2>
            <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Trabajadas</p>
                <p className="text-4xl font-bold mt-1 text-primary">
                  {totalHours.toFixed(1)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Esperadas</p>
                <p className="text-4xl font-bold mt-1">
                  {expectedHours}h
                </p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Restantes</p>
                <p className={`text-4xl font-bold mt-1 ${hoursRemaining === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {hoursRemaining.toFixed(1)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="glass-card p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progreso</span>
              <span className="text-sm text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary/20 rounded-full h-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  progress >= 100 ? 'bg-green-600' : 'bg-primary'
                }`}
              />
            </div>
          </div>
        </Card>

        {/* Sessions */}
        {period === "week" ? (
          <Card className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Fichajes de la semana</h2>
            <div className="space-y-3">
              {weeklyEntries.map((entry) => (
                <div key={entry.date.toISOString()} className="rounded-lg border p-3 space-y-2 bg-secondary/5">
                  <p className="text-sm font-semibold">
                    {entry.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  {entry.sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin fichajes en este día.</p>
                  ) : (
                    entry.sessions.map((session, index) => {
                      const start = new Date(session.clock_in_time);
                      const end = session.clock_out_time ? new Date(session.clock_out_time) : null;
                      const duration =
                        end && start ? Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : null;
                      return (
                        <div
                          key={`${session.clock_in_time}-${index}`}
                          className="flex items-center justify-between rounded-md bg-background/70 px-3 py-2 text-sm"
                        >
                          <span>
                            {start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}{" "}
                            {end && <>- {end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</>}
                          </span>
                          <span className="font-semibold text-primary">
                            {duration ? `${duration}h` : "En curso"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Fichajes recientes</h2>
            <div className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Cargando...</p>
              ) : sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay fichajes en este período</p>
              ) : (
                sessions.map((session, index) => {
                  const start = new Date(session.clock_in_time);
                  const end = session.clock_out_time ? new Date(session.clock_out_time) : null;
                  const duration =
                    end && start ? Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : null;
                  return (
                    <div
                      key={`${session.clock_in_time}-${index}`}
                      className="flex justify-between items-center p-4 bg-secondary/5 rounded-lg hover:bg-secondary/10 smooth-transition"
                    >
                      <div>
                        <p className="font-medium">
                          {start.toLocaleDateString("es-ES", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          {end && (
                            <> - {end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{duration ? `${duration}h` : "En curso"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}
        <Card className="glass-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ajustes de horario aprobados</h2>
            <span className="text-xs text-muted-foreground">
              {approvedAdjustments.length} ajuste{approvedAdjustments.length === 1 ? "" : "s"}
            </span>
          </div>
          {approvedAdjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ajustes aprobados para este período.</p>
          ) : (
            <div className="space-y-3">
              {approvedAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="rounded-lg border border-dashed border-border p-3 space-y-1 bg-background/80">
                  <p className="text-sm font-semibold">
                    {new Date(adjustment.date).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p>
                    <span className="font-medium">Tipo:</span> {adjustment.absence_type}
                  </p>
                  <p>
                    <span className="font-medium">Hora aprobada:</span>{" "}
                    {adjustment.time_change || "Sin hora definida"}
                  </p>
                  <p>
                    <span className="font-medium">Nota:</span> {adjustment.notes || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aprobado por {adjustment.approver?.full_name || adjustment.approved_by} el{" "}
                    {new Date(adjustment.approved_at).toLocaleString("es-ES")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del informe</DialogTitle>
            <DialogDescription>Revisa el contenido antes de descargar el PDF.</DialogDescription>
          </DialogHeader>
          <div
            className="border rounded-md p-4 bg-background/70 space-y-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDownloadPDF}>
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerReports;
