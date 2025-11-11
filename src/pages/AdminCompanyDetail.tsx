import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, Users, MapPin, Smartphone, Clock, UserCog, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";

interface CompanyDetail {
  id: string;
  name: string;
  status: string;
  plan: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  stats: {
    centers_count: number;
    devices_count: number;
    users_count: number;
    events_this_week: number;
    open_sessions: number;
  };
  recent_logs: any[];
}

const AdminCompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCompanyDetail();
    }
  }, [id]);

  const fetchCompanyDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-company", {
        body: { company_id: id },
      });

      if (error) {
        console.error("Error fetching company:", error);
        toast.error("Error al cargar empresa");
        return;
      }

      setCompany(data.data);
    } catch (error) {
      console.error("Failed to fetch company:", error);
      toast.error("Error al cargar empresa");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500/10 text-green-700 border-green-500/20",
      grace: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      suspended: "bg-red-500/10 text-red-700 border-red-500/20",
    };
    return variants[status] || variants.active;
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, string> = {
      free: "bg-gray-500/10 text-gray-700 border-gray-500/20",
      pro: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      enterprise: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    };
    return variants[plan] || variants.free;
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

  if (!company) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Empresa no encontrada</p>
          <Button onClick={() => navigate("/admin/companies")} className="mt-4">
            Volver a empresas
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/companies")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusBadge(company.status)}>
                  {company.status}
                </Badge>
                <Badge className={getPlanBadge(company.plan)}>
                  {company.plan.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={() => startImpersonation(company.id, "admin")}
            disabled={impersonationLoading}
          >
            <UserCog className="w-4 h-4 mr-2" />
            Impersonar
          </Button>
        </div>

        {/* Info Card */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Información</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">
                {company.owner ? `${company.owner.email}` : "Sin owner"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de creación</p>
              <p className="font-medium">
                {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Centros</p>
                <p className="text-2xl font-bold mt-1">{company.stats.centers_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dispositivos</p>
                <p className="text-2xl font-bold mt-1">{company.stats.devices_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Smartphone className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios</p>
                <p className="text-2xl font-bold mt-1">{company.stats.users_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichajes (semana)</p>
                <p className="text-2xl font-bold mt-1">{company.stats.events_this_week}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sesiones abiertas</p>
                <p className="text-2xl font-bold mt-1">{company.stats.open_sessions}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <Building2 className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Actividad Reciente</h2>
          {company.recent_logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay actividad reciente
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.recent_logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {log.reason || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCompanyDetail;
