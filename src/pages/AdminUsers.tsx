import { useState } from "react";
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
import { Search, Loader2, Mail } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserResult {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  memberships: Array<{
    role: string;
    company: {
      name: string;
    };
  }>;
}

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Ingresa un email para buscar");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name,
          created_at,
          memberships(
            role,
            company:companies(name)
          )
        `)
        .ilike("email", `%${searchQuery}%`)
        .limit(50);

      if (error) {
        console.error("Error searching users:", error);
        toast.error("Error al buscar usuarios");
        return;
      }

      setResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("No se encontraron usuarios");
      }
    } catch (error) {
      console.error("Failed to search users:", error);
      toast.error("Error al buscar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-500/10 text-purple-700",
      admin: "bg-blue-500/10 text-blue-700",
      manager: "bg-green-500/10 text-green-700",
      worker: "bg-gray-500/10 text-gray-700",
    };
    return colors[role] || colors.worker;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buscar usuarios por email
          </p>
        </div>

        {/* Search */}
        <Card className="glass-card p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buscar
            </Button>
          </div>
        </Card>

        {/* Results */}
        {searched && (
          <Card className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">
              Resultados ({results.length})
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No se encontraron usuarios
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Empresas</TableHead>
                      <TableHead>Fecha registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>{user.full_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.memberships && user.memberships.length > 0 ? (
                              user.memberships.map((m: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  className={getRoleBadgeColor(m.role)}
                                  variant="outline"
                                >
                                  {m.company?.name} ({m.role})
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Sin empresas
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" disabled>
                            Reset Password
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
