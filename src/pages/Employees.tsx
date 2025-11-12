// src/pages/Employees.tsx
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
import {
  UserPlus,
  Search,
  Filter,
  Edit,
  Download,
  FileText,
  Users as UsersIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import InviteUserDialog from "@/components/InviteUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { motion } from "framer-motion";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { BackButton } from "@/components/BackButton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* --------------------------- utilidades locales --------------------------- */
const exportCSV = (
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) => {
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const printHTML = (title: string, html: string) => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<html><head><title>${title}</title><meta charset="utf-8"/></head><body>${html}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
  w.close();
};
/* ------------------------------------------------------------------------- */

type RoleFilter = "all" | "owner" | "admin" | "manager" | "worker";

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
  const { isSuperadmin } = useSuperadmin();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  /* ------------------------------ export helpers ------------------------------ */
  const handleExportCSV = () => {
    const headers = [
      "Nombre",
      "Email",
      "Rol",
      "Centro",
      "Equipo",
      "Último evento",
      "Hora último evento",
    ];
    const rows = filteredEmployees.map((e) => [
      e.full_name || "",
      e.email,
      e.role,
      e.center_name || "",
      e.team_name || "",
      e.last_event || "",
      e.last_event_time || "",
    ]);
    exportCSV("empleados", headers, rows);
  };

  const handleExportPDF = () => {
    const header = `<h1>Listado de empleados</h1><div class='muted'>${new Date().toLocaleString(
      "es-ES"
    )} · ${filteredEmployees.length} registros</div>`;
    const rows = filteredEmployees
      .map(
        (e) =>
          `<tr>
            <td>${e.full_name || ""}</td>
            <td>${e.email}</td>
            <td>${e.role}</td>
            <td>${e.center_name || ""}</td>
            <td>${e.team_name || ""}</td>
            <td>${e.last_event || ""}</td>
            <td>${e.last_event_time || ""}</td>
          </tr>`
      )
      .join("");
    const table = `<table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Centro</th><th>Equipo</th><th>Último evento</th><th>Hora último evento</th></tr></thead><tbody>${rows}</tbody></table>`;
    printHTML("Empleados · GTiQ", `${header}${table}`);
  };
  /* --------------------------------------------------------------------------- */

  useEffect(() => {
    if (!user) return void navigate("/auth");
    if (role && role !== "owner" && role !== "admin") return void navigate("/");
    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, role, user]);

  useEffect(() => setPage(1), [searchQuery, roleFilter]);

  useEffect(() => {
    if (companyId) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));
  const currentPageEmployees = filteredEmployees;

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("memberships")
        .select(
          `
          id, role, user_id,
          profiles!inner(id, email, full_name, center_id, team_id)
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId);

      if (roleFilter !== "all") {
        // TypeScript: excluir "all" al filtrar
        query = query.eq("role", roleFilter as Exclude<RoleFilter, "all">);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(
          `profiles.full_name.ilike.${term},profiles.email.ilike.${term}`
        );
      }

      const { data, error, count } = await query
        .order("user_id")
        .range(from, to);

      if (error) throw error;

      const membershipRows: MembershipRow[] = (data || []) as MembershipRow[];

      const employeesWithEvents = await Promise.all(
        membershipRows.map(async (m) => {
          const { data: lastEvent } = await supabase
            .from("time_events")
            .select("event_type, event_time")
            .eq("user_id", m.profiles.id)
            .eq("company_id", companyId)
            .order("event_time", { ascending: false })
            .limit(1)
            .maybeSingle();

          // nombres de centro y equipo
          let centerName: string | null = null;
          if (m.profiles.center_id) {
            const { data: center } = await supabase
              .from("centers")
              .select("name")
              .eq("id", m.profiles.center_id)
              .maybeSingle();
            centerName = center?.name || null;
          }

          let teamName: string | null = null;
          if (m.profiles.team_id) {
            const { data: team } = await supabase
              .from("teams")
              .select("name")
              .eq("id", m.profiles.team_id)
              .maybeSingle();
            teamName = team?.name || null;
          }

          return {
            id: m.profiles.id,
            email: m.profiles.email,
            full_name: m.profiles.full_name,
            role: m.role,
            center_id: m.profiles.center_id,
            team_id: m.profiles.team_id,
            center_name: centerName,
            team_name: teamName,
            last_event: lastEvent?.event_type || null,
            last_event_time: lastEvent?.event_time || null,
          } as Employee;
        })
      );

      setEmployees(employeesWithEvents);
      setFilteredEmployees(employeesWithEvents);
      setTotalEmployees(count || 0);
    } catch (e) {
      toast.error("Error al cargar empleados");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (r: Exclude<RoleFilter, "all">) =>
    (
      {
        owner: "bg-primary text-primary-foreground",
        admin: "bg-blue-500 text-white",
        manager: "bg-amber-500 text-white",
        worker: "bg-secondary text-secondary-foreground",
      } as Record<Exclude<RoleFilter, "all">, string>
    )[r] || "bg-secondary";

  const formatEventType = (t: string | null) =>
    !t
      ? "-"
      : ({ clock_in: "Entrada", clock_out: "Salida", pause_start: "Pausa", pause_end: "Reanudar" } as Record<string, string>)[t] ||
        t;

  const formatLastSeen = (ts: string | null) => {
    if (!ts) return "Nunca";
    const d = new Date(ts);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `Hace ${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `Hace ${h}h`;
    const days = Math.floor(h / 24);
    return `Hace ${days}d`;
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
                {totalEmployees} empleados en total
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

        {/* Filtros */}
        <Card className="glass-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v: RoleFilter) => setRoleFilter(v)}
            >
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

        {/* Tabla */}
        <Card className="glass-card">
          <div className="flex justify-end p-4 pb-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-56" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-8 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8">
                      <Card className="glass-card p-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <UsersIcon className="w-8 h-8 text-primary" />
                          <h3 className="text-lg font-semibold">
                            Aún no hay empleados
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Cuando haya empleados en tu empresa aparecerán aquí.
                          </p>
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              onClick={() => navigate("/people")}
                            >
                              Gestionar personas
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPageEmployees.map((employee, index) => (
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
                        <Badge className={getRoleBadgeColor(employee.role as Exclude<RoleFilter,"all">)}>
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

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {currentPageEmployees.length} de {filteredEmployees.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
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