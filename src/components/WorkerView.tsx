import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Coffee, User, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMembership } from "@/hooks/useMembership";
import { motion, AnimatePresence } from "framer-motion";

type WorkerStatus = "out" | "in" | "on_break";

interface GeolocationCoords {
  latitude: number;
  longitude: number;
}

const WorkerView = () => {
  const { user, signOut } = useAuth();
  const { companyId, membership } = useMembership();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<WorkerStatus>("out");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<GeolocationCoords | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && companyId) {
      fetchStatus();
    }
  }, [user, companyId]);

  // Request GPS location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setGpsEnabled(true);
        },
        (error) => {
          console.warn("GPS not available:", error);
          setGpsEnabled(false);
        }
      );
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && status === "in") {
      interval = setInterval(() => {
        const startTime = new Date(activeSession.clock_in_time).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession, status]);

  const fetchStatus = async () => {
    // Check active session
    const { data: session } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user?.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (session) {
      setActiveSession(session);
      
      // Check last event to determine if on break
      const { data: lastEvent } = await supabase
        .from("time_events")
        .select("event_type")
        .eq("user_id", user?.id)
        .eq("company_id", companyId)
        .order("event_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEvent?.event_type === "pause_start") {
        setStatus("on_break");
      } else {
        setStatus("in");
      }
    } else {
      setStatus("out");
    }
  };

  const callClockAPI = async (action: 'in' | 'out' | 'break_start' | 'break_end') => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('clock', {
        body: {
          action,
          latitude: location?.latitude,
          longitude: location?.longitude,
          source: 'web',
        },
      });

      if (response.error) throw response.error;

      const result = response.data;
      
      await fetchStatus();

      // Show success message based on action
      const messages = {
        in: '✓ Entrada registrada',
        out: '✓ Salida registrada',
        break_start: '☕ Pausa iniciada',
        break_end: '✓ Pausa finalizada',
      };

      toast.success(messages[action], {
        description: new Date().toLocaleTimeString("es-ES"),
      });
    } catch (error: any) {
      console.error('Clock API error:', error);
      toast.error(error.message || "Error al registrar fichaje");
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = () => callClockAPI('in');
  const handleClockOut = () => callClockAPI('out');
  const handleBreakStart = () => callClockAPI('break_start');
  const handleBreakEnd = () => callClockAPI('break_end');

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusMessage = () => {
    switch (status) {
      case "out":
        return "Fuera del trabajo";
      case "in":
        return "Trabajando";
      case "on_break":
        return "En pausa";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "out":
        return "text-muted-foreground";
      case "in":
        return "text-primary";
      case "on_break":
        return "text-amber-600";
    }
  };

  const getStatusBgColor = () => {
    switch (status) {
      case "out":
        return "bg-muted";
      case "in":
        return "bg-primary";
      case "on_break":
        return "bg-amber-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {membership?.company.name || "TimeTrack"}
              </h1>
              <p className="text-sm text-muted-foreground">Control de fichaje</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="hover-scale">
            <LogOut className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Main Clock Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card p-8 space-y-6 text-center">
            {/* Status Circle with Animation */}
            <div className="flex justify-center mb-4">
              <motion.div
                animate={{
                  scale: status !== "out" ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: status !== "out" ? Infinity : 0,
                  ease: "easeInOut",
                }}
                className="relative"
              >
                <div
                  className={`w-32 h-32 rounded-full ${getStatusBgColor()} shadow-lg flex items-center justify-center`}
                >
                  <Clock className="w-16 h-16 text-white" />
                </div>
                {status !== "out" && (
                  <motion.div
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                    className={`absolute inset-0 rounded-full ${getStatusBgColor()} opacity-50`}
                  />
                )}
              </motion.div>
            </div>

            {/* Current Time */}
            <div className="space-y-2">
              <motion.div
                key={formatCurrentTime()}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="text-7xl font-bold tabular-nums bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent"
              >
                {formatCurrentTime()}
              </motion.div>
              <div className={`text-lg font-medium ${getStatusColor()}`}>
                {getStatusMessage()}
              </div>
              {gpsEnabled && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>GPS activado</span>
                </div>
              )}
            </div>

            {/* Elapsed Time (if working) */}
            <AnimatePresence>
              {status === "in" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-muted-foreground">Tiempo trabajado hoy</div>
                  <div className="text-4xl font-bold tabular-nums text-primary">
                    {formatTime(elapsedTime)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-4 pt-4">
              {status === "out" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <Button
                    onClick={handleClockIn}
                    disabled={loading}
                    size="lg"
                    className="w-full h-20 text-xl rounded-2xl shadow-lg hover:shadow-xl smooth-transition bg-gradient-to-r from-primary to-primary/80"
                  >
                    <LogIn className="w-8 h-8 mr-3" />
                    Fichar Entrada
                  </Button>
                </motion.div>
              )}

              {status === "in" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-3"
                >
                  <Button
                    onClick={handleBreakStart}
                    disabled={loading}
                    size="lg"
                    variant="secondary"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    <Coffee className="w-6 h-6 mr-2" />
                    Iniciar Pausa
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    size="lg"
                    variant="destructive"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    <LogOut className="w-6 h-6 mr-2" />
                    Fichar Salida
                  </Button>
                </motion.div>
              )}

              {status === "on_break" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                    <Coffee className="w-5 h-5 animate-pulse" />
                    <span className="text-sm font-medium">En pausa</span>
                  </div>
                  <Button
                    onClick={handleBreakEnd}
                    disabled={loading}
                    size="lg"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    <Clock className="w-6 h-6 mr-2" />
                    Reanudar Trabajo
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    size="lg"
                    variant="outline"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    <LogOut className="w-6 h-6 mr-2" />
                    Fichar Salida
                  </Button>
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Status Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{
                    scale: status !== "out" ? [1, 1.2, 1] : 1,
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: status !== "out" ? Infinity : 0,
                  }}
                  className={`w-3 h-3 rounded-full ${
                    status === "in"
                      ? "bg-primary"
                      : status === "on_break"
                      ? "bg-amber-500"
                      : "bg-muted-foreground"
                  }`}
                />
                <span className="text-sm text-muted-foreground">
                  Estado actual: <span className="font-medium text-foreground">{getStatusMessage()}</span>
                </span>
              </div>
              {activeSession && (
                <span className="text-xs text-muted-foreground">
                  Entrada: {new Date(activeSession.clock_in_time).toLocaleTimeString("es-ES")}
                </span>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default WorkerView;
