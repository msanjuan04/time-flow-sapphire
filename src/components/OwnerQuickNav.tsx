import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CompanySelector } from "@/components/CompanySelector";
import NotificationBell from "@/components/NotificationBell";
import { AlertCircle, BarChart3, Calendar, Settings, Tablet, Users, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";

const items = [
  { href: "/devices", label: "Dispositivos", icon: Tablet },
  { href: "/manager-calendar", label: "Calendario", icon: Calendar },
  { href: "/correction-requests", label: "Correcciones", icon: AlertCircle },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/people", label: "Personas", icon: Users },
  { href: "/company-settings", label: "Ubicación", icon: Settings },
];

const OwnerQuickNav = () => {
  const { signOut } = useAuth();
  const { role } = useMembership();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (role !== "owner") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden lg:flex items-center gap-2">
        <CompanySelector />
        <NotificationBell />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              variant="outline"
              size="icon"
              onClick={() => navigate(item.href)}
              className={`hover-scale ${pathname.startsWith(item.href) ? "bg-primary text-primary-foreground" : ""}`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            signOut();
            navigate("/auth", { replace: true });
          }}
          className="hover-scale"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <span className="font-semibold">Accesos rápidos</span>
          <span className="text-sm text-muted-foreground">
            {mobileOpen ? "Ocultar" : "Mostrar"}
          </span>
        </Button>
        {mobileOpen && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  variant="outline"
                  size="sm"
                  className={`justify-center ${active ? "bg-primary/10" : ""}`}
                  onClick={() => navigate(item.href)}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {item.label}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="justify-center"
              onClick={() => navigate("/")}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="justify-center"
              onClick={() => {
                signOut();
                navigate("/auth", { replace: true });
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerQuickNav;
