import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  iconColor?: string;   // tailwind bg class, ej: "bg-primary"
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * #05 — Header de página unificado.
 * Icono con gradiente sutil + jerarquía tipográfica consistente en toda la app.
 */
export function PageHeader({
  icon: Icon,
  iconColor = "bg-primary",
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm",
              iconColor
            )}
            style={{
              background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))`,
            }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
