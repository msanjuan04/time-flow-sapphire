import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    center_id: string | null;
    team_id: string | null;
  };
  onSuccess: () => void;
}

interface Center {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

const EditUserDialog = ({ open, onOpenChange, employee, onSuccess }: EditUserDialogProps) => {
  const { companyId } = useMembership();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(employee.full_name || "");
  const [role, setRole] = useState(employee.role);
  const [centerId, setCenterId] = useState(employee.center_id || "");
  const [teamId, setTeamId] = useState(employee.team_id || "");
  const [centers, setCenters] = useState<Center[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const fetchCenters = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("centers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    if (data) setCenters(data);
  }, [companyId]);

  const fetchTeams = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    if (data) setTeams(data);
  }, [companyId]);

  const handleCreateCenter = useCallback(async () => {
    if (!companyId) return;
    const name = window.prompt("Nombre del nuevo centro");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from("centers")
      .insert({ company_id: companyId, name: name.trim() })
      .select("id, name")
      .single();
    if (error) {
      console.error(error);
      return;
    }
    await fetchCenters();
    if (data?.id) setCenterId(data.id);
  }, [companyId, fetchCenters]);

  const handleCreateTeam = useCallback(async () => {
    if (!companyId) return;
    const name = window.prompt("Nombre del nuevo equipo");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from("teams")
      .insert({ company_id: companyId, name: name.trim() })
      .select("id, name")
      .single();
    if (error) {
      console.error(error);
      return;
    }
    await fetchTeams();
    if (data?.id) setTeamId(data.id);
  }, [companyId, fetchTeams]);

  useEffect(() => {
    if (open && companyId) {
      setFullName(employee.full_name || "");
      setRole(employee.role);
      setCenterId(employee.center_id || "");
      setTeamId(employee.team_id || "");
      fetchCenters();
      fetchTeams();
    }
  }, [open, companyId, employee, fetchCenters, fetchTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          center_id: centerId || null,
          team_id: teamId || null,
        })
        .eq("id", employee.id);

      if (profileError) throw profileError;

      // Update membership role
      const { error: membershipError } = await supabase
        .from("memberships")
        .update({ role: role as "owner" | "manager" | "worker" })
        .eq("user_id", employee.id)
        .eq("company_id", companyId);

      if (membershipError) throw membershipError;

      toast.success("Usuario actualizado correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      const message = error instanceof Error ? error.message : "Error al actualizar usuario";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica los datos del empleado {employee.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="center">Centro (opcional)</Label>
              <div className="flex items-center gap-2">
                {centerId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCenterId("")}>Quitar</Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={handleCreateCenter}>Crear centro</Button>
              </div>
            </div>
            <Select value={centerId} onValueChange={(val) => setCenterId(val)}>
              <SelectTrigger>
                <SelectValue placeholder={centers.length ? "Seleccionar centro" : "No hay centros"} />
              </SelectTrigger>
              <SelectContent>
                {centers.map((center) => (
                  <SelectItem key={center.id} value={center.id}>
                    {center.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="team">Equipo (opcional)</Label>
              <div className="flex items-center gap-2">
                {teamId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTeamId("")}>Quitar</Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={handleCreateTeam}>Crear equipo</Button>
              </div>
            </div>
            <Select value={teamId} onValueChange={(val) => setTeamId(val)}>
              <SelectTrigger>
                <SelectValue placeholder={teams.length ? "Seleccionar equipo" : "No hay equipos"} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
