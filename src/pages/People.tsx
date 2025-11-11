import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, Search, Edit, Mail, XCircle, RefreshCw, Power, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { toast } from "sonner";
import InviteUserDialog from "@/components/InviteUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { motion } from "framer-motion";

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  center_id: string | null;
  team_id: string | null;
  center_name: string | null;
  team_name: string | null;
  is_active: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  center_id: string | null;
  team_id: string | null;
  center_name: string | null;
  team_name: string | null;
  created_at: string;
  expires_at: string;
}

const People = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId, role, loading: membershipLoading } = useMembership();
  const { plan, maxEmployees, currentEmployees, canInviteMore, refetch: refetchLimits } = usePlanLimits();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [toggleUserDialog, setToggleUserDialog] = useState<{ show: boolean; member: Member | null }>({
    show: false,
    member: null,
  });

  useEffect(() => {
    if (!membershipLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (role && !["owner", "admin"].includes(role)) {
        toast.error("No tienes permisos para acceder a esta página");
        navigate("/");
      }
    }
  }, [user, role, membershipLoading, navigate]);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, roleFilter, members]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchMembers(), fetchInvites()]);
    await refetchLimits();
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("memberships")
      .select(`
        user_id,
        role,
        profiles!inner(
          id,
          email,
          full_name,
          center_id,
          team_id,
          is_active,
          centers(name),
          teams(name)
        )
      `)
      .eq("company_id", companyId);

    if (error) {
      console.error("Error fetching members:", error);
      toast.error("Error al cargar miembros");
      return;
    }

    const formattedMembers = data.map((m: any) => ({
      id: m.user_id,
      email: m.profiles.email,
      full_name: m.profiles.full_name,
      role: m.role,
      center_id: m.profiles.center_id,
      team_id: m.profiles.team_id,
      center_name: m.profiles.centers?.name || null,
      team_name: m.profiles.teams?.name || null,
      is_active: m.profiles.is_active,
    }));

    setMembers(formattedMembers);
  };

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from("invites")
      .select(`
        id,
        email,
        role,
        status,
        center_id,
        team_id,
        created_at,
        expires_at,
        centers(name),
        teams(name)
      `)
      .eq("company_id", companyId)
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
      return;
    }

    const formattedInvites = data.map((inv: any) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      center_id: inv.center_id,
      team_id: inv.team_id,
      center_name: inv.centers?.name || null,
      team_name: inv.teams?.name || null,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    }));

    setInvites(formattedInvites);
  };

  const filterMembers = () => {
    let filtered = members;

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((m) => m.role === roleFilter);
    }

    setFilteredMembers(filtered);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-500/10 text-purple-700 border-purple-500/20",
      admin: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      manager: "bg-green-500/10 text-green-700 border-green-500/20",
      worker: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    };
    return colors[role] || colors.worker;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      expired: "bg-red-500/10 text-red-700 border-red-500/20",
      accepted: "bg-green-500/10 text-green-700 border-green-500/20",
      revoked: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    };
    return colors[status] || colors.pending;
  };

  const handleEdit = (member: Member) => {
    setSelectedMember(member);
    setShowEditDialog(true);
  };

  const handleInviteClick = () => {
    if (!canInviteMore) {
      setShowLimitDialog(true);
      return;
    }
    setShowInviteDialog(true);
  };

  const getPlanBadgeColor = (planType: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-500/10 text-gray-700 border-gray-500/20",
      pro: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      enterprise: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    };
    return colors[planType] || colors.free;
  };

  const handleToggleUser = async (member: Member) => {
    const newStatus = !member.is_active;

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", member.id);

    if (error) {
      console.error("Error toggling user status:", error);
      toast.error("Error al cambiar estado del usuario");
      return;
    }

    toast.success(
      newStatus ? "Usuario reactivado correctamente" : "Usuario desactivado correctamente"
    );
    setToggleUserDialog({ show: false, member: null });
    fetchMembers();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked" })
      .eq("id", inviteId);

    if (error) {
      console.error("Error revoking invite:", error);
      toast.error("Error al revocar invitación");
      return;
    }

    toast.success("Invitación revocada");
    fetchInvites();
  };

  const handleResendInvite = async (invite: Invite) => {
    // Generate new token and expiration
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase
      .from("invites")
      .update({
        token,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .eq("id", invite.id);

    if (error) {
      console.error("Error resending invite:", error);
      toast.error("Error al reenviar invitación");
      return;
    }

    // Copy invite link to clipboard
    const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    
    toast.success("Invitación reenviada", {
      description: "Enlace copiado al portapapeles",
    });
    fetchInvites();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gestión de Personas</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {currentEmployees} / {maxEmployees === Infinity ? "∞" : maxEmployees} miembros
                </p>
                <Badge className={getPlanBadgeColor(plan)}>
                  {plan === "free" && "Plan Free"}
                  {plan === "pro" && "Plan Pro"}
                  {plan === "enterprise" && "Plan Enterprise"}
                </Badge>
              </div>
            </div>
          </div>
          <Button onClick={handleInviteClick} className="hover-scale">
            <UserPlus className="w-4 h-4 mr-2" />
            Invitar Usuario
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="members">
              Miembros ({filteredMembers.length})
            </TabsTrigger>
            <TabsTrigger value="invites">
              Invitaciones ({invites.filter((i) => i.status === "pending").length})
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <Card className="glass-card p-6">
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[180px]">
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

              {/* Members Table */}
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Cargando...</p>
              ) : filteredMembers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No se encontraron miembros
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Centro</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member, index) => (
                        <motion.tr
                          key={member.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="group"
                        >
                          <TableCell className="font-medium">
                            {member.full_name || "Sin nombre"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.email}
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.center_name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.team_name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                member.is_active
                                  ? "bg-green-500/10 text-green-700 border-green-500/20"
                                  : "bg-red-500/10 text-red-700 border-red-500/20"
                              }
                            >
                              {member.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(member)}
                                className="hover-scale"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setToggleUserDialog({ show: true, member })
                                }
                                className="hover-scale"
                                title={member.is_active ? "Desactivar usuario" : "Reactivar usuario"}
                              >
                                <Power
                                  className={`w-4 h-4 ${
                                    member.is_active
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }`}
                                />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Invites Tab */}
          <TabsContent value="invites" className="space-y-4">
            <Card className="glass-card p-6">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Cargando...</p>
              ) : invites.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay invitaciones pendientes
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Centro</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((invite, index) => (
                        <motion.tr
                          key={invite.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="group"
                        >
                          <TableCell className="font-medium">
                            {invite.email}
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(invite.role)}>
                              {invite.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invite.center_name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invite.team_name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(invite.status)}>
                              {invite.status === "pending"
                                ? "Pendiente"
                                : invite.status === "expired"
                                ? "Expirada"
                                : invite.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(invite.expires_at).toLocaleDateString("es-ES")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {invite.status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResendInvite(invite)}
                                    className="hover-scale"
                                    title="Reenviar invitación"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevokeInvite(invite.id)}
                                    className="hover-scale text-red-500"
                                    title="Revocar invitación"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={fetchData}
      />

      {selectedMember && (
        <EditUserDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          employee={{
            id: selectedMember.id,
            email: selectedMember.email,
            full_name: selectedMember.full_name,
            role: selectedMember.role,
            center_id: selectedMember.center_id,
            team_id: selectedMember.team_id,
          }}
          onSuccess={fetchData}
        />
      )}

      {/* Toggle User Status Dialog */}
      <AlertDialog
        open={toggleUserDialog.show}
        onOpenChange={(open) =>
          setToggleUserDialog({ show: open, member: toggleUserDialog.member })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUserDialog.member?.is_active ? "Desactivar" : "Reactivar"} usuario
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUserDialog.member?.is_active
                ? "¿Estás seguro de que quieres desactivar este usuario? No podrá acceder al sistema hasta que sea reactivado."
                : "¿Estás seguro de que quieres reactivar este usuario? Podrá volver a acceder al sistema."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toggleUserDialog.member && handleToggleUser(toggleUserDialog.member)
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan Limit Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Límite de plan alcanzado
            </DialogTitle>
            <DialogDescription>
              Has alcanzado el límite de {maxEmployees} {maxEmployees === 1 ? "miembro" : "miembros"} del plan {plan.toUpperCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan actual:</span>
                <Badge className={getPlanBadgeColor(plan)}>
                  {plan.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Miembros actuales:</span>
                <span className="font-semibold">{currentEmployees} / {maxEmployees}</span>
              </div>
            </div>

            {plan === "free" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Actualiza a un plan superior para invitar más miembros:
                </p>
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">Plan Pro</span>
                      <Badge className={getPlanBadgeColor("pro")}>PRO</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Hasta 50 miembros
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">Plan Enterprise</span>
                      <Badge className={getPlanBadgeColor("enterprise")}>ENTERPRISE</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Miembros ilimitados
                    </p>
                  </div>
                </div>
              </div>
            )}

            {plan === "pro" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Actualiza al plan Enterprise para miembros ilimitados:
                </p>
                <div className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">Plan Enterprise</span>
                    <Badge className={getPlanBadgeColor("enterprise")}>ENTERPRISE</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Miembros ilimitados + características premium
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLimitDialog(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => toast.info("Contacta con soporte para actualizar tu plan")}>
              Actualizar Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default People;
