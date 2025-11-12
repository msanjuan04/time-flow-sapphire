import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Users, MapPin, Smartphone, Clock, UserCog, Loader2, Mail, Phone, CreditCard, NotebookPen, UserCheck } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { BackButton } from "@/components/BackButton";
type JsonRecord = Record<string, unknown>;

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  actor_user_id: string | null;
  reason: string | null;
}

interface CompanyDetail {
  id: string;
  name: string;
  status: string;
  plan: string;
  policies: JsonRecord | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  stats: {
    centers_count: number;
    devices_count: number;
    users_count: number;
    events_this_week: number;
    open_sessions: number;
  };
  recent_logs: AuditLogEntry[];
}

type InviteRole = "admin" | "manager" | "worker";

interface CompanyMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  center_name: string | null;
  team_name: string | null;
}

interface AdminUsersResponse {
  members: CompanyMember[];
}

interface AdminCompanyResponse {
  data: CompanyDetail;
}

interface CenterOption {
  id: string;
  name: string;
  address?: string | null;
}

interface TeamOption {
  id: string;
  name: string;
  center_name?: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  centers?: {
    name: string | null;
  } | null;
}

const AdminCompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("worker");
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [inviteCenter, setInviteCenter] = useState<string>("none");
  const [inviteTeam, setInviteTeam] = useState<string>("none");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [members, setMembers] = useState<CompanyMember[]>([]);

  const ensureRecord = (value: unknown): JsonRecord =>
    typeof value === "object" && value !== null ? (value as JsonRecord) : {};

  const getStringValue = (record: JsonRecord, key: string): string | null => {
    const raw = record[key];
    return typeof raw === "string" ? raw : null;
  };

  const formatDate = (value?: string | null, withTime = false) => {
    if (!value) return "—";
    const date = new Date(value);
    return withTime ? date.toLocaleString() : date.toLocaleDateString();
  };

  const getNumericValue = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    if (id) {
      fetchCompanyDetail();
      fetchAux();
      fetchMembers();
    }
  }, [id]);

  const fetchAux = async () => {
    if (!id) return;
    try {
      const [
        { data: centersData, error: centersError },
        { data: teamsData, error: teamsError },
      ] = await Promise.all([
        supabase.from("centers").select("id, name, address").eq("company_id", id),
        supabase.from("teams").select("id, name, centers(name)").eq("company_id", id),
      ]);

      if (centersError) {
        console.error("Failed to fetch centers:", centersError);
      }
      if (teamsError) {
        console.error("Failed to fetch teams:", teamsError);
      }

      const normalizedCenters: CenterOption[] = (centersData || []).map((center) => ({
        id: center.id,
        name: center.name,
        address: center.address,
      }));

      const normalizedTeams: TeamOption[] = ((teamsData || []) as TeamRow[]).map((team) => ({
        id: team.id,
        name: team.name,
        center_name: team.centers?.name || null,
      }));

      setCenters(normalizedCenters);
      setTeams(normalizedTeams);
    } catch (error) {
      console.error("Failed to fetch centers/teams:", error);
    }
  };

  const handleInvite = async () => {
    if (!id) return;
    if (!inviteEmail.trim()) {
      toast.error("Email requerido");
      return;
    }
    setSendingInvite(true);
    try {
      const { error } = await supabase.functions.invoke("admin-create-invite", {
        body: {
          company_id: id,
          email: inviteEmail.trim(),
          role: inviteRole,
          center_id: inviteCenter === "none" ? null : inviteCenter,
          team_id: inviteTeam === "none" ? null : inviteTeam,
        },
      });
      if (error) throw error;
      toast.success("Invitación enviada");
      setInviteEmail("");
      setInviteRole("worker");
      setInviteCenter("none");
      setInviteTeam("none");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Error al enviar invitación";
      toast.error(message);
    } finally {
      setSendingInvite(false);
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase.functions.invoke<AdminUsersResponse>("admin-list-users", {
        body: { company_id: id },
      });
      if (error) throw error;
      setMembers(data?.members || []);
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  };

  const fetchCompanyDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AdminCompanyResponse>("admin-get-company", {
        body: { company_id: id },
      });

      if (error) {
        console.error("Error fetching company:", error);
        toast.error("Error al cargar empresa");
        return;
      }

      setCompany(data?.data ?? null);
    } catch (error) {
      console.error("Failed to fetch company:", error);
      toast.error("Error al cargar empresa");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500/10 text-green-700 border-green-500/20",
      grace: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      suspended: "bg-red-500/10 text-red-700 border-red-500/20",
    };
    return variants[status] || variants.active;
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, string> = {
      free: "bg-gray-500/10 text-gray-700 border-gray-500/20",
      pro: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      enterprise: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    };
    return variants[plan] || variants.free;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!company) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Empresa no encontrada</p>
          <Button onClick={() => navigate("/admin/companies")} className="mt-4">
            Volver a empresas
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const companyPolicies = ensureRecord(company.policies);
  const contactPolicies = ensureRecord(companyPolicies["contact"]);
  const billingPolicies = ensureRecord(companyPolicies["billing"]);
  const internalNotes =
    getStringValue(companyPolicies, "internal_notes") ??
    getStringValue(companyPolicies, "notes");
  const accountManager = getStringValue(companyPolicies, "account_manager") ?? "No asignado";
  const contactEmail =
    getStringValue(contactPolicies, "email") ??
    getStringValue(contactPolicies, "billing_email") ??
    company.owner?.email ??
    "Sin definir";
  const contactPhone =
    getStringValue(contactPolicies, "phone") ??
    getStringValue(contactPolicies, "phone_number") ??
    getStringValue(companyPolicies, "phone") ??
    "Sin definir";
  const fiscalAddress =
    getStringValue(contactPolicies, "fiscal_address") ??
    getStringValue(companyPolicies, "fiscal_address") ??
    "No especificada";
  const operationsAddress =
    getStringValue(contactPolicies, "operations_address") ??
    getStringValue(companyPolicies, "operations_address") ??
    fiscalAddress;
  const supportChannel =
    getStringValue(contactPolicies, "support_channel") ??
    getStringValue(companyPolicies, "support_channel") ??
    "No especificado";
  const billingEmail = getStringValue(billingPolicies, "email") ?? contactEmail;
  const billingCycle =
    getStringValue(billingPolicies, "cycle") ??
    getStringValue(billingPolicies, "frequency") ??
    "No definido";
  const paymentMethod =
    getStringValue(billingPolicies, "method") ??
    getStringValue(billingPolicies, "payment_method") ??
    "No configurado";
  const nextRenewal =
    getStringValue(billingPolicies, "next_renewal") ??
    getStringValue(billingPolicies, "renews_at") ??
    getStringValue(billingPolicies, "renovates_at");
  const planStart = getStringValue(billingPolicies, "started_at") ?? company.created_at;
  const pendingInvoices = getNumericValue(billingPolicies["pending_invoices"]) ?? 0;
  const creditLimit = getNumericValue(billingPolicies["credit_limit"]);
  const licenseLimit =
    getNumericValue(billingPolicies["license_limit"]) ??
    getNumericValue(billingPolicies["seats"]) ??
    getNumericValue(billingPolicies["licenses"]);
  const activeMembers = members.filter((member) => member.is_active).length;
  const inactiveMembers = members.length - activeMembers;

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton to="/admin/companies" />
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusBadge(company.status)}>
                  {company.status}
                </Badge>
                <Badge className={getPlanBadge(company.plan)}>
                  {company.plan.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={() => startImpersonation(company.id, "admin")}
            disabled={impersonationLoading}
          >
            <UserCog className="w-4 h-4 mr-2" />
            Impersonar
          </Button>
        </div>

        {/* Overview */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Resumen general</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">
                {company.owner ? company.owner.email : "Sin owner"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Responsable interno</p>
              <p className="font-medium">{accountManager}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de creación</p>
              <p className="font-medium">{formatDate(company.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Última actualización</p>
              <p className="font-medium">{formatDate(company.updated_at, true)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID empresa</p>
              <p className="font-mono text-xs bg-muted/50 rounded px-2 py-1 break-all">
                {company.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuarios activos</p>
              <p className="font-medium">
                {activeMembers} / {members.length}{" "}
                <span className="text-sm text-muted-foreground">(inactivos: {inactiveMembers})</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Contacts */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Contactos y direcciones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email principal
                </p>
                <p className="font-medium">{contactEmail}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Teléfono
                </p>
                <p className="font-medium">{contactPhone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <NotebookPen className="w-4 h-4" />
                  Canal de soporte
                </p>
                <p className="font-medium capitalize">{supportChannel}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Dirección fiscal
                </p>
                <p className="font-medium">{fiscalAddress}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Dirección operativa
                </p>
                <p className="font-medium">{operationsAddress}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Plan & Billing */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Plan y facturación</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan actual</p>
                  <p className="font-medium capitalize">{company.plan}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inicio del plan</p>
                  <p className="font-medium">{formatDate(planStart)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próxima renovación</p>
                  <p className="font-medium">
                    {nextRenewal ? formatDate(nextRenewal, true) : "Sin programar"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email de facturación</p>
                  <p className="font-medium">{billingEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ciclo de facturación</p>
                  <p className="font-medium capitalize">{billingCycle}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Método de pago</p>
                  <p className="font-medium">{paymentMethod}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Uso de licencias</p>
                <p className="text-2xl font-bold">
                  {company.stats.users_count}
                  {licenseLimit ? ` / ${licenseLimit}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Usuarios registrados</p>
              </div>
              <div className="border-t border-dashed pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Pendientes de pago
                </p>
                <p className="text-xl font-semibold">
                  {pendingInvoices > 0 ? pendingInvoices : "Al día"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Límite de crédito</p>
                <p className="font-semibold">{formatCurrency(creditLimit)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Invite Users */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Invitar usuario a esta empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="email@empresa.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={(value: InviteRole) => setInviteRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
            <Select value={inviteCenter} onValueChange={setInviteCenter}>
              <SelectTrigger>
                <SelectValue placeholder="Centro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin centro</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={inviteTeam} onValueChange={setInviteTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin equipo</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button onClick={handleInvite} disabled={sendingInvite}>
                {sendingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                Enviar invitación
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Centros</p>
                <p className="text-2xl font-bold mt-1">{company.stats.centers_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dispositivos</p>
                <p className="text-2xl font-bold mt-1">{company.stats.devices_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Smartphone className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios</p>
                <p className="text-2xl font-bold mt-1">{company.stats.users_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichajes (semana)</p>
                <p className="text-2xl font-bold mt-1">{company.stats.events_this_week}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sesiones abiertas</p>
                <p className="text-2xl font-bold mt-1">{company.stats.open_sessions}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <Building2 className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </Card>
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios activos</p>
                <p className="text-2xl font-bold mt-1">{activeMembers}</p>
                <p className="text-xs text-muted-foreground">de {members.length} totales</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <UserCheck className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Centers & Teams */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Centros y equipos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">Centros ({centers.length})</p>
              </div>
              {centers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin centros registrados</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-auto pr-1">
                  {centers.map((center) => (
                    <div key={center.id} className="rounded-lg border p-3">
                      <p className="font-medium">{center.name}</p>
                      {center.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <MapPin className="w-4 h-4" />
                          {center.address}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">Equipos ({teams.length})</p>
              </div>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin equipos registrados</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-auto pr-1">
                  {teams.map((team) => (
                    <div key={team.id} className="rounded-lg border p-3">
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {team.center_name ? `Centro: ${team.center_name}` : "Sin centro asignado"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Internal Notes */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Notas internas</h2>
          {internalNotes ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {internalNotes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin notas internas registradas</p>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Actividad Reciente</h2>
          {company.recent_logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay actividad reciente
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.recent_logs.map((log: AuditLogEntry) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {log.reason || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Users List */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Usuarios ({members.length})</h2>
          {members.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay usuarios</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.email}</TableCell>
                      <TableCell>{m.role}</TableCell>
                      <TableCell className="text-muted-foreground">{m.center_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.team_name || "—"}</TableCell>
                      <TableCell>{m.is_active ? "Sí" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCompanyDetail;
