import { useState, useEffect } from "react";
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
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email demasiado largo"),
  role: z.enum(["admin", "manager", "worker"]),
});

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const InviteUserDialog = ({ open, onOpenChange, onSuccess }: InviteUserDialogProps) => {
  const { companyId } = useMembership();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("worker");
  const [centerId, setCenterId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (open && companyId) {
      fetchCenters();
      fetchTeams();
    }
  }, [open, companyId]);

  const fetchCenters = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from("centers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    if (data) setCenters(data);
  };

  const fetchTeams = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    if (data) setTeams(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      toast.error("No se pudo obtener la información de la empresa");
      return;
    }

    // Validate
    try {
      inviteSchema.parse({ email, role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setLoading(true);

    try {
      // Delegate creation + email to the superadmin edge function
      const { data, error } = await supabase.functions.invoke("admin-create-invite", {
        body: {
          company_id: companyId,
          email: email.toLowerCase().trim(),
          role: role as "admin" | "manager" | "worker",
          center_id: centerId || null,
          team_id: teamId || null,
        },
      });

      if (error) throw error;

      // Copy invite link to clipboard for convenience
      const token = data?.invite?.token;
      if (token) {
        const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;
        try { await navigator.clipboard.writeText(inviteUrl); } catch {}
      }

      toast.success("Invitación creada correctamente", {
        description: token ? "Enlace de invitación copiado al portapapeles" : undefined,
      });

      // Reset form
      setEmail("");
      setRole("worker");
      setCenterId("");
      setTeamId("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating invite:", error);
      
      // Handle plan limit error
      if (error.message?.includes("límite") || error.message?.includes("limit")) {
        toast.error("Límite de plan alcanzado", {
          description: error.message || "Has alcanzado el límite de miembros de tu plan actual",
        });
      } else if (error?.status === 409) {
        toast.error("Ya existe una invitación o email registrado");
      } else if (error?.status === 401 || error?.status === 403) {
        toast.error("Permisos insuficientes o sesión no válida");
      } else {
        toast.error(error?.message || "Error al crear invitación");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar Usuario</DialogTitle>
          <DialogDescription>
            Completa los datos del nuevo empleado. Recibirá un email de invitación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="empleado@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="center">Centro (opcional)</Label>
            <Select value={centerId || "none"} onValueChange={(val) => setCenterId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar centro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin centro</SelectItem>
                {centers.map((center) => (
                  <SelectItem key={center.id} value={center.id}>
                    {center.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Equipo (opcional)</Label>
            <Select value={teamId || "none"} onValueChange={(val) => setTeamId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin equipo</SelectItem>
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
              disabled={loading || !companyId}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !companyId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!companyId ? "Cargando..." : "Enviar Invitación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
