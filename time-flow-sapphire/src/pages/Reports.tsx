import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportCSV, printHTML } from "@/lib/exports";
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

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444"];

const Reports = () => {
  const { user } = useAuth();
  const { companyId, membership, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessionsRaw, setSessionsRaw] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

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

  useEffect(() => {
    if (companyId) {
      fetchReportData();
    }
  }, [companyId, startDate, endDate, selectedCenter, selectedEmployee]);

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
      setSessionsRaw(sessions || []);

      // Get time events for punctuality analysis
      let eventsQuery = supabase
        .from("time_events")
        .select(`
          user_id,
          event_type,
          event_time,
          profiles!inner(center_id)
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

      sessions?.forEach((session: any) => {
        const userId = session.user_id;
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            full_name: session.profiles.full_name || session.profiles.email,
            email: session.profiles.email,
            total_hours: 0,
            total_days: 0,
            avg_delay: 0,
            correct_checks: 0,
            incidents: 0,
            punctuality_score: 100,
          });
        }

        const stats = userStatsMap.get(userId)!;
        
        // Calculate hours
        if (session.clock_in_time && session.clock_out_time) {
          const hours = (new Date(session.clock_out_time).getTime() - new Date(session.clock_in_time).getTime()) / (1000 * 60 * 60);
          stats.total_hours += hours;
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

  const exportToPDF = () => {
    const centerLabel = selectedCenter === "all" ? "Todos los centros" : (centers.find(c => c.id === selectedCenter)?.name || "Centro");
    const header = `<h1>Registro de jornada (${startDate} a ${endDate})</h1>
      <div class='muted'>${membership?.company.name || "Empresa"} · ${centerLabel} · ${new Date().toLocaleString("es-ES")} · ${employeeStats.length} empleados</div>`;
    const rows = employeeStats.map((s) => `<tr>
      <td>${s.full_name}</td>
      <td>${s.email}</td>
      <td>${s.total_hours.toFixed(2)}</td>
      <td>${s.total_days}</td>
      <td>${s.avg_delay.toFixed(0)}</td>
      <td>${s.correct_checks}</td>
      <td>${s.incidents}</td>
      <td>${s.punctuality_score.toFixed(1)}</td>
    </tr>`).join("");
    const table = `<table><thead><tr><th>Empleado</th><th>Email</th><th>Horas</th><th>Días</th><th>Retraso (min)</th><th>Correctos</th><th>Incidencias</th><th>Puntualidad</th></tr></thead><tbody>${rows}</tbody></table>`;
    const signatures = `
      <div style="display:flex;gap:32px;justify-content:space-between;margin-top:24px">
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Firma y sello de la empresa</div>
        </div>
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Visto por representación legal de las personas trabajadoras</div>
        </div>
      </div>`;
    printHTML("Registro de jornada · GTiQ", `${header}${table}${signatures}`);
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
      const hours = start && end ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : "";
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

  const exportMonthlyPDF = () => {
    const center = centers.find((c) => c.id === selectedCenter);
    const ym = startDate.slice(0, 7);
    const header = `<h1>Resumen mensual · ${center?.name || "Centro"} (${ym})</h1>
      <div class='muted'>${membership?.company.name || "Empresa"} · ${new Date().toLocaleString("es-ES")} · ${employeeStats.length} empleados</div>`;
    const rows = employeeStats.map((s) => `<tr>
      <td>${s.full_name}</td>
      <td>${s.email}</td>
      <td>${s.total_days}</td>
      <td>${s.total_hours.toFixed(2)}</td>
    </tr>`).join("");
    const table = `<table><thead><tr><th>Empleado</th><th>Email</th><th>Días</th><th>Horas</th></tr></thead><tbody>${rows}</tbody></table>`;
    const signatures = `
      <div style="display:flex;gap:32px;justify-content:space-between;margin-top:24px">
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Firma y sello de la empresa</div>
        </div>
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Visto por representación legal de las personas trabajadoras</div>
        </div>
      </div>`;
    printHTML(`Resumen mensual ${ym} · GTiQ`, `${header}${table}${signatures}`);
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
    exportMonthlyPDF();
    toast.success("Paquete mensual generado (CSV + PDF)");
  };

  // Prepare chart data
  const hoursChartData = employeeStats
    .slice(0, 10)
    .map((stat) => ({
      name: stat.full_name.split(" ")[0],
      hours: parseFloat(stat.total_hours.toFixed(1)),
    }));

  const punctualityChartData = employeeStats
    .slice(0, 5)
    .map((stat) => ({
      name: stat.full_name.split(" ")[0],
      score: parseFloat(stat.punctuality_score.toFixed(1)),
    }));

  const totalStats = {
    totalHours: employeeStats.reduce((sum, s) => sum + s.total_hours, 0),
    totalEmployees: employeeStats.length,
    avgPunctuality: employeeStats.length > 0
      ? employeeStats.reduce((sum, s) => sum + s.punctuality_score, 0) / employeeStats.length
      : 0,
    totalIncidents: employeeStats.reduce((sum, s) => sum + s.incidents, 0),
  };

  const correctnessRate = employeeStats.length > 0
    ? (employeeStats.reduce((sum, s) => sum + s.correct_checks, 0) / 
       employeeStats.reduce((sum, s) => sum + s.total_days, 0)) * 100
    : 0;

  const statusData = [
    { name: "Correctos", value: correctnessRate },
    { name: "Con incidencias", value: 100 - correctnessRate },
  ];

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
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reportes y Métricas</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
              </p>
            </div>
          </div>
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
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportMonthlyPackage}>
                <FileText className="w-4 h-4 mr-2" /> Paquete legal mensual (CSV + PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>

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

          {/* Correctness Pie Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Fichajes correctos vs incidencias
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
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
    </div>
  );
};

export default Reports;
