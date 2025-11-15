// src/pages/Employees.tsx
import { useCallback, useEffect, useState } from "react";
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
  FileText,
  Users as UsersIcon,
  MapPin,
  RefreshCcw,
  Send,
  Ban,
  Loader2,
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

/* --------------------------- utilidades locales --------------------------- */
const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
};

const printHTML = (title: string, html: string) => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${title}</title><meta charset="utf-8"/></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  w.close();
};
/* ------------------------------------------------------------------------- */

type RoleFilter = "all" | "owner" | "admin" | "manager" | "worker";

interface Employee {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
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
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    center_id: string | null;
    team_id: string | null;
  };
}

/** Eventos de la ficha (definimos el tipo localmente para evitar `any`) */
interface DetailEvent {
  id: string;
  event_type: "clock_in" | "clock_out" | "pause_start" | "pause_end" | string;
  event_time: string;            // ISO
  latitude: number | null;
  longitude: number | null;
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
}

const Employees = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId, role } = useMembership();
  const { isSuperadmin } = useSuperadmin();
  const canManageInvites = isSuperadmin || role === "owner" || role === "admin";

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

  // Ficha de empleado
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvents, setDetailsEvents] = useState<DetailEvent[]>([]);

  // Preferencia mini-mapas (persistida)
  const [miniMapsEnabled, setMiniMapsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("employeesMiniMaps") === "1"; } catch { return false; }
  });

  // Cache de ubicaciones
  const [locCache, setLocCache] = useState<Record<string, { lat: number; lng: number } | null>>({});
  const [invites, setInvites] = useState<InviteSummary[]>([]);
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

  const handleExportPDF = () => {
    const header = `<h1>Listado de empleados</h1><div class='muted'>${new Date().toLocaleString("es-ES")} · ${filteredEmployees.length} registros</div>`;
    const rows = filteredEmployees.map(e =>
      `<tr>
        <td>${e.full_name || ""}</td>
        <td>${e.email}</td>
        <td>${e.role}</td>
        <td>${e.center_name || ""}</td>
        <td>${e.team_name || ""}</td>
        <td>${e.last_event || ""}</td>
        <td>${e.last_event_time || ""}</td>
      </tr>`
    ).join("");
    const table = `<table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Centro</th><th>Equipo</th><th>Último evento</th><th>Hora último evento</th></tr></thead><tbody>${rows}</tbody></table>`;
    printHTML("Empleados · GTiQ", `${header}${table}`);
  };
  /* --------------------------------------------------------------------------- */

  useEffect(() => {
    if (!user) return void navigate("/auth");
    if (role && role !== "owner" && role !== "admin") return void navigate("/");
    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, role, user]);

  useEffect(() => setPage(1), [searchQuery, roleFilter]);

  useEffect(() => {
    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));
  const currentPageEmployees = filteredEmployees;

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("memberships")
        .select(`
          id, role, user_id,
          profiles!inner(id, email, full_name, center_id, team_id)
        `, { count: "exact" })
        .eq("company_id", companyId);

      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter as Exclude<RoleFilter, "all">);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`profiles.full_name.ilike.${term},profiles.email.ilike.${term}`);
      }

      const { data, error, count } = await query.order("user_id").range(from, to);
      if (error) throw error;

      const membershipRows: MembershipRow[] = (data || []) as MembershipRow[];

      const employeesWithEvents = await Promise.all(
        membershipRows.map(async (m) => {
          const { data: lastEvent } = await supabase
            .from("time_events")
            .select("event_type, event_time")
            .eq("user_id", m.profiles.id)
            .eq("company_id", companyId)
            .order("event_time", { ascending: false })
            .limit(1)
            .maybeSingle();

          let centerName: string | null = null;
          if (m.profiles.center_id) {
            const { data: center } = await supabase
              .from("centers")
              .select("name")
              .eq("id", m.profiles.center_id)
              .maybeSingle();
            centerName = center?.name || null;
          }

          let teamName: string | null = null;
          if (m.profiles.team_id) {
            const { data: team } = await supabase
              .from("teams")
              .select("name")
              .eq("id", m.profiles.team_id)
              .maybeSingle();
            teamName = team?.name || null;
          }

          return {
            id: m.profiles.id,
            email: m.profiles.email,
            full_name: m.profiles.full_name,
            role: m.role,
            center_id: m.profiles.center_id,
            team_id: m.profiles.team_id,
            center_name: centerName,
            team_name: teamName,
            last_event: lastEvent?.event_type || null,
            last_event_time: lastEvent?.event_time || null,
          } as Employee;
        })
      );

      setEmployees(employeesWithEvents);
      setFilteredEmployees(employeesWithEvents);
      setTotalEmployees(count || 0);
    } catch (e) {
      toast.error("Error al cargar empleados");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvites = useCallback(async () => {
    if (!canManageInvites) return;
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ invites: InviteSummary[] }>("list-invites", {
        body: { status: "pending" },
      });
      if (error) throw error;
      setInvites(data?.invites ?? []);
    } catch (err) {
      console.error("Error fetching invites:", err);
      setInvitesError("No pudimos cargar las invitaciones.");
    } finally {
      setInvitesLoading(false);
    }
  }, [canManageInvites]);

  useEffect(() => {
    if (canManageInvites) {
      fetchInvites();
    } else {
      setInvites([]);
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

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleOpenDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
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
              <p className="text-sm text-muted-foreground">{totalEmployees} empleados en total</p>
            </div>
          </div>
        </div>

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
                <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="hover-scale">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invitar
                </Button>
              </div>
            </div>
            {invitesError && (
              <p className="text-sm text-destructive">{invitesError}</p>
            )}
            {invitesLoading && invites.length === 0 ? (
              <Skeleton className="h-20 w-full" />
            ) : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay invitaciones pendientes.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border/60">
                {invites.map((invite) => (
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
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
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
                    <TableCell colSpan={7} className="py-8">
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
        <InviteUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} onSuccess={handleInviteSuccess} />
      )}

      {selectedEmployee && (
        <EditUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} employee={selectedEmployee} onSuccess={fetchEmployees} />
      )}

      {/* Ficha del empleado */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ficha del empleado</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="font-medium">{selectedEmployee.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedEmployee.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">DNI/NIF</p>
                  <p className="font-medium">—</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="font-medium">—</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Últimos fichajes</p>
                <div className="space-y-2">
                  {detailsEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin registros recientes</p>
                  ) : (
                    detailsEvents.map((ev) => (
                      <div key={ev.id} className="p-2 rounded-md border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ev.event_type}</span>
                          <span className="text-muted-foreground">
                            {new Date(ev.event_time).toLocaleString("es-ES")}
                          </span>
                        </div>
                        {ev.latitude && ev.longitude ? (
                          <div className="mt-2 rounded-md overflow-hidden">
                            <iframe
                              title={`ev-map-${ev.id}`}
                              src={`https://maps.google.com/maps?q=${ev.latitude},${ev.longitude}&z=14&output=embed`}
                              width="100%"
                              height="140"
                              style={{ border: 0 }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Sin ubicación</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => navigate(`/manager-calendar?user=${selectedEmployee.id}`)}>
                  Abrir calendario del empleado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
