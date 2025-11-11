import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Search, LogIn, LogOut, Coffee, Maximize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";

interface Device {
  id: string;
  company_id: string;
  name: string;
  center_id: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

const Kiosk = () => {
  const [searchParams] = useSearchParams();
  const [authenticated, setAuthenticated] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [pin, setPin] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    if (device) {
      fetchEmployees();
    }
  }, [device, searchQuery]);

  const handleLogin = async (devicePin?: string) => {
    const pinToUse = devicePin || pin;
    if (!pinToUse.trim()) {
      toast.error("Ingresa el PIN del dispositivo");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("secret_hash", pinToUse.toUpperCase())
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
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Error al autenticar dispositivo");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!device) return;

    const query = supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        avatar_url,
        memberships!inner(company_id)
      `)
      .eq("memberships.company_id", device.company_id);

    if (searchQuery.trim()) {
      query.or(
        `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      );
    }

    const { data } = await query.limit(20);
    setEmployees(data || []);
  };

  const handleClockAction = async (
    userId: string,
    action: "in" | "out" | "break_start" | "break_end"
  ) => {
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

      const employee = employees.find((e) => e.id === userId);
      const messages = {
        in: `✓ Entrada registrada - ${employee?.full_name}`,
        out: `✓ Salida registrada - ${employee?.full_name}`,
        break_start: `☕ Pausa iniciada - ${employee?.full_name}`,
        break_end: `✓ Pausa finalizada - ${employee?.full_name}`,
      };

      toast.success(messages[action]);
      setSearchQuery("");
    } catch (error: any) {
      console.error("Clock action error:", error);
      toast.error(error.message || "Error al registrar fichaje");
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
                <h1 className="text-3xl font-bold">Kiosko TimeTrack</h1>
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

        {/* Search */}
        <Card className="glass-card p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado por nombre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-14 text-lg"
            />
          </div>
        </Card>

        {/* Employees Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {employees.map((employee) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="glass-card p-6 hover:shadow-lg smooth-transition">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">
                        {employee.full_name?.charAt(0) || employee.email.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {employee.full_name || employee.email}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {employee.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleClockAction(employee.id, "in")}
                      disabled={loading}
                      className="h-12"
                      variant="default"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Entrada
                    </Button>
                    <Button
                      onClick={() => handleClockAction(employee.id, "out")}
                      disabled={loading}
                      className="h-12"
                      variant="destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Salida
                    </Button>
                    <Button
                      onClick={() => handleClockAction(employee.id, "break_start")}
                      disabled={loading}
                      className="h-12"
                      variant="secondary"
                    >
                      <Coffee className="w-4 h-4 mr-2" />
                      Pausa
                    </Button>
                    <Button
                      onClick={() => handleClockAction(employee.id, "break_end")}
                      disabled={loading}
                      className="h-12"
                      variant="outline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Reanudar
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {employees.length === 0 && searchQuery && (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground">
              No se encontraron empleados con "{searchQuery}"
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Kiosk;
