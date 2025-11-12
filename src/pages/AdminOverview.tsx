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
  Clock,
  Search,
  Loader2,
  Plus,
  UserSearch,
  FileCheck,
  Activity,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
<<<<<<< HEAD
import { StatsCard } from "@/components/admin/StatsCard";
import { QuickActionCard } from "@/components/admin/QuickActionCard";
import { CompanyAlerts } from "@/components/admin/CompanyAlerts";
import { RecentActivity } from "@/components/admin/RecentActivity";
=======
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
>>>>>>> b85c716 (Mensaje explicando el cambio)

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
<<<<<<< HEAD
  const [statsLoading, setStatsLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
=======
  const [loading, setLoading] = useState(true);
  useDocumentTitle("Admin • GTiQ");
>>>>>>> b85c716 (Mensaje explicando el cambio)

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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Panel de Superadmin</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Visión global y control total de todas las cuentas
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchStats} disabled={statsLoading}>
              {statsLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
            <Button onClick={() => navigate("/admin/logs")}>
              Auditoría
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="glass-card p-6 border-border/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11"
              />
            </div>
          </div>
          {searchQuery && (
            <div className="mt-4">
              {filteredCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se encontraron empresas
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredCompanies.map((company) => (
                    <Card
                      key={company.id}
                      className="p-4 cursor-pointer hover:bg-muted/60 hover:shadow-md smooth-transition border-border/50"
                      onClick={() => navigate(`/admin/companies/${company.id}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{company.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {company.owner_email || "Sin propietario"} · Plan{" "}
                            <span className="font-medium">{company.plan.toUpperCase()}</span>
                          </p>
                        </div>
                        <Badge
                          className={
                            company.status === "suspended"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : company.status === "grace"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-green-500/10 text-green-600 border-green-500/20"
                          }
                        >
                          {company.status === "suspended"
                            ? "Suspendida"
                            : company.status === "grace"
                              ? "En gracia"
                              : "Activa"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Empresas totales"
            value={statsLoading ? "—" : stats?.companies.total ?? 0}
            subtitle={`${stats?.companies.active ?? 0} activas`}
            icon={Building2}
            iconColor="bg-blue-500/10 text-blue-600"
          />
          <StatsCard
            title="Usuarios totales"
            value={statsLoading ? "—" : stats?.users_total ?? 0}
            icon={Users}
            iconColor="bg-green-500/10 text-green-600"
          />
          <StatsCard
            title="Empresas en gracia"
            value={stats?.companies.grace ?? 0}
            subtitle={`${stats?.companies.suspended ?? 0} suspendidas`}
            icon={Clock}
            iconColor="bg-amber-500/10 text-amber-600"
          />
          <StatsCard
            title="Fichajes hoy"
            value={stats?.events_today ?? 0}
            icon={Activity}
            iconColor="bg-purple-500/10 text-purple-600"
          />
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Acciones rápidas</h2>
            <Button variant="outline" onClick={() => navigate("/admin/companies")}>
              Ver todas las empresas
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickActionCard
              title="Crear empresa"
              description="Configura una nueva cuenta y asigna un propietario"
              icon={Plus}
              onClick={() => navigate("/admin/companies")}
            />
            <QuickActionCard
              title="Buscar usuario"
              description="Localiza perfiles por email o empresa"
              icon={UserSearch}
              onClick={() => navigate("/admin/users")}
            />
            <QuickActionCard
              title="Revisar correcciones"
              description="Gestiona solicitudes de corrección de fichajes"
              icon={FileCheck}
              onClick={() => navigate("/correction-requests")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompanyAlerts
            companies={highlightedCompanies}
            loading={companiesLoading}
            onCompanyClick={(id) => navigate(`/admin/companies/${id}`)}
          />

          <RecentActivity logs={stats?.recent_logs || []} loading={statsLoading} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
