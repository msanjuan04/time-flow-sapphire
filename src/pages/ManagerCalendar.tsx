import { useState, useEffect } from "react";
import { useMembership } from "@/hooks/useMembership";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Users, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
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
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);

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

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <CalendarIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Calendario de Equipo</h1>
          <p className="text-muted-foreground">
            Gestiona las horas y ausencias de tu equipo
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <Label htmlFor="employee-select" className="text-base font-semibold">
            Seleccionar Empleado
          </Label>
        </div>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger id="employee-select">
            <SelectValue placeholder="Selecciona un empleado" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.full_name || employee.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedEmployee && (
          <div className="mt-6 flex gap-3">
            <Dialog
              open={isScheduleDialogOpen}
              onOpenChange={setIsScheduleDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <Clock className="mr-2 h-4 w-4" />
                  Programar Horas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Programar Horas de Trabajo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">Fecha</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected-hours">Horas Esperadas</Label>
                    <Input
                      id="expected-hours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={expectedHours}
                      onChange={(e) => setExpectedHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-notes">Notas (opcional)</Label>
                    <Textarea
                      id="schedule-notes"
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      placeholder="Añade notas sobre este turno..."
                    />
                  </div>
                  <Button onClick={handleScheduleHours} className="w-full">
                    Guardar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isAbsenceDialogOpen}
              onOpenChange={setIsAbsenceDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Ausencia
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
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">Fecha Fin</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="absence-reason">Motivo (opcional)</Label>
                    <Textarea
                      id="absence-reason"
                      value={absenceReason}
                      onChange={(e) => setAbsenceReason(e.target.value)}
                      placeholder="Añade un motivo..."
                    />
                  </div>
                  <Button onClick={handleCreateAbsence} className="w-full">
                    Registrar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          locale={es}
          className="rounded-md border pointer-events-auto"
        />
      </Card>
    </div>
  );
};

export default ManagerCalendar;
