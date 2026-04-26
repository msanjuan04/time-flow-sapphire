// src/pages/Calendar.tsx
import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useMemo } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, AlertCircle, MapPin, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import CalendarDayIndicators, { DayStatusKey } from "@/components/CalendarDayIndicators";
import { SPANISH_HOLIDAYS } from "@/data/spainHolidays";
import PrivateMap from "@/components/PrivateMap";
import { format, startOfMonth, endOfMonth, parse, parseISO, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { DayContentProps } from "react-day-picker";

interface WorkSession {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_work_duration: string | null;
}

interface TimeEvent {
  id: string;
  event_type: "clock_in" | "clock_out" | "pause_start" | "pause_end" | string;
  event_time: string;
  latitude: number | null;
  longitude: number | null;
}

interface Absence {
  id: string;
  absence_type: "vacation" | "sick_leave" | "personal" | string;
  start_date: string;
  end_date: string;
  status: "approved" | "rejected" | "pending" | string;
  reason: string | null;
}

interface ScheduledHours {
  id: string;
  date: string;
  expected_hours: number;
  start_time: string | null;
  end_time: string | null;
}

interface ApprovedAbsence {
  id: string;
  user_id: string;
  company_id: string;
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

const WorkerCalendar = () => {
  const { membership, loading: membershipLoading } = useMembership();
  const { user } = useAuth();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [scheduledHours, setScheduledHours] = useState<ScheduledHours[]>([]);
  const scheduledMap = useMemo(() => {
    const map = new Map<string, number>();
    scheduledHours.forEach((scheduled) => {
      map.set(scheduled.date, scheduled.expected_hours);
    });
    return map;
  }, [scheduledHours]);
  const holidaySet = useMemo(() => new Set(SPANISH_HOLIDAYS.map((holiday) => holiday.date)), []);
  const [timeEvents, setTimeEvents] = useState<TimeEvent[]>([]);
  const [approvedAdjustments, setApprovedAdjustments] = useState<ApprovedAbsence[]>([]);
  const [selectedDateData, setSelectedDateData] = useState<{
    worked: number;
    expected: number;
    absence: Absence | null;
    events: TimeEvent[];
    approvedAbsences: ApprovedAbsence[];
    schedule: ScheduledHours | null;
  } | null>(null);

  const [miniMapsEnabled, setMiniMapsEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("calendarMiniMapsEnabled");
      return v === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("calendarMiniMapsEnabled", miniMapsEnabled ? "1" : "0");
    } catch {
      // noop
    }
  }, [miniMapsEnabled]);

  // Privacy: OpenStreetMap via Leaflet (no third-party leak to Google).

  // Fetch solo al cambiar de MES (no de día) — evita 5 queries innecesarias por click
  useEffect(() => {
    if (membership) {
      fetchCalendarData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership, displayMonth]);

  // Subscribe to scheduled_hours changes in real-time
  useEffect(() => {
    if (!membership || !user) return;

    const channel = supabase
      .channel(`worker-calendar-scheduled-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_hours",
          filter: `user_id=eq.${user.id}`,
      },
      () => {
        console.log("🔄 Scheduled hours updated, refreshing calendar...");
        fetchCalendarData();
      }
    )
    .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [membership, user]);

  useEffect(() => {
    if (!membership || !user) return;

    const absenceChannel = supabase
      .channel(`worker-calendar-absences-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "absences",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("🔄 Ausencias actualizadas, refrescando calendario...");
          fetchCalendarData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(absenceChannel);
    };
  }, [membership, user]);

  const fetchCalendarData = async () => {
    if (!membership || !user) return;

    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);

    try {
      // Work sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("work_sessions")
        .select("id, clock_in_time, clock_out_time, total_work_duration")
        .eq("company_id", membership.company_id)
        .eq("user_id", user.id)
        .gte("clock_in_time", monthStart.toISOString())
        .lte("clock_in_time", monthEnd.toISOString());
      if (sessionsError) throw sessionsError;
      setWorkSessions((sessions as WorkSession[]) || []);

      // Absences
      const { data: absencesData, error: absencesError } = await supabase
        .from("absences")
        .select("id, absence_type, start_date, end_date, status, reason")
        .eq("user_id", user.id)
        .or(
          `and(start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(
            monthStart,
            "yyyy-MM-dd"
          )})`
        );
      if (absencesError) throw absencesError;
      setAbsences((absencesData as Absence[]) || []);

      // Scheduled hours
      const { data: scheduled, error: scheduledError } = await supabase
        .from("scheduled_hours")
        .select("id, date, expected_hours, start_time, end_time")
        .eq("user_id", user.id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (scheduledError) throw scheduledError;
      setScheduledHours((scheduled as ScheduledHours[]) || []);

      // Approved adjustments
      const { data: adjustments, error: adjustmentsError } = await supabase
        .from("approved_absences")
        .select("*, approver:approved_by(full_name)")
        .eq("user_id", user.id)
        .eq("company_id", membership.company_id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (adjustmentsError) throw adjustmentsError;
      setApprovedAdjustments((adjustments as ApprovedAbsence[]) || []);

      // Time events (with geo)
      const { data: events, error: eventsError } = await supabase
        .from("time_events")
        .select("id, event_type, event_time, latitude, longitude")
        .eq("user_id", user.id)
        .gte("event_time", monthStart.toISOString())
        .lte("event_time", monthEnd.toISOString())
        .order("event_time", { ascending: false });
      if (eventsError) throw eventsError;
      setTimeEvents((events as TimeEvent[]) || []);
    } catch (error) {
      toast.error("Error al cargar datos del calendario");
      console.error(error);
    }
  };

  const getWorkedHours = (checkDate: Date): number => {
    const sessions = workSessions.filter((s) => isSameDay(parseISO(s.clock_in_time), checkDate));
    let totalMinutes = 0;
    sessions.forEach((s) => {
      if (s.total_work_duration) {
        const parts = s.total_work_duration.match(/(\d+):(\d+):(\d+)/);
        if (parts) {
          const hours = parseInt(parts[1], 10);
          const minutes = parseInt(parts[2], 10);
          totalMinutes += hours * 60 + minutes;
        }
      } else if (s.clock_in_time) {
        const start = parseISO(s.clock_in_time).getTime();
        const end = s.clock_out_time ? parseISO(s.clock_out_time).getTime() : Date.now();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          totalMinutes += Math.floor((end - start) / (1000 * 60));
        }
      }
    });
    return totalMinutes / 60;
  };

  const getExpectedHours = (checkDate: Date): number => {
    const sh = scheduledHours.find((x) => isSameDay(parseISO(x.date), checkDate));
    return sh ? Number(sh.expected_hours) : 0;
  };

  const getScheduledEntry = (checkDate: Date): ScheduledHours | null =>
    scheduledHours.find((x) => isSameDay(parseISO(x.date), checkDate)) || null;

  const formatScheduleLabel = (schedule?: ScheduledHours | null) => {
    if (!schedule?.start_time && !schedule?.end_time) return "Sin horario asignado";
    const formatTimeValue = (value?: string | null) => {
      if (!value) return "--:--";
      try {
        const parsed = parse(value, "HH:mm:ss", new Date());
        return format(parsed, "HH:mm");
      } catch {
        return value.slice(0, 5);
      }
    };
    const start = formatTimeValue(schedule.start_time);
    const end = formatTimeValue(schedule.end_time);
    return `${start} - ${end}`;
  };

  const getAbsenceForDate = (checkDate: Date): Absence | null =>
    absences.find((a) => {
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return checkDate >= start && checkDate <= end;
    }) || null;

  const getEventsForDate = (checkDate: Date): TimeEvent[] =>
    timeEvents.filter((e) => isSameDay(parseISO(e.event_time), checkDate));

  const getApprovedAbsencesForDate = (checkDate: Date): ApprovedAbsence[] =>
    approvedAdjustments.filter((adjustment) => {
      const approvedDate = parseISO(adjustment.date);
      return isSameDay(approvedDate, checkDate);
    });

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
  };

  useEffect(() => {
    if (!date) return;
    const worked = getWorkedHours(date);
    const expected = getExpectedHours(date);
    const absence = getAbsenceForDate(date);
    const events = getEventsForDate(date);
    const adjustments = getApprovedAbsencesForDate(date);
    setSelectedDateData({
      worked,
      expected,
      absence,
      events,
      approvedAbsences: adjustments,
      schedule: getScheduledEntry(date),
    });
  }, [date, workSessions, scheduledHours, absences, timeEvents, approvedAdjustments]);

  const getAbsencesForDate = (checkDate: Date): Absence[] =>
    absences.filter((a) => {
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return checkDate >= start && checkDate <= end;
    });

  const getDayStatuses = (dayDate: Date): DayStatusKey[] => {
    const statuses: DayStatusKey[] = [];
    const dateKey = format(dayDate, "yyyy-MM-dd");
    const isHoliday = holidaySet.has(dateKey);
    if (isHoliday) {
      statuses.push("holiday");
    }
    const dayAbsences = getAbsencesForDate(dayDate);
    const hasVacation = dayAbsences.some((absence) => absence.absence_type === "vacation");
    const hasOtherAbsence = !hasVacation && dayAbsences.length > 0;

    if (hasVacation) {
      statuses.push("vacation");
    } else if (hasOtherAbsence) {
      statuses.push("absence");
    }

    const expectedHours = scheduledMap.get(dateKey) ?? 0;
    const workedHours = getWorkedHours(dayDate);
    const isIncomplete = expectedHours > 0 && workedHours < expectedHours && !hasVacation && !hasOtherAbsence;
    if (isIncomplete) {
      statuses.push("incomplete");
    }

    if (workedHours > 0 && !hasVacation) {
      statuses.push("work");
    }

    return statuses;
  };

  const modifiers = {
    hasWork: (day: Date) => getWorkedHours(day) > 0,
    hasAbsence: (day: Date) => getAbsencesForDate(day).length > 0,
    hasScheduled: (day: Date) => scheduledMap.has(format(day, "yyyy-MM-dd")),
    hasApproval: (day: Date) => getApprovedAbsencesForDate(day).length > 0,
  };

  const dayContent = ({ date: dayDate }: DayContentProps) => {
    const statuses = getDayStatuses(dayDate);

    return (
      <div className="calendar-day-wrapper">
        <span className="calendar-day-number">{dayDate.getDate()}</span>
        <CalendarDayIndicators statuses={statuses} />
      </div>
    );
  };

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
    <div className="max-w-4xl mx-auto pt-4 sm:pt-8 space-y-4 sm:space-y-6">
      <PageHeader
        icon={CalendarIcon}
        title="Mi Calendario"
        description="Consulta tus horas trabajadas y programadas"
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-card border-none shadow-none p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Calendario mensual</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDisplayMonth((m) => subMonths(m, 1))}
                  className="h-8 w-8 rounded-lg border border-border/60 bg-background/80 hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-xl sm:text-2xl font-semibold capitalize min-w-[160px] text-center">
                  {format(displayMonth, "MMMM yyyy", { locale: es })}
                </h2>
                <button
                  type="button"
                  onClick={() => setDisplayMonth((m) => addMonths(m, 1))}
                  className="h-8 w-8 rounded-lg border border-border/60 bg-background/80 hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Día seleccionado</p>
              <p className="text-sm font-medium">{format(date ?? new Date(), "PP", { locale: es })}</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-2 calendar-expanded">
            <Calendar
              mode="single"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={date}
              onSelect={handleDateSelect}
              locale={es}
              modifiers={modifiers}
              components={{ DayContent: dayContent }}
              classNames={{ caption: "hidden", nav: "hidden" }}
              className="w-full pointer-events-auto"
            />
          </div>

          {/* Leyenda compacta */}
          <div className="pt-2 flex flex-wrap gap-2">
            {[
              { cls: "calendar-indicator-pill-work", label: "Trabajado" },
              { cls: "calendar-indicator-pill-vacation", label: "Vacaciones" },
              { cls: "calendar-indicator-pill-incomplete", label: "Incompleto" },
              { cls: "calendar-indicator-pill-absence", label: "Ausencia" },
              { cls: "calendar-indicator-pill-holiday", label: "Festivo" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40 text-xs text-muted-foreground">
                <span className={`calendar-indicator-pill ${item.cls}`} />
                {item.label}
              </div>
            ))}
          </div>
      </Card>

        {selectedDateData && date && (
          <Card className="glass-card p-6 space-y-5">
            <h2 className="text-xl font-bold mb-4">
              {format(date, "d 'de' MMMM 'de' yyyy", { locale: es })}
            </h2>

            {selectedDateData.absence ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold">Ausencia Registrada</h3>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Tipo:</span>{" "}
                    {selectedDateData.absence.absence_type === "vacation"
                      ? "Vacaciones"
                      : selectedDateData.absence.absence_type === "sick_leave"
                      ? "Baja médica"
                      : selectedDateData.absence.absence_type === "personal"
                      ? "Personal"
                      : "Otro"}
                  </p>
                  <p>
                    <span className="font-medium">Estado:</span>{" "}
                    <Badge
                      variant={
                        selectedDateData.absence.status === "approved"
                          ? "default"
                          : selectedDateData.absence.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selectedDateData.absence.status === "approved"
                        ? "Aprobada"
                        : selectedDateData.absence.status === "rejected"
                        ? "Rechazada"
                        : "Pendiente"}
                    </Badge>
                  </p>
                  {selectedDateData.absence.reason && (
                    <p>
                      <span className="font-medium">Motivo:</span>{" "}
                      {selectedDateData.absence.reason}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Horas</h3>
                </div>
                <div className="rounded-2xl bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
                  <span>Horario asignado</span>
                  <span className="font-semibold">{formatScheduleLabel(selectedDateData.schedule)}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span>Horas trabajadas:</span>
                    <span className="font-bold text-lg">{(() => { const mins = Math.round(selectedDateData.worked * 60); const hh = String(Math.floor(mins/60)).padStart(2,'0'); const mm = String(mins%60).padStart(2,'0'); return `${hh}:${mm}h`; })()}</span>
                  </div>
                  {selectedDateData.expected > 0 && (
                    <>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span>Horas programadas:</span>
                        <span className="font-bold text-lg">{(() => { const mins = Math.round(selectedDateData.expected * 60); const hh = String(Math.floor(mins/60)).padStart(2,'0'); const mm = String(mins%60).padStart(2,'0'); return `${hh}:${mm}h`; })()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span>Diferencia:</span>
                        <span className={`font-bold text-lg ${selectedDateData.worked >= selectedDateData.expected ? "text-green-600" : "text-orange-600"}`}>
                          {(() => { const diff = selectedDateData.worked - selectedDateData.expected; const sign = diff < 0 ? '-' : ''; const mins = Math.round(Math.abs(diff) * 60); const hh = String(Math.floor(mins/60)).padStart(2,'0'); const mm = String(mins%60).padStart(2,'0'); return `${sign}${hh}:${mm}h`; })()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {selectedDateData.events.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center gap-4 mb-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Ubicaciones de fichaje</h3>
                      <div className="ml-auto flex items-center gap-2">
                        <Switch id="mini-maps" checked={miniMapsEnabled} onCheckedChange={setMiniMapsEnabled} />
                        <Label htmlFor="mini-maps" className="text-sm text-muted-foreground">
                          Mini-mapas en tabla
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedDateData.events.map((event) => (
                        <div key={event.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {event.event_type === "clock_in"
                                ? "Entrada"
                                : event.event_type === "clock_out"
                                ? "Salida"
                                : event.event_type === "pause_start"
                                ? "Inicio pausa"
                                : "Fin pausa"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(event.event_time), "HH:mm")}
                            </span>
                          </div>

                          {event.latitude && event.longitude ? (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-primary flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Ver mapa
                              </span>

                              <HoverCard openDelay={100}>
                                <HoverCardTrigger asChild>
                                  <a
                                    href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" /> Abrir Google Maps
                                  </a>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-[220px] p-2">
                                  <PrivateMap
                                    lat={event.latitude}
                                    lng={event.longitude}
                                    zoom={14}
                                    height={140}
                                  />
                                </HoverCardContent>
                              </HoverCard>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin ubicación registrada</span>
                          )}

                          {miniMapsEnabled && event.latitude && event.longitude && (
                            <div className="pt-2">
                              <PrivateMap
                                lat={event.latitude}
                                lng={event.longitude}
                                zoom={14}
                                height={140}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateData.approvedAbsences.length > 0 && (
                  <div className="pt-6 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold">Ajustes de horario aprobados</h3>
                    </div>
                    {selectedDateData.approvedAbsences.map((adjustment) => (
                      <div key={adjustment.id} className="rounded-lg bg-muted/70 p-3 space-y-1 text-sm">
                        <p className="font-semibold">{adjustment.absence_type}</p>
                        <p>
                          <span className="font-medium">Hora aprobada:</span>{" "}
                          {adjustment.time_change ?? "Sin hora especificada"}
                        </p>
                        {adjustment.notes && (
                          <p>
                            <span className="font-medium">Nota:</span> {adjustment.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Aprobado por {adjustment.approver?.full_name || adjustment.approved_by} el{" "}
                          {new Date(adjustment.approved_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
    </AppLayout>
  );
};

export default WorkerCalendar;
