import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";
import type { UserRole } from "@/hooks/useMembership";

interface InviteData {
  id: string;
  email: string;
  role: UserRole;
  company_id: string;
  company_name: string;
  center_id: string | null;
  team_id: string | null;
  expires_at: string;
  status: string;
}

interface InviteRecord {
  id: string;
  email: string;
  role: UserRole;
  company_id: string;
  center_id: string | null;
  team_id: string | null;
  expires_at: string;
  status: string;
  companies: {
    name: string;
  };
}

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState(false);

  useEffect(() => {
    if (token) {
      validateInvite();
    } else {
      setError("Token de invitación no válido");
      setLoading(false);
    }
  }, [token]);

  const validateInvite = async () => {
    try {
      const { data, error } = await supabase
        .from("invites")
        .select(`
          id,
          email,
          role,
          company_id,
          center_id,
          team_id,
          expires_at,
          status,
          companies!inner(name)
        `)
        .eq("token", token)
        .single();

      if (error || !data) {
        setError("Invitación no encontrada");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError("Esta invitación ha expirado");
        setLoading(false);
        return;
      }

      // Check if already accepted or revoked
      if (data.status !== "pending") {
        if (data.status === "accepted") {
          setError("Esta invitación ya ha sido aceptada");
        } else if (data.status === "revoked") {
          setError("Esta invitación ha sido revocada");
        } else {
          setError("Esta invitación no es válida");
        }
        setLoading(false);
        return;
      }

      const record = data as InviteRecord;
      const inviteInfo: InviteData = {
        id: record.id,
        email: record.email,
        role: record.role,
        company_id: record.company_id,
        company_name: record.companies.name,
        center_id: record.center_id,
        team_id: record.team_id,
        expires_at: record.expires_at,
        status: record.status,
      };

      setInviteData(inviteInfo);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", data.email.toLowerCase())
        .maybeSingle();

      setUserExists(Boolean(existingProfile));
      setLoading(false);
    } catch (error) {
      console.error("Error validating invite:", error);
      setError("Error al validar la invitación");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <Card className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <h2 className="text-xl font-semibold">Validando invitación...</h2>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass-card p-8 max-w-md w-full text-center space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="text-2xl font-bold">Invitación no válida</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/auth")} className="w-full mt-4">
              Ir al login
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Invitación verificada</h1>
            <p className="text-sm text-muted-foreground">
              Has sido invitado a <span className="font-semibold">{inviteData.company_name}</span>. Utiliza tu código personal de 6 dígitos para entrar.
            </p>
          </div>

          <div className="bg-secondary/50 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Correo invitado:</span>
              <span className="font-medium">{inviteData.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rol asignado:</span>
              <span className="font-medium capitalize">{inviteData.role}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Estado:</span>
              <span className="font-medium">{userExists ? "Cuenta existente" : "Nuevo acceso"}</span>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Hemos generado tu acceso con un código de 6 dígitos. Lo recibirás por correo y el administrador también puede consultarlo desde GTiQ.
            </p>
            <p>
              Si no lo encuentras, solicita que te lo reenvíen. Una vez lo tengas, introdúcelo en la pantalla de login para entrar al instante.
            </p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={() => navigate("/auth")}>Ir al login</Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>Volver al inicio</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
