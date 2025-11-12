import { useState, useEffect } from "react";
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
import { Building2, Users, Clock, Shield, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminStats {
  companies: {
    total: number;
    active: number;
    grace: number;
    suspended: number;
  };
  users_total: number;
  events_today: number;
  recent_logs: AdminAuditLog[];
}

interface AdminAuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  companies?: {
    name: string;
  } | null;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

        {/* Recent Activity */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Actividad Reciente</h2>
          {stats.recent_logs.length === 0 ? (
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
                    <TableHead>Empresa</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_logs.map((log: AdminAuditLog) => (
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
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
