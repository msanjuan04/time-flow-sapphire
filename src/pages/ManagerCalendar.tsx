import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Users, Plus, AlertCircle, Trash2, Pencil, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import type { DayContentProps } from "react-day-picker";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SPANISH_HOLIDAYS } from "@/data/spainHolidays";
import { ABSENCE_REASONS, DEFAULT_ABSENCE_REASON } from "@/data/absenceReasons";
import CalendarDayIndicators, { DayStatusKey } from "@/components/CalendarDayIndicators";
import { QuickSchedulePanel } from "@/components/schedule/QuickSchedulePanel";
import ScheduleHoursDialog from "@/components/ScheduleHoursDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface WorkSession {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_work_duration: string | null;
}

interface ManagerTimeEvent {
  id: string;
  event_type: string;
  event_time: string;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: string | null;
  point_id?: string | null;
}

interface ScheduledHour {
  id: string;
  date: string;
  expected_hours: number;
}

interface AbsenceRecord {
  id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
}

interface DayOverview {
  workedHours: number;
  scheduledHours?: number;
  absence?: AbsenceRecord;
}

const ManagerCalendar = () => {
  const { membership, loading: membershipLoading } = useMembership();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [searchParams] = useSearchParams();
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [noticeProcessing, setNoticeProcessing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [timeEvents, setTimeEvents] = useState<ManagerTimeEvent[]>([]);
  const [scheduledHours, setScheduledHours] = useState<ScheduledHour[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<ManagerTimeEvent[]>([]);
  const [eventType, setEventType] = useState<string>("clock_in");
  const [eventTime, setEventTime] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ManagerTimeEvent | null>(null);
  const [editEventType, setEditEventType] = useState<string>("clock_in");
  const [editEventTime, setEditEventTime] = useState<string>("");
  const [teamDayOverview, setTeamDayOverview] = useState<Record<string, DayOverview>>({});
  const holidaySet = useMemo(
    () => new Set(SPANISH_HOLIDAYS.map((holiday) => holiday.date)),
    []
  );

  // Absence form
  const [absenceType, setAbsenceType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [absenceReasonType, setAbsenceReasonType] = useState(DEFAULT_ABSENCE_REASON);
  const [absenceOtherReason, setAbsenceOtherReason] = useState("");
  const mapSrc = (lat: number, lng: number, z = 15) =>
    `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;

  const renderSourceBadge = (event: ManagerTimeEvent) => {
    const sourceLabel =
      event.source === "fastclock"
        ? "FastClock"
        : event.source
        ? event.source
        : event.point_id
        ? "FastClock"
        : null;
    if (!sourceLabel && !event.point_id) return null;
    return (
      <Badge variant="secondary" className="text-[11px]">
        {sourceLabel || "FastClock"}
        {event.point_id ? ` · ${event.point_id}` : ""}
      </Badge>
    );
  };

  useEffect(() => {
    if (membership) {
      fetchEmployees();
    }
  }, [membership]);

  // Preseleccionar empleado desde ?user=<id>
  useEffect(() => {
    const uid = searchParams.get("user");
    if (uid) setSelectedEmployee(uid);
  }, [searchParams]);

  const generateNotice = useCallback(() => {
    if (!date) {
      return "Selecciona un día para que pueda generar el aviso.";
    }
    const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });
    const relevantAbsences = absences.filter((absence) => {
      const start = parseISO(absence.start_date);
      const end = parseISO(absence.end_date);
      return date >= start && date <= end;
    });
    const absenceSummary =
      relevantAbsences.length > 0
        ? `Tenemos ${relevantAbsences.length} ausencia${relevantAbsences.length > 1 ? "s" : ""} planificada${
            relevantAbsences.length > 1 ? "" : "a"
          } para hoy (${formattedDate}).`
        : `Por ahora no hay ausencias registradas para ${formattedDate}.`;
    const scheduledForDay = scheduledHours.find((scheduled) => isSameDay(parseISO(scheduled.date), date));
    const scheduleSummary = scheduledForDay
      ? `El turno programado es de ${scheduledForDay.expected_hours.toFixed(2)} h`
      : "No hay turnos programados para hoy.";
    return `Aviso rápido para el equipo del día ${formattedDate}:\n${absenceSummary} ${scheduleSummary}`;
  }, [absences, date, scheduledHours]);

  const copyNoticeToClipboard = async () => {
    if (!noticeText) return;
    setNoticeProcessing(true);
    try {
      await navigator.clipboard.writeText(noticeText);
      toast.success("Aviso copiado para pegarlo donde lo necesites");
    } catch (error) {
      console.error("No se pudo copiar el aviso:", error);
      toast.error("No pudimos copiar el aviso al portapapeles");
    } finally {
      setNoticeProcessing(false);
    }
  };

  const fetchCalendarData = useCallback(async () => {
    if (!membership || !selectedEmployee) return;

    // Usar displayMonth para los límites del mes (no date)
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);

    const { data, error } = await supabase
      .from("time_events")
      .select("id, event_type, event_time, notes, latitude, longitude, source, point_id")
      .eq("company_id", membership.company_id)
      .eq("user_id", selectedEmployee)
      .gte("event_time", monthStart.toISOString())
      .lte("event_time", monthEnd.toISOString())
      .order("event_time", { ascending: true });
    if (!error) {
      setTimeEvents((data as ManagerTimeEvent[]) || []);
    }
    // Fetch scheduled hours for the month
    const { data: sh } = await supabase
      .from("scheduled_hours")
      .select("id, date, expected_hours")
      .eq("user_id", selectedEmployee)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd"));
    setScheduledHours((sh as ScheduledHour[]) || []);

    // Fetch absences for the month overlap
    const { data: abs } = await supabase
      .from("absences")
      .select("id, start_date, end_date, absence_type, status")
      .eq("user_id", selectedEmployee)
      .or(
        `and(start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(monthStart, "yyyy-MM-dd")})`
      );
    setAbsences((abs as AbsenceRecord[]) || []);

    const { data: sessionsData, error: sessionsError } = await supabase
      .from("work_sessions")
      .select("id, clock_in_time, clock_out_time, total_work_duration")
      .eq("company_id", membership.company_id)
      .eq("user_id", selectedEmployee)
      .gte("clock_in_time", monthStart.toISOString())
      .lte("clock_in_time", monthEnd.toISOString());
    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
    } else {
      setWorkSessions((sessionsData as WorkSession[]) || []);
    }
  }, [membership, selectedEmployee, displayMonth]);

  // Load month events when employee or month changes
  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Filtrar eventos del día seleccionado (client-side, 0 queries)
  useEffect(() => {
    if (date && timeEvents.length > 0) {
      setSelectedDayEvents(timeEvents.filter((e) => isSameDay(parseISO(e.event_time), date)));
    } else {
      setSelectedDayEvents([]);
    }
  }, [date, timeEvents]);

  const fetchTeamDayOverview = useCallback(async () => {
    if (!membership || !date) {
      setTeamDayOverview({});
      return;
    }
    const dateStr = format(date, "yyyy-MM-dd");
    const start = `${dateStr}T00:00:00`;
    const end = `${dateStr}T23:59:59`;

    try {
      const [sessionsRes, scheduledRes, absencesRes] = await Promise.all([
        supabase
          .from("work_sessions")
          .select("user_id, clock_in_time, clock_out_time, total_work_duration")
          .eq("company_id", membership.company_id)
          .gte("clock_in_time", start)
          .lte("clock_in_time", end),
        supabase
          .from("scheduled_hours")
          .select("user_id, expected_hours")
          .eq("company_id", membership.company_id)
          .eq("date", dateStr),
        supabase
          .from("absences")
          .select("user_id, start_date, end_date, absence_type, status")
          .eq("company_id", membership.company_id)
          .or(`and(start_date.lte.${dateStr},end_date.gte.${dateStr})`),
      ]);

      if (sessionsRes.error || scheduledRes.error || absencesRes.error) {
        throw new Error("No fue posible obtener el resumen del día");
      }

      const summary: Record<string, DayOverview> = {};

      const addWorkedHours = (userId: string, hoursValue: number) => {
        if (!summary[userId]) {
          summary[userId] = { workedHours: 0 };
        }
        summary[userId].workedHours += hoursValue;
      };

      const parseDuration = (value?: string | null) => {
        if (!value) return 0;
        const parts = value.split(":").map((p) => Number(p));
        const [h = 0, m = 0, s = 0] = parts;
        return (
          (Number.isFinite(h) ? h : 0) +
          (Number.isFinite(m) ? m / 60 : 0) +
          (Number.isFinite(s) ? s / 3600 : 0)
        );
      };

      (sessionsRes.data as WorkSession[] | null)?.forEach((session) => {
        const duration =
          session.total_work_duration && session.total_work_duration !== "00:00:00"
            ? parseDuration(session.total_work_duration)
            : (() => {
                if (!session.clock_in_time) return 0;
                const startTime = parseISO(session.clock_in_time).getTime();
                const endTime = session.clock_out_time
                  ? parseISO(session.clock_out_time).getTime()
                  : Date.now();
                if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return 0;
                return (endTime - startTime) / (1000 * 60 * 60);
              })();
        if (duration > 0) {
          addWorkedHours(session.user_id, duration);
        }
      });

      (scheduledRes.data as { user_id: string; expected_hours: number }[] | null)?.forEach(
        (scheduled) => {
          if (!summary[scheduled.user_id]) {
            summary[scheduled.user_id] = { workedHours: 0 };
          }
          summary[scheduled.user_id].scheduledHours = Number(scheduled.expected_hours ?? 0);
        }
      );

      (absencesRes.data as AbsenceRecord[] | null)?.forEach((absence) => {
        const userId = absence.user_id;
        if (!summary[userId]) {
          summary[userId] = { workedHours: 0 };
        }
        summary[userId].absence = absence;
      });

      setTeamDayOverview(summary);
    } catch (error) {
      console.error("Error fetching day overview:", error);
      setTeamDayOverview({});
    }
  }, [membership, date]);

  useEffect(() => {
    fetchTeamDayOverview();
  }, [fetchTeamDayOverview]);

  // Subscribe to scheduled_hours changes in real-time
  useEffect(() => {
    if (!membership || !selectedEmployee) return;

    const channel = supabase
      .channel(`manager-calendar-scheduled-${selectedEmployee}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_hours",
          filter: `user_id=eq.${selectedEmployee}`,
        },
        () => {
          console.log("🔄 Scheduled hours updated, refreshing calendar...");
          fetchCalendarData();
          fetchTeamDayOverview();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [membership, selectedEmployee, fetchCalendarData, fetchTeamDayOverview]);

  const fetchEmployees = async () => {
    if (!membership) return;

    try {
      // Get all memberships for the company
      const { data: memberships, error: membershipsError } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("company_id", membership.company_id);

      if (membershipsError) throw membershipsError;

      if (memberships && memberships.length > 0) {
        const userIds = memberships.map((m) => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        setEmployees(profiles || []);
      }
    } catch (error) {
      toast.error("Error al cargar empleados");
      console.error(error);
    }
  };

  const persistScheduledHours = async (
    userId: string,
    dateStr: string,
    hours: number,
    notes?: string
  ) => {
    if (!membership) {
      throw new Error("Compañía no disponible");
    }
    const { data: existingSchedule } = await supabase
      .from("scheduled_hours")
      .select("id")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .single();
    if (existingSchedule) {
      const { error } = await supabase
        .from("scheduled_hours")
        .update({
          expected_hours: hours,
          notes: notes ?? null,
        })
        .eq("id", existingSchedule.id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from("scheduled_hours").insert({
      user_id: userId,
      company_id: membership.company_id,
      date: dateStr,
      expected_hours: hours,
      notes: notes ?? null,
      created_by: user?.id ?? membership.company_id,
    });
    if (error) throw error;
  };

  // handleQuickSchedule removido → sustituido por QuickSchedulePanel con presets

  const updateWeekSchedule = (weekIndex: number, patch: Partial<WeekSchedule>) => {
    setWeeklySchedules((prev) =>
      prev.map((week, idx) => (idx === weekIndex ? { ...week, ...patch } : week))
    );
  };

  const handleCreateAbsence = async () => {
    const reasonMeta = ABSENCE_REASONS.find((item) => item.value === absenceReasonType);
    const finalReason =
      absenceReasonType === "otro"
        ? absenceOtherReason.trim()
        : reasonMeta?.label ?? absenceReasonType;

    if (!membership || !selectedEmployee || !startDate || !endDate || !finalReason) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }
    if (absenceReasonType === "otro" && !absenceOtherReason.trim()) {
      toast.error("Especifica el motivo de la ausencia");
      return;
    }

    try {
      const { error } = await supabase.from("absences").insert({
        user_id: selectedEmployee,
        company_id: membership.company_id,
        absence_type: absenceType as "vacation" | "sick_leave" | "personal" | "other",
        start_date: startDate,
        end_date: endDate,
        reason: finalReason,
        status: "approved",
        created_by: selectedEmployee,
        approved_by: selectedEmployee,
        approved_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Ausencia registrada correctamente");
      setIsAbsenceDialogOpen(false);
      setAbsenceType("vacation");
      setStartDate("");
      setEndDate("");
      setAbsenceReasonType(DEFAULT_ABSENCE_REASON);
      setAbsenceOtherReason("");
    } catch (error) {
      toast.error("Error al registrar ausencia");
      console.error(error);
    }
  };

  const refreshSelectedDayEvents = () => {
    if (!date) return;
    setSelectedDayEvents(timeEvents.filter((event) => isSameDay(parseISO(event.event_time), date)));
  };

  const handleAddEvent = async () => {
    if (!membership || !selectedEmployee || !date || !eventTime) {
      toast.error("Selecciona empleado, día y hora");
      return;
    }
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const eventTimestamp = `${dateStr}T${eventTime}:00`;
      // Try to capture current location for traceability (optional)
      let latitude: number | undefined;
      let longitude: number | undefined;
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {}
      }
      const { error } = await supabase.from("time_events").insert({
        user_id: selectedEmployee,
        event_type: eventType as "clock_in" | "clock_out" | "pause_start" | "pause_end",
        event_time: eventTimestamp,
        source: "web",
        notes: "Añadido por manager desde calendario",
        company_id: membership.company_id,
        latitude,
        longitude,
      } as any);
      if (error) throw error;
      toast.success("Evento añadido");
      // Refresh list
      setEventTime("");
      const { data } = await supabase
        .from("time_events")
        .select("id, event_type, event_time, notes, latitude, longitude, source, point_id")
        .eq("company_id", membership.company_id)
        .eq("user_id", selectedEmployee)
        .gte("event_time", startOfMonth(date).toISOString())
        .lte("event_time", endOfMonth(date).toISOString())
        .order("event_time", { ascending: true });
      setTimeEvents((data as ManagerTimeEvent[]) || []);
      refreshSelectedDayEvents();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo añadir el evento");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const { error } = await supabase.from("time_events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Evento eliminado");
      setTimeEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedDayEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar");
    }
  };

  const openScheduleForEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setScheduleDialogOpen(true);
  };

  const openAbsenceForEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    setStartDate(dateStr);
    setEndDate(dateStr);
    setAbsenceType("other");
    setAbsenceReason("Festivo de empresa");
    setIsAbsenceDialogOpen(true);
  };

  const openEdit = (event: ManagerTimeEvent) => {
    setEditingEvent(event);
    setEditEventType(event.event_type);
    setEditEventTime(format(parseISO(event.event_time), "HH:mm"));
    setEditDialogOpen(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;
    try {
      const datePart = format(parseISO(editingEvent.event_time), "yyyy-MM-dd");
      const newTimestamp = `${datePart}T${editEventTime}:00`;
      const { error } = await supabase
        .from("time_events")
        .update({ 
          event_type: editEventType as "clock_in" | "clock_out" | "pause_start" | "pause_end", 
          event_time: newTimestamp 
        })
        .eq("id", editingEvent.id);
      if (error) throw error;
      toast.success("Evento actualizado");
      // Update local state
      setTimeEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? { ...e, event_type: editEventType, event_time: newTimestamp }
            : e
        )
      );
      setSelectedDayEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? { ...e, event_type: editEventType, event_time: newTimestamp }
            : e
        )
      );
      setEditDialogOpen(false);
      setEditingEvent(null);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar");
    }
  };

  const handleCompanyHoliday = async () => {
    if (!membership || !date || !user) {
      toast.error("Selecciona un día del calendario");
      return;
    }
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const actorId = user.id;
      const records = employees.map((emp) => ({
        user_id: emp.id,
        company_id: membership.company_id,
        absence_type: "other" as const,
        start_date: dateStr,
        end_date: dateStr,
        reason: "Festivo de empresa",
        status: "approved" as const,
        created_by: actorId,
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("absences").insert(records);
      if (error) throw error;
      toast.success("Festivo de empresa registrado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el festivo");
    }
  };

  const filteredEmployeesList = employees.filter((e) => {
    const q = search.toLowerCase();
    const name = (e.full_name || e.email || "").toLowerCase();
    return name.includes(q);
  });
  const visibleStatusEmployees = filteredEmployeesList.slice(0, 8);
  const dateLabelForStatus = date ? format(date, "PP", { locale: es }) : "Fecha no seleccionada";

  const workedHoursByDate = useMemo(() => {
    const map = new Map<string, number>();
    workSessions.forEach((session) => {
      if (!session.clock_in_time) return;
      const dateKey = format(parseISO(session.clock_in_time), "yyyy-MM-dd");
      let duration = 0;
      if (session.total_work_duration) {
        const parts = session.total_work_duration.split(":").map((segment) => Number(segment));
        const [h = 0, m = 0, s = 0] = parts;
        duration =
          (Number.isFinite(h) ? h : 0) +
          (Number.isFinite(m) ? m / 60 : 0) +
          (Number.isFinite(s) ? s / 3600 : 0);
      } else if (session.clock_out_time) {
        const startTime = parseISO(session.clock_in_time).getTime();
        const endTime = parseISO(session.clock_out_time).getTime();
        if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime > startTime) {
          duration = (endTime - startTime) / (1000 * 60 * 60);
        }
      }
      if (duration > 0) {
        map.set(dateKey, (map.get(dateKey) ?? 0) + duration);
      }
    });
    return map;
  }, [workSessions]);

  const scheduledMap = useMemo(() => {
    const map = new Map<string, number>();
    scheduledHours.forEach((scheduled) => {
      map.set(scheduled.date, scheduled.expected_hours);
    });
    return map;
  }, [scheduledHours]);

  const getAbsencesForDate = useCallback(
    (target: Date) =>
      absences.filter((absence) => {
        const start = parseISO(absence.start_date);
        const end = parseISO(absence.end_date);
        return target >= start && target <= end;
      }),
    [absences]
  );

  const getDayStatuses = useCallback(
    (dayDate: Date): DayStatusKey[] => {
      const statuses: DayStatusKey[] = [];
      const dateKey = format(dayDate, "yyyy-MM-dd");
      const isHoliday = holidaySet.has(dateKey);
      if (isHoliday) {
        statuses.push("holiday");
      }
      const dayAbsences = getAbsencesForDate(dayDate);
      const hasVacation = dayAbsences.some((absence) => absence.absence_type === "vacation");
      const hasNonVacationAbsence = !hasVacation && dayAbsences.some((absence) => absence.absence_type !== "vacation");
      if (hasVacation) {
        statuses.push("vacation");
      } else if (hasNonVacationAbsence) {
        statuses.push("absence");
      }

      const expectedHours = scheduledMap.get(dateKey) ?? 0;
      const workedHours = workedHoursByDate.get(dateKey) ?? 0;
      const hasIncompleteHours =
        expectedHours > 0 && workedHours < expectedHours && !hasVacation && !hasNonVacationAbsence;
      if (hasIncompleteHours) {
        statuses.push("incomplete");
      }

      if (workedHours > 0 && !hasVacation) {
        statuses.push("work");
      }

      return statuses;
    },
    [getAbsencesForDate, scheduledMap, workedHoursByDate, holidaySet]
  );
  const calendarModifiers = {
    hasWork: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      return (workedHoursByDate.get(key) ?? 0) > 0;
    },
    hasAbsence: (day: Date) => getAbsencesForDate(day).length > 0,
    hasScheduled: (day: Date) => scheduledMap.has(format(day, "yyyy-MM-dd")),
  };

  const renderDayContent = ({ date: dayDate }: DayContentProps) => {
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
      <div className="max-w-7xl mx-auto pt-4 sm:pt-8 pb-8 space-y-5">
        <PageHeader
          icon={CalendarIcon}
          title="Calendario de Equipo"
          description="Gestiona las horas y ausencias de tu equipo"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNoticeText(generateNotice());
                  setNoticeDialogOpen(true);
                }}
              >
                Redactar aviso
              </Button>
              <Button variant="secondary" onClick={handleCompanyHoliday}>
                Marcar festivo
              </Button>
            </div>
          }
        />

      {/* Diálogo de edición de evento */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={editEventType} onValueChange={setEditEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clock_in">Entrada</SelectItem>
                  <SelectItem value="clock_out">Salida</SelectItem>
                  <SelectItem value="pause_start">Inicio pausa</SelectItem>
                  <SelectItem value="pause_end">Fin pausa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={editEventTime} onChange={(e) => setEditEventTime(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpdateEvent}>Guardar cambios</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Redacción asistida</DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Usa el siguiente texto como base para comunicar ausencias o recordatorios al equipo.
            </p>
            <div className="bg-muted/40 rounded-lg p-4 text-sm whitespace-pre-line font-mono min-h-[150px]">
              {noticeText || "Selecciona una fecha para generar el aviso."}
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="ghost" onClick={() => setNoticeDialogOpen(false)}>
              Cerrar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="default"
                disabled={!noticeText || noticeProcessing}
                onClick={copyNoticeToClipboard}
              >
                {noticeProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : "Copiar aviso"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <div className="grid gap-5 lg:grid-cols-[220px_1fr_290px]">
        {/* Sidebar empleados */}
        <Card className="glass-card p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold">Empleados</span>
          </div>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />
          <div className="max-h-[560px] overflow-y-auto space-y-1 pr-1 -mr-1">
            {filteredEmployeesList.map((e) => {
              const isSelected = selectedEmployee === e.id;
              const label = e.full_name || e.email;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEmployee(e.id)}
                  title={label}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm font-medium leading-snug break-words transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/40"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Contenido principal */}
        <div className="space-y-5 min-w-0">
          {/* Quick Schedule Panel — reemplaza "Programar Horas" y "Horas rápidas" */}
          {selectedEmployee && membership && user && (
            <QuickSchedulePanel
              employeeId={selectedEmployee}
              employeeName={
                employees.find((e) => e.id === selectedEmployee)?.full_name ||
                employees.find((e) => e.id === selectedEmployee)?.email ||
                selectedEmployee
              }
              companyId={membership.company_id}
              userId={user.id}
              selectedDate={date ?? new Date()}
              onScheduleApplied={() => { fetchCalendarData(); fetchTeamDayOverview(); }}
              onOpenFullEditor={() => setScheduleDialogOpen(true)}
            />
          )}

          {/* Acciones generales */}
          <div className="flex flex-wrap gap-2">
            {selectedEmployee && (
              <>
                <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="hover-scale">
                      <Plus className="mr-2 h-4 w-4" /> Registrar Ausencia
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Ausencia</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="absence-type">Tipo de Ausencia</Label>
                        <Select value={absenceType} onValueChange={setAbsenceType}>
                          <SelectTrigger id="absence-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vacation">Vacaciones</SelectItem>
                            <SelectItem value="sick_leave">Baja médica</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="other">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Fecha Inicio</Label>
                        <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-date">Fecha Fin</Label>
                        <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="absence-reason">Motivo</Label>
                        <Select value={absenceReasonType} onValueChange={setAbsenceReasonType}>
                          <SelectTrigger id="absence-reason">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ABSENCE_REASONS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {absenceReasonType === "otro" && (
                        <div className="space-y-2">
                          <Label htmlFor="absence-other">Describe el motivo</Label>
                          <Input
                            id="absence-other"
                            value={absenceOtherReason}
                            onChange={(e) => setAbsenceOtherReason(e.target.value)}
                            placeholder="Especifica el motivo de la ausencia"
                          />
                        </div>
                      )}
                      <Button onClick={handleCreateAbsence} className="w-full">Registrar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          {/* Calendario mensual */}
          <Card className="glass-card p-5 sm:p-6 space-y-5 w-full">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                      Calendario mensual
                    </p>
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
                    <p className="text-sm font-medium">
                      {date ? format(date, "PP", { locale: es }) : "Sin seleccionar"}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-2 calendar-expanded">
                  <Calendar
                    mode="single"
                    month={displayMonth}
                    onMonthChange={setDisplayMonth}
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      if (d) {
                        setSelectedDayEvents(
                          timeEvents.filter((e) => isSameDay(parseISO(e.event_time), d))
                        );
                      }
                    }}
                    locale={es}
                    modifiers={calendarModifiers}
                    components={{ DayContent: renderDayContent }}
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

              <Card className="glass-card p-6 space-y-4 w-full">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Estado por trabajador</p>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      Resumen rápido
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{dateLabelForStatus}</p>
                </div>

                {visibleStatusEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay empleados filtrados para este día. Usa el buscador para encontrarlos.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visibleStatusEmployees.map((employee) => {
                      const overview = teamDayOverview[employee.id];
                      const scheduled = overview?.scheduledHours ?? 0;
                      const worked = overview?.workedHours ?? 0;
                      const chips: Array<{ label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = [];
                      if (overview?.absence?.status === "approved") {
                        chips.push({ label: "Ausencia aprobada", variant: "destructive" });
                      }
                      if (!overview?.absence) {
                        if (scheduled > 0 && worked >= scheduled) {
                          chips.push({ label: "Día completo", variant: "default" });
                        } else if (scheduled > 0 && worked > 0 && worked < scheduled) {
                          chips.push({ label: "Faltan horas", variant: "outline" });
                        } else if (worked > 0) {
                          chips.push({ label: "Ha fichado", variant: "secondary" });
                        }
                      }
                      if (chips.length === 0) {
                        chips.push({ label: "Sin actividad", variant: "outline" });
                      }

                      return (
                        <Card
                          key={employee.id}
                          className="glass-card p-4 space-y-4 border border-border/50 backdrop-blur-md"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-base leading-tight">
                              {employee.full_name || employee.email}
                            </p>
                            <p className="text-xs text-muted-foreground break-all">
                              {employee.email}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {chips.map((chip) => (
                              <Badge key={chip.label} variant={chip.variant} className="rounded-full">
                                {chip.label}
                              </Badge>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openScheduleForEmployee(employee.id)}
                              className="w-full"
                            >
                              Programar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAbsenceForEmployee(employee.id)}
                              className="w-full border border-border/60"
                            >
                              Ausencia
                            </Button>
                          </div>

                          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex justify-between">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Prog. {scheduled.toFixed(2)}h
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Reg. {worked.toFixed(2)}h
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {filteredEmployeesList.length > visibleStatusEmployees.length && (
                  <p className="text-xs text-muted-foreground text-right">
                    Mostrando {visibleStatusEmployees.length} de {filteredEmployeesList.length} empleados
                  </p>
                )}
              </Card>
          </div>{/* /col-2 */}

          {/* Col 3: Day management */}
          <div className="space-y-4">
            <Card className="hidden lg:block glass-card p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {date ? format(date, "EEEE d MMM", { locale: es }) : "Día"}
              </p>
              <h3 className="text-base font-semibold">Gestión del día</h3>

              {!selectedEmployee || !date ? (
                <p className="text-sm text-muted-foreground py-2">
                  Selecciona un empleado y un día del calendario.
                </p>
              ) : (
                <>
                  {/* Añadir evento — inputs apilados */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={eventType} onValueChange={setEventType}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clock_in">Entrada</SelectItem>
                            <SelectItem value="clock_out">Salida</SelectItem>
                            <SelectItem value="pause_start">Inicio pausa</SelectItem>
                            <SelectItem value="pause_end">Fin pausa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Hora</Label>
                        <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                    <Button onClick={handleAddEvent} size="sm" className="w-full">Añadir evento</Button>
                  </div>

                  {/* Lista de eventos — compacta */}
                  <div className="pt-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Eventos ({selectedDayEvents.length})
                    </p>
                    {selectedDayEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">Sin eventos este día.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {selectedDayEvents.map((e) => {
                          const eventLabel = e.event_type === "clock_in"
                            ? "Entrada" : e.event_type === "clock_out"
                            ? "Salida" : e.event_type === "pause_start"
                            ? "Inicio pausa" : "Fin pausa";
                          const hasGeo = !!(e.latitude && e.longitude);
                          return (
                            <li key={e.id} className="rounded-lg bg-muted/40 px-3 py-2 space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-semibold tabular-nums">
                                    {format(parseISO(e.event_time), "HH:mm")}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate">{eventLabel}</span>
                                  {renderSourceBadge(e)}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Editar" className="h-7 w-7">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteEvent(e.id)} title="Eliminar" className="h-7 w-7">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {/* Mapa colapsable — solo link, sin iframe por defecto */}
                              {hasGeo && (
                                <a
                                  href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                >
                                  📍 Ver ubicación
                                </a>
                              )}
                              {e.notes && <p className="text-[11px] text-muted-foreground">{e.notes}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Acción secundaria */}
                  <div className="pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        if (!date) return;
                        setAbsenceType("other");
                        const d = format(date, "yyyy-MM-dd");
                        setStartDate(d);
                        setEndDate(d);
                        setAbsenceReason("Festivo");
                        setIsAbsenceDialogOpen(true);
                      }}
                    >
                      Marcar festivo
                    </Button>
                  </div>
                </>
              )}
            </Card>

            {/* Mobile/tablet accordion for day management */}
            <div className="lg:hidden">
              <Accordion type="single" collapsible defaultValue="day-management">
                <AccordionItem value="day-management">
                  <AccordionTrigger className="text-left text-sm">
                    Gestión del día {date ? format(date, "d MMM", { locale: es }) : ""}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    {!selectedEmployee || !date ? (
                      <p className="text-sm text-muted-foreground">
                        Selecciona un empleado y un día del calendario.
                      </p>
                    ) : (
                      <Card className="glass-card p-4 space-y-3">
                        {/* Añadir evento */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <Select value={eventType} onValueChange={setEventType}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="clock_in">Entrada</SelectItem>
                                  <SelectItem value="clock_out">Salida</SelectItem>
                                  <SelectItem value="pause_start">Inicio pausa</SelectItem>
                                  <SelectItem value="pause_end">Fin pausa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Hora</Label>
                              <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-9 text-xs" />
                            </div>
                          </div>
                          <Button onClick={handleAddEvent} size="sm" className="w-full">Añadir evento</Button>
                        </div>

                        {/* Eventos compactos */}
                        <div className="pt-1">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Eventos ({selectedDayEvents.length})</p>
                          {selectedDayEvents.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-3 text-center">Sin eventos.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {selectedDayEvents.map((e) => {
                                const eventLabel = e.event_type === "clock_in"
                                  ? "Entrada" : e.event_type === "clock_out"
                                  ? "Salida" : e.event_type === "pause_start"
                                  ? "Inicio pausa" : "Fin pausa";
                                const hasGeo = !!(e.latitude && e.longitude);
                                return (
                                  <li key={e.id} className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-semibold tabular-nums">{format(parseISO(e.event_time), "HH:mm")}</span>
                                        <span className="text-xs text-muted-foreground truncate">{eventLabel}</span>
                                        {renderSourceBadge(e)}
                                      </div>
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Editar" className="h-7 w-7">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => handleDeleteEvent(e.id)} title="Eliminar" className="h-7 w-7">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    {hasGeo && (
                                      <a href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                        📍 Ver ubicación
                                      </a>
                                    )}
                                    {e.notes && <p className="text-[11px] text-muted-foreground">{e.notes}</p>}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              if (!date) return;
                              setAbsenceType("other");
                              const d = format(date, "yyyy-MM-dd");
                              setStartDate(d);
                              setEndDate(d);
                              setAbsenceReason("Festivo");
                              setIsAbsenceDialogOpen(true);
                            }}
                          >
                            Marcar festivo
                          </Button>
                        </div>
                      </Card>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>{/* /outer-grid */}

        {/* ScheduleHoursDialog — editor completo de jornada */}
        {selectedEmployee && (
          <ScheduleHoursDialog
            key={selectedEmployee}
            open={scheduleDialogOpen}
            onOpenChange={setScheduleDialogOpen}
            employee={{
              id: selectedEmployee,
              full_name: employees.find((e) => e.id === selectedEmployee)?.full_name ?? null,
              email: employees.find((e) => e.id === selectedEmployee)?.email ?? "",
            }}
          />
        )}
      </div>{/* /max-w-7xl */}
    </AppLayout>
  );
};

export default ManagerCalendar;
