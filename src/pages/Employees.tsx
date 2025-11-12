import { useEffect, useState } from "react";
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
import { UserPlus, Search, Filter, Edit, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import InviteUserDialog from "@/components/InviteUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { motion } from "framer-motion";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { BackButton } from "@/components/BackButton";

interface Employee {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  center_id: string | null;
  team_id: string | null;
  center_name: string | null;
  team_name: string | null;
  last_event: string | null;
  last_event_time: string | null;
}

interface MembershipRow {
  id: string;
  role: string;
  user_id: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    center_id: string | null;
    team_id: string | null;
  };
}

const Employees = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId, role } = useMembership();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { isSuperadmin } = useSuperadmin();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role && role !== "owner" && role !== "admin") {
      navigate("/");
      return;
    }
    if (companyId) {
      fetchEmployees();
    }
  }, [companyId, role, user, navigate]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchQuery, roleFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("memberships")
        .select(`
          id,
          role,
          user_id,
          profiles!inner(
            id,
            email,
            full_name,
            center_id,
            team_id
          )
        `)
        .eq("company_id", companyId);

      if (error) throw error;

      // Get last event for each user
      const membershipRows: MembershipRow[] = (data || []) as MembershipRow[];
      const employeesWithEvents = await Promise.all(
        membershipRows.map(async (membership) => {
          const { data: lastEvent } = await supabase
            .from("time_events")
            .select("event_type, event_time")
            .eq("user_id", membership.profiles.id)
            .eq("company_id", companyId)
            .order("event_time", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get center name
          let centerName = null;
          if (membership.profiles.center_id) {
            const { data: center } = await supabase
              .from("centers")
              .select("name")
              .eq("id", membership.profiles.center_id)
              .maybeSingle();
            centerName = center?.name;
          }

          // Get team name
          let teamName = null;
          if (membership.profiles.team_id) {
            const { data: team } = await supabase
              .from("teams")
              .select("name")
              .eq("id", membership.profiles.team_id)
              .maybeSingle();
            teamName = team?.name;
          }

          return {
            id: membership.profiles.id,
            email: membership.profiles.email,
            full_name: membership.profiles.full_name,
            role: membership.role,
            center_id: membership.profiles.center_id,
            team_id: membership.profiles.team_id,
            center_name: centerName,
            team_name: teamName,
            last_event: lastEvent?.event_type || null,
            last_event_time: lastEvent?.event_time || null,
          };
        })
      );

      setEmployees(employeesWithEvents);
    } catch (error) {
      toast.error("Error al cargar empleados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (emp) =>
          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((emp) => emp.role === roleFilter);
    }

    setFilteredEmployees(filtered);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-primary text-primary-foreground",
      admin: "bg-blue-500 text-white",
      manager: "bg-amber-500 text-white",
      worker: "bg-secondary text-secondary-foreground",
    };
    return colors[role] || "bg-secondary";
  };

  const formatEventType = (type: string | null) => {
    if (!type) return "-";
    const types: Record<string, string> = {
      clock_in: "Entrada",
      clock_out: "Salida",
      pause_start: "Pausa",
      pause_end: "Reanudar",
    };
    return types[type] || type;
  };

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return "Nunca";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton to="/" />
            <div>
              <h1 className="text-2xl font-bold">Gestión de Empleados</h1>
              <p className="text-sm text-muted-foreground">
                {employees.length} empleados en total
              </p>
            </div>
          </div>
          {isSuperadmin && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="hover-scale"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invitar Usuario
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="glass-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card className="glass-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Último fichaje</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando empleados...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No se encontraron empleados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-secondary/50 smooth-transition"
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.full_name || "Sin nombre"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(employee.role)}>
                          {employee.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee.center_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.team_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatEventType(employee.last_event)}</div>
                          <div className="text-muted-foreground">
                            {formatLastSeen(employee.last_event_time)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {isSuperadmin && (
        <InviteUserDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSuccess={fetchEmployees}
        />
      )}

      {selectedEmployee && (
        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          employee={selectedEmployee}
          onSuccess={fetchEmployees}
        />
      )}
    </div>
  );
};

export default Employees;
