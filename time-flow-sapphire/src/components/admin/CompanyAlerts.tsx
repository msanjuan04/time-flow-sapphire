import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  status: "active" | "grace" | "suspended";
  owner_email?: string | null;
}

interface CompanyAlertsProps {
  companies: Company[];
  loading: boolean;
  onCompanyClick: (companyId: string) => void;
}

export const CompanyAlerts = ({ companies, loading, onCompanyClick }: CompanyAlertsProps) => {
  return (
    <Card className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold">Alertas de empresas</h2>
        {companies.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {companies.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Cargando alertas...
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex p-3 rounded-full bg-green-500/10 mb-3">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Todo en orden. No hay alertas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="p-4 bg-amber-500/5 border-amber-500/20 hover:border-amber-500/50 cursor-pointer transition-all hover:shadow-md"
              onClick={() => onCompanyClick(company.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{company.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {company.owner_email || "Sin propietario"}
                  </p>
                </div>
                <Badge
                  className={
                    company.status === "suspended"
                      ? "bg-red-500/10 text-red-700 border-red-500/20"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                  }
                >
                  {company.status === "suspended" ? "Suspendida" : "En gracia"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};
