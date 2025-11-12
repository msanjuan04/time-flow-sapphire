import { useState, useEffect } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Users, Plus, AlertCircle, Trash2, Pencil, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

const ManagerCalendar = () => {
  const { membership, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [timeEvents, setTimeEvents] = useState<any[]>([]);
  const [scheduledHours, setScheduledHours] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [eventType, setEventType] = useState<string>("clock_in");
  const [eventTime, setEventTime] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editEventType, setEditEventType] = useState<string>("clock_in");
  const [editEventTime, setEditEventTime] = useState<string>("");

  // Schedule hours form
  const [scheduleDate, setScheduleDate] = useState("");
  const [expectedHours, setExpectedHours] = useState("8");
  const [scheduleNotes, setScheduleNotes] = useState("");

  // Absence form
  const [absenceType, setAbsenceType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");

  useEffect(() => {
    if (membership) {
      fetchEmployees();
    }
  }, [membership]);

  // Load month events for selected employee
  useEffect(() => {
    if (!membership || !selectedEmployee || !date) return;

    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("time_events")
        .select("id, event_type, event_time, notes")
        .eq("company_id", membership.company_id)
        .eq("user_id", selectedEmployee)
        .gte("event_time", monthStart.toISOString())
        .lte("event_time", monthEnd.toISOString())
        .order("event_time", { ascending: true });
      if (!error) {
        setTimeEvents(data || []);
        // Also update day events for the currently selected date
        setSelectedDayEvents(
          (data || []).filter((e: any) => isSameDay(parseISO(e.event_time), date!))
        );
      }
      // Fetch scheduled hours for the month
      const { data: sh } = await supabase
        .from("scheduled_hours")
        .select("id, date, expected_hours")
        .eq("user_id", selectedEmployee)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      setScheduledHours(sh || []);

      // Fetch absences for the month overlap
      const { data: abs } = await supabase
        .from("absences")
        .select("id, start_date, end_date, absence_type, status")
        .eq("user_id", selectedEmployee)
        .or(
          `and(start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(monthStart, "yyyy-MM-dd")})`
        );
      setAbsences(abs || []);
    };

    fetchEvents();
  }, [membership, selectedEmployee, date]);

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
    } catch (error: any) {
      toast.error("Error al cargar empleados");
      console.error(error);
    }
  };

  const handleScheduleHours = async () => {
    if (!membership || !selectedEmployee || !scheduleDate) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const { data: existingSchedule } = await supabase
        .from("scheduled_hours")
        .select("id")
        .eq("user_id", selectedEmployee)
        .eq("date", scheduleDate)
        .single();

      if (existingSchedule) {
        const { error } = await supabase
          .from("scheduled_hours")
          .update({
            expected_hours: parseFloat(expectedHours),
            notes: scheduleNotes || null,
          })
          .eq("id", existingSchedule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("scheduled_hours").insert({
          user_id: selectedEmployee,
          company_id: membership.company_id,
          date: scheduleDate,
          expected_hours: parseFloat(expectedHours),
          notes: scheduleNotes || null,
          created_by: membership.company_id, // Use company_id since we don't have user_id in membership
        });

        if (error) throw error;
      }

      toast.success("Horas programadas correctamente");
      setIsScheduleDialogOpen(false);
      setScheduleDate("");
      setExpectedHours("8");
      setScheduleNotes("");
    } catch (error: any) {
      toast.error("Error al programar horas");
      console.error(error);
    }
  };

  const handleCreateAbsence = async () => {
    if (!membership || !selectedEmployee || !startDate || !endDate) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const { error } = await supabase.from("absences").insert({
        user_id: selectedEmployee,
        company_id: membership.company_id,
        absence_type: absenceType as "vacation" | "sick_leave" | "personal" | "other",
        start_date: startDate,
        end_date: endDate,
        reason: absenceReason || null,
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
      setAbsenceReason("");
    } catch (error: any) {
      toast.error("Error al registrar ausencia");
      console.error(error);
    }
  };

  const refreshSelectedDayEvents = () => {
    if (!date) return;
    setSelectedDayEvents(
      timeEvents.filter((e) => isSameDay(parseISO(e.event_time), date))
    );
  };

  const handleAddEvent = async () => {
    if (!membership || !selectedEmployee || !date || !eventTime) {
      toast.error("Selecciona empleado, día y hora");
      return;
    }
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const eventTimestamp = `${dateStr}T${eventTime}:00`;
      const { error } = await supabase.from("time_events").insert({
        company_id: membership.company_id,
        user_id: selectedEmployee,
        event_type: eventType,
        event_time: eventTimestamp,
        source: "web",
        notes: "Añadido por manager desde calendario",
      });
      if (error) throw error;
      toast.success("Evento añadido");
      // Refresh list
      setEventTime("");
      const { data } = await supabase
        .from("time_events")
        .select("id, event_type, event_time, notes")
        .eq("company_id", membership.company_id)
        .eq("user_id", selectedEmployee)
        .gte("event_time", startOfMonth(date).toISOString())
        .lte("event_time", endOfMonth(date).toISOString())
        .order("event_time", { ascending: true });
      setTimeEvents(data || []);
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

  const openEdit = (event: any) => {
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
        .update({ event_type: editEventType, event_time: newTimestamp })
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
    if (!membership || !date) {
      toast.error("Selecciona un día del calendario");
      return;
    }
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const records = employees.map((emp) => ({
        user_id: emp.id,
        company_id: membership.company_id,
        absence_type: "other" as const,
        start_date: dateStr,
        end_date: dateStr,
        reason: "Festivo de empresa",
        status: "approved" as const,
        created_by: emp.id,
        approved_by: emp.id,
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
          <CalendarIcon className="h-8 w-8 text-primary" />
          <div>
          <h1 className="text-3xl font-bold">Calendario de Equipo</h1>
          <p className="text-muted-foreground">
            Gestiona las horas y ausencias de tu equipo
          </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate(-1)} className="hover-scale">
          <ArrowLeft className="w-5 h-5 mr-2" /> Volver
        </Button>
      </div>

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

      <div className="grid md:grid-cols-3 gap-6">
        {/* Sidebar empleados */}
        <Card className="p-4 h-full">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold">Empleados</span>
          </div>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-[480px] overflow-auto space-y-1 pr-2">
            {employees
              .filter((e) => {
                const q = search.toLowerCase();
                const name = (e.full_name || e.email || "").toLowerCase();
                return name.includes(q);
              })
              .map((e) => (
                <Button
                  key={e.id}
                  variant={selectedEmployee === e.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedEmployee(e.id)}
                >
                  {e.full_name || e.email}
                </Button>
              ))}
          </div>
        </Card>

        {/* Contenido principal */}
        <div className="md:col-span-2 space-y-4">
          {/* Acciones generales */}
          <div className="flex flex-wrap gap-2">
            {selectedEmployee && (
              <>
                <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Clock className="mr-2 h-4 w-4" /> Programar Horas
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Programar Horas de Trabajo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-date">Fecha</Label>
                        <Input id="schedule-date" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expected-hours">Horas Esperadas</Label>
                        <Input id="expected-hours" type="number" step="0.5" min="0" max="24" value={expectedHours} onChange={(e) => setExpectedHours(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-notes">Notas (opcional)</Label>
                        <Textarea id="schedule-notes" value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Añade notas sobre este turno..." />
                      </div>
                      <Button onClick={handleScheduleHours} className="w-full">Guardar</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
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
                        <Label htmlFor="absence-reason">Motivo (opcional)</Label>
                        <Textarea id="absence-reason" value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder="Añade un motivo..." />
                      </div>
                      <Button onClick={handleCreateAbsence} className="w-full">Registrar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            <Button variant="secondary" onClick={handleCompanyHoliday}>
              Marcar festivo de empresa
            </Button>
          </div>

          {/* Calendario + gestión del día */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <Calendar
                mode="single"
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
                modifiers={{
                  hasWork: (day: Date) => timeEvents.some((e) => isSameDay(parseISO(e.event_time), day)),
                  hasAbsence: (day: Date) => absences.some((a: any) => {
                    const s = parseISO(a.start_date);
                    const e = parseISO(a.end_date);
                    return day >= s && day <= e;
                  }),
                  hasScheduled: (day: Date) => scheduledHours.some((sh: any) => isSameDay(parseISO(sh.date), day)),
                }}
                modifiersStyles={{
                  hasWork: { backgroundColor: "hsl(var(--primary))", color: "white" },
                  hasAbsence: { backgroundColor: "hsl(var(--destructive))", color: "white" },
                  hasScheduled: { backgroundColor: "hsl(var(--secondary))" },
                }}
                className="rounded-md border pointer-events-auto"
              />
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
                  <span className="text-sm">Día con fichajes</span>
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

            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Gestión del día seleccionado
              </h3>
              {!selectedEmployee || !date ? (
                <p className="text-sm text-muted-foreground">
                  Selecciona un empleado y un día del calendario.
                </p>
              ) : (
                <>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Tipo de evento</Label>
                      <Select value={eventType} onValueChange={setEventType}>
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
                    <div className="w-40">
                      <Label>Hora</Label>
                      <Input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                    </div>
                    <Button onClick={handleAddEvent}>Añadir</Button>
                  </div>

                  <div className="pt-2">
                    <h4 className="font-medium mb-2">Eventos del día</h4>
                    {selectedDayEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay eventos.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedDayEvents.map((e) => (
                          <li key={e.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                            <span className="text-sm">
                              {e.event_type === "clock_in"
                                ? "Entrada"
                                : e.event_type === "clock_out"
                                ? "Salida"
                                : e.event_type === "pause_start"
                                ? "Inicio pausa"
                                : "Fin pausa"}
                              {" • "}
                              {format(parseISO(e.event_time), "HH:mm")}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteEvent(e.id)} title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Otras acciones</span>
                    <Button
                      variant="outline"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerCalendar;
