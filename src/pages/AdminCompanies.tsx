import { useState, useEffect } from "react";
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
import { UserCog, Search, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BackButton } from "@/components/BackButton";

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

const AdminCompanies = () => {
  const navigate = useNavigate();
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "manager" | "worker">("admin");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
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
      const { error } = await supabase.functions.invoke("admin-create-company", {
        body: { name },
      });
      if (error) throw error;
      setCreateOpen(false);
      setNewCompanyName("");
      fetchCompanies();
      toast.success("Empresa creada correctamente");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Error al crear empresa";
      toast.error(message);
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
    const variants: Record<string, string> = {
      free: "bg-gray-500/10 text-gray-700 border-gray-500/20",
      pro: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      enterprise: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    };
    return variants[plan] || variants.free;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton to="/admin" />
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
            <Select value={selectedRole} onValueChange={(value: "admin" | "manager" | "worker") => setSelectedRole(value)}>
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
                          {company.plan.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {company.owner_email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {company.users_count || 0}
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
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
            <DialogDescription>Introduce el nombre de la empresa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nombre de la empresa"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
              <Button onClick={handleCreateCompany} disabled={creating || !newCompanyName.trim()}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCompanies;
