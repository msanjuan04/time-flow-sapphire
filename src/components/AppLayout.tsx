import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import {
  Clock,
  Calendar,
  MapPin,
  BarChart3,
  AlertCircle,
  LayoutDashboard,
  Users,
  Settings,
  AlertTriangle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import { CompanySelector } from "@/components/CompanySelector";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  worker: [
    { icon: Clock,           label: "Fichar",       path: "/me/clock" },
    { icon: Calendar,        label: "Calendario",   path: "/calendar" },
    { icon: MapPin,          label: "Ausencias",    path: "/absences" },
    { icon: BarChart3,       label: "Informes",     path: "/worker-reports" },
    { icon: AlertCircle,     label: "Correcciones", path: "/correction-requests" },
  ],
  manager: [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard" },
    { icon: Users,           label: "Empleados",    path: "/people" },
    { icon: BarChart3,       label: "Reportes",     path: "/reports" },
    { icon: Calendar,        label: "Calendario",   path: "/manager-calendar" },
    { icon: AlertTriangle,   label: "Incidencias",  path: "/incidents" },
    { icon: MapPin,          label: "Ausencias",    path: "/absences" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard" },
    { icon: Users,           label: "Empleados",    path: "/people" },
    { icon: BarChart3,       label: "Reportes",     path: "/reports" },
    { icon: Calendar,        label: "Calendario",   path: "/manager-calendar" },
    { icon: AlertTriangle,   label: "Incidencias",  path: "/incidents" },
    { icon: MapPin,          label: "Ausencias",    path: "/absences" },
    { icon: Settings,        label: "Ajustes",      path: "/company-settings" },
  ],
  owner: [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard" },
    { icon: Users,           label: "Empleados",    path: "/people" },
    { icon: BarChart3,       label: "Reportes",     path: "/reports" },
    { icon: Calendar,        label: "Calendario",   path: "/manager-calendar" },
    { icon: AlertTriangle,   label: "Incidencias",  path: "/incidents" },
    { icon: MapPin,          label: "Ausencias",    path: "/absences" },
    { icon: Settings,        label: "Ajustes",      path: "/company-settings" },
    { icon: Clock,           label: "Mi ficha",     path: "/me/clock" },
  ],
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { membership, hasMultipleCompanies } = useMembership();
  const navigate = useNavigate();
  const location = useLocation();

  const role = membership?.role ?? "worker";
  const navItems = NAV_ITEMS[role] ?? NAV_ITEMS.worker;
  const companyName = membership?.company?.name ?? "GTiQ";

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  return (
    <div className="h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex relative overflow-hidden">

      {/* ── #07 Orbes de luz ambiente ───────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[120px] bg-primary"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-[140px] bg-primary"
      />

      {/* ── Sidebar desktop ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full border-r border-border/60 bg-background/80 backdrop-blur-xl z-40">

        {/* Marca */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border/60 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">GTiQ</span>
        </div>

        {/* Empresa */}
        <div className="px-4 py-3 border-b border-border/40 shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5">
            Empresa
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{companyName}</p>
            {hasMultipleCompanies && <CompanySelector />}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left relative overflow-hidden",
                isActive(item.path)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {/* #04 Línea activa izquierda */}
              {isActive(item.path) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Acciones inferiores */}
        <div className="px-3 py-3 border-t border-border/60 shrink-0 space-y-0.5">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <NotificationBell />
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido ───────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-[68px] lg:pb-0 px-3 sm:px-4">
        {children}
      </main>

      {/* ── Bottom nav móvil ────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-[60px] bg-background/90 backdrop-blur-xl border-t border-border/50">
        <div className="flex w-full h-full overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-[3px] min-w-[64px] flex-1 px-1 transition-all duration-200 relative",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                {/* #04 Pill indicador top */}
                <span
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300",
                    active ? "w-6 opacity-100" : "w-0 opacity-0"
                  )}
                />
                <item.icon
                  className={cn(
                    "w-[22px] h-[22px] transition-all duration-200",
                    active && "scale-110"
                  )}
                />
                <span className="text-[10px] font-medium leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
