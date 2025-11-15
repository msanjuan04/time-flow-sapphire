import { Building2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/hooks/useMembership";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const CompanySelector = () => {
  const { membership, memberships, hasMultipleCompanies, switchCompany } = useMembership();

  if (!hasMultipleCompanies) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="w-4 h-4" />
          <span className="max-w-[150px] truncate">
            {membership?.company.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => switchCompany(m.company_id)}
            className="gap-2 cursor-pointer"
          >
            {m.company_id === membership?.company_id && (
              <Check className="w-4 h-4" />
            )}
            <div className="flex flex-col flex-1">
              <span className="font-medium">{m.company?.name || "Empresa sin nombre"}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{m.role}</span>
                {m.company?.status && (
                  <Badge
                    variant={m.company.status === "suspended" ? "destructive" : "secondary"}
                    className={cn(
                      "text-[10px]",
                      m.company.status === "grace" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
                      m.company.status === "suspended" && "bg-red-100 text-red-700 hover:bg-red-100"
                    )}
                  >
                    {m.company.status === "grace"
                      ? "Período de gracia"
                      : m.company.status === "suspended"
                      ? "Suspendida"
                      : "Activa"}
                  </Badge>
                )}
                {m.company?.plan && (
                  <span className="text-[10px] uppercase tracking-wide">
                    Plan {m.company.plan}
                  </span>
                )}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
