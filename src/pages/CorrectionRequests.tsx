import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AlertCircle, ArrowLeft, CheckCircle, XCircle, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CorrectionRequest {
  id: string;
  user_id: string;
  submitted_by: string;
  payload: any;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
  manager_id: string | null;
  profile: {
    full_name: string;
    email: string;
  };
}

const CorrectionRequests = () => {
  const { user } = useAuth();
  const { companyId, role, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);

  // Form state for new request
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [eventType, setEventType] = useState<string>("clock_in");
  const [requestReason, setRequestReason] = useState("");

  const isWorker = role === "worker";
  const canManage = role === "owner" || role === "admin" || role === "manager";

  useEffect(() => {
    if (!membershipLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!companyId) {
        toast.error("No tienes una empresa asignada");
        navigate("/");
        return;
      }
      fetchRequests();
    }
  }, [companyId, user, membershipLoading, navigate]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("correction_requests")
        .select(`
          *,
          profile:profiles!correction_requests_user_id_fkey(full_name, email)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      // Workers only see their own requests
      if (isWorker) {
        query = query.eq("user_id", user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Error al cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestDate || !requestTime || !requestReason.trim()) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        event_type: eventType,
        event_time: `${requestDate}T${requestTime}:00`,
        reason: requestReason,
      };

      const { error } = await supabase.from("correction_requests").insert({
        company_id: companyId,
        user_id: user?.id,
        submitted_by: user?.id,
        payload,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Solicitud enviada correctamente");
      setShowNewRequest(false);
      setRequestDate("");
      setRequestTime("");
      setRequestReason("");
      setEventType("clock_in");
      fetchRequests();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error(error.message || "Error al enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    requestId: string,
    newStatus: "approved" | "rejected",
    reason?: string
  ) => {
    setLoading(true);
    try {
      const request = requests.find((r) => r.id === requestId);
      
      const { error } = await supabase
        .from("correction_requests")
        .update({
          status: newStatus,
          manager_id: user?.id,
          reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      // If approved, create the time event
      if (newStatus === "approved" && request) {
        const { error: eventError } = await supabase.from("time_events").insert({
          company_id: companyId,
          user_id: request.user_id,
          event_type: request.payload.event_type,
          event_time: request.payload.event_time,
          source: "web",
          notes: `Corrección aprobada: ${request.payload.reason}`,
        });

        if (eventError) {
          console.error("Error creating time event:", eventError);
          toast.error("Solicitud aprobada pero error al crear el evento");
        }
      }

      // Create notification for the worker
      if (request) {
        await supabase.from("notifications").insert({
          company_id: companyId,
          user_id: request.user_id,
          title: newStatus === "approved" ? "Solicitud aprobada" : "Solicitud rechazada",
          message: newStatus === "approved"
            ? `Tu solicitud de corrección para el ${new Date(request.payload.event_time).toLocaleString("es-ES")} ha sido aprobada.`
            : `Tu solicitud de corrección ha sido rechazada. ${reason ? `Motivo: ${reason}` : ""}`,
          type: newStatus === "approved" ? "success" : "error",
          entity_type: "correction_request",
          entity_id: requestId,
        });
      }

      toast.success(
        newStatus === "approved"
          ? "Solicitud aprobada"
          : "Solicitud rechazada"
      );
      fetchRequests();
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast.error(error.message || "Error al actualizar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendiente</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rechazada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatEventType = (type: string) => {
    const types: Record<string, string> = {
      clock_in: "Entrada",
      clock_out: "Salida",
      pause_start: "Inicio pausa",
      pause_end: "Fin pausa",
    };
    return types[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8">
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
              <AlertCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Solicitudes de Corrección</h1>
              <p className="text-sm text-muted-foreground">
                {isWorker ? "Mis solicitudes" : "Gestionar solicitudes"}
              </p>
            </div>
          </div>
          {isWorker && (
            <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
              <DialogTrigger asChild>
                <Button className="hover-scale">
                  <FileText className="w-4 h-4 mr-2" />
                  Nueva Solicitud
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmitRequest}>
                  <DialogHeader>
                    <DialogTitle>Nueva Solicitud de Corrección</DialogTitle>
                    <DialogDescription>
                      Solicita la corrección de un fichaje perdido u olvidado
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                          id="date"
                          type="date"
                          value={requestDate}
                          onChange={(e) => setRequestDate(e.target.value)}
                          required
                          max={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div>
                        <Label htmlFor="time">Hora</Label>
                        <Input
                          id="time"
                          type="time"
                          value={requestTime}
                          onChange={(e) => setRequestTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="eventType">Tipo de evento</Label>
                      <Select value={eventType} onValueChange={setEventType}>
                        <SelectTrigger id="eventType">
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
                      <Label htmlFor="reason">Motivo</Label>
                      <Textarea
                        id="reason"
                        placeholder="Explica por qué necesitas esta corrección..."
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        required
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowNewRequest(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar Solicitud"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Stats */}
        {canManage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card p-6 hover-scale smooth-transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-3xl font-bold mt-1">
                    {requests.filter((r) => r.status === "pending").length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </Card>
            <Card className="glass-card p-6 hover-scale smooth-transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aprobadas</p>
                  <p className="text-3xl font-bold mt-1">
                    {requests.filter((r) => r.status === "approved").length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </Card>
            <Card className="glass-card p-6 hover-scale smooth-transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rechazadas</p>
                  <p className="text-3xl font-bold mt-1">
                    {requests.filter((r) => r.status === "rejected").length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Requests Table */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">
            {canManage ? "Todas las solicitudes" : "Mis solicitudes"}
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Empleado</TableHead>}
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitada</TableHead>
                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 7 : 5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Cargando solicitudes...
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 7 : 5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay solicitudes
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow
                      key={request.id}
                      className="smooth-transition hover:bg-secondary/50"
                    >
                      {canManage && (
                        <TableCell className="font-medium">
                          <div>
                            <div>{request.profile?.full_name || "Sin nombre"}</div>
                            <div className="text-xs text-muted-foreground">
                              {request.profile?.email}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="font-mono text-sm">
                          {new Date(request.payload.event_time).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatEventType(request.payload.event_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={request.payload.reason}>
                          {request.payload.reason}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString("es-ES")}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {request.status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprobar
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Aprobar solicitud</DialogTitle>
                                    <DialogDescription>
                                      ¿Estás seguro de aprobar esta solicitud? Se creará
                                      automáticamente el evento de fichaje.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button
                                      variant="ghost"
                                      onClick={() => {}}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        handleUpdateStatus(request.id, "approved")
                                      }
                                      disabled={loading}
                                    >
                                      Confirmar
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rechazar
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Rechazar solicitud</DialogTitle>
                                    <DialogDescription>
                                      Proporciona una razón para el rechazo (opcional)
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Label htmlFor="rejectReason">Motivo del rechazo</Label>
                                    <Textarea
                                      id="rejectReason"
                                      placeholder="Explica por qué rechazas esta solicitud..."
                                      rows={3}
                                    />
                                  </div>
                                  <DialogFooter>
                                    <Button variant="ghost">Cancelar</Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => {
                                        const reason = (
                                          document.getElementById(
                                            "rejectReason"
                                          ) as HTMLTextAreaElement
                                        )?.value;
                                        handleUpdateStatus(
                                          request.id,
                                          "rejected",
                                          reason
                                        );
                                      }}
                                      disabled={loading}
                                    >
                                      Confirmar rechazo
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {request.status === "approved" ? "Aprobada" : "Rechazada"}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CorrectionRequests;
