import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, Building2, Activity } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";

const Admin = () => {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Panel de Superadmin</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión avanzada del sistema
          </p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="glass-card p-6 hover-scale cursor-pointer"
            onClick={() => navigate("/admin/companies")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Empresas</h3>
                <p className="text-sm text-muted-foreground">
                  Gestionar e impersonar empresas
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="glass-card p-6 hover-scale cursor-pointer"
            onClick={() => navigate("/admin/users")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Usuarios</h3>
                <p className="text-sm text-muted-foreground">
                  Buscar y gestionar usuarios
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="glass-card p-6 hover-scale cursor-pointer"
            onClick={() => navigate("/admin/logs")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Audit Logs</h3>
                <p className="text-sm text-muted-foreground">
                  Ver actividad del sistema
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="glass-card p-6 hover-scale cursor-pointer"
            onClick={() => navigate("/admin")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Shield className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Estadísticas globales
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="glass-card p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Acceso Privilegiado</h3>
              <p className="text-sm text-muted-foreground">
                Como superadministrador, tienes acceso completo a todas las funciones
                del sistema. Usa estos permisos con responsabilidad.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Admin;
