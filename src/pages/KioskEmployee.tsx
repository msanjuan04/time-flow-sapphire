import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Coffee, LogIn, LogOut, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { invokeClockWithQueue } from "@/lib/offlineClockQueue";
import { OfflineClockIndicator } from "@/components/OfflineClockIndicator";

type Status = "off" | "on" | "break";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  login_code: string | null;
}

interface Device {
  id: string;
  company_id: string;
  name: string;
}

const KioskEmployee = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const devicePin = searchParams.get("device") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("off");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);

  const goBackToKiosk = () => {
    const target = devicePin ? `/kiosk-free?pin=${devicePin}` : "/kiosk-free";
    navigate(target, { replace: true });
  };

  useEffect(() => {
    if (logoutCountdown === null) return;
    if (logoutCountdown <= 0) {
      goBackToKiosk();
      return;
    }
    const t = setTimeout(() => setLogoutCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutCountdown]);

  const fetchProfile = async () => {
    if (!token) {
      setLoading(false);
      toast.error("Token no válido");
      return;
    }
    if (!devicePin) {
      setLoading(false);
      toast.error("Falta el PIN del dispositivo (?device=)");
      return;
    }
    try {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, login_code")
        .eq("login_code", token)
        .maybeSingle();

      if (error) throw error;
      if (!prof) {
        toast.error("No encontramos al empleado");
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      const { data: deviceData } = await supabase
        .from("devices")
        .select("id, company_id, name")
        .eq("secret_hash", devicePin)
        .eq("type", "kiosk")
        .maybeSingle();

      if (!deviceData) {
        toast.error("Dispositivo no encontrado");
        setLoading(false);
        return;
      }
      setDevice(deviceData as Device);
      const company = deviceData.company_id;

      setCompanyId(company);
      if (company) {
        await fetchStatus(prof.id, company);
      }
    } catch (err) {
      console.error("Error cargando empleado:", err);
      toast.error("No pudimos cargar el empleado");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async (userId: string, company: string) => {
    try {
      const { data: session } = await supabase
        .from("work_sessions")
        .select("id, is_active, is_on_break")
        .eq("user_id", userId)
        .eq("company_id", company)
        .order("clock_in_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (session?.is_active) {
        setStatus(session.is_on_break ? "break" : "on");
      } else {
        setStatus("off");
      }
    } catch (err) {
      console.error("Error calculando estado:", err);
      setStatus("off");
    }
  };

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const buttons = useMemo(() => {
    const common = { disabled: submitting };
    return [
      {
        label: "Entrada",
        action: "in" as const,
        icon: <LogIn className="w-5 h-5 mr-2" />,
        visible: status === "off",
        props: common,
      },
      {
        label: status === "break" ? "Reanudar" : "Pausa",
        action: status === "break" ? ("break_end" as const) : ("break_start" as const),
        icon: status === "break" ? <Clock className="w-5 h-5 mr-2" /> : <Coffee className="w-5 h-5 mr-2" />,
        visible: status === "on" || status === "break",
        props: common,
      },
      {
        label: "Salida",
        action: "out" as const,
        icon: <LogOut className="w-5 h-5 mr-2" />,
        visible: status === "on" || status === "break",
        props: common,
        variant: "destructive" as const,
      },
    ];
  }, [status, submitting]);

  const handleAction = async (action: "in" | "out" | "break_start" | "break_end") => {
    if (!profile?.id) return;
    if (!companyId) {
      toast.error("No pudimos validar la empresa del empleado");
      return;
    }
    setSubmitting(true);
    try {
      const result = await invokeClockWithQueue({
        payload: {
          action,
          user_id: profile.id,
          device_id: device?.id,
          company_id: companyId,
          source: "kiosk-free",
        },
      });

      if (!result.ok) throw result.error;

      const labels: Record<typeof action, string> = {
        in: "Entrada registrada",
        out: "Salida registrada",
        break_start: "Pausa iniciada",
        break_end: "Pausa finalizada",
      };

      setConfirmation(
        result.queued ? `${labels[action]} (en cola, sin conexión)` : labels[action]
      );
      setLogoutCountdown(5);
    } catch (err) {
      console.error("Error al fichar:", err);
      toast.error("No pudimos registrar el fichaje");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando kiosko...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        No encontramos el empleado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6 pt-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover-scale">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Kiosko libre
            </p>
            <h1 className="text-2xl font-bold">{profile.full_name || profile.email}</h1>
            <p className="text-sm text-muted-foreground">
              {device?.name ? `Dispositivo: ${device.name}` : "Dispositivo no vinculado"}
            </p>
          </div>
          <OfflineClockIndicator />
        </div>

        <Card className="glass-card p-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Estado actual</p>
            <p className="text-3xl font-bold">
              {status === "on" ? "Trabajando" : status === "break" ? "En pausa" : "Fuera de turno"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {buttons
              .filter((b) => b.visible)
              .map((b) => (
                <motion.div
                  key={b.label}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    className="w-full h-16 text-lg"
                    variant={b.variant}
                    disabled={b.props.disabled}
                    onClick={() => handleAction(b.action)}
                  >
                    {b.icon}
                    {b.label}
                  </Button>
                </motion.div>
              ))}
          </div>

        </Card>
      </div>

      <Dialog
        open={logoutCountdown !== null}
        onOpenChange={(open) => {
          if (!open) goBackToKiosk();
        }}
      >
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Fichaje registrado</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
            >
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </motion.div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{confirmation}</p>
              <p className="text-sm text-muted-foreground">
                {profile.full_name || profile.email}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Cerrando sesión en{" "}
              <span className="font-bold text-foreground tabular-nums">
                {logoutCountdown ?? 0}s
              </span>{" "}
              para el siguiente compañero.
            </div>
            <Button onClick={goBackToKiosk} className="w-full" size="lg">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión ahora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KioskEmployee;
