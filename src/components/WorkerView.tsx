import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Coffee, User, MapPin, AlertCircle, Calendar, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMembership } from "@/hooks/useMembership";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import { CompanySelector } from "@/components/CompanySelector";

type WorkerStatus = "out" | "in" | "on_break";

interface GeolocationCoords {
  latitude: number;
  longitude: number;
}

interface ActiveWorkSession {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  is_active: boolean;
}

type ClockAction = "in" | "out" | "break_start" | "break_end";

const WorkerView = () => {
  const { user, signOut, memberships: authMemberships, company: authCompany } = useAuth();
  const { companyId: hookCompanyId, membership: hookMembership, loading: membershipLoading, hasMultipleCompanies } = useMembership();
  const fallbackMembership = authCompany
    ? authMemberships?.find((m) => m.company_id === authCompany.id) ?? authMemberships?.[0]
    : authMemberships?.[0];
  const membership = hookMembership ?? (fallbackMembership ?? null);
  const companyId = hookCompanyId ?? membership?.company_id ?? authCompany?.id ?? null;
  const companyName = membership?.company?.name ?? authCompany?.name ?? "GTiQ";
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<WorkerStatus>("out");
  const [activeSession, setActiveSession] = useState<ActiveWorkSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState<ClockAction | null>(null);
  const [location, setLocation] = useState<GeolocationCoords | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsWarningShown, setGpsWarningShown] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: ClockAction; timestamp: string } | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [todaySchedule, setTodaySchedule] = useState<{ start_time: string | null; end_time: string | null; expected_hours: number } | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const { data: session } = await supabase
      .from("work_sessions")
      .select("id, clock_in_time, clock_out_time, is_active")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (session) {
      setActiveSession(session as ActiveWorkSession);

      const { data: lastEvent } = await supabase
        .from("time_events")
        .select("event_type")
        .eq("user_id", user.id)
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
      setActiveSession(null);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    if (user && companyId) {
      fetchStatus();
      fetchTodaySchedule();
    }
  }, [user, companyId, fetchStatus, fetchTodaySchedule]);

  const fetchTodaySchedule = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('scheduled_hours')
      .select('start_time, end_time, expected_hours')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('date', today)
      .maybeSingle();
    
    if (data) {
      setTodaySchedule({
        start_time: data.start_time,
        end_time: data.end_time,
        expected_hours: Number(data.expected_hours || 0),
      });
    } else {
      setTodaySchedule(null);
    }
  }, [user?.id, companyId]);

  // Subscribe to scheduled_hours changes in real-time
  useEffect(() => {
    if (!user?.id || !companyId) return;

    const channel = supabase
      .channel(`worker-view-scheduled-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_hours",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("🔄 Scheduled hours updated, refreshing worker view...");
          fetchTodaySchedule();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, companyId, fetchTodaySchedule]);

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
          setGpsWarningShown(false);
        },
        (error) => {
          console.warn("GPS not available:", error);
          setGpsEnabled(false);
        }
      );
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Conexión restablecida", {
        description: "Puedes volver a fichar.",
      });
      fetchStatus();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Sin conexión a internet", {
        description: "Tus fichajes se habilitarán cuando vuelvas a estar conectado.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchStatus]);

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

  const getFreshLocation = async (): Promise<{latitude?: number; longitude?: number}> => {
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 0,
          })
        );
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  const callClockAPI = async (action: ClockAction) => {
    if (!navigator.onLine) {
      toast.error("Sin conexión a internet", {
        description: "Activa tu conexión para registrar el fichaje.",
        action: {
          label: "Reintentar",
          onClick: () => callClockAPI(action),
        },
      });
      setIsOffline(true);
      return;
    }

    setActionPending(action);
    setLoading(true);
    try {
      // Ensure we have a location right before sending
      let loc = location;
      if (!loc?.latitude || !loc?.longitude) {
        const fresh = await getFreshLocation();
        if (fresh.latitude && fresh.longitude) {
          setLocation({ latitude: fresh.latitude, longitude: fresh.longitude });
          loc = { latitude: fresh.latitude, longitude: fresh.longitude } as any;
          setGpsEnabled(true);
          setGpsWarningShown(false);
        } else if (!gpsWarningShown) {
          toast.warning("No pudimos obtener tu ubicación", {
            description: "Verifica permisos de GPS. El fichaje se guardará sin coordenadas.",
          });
          setGpsWarningShown(true);
          setGpsEnabled(false);
        }
      }

      const response = await supabase.functions.invoke('clock', {
        body: {
          action,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          source: 'web',
          company_id: companyId,
        },
      });

      if (response.error) throw response.error;

      const result = response.data;
      
      await fetchStatus();

      // Show success message based on action
      const messages: Record<ClockAction, string> = {
        in: '✓ Entrada registrada',
        out: '✓ Salida registrada',
        break_start: '☕ Pausa iniciada',
        break_end: '✓ Pausa finalizada',
      };

      const timestamp = result?.timestamp || new Date().toISOString();
      setLastEvent({ type: action, timestamp });

      toast.success(messages[action], {
        description: new Date(timestamp).toLocaleTimeString("es-ES"),
      });
    } catch (error) {
      console.error("Clock API error:", error);
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
          ? error
          : "Error al registrar fichaje";
      const friendlyMessage = normalizeErrorMessage(rawMessage);
      toast.error(friendlyMessage, {
        action: {
          label: "Reintentar",
          onClick: () => callClockAPI(action),
        },
      });
    } finally {
      setLoading(false);
      setActionPending(null);
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

  const formatEventLabel = (type: ClockAction) => {
    switch (type) {
      case "in":
        return "Entrada registrada";
      case "out":
        return "Salida registrada";
      case "break_start":
        return "Pausa iniciada";
      case "break_end":
        return "Pausa finalizada";
    }
  };

  const formatEventTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const normalizeErrorMessage = (raw: string) => {
    if (raw.toLowerCase().includes("sesión activa")) {
      return "Ya tienes una sesión activa. Finalízala antes de volver a fichar.";
    }
    if (raw.toLowerCase().includes("ninguna sesión activa")) {
      return "No tienes una sesión abierta. Registra una entrada antes de salir.";
    }
    if (raw.toLowerCase().includes("suspendida")) {
      return "Tu empresa está suspendida. Contacta con un administrador.";
    }
    return raw || "No pudimos registrar el fichaje. Intenta nuevamente.";
  };

  const isActionDisabled = loading || isOffline;

  if (!user?.id || !companyId || (!membership && membershipLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <Card className="glass-card max-w-md w-full p-6 text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <h2 className="text-lg font-semibold">Preparando tu espacio</h2>
          <p className="text-muted-foreground text-sm">
            Estamos cargando la información de tu empresa. Si tarda demasiado, cierra sesión e inicia de nuevo.
          </p>
          <Button variant="ghost" onClick={signOut}>Cerrar sesión</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        {isOffline && (
          <Card className="border-amber-500 bg-amber-50 text-amber-800 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold text-amber-900">Estás sin conexión</p>
                <p className="text-sm text-amber-800">
                  Tus fichajes se habilitarán cuando vuelvas a tener internet.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!navigator.onLine) {
                    toast.warning("Seguimos sin conexión");
                    return;
                  }
                  setIsOffline(false);
                  fetchStatus();
                }}
              >
                Reintentar
              </Button>
            </div>
          </Card>
        )}

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
                {companyName}
              </h1>
              <p className="text-sm text-muted-foreground">Control de fichaje</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMultipleCompanies && <CompanySelector />}
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={signOut} className="hover-scale">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Button
            variant="outline"
            className="h-20 flex-col hover-scale"
            onClick={() => navigate("/worker-reports")}
          >
            <BarChart3 className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium">Informes</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col hover-scale"
            onClick={() => navigate("/calendar")}
          >
            <Calendar className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium">Calendario</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col hover-scale"
            onClick={() => navigate("/absences")}
          >
            <MapPin className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium">Ausencias</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col hover-scale"
            onClick={() => navigate("/correction-requests")}
          >
            <AlertCircle className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium">Correcciones</span>
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
                    disabled={isActionDisabled}
                    size="lg"
                    className="w-full h-20 text-xl rounded-2xl shadow-lg hover:shadow-xl smooth-transition bg-gradient-to-r from-primary to-primary/80"
                  >
                    {actionPending === "in" ? (
                      <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                    ) : (
                      <LogIn className="w-8 h-8 mr-3" />
                    )}
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
                    disabled={isActionDisabled}
                    size="lg"
                    variant="secondary"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    {actionPending === "break_start" ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Coffee className="w-6 h-6 mr-2" />
                    )}
                    Iniciar Pausa
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={isActionDisabled}
                    size="lg"
                    variant="destructive"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    {actionPending === "out" ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="w-6 h-6 mr-2" />
                    )}
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
                    disabled={isActionDisabled}
                    size="lg"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    {actionPending === "break_end" ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Clock className="w-6 h-6 mr-2" />
                    )}
                    Reanudar Trabajo
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={isActionDisabled}
                    size="lg"
                    variant="outline"
                    className="w-full h-16 text-lg rounded-2xl shadow-md hover:shadow-lg smooth-transition"
                  >
                    {actionPending === "out" ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="w-6 h-6 mr-2" />
                    )}
                    Fichar Salida
                  </Button>
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {lastEvent && (
          <Card className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Último movimiento</p>
              <p className="font-semibold text-foreground">{formatEventLabel(lastEvent.type)}</p>
              <p className="text-xs text-muted-foreground">{formatEventTimestamp(lastEvent.timestamp)}</p>
            </div>
          </Card>
        )}

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

          {/* Today's Schedule */}
          {todaySchedule && (
            <Card className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Horario asignado hoy</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {todaySchedule.start_time && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="text-sm font-semibold">{todaySchedule.start_time}</p>
                  </div>
                )}
                {todaySchedule.end_time && (
                  <div>
                    <p className="text-xs text-muted-foreground">Salida</p>
                    <p className="text-sm font-semibold">{todaySchedule.end_time}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Horas</p>
                  <p className="text-sm font-semibold">{todaySchedule.expected_hours.toFixed(1)}h</p>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default WorkerView;
