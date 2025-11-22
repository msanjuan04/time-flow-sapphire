// src/pages/Employees.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Search,
  Filter,
  Edit,
  Download,
  CalendarDays,
  Users as UsersIcon,
  MapPin,
  RefreshCcw,
  Send,
  Ban,
  Loader2,
  Clock3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import InviteUserDialog from "@/components/InviteUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { motion } from "framer-motion";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCompanyPlanDefinition } from "@/config/companyPlans";
import { DEMO_COMPANY_IDS, DEMO_SHOWCASE_HEADCOUNT } from "@/config/demo";
import { FunctionsHttpError } from "@supabase/functions-js";
import ScheduleHoursDialog from "@/components/ScheduleHoursDialog";
import EmployeeInsights from "@/components/EmployeeInsights";

/* --------------------------- utilidades locales --------------------------- */
const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
};


const WEEKDAY_OPTIONS = [
  { value: "all", label: "Todos los días" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const getISODate = (date: Date) => date.toISOString().slice(0, 10);
const defaultStartDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getISODate(d);
};
const defaultEndDate = () => getISODate(new Date());
/* ------------------------------------------------------------------------- */

type RoleFilter = "all" | "owner" | "admin" | "manager" | "worker";

interface Employee {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  center_id: string | null;
  team_id: string | null;
  center_name: string | null;
  team_name: string | null;
  last_event: string | null;
  last_event_time: string | null;
}

interface MembershipRow {
  id: string;
  role: string;
  user_id: string;
  created_at: string;
}

/** Eventos de la ficha (definimos el tipo localmente para evitar `any`) */
interface DetailEvent {
  id: string;
  event_type: "clock_in" | "clock_out" | "pause_start" | "pause_end" | string;
  event_time: string;            // ISO
  latitude: number | null;
  longitude: number | null;
}

interface DetailSession {
  id: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_pause_duration: number | string | null;
}

interface InviteSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  center_id: string | null;
  team_id: string | null;
  accepted_at: string | null;
}

const Employees = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId, role, membership } = useMembership();
  const { isSuperadmin } = useSuperadmin();
  const canManageInvites = isSuperadmin || role === "owner" || role === "admin";
  const canManageSchedules = role === "owner" || role === "admin";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleEmployee, setScheduleEmployee] = useState<Employee | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<Record<string, boolean>>({});
  const [companyHeadcount, setCompanyHeadcount] = useState(0);
  const planInfo = getCompanyPlanDefinition(membership?.company?.plan);
  const planLimit = planInfo.maxEmployees;
  const remainingSlots = planLimit === null ? null : Math.max(planLimit - companyHeadcount, 0);
  const planUsagePercent = planLimit ? Math.min((companyHeadcount / planLimit) * 100, 100) : 0;
  const planLimitReached = planLimit !== null && remainingSlots === 0;
  const inviteDisabled = planLimit !== null && planLimitReached && !isSuperadmin;
  const isDemoCompany = companyId ? DEMO_COMPANY_IDS.includes(companyId) : false;
  const displayHeadcount = isDemoCompany ? DEMO_SHOWCASE_HEADCOUNT : companyHeadcount;
  const displayRemainingSlots = planLimit === null ? null : Math.max(planLimit - displayHeadcount, 0);
  const displayPlanUsagePercent = planLimit ? Math.min((displayHeadcount / planLimit) * 100, 100) : 0;
  const displayPlanLimitReached = planLimit !== null && displayRemainingSlots === 0;

  // Ficha de empleado
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvents, setDetailsEvents] = useState<DetailEvent[]>([]);
  const [detailTab, setDetailTab] = useState<"hours" | "map" | "insights">("hours");
  const [detailHours, setDetailHours] = useState<DetailSession[]>([]);
  const [detailHoursLoading, setDetailHoursLoading] = useState(false);
  const [detailHoursStart, setDetailHoursStart] = useState(() => defaultStartDate());
  const [detailHoursEnd, setDetailHoursEnd] = useState(() => defaultEndDate());
  const [detailMapEvents, setDetailMapEvents] = useState<DetailEvent[]>([]);
  const [detailMapLoading, setDetailMapLoading] = useState(false);
  const [detailMapStart, setDetailMapStart] = useState(() => defaultStartDate());
  const [detailMapEnd, setDetailMapEnd] = useState(() => defaultEndDate());
  const [detailMapWeekday, setDetailMapWeekday] = useState("all");
  const [detailMapReadyTick, setDetailMapReadyTick] = useState(0);
  const detailMapContainerRef = useRef<HTMLDivElement>(null);
  const detailMapRef = useRef<L.Map | null>(null);
  const detailMapMarkersRef = useRef<L.Marker[]>([]);
  const cleanupDetailMap = useCallback(() => {
    if (detailMapRef.current) {
      detailMapRef.current.remove();
      detailMapRef.current = null;
    }
    detailMapMarkersRef.current.forEach((marker) => marker.remove());
    detailMapMarkersRef.current = [];
  }, []);
  const detailFilteredMapEvents = useMemo(() => {
    if (detailMapWeekday === "all") return detailMapEvents;
    const weekday = Number(detailMapWeekday);
    return detailMapEvents.filter((ev) => {
      const eventDay = new Date(ev.event_time).getDay();
      return eventDay === weekday;
    });
  }, [detailMapEvents, detailMapWeekday]);
  const detailVisibleMapEvents = useMemo(() => detailFilteredMapEvents.slice(0, 12), [detailFilteredMapEvents]);
  const detailTotalHours = useMemo(() => {
    return detailHours.reduce((sum, session) => {
      if (!session.clock_in_time || !session.clock_out_time) return sum;
      const start = new Date(session.clock_in_time).getTime();
      const end = new Date(session.clock_out_time).getTime();
      const pauseMs = Number(session.total_pause_duration ?? 0);
      const duration = Math.max(0, end - start - (isNaN(pauseMs) ? 0 : pauseMs));
      return sum + duration / (1000 * 60 * 60);
    }, 0);
  }, [detailHours]);
  const detailHoursStats = useMemo(() => {
    const sessions = detailHours.filter((s) => s.clock_in_time && s.clock_out_time);
    const totalSessions = sessions.length;
    const avgHours = totalSessions ? detailTotalHours / totalSessions : 0;
    const firstDay = sessions[sessions.length - 1]?.clock_in_time || null;
    return { totalSessions, avgHours, firstDay };
  }, [detailHours, detailTotalHours]);

  const loadDetailHours = useCallback(
    async (employeeId: string) => {
      if (!companyId) return;
      setDetailHoursLoading(true);
      try {
        const { data, error } = await supabase
          .from("work_sessions")
          .select("id, clock_in_time, clock_out_time, total_pause_duration")
          .eq("company_id", companyId)
          .eq("user_id", employeeId)
          .gte("clock_in_time", `${detailHoursStart}T00:00:00`)
          .lte("clock_in_time", `${detailHoursEnd}T23:59:59`)
          .order("clock_in_time", { ascending: false });

        if (error) throw error;
        setDetailHours((data as DetailSession[]) || []);
      } catch (error) {
        console.error("Error fetching employee sessions:", error);
        setDetailHours([]);
      } finally {
        setDetailHoursLoading(false);
      }
    },
    [companyId, detailHoursStart, detailHoursEnd]
  );

  const loadDetailMapEvents = useCallback(
    async (employeeId: string) => {
      if (!companyId) return;
      setDetailMapLoading(true);
      try {
        const { data, error } = await supabase
          .from("time_events")
          .select("id, event_type, event_time, latitude, longitude")
          .eq("company_id", companyId)
          .eq("user_id", employeeId)
          .gte("event_time", `${detailMapStart}T00:00:00`)
          .lte("event_time", `${detailMapEnd}T23:59:59`)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("event_time", { ascending: false })
          .limit(200);

        if (error) throw error;
        setDetailMapEvents((data as DetailEvent[]) || []);
      } catch (error) {
        console.error("Error fetching employee map events:", error);
        setDetailMapEvents([]);
      } finally {
        setDetailMapLoading(false);
      }
    },
    [companyId, detailMapStart, detailMapEnd]
  );

  // Preferencia mini-mapas (persistida)
  const [miniMapsEnabled, setMiniMapsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("employeesMiniMaps") === "1"; } catch { return false; }
  });

  // Cache de ubicaciones
  const [locCache, setLocCache] = useState<Record<string, { lat: number; lng: number } | null>>({});
  const [pendingInvites, setPendingInvites] = useState<InviteSummary[]>([]);
  const [recentAcceptedInvites, setRecentAcceptedInvites] = useState<InviteSummary[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [inviteAction, setInviteAction] = useState<{ id: string; action: "resend" | "revoke" } | null>(null);

  const mapSrc = (lat: number, lng: number, z = 15) =>
    `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;

  const fetchLastLocation = async (empId: string) => {
    if (!companyId) return null;
    if (locCache[empId] !== undefined) return locCache[empId];

    const { data } = await supabase
      .from("time_events")
      .select("latitude, longitude")
      .eq("company_id", companyId)
      .eq("user_id", empId)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("event_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    const value = (data?.latitude && data?.longitude)
      ? { lat: data.latitude as number, lng: data.longitude as number }
      : null;

    setLocCache(prev => ({ ...prev, [empId]: value }));
    return value;
  };

  // Persistir toggle mini-mapas
  useEffect(() => {
    try {
      localStorage.setItem("employeesMiniMaps", miniMapsEnabled ? "1" : "0");
    } catch (err) {
      console.error("Error saving miniMaps state:", err);
    }
  }, [miniMapsEnabled]);

  /* ------------------------------ export helpers ------------------------------ */
  const handleExportCSV = () => {
    const headers = ["Nombre", "Email", "Rol", "Centro", "Equipo", "Último evento", "Hora último evento"];
    const rows = filteredEmployees.map(e => [
      e.full_name || "", e.email, e.role, e.center_name || "", e.team_name || "", e.last_event || "", e.last_event_time || ""
    ]);
    exportCSV("empleados", headers, rows);
  };


  const handleExportEmployeeCSV = () => {
    if (!selectedEmployee) return;
    if (detailHours.length === 0) {
      toast.info("No hay jornadas para exportar en este rango");
      return;
    }
    const headers = ["Fecha", "Entrada", "Salida", "Horas"];
    const rows = detailHours.map((session) => {
      const date = session.clock_in_time
        ? new Date(session.clock_in_time).toISOString().slice(0, 10)
        : session.clock_out_time
        ? new Date(session.clock_out_time).toISOString().slice(0, 10)
        : "";
      const hours =
        session.clock_in_time && session.clock_out_time
          ? (() => {
              const start = new Date(session.clock_in_time).getTime();
              const end = new Date(session.clock_out_time).getTime();
              const pauseMs = Number(session.total_pause_duration ?? 0);
              const duration = Math.max(0, end - start - (isNaN(pauseMs) ? 0 : pauseMs));
              return (duration / (1000 * 60 * 60)).toFixed(2);
            })()
          : "0";
      return [
        date,
        formatTimeLabel(session.clock_in_time),
        formatTimeLabel(session.clock_out_time),
        hours,
      ];
    });
    exportCSV(
      `jornadas_${selectedEmployee.full_name?.replace(/\s+/g, "_") || selectedEmployee.id}`,
      headers,
      rows
    );
  };
  /* --------------------------------------------------------------------------- */

  useEffect(() => {
    if (!user) return void navigate("/auth");

    const isAllowedRole = role === "owner" || role === "admin" || role === "manager";
    if (!isSuperadmin && role && !isAllowedRole) return void navigate("/");

    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, role, user, isSuperadmin]);

  useEffect(() => setPage(1), [searchQuery, roleFilter]);

  useEffect(() => {
    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page, searchQuery, roleFilter]);

  useEffect(() => {
    if (!detailsOpen || !selectedEmployee) return;
    if (detailTab === "hours") {
      loadDetailHours(selectedEmployee.id);
    }
  }, [detailsOpen, selectedEmployee, loadDetailHours, detailTab]);

  useEffect(() => {
    if (!detailsOpen || !selectedEmployee) return;
    if (detailTab === "map") {
      loadDetailMapEvents(selectedEmployee.id);
    }
  }, [detailsOpen, selectedEmployee, loadDetailMapEvents, detailTab]);

  useEffect(() => {
    if (!detailsOpen) {
      cleanupDetailMap();
      return;
    }

    if (detailTab !== "map") {
      cleanupDetailMap();
      return;
    }

    if (detailMapRef.current) {
      detailMapRef.current.invalidateSize();
      return;
    }

    if (!detailMapContainerRef.current) {
      const retry = setTimeout(() => {
        setDetailMapReadyTick((tick) => tick + 1);
      }, 75);
      return () => clearTimeout(retry);
    }

    const mapInstance = L.map(detailMapContainerRef.current, {
      center: [40.4168, -3.7038],
      zoom: 5,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance);

    detailMapRef.current = mapInstance;

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 150);

    return () => {
      cleanupDetailMap();
    };
  }, [detailsOpen, detailTab, cleanupDetailMap, detailMapReadyTick]);

  useEffect(() => {
    const mapInstance = detailMapRef.current;
    if (!mapInstance) return;

    detailMapMarkersRef.current.forEach((marker) => marker.remove());
    detailMapMarkersRef.current = [];

    if (!detailsOpen || detailTab !== "map" || detailFilteredMapEvents.length === 0) return;

    const bounds = L.latLngBounds([]);

    detailFilteredMapEvents.forEach((event) => {
      if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return;
      const marker = L.marker([event.latitude, event.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<span style="
            background:${getEventColor(event.event_type)};
            width:20px;
            height:20px;
            display:block;
            border:3px solid #fff;
            border-radius:50%;
            box-shadow:0 3px 8px rgba(0,0,0,0.25);
          "></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(mapInstance);

      marker.bindPopup(
        `<strong>${event.event_type}</strong><br/>${new Date(event.event_time).toLocaleString("es-ES")}`
      );

      detailMapMarkersRef.current.push(marker);
      bounds.extend([event.latitude, event.longitude]);
    });

    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
  }, [detailFilteredMapEvents, detailsOpen, detailTab]);

  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));
  const currentPageEmployees = filteredEmployees;

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      if (!companyId) {
        setEmployees([]);
        setFilteredEmployees([]);
        setTotalEmployees(0);
        setCompanyHeadcount(0);
        return;
      }
      const { count: totalCount, error: totalCountError } = await supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (!totalCountError) {
        setCompanyHeadcount(totalCount || 0);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let membershipQuery = supabase
        .from("memberships")
        .select("id, role, user_id, created_at", { count: "exact" })
        .eq("company_id", companyId);

      if (roleFilter !== "all") {
        membershipQuery = membershipQuery.eq("role", roleFilter as Exclude<RoleFilter, "all">);
      }

      const trimmedSearch = searchQuery.trim();
      if (trimmedSearch) {
        const term = `%${trimmedSearch}%`;
        const { data: matchingProfiles, error: matchError } = await supabase
          .from("profiles")
          .select("id")
          .or(`full_name.ilike.${term},email.ilike.${term}`);
        if (matchError) throw matchError;

        const matchingIds = (matchingProfiles || []).map((p) => p.id);
        if (matchingIds.length === 0) {
          setEmployees([]);
          setFilteredEmployees([]);
          setTotalEmployees(0);
          setLoading(false);
          return;
        }
        membershipQuery = membershipQuery.in("user_id", matchingIds);
      }

      const { data, error, count } = await membershipQuery
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const membershipRows: MembershipRow[] = (data || []) as MembershipRow[];
      if (membershipRows.length === 0) {
        setEmployees([]);
        setFilteredEmployees([]);
        setTotalEmployees(count || 0);
        return;
      }

      const userIds = membershipRows.map((m) => m.user_id);
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, center_id, team_id, is_active")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));

      const centerIds = Array.from(
        new Set((profileRows || []).map((p) => p.center_id).filter((id): id is string => Boolean(id)))
      );
      const teamIds = Array.from(
        new Set((profileRows || []).map((p) => p.team_id).filter((id): id is string => Boolean(id)))
      );

      const centerMap: Record<string, string | null> = {};
      if (centerIds.length > 0) {
        const { data: centers } = await supabase
          .from("centers")
          .select("id, name")
          .in("id", centerIds);
        centers?.forEach((c) => {
          centerMap[c.id] = c.name || null;
        });
      }

      const teamMap: Record<string, string | null> = {};
      if (teamIds.length > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", teamIds);
        teams?.forEach((t) => {
          teamMap[t.id] = t.name || null;
        });
      }

      const employeesWithEvents = await Promise.all(
        membershipRows.map(async (m) => {
          const profile = profileMap.get(m.user_id);
          if (!profile) return null;

          const { data: lastEvent } = await supabase
            .from("time_events")
            .select("event_type, event_time")
            .eq("user_id", profile.id)
            .eq("company_id", companyId)
            .order("event_time", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: m.role,
            is_active: profile.is_active ?? true,
            center_id: profile.center_id,
            team_id: profile.team_id,
            center_name: profile.center_id ? centerMap[profile.center_id] ?? null : null,
            team_name: profile.team_id ? teamMap[profile.team_id] ?? null : null,
            last_event: lastEvent?.event_type || null,
            last_event_time: lastEvent?.event_time || null,
          } as Employee | null;
        })
      );

      const validEmployees = employeesWithEvents.filter((employee): employee is Employee => Boolean(employee));

      setEmployees(validEmployees);
      setFilteredEmployees(validEmployees);
      setTotalEmployees(count ?? validEmployees.length);
    } catch (e) {
      toast.error("Error al cargar empleados");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitesByStatus = useCallback(
    async (status: "pending" | "accepted") => {
      const { data, error } = await supabase.functions.invoke<{ invites: InviteSummary[] }>(
        "list-invites",
        { body: { status } }
      );
      if (error) throw error;
      return data?.invites ?? [];
    },
    []
  );

  const fetchInvites = useCallback(async () => {
    if (!canManageInvites) return;
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const [pending, accepted] = await Promise.all([
        fetchInvitesByStatus("pending"),
        fetchInvitesByStatus("accepted"),
      ]);
      setPendingInvites(pending);
      setRecentAcceptedInvites(accepted.slice(0, 5));
    } catch (err) {
      console.error("Error fetching invites:", err);
      setInvitesError("No pudimos cargar las invitaciones.");
    } finally {
      setInvitesLoading(false);
    }
  }, [canManageInvites, fetchInvitesByStatus]);

  useEffect(() => {
    if (canManageInvites) {
      fetchInvites();
    } else {
      setPendingInvites([]);
      setRecentAcceptedInvites([]);
    }
  }, [canManageInvites, fetchInvites]);

  const handleResendInvite = async (inviteId: string) => {
    setInviteAction({ id: inviteId, action: "resend" });
    try {
      const { error } = await supabase.functions.invoke("resend-invite", {
        body: { invite_id: inviteId },
      });
      if (error) throw error;
      toast.success("Invitación reenviada");
      fetchInvites();
    } catch (error) {
      console.error("Error resending invite:", error);
      toast.error("No se pudo reenviar la invitación");
    } finally {
      setInviteAction(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setInviteAction({ id: inviteId, action: "revoke" });
    try {
      const { error } = await supabase.functions.invoke("revoke-invite", {
        body: { invite_id: inviteId },
      });
      if (error) throw error;
      toast.success("Invitación revocada");
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      toast.error("No se pudo revocar la invitación");
    } finally {
      setInviteAction(null);
    }
  };

  const handleInviteSuccess = () => {
    fetchEmployees();
    fetchInvites();
  };

  const handleStatusChange = async (employee: Employee, nextValue: boolean) => {
    if (!nextValue && user?.id === employee.id) {
      toast.error("No puedes desactivar tu propia cuenta.");
      return;
    }

    if (!nextValue) {
      const confirmed = window.confirm(
        `¿Seguro que deseas desactivar a ${employee.full_name || employee.email}? El usuario no podrá fichar hasta que lo reactives.`
      );
      if (!confirmed) {
        return;
      }
    }

    setStatusUpdates((prev) => ({ ...prev, [employee.id]: nextValue }));

    try {
      if (nextValue) {
        const { error } = await supabase.functions.invoke(`reactivate-person/${employee.id}`, {
          body: { send_invite: false },
        });
        if (error) throw error;
        toast.success("Usuario reactivado correctamente");
      } else {
        const { error } = await supabase.functions.invoke(`delete-person/${employee.id}`, {
          body: {},
        });
        if (error) throw error;
        toast.success("Usuario desactivado correctamente");
      }

      setEmployees((prev) =>
        prev.map((emp) => (emp.id === employee.id ? { ...emp, is_active: nextValue } : emp))
      );
      setFilteredEmployees((prev) =>
        prev.map((emp) => (emp.id === employee.id ? { ...emp, is_active: nextValue } : emp))
      );
      setSelectedEmployee((prev) =>
        prev && prev.id === employee.id ? { ...prev, is_active: nextValue } : prev
      );

      await fetchEmployees();
    } catch (error) {
      const message = await getFunctionErrorMessage(error);
      toast.error(message);
    } finally {
      setStatusUpdates((prev) => {
        const updated = { ...prev };
        delete updated[employee.id];
        return updated;
      });
    }
  };

  const getRoleBadgeColor = (r: Exclude<RoleFilter, "all">) =>
    ({
      owner: "bg-primary text-primary-foreground",
      admin: "bg-blue-500 text-white",
      manager: "bg-amber-500 text-white",
      worker: "bg-secondary text-secondary-foreground",
    } as Record<Exclude<RoleFilter, "all">, string>)[r] || "bg-secondary";

  const formatEventType = (t: string | null) =>
    !t ? "-" : ({ clock_in: "Entrada", clock_out: "Salida", pause_start: "Pausa", pause_end: "Reanudar" } as Record<string, string>)[t] || t;

const formatLastSeen = (ts: string | null) => {
  if (!ts) return "Nunca";
  const d = new Date(ts);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `Hace ${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `Hace ${h}h`;
    const days = Math.floor(h / 24);
  return `Hace ${days}d`;
};

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
      return "#2563eb";
  }
};

const formatSessionDuration = (hours: number) => {
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h && !m) return "0h";
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ");
};

const formatTimeLabel = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";

const getEmployeeStatus = (eventType: string | null) => {
  switch (eventType) {
    case "clock_in":
      return { label: "Trabajando", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
    case "pause_start":
      return { label: "En pausa", tone: "bg-amber-50 text-amber-700 border border-amber-200" };
    case "pause_end":
      return { label: "Reanudando", tone: "bg-blue-50 text-blue-700 border border-blue-200" };
    case "clock_out":
      return { label: "Fuera de turno", tone: "bg-slate-50 text-slate-600 border border-slate-200" };
    default:
      return { label: "Sin actividad reciente", tone: "bg-slate-50 text-slate-600 border border-slate-200" };
  }
};

const getFunctionErrorMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const details = await error.context.json();
      if (typeof details?.error === "string") return details.error;
      if (typeof details?.message === "string") return details.message;
    } catch {
      // Ignore JSON parsing errors and fall back to the generic message
    }
    return "La función devolvió un error desconocido.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "No se pudo completar la acción solicitada.";
};

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleOpenSchedule = (employee: Employee) => {
    setScheduleEmployee(employee);
    setScheduleDialogOpen(true);
  };

  const handleScheduleDialogChange = (open: boolean) => {
    setScheduleDialogOpen(open);
    if (!open) {
      setScheduleEmployee(null);
    }
  };

  const handleOpenDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailTab("hours");
    const start = defaultStartDate();
    const end = defaultEndDate();
    setDetailHoursStart(start);
    setDetailHoursEnd(end);
    setDetailMapStart(start);
    setDetailMapEnd(end);
    setDetailMapWeekday("all");
    setDetailHours([]);
    setDetailMapEvents([]);
    setDetailsOpen(true);
    try {
      const { data, error } = await supabase
        .from("time_events")
        .select("id, event_type, event_time, latitude, longitude")
        .eq("company_id", companyId)
        .eq("user_id", employee.id)
        .order("event_time", { ascending: false })
        .limit(8);

      if (error) throw error;
      setDetailsEvents((data ?? []) as DetailEvent[]);
    } catch {
      setDetailsEvents([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton to="/" />
            <div>
              <h1 className="text-2xl font-bold">Gestión de Empleados</h1>
              <p className="text-sm text-muted-foreground">
                {displayHeadcount} empleados en total
              </p>
            </div>
          </div>
        </div>

        {canManageInvites && (
          <Card className="glass-card p-5 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{planInfo.label}</h2>
                  {planInfo.price !== "Contactar" && (
                    <span className="text-sm text-muted-foreground">{planInfo.price}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{planInfo.description}</p>
                <p className="text-xs text-muted-foreground">
                  Invitaciones pendientes: {pendingInvites.length}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Empleados activos</p>
                    <p className="text-3xl font-semibold">
                      {displayHeadcount}
                      {planLimit !== null && (
                        <span className="text-base font-normal text-muted-foreground">
                          {" "}
                          / {planLimit}
                        </span>
                      )}
                    </p>
                  </div>
                  {planLimit !== null && (
                    <p className="text-sm text-muted-foreground text-right">
                      Restantes: <span className="font-semibold">{displayRemainingSlots}</span>
                    </p>
                  )}
                </div>
                {planLimit !== null ? (
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${displayPlanUsagePercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Plan sin límite de empleados.
                  </p>
                )}
              </div>
            </div>
            {planLimit !== null && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  displayPlanLimitReached
                    ? "border-destructive/50 bg-destructive/5 text-destructive"
                    : "border-primary/30 bg-primary/5 text-primary"
                }`}
              >
                {displayPlanLimitReached
                  ? "Has alcanzado el máximo de empleados de tu plan. Contacta con soporte o amplía tu plan para añadir más personas."
                  : `Puedes invitar a ${displayRemainingSlots} empleado${displayRemainingSlots === 1 ? "" : "s"} más dentro del plan ${planInfo.label}.`}
              </div>
            )}
          </Card>
        )}

        {/* Filtros */}
        <Card className="glass-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v: RoleFilter) => setRoleFilter(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {canManageInvites && (
          <Card className="glass-card p-4 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
                <p className="text-sm text-muted-foreground">
                  Controla quién aún no ha activado su acceso.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchInvites}
                  disabled={invitesLoading}
                >
                  {invitesLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 mr-2" />
                  )}
                  Actualizar
                </Button>
                <Button
                  size="sm"
                  onClick={() => setInviteDialogOpen(true)}
                  className="hover-scale"
                  disabled={inviteDisabled}
                  title={inviteDisabled ? "Has alcanzado el máximo de empleados de tu plan" : undefined}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invitar
                </Button>
              </div>
            </div>
            {invitesError && (
              <p className="text-sm text-destructive">{invitesError}</p>
            )}
            {invitesLoading && pendingInvites.length === 0 ? (
              <Skeleton className="h-20 w-full" />
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay invitaciones pendientes.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border/60">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="outline" className="capitalize">
                          {invite.role}
                        </Badge>
                        <span>Creada {new Date(invite.created_at).toLocaleDateString("es-ES")}</span>
                        <span>Expira {new Date(invite.expires_at).toLocaleDateString("es-ES")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={inviteAction?.id === invite.id}
                      >
                        {inviteAction?.id === invite.id && inviteAction.action === "resend" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Reenviar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(invite.id)}
                        disabled={inviteAction?.id === invite.id}
                      >
                        {inviteAction?.id === invite.id && inviteAction.action === "revoke" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4 mr-2" />
                        )}
                        Revocar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {canManageInvites && recentAcceptedInvites.length > 0 && (
          <Card className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Últimas invitaciones aceptadas</h3>
                <p className="text-xs text-muted-foreground">
                  Historial rápido de los últimos accesos activados.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {recentAcceptedInvites.length} registro
                {recentAcceptedInvites.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {recentAcceptedInvites.map((invite) => (
                <div key={invite.id} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <p className="font-medium">{invite.email}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {invite.role}
                    </Badge>
                    <span>Aceptada {invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString("es-ES") : "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invitada el {new Date(invite.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tabla */}
        <Card className="glass-card">
          <div className="flex justify-end p-4 pb-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-end px-4 pb-2 gap-2">
            <Switch id="mini-maps" checked={miniMapsEnabled} onCheckedChange={setMiniMapsEnabled} />
            <Label htmlFor="mini-maps" className="text-sm text-muted-foreground">Mini-mapas en filas</Label>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Último fichaje</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-56" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2">
                          <Skeleton className="h-5 w-12" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-8 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8">
                      <Card className="glass-card p-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <UsersIcon className="w-8 h-8 text-primary" />
                          <h3 className="text-lg font-semibold">Aún no hay empleados</h3>
                          <p className="text-sm text-muted-foreground">Cuando haya empleados en tu empresa aparecerán aquí.</p>
                          <div className="mt-2">
                            <Button variant="outline" onClick={() => navigate("/people")}>Gestionar personas</Button>
                          </div>
                        </div>
                      </Card>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPageEmployees.map((employee, index) => (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-secondary/50 smooth-transition"
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.full_name || "Sin nombre"}</div>
                          <div className="text-sm text-muted-foreground">{employee.email}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={getRoleBadgeColor(employee.role as Exclude<RoleFilter, "all">)}>
                          {employee.role}
                        </Badge>
                      </TableCell>

                      <TableCell>{employee.center_name || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{employee.team_name || <span className="text-muted-foreground">-</span>}</TableCell>

                      <TableCell>
                        {(() => {
                          const pendingStatus = statusUpdates[employee.id];
                          const displayActive = pendingStatus ?? employee.is_active;
                          const isUpdatingStatus = pendingStatus !== undefined;
                          const labelId = `status-${employee.id}`;
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <Switch
                                id={labelId}
                                checked={displayActive}
                                onCheckedChange={(value) => handleStatusChange(employee, value)}
                                disabled={isUpdatingStatus}
                              />
                              <div className="flex items-center gap-1 text-xs">
                                <span className={displayActive ? "text-emerald-600" : "text-destructive"}>
                                  {displayActive ? "Activo" : "Desactivado"}
                                </span>
                                {isUpdatingStatus && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>

                      {/* Ubicación */}
                      <TableCell>
                        <HoverCard openDelay={150} onOpenChange={async (open) => { if (open) await fetchLastLocation(employee.id); }}>
                          <HoverCardTrigger asChild>
                            <button
                              className="text-primary hover:underline flex items-center gap-1"
                              onClick={async () => {
                                const loc = await fetchLastLocation(employee.id);
                                if (loc) window.open(`https://www.google.com/maps?q=${loc.lat},${loc.lng}`, "_blank");
                              }}
                              title="Ver en mapa"
                            >
                              <MapPin className="w-4 h-4" /> Ver mapa
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-[240px]">
                            {locCache[employee.id] ? (
                              <div className="rounded-md overflow-hidden">
                                <iframe
                                  title={`map-${employee.id}`}
                                  src={mapSrc(locCache[employee.id]!.lat, locCache[employee.id]!.lng, 14)}
                                  width="232"
                                  height="150"
                                  style={{ border: 0 }}
                                  loading="lazy"
                                  referrerPolicy="no-referrer-when-downgrade"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin ubicación registrada</span>
                            )}
                          </HoverCardContent>
                        </HoverCard>

                        {miniMapsEnabled && locCache[employee.id] && (
                          <div className="mt-2 rounded-md overflow-hidden border">
                            <iframe
                              title={`row-map-${employee.id}`}
                              src={mapSrc(locCache[employee.id]!.lat, locCache[employee.id]!.lng, 13)}
                              width="220"
                              height="140"
                              style={{ border: 0 }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        )}
                      </TableCell>

                      {/* Último fichaje */}
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatEventType(employee.last_event)}</div>
                          <div className="text-muted-foreground">{formatLastSeen(employee.last_event_time)}</div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManageSchedules && (
                            <Button variant="secondary" size="sm" onClick={() => handleOpenSchedule(employee)}>
                              <Clock3 className="w-4 h-4 mr-2" />
                              Ajustar jornada
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleOpenDetails(employee)}>
                            Ver ficha
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {currentPageEmployees.length} de {filteredEmployees.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {canManageInvites && (
        <InviteUserDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSuccess={handleInviteSuccess}
          slotsAvailable={planLimit === null ? null : displayRemainingSlots}
          planLimit={planLimit}
        />
      )}

      {selectedEmployee && (
        <EditUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} employee={selectedEmployee} onSuccess={fetchEmployees} />
      )}

      {canManageSchedules && scheduleEmployee && (
        <ScheduleHoursDialog
          key={scheduleEmployee.id}
          open={scheduleDialogOpen}
          onOpenChange={handleScheduleDialogChange}
          employee={scheduleEmployee}
        />
      )}

      {/* Ficha del empleado */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>Ficha del empleado</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (() => {
            const status = getEmployeeStatus(selectedEmployee.last_event);
            const quickInfo = [
              { label: "Nombre", value: selectedEmployee.full_name || "—" },
              { label: "Email", value: selectedEmployee.email },
              { label: "Rol", value: selectedEmployee.role },
              { label: "Centro", value: selectedEmployee.center_name || "Sin centro" },
              { label: "Equipo", value: selectedEmployee.team_name || "Sin equipo" },
              { label: "Último evento", value: formatEventType(selectedEmployee.last_event) },
            ];
            return (
              <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado actual</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {selectedEmployee.last_event_time
                            ? `Última actualización ${new Date(selectedEmployee.last_event_time).toLocaleString("es-ES")}`
                            : "Sin hora registrada"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/manager-calendar?user=${selectedEmployee.id}`)}>
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Ver calendario
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleExportEmployeeCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Descargar CSV
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {quickInfo.map((item) => (
                      <div key={item.label} className="rounded-2xl border bg-muted/30 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-sm break-all">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as "hours" | "map" | "insights")} className="space-y-4">
                  <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 rounded-2xl border px-3 py-2">
                    <TabsList className="w-full sm:w-auto grid grid-cols-3 rounded-xl bg-muted/40 p-1">
                      <TabsTrigger value="hours" className="text-xs sm:text-sm">Horas</TabsTrigger>
                      <TabsTrigger value="map" className="text-xs sm:text-sm">Mapa</TabsTrigger>
                      <TabsTrigger value="insights" className="text-xs sm:text-sm">Insights</TabsTrigger>
                    </TabsList>
                  </div>
                <TabsContent value="hours" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Fecha inicio</Label>
                        <Input
                          type="date"
                          value={detailHoursStart}
                          onChange={(e) => setDetailHoursStart(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Fecha fin</Label>
                        <Input
                          type="date"
                          value={detailHoursEnd}
                          onChange={(e) => setDetailHoursEnd(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col justify-end text-xs text-muted-foreground">
                        <p>Las jornadas se actualizan automáticamente al cambiar el rango.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Horas totales", value: formatSessionDuration(detailTotalHours) },
                        { label: "Jornadas registradas", value: detailHoursStats.totalSessions || "0" },
                        { label: "Promedio diario", value: formatSessionDuration(detailHoursStats.avgHours || 0) },
                        {
                          label: "Primer registro",
                          value: detailHoursStats.firstDay
                            ? new Date(detailHoursStats.firstDay).toLocaleDateString("es-ES")
                            : "—",
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border bg-card/60 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                          <p className="text-2xl font-semibold mt-1">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border overflow-hidden bg-card">
                      {detailHoursLoading ? (
                        <div className="p-5 space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-10/12" />
                          <Skeleton className="h-4 w-7/12" />
                        </div>
                      ) : detailHours.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4">No hay jornadas registradas en este período.</p>
                      ) : (
                        <div className="overflow-x-auto max-h-[320px]">
                          <Table className="text-xs sm:text-sm">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Entrada</TableHead>
                                <TableHead>Salida</TableHead>
                                <TableHead className="text-right">Horas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailHours.map((session) => {
                                const hours =
                                  session.clock_in_time && session.clock_out_time
                                    ? (() => {
                                        const start = new Date(session.clock_in_time).getTime();
                                        const end = new Date(session.clock_out_time).getTime();
                                        const pauseMs = Number(session.total_pause_duration ?? 0);
                                        const duration = Math.max(0, end - start - (isNaN(pauseMs) ? 0 : pauseMs));
                                        return duration / (1000 * 60 * 60);
                                      })()
                                    : 0;
                                return (
                                  <TableRow key={session.id}>
                                    <TableCell>
                                      {session.clock_in_time
                                        ? new Date(session.clock_in_time).toLocaleDateString("es-ES")
                                        : "—"}
                                    </TableCell>
                                    <TableCell>{formatTimeLabel(session.clock_in_time)}</TableCell>
                                    <TableCell>{formatTimeLabel(session.clock_out_time)}</TableCell>
                                    <TableCell className="text-right">{formatSessionDuration(hours)}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="map" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Fecha inicio</Label>
                        <Input
                          type="date"
                          value={detailMapStart}
                          onChange={(e) => setDetailMapStart(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Fecha fin</Label>
                        <Input
                          type="date"
                          value={detailMapEnd}
                          onChange={(e) => setDetailMapEnd(e.target.value)}
                        />
                      </div>
                      <div className="lg:col-span-2 flex flex-col gap-1">
                        <Label className="text-xs">Día de la semana</Label>
                        <Select value={detailMapWeekday} onValueChange={setDetailMapWeekday}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los días" />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col justify-end text-xs text-muted-foreground">
                        <p>Filtra fichajes según el día y visualiza hasta 12 ubicaciones recientes.</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border p-4 space-y-4 bg-card/60">
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {[
                          { label: "Entrada", type: "clock_in" },
                          { label: "Salida", type: "clock_out" },
                          { label: "Pausa", type: "pause_start" },
                          { label: "Reanudar", type: "pause_end" },
                        ].map((item) => (
                          <div key={item.type} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getEventColor(item.type) }} />
                            {item.label}
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                        <div className="space-y-3">
                          <div ref={detailMapContainerRef} className="w-full h-[260px] sm:h-[340px]" />
                          {detailMapLoading && (
                            <div className="flex justify-center py-6">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          )}
                          {!detailMapLoading && detailFilteredMapEvents.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center">
                              No hay ubicaciones con las condiciones seleccionadas.
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border bg-background/80 p-3 space-y-3 max-h-[340px] overflow-y-auto">
                          <p className="text-sm font-semibold">Últimos puntos registrados</p>
                          {detailMapLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton key={`map-sk-${idx}`} className="h-12 w-full" />
                              ))}
                            </div>
                          ) : detailVisibleMapEvents.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin ubicaciones recientes.</p>
                          ) : (
                            detailVisibleMapEvents.map((event) => (
                              <div key={event.id} className="rounded-lg border bg-card/80 px-3 py-2 text-xs space-y-1">
                                <p className="font-medium flex items-center gap-2">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getEventColor(event.event_type) }} />
                                  {formatEventType(event.event_type)}
                                </p>
                                <p className="text-muted-foreground">
                                  {new Date(event.event_time).toLocaleString("es-ES")}
                                </p>
                                {event.latitude && event.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    Ver en Maps
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">Sin ubicación</span>
                                )}
                              </div>
                            ))
                          )}
                          {detailFilteredMapEvents.length > detailVisibleMapEvents.length && (
                            <p className="text-[11px] text-muted-foreground">
                              Mostrando los {detailVisibleMapEvents.length} puntos más recientes.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="insights" className="space-y-4">
                    <EmployeeInsights
                      employeeId={selectedEmployee.id}
                      employeeName={selectedEmployee.full_name || selectedEmployee.email}
                      companyId={companyId || ""}
                    />
                  </TabsContent>
                </Tabs>

                <div className="rounded-2xl border p-4 bg-card/60">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-semibold">Últimos fichajes</p>
                    <Badge variant="outline" className="text-xs">
                      {detailsEvents.length} registros
                    </Badge>
                  </div>
                  {detailsEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin registros recientes</p>
                  ) : (
                    <div className="relative pl-6">
                      <span className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                      {detailsEvents.map((ev) => (
                        <div key={ev.id} className="relative pb-6 last:pb-0">
                          <span
                            className="absolute left-1 top-1 w-3 h-3 rounded-full border-2 border-background"
                            style={{ backgroundColor: getEventColor(ev.event_type) }}
                          />
                          <div className="rounded-xl border bg-background/80 p-3 text-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <p className="font-medium">{formatEventType(ev.event_type)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(ev.event_time).toLocaleString("es-ES")}
                                </p>
                              </div>
                              {ev.latitude && ev.longitude ? (
                                <a
                                  href={`https://www.google.com/maps?q=${ev.latitude},${ev.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                                >
                                  <MapPin className="w-3 h-3" />
                                  Ver ubicación
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin ubicación</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
