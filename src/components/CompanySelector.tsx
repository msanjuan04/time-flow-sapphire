import { Building2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/hooks/useMembership";

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
              <span className="font-medium">{m.company.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {m.role}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
