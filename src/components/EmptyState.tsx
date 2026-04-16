import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * #08 — Estado vacío unificado.
 * Ilustración minimalista SVG con líneas del color primary/20 + texto empático.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {/* Ilustración: orbe con icono */}
      <div className="relative mb-5">
        {/* Anillo exterior difuminado */}
        <div className="w-20 h-20 rounded-full bg-primary/6 absolute inset-0 scale-150 blur-lg" />
        <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center relative">
          {Icon ? (
            <Icon className="w-9 h-9 text-primary/40" strokeWidth={1.5} />
          ) : (
            /* SVG por defecto: bandeja vacía */
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              className="text-primary/40"
            >
              <rect
                x="4"
                y="10"
                width="28"
                height="18"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M4 18h6l3 4h10l3-4h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M13 7h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </div>

      <p className="text-base font-semibold text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
