// src/pages/Calendar.tsx
import { useState, useEffect } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, AlertCircle, MapPin, ExternalLink } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
}

const WorkerCalendar = () => {
  const { membership, loading: membershipLoading } = useMembership();
  const { user } = useAuth();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [scheduledHours, setScheduledHours] = useState<ScheduledHours[]>([]);
  const [timeEvents, setTimeEvents] = useState<TimeEvent[]>([]);
  const [selectedDateData, setSelectedDateData] = useState<{
    worked: number;
    expected: number;
    absence: Absence | null;
    events: TimeEvent[];
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

  const mapSrc = (lat: number, lng: number, z = 15) =>
    `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;

  useEffect(() => {
    if (membership && date) {
      fetchCalendarData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership, date]);

  const fetchCalendarData = async () => {
    if (!membership || !user) return;

    const monthStart = startOfMonth(date || new Date());
    const monthEnd = endOfMonth(date || new Date());

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
        .select("*")
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
        .select("*")
        .eq("user_id", user.id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      if (scheduledError) throw scheduledError;
      setScheduledHours((scheduled as ScheduledHours[]) || []);

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

  const getAbsenceForDate = (checkDate: Date): Absence | null =>
    absences.find((a) => {
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return checkDate >= start && checkDate <= end;
    }) || null;

  const getEventsForDate = (checkDate: Date): TimeEvent[] =>
    timeEvents.filter((e) => isSameDay(parseISO(e.event_time), checkDate));

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const worked = getWorkedHours(selectedDate);
      const expected = getExpectedHours(selectedDate);
      const absence = getAbsenceForDate(selectedDate);
      const events = getEventsForDate(selectedDate);
      setSelectedDateData({ worked, expected, absence, events });
    }
  };

  const modifiers = {
    hasWork: (day: Date) => getWorkedHours(day) > 0,
    hasAbsence: (day: Date) => getAbsenceForDate(day) !== null,
    hasScheduled: (day: Date) => getExpectedHours(day) > 0,
  };

  const modifiersStyles = {
    hasWork: { backgroundColor: "hsl(var(--primary))", color: "white" },
    hasAbsence: { backgroundColor: "hsl(var(--destructive))", color: "white" },
    hasScheduled: { backgroundColor: "hsl(var(--secondary))" },
  } as const;

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BackButton />
          <CalendarIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Mi Calendario</h1>
            <p className="text-muted-foreground">Consulta tus horas trabajadas y programadas</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            locale={es}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border pointer-events-auto"
          />

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
              <span className="text-sm">Día trabajado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--destructive))" }} />
              <span className="text-sm">Ausencia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--secondary))" }} />
              <span className="text-sm">Horas programadas</span>
            </div>
          </div>
        </Card>

        {selectedDateData && date && (
          <Card className="p-6">
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
                                  <div className="rounded-md overflow-hidden">
                                    <iframe
                                      title="map-preview"
                                      src={mapSrc(event.latitude, event.longitude, 14)}
                                      width="216"
                                      height="140"
                                      style={{ border: 0 }}
                                      loading="lazy"
                                      referrerPolicy="no-referrer-when-downgrade"
                                    />
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin ubicación registrada</span>
                          )}

                          {miniMapsEnabled && event.latitude && event.longitude && (
                            <div className="pt-2">
                              <div className="rounded-md overflow-hidden border">
                                <iframe
                                  title={`mini-map-${event.id}`}
                                  src={mapSrc(event.latitude, event.longitude, 14)}
                                  width="100%"
                                  height="140"
                                  style={{ border: 0 }}
                                  loading="lazy"
                                  referrerPolicy="no-referrer-when-downgrade"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkerCalendar;
