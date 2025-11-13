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
import { ArrowLeft, Building2, Users, MapPin, Smartphone, Clock, UserCog, Loader2, UploadCloud, RefreshCw, FileText } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
 

interface CompanyDetail {
  id: string;
  name: string;
  status: string;
  plan: string;
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
  recent_logs: any[];
}

const AdminCompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  useDocumentTitle("Empresa • GTiQ");
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "manager" | "worker">("worker");
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [inviteCenter, setInviteCenter] = useState<string>("");
  const [inviteTeam, setInviteTeam] = useState<string>("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteDni, setInviteDni] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [members, setMembers] = useState<Array<{id:string;email:string;full_name:string|null;role:string;is_active:boolean;center_name:string|null;team_name:string|null;}>>([]);
  const [legalFiles, setLegalFiles] = useState<Array<{ name:string; path:string; url?:string; size?:number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) {
      fetchCompanyDetail();
      fetchAux();
      fetchMembers();
      fetchLegalFiles();
    }
  }, [id]);

  const fetchAux = async () => {
    if (!id) return;
    const [{ data: centersData }, { data: teamsData }] = await Promise.all([
      supabase.from("centers").select("id, name").eq("company_id", id),
      supabase.from("teams").select("id, name").eq("company_id", id),
    ]);
    setCenters(centersData || []);
    setTeams(teamsData || []);
  };

  const fetchLegalFiles = async () => {
    if (!id) return;
    try {
      const folder = id; // path por empresa
      const { data, error } = await (supabase as any).storage.from('company-legal').list(folder, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
      if (error) {
        console.warn('Storage list error', error);
        setLegalFiles([]);
        return;
      }
      const files = (data || []).filter((f: any) => f && f.name).map((f: any) => ({ name: f.name, path: `${folder}/${f.name}`, size: f.metadata?.size }));
      // Signed URLs
      const withUrls: Array<{name:string;path:string;url?:string;size?:number}> = [];
      for (const f of files) {
        try {
          const { data: s } = await (supabase as any).storage.from('company-legal').createSignedUrl(f.path, 60 * 60);
          withUrls.push({ ...f, url: s?.signedUrl });
        } catch {
          withUrls.push(f);
        }
      }
      setLegalFiles(withUrls);
    } catch (e) {
      console.error(e);
    }
  };

  const uploadLegalFile = async () => {
    if (!id || !selectedFile) return;
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}_${selectedFile.name}`;
      const { error } = await (supabase as any).storage.from('company-legal').upload(path, selectedFile, {
        cacheControl: '3600', upsert: false,
      });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('not found')) {
          toast.error("Falta el bucket 'company-legal' en Storage (privado)");
        } else {
          toast.error("No se pudo subir el archivo");
        }
        return;
      }
      toast.success("Archivo subido");
      setSelectedFile(null);
      await fetchLegalFiles();
    } catch (e) {
      console.error(e);
      toast.error("Error inesperado subiendo archivo");
    } finally {
      setUploading(false);
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
      const { error } = await (supabase as any).functions.invoke("admin-create-invite", {
        body: {
          company_id: id,
          email: inviteEmail.trim(),
          role: inviteRole,
          center_id: inviteCenter || null,
          team_id: inviteTeam || null,
          full_name: inviteFullName || undefined,
          dni: inviteDni || undefined,
          phone: invitePhone || undefined,
        },
      });
      if (error) throw error;
      toast.success("Invitación enviada");
      setInviteEmail("");
      setInviteRole("worker");
      setInviteCenter("");
      setInviteTeam("");
      setInviteFullName("");
      setInviteDni("");
      setInvitePhone("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Error al enviar invitación");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCreateCenter = async () => {
    if (!id) return;
    const name = window.prompt("Nombre del nuevo centro");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from("centers")
      .insert({ company_id: id, name: name.trim() })
      .select("id, name")
      .single();
    if (error) {
      toast.error("No se pudo crear el centro");
      return;
    }
    await fetchAux();
    if (data?.id) setInviteCenter(data.id);
    toast.success("Centro creado");
  };

  const handleCreateTeam = async () => {
    if (!id) return;
    const name = window.prompt("Nombre del nuevo equipo");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase
      .from("teams")
      .insert({ company_id: id, name: name.trim() })
      .select("id, name")
      .single();
    if (error) {
      toast.error("No se pudo crear el equipo");
      return;
    }
    await fetchAux();
    if (data?.id) setInviteTeam(data.id);
    toast.success("Equipo creado");
  };

  const fetchMembers = async () => {
    if (!id) return;
    try {
      const { data, error } = await (supabase as any).functions.invoke("admin-list-users", {
        body: { company_id: id },
      });
      if (error) throw error;
      setMembers(data.members || []);
    } catch (e: any) {
      console.error("Failed to fetch members:", e);
    }
  };

  const fetchCompanyDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-company", {
        body: { company_id: id },
      });

      if (error) {
        console.error("Error fetching company:", error);
        toast.error("Error al cargar empresa");
        return;
      }

      setCompany(data.data);
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

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/companies")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
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

        {/* Info Card */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Información</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">
                {company.owner ? `${company.owner.email}` : "Sin owner"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de creación</p>
              <p className="font-medium">
                {new Date(company.created_at).toLocaleDateString()}
              </p>
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
            <Input placeholder="Nombre y apellidos (opcional)" value={inviteFullName} onChange={(e) => setInviteFullName(e.target.value)} />
            <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={inviteCenter} onValueChange={setInviteCenter}>
                  <SelectTrigger>
                    <SelectValue placeholder={centers.length ? "Centro (opcional)" : "No hay centros"} />
                  </SelectTrigger>
                  <SelectContent>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="ghost" onClick={handleCreateCenter}>Crear</Button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={inviteTeam} onValueChange={setInviteTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder={teams.length ? "Equipo (opcional)" : "No hay equipos"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="ghost" onClick={handleCreateTeam}>Crear</Button>
            </div>
            <Input placeholder="DNI/NIF (opcional)" value={inviteDni} onChange={(e) => setInviteDni(e.target.value)} />
            <Input placeholder="Teléfono (opcional)" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
            <div className="flex justify-end">
              <Button onClick={handleInvite} disabled={sendingInvite}>
                {sendingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                Enviar invitación
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
        </div>

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
                  {company.recent_logs.map((log: any) => (
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

        {/* Documentación Legal */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Documentación legal de la empresa</h2>
            <Button variant="ghost" size="sm" onClick={fetchLegalFiles}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
            </Button>
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Sube aquí la plantilla legal firmada que te envió la empresa (PDF/DOC/DOCX).
            </div>
            <div className="flex items-center gap-2">
              <Input type="file" accept=".pdf,.doc,.docx,.odt,.rtf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <Button onClick={uploadLegalFile} disabled={!selectedFile || uploading}>
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <UploadCloud className="w-4 h-4 mr-2" /> Subir
              </Button>
            </div>
          </div>

          <div className="mt-4 border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Archivo</th>
                  <th className="text-left p-2">Tamaño</th>
                  <th className="text-left p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {legalFiles.length === 0 ? (
                  <tr><td className="p-3 text-muted-foreground" colSpan={3}>No hay archivos</td></tr>
                ) : (
                  legalFiles.map((f) => (
                    <tr key={f.path} className="border-t">
                      <td className="p-2 flex items-center gap-2"><FileText className="w-4 h-4" /> {f.name}</td>
                      <td className="p-2">{typeof f.size === 'number' ? `${(f.size/1024).toFixed(1)} KB` : '—'}</td>
                      <td className="p-2">
                        {f.url ? (
                          <a className="underline hover:text-primary" href={f.url} target="_blank" rel="noreferrer">Ver/Descargar</a>
                        ) : (
                          <span className="text-muted-foreground">Genera URL no disponible</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCompanyDetail;
