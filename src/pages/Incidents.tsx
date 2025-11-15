import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, RefreshCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type IncidentStatus = "pending" | "resolved" | "dismissed";
type IncidentType =
  | "late_arrival"
  | "early_departure"
  | "missing_checkout"
  | "missing_checkin"
  | "other";

interface IncidentRecord {
  id: string;
  user_id: string;
  company_id: string;
  incident_type: IncidentType;
  incident_date: string;
  status: IncidentStatus;
  description: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: "Pendiente",
  resolved: "Resuelta",
  dismissed: "Descartada",
};

const TYPE_LABELS: Record<IncidentType, string> = {
  late_arrival: "Llegada tarde",
  early_departure: "Salida anticipada",
  missing_checkout: "Cierre pendiente",
  missing_checkin: "Entrada pendiente",
  other: "Otra incidencia",
};

const TYPE_COLORS: Record<IncidentType, string> = {
  late_arrival: "bg-amber-100 text-amber-800",
  early_departure: "bg-blue-100 text-blue-800",
  missing_checkout: "bg-rose-100 text-rose-700",
  missing_checkin: "bg-teal-100 text-teal-700",
  other: "bg-secondary text-secondary-foreground",
};

const Incidents = () => {
  const { user } = useAuth();
  const { companyId, role } = useMembership();
  const location = useLocation();

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("pending");
  const [refreshing, setRefreshing] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focus = params.get("focus");
    setFocusId(focus);
  }, [location.search]);

  const fetchIncidents = useCallback(async () => {
    if (!companyId) return;
    setRefreshing(true);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select(`
          *,
          profiles:profiles!incidents_user_id_fkey(full_name, email)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIncidents((data as IncidentRecord[]) ?? []);
    } catch (err) {
      console.error("Error fetching incidents:", err);
      toast.error("No pudimos cargar las incidencias");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchIncidents();
    }
  }, [companyId, fetchIncidents]);

  const filteredIncidents = useMemo(() => {
    if (statusFilter === "all") return incidents;
    return incidents.filter((incident) => incident.status === statusFilter);
  }, [incidents, statusFilter]);

  const updateIncidentStatus = async (incidentId: string, status: IncidentStatus | "pending") => {
    if (!user?.id) return;
    try {
      await supabase
        .from("incidents")
        .update({
          status,
          resolved_by: status === "pending" ? null : user.id,
          resolved_at: status === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", incidentId);

      toast.success(
        status === "pending"
          ? "Incidencia reabierta"
          : status === "resolved"
          ? "Incidencia resuelta"
          : "Incidencia descartada"
      );
      fetchIncidents();
    } catch (error) {
      console.error("Error updating incident:", error);
      toast.error("No se pudo actualizar la incidencia");
    }
  };

  const renderStatusActions = (incident: IncidentRecord) => {
    if (!canManage) return null;
    if (incident.status === "pending") {
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => updateIncidentStatus(incident.id, "resolved")}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Resolver
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateIncidentStatus(incident.id, "dismissed")}
          >
            Descartar
          </Button>
        </div>
      );
    }

    return (
      <Button size="sm" variant="ghost" onClick={() => updateIncidentStatus(incident.id, "pending")}>
        Reabrir
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6 pt-8 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Incidencias</h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento de fichajes problemáticos y alertas automáticas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="resolved">Resueltas</SelectItem>
                <SelectItem value="dismissed">Descartadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchIncidents}>
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 mr-2" />
              )}
              Actualizar
            </Button>
          </div>
        </div>

        <Card className="glass-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-amber-500/10">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-3xl font-bold text-amber-600">
                {incidents.filter((i) => i.status === "pending").length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10">
              <p className="text-sm text-muted-foreground">Resueltas</p>
              <p className="text-3xl font-bold text-green-600">
                {incidents.filter((i) => i.status === "resolved").length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-secondary/60">
              <p className="text-sm text-muted-foreground">Total registradas</p>
              <p className="text-3xl font-bold text-secondary-foreground">{incidents.length}</p>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-0">
          <ScrollArea className="max-h-[70vh]">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Clock className="w-8 h-8" />
                <p>No hay incidencias con este filtro.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={cn(
                      "p-4 space-y-3 smooth-transition",
                      focusId === incident.id && "bg-primary/5 border-l-4 border-primary"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("capitalize", TYPE_COLORS[incident.incident_type])}>
                            {TYPE_LABELS[incident.incident_type]}
                          </Badge>
                          <Badge variant="outline">{STATUS_LABELS[incident.status]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Registrada el{" "}
                          {new Date(incident.created_at).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {renderStatusActions(incident)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {incident.profiles?.full_name || incident.profiles?.email || "Empleado"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {incident.description || "No se añadió descripción adicional."}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Última actualización</p>
                        <p>
                          {new Date(incident.updated_at).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};

export default Incidents;
