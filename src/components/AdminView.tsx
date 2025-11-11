import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, TrendingUp, LogOut, AlertCircle, BarChart3, Calendar, Settings, Tablet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import NotificationBell from "@/components/NotificationBell";
import { CompanySelector } from "@/components/CompanySelector";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DailyStats {
  date: string;
  hours: number;
  checkIns: number;
}

const AdminView = () => {
  const { signOut } = useAuth();
  const { companyId, membership } = useMembership();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeUsers: 0,
    todayCheckIns: 0,
    pendingIncidents: 0,
    totalHoursToday: 0,
    totalHoursWeek: 0,
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyStatus, setCompanyStatus] = useState<string>("active");

  useEffect(() => {
    if (companyId) {
      fetchAllData();
      fetchCompanyStatus();
    }
  }, [companyId]);

  const fetchCompanyStatus = async () => {
    const { data } = await supabase
      .from("companies")
      .select("status")
      .eq("id", companyId)
      .single();

    if (data) {
      setCompanyStatus(data.status || "active");
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchRecentEvents(),
      fetchWeeklyData(),
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();

    // Active users (open work sessions)
    const { count: activeCount } = await supabase
      .from("work_sessions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_active", true);

    // Today's check-ins
    const { count: checkInsCount } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", "clock_in")
      .gte("event_time", startOfToday);

    // Pending incidents
    const { count: incidentsCount } = await supabase
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");

    // Total hours today
    const { data: todaySessions } = await supabase
      .from("work_sessions")
      .select("clock_in_time, clock_out_time, total_pause_duration")
      .eq("company_id", companyId)
      .gte("clock_in_time", startOfToday);

    const totalHoursToday = calculateTotalHours(todaySessions || []);

    // Total hours this week
    const { data: weekSessions } = await supabase
      .from("work_sessions")
      .select("clock_in_time, clock_out_time, total_pause_duration")
      .eq("company_id", companyId)
      .gte("clock_in_time", startOfWeek);

    const totalHoursWeek = calculateTotalHours(weekSessions || []);

    setStats({
      activeUsers: activeCount || 0,
      todayCheckIns: checkInsCount || 0,
      pendingIncidents: incidentsCount || 0,
      totalHoursToday,
      totalHoursWeek,
    });
  };

  const calculateTotalHours = (sessions: any[]) => {
    return sessions.reduce((total, session) => {
      if (!session.clock_in_time) return total;
      
      const clockIn = new Date(session.clock_in_time).getTime();
      const clockOut = session.clock_out_time 
        ? new Date(session.clock_out_time).getTime() 
        : Date.now();
      
      const diffMs = clockOut - clockIn;
      const hours = diffMs / (1000 * 60 * 60);
      
      return total + hours;
    }, 0);
  };

  const fetchWeeklyData = async () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const dailyData: DailyStats[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const { data: sessions } = await supabase
        .from("work_sessions")
        .select("clock_in_time, clock_out_time")
        .eq("company_id", companyId)
        .gte("clock_in_time", date.toISOString())
        .lt("clock_in_time", nextDay.toISOString());

      const { count: checkInsCount } = await supabase
        .from("time_events")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("event_type", "clock_in")
        .gte("event_time", date.toISOString())
        .lt("event_time", nextDay.toISOString());

      const hours = calculateTotalHours(sessions || []);

      dailyData.push({
        date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        hours: Math.round(hours * 10) / 10,
        checkIns: checkInsCount || 0,
      });
    }

    setWeeklyData(dailyData);
  };

  const fetchRecentEvents = async () => {
    const { data } = await supabase
      .from("time_events")
      .select(`
        *,
        profile:profiles(full_name, email)
      `)
      .eq("company_id", companyId)
      .order("event_time", { ascending: false })
      .limit(8);

    setRecentEvents(data || []);
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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventIcon = (type: string) => {
    const iconClass = "w-5 h-5 text-primary";
    switch (type) {
      case "clock_in":
        return <Clock className={iconClass} />;
      case "clock_out":
        return <LogOut className={iconClass} />;
      default:
        return <Calendar className={iconClass} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Company Status Warning */}
        {(companyStatus === "grace" || companyStatus === "suspended") && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={cn(
              "p-4 border-2",
              companyStatus === "grace" ? "bg-amber-50 border-amber-500" : "bg-red-50 border-red-500"
            )}>
              <div className="flex items-center gap-3">
                <AlertCircle className={cn(
                  "w-6 h-6",
                  companyStatus === "grace" ? "text-amber-600" : "text-red-600"
                )} />
                <div>
                  <h3 className={cn(
                    "font-semibold",
                    companyStatus === "grace" ? "text-amber-900" : "text-red-900"
                  )}>
                    {companyStatus === "grace" ? "Período de gracia activo" : "Empresa suspendida"}
                  </h3>
                  <p className={cn(
                    "text-sm",
                    companyStatus === "grace" ? "text-amber-700" : "text-red-700"
                  )}>
                    {companyStatus === "grace"
                      ? "Tu suscripción está en período de gracia. Por favor, actualiza tu método de pago."
                      : "Tu empresa ha sido suspendida. Contacta con soporte para más información."}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CompanySelector />
            <NotificationBell />
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/devices")}
              className="hover-scale"
              title="Dispositivos"
            >
              <Tablet className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/correction-requests")}
              className="hover-scale"
              title="Solicitudes de corrección"
            >
              <AlertCircle className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/reports")}
              className="hover-scale"
              title="Reportes"
            >
              <BarChart3 className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/people")}
              className="hover-scale"
              title="Gestión de Personas"
            >
              <Users className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="hover-scale">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trabajadores activos</p>
                <p className="text-3xl font-bold mt-1">{stats.activeUsers}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichajes de hoy</p>
                <p className="text-3xl font-bold mt-1">{stats.todayCheckIns}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidencias pendientes</p>
                <p className="text-3xl font-bold mt-1">{stats.pendingIncidents}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas totales hoy</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.totalHoursToday.toFixed(1)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Horas trabajadas - Última semana
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
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

          {/* Check-ins Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Fichajes - Última semana
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="checkIns" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Events */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Fichajes recientes
          </h2>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay fichajes registrados
              </p>
            ) : (
              recentEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 smooth-transition hover:bg-secondary animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {event.profile?.full_name || event.profile?.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatEventType(event.event_type)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatTime(event.event_time)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.event_time).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Weekly Summary */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Resumen semanal</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-primary/5">
              <p className="text-2xl font-bold text-primary">
                {stats.totalHoursWeek.toFixed(1)}h
              </p>
              <p className="text-sm text-muted-foreground mt-1">Horas totales</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/5">
              <p className="text-2xl font-bold text-primary">
                {weeklyData.reduce((sum, day) => sum + day.checkIns, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Fichajes</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/5">
              <p className="text-2xl font-bold text-primary">
                {stats.activeUsers}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Activos ahora</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-amber-500/10">
              <p className="text-2xl font-bold text-amber-600">
                {stats.pendingIncidents}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Incidencias</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminView;
