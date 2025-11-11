import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, TrendingUp, LogOut, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";

const AdminView = () => {
  const { signOut } = useAuth();
  const { companyId, membership } = useMembership();
  const [stats, setStats] = useState({
    activeUsers: 0,
    todayEvents: 0,
    totalHoursToday: 0,
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchStats();
      fetchRecentEvents();
    }
  }, [companyId]);

  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { count: activeCount } = await supabase
      .from("work_sessions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_active", true);

    const { count: eventsCount } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("event_time", `${today}T00:00:00`);

    setStats({
      activeUsers: activeCount || 0,
      todayEvents: eventsCount || 0,
      totalHoursToday: 0,
    });
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
      .limit(10);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Panel de Control</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios activos</p>
                <p className="text-3xl font-bold mt-1">{stats.activeUsers}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eventos hoy</p>
                <p className="text-3xl font-bold mt-1">{stats.todayEvents}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas trabajadas</p>
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

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Fichajes recientes</h2>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay fichajes registrados
              </p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 smooth-transition hover:bg-secondary"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
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
      </div>
    </div>
  );
};

export default AdminView;
