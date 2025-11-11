import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, Building2, Activity } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover-scale"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Panel de Superadmin</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestión avanzada del sistema
            </p>
          </div>
        </div>

        {/* Admin Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="glass-card p-6 hover-scale cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Empresas</h3>
                <p className="text-sm text-muted-foreground">
                  Gestionar todas las empresas del sistema
                </p>
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Usuarios</h3>
                <p className="text-sm text-muted-foreground">
                  Ver y gestionar todos los usuarios
                </p>
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Actividad</h3>
                <p className="text-sm text-muted-foreground">
                  Logs de auditoría y actividad del sistema
                </p>
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Shield className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Superadmins</h3>
                <p className="text-sm text-muted-foreground">
                  Gestionar accesos de superadministrador
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
    </div>
  );
};

export default Admin;
