import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Coffee, Maximize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";

interface Device {
  id: string;
  company_id: string;
  name: string;
  center_id: string | null;
}

const Kiosk = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [pin, setPin] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Check if PIN is in URL
    const urlPin = searchParams.get("pin");
    if (urlPin) {
      setPin(urlPin);
      handleLogin(urlPin);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (devicePin?: string) => {
    const pinToUse = (devicePin || pin || "").trim().toUpperCase();
    if (!pinToUse) {
      toast.error("Ingresa el PIN del dispositivo");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("secret_hash", pinToUse)
        .eq("type", "kiosk")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("PIN incorrecto");
        return;
      }

      // Update last seen
      await supabase
        .from("devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.id);

      setDevice(data);
      setAuthenticated(true);
      toast.success(`Kiosko activado: ${data.name}`);

      // Flujo clásico con auth
      const target = `/auth?kiosk=1&pin=${pinToUse}`;
      setRedirecting(true);
      navigate(target, { replace: true });
      setTimeout(() => {
        window.location.replace(target);
      }, 50);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error al autenticar dispositivo");
    } finally {
      setLoading(false);
    }
  };

  const handleClockAction = async (
    userId: string,
    action: "in" | "out" | "break_start" | "break_end"
  , employeeLabel?: { full_name?: string; email?: string }) => {
    if (!device) return;

    setLoading(true);
    try {
      // Get location if available
      let latitude: number | undefined;
      let longitude: number | undefined;

      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
              });
            }
          );
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (error) {
          console.warn("GPS not available:", error);
        }
      }

      const response = await supabase.functions.invoke("clock", {
        body: {
          action,
          user_id: userId,
          device_id: device.id,
          company_id: device.company_id,
          latitude,
          longitude,
          source: "kiosk",
        },
      });

      if (response.error) throw response.error;

      const messages = {
        in: `✓ Entrada registrada${employeeLabel?.full_name ? " - " + employeeLabel.full_name : ""}`,
        out: `✓ Salida registrada${employeeLabel?.full_name ? " - " + employeeLabel.full_name : ""}`,
        break_start: `☕ Pausa iniciada${employeeLabel?.full_name ? " - " + employeeLabel.full_name : ""}`,
        break_end: `✓ Pausa finalizada${employeeLabel?.full_name ? " - " + employeeLabel.full_name : ""}`,
      };

      toast.success(messages[action]);
      setEmployeeCode("");
    } catch (error) {
      console.error("Clock action error:", error);
      const message = error instanceof Error ? error.message : "Error al registrar fichaje";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockByCode = async (action: "in" | "out" | "break_start" | "break_end") => {
    if (!device) {
      toast.error("Activa el kiosko con su PIN primero");
      return;
    }

    const code = employeeCode.trim().toUpperCase();
    if (!code) {
      toast.error("Ingresa el código del empleado");
      return;
    }

    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, login_code")
        .eq("login_code", code)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast.error("Código no encontrado");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("company_id")
        .eq("user_id", profile.id)
        .eq("company_id", device.company_id)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        toast.error("Código no pertenece a esta empresa");
        return;
      }

      await handleClockAction(profile.id, action, { full_name: profile.full_name, email: profile.email });
    } catch (err) {
      console.error("Clock by code error:", err);
      const message = err instanceof Error ? err.message : "No pudimos validar el código";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass-card p-8 max-w-md w-full">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto">
                <Clock className="w-10 h-10 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Kiosko GTiQ</h1>
                <p className="text-muted-foreground mt-2">
                  Ingresa el PIN del dispositivo
                </p>
              </div>
              <div className="space-y-4">
                <Input
                  type="text"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                />
                <Button
                  onClick={() => handleLogin()}
                  disabled={loading}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {loading ? "Verificando..." : "Activar Kiosko"}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 flex items-center justify-center p-4">
        <Card className="glass-card p-8 text-center space-y-3">
          <p className="text-lg font-semibold">Redirigiendo a autenticación…</p>
          <p className="text-sm text-muted-foreground">Introduce tu código de empleado en la siguiente pantalla.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center pt-4">
          <div>
            <h1 className="text-2xl font-bold">{device?.name}</h1>
            <p className="text-sm text-muted-foreground">
              Control de fichaje por kiosko
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
            >
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Clock */}
        <Card className="glass-card p-8 text-center">
          <motion.div
            key={formatTime()}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            className="text-8xl font-bold tabular-nums bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent"
          >
            {formatTime()}
          </motion.div>
          <p className="text-lg text-muted-foreground mt-4 capitalize">
            {formatDate()}
          </p>
        </Card>

        {/* Clock by code */}
        <Card className="glass-card p-6 space-y-4">
          <div className="space-y-2">
            <Label>Introduce tu código de acceso</Label>
            <Input
              placeholder="Código (login)"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleClockByCode("in")}
              className="h-14 text-2xl font-mono tracking-widest text-center"
              maxLength={12}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button onClick={() => handleClockByCode("in")} disabled={loading} className="h-12">
              <LogIn className="w-4 h-4 mr-2" />
              Entrada
            </Button>
            <Button onClick={() => handleClockByCode("out")} disabled={loading} variant="destructive" className="h-12">
              <LogOut className="w-4 h-4 mr-2" />
              Salida
            </Button>
            <Button onClick={() => handleClockByCode("break_start")} disabled={loading} variant="secondary" className="h-12">
              <Coffee className="w-4 h-4 mr-2" />
              Pausa
            </Button>
            <Button onClick={() => handleClockByCode("break_end")} disabled={loading} variant="outline" className="h-12">
              <Clock className="w-4 h-4 mr-2" />
              Reanudar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Usa el mismo código de inicio de sesión. El kiosko valida que el código pertenezca a esta empresa.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Kiosk;
