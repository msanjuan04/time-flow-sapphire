import { useState, useEffect, useRef } from "react";
import { useMembership } from "@/hooks/useMembership";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface TimeEvent {
  id: string;
  event_type: string;
  event_time: string;
  latitude: number;
  longitude: number;
  user_id: string;
  profiles?: {
    full_name: string;
  };
}

const LocationReport = () => {
  const { membership, loading: membershipLoading } = useMembership();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [startDate, setStartDate] = useState(
    format(new Date(new Date().setDate(new Date().getDate() - 7)), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [timeEvents, setTimeEvents] = useState<TimeEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (membership) {
      fetchEmployees();
    }
  }, [membership]);

  useEffect(() => {
    if (membership) {
      fetchLocationData();
    }
  }, [membership, selectedEmployee, startDate, endDate]);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
      
      if (!mapboxToken) {
        toast.error("Token de Mapbox no configurado");
        return;
      }

      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-3.7038, 40.4168], // Madrid por defecto
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    }

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
    };
  }, []);

  useEffect(() => {
    if (map.current && timeEvents.length > 0) {
      updateMapMarkers();
    }
  }, [timeEvents]);

  const fetchEmployees = async () => {
    if (!membership) return;

    try {
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

  const fetchLocationData = async () => {
    if (!membership) return;

    setLoading(true);
    try {
      let query = supabase
        .from("time_events")
        .select(
          `
          id,
          event_type,
          event_time,
          latitude,
          longitude,
          user_id,
          profiles:user_id (full_name)
        `
        )
        .eq("company_id", membership.company_id)
        .gte("event_time", `${startDate}T00:00:00`)
        .lte("event_time", `${endDate}T23:59:59`)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("event_time", { ascending: false });

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTimeEvents((data as any) || []);
    } catch (error: any) {
      toast.error("Error al cargar datos de ubicación");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = () => {
    if (!map.current) return;

    // Limpiar marcadores anteriores
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (timeEvents.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    timeEvents.forEach((event) => {
      const el = document.createElement("div");
      el.className = "location-marker";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "50%";
      el.style.cursor = "pointer";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
      
      // Color según tipo de evento
      if (event.event_type === "clock_in") {
        el.style.backgroundColor = "#10b981"; // verde
      } else if (event.event_type === "clock_out") {
        el.style.backgroundColor = "#ef4444"; // rojo
      } else {
        el.style.backgroundColor = "#f59e0b"; // naranja
      }

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <strong>${event.profiles?.full_name || "Usuario"}</strong><br/>
          <span style="color: #666; font-size: 12px;">
            ${event.event_type === "clock_in"
              ? "Entrada"
              : event.event_type === "clock_out"
              ? "Salida"
              : event.event_type === "pause_start"
              ? "Inicio pausa"
              : "Fin pausa"
            }
          </span><br/>
          <span style="font-size: 12px;">
            ${format(new Date(event.event_time), "dd/MM/yyyy HH:mm", { locale: es })}
          </span>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([event.longitude, event.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
      bounds.extend([event.longitude, event.latitude]);
    });

    // Ajustar el mapa para mostrar todos los marcadores
    if (timeEvents.length > 0) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });
    }
  };

  const exportToCSV = () => {
    if (timeEvents.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = ["Trabajador", "Tipo", "Fecha", "Hora", "Latitud", "Longitud"];
    const rows = timeEvents.map((event) => [
      event.profiles?.full_name || "Sin nombre",
      event.event_type === "clock_in"
        ? "Entrada"
        : event.event_type === "clock_out"
        ? "Salida"
        : event.event_type === "pause_start"
        ? "Inicio pausa"
        : "Fin pausa",
      format(new Date(event.event_time), "dd/MM/yyyy", { locale: es }),
      format(new Date(event.event_time), "HH:mm", { locale: es }),
      event.latitude,
      event.longitude,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ubicaciones_fichaje_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast.success("Datos exportados correctamente");
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
          <MapPin className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Informe de Ubicaciones</h1>
            <p className="text-muted-foreground">
              Visualiza dónde ha fichado tu equipo
            </p>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employee-select">Trabajador</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger id="employee-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los trabajadores</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Fecha inicio</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">Fecha fin</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={fetchLocationData} disabled={loading} className="w-full">
              {loading ? "Cargando..." : "Aplicar filtros"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Resumen</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm">Total registros:</span>
                <span className="font-bold text-lg">{timeEvents.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm">Trabajadores:</span>
                <span className="font-bold text-lg">
                  {new Set(timeEvents.map((e) => e.user_id)).size}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <h4 className="font-semibold text-sm">Leyenda</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                  <span className="text-sm">Entrada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
                  <span className="text-sm">Salida</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white"></div>
                  <span className="text-sm">Pausas</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2 p-0 overflow-hidden">
          <div
            ref={mapContainer}
            className="w-full h-[600px]"
            style={{ minHeight: "600px" }}
          />
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Detalle de ubicaciones</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {timeEvents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay ubicaciones para mostrar
            </p>
          ) : (
            timeEvents.map((event) => (
              <div
                key={event.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        event.event_type === "clock_in"
                          ? "bg-green-500"
                          : event.event_type === "clock_out"
                          ? "bg-red-500"
                          : "bg-orange-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">
                        {event.profiles?.full_name || "Usuario"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.event_type === "clock_in"
                          ? "Entrada"
                          : event.event_type === "clock_out"
                          ? "Salida"
                          : event.event_type === "pause_start"
                          ? "Inicio pausa"
                          : "Fin pausa"}{" "}
                        -{" "}
                        {format(new Date(event.event_time), "dd/MM/yyyy HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                  >
                    <MapPin className="h-4 w-4" />
                    Ver en mapa
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default LocationReport;
