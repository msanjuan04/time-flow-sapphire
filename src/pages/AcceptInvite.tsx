import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Mail, Building2 } from "lucide-react";
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
  const [step, setStep] = useState<"validating" | "register" | "login" | "success">("validating");
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", data.email.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        setStep("login");
      } else {
        setStep("register");
      }

      setLoading(false);
    } catch (error) {
      console.error("Error validating invite:", error);
      setError("Error al validar la invitación");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteData) return;

    // Validation
    if (!fullName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData.email.toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Error al crear cuenta");

      // Wait for profile trigger to complete
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update profile with additional data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          center_id: inviteData.center_id,
          team_id: inviteData.team_id,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      // Create membership
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: authData.user.id,
          company_id: inviteData.company_id,
          role: inviteData.role as "owner" | "admin" | "manager" | "worker",
        });

      if (membershipError) throw membershipError;

      // Mark invite as accepted
      const { error: updateError } = await supabase
        .from("invites")
        .update({ status: "accepted" })
        .eq("id", inviteData.id);

      if (updateError) console.error("Error updating invite status:", updateError);

      setStep("success");
      
      // Redirect based on role
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error during registration:", error);
      const message = error instanceof Error ? error.message : "Error al crear cuenta";
      toast.error(message);
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteData) return;

    if (!password) {
      toast.error("La contraseña es requerida");
      return;
    }

    setSubmitting(true);

    try {
      // Login user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: inviteData.email.toLowerCase(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Error al iniciar sesión");

      // Check if membership already exists for THIS company
      const { data: existingMembership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", authData.user.id)
        .eq("company_id", inviteData.company_id)
        .maybeSingle();

      if (existingMembership) {
        // User is already a member of this company, just mark invite as accepted
        await supabase
          .from("invites")
          .update({ status: "accepted" })
          .eq("id", inviteData.id);

        toast.success("Ya eres miembro de esta empresa");
        
        setTimeout(() => {
          navigate("/");
        }, 1500);
        return;
      }

      // Create new membership for this company (multi-tenant support)
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: authData.user.id,
          company_id: inviteData.company_id,
          role: inviteData.role as "owner" | "admin" | "manager" | "worker",
        });

      if (membershipError) throw membershipError;

      // Update profile with center and team for this company
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          center_id: inviteData.center_id,
          team_id: inviteData.team_id,
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Error updating profile:", profileError);

      // Mark invite as accepted
      const { error: updateError } = await supabase
        .from("invites")
        .update({ status: "accepted" })
        .eq("id", inviteData.id);

      if (updateError) console.error("Error updating invite status:", updateError);

      setStep("success");
      
      // Redirect to home (role-based redirection happens in Index.tsx)
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error during login:", error);
      const message = error instanceof Error ? error.message : "Error al iniciar sesión";
      toast.error(message);
      setSubmitting(false);
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

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass-card p-8 max-w-md w-full text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold">¡Bienvenido!</h2>
            <p className="text-muted-foreground">
              Te has unido exitosamente a {inviteData?.company_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Redirigiendo...
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">
              {step === "register" ? "Crear cuenta" : "Iniciar sesión"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Has sido invitado a unirte a <span className="font-semibold">{inviteData?.company_name}</span>
            </p>
          </div>

          {/* Invite Info */}
          <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{inviteData?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rol:</span>
              <span className="font-medium capitalize">{inviteData?.role}</span>
            </div>
          </div>

          {/* Register Form */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear cuenta y unirse
              </Button>
            </form>
          )}

          {/* Login Form */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Ya tienes una cuenta. Inicia sesión para unirte a la empresa.
              </p>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión y unirse
              </Button>
            </form>
          )}

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground"
            >
              Volver al login
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
