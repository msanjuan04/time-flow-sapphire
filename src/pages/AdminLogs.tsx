import { useState, useEffect, useMemo } from "react";
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
import { Search, Loader2, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  ip: string | null;
  reason: string | null;
  companies?: { name: string };
}

const AdminLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState("");

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (actionFilter !== "all") {
        params.append("action", actionFilter);
      }

      params.append("limit", "100");

      const { data, error } = await supabase.functions.invoke(
        `admin-list-logs?${params.toString()}`
      );

      if (error) {
        console.error("Error fetching logs:", error);
        toast.error("Error al cargar logs");
        return;
      }

      setLogs((data.data || []) as AuditLog[]);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      toast.error("Error al cargar logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const term = searchQuery.toLowerCase();
    const companyTerm = companyFilter.toLowerCase();
    return logs.filter((log) => {
      if (entityFilter !== "all" && (log.entity_type || "").toLowerCase() !== entityFilter.toLowerCase()) {
        return false;
      }
      if (term) {
        const haystack = `${log.action} ${log.reason || ""} ${log.entity_type || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (companyTerm) {
        const companyName = (log.companies?.name || "").toLowerCase();
        if (!companyName.includes(companyTerm)) return false;
      }
      return true;
    });
  }, [logs, searchQuery, entityFilter, companyFilter]);

  const exportCsv = () => {
    const headers = ["action", "entity_type", "company", "ip", "reason", "created_at"];
    const rows = filteredLogs.map((log) => [
      log.action,
      log.entity_type || "",
      log.companies?.name || "",
      log.ip || "",
      (log.reason || "").replace(/\n/g, " "),
      new Date(log.created_at).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {logs.length} registros de actividad
            </p>
          </div>
          <Button onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Filters */}
        <Card className="glass-card p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por acción o razón..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="impersonate">Impersonación</SelectItem>
                  <SelectItem value="company">Empresas</SelectItem>
                  <SelectItem value="role">Roles</SelectItem>
                  <SelectItem value="rules">Reglas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="membership">Roles</SelectItem>
                  <SelectItem value="rules">Reglas</SelectItem>
                  <SelectItem value="impersonation">Impersonación</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Filtrar por empresa"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-[200px]"
              />
              <Button onClick={fetchLogs} variant="outline">
                Filtrar
              </Button>
              <Button variant="secondary" onClick={exportCsv}>
                Exportar CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Logs Table */}
        <Card className="glass-card p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No se encontraron logs
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.entity_type || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.companies?.name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {log.ip || "—"}
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
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;
