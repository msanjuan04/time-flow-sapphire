import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, TrendingUp, LogOut, AlertCircle, BarChart3, Calendar, Settings, Tablet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import NotificationBell from "@/components/NotificationBell";
import { CompanySelector } from "@/components/CompanySelector";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DEMO_COMPANY_IDS } from "@/config/demo";
import VacationAssignment from "@/components/admin/VacationAssignment";

interface DailyStats {
  date: string;
  hours: number;
  checkIns: number;
}

const mockWeeklyData: DailyStats[] = [
  { date: "lun", hours: 7.8, checkIns: 12 },
  { date: "mar", hours: 8.1, checkIns: 14 },
  { date: "mié", hours: 7.5, checkIns: 11 },
  { date: "jue", hours: 8.6, checkIns: 15 },
  { date: "vie", hours: 7.9, checkIns: 13 },
  { date: "sáb", hours: 5.2, checkIns: 6 },
  { date: "dom", hours: 4.6, checkIns: 4 },
];

const mockStats = {
  activeUsers: 24,
  todayCheckIns: 68,
  pendingIncidents: 2,
  totalHoursToday: 182,
  totalHoursWeek: 950,
};

interface WorkSessionRecord {
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_pause_duration?: number | null;
}

interface RecentEventProfile {
  full_name: string | null;
  email: string | null;
}

interface RecentEvent {
  id: string;
  event_type: string;
  event_time: string;
  profile: RecentEventProfile | null;
}

interface RawRecentEvent extends Partial<RecentEvent> {
  id: string;
  event_type: string;
  event_time: string;
  user_id?: string;
  profile?: RecentEventProfile | null;
  profiles?: RecentEventProfile | null;
}

const DASHBOARD_REFRESH_MS = 60000;

const AdminView = () => {
  const { signOut, user } = useAuth();
  const { companyId, membership, loading: membershipLoading } = useMembership();
  const isDemoCompany = companyId ? DEMO_COMPANY_IDS.includes(companyId) : false;
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeUsers: 0,
    todayCheckIns: 0,
    pendingIncidents: 0,
    totalHoursToday: 0,
    totalHoursWeek: 0,
  });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [weeklyData, setWeeklyData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyStatus, setCompanyStatus] = useState<string>("active");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchCompanyStatus = useCallback(async () => {
    if (!companyId) return;
    const { data, error: statusError } = await supabase
      .from("companies")
      .select("status")
      .eq("id", companyId)
      .single();

    if (statusError) throw statusError;

    if (data) {
      setCompanyStatus(data.status || "active");
    }
  }, [companyId]);

  const calculateTotalHours = (sessions: WorkSessionRecord[]) => {
    return sessions.reduce((total, session) => {
      if (!session.clock_in_time) return total;

      const clockIn = new Date(session.clock_in_time).getTime();
      const clockOut = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
      const pauseDuration = Number(session.total_pause_duration ?? 0);
      const duration = Math.max(0, clockOut - clockIn - pauseDuration);

      return total + duration / (1000 * 60 * 60);
    }, 0);
  };

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();

    const { count: activeCount, error: activeError } = await supabase
      .from("work_sessions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_active", true);
    if (activeError) throw activeError;

    const { count: checkInsCount, error: checkInsError } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", "clock_in")
      .gte("event_time", startOfToday);
    if (checkInsError) throw checkInsError;

    const { count: incidentsCount, error: incidentsError } = await supabase
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");
    if (incidentsError) throw incidentsError;

    const { data: todaySessions, error: todaySessionsError } = await supabase
      .from("work_sessions")
      .select("clock_in_time, clock_out_time, total_pause_duration")
      .eq("company_id", companyId)
      .gte("clock_in_time", startOfToday);
    if (todaySessionsError) throw todaySessionsError;

    const totalHoursToday = calculateTotalHours((todaySessions || []) as WorkSessionRecord[]);

    const { data: weekSessions, error: weekSessionsError } = await supabase
      .from("work_sessions")
      .select("clock_in_time, clock_out_time, total_pause_duration")
      .eq("company_id", companyId)
      .gte("clock_in_time", startOfWeek);
    if (weekSessionsError) throw weekSessionsError;

    const totalHoursWeek = calculateTotalHours((weekSessions || []) as WorkSessionRecord[]);

    setStats({
      activeUsers: activeCount || 0,
      todayCheckIns: checkInsCount || 0,
      pendingIncidents: incidentsCount || 0,
      totalHoursToday,
      totalHoursWeek,
    });
  }, [companyId]);

  const fetchWeeklyData = useCallback(async () => {
    if (!companyId) return;
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const dailyData: DailyStats[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const { data: sessions, error: sessionsError } = await supabase
        .from("work_sessions")
        .select("clock_in_time, clock_out_time, total_pause_duration")
        .eq("company_id", companyId)
        .gte("clock_in_time", date.toISOString())
        .lt("clock_in_time", nextDay.toISOString());
      if (sessionsError) throw sessionsError;

      const { count: checkInsCount, error: checkInsError } = await supabase
        .from("time_events")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("event_type", "clock_in")
        .gte("event_time", date.toISOString())
        .lt("event_time", nextDay.toISOString());
      if (checkInsError) throw checkInsError;

      const hours = calculateTotalHours((sessions || []) as WorkSessionRecord[]);

      dailyData.push({
        date: date.toLocaleDateString("es-ES", { weekday: "short" }),
        hours: Math.round(hours * 10) / 10,
        checkIns: checkInsCount || 0,
      });
    }

    setWeeklyData(dailyData);
  }, [companyId]);

  const fetchRecentEvents = useCallback(async () => {
    if (!companyId) return;
    const { data, error: eventsError } = await supabase
      .from("time_events")
      .select("id,event_type,event_time,user_id")
      .eq("company_id", companyId)
      .order("event_time", { ascending: false })
      .limit(8);
    if (eventsError) throw eventsError;

    const eventsData = (data || []) as RawRecentEvent[];
    const userIds = Array.from(new Set(eventsData.map((event) => event.user_id).filter(Boolean)));
    let profilesMap: Record<string, RecentEventProfile> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = { full_name: profile.full_name, email: profile.email };
        return acc;
      }, {} as Record<string, RecentEventProfile>);
    }

    const events: RecentEvent[] = eventsData.map((event) => ({
      id: event.id,
      event_type: event.event_type,
      event_time: event.event_time,
      profile: (event.user_id && profilesMap[event.user_id]) || null,
    }));

    setRecentEvents(events);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return undefined;

    const channel = supabase
      .channel(`owner-dashboard-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_sessions",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchStats();
          fetchWeeklyData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "time_events",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchStats();
          fetchRecentEvents();
          // Trigger anomaly detection after a delay (to batch events)
          setTimeout(async () => {
            try {
              await supabase.functions.invoke('detect-anomalies', {
                body: { company_id: companyId },
              });
            } catch (error) {
              console.error('Error detecting anomalies:', error);
            }
          }, 5000); // Wait 5 seconds to batch multiple events
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchStats, fetchWeeklyData, fetchRecentEvents]);

  const fetchAllData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!companyId) return;
      const isSilent = options?.silent;
      if (isSilent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        await Promise.all([fetchStats(), fetchRecentEvents(), fetchWeeklyData(), fetchCompanyStatus()]);
        setLastUpdated(new Date().toISOString());
      } catch (fetchError) {
        console.error("Dashboard fetch error:", fetchError);
        setError("No pudimos actualizar los datos. Intenta de nuevo en unos segundos.");
      } finally {
        if (isSilent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [companyId, fetchStats, fetchRecentEvents, fetchWeeklyData, fetchCompanyStatus]
  );

  useEffect(() => {
    if (!companyId) return;
    fetchAllData();
  }, [companyId, fetchAllData]);

  useEffect(() => {
    if (!companyId) return;
    const interval = setInterval(() => {
      fetchAllData({ silent: true });
    }, DASHBOARD_REFRESH_MS);

    return () => clearInterval(interval);
  }, [companyId, fetchAllData]);

  // Detect anomalies periodically (every hour)
  useEffect(() => {
    if (!companyId) return;
    
    const detectAnomalies = async () => {
      try {
        await supabase.functions.invoke('detect-anomalies', {
          body: { company_id: companyId },
        });
      } catch (error) {
        console.error('Error detecting anomalies:', error);
        // Silently fail - don't disrupt the dashboard
      }
    };

    // Run immediately on mount, then every hour
    detectAnomalies();
    const anomalyInterval = setInterval(detectAnomalies, 3600000); // 1 hour

    return () => clearInterval(anomalyInterval);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAllData({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [companyId, fetchAllData]);

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

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const hasWeeklyHours = weeklyData.some((day) => day.hours > 0);
  const hasWeeklyCheckIns = weeklyData.some((day) => day.checkIns > 0);
  const usingMockWeeklyData = isDemoCompany || !hasWeeklyHours;
  const usingMockCheckIns = isDemoCompany || !hasWeeklyCheckIns;
  const weeklyChartData = usingMockWeeklyData ? mockWeeklyData : weeklyData;
  const weeklyCheckInChartData = usingMockCheckIns ? mockWeeklyData : weeklyData;
  const shouldUseMockStats =
    isDemoCompany || (stats.activeUsers === 0 && stats.todayCheckIns === 0 && stats.totalHoursWeek === 0);
  const statsDisplay = shouldUseMockStats ? mockStats : stats;

  if (loading || membershipLoading || !companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <Card className="glass-card max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
          <h2 className="text-xl font-semibold">No encontramos tu empresa</h2>
          <p className="text-muted-foreground">
            Tu sesión no tiene una empresa asignada. Cierra sesión e inténtalo de nuevo o contacta con un administrador.
          </p>
          <Button onClick={signOut}>Cerrar sesión</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {error && (
          <Card className="border-destructive bg-destructive/10 text-destructive-foreground p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">No pudimos actualizar los datos</p>
            </div>
            <p className="text-sm opacity-80">{error}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => fetchAllData()}>
                Reintentar
              </Button>
            </div>
          </Card>
        )}

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
                {membership?.company?.name ?? "Empresa sin nombre"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                {refreshing && <Loader2 className="w-3 h-3 animate-spin" />}
                {lastUpdatedLabel
                  ? `Actualizado a las ${lastUpdatedLabel}`
                  : "Esperando primera actualización..."}
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
              onClick={() => navigate("/manager-calendar")}
              className="hover-scale"
              title="Calendario"
            >
              <Calendar className="w-5 h-5" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trabajadores activos</p>
                <p className="text-3xl font-bold mt-1">{statsDisplay.activeUsers}</p>
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
                <p className="text-3xl font-bold mt-1">{statsDisplay.todayCheckIns}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
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
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
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

          {/* Check-ins Chart */}
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Fichajes - Última semana
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyCheckInChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
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
                <Line
                  type="monotone"
                  dataKey="checkIns"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
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
                {statsDisplay.totalHoursWeek.toFixed(1)}h
              </p>
              <p className="text-sm text-muted-foreground mt-1">Horas totales</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/5">
              <p className="text-2xl font-bold text-primary">
                {weeklyCheckInChartData.reduce((sum, day) => sum + day.checkIns, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Fichajes</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/5">
              <p className="text-2xl font-bold text-primary">
                {statsDisplay.activeUsers}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Activos ahora</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-amber-500/10">
              <p className="text-2xl font-bold text-amber-600">
                {statsDisplay.pendingIncidents}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Incidencias</p>
            </div>
          </div>
        </Card>
        {membership?.role === "owner" && user?.id && (
          <VacationAssignment companyId={companyId} ownerId={user.id} />
        )}
      </div>
    </div>
  );
};

export default AdminView;
