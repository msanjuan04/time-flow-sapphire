import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, TrendingUp, LogOut, BarChart3, Calendar, UserCog, MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import NotificationBell from "@/components/NotificationBell";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_event_type: string | null;
  last_event_time: string | null;
}

interface DailyStats {
  date: string;
  hours: number;
  checkIns: number;
}

interface ManagerProfileDetails {
  center_id: string | null;
  team_id: string | null;
}

interface MembershipWithProfile {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    is_active: boolean;
    center_id: string | null;
    team_id: string | null;
  };
}

interface LastEvent {
  user_id: string;
  event_type: string | null;
  event_time: string | null;
}

interface WorkSessionSummary {
  clock_in_time: string | null;
  clock_out_time: string | null;
}

const ManagerView = () => {
  const { user, signOut } = useAuth();
  const { companyId, membership } = useMembership();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeTeamMembers: 0,
    todayCheckIns: 0,
    totalHoursToday: 0,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [weeklyData, setWeeklyData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerProfile, setManagerProfile] = useState<ManagerProfileDetails | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchManagerProfile = useCallback(async () => {
    if (!user?.id) {
      setManagerProfile(null);
      setProfileLoaded(true);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("center_id, team_id")
      .eq("id", user.id)
      .single();

    setManagerProfile(profile || null);
    setProfileLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (companyId) {
      fetchManagerProfile();
    }
  }, [companyId, fetchManagerProfile]);

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();

    let membersQuery = supabase
      .from("memberships")
      .select("user_id, profiles!inner(center_id, team_id)")
      .eq("company_id", companyId);

    if (managerProfile?.center_id) {
      membersQuery = membersQuery.eq("profiles.center_id", managerProfile.center_id);
    } else if (managerProfile?.team_id) {
      membersQuery = membersQuery.eq("profiles.team_id", managerProfile.team_id);
    }

    const { data: teamMembersData } = await membersQuery;
    const memberRows: MembershipWithProfile[] = (teamMembersData || []) as MembershipWithProfile[];
    const userIds = memberRows.map((m) => m.user_id);

    if (userIds.length === 0) {
      setStats({ activeTeamMembers: 0, todayCheckIns: 0, totalHoursToday: 0 });
      return;
    }

    const { count: activeCount } = await supabase
      .from("work_sessions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("user_id", userIds)
      .eq("is_active", true);

    const { count: checkInsCount } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("user_id", userIds)
      .eq("event_type", "clock_in")
      .gte("event_time", startOfToday);

    const { data: todaySessions } = await supabase
      .from("work_sessions")
      .select("clock_in_time, clock_out_time")
      .eq("company_id", companyId)
      .in("user_id", userIds)
      .gte("clock_in_time", startOfToday);

    const totalHoursToday = calculateTotalHours((todaySessions || []) as WorkSessionSummary[]);

    setStats({
      activeTeamMembers: activeCount || 0,
      todayCheckIns: checkInsCount || 0,
      totalHoursToday,
    });
  }, [companyId, managerProfile]);

  const fetchTeamMembers = useCallback(async () => {
    if (!companyId) return;
    let query = supabase
      .from("memberships")
      .select(`
        user_id,
        profiles!inner(
          id,
          full_name,
          email,
          is_active,
          center_id,
          team_id
        )
      `)
      .eq("company_id", companyId)
      .eq("role", "worker");

    if (managerProfile?.center_id) {
      query = query.eq("profiles.center_id", managerProfile.center_id);
    } else if (managerProfile?.team_id) {
      query = query.eq("profiles.team_id", managerProfile.team_id);
    }

    const { data: members } = await query;

    const membersList: MembershipWithProfile[] = (members || []) as MembershipWithProfile[];

    if (membersList.length === 0) {
      setTeamMembers([]);
      return;
    }

    const userIds = membersList.map((m) => m.user_id);

    const { data: lastEvents } = await supabase
      .from("time_events")
      .select("user_id, event_type, event_time")
      .eq("company_id", companyId)
      .in("user_id", userIds)
      .order("event_time", { ascending: false });

    const eventList: LastEvent[] = (lastEvents || []) as LastEvent[];

    const membersWithEvents = membersList.map((m) => {
      const lastEvent = eventList.find((e) => e.user_id === m.user_id);
      return {
        id: m.user_id,
        full_name: m.profiles.full_name || "Sin nombre",
        email: m.profiles.email || "—",
        is_active: Boolean(m.profiles.is_active),
        last_event_type: lastEvent?.event_type || null,
        last_event_time: lastEvent?.event_time || null,
      };
    });

    setTeamMembers(membersWithEvents);
  }, [companyId, managerProfile]);

  const fetchWeeklyData = useCallback(async () => {
    if (!companyId) return;
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    let membersQuery = supabase
      .from("memberships")
      .select("user_id, profiles!inner(center_id, team_id)")
      .eq("company_id", companyId);

    if (managerProfile?.center_id) {
      membersQuery = membersQuery.eq("profiles.center_id", managerProfile.center_id);
    } else if (managerProfile?.team_id) {
      membersQuery = membersQuery.eq("profiles.team_id", managerProfile.team_id);
    }

    const { data: teamMembersData } = await membersQuery;
    const memberRows: MembershipWithProfile[] = (teamMembersData || []) as MembershipWithProfile[];
    const userIds = memberRows.map((m) => m.user_id);

    if (userIds.length === 0) {
      setWeeklyData([]);
      return;
    }

    const dailyData: DailyStats[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const { data: sessions } = await supabase
        .from("work_sessions")
        .select("clock_in_time, clock_out_time")
        .eq("company_id", companyId)
        .in("user_id", userIds)
        .gte("clock_in_time", date.toISOString())
        .lt("clock_in_time", nextDay.toISOString());

      const { count: checkInsCount } = await supabase
        .from("time_events")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("user_id", userIds)
        .eq("event_type", "clock_in")
        .gte("event_time", date.toISOString())
        .lt("event_time", nextDay.toISOString());

      const hours = calculateTotalHours((sessions || []) as WorkSessionSummary[]);

      dailyData.push({
        date: date.toLocaleDateString("es-ES", { weekday: "short" }),
        hours: Math.round(hours * 10) / 10,
        checkIns: checkInsCount || 0,
      });
    }

    setWeeklyData(dailyData);
  }, [companyId, managerProfile]);

  const fetchAllData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    await Promise.all([fetchStats(), fetchTeamMembers(), fetchWeeklyData()]);
    setLoading(false);
  }, [companyId, fetchStats, fetchTeamMembers, fetchWeeklyData]);

  useEffect(() => {
    if (companyId && profileLoaded) {
      fetchAllData();
    }
  }, [companyId, profileLoaded, fetchAllData]);

  const calculateTotalHours = (sessions: WorkSessionSummary[]) => {
    return sessions.reduce((total, session) => {
      if (!session.clock_in_time) return total;

      const clockIn = new Date(session.clock_in_time).getTime();
      const clockOut = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
      const hours = (clockOut - clockIn) / (1000 * 60 * 60);

      return total + hours;
    }, 0);
  };

  const formatEventType = (type: string | null) => {
    if (!type) return "—";
    const types: Record<string, string> = {
      clock_in: "Entrada",
      clock_out: "Salida",
      pause_start: "Inicio pausa",
      pause_end: "Fin pausa",
    };
    return types[type] || type;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (member: TeamMember) => {
    if (!member.is_active) {
      return <Badge variant="outline" className="bg-gray-500/10 text-gray-700">Inactivo</Badge>;
    }
    if (member.last_event_type === "clock_in") {
      return <Badge variant="outline" className="bg-green-500/10 text-green-700">Trabajando</Badge>;
    }
    if (member.last_event_type === "pause_start") {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-700">En pausa</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-500/10 text-gray-700">Fuera</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <UserCog className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Panel de Manager</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
                {managerProfile?.center_id && " - Mi Centro"}
                {managerProfile?.team_id && " - Mi Equipo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/location-report")}
              className="hover-scale"
              title="Ubicaciones"
            >
              <MapPin className="w-5 h-5" />
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
              title="Correcciones"
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
            <Button variant="ghost" size="icon" onClick={signOut} className="hover-scale">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipo activo</p>
                <p className="text-3xl font-bold mt-1">{stats.activeTeamMembers}</p>
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

        {/* Weekly Chart */}
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

        {/* Team Members */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Miembros del Equipo
          </h2>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Cargando...</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay miembros asignados a tu centro o equipo
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último evento</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member, index) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group"
                    >
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>{getStatusBadge(member)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatEventType(member.last_event_type)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTime(member.last_event_time)}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ManagerView;
