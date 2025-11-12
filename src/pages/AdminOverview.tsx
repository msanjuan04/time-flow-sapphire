import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users,
  Building2,
  Activity,
  AlertTriangle,
  Search,
  Loader2,
  Clock,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

interface AdminStats {
  companies: {
    total: number;
    active: number;
    grace: number;
    suspended: number;
  };
  users_total: number;
  events_today: number;
  recent_logs: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    company_id: string | null;
    created_at: string;
  }>;
}

interface CompanySummary {
  id: string;
  name: string;
  status: "active" | "grace" | "suspended";
  owner_email?: string | null;
  plan: string;
}

const AdminOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStats();
    fetchCompanies();
  }, []);

  const fetchStats = async () => {
    setStatsLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-stats");
    if (error) {
      console.error("Error fetching admin stats:", error);
    } else {
      setStats(data.data || null);
    }
    setStatsLoading(false);
  };

  const fetchCompanies = async () => {
    setCompaniesLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-companies");
    if (error) {
      console.error("Error fetching companies:", error);
    } else {
      setCompanies((data?.data || []) as CompanySummary[]);
    }
    setCompaniesLoading(false);
  };

  const highlightedCompanies = useMemo(
    () =>
      companies
        .filter((company) => company.status === "suspended" || company.status === "grace")
        .slice(0, 4),
    [companies],
  );

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const normalized = searchQuery.trim().toLowerCase();
    return companies
      .filter((company) => company.name.toLowerCase().includes(normalized))
      .slice(0, 5);
  }, [companies, searchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Panel de Superadmin</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Visión global y acciones rápidas sobre todas las cuentas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchStats} disabled={statsLoading}>
              {statsLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar datos
            </Button>
            <Button onClick={() => navigate("/admin/logs")}>Ver auditoría</Button>
          </div>
        </div>

        {/* Search */}
        <Card className="glass-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Selecciona un resultado para abrir la ficha rápidamente.
            </div>
          </div>
          {searchQuery && (
            <div className="mt-4">
              {filteredCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin coincidencias</p>
              ) : (
                <div className="space-y-2">
                  {filteredCompanies.map((company) => (
                    <Card
                      key={company.id}
                      className="p-3 cursor-pointer hover:bg-muted/60 smooth-transition"
                      onClick={() => navigate(`/admin/companies/${company.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {company.owner_email || "Sin owner"} · Plan {company.plan.toUpperCase()}
                          </p>
                        </div>
                        <Badge
                          className={
                            company.status === "suspended"
                              ? "bg-red-500/10 text-red-600"
                              : company.status === "grace"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-green-500/10 text-green-600"
                          }
                        >
                          {company.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Empresas totales</p>
                <p className="text-3xl font-bold mt-1">
                  {statsLoading ? "—" : stats?.companies.total ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activas: {stats?.companies.active ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios totales</p>
                <p className="text-3xl font-bold mt-1">
                  {statsLoading ? "—" : stats?.users_total ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Empresas en gracia</p>
                <p className="text-3xl font-bold mt-1">{stats?.companies.grace ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </Card>
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichajes de hoy</p>
                <p className="text-3xl font-bold mt-1">{stats?.events_today ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick actions */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Acciones rápidas</h2>
            <Button variant="secondary" onClick={() => navigate("/admin/companies")}>
              Ver empresas
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="p-4 border-dashed hover:border-primary smooth-transition cursor-pointer"
              onClick={() => navigate("/admin/companies")}
            >
              <h3 className="font-semibold mb-1">Crear empresa</h3>
              <p className="text-sm text-muted-foreground">
                Configura una cuenta nueva y asigna un responsable.
              </p>
            </Card>
            <Card
              className="p-4 border-dashed hover:border-primary smooth-transition cursor-pointer"
              onClick={() => navigate("/admin/users")}
            >
              <h3 className="font-semibold mb-1">Buscar usuario</h3>
              <p className="text-sm text-muted-foreground">
                Localiza perfiles por email o empresa.
              </p>
            </Card>
            <Card
              className="p-4 border-dashed hover:border-primary smooth-transition cursor-pointer"
              onClick={() => navigate("/correction-requests")}
            >
              <h3 className="font-semibold mb-1">Revisar correcciones</h3>
              <p className="text-sm text-muted-foreground">
                Gestiona incidencias de fichajes pendientes.
              </p>
            </Card>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Alertas de empresas</h2>
            </div>
            {companiesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Cargando alertas
              </div>
            ) : highlightedCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todo en orden.</p>
            ) : (
              <div className="space-y-3">
                {highlightedCompanies.map((company) => (
                  <Card
                    key={company.id}
                    className="p-4 bg-amber-500/5 border-amber-500/20 hover:border-amber-500/50 cursor-pointer"
                    onClick={() => navigate(`/admin/companies/${company.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Owner: {company.owner_email || "Sin datos"}
                        </p>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-700 border-none">
                        {company.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Actividad reciente</h2>
            </div>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Cargando actividad
              </div>
            ) : stats && stats.recent_logs.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("es-ES")}
                      </p>
                    </div>
                    {log.entity_type && <Badge variant="outline">{log.entity_type}</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin logs recientes.</p>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
