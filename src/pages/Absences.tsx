import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ABSENCE_REASONS, DEFAULT_ABSENCE_REASON } from "@/data/absenceReasons";
import OwnerQuickNav from "@/components/OwnerQuickNav";

interface AbsencePayload {
  type: "absence";
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface Absence {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  payload: AbsencePayload;
}

const Absences = () => {
  const { user } = useAuth();
  const { companyId } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedReason, setSelectedReason] = useState(DEFAULT_ABSENCE_REASON);
  const [otherReason, setOtherReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user && companyId) {
      fetchAbsences();
    }
  }, [user, companyId]);

  const fetchAbsences = async () => {
    try {
      const { data, error } = await supabase
        .from("correction_requests")
        .select("*")
        .eq("user_id", user?.id)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAbsences((data as any[])?.map(item => ({
        ...item,
        payload: item.payload as AbsencePayload
      })) as Absence[] || []);
    } catch (error) {
      console.error("Error fetching absences:", error);
      toast.error("Error al cargar las ausencias");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedReasonMeta = ABSENCE_REASONS.find((item) => item.value === selectedReason);
    const finalReason =
      selectedReason === "otro" ? otherReason.trim() : selectedReasonMeta?.label ?? selectedReason;
    
    if (selectedReason === "otro" && !otherReason.trim()) {
      toast.error("Especifica el motivo de la ausencia");
      return;
    }

    if (!finalReason) {
      toast.error("Por favor indica el motivo");
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("La fecha de inicio debe ser anterior a la fecha de fin");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("correction_requests")
        .insert({
          user_id: user?.id,
          submitted_by: user?.id,
          company_id: companyId,
          reason: finalReason,
          status: "pending",
        payload: {
          type: "absence",
          start_date: startDate || null,
          end_date: endDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
        },
        description: `${finalReason}${startTime ? ` desde las ${startTime}` : ""}${
          endTime ? ` hasta las ${endTime}` : ""
        }`,
        });

      if (error) throw error;

      toast.success("Solicitud de ausencia enviada correctamente");
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setSelectedReason(DEFAULT_ABSENCE_REASON);
      setOtherReason("");
      setDialogOpen(false);
      fetchAbsences();
    } catch (error) {
      console.error("Error creating absence request:", error);
      const message = error instanceof Error ? error.message : "Error al enviar la solicitud";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <BackButton to="/" />
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mis Ausencias</h1>
              <p className="text-sm text-muted-foreground">Solicitudes de vacaciones y permisos</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hover-scale">
                <Send className="w-4 h-4 mr-2" />
                Nueva Solicitud
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Solicitud de Ausencia</DialogTitle>
                <DialogDescription>
                  Solicita vacaciones o un permiso especial
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Fecha de inicio (opcional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Hora inicio (opcional)</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Hora fin (opcional)</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absence-reason">Motivo</Label>
                  <Select
                    value={selectedReason}
                    onValueChange={setSelectedReason}
                  >
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
                {selectedReason === "otro" && (
                  <div className="space-y-2">
                    <Label htmlFor="absence-other">Describe el motivo</Label>
                    <Input
                      id="absence-other"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Explica el motivo de la ausencia"
                      required
                    />
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar Solicitud"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        <OwnerQuickNav />

        {/* Absences List */}
        <div className="space-y-4">
          {absences.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay solicitudes de ausencia</h3>
              <p className="text-muted-foreground mb-6">
                Comienza solicitando tu primera ausencia o vacaciones
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                Nueva Solicitud
              </Button>
            </Card>
          ) : (
            absences.map((absence) => {
              const startDateValue = absence.payload.start_date ? new Date(absence.payload.start_date) : null;
              const endDateValue = absence.payload.end_date ? new Date(absence.payload.end_date) : null;

              let dateLabel = "Fecha por concretar";
              let daysLabel: string | null = null;

              if (startDateValue && endDateValue) {
                const days =
                  Math.ceil((endDateValue.getTime() - startDateValue.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                dateLabel = `${startDateValue.toLocaleDateString("es-ES")} - ${endDateValue.toLocaleDateString("es-ES")}`;
                daysLabel = `${days} ${days === 1 ? "día" : "días"}`;
              } else if (startDateValue) {
                dateLabel = startDateValue.toLocaleDateString("es-ES");
                daysLabel = "1 día";
              } else if (endDateValue) {
                dateLabel = endDateValue.toLocaleDateString("es-ES");
                daysLabel = "1 día";
              }

              return (
                <motion.div
                  key={absence.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="glass-card p-6 hover-scale smooth-transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">
                            {dateLabel}
                          </h3>
                          {getStatusBadge(absence.status)}
                        </div>
                        {daysLabel && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {daysLabel}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-secondary/10 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-1">Motivo:</p>
                      <p className="text-sm text-muted-foreground">{absence.reason}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Solicitado el {new Date(absence.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Absences;
import { BackButton } from "@/components/BackButton";
