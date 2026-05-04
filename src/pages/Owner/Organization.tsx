import { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Edit,
  UserCog,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";

interface Center {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  description: string | null;
  manager_id: string | null;
}

interface Team {
  id: string;
  company_id: string;
  center_id: string | null;
  name: string;
  description: string | null;
  manager_id: string | null;
}

interface Person {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  team_id: string | null;
  center_id: string | null;
}

const Organization = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId, role, loading: membershipLoading } = useMembership();

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Center dialog state
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [centerForm, setCenterForm] = useState({
    name: "",
    address: "",
    description: "",
    manager_id: "",
  });

  // Team dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    center_id: "",
    manager_id: "",
  });

  const allowed = role === "owner" || role === "admin";

  useEffect(() => {
    if (membershipLoading) return;
    if (!user) navigate("/auth", { replace: true });
    else if (!allowed) navigate("/access-issue?reason=no-role", { replace: true });
  }, [user, allowed, membershipLoading, navigate]);

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [c, t, m] = await Promise.all([
        supabase
          .from("centers")
          .select("id, company_id, name, address, description, manager_id")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("teams")
          .select("id, company_id, center_id, name, description, manager_id")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("memberships")
          .select(
            `
            user_id, role,
            profiles!inner(id, full_name, email, team_id, center_id)
          `
          )
          .eq("company_id", companyId),
      ]);

      if (c.error) throw c.error;
      if (t.error) throw t.error;
      if (m.error) throw m.error;

      setCenters((c.data as Center[]) || []);
      setTeams((t.data as Team[]) || []);

      const peopleData: Person[] = ((m.data as any[]) || []).map((row) => ({
        id: row.user_id,
        full_name: row.profiles?.full_name ?? null,
        email: row.profiles?.email ?? "",
        role: row.role,
        team_id: row.profiles?.team_id ?? null,
        center_id: row.profiles?.center_id ?? null,
      }));
      setPeople(peopleData);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo cargar la organización");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!membershipLoading && companyId) void fetchAll();
  }, [companyId, membershipLoading, fetchAll]);

  // Managers candidates: anyone with role owner/admin/manager in this company
  const managerCandidates = useMemo(
    () => people.filter((p) => ["owner", "admin", "manager"].includes(p.role)),
    [people]
  );

  // ============ CENTERS ============
  const openNewCenter = () => {
    setEditingCenter(null);
    setCenterForm({ name: "", address: "", description: "", manager_id: "" });
    setCenterDialogOpen(true);
  };
  const openEditCenter = (c: Center) => {
    setEditingCenter(c);
    setCenterForm({
      name: c.name || "",
      address: c.address || "",
      description: c.description || "",
      manager_id: c.manager_id || "",
    });
    setCenterDialogOpen(true);
  };

  const saveCenter = async () => {
    if (!centerForm.name.trim()) {
      toast.error("El nombre del centro es obligatorio");
      return;
    }
    try {
      const payload: any = {
        company_id: companyId,
        name: centerForm.name.trim(),
        address: centerForm.address.trim() || null,
        description: centerForm.description.trim() || null,
        manager_id: centerForm.manager_id || null,
      };
      if (editingCenter) {
        const { error } = await supabase.from("centers").update(payload).eq("id", editingCenter.id);
        if (error) throw error;
        toast.success("Centro actualizado");
      } else {
        const { error } = await supabase.from("centers").insert(payload);
        if (error) throw error;
        toast.success("Centro creado");
      }
      setCenterDialogOpen(false);
      void fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Error guardando centro");
    }
  };

  const deleteCenter = async (c: Center) => {
    if (!confirm(`¿Eliminar el centro "${c.name}"? Los equipos asociados quedarán sin centro.`)) return;
    try {
      const { error } = await supabase.from("centers").delete().eq("id", c.id);
      if (error) throw error;
      toast.success("Centro eliminado");
      void fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Error eliminando");
    }
  };

  // ============ TEAMS ============
  const openNewTeam = (centerId?: string) => {
    setEditingTeam(null);
    setTeamForm({
      name: "",
      description: "",
      center_id: centerId || "",
      manager_id: "",
    });
    setTeamDialogOpen(true);
  };
  const openEditTeam = (t: Team) => {
    setEditingTeam(t);
    setTeamForm({
      name: t.name || "",
      description: t.description || "",
      center_id: t.center_id || "",
      manager_id: t.manager_id || "",
    });
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    if (!teamForm.name.trim()) {
      toast.error("El nombre del equipo es obligatorio");
      return;
    }
    try {
      const payload: any = {
        company_id: companyId,
        name: teamForm.name.trim(),
        description: teamForm.description.trim() || null,
        center_id: teamForm.center_id || null,
        manager_id: teamForm.manager_id || null,
      };
      if (editingTeam) {
        const { error } = await supabase.from("teams").update(payload).eq("id", editingTeam.id);
        if (error) throw error;
        toast.success("Equipo actualizado");
      } else {
        const { error } = await supabase.from("teams").insert(payload);
        if (error) throw error;
        toast.success("Equipo creado");
      }
      setTeamDialogOpen(false);
      void fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Error guardando equipo");
    }
  };

  const deleteTeam = async (t: Team) => {
    if (!confirm(`¿Eliminar el equipo "${t.name}"?`)) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", t.id);
      if (error) throw error;
      toast.success("Equipo eliminado");
      void fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Error eliminando");
    }
  };

  // Helper para mostrar gente por equipo
  const peopleByTeam = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of people) {
      if (!p.team_id) continue;
      if (!map.has(p.team_id)) map.set(p.team_id, []);
      map.get(p.team_id)!.push(p);
    }
    return map;
  }, [people]);

  const peopleNoTeam = useMemo(() => people.filter((p) => !p.team_id), [people]);

  const findPerson = (id: string | null) =>
    id ? people.find((p) => p.id === id) : undefined;

  if (membershipLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto pt-4 sm:pt-8 space-y-6">
        <PageHeader
          icon={Building2}
          title="Organización"
          description="Gestiona centros, equipos y asigna encargados"
          actions={
            <Button onClick={openNewCenter} className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo centro
            </Button>
          }
        />

        {/* Centros y equipos */}
        {centers.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Aún no hay centros</h3>
            <p className="text-sm text-muted-foreground">
              Crea tu primer centro (oficina, tienda, almacén…) para empezar a
              organizar tu plantilla por departamentos.
            </p>
            <Button onClick={openNewCenter}>Crear primer centro</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {centers.map((c) => {
              const centerTeams = teams.filter((t) => t.center_id === c.id);
              const centerManager = findPerson(c.manager_id);
              return (
                <Card key={c.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{c.name}</h3>
                        {centerManager && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <UserCog className="w-3 h-3" />
                            {centerManager.full_name || centerManager.email}
                          </Badge>
                        )}
                      </div>
                      {c.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {c.address}
                        </p>
                      )}
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEditCenter(c)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCenter(c)} title="Eliminar">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Equipos del centro
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNewTeam(c.id)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" /> Equipo
                      </Button>
                    </div>

                    {centerTeams.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Sin equipos. Añade uno (cocina, sala, mantenimiento…).
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {centerTeams.map((t) => {
                          const teamManager = findPerson(t.manager_id);
                          const members = peopleByTeam.get(t.id) || [];
                          return (
                            <div
                              key={t.id}
                              className="border rounded-md p-3 bg-muted/20 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-sm flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    {t.name}
                                  </div>
                                  {t.description && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTeam(t)} title="Editar">
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTeam(t)} title="Eliminar">
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 text-[11px]">
                                {teamManager && (
                                  <Badge variant="outline" className="gap-1">
                                    <UserCog className="w-3 h-3" />
                                    {teamManager.full_name || teamManager.email}
                                  </Badge>
                                )}
                                <Badge variant="secondary">
                                  {members.length} {members.length === 1 ? "persona" : "personas"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Equipos sin centro */}
        {teams.filter((t) => !t.center_id).length > 0 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Equipos sin centro asignado</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewTeam()}
                className="gap-1"
              >
                <Plus className="w-3 h-3" /> Equipo
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {teams
                .filter((t) => !t.center_id)
                .map((t) => {
                  const teamManager = findPerson(t.manager_id);
                  const members = peopleByTeam.get(t.id) || [];
                  return (
                    <div key={t.id} className="border rounded-md p-3 bg-muted/20">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" />
                          {t.name}
                        </div>
                        <div className="flex">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTeam(t)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTeam(t)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        {teamManager && (
                          <Badge variant="outline" className="gap-1">
                            <UserCog className="w-3 h-3" />
                            {teamManager.full_name || teamManager.email}
                          </Badge>
                        )}
                        <Badge variant="secondary">{members.length}</Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Personas sin equipo */}
        {peopleNoTeam.length > 0 && (
          <Card className="p-5 space-y-2">
            <h4 className="text-sm font-semibold">
              Personas sin equipo asignado ({peopleNoTeam.length})
            </h4>
            <p className="text-xs text-muted-foreground">
              Asigna estas personas a un equipo desde su ficha en{" "}
              <a href="/employees" className="text-primary hover:underline">
                Empleados
              </a>
              .
            </p>
            <div className="flex flex-wrap gap-1">
              {peopleNoTeam.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.full_name || p.email} · {p.role}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Center Dialog */}
      <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCenter ? "Editar centro" : "Nuevo centro"}</DialogTitle>
            <DialogDescription>
              Un centro es una ubicación física (oficina, tienda, almacén, sede).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="center-name">Nombre *</Label>
              <Input
                id="center-name"
                value={centerForm.name}
                onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
                placeholder="Oficina Barcelona"
              />
            </div>
            <div>
              <Label htmlFor="center-address">Dirección</Label>
              <Input
                id="center-address"
                value={centerForm.address}
                onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })}
                placeholder="C/ Ejemplo 123, Barcelona"
              />
            </div>
            <div>
              <Label htmlFor="center-desc">Descripción</Label>
              <Textarea
                id="center-desc"
                value={centerForm.description}
                onChange={(e) => setCenterForm({ ...centerForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="center-manager">Encargado del centro</Label>
              <Select
                value={centerForm.manager_id || "_none"}
                onValueChange={(v) => setCenterForm({ ...centerForm, manager_id: v === "_none" ? "" : v })}
              >
                <SelectTrigger id="center-manager">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {managerCandidates.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Solo aparecen owners, admins y managers de la empresa.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCenterDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCenter}>{editingCenter ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
            <DialogDescription>
              Un equipo agrupa trabajadores por departamento (cocina, sala, taquilla…).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="team-name">Nombre *</Label>
              <Input
                id="team-name"
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="Cocina"
              />
            </div>
            <div>
              <Label htmlFor="team-desc">Descripción</Label>
              <Textarea
                id="team-desc"
                value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="team-center">Centro</Label>
              <Select
                value={teamForm.center_id || "_none"}
                onValueChange={(v) => setTeamForm({ ...teamForm, center_id: v === "_none" ? "" : v })}
              >
                <SelectTrigger id="team-center">
                  <SelectValue placeholder="Sin centro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin centro</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="team-manager">Encargado del equipo</Label>
              <Select
                value={teamForm.manager_id || "_none"}
                onValueChange={(v) => setTeamForm({ ...teamForm, manager_id: v === "_none" ? "" : v })}
              >
                <SelectTrigger id="team-manager">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {managerCandidates.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTeamDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveTeam}>{editingTeam ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Organization;
