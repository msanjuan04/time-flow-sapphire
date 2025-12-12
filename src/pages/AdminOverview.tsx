import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Users,
  Clock,
  Shield,
  Loader2,
  Activity,
  Sparkles,
  Ban,
  PlayCircle,
  Globe2,
  LifeBuoy,
  Zap,
  UserCheck,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface AdminStats {
  companies: {
    total: number;
    active: number;
    grace: number;
    suspended: number;
  };
  users_total: number;
  events_today: number;
  recent_logs: any[];
}

interface AdminCompany {
  id: string;
  name: string;
  status: string | null;
  plan: string | null;
  owner_email?: string | null;
  users_count?: number | null;
  last_event_at?: string | null;
}

interface AdminLog {
  id: string;
  action: string;
  entity_type?: string | null;
  companies?: { name?: string | null } | null;
  created_at: string;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [impersonateCompany, setImpersonateCompany] = useState<string>("none");
  const [impersonateRole, setImpersonateRole] = useState<"admin" | "manager" | "worker" | "inherit">("inherit");
  const [impersonating, setImpersonating] = useState(false);
  useDocumentTitle("Admin • GTiQ");
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchCompanies();
    fetchLogs();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-stats");

      if (error) {
        console.error("Error fetching stats:", error);
        toast.error("Error al cargar estadísticas");
        return;
      }

      setStats(data.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast.error("Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    setCompaniesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-companies");
      if (error) throw error;
      setCompanies((data?.data as AdminCompany[]) || []);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      toast.error("No se pudieron cargar empresas");
    } finally {
      setCompaniesLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-logs", {
        query: { limit: 8 },
      });
      if (error) throw error;
      setLogs((data?.data as AdminLog[]) || []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      toast.error("No se pudo cargar actividad reciente");
    } finally {
      setLogsLoading(false);
    }
  };

  const criticalCompanies = useMemo(() => {
    return companies
      .filter((c) => c.status === "suspended" || c.status === "grace")
      .slice(0, 5);
  }, [companies]);

  const activeRecently = useMemo(() => {
    return companies
      .filter((c) => c.last_event_at)
      .sort((a, b) => (b.last_event_at || "").localeCompare(a.last_event_at || ""))
      .slice(0, 5);
  }, [companies]);

  const handleImpersonate = async () => {
    if (!impersonateCompany || impersonateCompany === "none") {
      toast.error("Selecciona una empresa");
      return;
    }
    setImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: {
          company_id: impersonateCompany,
          as_role: impersonateRole === "inherit" ? undefined : impersonateRole,
        },
      });
      if (error) throw error;
      const payload = (data as any)?.data;
      if (payload) {
        localStorage.setItem("superadmin_impersonation", JSON.stringify(payload));
        toast.success("Impersonación iniciada");
        navigate("/"); // fuerza a recargar rutas con el nuevo contexto
      } else {
        toast.error("No se pudo iniciar la impersonación");
      }
    } catch (err) {
      console.error("Impersonate failed", err);
      toast.error("No se pudo impersonar");
    } finally {
      setImpersonating(false);
    }
  };

  const stopImpersonation = () => {
    localStorage.removeItem("superadmin_impersonation");
    toast.success("Impersonación detenida");
    navigate("/");
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!stats) {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-muted-foreground">
          No se pudieron cargar las estadísticas
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estadísticas globales del sistema
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Empresas Totales</p>
                <p className="text-3xl font-bold mt-1">{stats.companies.total}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-green-500/10 text-green-700">
                    {stats.companies.active} activas
                  </Badge>
                  {stats.companies.suspended > 0 && (
                    <Badge className="bg-red-500/10 text-red-700">
                      {stats.companies.suspended} suspendidas
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios Totales</p>
                <p className="text-3xl font-bold mt-1">{stats.users_total}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichajes Hoy</p>
                <p className="text-3xl font-bold mt-1">{stats.events_today}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Periodo Gracia</p>
                <p className="text-3xl font-bold mt-1">{stats.companies.grace}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Shield className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Acciones rápidas
                </h2>
                <p className="text-sm text-muted-foreground">Operaciones comunes sin salir del panel.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchStats}>
                <Loader2 className="w-4 h-4 mr-2" /> Refrescar KPIs
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/admin/companies")}>
                <Building2 className="w-4 h-4" /> Ver empresas
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/admin/users")}>
                <Users className="w-4 h-4" /> Buscar usuarios
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/admin/logs")}>
                <Activity className="w-4 h-4" /> Ver auditoría
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/admin/companies")}>
                <Globe2 className="w-4 h-4" /> Crear empresa
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/devices")}>
                <Zap className="w-4 h-4" /> Dispositivos
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => navigate("/reports")}>
                <LifeBuoy className="w-4 h-4" /> Reportes rápidos
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" /> Impersonar empresa
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activa una sesión como admin/manager/worker en la empresa seleccionada.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={stopImpersonation}>
                  Salir de impersonación
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={impersonateCompany} onValueChange={setImpersonateCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder={companiesLoading ? "Cargando..." : "Empresa"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecciona empresa</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.status === "suspended" ? " (suspendida)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={impersonateRole} onValueChange={(v) => setImpersonateRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rol opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Hereda rol real</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="worker">Worker</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleImpersonate} disabled={impersonating || companiesLoading}>
                  {impersonating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Impersonar
                </Button>
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Ban className="w-5 h-5 text-amber-500" /> Empresas en riesgo
              </h2>
              <Button variant="ghost" size="sm" onClick={fetchCompanies} disabled={companiesLoading}>
                {companiesLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Refrescar
              </Button>
            </div>
            {criticalCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin empresas en gracia/suspendidas.</p>
            ) : (
              <div className="space-y-2">
                {criticalCompanies.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.owner_email || "Sin owner"} · {c.users_count || 0} workers
                        </p>
                      </div>
                      <Badge variant={c.status === "suspended" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Último fichaje: {c.last_event_at ? new Date(c.last_event_at).toLocaleString() : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Actividad reciente
              </h2>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={logsLoading}>
                {logsLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Refrescar
              </Button>
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin registros recientes.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.entity_type || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.companies?.name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-primary" /> Últimas empresas activas
              </h2>
            </div>
            {activeRecently.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
            ) : (
              <div className="space-y-2">
                {activeRecently.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.plan || "sin plan"} · {c.users_count || 0} workers
                        </p>
                      </div>
                      <Badge variant="outline">{c.status || "—"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Último evento: {c.last_event_at ? new Date(c.last_event_at).toLocaleString() : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
