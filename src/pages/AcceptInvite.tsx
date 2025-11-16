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

interface AcceptInviteResponse {
  invite: InviteData;
  login_code: string | null;
  user_created: boolean;
  membership_created: boolean;
}

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState(false);
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [membershipCreated, setMembershipCreated] = useState(false);

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
      const { data, error } = await supabase.functions.invoke<AcceptInviteResponse>("accept-invite", {
        body: { token },
      });

      if (error) {
        console.error("Error validating invite:", error);
        setError(error.message || "Error al validar la invitación");
        setLoading(false);
        return;
      }

      if (!data?.invite) {
        setError("Invitación no encontrada");
        setLoading(false);
        return;
      }

      setInviteData(data.invite);
      setLoginCode(data.login_code || null);
      setUserExists(!data.user_created);
      setMembershipCreated(Boolean(data.membership_created));
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
            <h1 className="text-2xl font-bold">¡Todo listo!</h1>
            <p className="text-sm text-muted-foreground">
              Ya formas parte de <span className="font-semibold">{inviteData.company_name}</span> como{" "}
              <span className="font-semibold">{inviteData.role}</span>. Usa tu código personal para acceder a GTiQ.
            </p>
            {membershipCreated ? (
              <p className="text-xs text-green-600">Hemos activado tu puesto automáticamente.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Esta invitación ya estaba activa. Puedes usar tu código habitual.
              </p>
            )}
          </div>

          {loginCode && (
            <div className="bg-secondary/60 p-4 rounded-lg text-center space-y-2">
              <p className="text-sm text-muted-foreground m-0">Tu código personal</p>
              <p className="text-3xl font-bold tracking-[0.4rem]">{loginCode}</p>
              <p className="text-xs text-muted-foreground m-0">
                Puedes cambiarlo cuando lo solicites desde la pantalla de acceso.
              </p>
            </div>
          )}

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
              Recuerda iniciar sesión desde <a href="/auth" className="underline text-primary">gtiq.app/auth</a> con tu código de acceso.
            </p>
            <p>
              Si necesitas un nuevo código, puedes solicitarlo desde la propia pantalla de login.
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
