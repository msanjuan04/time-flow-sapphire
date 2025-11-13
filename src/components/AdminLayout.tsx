import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Building2, Users, Activity, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface AdminLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: "/admin", icon: BarChart3, label: "Overview" },
  { path: "/admin/companies", icon: Building2, label: "Empresas" },
  { path: "/admin/users", icon: Users, label: "Usuarios" },
  { path: "/admin/logs", icon: Activity, label: "Audit Logs" },
];

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen border-r bg-card/50 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <Shield className="w-6 h-6 text-primary" />
              <h2 className="text-lg font-bold">Admin Panel</h2>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-primary/10"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Volver a la app
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                signOut();
                navigate("/auth", { replace: true });
              }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};
