import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Clock,
  Users,
  ArrowLeft,
  MapPin,
  CalendarClock,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { exportCSV } from "@/lib/exports";
import html2pdf from "html2pdf.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface EmployeeStats {
  user_id: string;
  full_name: string;
  email: string;
  total_hours: number;
  total_days: number;
  avg_delay: number;
  correct_checks: number;
  incidents: number;
  punctuality_score: number;
  company_id: string;
}

interface Center {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface ClockInLocation {
  id?: string;
  user_id: string;
  event_time: string;
  event_type: string;
  latitude?: number;
  longitude?: number;
  profiles?: {
    full_name: string | null;
    email: string | null;
    center_id?: string | null;
  } | null;
}

interface SessionLike {
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_pause_duration?: number;
  profiles?: {
    id?: string;
    full_name: string | null;
    email: string | null;
    center_id: string | null;
  };
}

const buildSessionsFromEvents = (events: ClockInLocation[]) => {
  if (!events || events.length === 0) return [];

  const sessions: SessionLike[] = [];
  const grouped = new Map<string, ClockInLocation[]>();

  events.forEach((event) => {
    if (!grouped.has(event.user_id)) grouped.set(event.user_id, []);
    grouped.get(event.user_id)!.push(event);
  });

  grouped.forEach((userEvents) => {
    userEvents.sort(
      (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
    );

    let current: {
      clockIn?: Date;
      pauseStart?: Date | null;
      pauseMs: number;
      profile: SessionLike["profiles"];
    } | null = null;

    userEvents.forEach((event) => {
      if (event.event_type === "clock_in") {
        if (current?.clockIn) {
          sessions.push({
            user_id: event.user_id,
            clock_in_time: current.clockIn.toISOString(),
            clock_out_time: null,
            total_pause_duration: current.pauseMs,
            profiles: current.profile,
          });
        }
        current = {
          clockIn: new Date(event.event_time),
          pauseStart: null,
          pauseMs: 0,
          profile: {
            full_name: event.profiles?.full_name ?? null,
            email: event.profiles?.email ?? null,
            center_id: event.profiles?.center_id ?? null,
            id: event.user_id,
          },
        };
        return;
      }

      if (!current || !current.clockIn) return;

      if (event.event_type === "pause_start") {
        current.pauseStart = new Date(event.event_time);
        return;
      }

      if (event.event_type === "pause_end" && current.pauseStart) {
        current.pauseMs += new Date(event.event_time).getTime() - current.pauseStart.getTime();
        current.pauseStart = null;
        return;
      }

      if (event.event_type === "clock_out") {
        const clockOut = new Date(event.event_time);
        let pauseMs = current.pauseMs;

        if (current.pauseStart) {
          pauseMs += clockOut.getTime() - current.pauseStart.getTime();
        }

        sessions.push({
          user_id: event.user_id,
          clock_in_time: current.clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
          total_pause_duration: pauseMs,
          profiles: current.profile,
        });

        current = null;
      }
    });

    if (current?.clockIn) {
      sessions.push({
        user_id: current.profile?.id || userEvents[0].user_id,
        clock_in_time: current.clockIn.toISOString(),
        clock_out_time: null,
        total_pause_duration: current.pauseMs,
        profiles: current.profile,
      });
    }
  });

  return sessions;
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444"];
const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAY_FILTERS = [
  { value: "all", label: "Todos los días" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];
const getEventColor = (type: string) => {
  switch (type) {
    case "clock_in":
      return "#10b981";
    case "clock_out":
      return "#ef4444";
    case "pause_start":
      return "#f59e0b";
    case "pause_end":
      return "#f97316";
    default:
      return "#3b82f6";
  }
};
const Reports = () => {
  const { user } = useAuth();
  const { companyId, membership, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessionsRaw, setSessionsRaw] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [scheduleReminderDismissed, setScheduleReminderDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("scheduleReminderDismissed") === "1";
    } catch {
      return false;
    }
  });
  const showScheduleReminder = !scheduleReminderDismissed && !loading && employeeStats.length === 0;
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const [mapEvents, setMapEvents] = useState<ClockInLocation[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<string>("all");
  const filteredMapEvents = useMemo(() => {
    if (selectedWeekday === "all") {
      return mapEvents;
    }
    const weekdayNumber = Number(selectedWeekday);
    return mapEvents.filter((event) => {
      const eventDay = new Date(event.event_time).getDay();
      return eventDay === weekdayNumber;
    });
  }, [mapEvents, selectedWeekday]);
  const eventsWithCoords = useMemo(
    () =>
      filteredMapEvents.filter(
        (event) =>
          typeof event.latitude === "number" && typeof event.longitude === "number"
      ),
    [filteredMapEvents]
  );

  const dismissScheduleReminder = () => {
    setScheduleReminderDismissed(true);
    try {
      localStorage.setItem("scheduleReminderDismissed", "1");
    } catch {
      // ignore storage issues
    }
  };
  const uniqueEmployeesOnMap = useMemo(() => {
    return new Set(filteredMapEvents.map((event) => event.user_id)).size;
  }, [filteredMapEvents]);

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
      fetchFiltersData();
    }
  }, [companyId, user, membershipLoading, navigate]);

  const fetchMapEvents = useCallback(async () => {
    if (!companyId) return;
    setMapLoading(true);
    try {
      let query = supabase
        .from("time_events")
        .select(`
          id,
          user_id,
          event_time,
          event_type,
          latitude,
          longitude
        `)
        .eq("company_id", companyId)
        .eq("event_type", "clock_in")
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

      const events = (data as ClockInLocation[]) || [];
      const userIds = Array.from(new Set(events.map((event) => event.user_id)));

      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        profilesMap = (profileRows || []).reduce(
          (acc, profile) => {
            acc[profile.id] = {
              full_name: profile.full_name,
              email: profile.email,
            };
            return acc;
          },
          {} as Record<string, { full_name: string | null; email: string | null }>
        );
      }

      setMapEvents(
        events.map((event) => ({
          ...event,
          profiles: profilesMap[event.user_id] ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching map data:", error);
      setMapEvents([]);
      toast.error("No pudimos cargar el mapa de fichajes");
    } finally {
      setMapLoading(false);
    }
  }, [companyId, endDate, selectedEmployee, startDate]);

  useEffect(() => {
    if (companyId) {
      fetchReportData();
    }
  }, [companyId, startDate, endDate, selectedCenter, selectedEmployee]);

  useEffect(() => {
    if (companyId) {
      fetchMapEvents();
    }
  }, [companyId, fetchMapEvents]);

  useEffect(() => {
    if (leafletMapRef.current || !mapContainerRef.current) return;

    const mapInstance = L.map(mapContainerRef.current, {
      center: [40.4168, -3.7038],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance);

    leafletMapRef.current = mapInstance;

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 0);

    return () => {
      mapInstance.remove();
      leafletMapRef.current = null;
      leafletMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const mapInstance = leafletMapRef.current;
    if (!mapInstance) return;

    leafletMarkersRef.current.forEach((marker) => marker.remove());
    leafletMarkersRef.current = [];

    if (eventsWithCoords.length === 0) return;

    const bounds = L.latLngBounds([]);

    eventsWithCoords.forEach((event) => {
      const icon = L.divIcon({
        className: "",
        html: `<span style="
          background:${getEventColor(event.event_type)};
          width:22px;
          height:22px;
          display:block;
          border:3px solid #ffffff;
          border-radius:50%;
          box-shadow:0 4px 10px rgba(0,0,0,0.25);
        "></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const leafletMarker = L.marker([event.latitude, event.longitude], { icon }).addTo(mapInstance);
      leafletMarker.bindPopup(
        `<strong>${event.profiles?.full_name || event.profiles?.email || "Empleado"}</strong><br/>
         ${new Date(event.event_time).toLocaleDateString("es-ES")} · ${new Date(event.event_time).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );

      leafletMarkersRef.current.push(leafletMarker);
      bounds.extend([event.latitude, event.longitude]);
    });

    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [eventsWithCoords]);

  const fetchFiltersData = async () => {
    // Fetch centers
    const { data: centersData } = await supabase
      .from("centers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    setCenters(centersData || []);

    // Fetch employees
    const { data: employeesData } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        memberships!inner(company_id)
      `)
      .eq("memberships.company_id", companyId)
      .order("full_name");

    setEmployees(employeesData || []);
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Build query for work sessions
      let query = supabase
        .from("work_sessions")
        .select(`
          user_id,
          clock_in_time,
          clock_out_time,
          total_work_duration,
          total_pause_duration,
          profiles!inner(id, full_name, email, center_id)
        `)
        .eq("company_id", companyId)
        .gte("clock_in_time", `${startDate}T00:00:00`)
        .lte("clock_in_time", `${endDate}T23:59:59`);

      if (selectedCenter !== "all") {
        query = query.eq("profiles.center_id", selectedCenter);
      }

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      const { data: sessions } = await query;

      // Get time events for punctuality analysis (also used for fallback sessions)
      let eventsQuery = supabase
        .from("time_events")
        .select(`
          user_id,
          event_type,
          event_time,
          profiles!inner(id, full_name, email, center_id)
        `)
        .eq("company_id", companyId)
        .gte("event_time", `${startDate}T00:00:00`)
        .lte("event_time", `${endDate}T23:59:59`);

      if (selectedCenter !== "all") {
        eventsQuery = eventsQuery.eq("profiles.center_id", selectedCenter);
      }

      if (selectedEmployee !== "all") {
        eventsQuery = eventsQuery.eq("user_id", selectedEmployee);
      }

      const { data: events } = await eventsQuery;

      let sessionsData: SessionLike[] = (sessions as SessionLike[]) || [];

      if ((!sessionsData || sessionsData.length === 0) && events && events.length > 0) {
        sessionsData = buildSessionsFromEvents(events as ClockInLocation[]);
      }

      setSessionsRaw(sessionsData);

      // Get incidents
      let incidentsQuery = supabase
        .from("incidents")
        .select("user_id, status")
        .eq("company_id", companyId)
        .gte("incident_date", startDate)
        .lte("incident_date", endDate);

      if (selectedEmployee !== "all") {
        incidentsQuery = incidentsQuery.eq("user_id", selectedEmployee);
      }

      const { data: incidents } = await incidentsQuery;

      // Process data by user
      const userStatsMap = new Map<string, EmployeeStats>();

      sessionsData?.forEach((session) => {
        const userId = session.user_id;
        const profileInfo = session.profiles || {
          full_name: "Empleado",
          email: "",
          center_id: null,
        };
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            full_name: profileInfo.full_name || profileInfo.email || "Empleado",
            email: profileInfo.email || "",
            total_hours: 0,
            total_days: 0,
            avg_delay: 0,
            correct_checks: 0,
            incidents: 0,
            punctuality_score: 100,
            company_id: companyId || "unknown",
          });
        }

        const stats = userStatsMap.get(userId)!;
        
        // Calculate hours
        if (session.clock_in_time) {
          const start = new Date(session.clock_in_time).getTime();
          const end = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
          const pauseMs = Number(session.total_pause_duration ?? 0);
          const duration = Math.max(0, end - start - (isNaN(pauseMs) ? 0 : pauseMs));
          stats.total_hours += duration / (1000 * 60 * 60);
          stats.total_days += 1;
        }
      });

      // Calculate punctuality (delay from 9:00 AM)
      events?.forEach((event: any) => {
        if (event.event_type === 'clock_in') {
          const stats = userStatsMap.get(event.user_id);
          if (stats) {
            const eventTime = new Date(event.event_time);
            const scheduledStart = new Date(eventTime);
            scheduledStart.setHours(9, 0, 0, 0);
            
            const delayMinutes = (eventTime.getTime() - scheduledStart.getTime()) / (1000 * 60);
            
            if (delayMinutes > 0) {
              stats.avg_delay = (stats.avg_delay + delayMinutes) / 2;
            }
            
            if (Math.abs(delayMinutes) <= 5) {
              stats.correct_checks += 1;
            }
          }
        }
      });

      // Add incidents
      incidents?.forEach((incident: any) => {
        const stats = userStatsMap.get(incident.user_id);
        if (stats) {
          stats.incidents += 1;
        }
      });

      // Calculate punctuality score
      userStatsMap.forEach((stats) => {
        const totalChecks = stats.total_days;
        if (totalChecks > 0) {
          const correctRate = (stats.correct_checks / totalChecks) * 100;
          const delayPenalty = Math.min(stats.avg_delay, 30); // Max 30 min penalty
          stats.punctuality_score = Math.max(0, correctRate - delayPenalty);
        }
      });

      const statsArray = Array.from(userStatsMap.values());
      statsArray.sort((a, b) => b.punctuality_score - a.punctuality_score);

      setEmployeeStats(statsArray);
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Error al cargar los datos del reporte");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Empleado",
      "Email",
      "Horas Totales",
      "Días Trabajados",
      "Retraso Promedio (min)",
      "Fichajes Correctos",
      "Incidencias",
      "Puntuación Puntualidad",
    ];
    const rows = employeeStats.map((stat) => [
      stat.full_name,
      stat.email,
      stat.total_hours.toFixed(2),
      stat.total_days,
      stat.avg_delay.toFixed(0),
      stat.correct_checks,
      stat.incidents,
      stat.punctuality_score.toFixed(1),
    ]);
    exportCSV(`reporte_${startDate}_${endDate}`, headers, rows);
    toast.success("Reporte exportado correctamente");
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) {
      toast.error("No se encontró el contenido del informe para generar el PDF");
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

  // Paquete legal mensual (requiere centro seleccionado y mes completo)
  const isMonthlyRange = () => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
    const first = new Date(s.getFullYear(), s.getMonth(), 1);
    const last = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    const sd = s.toISOString().slice(0, 10);
    const ed = e.toISOString().slice(0, 10);
    const fd = first.toISOString().slice(0, 10);
    const ld = last.toISOString().slice(0, 10);
    return sd === fd && ed === ld && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  };

  const exportMonthlyCSV = () => {
    const center = centers.find((c) => c.id === selectedCenter);
    const headers = ["Fecha", "Empleado", "Email", "Entrada", "Salida", "Horas"];
    const rows = sessionsRaw.map((s: any) => {
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const pauseMs = Number(s.total_pause_duration ?? 0);
      const durationMs =
        start && (end || true)
          ? (end ? end.getTime() : Date.now()) - start.getTime() - (isNaN(pauseMs) ? 0 : pauseMs)
          : 0;
      const hours = start ? (Math.max(0, durationMs) / (1000 * 60 * 60)).toFixed(2) : "";
      return [
        start ? start.toISOString().slice(0, 10) : end ? end.toISOString().slice(0, 10) : "",
        s.profiles?.full_name || s.profiles?.email || "",
        s.profiles?.email || "",
        start ? start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        hours,
      ];
    });
    const label = center?.name ? center.name.replace(/\s+/g, "_") : "centro";
    const ym = startDate.slice(0, 7);
    exportCSV(`paquete_${label}_${ym}`, headers, rows);
  };

  const exportMonthlyPackage = () => {
    if (selectedCenter === "all") {
      toast.error("Selecciona un centro para generar el paquete mensual");
      return;
    }
    if (!isMonthlyRange()) {
      toast.error("Ajusta el intervalo al mes completo (1º al último día)");
      return;
    }
    exportMonthlyCSV();
    toast.success("Paquete mensual generado (CSV)");
  };

  // Prepare chart data
  const hoursChartData = employeeStats
    .filter((stat) => stat.company_id === companyId)
    .sort((a, b) => b.total_hours - a.total_hours)
    .slice(0, 10)
    .map((stat) => ({
      name: stat.full_name || stat.email,
      hours: parseFloat(stat.total_hours.toFixed(1)),
    }));

  const punctualityChartData = employeeStats
    .filter((stat) => stat.company_id === companyId)
    .sort((a, b) => b.punctuality_score - a.punctuality_score)
    .slice(0, 5)
    .map((stat) => ({
      name: stat.full_name || stat.email,
      score: parseFloat(stat.punctuality_score.toFixed(1)),
    }));

  const companyStats = employeeStats.filter((stat) => stat.company_id === companyId);

  const totalStats = {
    totalHours: companyStats.reduce((sum, s) => sum + s.total_hours, 0),
    totalEmployees: companyStats.length,
    avgPunctuality: companyStats.length > 0
      ? companyStats.reduce((sum, s) => sum + s.punctuality_score, 0) / companyStats.length
      : 0,
    totalIncidents: companyStats.reduce((sum, s) => sum + s.incidents, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto pt-8">
        <div ref={reportRef} className="space-y-6">
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
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reportes y Métricas</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreviewPDF} className="hover-scale">
              <Download className="w-4 h-4 mr-2" /> Descargar PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportMonthlyPackage}>
                  <FileText className="w-4 h-4 mr-2" /> Paquete legal mensual (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {showScheduleReminder && (
          <Alert className="glass-card border-primary/30 bg-primary/5">
            <AlertTitle className="flex items-center gap-2 text-primary">
              <CalendarClock className="w-4 h-4" />
              Configura tus jornadas y turnos
            </AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm">
              <span>
                Aún no detectamos ningún horario planificado para tu empresa. Configura calendarios,
                turnos o ausencias para que los reportes muestren horas previstas y alertas.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate("/manager-calendar")}>
                  Abrir calendario
                </Button>
                <Button variant="ghost" size="sm" onClick={dismissScheduleReminder}>
                  Omitir
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="center">Centro</Label>
              <Select value={selectedCenter} onValueChange={setSelectedCenter}>
                <SelectTrigger id="center" className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los centros</SelectItem>
                  {centers.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="employee">Empleado</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee" className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Location map */}
        <Card className="glass-card p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Mapa de fichajes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Visualiza desde dónde han fichado tus empleados en el período seleccionado.
                </p>
              </div>
              <div className="w-full md:w-64 space-y-1">
                <Label htmlFor="weekday-filter">Día de la semana</Label>
                <Select value={selectedWeekday} onValueChange={setSelectedWeekday}>
                  <SelectTrigger id="weekday-filter">
                    <SelectValue placeholder="Todos los días" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
              <div className="rounded-xl border bg-muted/30 overflow-hidden min-h-[360px] relative">
                <div ref={mapContainerRef} className="w-full h-[360px]" />
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm">
                    Cargando ubicaciones...
                  </div>
                )}
                {!mapLoading && eventsWithCoords.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/70 backdrop-blur-sm text-center px-6">
                    No hay fichajes con coordenadas para este filtro.
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-secondary/40">
                  <p className="text-sm text-muted-foreground">Registros mostrados</p>
                  <p className="text-3xl font-bold">
                    {filteredMapEvents.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedWeekday === "all"
                      ? "Incluyendo todos los días"
                      : `Solo ${WEEKDAY_LABELS[Number(selectedWeekday)]}s`}
                  </p>
                  <div className="mt-3 text-sm">
                    Empleados únicos:{" "}
                    <span className="font-semibold">{uniqueEmployeesOnMap}</span>
                  </div>
                </div>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {mapLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando ubicaciones...</p>
                  ) : filteredMapEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay fichajes con ubicación para este filtro.
                    </p>
                  ) : (
                    filteredMapEvents.slice(0, 5).map((event) => {
                      const eventDate = new Date(event.event_time);
                      return (
                        <div
                          key={event.id}
                          className="p-3 rounded-xl border bg-background/40 flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {event.profiles?.full_name || event.profiles?.email || "Empleado"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {eventDate.toLocaleDateString("es-ES", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                })}{" "}
                                ·{" "}
                                {eventDate.toLocaleTimeString("es-ES", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            Ver en Google Maps
                          </a>
                        </div>
                      );
                    })
                  )}
                  {filteredMapEvents.length > 5 && (
                    <p className="text-xs text-muted-foreground text-right">
                      Mostrando los últimos 5 registros
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Totales</p>
                <p className="text-3xl font-bold mt-1">
                  {totalStats.totalHours.toFixed(0)}h
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
                <p className="text-sm text-muted-foreground">Empleados</p>
                <p className="text-3xl font-bold mt-1">{totalStats.totalEmployees}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Puntualidad Media</p>
                <p className="text-3xl font-bold mt-1">
                  {totalStats.avgPunctuality.toFixed(0)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidencias</p>
                <p className="text-3xl font-bold mt-1">{totalStats.totalIncidents}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Top 10 - Horas trabajadas
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hoursChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Punctuality Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top 5 - Ranking de puntualidad
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={punctualityChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="score" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

        </div>

        {/* Employee Stats Table */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Detalle por empleado
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Retraso (min)</TableHead>
                  <TableHead className="text-right">Correctos</TableHead>
                  <TableHead className="text-right">Incidencias</TableHead>
                  <TableHead className="text-right">Puntualidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </TableCell>
                  </TableRow>
                ) : employeeStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay datos para el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeStats.map((stat, index) => (
                    <TableRow key={stat.user_id} className="smooth-transition hover:bg-secondary/50">
                      <TableCell className="font-medium">
                        <div>
                          <div>{stat.full_name}</div>
                          <div className="text-xs text-muted-foreground">{stat.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.total_hours.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">{stat.total_days}</TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.avg_delay.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">{stat.correct_checks}</TableCell>
                      <TableCell className="text-right">
                        {stat.incidents > 0 ? (
                          <Badge variant="destructive">{stat.incidents}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            stat.punctuality_score >= 90
                              ? "default"
                              : stat.punctuality_score >= 70
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {stat.punctuality_score.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
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
            <Button onClick={handleDownloadPDF}>Descargar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
};

export default Reports;
