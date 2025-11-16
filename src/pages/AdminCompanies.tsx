import { useState, useEffect, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserCog, Search, Loader2, Plus, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  COMPANY_PLANS,
  CompanyPlanDefinition,
  CompanyPlanId,
  UNIVERSAL_PLAN_FEATURES,
  getCompanyPlanDefinition,
  getCompanyPlanLimit,
  normalizeCompanyPlan,
} from "@/config/companyPlans";

interface Company {
  id: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
  users_count?: number;
  last_event_at?: string | null;
  owner_email?: string | null;
}

interface PlanSelectionGridProps {
  selectedPlan: CompanyPlanId;
  onSelectPlan: (planId: CompanyPlanId) => void;
}

const AdminCompanies = () => {
  const navigate = useNavigate();
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  useDocumentTitle("Empresas • GTiQ");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "manager" | "worker">("admin");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyPlan, setNewCompanyPlan] = useState<CompanyPlanId>("empresa");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-companies");

      if (error) {
        console.error("Error fetching companies:", error);
        toast.error("Error al cargar empresas");
        return;
      }

      setCompanies(data.data || []);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      toast.error("Error al cargar empresas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    const name = newCompanyName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("admin-create-company", {
        body: { name, plan: newCompanyPlan },
      });
      if (error) throw error;
      const createdCompany = data?.company;
      if (createdCompany) {
        const normalizedCreatedPlan = normalizeCompanyPlan(createdCompany.plan);
        if (normalizedCreatedPlan !== newCompanyPlan) {
          try {
            const { error: planError } = await (supabase as any).functions.invoke(
              "admin-set-company-plan",
              {
                body: { company_id: createdCompany.id, plan: newCompanyPlan },
              }
            );
            if (planError) {
              console.warn("Failed to correct company plan:", planError);
              toast.message("Empresa creada, pero el plan no se pudo ajustar automáticamente.");
            }
          } catch (planError) {
            console.warn("Admin set company plan not available:", planError);
            toast.message("Empresa creada, revisa el plan manualmente.");
          }
        }
      }
      setCreateOpen(false);
      setNewCompanyName("");
      setNewCompanyPlan("empresa");
      fetchCompanies();
      toast.success("Empresa creada correctamente");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Error al crear empresa");
    } finally {
      setCreating(false);
    }
  };

  const handleImpersonate = (companyId: string) => {
    startImpersonation(companyId, selectedRole);
  };

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500/10 text-green-700 border-green-500/20",
      grace: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      suspended: "bg-red-500/10 text-red-700 border-red-500/20",
    };
    return variants[status] || variants.active;
  };

  const getPlanBadge = (plan: string) => {
    const info = getCompanyPlanDefinition(plan);
    const palette: Record<CompanyPlanId, string> = {
      basic: "bg-slate-500/10 text-slate-700 border-slate-500/20",
      empresa: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      pro: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
      advanced: "bg-purple-500/10 text-purple-700 border-purple-500/20",
      custom: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    };
    return palette[info.id];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gestión de Empresas</h1>
              <p className="text-sm text-muted-foreground">
                {companies.length} empresas en el sistema
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="hover-scale">
            <Plus className="w-4 h-4 mr-2" /> Crear empresa
          </Button>
        </div>

        {/* Filters */}
        <Card className="glass-card p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rol de impersonación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Companies Table */}
        <Card className="glass-card p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No se encontraron empresas
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Último fichaje</TableHead>
                    <TableHead>Fecha creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(company.status)}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPlanBadge(company.plan)}>
                          {getCompanyPlanDefinition(company.plan).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {company.owner_email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(() => {
                          const planInfo = getCompanyPlanDefinition(company.plan);
                          const limit = planInfo.maxEmployees;
                          const used = company.users_count || 0;
                          if (limit === null) {
                            return `${used} empleados (sin límite)`;
                          }
                          const remaining = Math.max(limit - used, 0);
                          return (
                            <span className="font-medium">
                              {used} / {limit}{" "}
                              <span className="text-xs text-muted-foreground block">
                                Restantes: {remaining}
                              </span>
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {company.last_event_at
                          ? new Date(company.last_event_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonate(company.id)}
                            disabled={impersonationLoading}
                            className="hover-scale"
                          >
                            <UserCog className="w-4 h-4 mr-1" />
                            Impersonar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/companies/${company.id}`)}
                            className="hover-scale"
                          >
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Create Company Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl w-full overflow-hidden rounded-3xl border-none bg-white p-0 shadow-2xl">
          <div className="flex max-h-[90vh] flex-col">
            <DialogHeader className="border-b px-6 py-6">
              <DialogTitle className="text-2xl font-semibold">Nueva empresa</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Introduce el nombre de la empresa
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <Input
                  placeholder="Nombre de la empresa"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
                <section className="space-y-5">
                  <div>
                    <p className="text-lg font-semibold">Selecciona el plan</p>
                    <p className="text-sm text-muted-foreground">
                      Define el número máximo de empleados que podrá gestionar esta empresa.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      Todos los planes incluyen
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      {UNIVERSAL_PLAN_FEATURES.map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          {feature}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      El precio solo varía según la cantidad máxima de empleados permitidos.
                    </p>
                  </div>
                  <PlanSelectionGrid
                    selectedPlan={newCompanyPlan}
                    onSelectPlan={(planId) => setNewCompanyPlan(planId)}
                  />
                </section>
              </div>
            </div>
            <div className="border-t px-6 py-4">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCompany} disabled={creating || !newCompanyName.trim()}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const standardPlanOrder: CompanyPlanId[] = ["basic", "empresa", "pro", "advanced"];

const PlanSelectionGrid = ({ selectedPlan, onSelectPlan }: PlanSelectionGridProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {standardPlanOrder.map((planId) => {
          const plan = COMPANY_PLANS[planId];
          return (
            <PlanCard
              key={planId}
              plan={plan}
              selected={selectedPlan === planId}
              onSelect={onSelectPlan}
            />
          );
        })}
      </div>
      <PlanCard
        plan={COMPANY_PLANS.custom}
        selected={selectedPlan === "custom"}
        onSelect={onSelectPlan}
      />
    </div>
  );
};

interface PlanCardProps {
  plan: CompanyPlanDefinition;
  selected: boolean;
  onSelect: (planId: CompanyPlanId) => void;
}

const PlanCard = ({ plan, selected, onSelect }: PlanCardProps) => {
  const employeeLabel =
    plan.maxEmployees !== null ? `Hasta ${plan.maxEmployees} empleados` : "Sin límite de empleados";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(plan.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(plan.id)}
      onKeyDown={handleKeyDown}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{plan.label}</p>
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        </div>
        {plan.highlight && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Más popular
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-3xl font-bold">{plan.price}</p>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">
          {employeeLabel}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">Todas las funcionalidades incluidas.</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 text-primary" />
          {employeeLabel}
        </span>
        {selected ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Plan seleccionado
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(plan.id);
            }}
          >
            Seleccionar plan
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminCompanies;
