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
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email demasiado largo"),
  role: z.enum(["owner", "manager", "worker"]),
});

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  slotsAvailable?: number | null;
  planLimit?: number | null;
}

interface Center {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

const InviteUserDialog = ({
  open,
  onOpenChange,
  onSuccess,
  slotsAvailable = null,
  planLimit = null,
}: InviteUserDialogProps) => {
  const { companyId } = useMembership();
  const { isSuperadmin } = useSuperadmin();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("worker");
  const [centerId, setCenterId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [dni, setDni] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const limitReached = planLimit !== null && (slotsAvailable ?? 0) <= 0;

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
      toast.error("No se pudo crear el centro");
      return;
    }
    await fetchCenters();
    if (data?.id) setCenterId(data.id);
    toast.success("Centro creado");
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
      toast.error("No se pudo crear el equipo");
      return;
    }
    await fetchTeams();
    if (data?.id) setTeamId(data.id);
    toast.success("Equipo creado");
  }, [companyId, fetchTeams]);

  useEffect(() => {
    if (open && companyId) {
      fetchCenters();
      fetchTeams();
    }
  }, [open, companyId, fetchCenters, fetchTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!companyId) {
      toast.error("No se pudo obtener la información de la empresa");
      return;
    }

    if (!isSuperadmin && limitReached) {
      toast.error("Has alcanzado el máximo de empleados permitidos por tu plan.");
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

    // Centro y equipo ahora son opcionales en UI

    setLoading(true);

    try {
      // Delegate creation + email to the superadmin edge function
      const endpoint = isSuperadmin ? "admin-create-invite" : "create-invite";
      const payload = isSuperadmin
        ? {
            company_id: companyId,
            email: email.toLowerCase().trim(),
            role: role as "owner" | "manager" | "worker",
            center_id: centerId || null,
            team_id: teamId || null,
            full_name: fullName || undefined,
            dni: dni || undefined,
            phone: phone || undefined,
          }
        : {
            email: email.toLowerCase().trim(),
            role: role as "owner" | "manager" | "worker",
            center_id: centerId || null,
            team_id: teamId || null,
          };

      if (!companyId && !isSuperadmin) {
        throw new Error("No se encontró la empresa activa");
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: payload,
      });

      if (error) throw error;

      // Copy invite link to clipboard for convenience
      const token = data?.invite?.token;
      if (token) {
        const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;
        try {
          await navigator.clipboard.writeText(inviteUrl);
        } catch (clipboardError) {
          console.warn("No se pudo copiar el enlace de invitación:", clipboardError);
        }
      }

      toast.success("Invitación creada correctamente", {
        description: token ? "Enlace de invitación copiado al portapapeles" : undefined,
      });

      // Reset form
      setEmail("");
      setRole("worker");
      setCenterId("");
      setTeamId("");
      setFullName("");
      setDni("");
      setPhone("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating invite:", error);
      const message = error instanceof Error ? error.message : "";
      const status = (error as { status?: number })?.status;
      
      // Handle plan limit error
      if (message?.includes("límite") || message?.includes("limit")) {
        toast.error("Límite de plan alcanzado", {
          description: message || "Has alcanzado el límite de miembros de tu plan actual",
        });
      } else if (status === 409) {
        toast.error("Ya existe una invitación o email registrado");
      } else if (status === 401 || status === 403) {
        toast.error("Permisos insuficientes o sesión no válida");
      } else {
        toast.error(message || "Error al crear invitación");
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

        {planLimit !== null && (
          <div className="rounded-2xl border border-dashed p-3 text-sm">
            <p className="font-semibold">Capacidad disponible</p>
            <p className="text-muted-foreground">
              Puedes activar {Math.max(slotsAvailable ?? 0, 0)} de {planLimit} empleados con tu plan.
            </p>
            {limitReached && !isSuperadmin && (
              <p className="text-destructive text-xs mt-1">
                Has alcanzado el límite. Amplía tu plan para invitar a más personas.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre y apellidos (opcional)</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre Apellidos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI/NIF (opcional)</Label>
              <Input id="dni" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678A" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
            </div>
          </div>
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
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="center">Centro (opcional)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleCreateCenter}>Crear centro</Button>
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
              <Button type="button" variant="ghost" size="sm" onClick={handleCreateTeam}>Crear equipo</Button>
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
              disabled={loading || !companyId}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !companyId || (!isSuperadmin && limitReached)}
            >
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
