import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Coffee, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMembership } from "@/hooks/useMembership";
import { motion, AnimatePresence } from "framer-motion";

type WorkerStatus = "out" | "in" | "on_break";

const WorkerView = () => {
  const { user, signOut } = useAuth();
  const { companyId, membership } = useMembership();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<WorkerStatus>("out");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const { error: eventError } = await supabase.from("time_events").insert({
        user_id: user?.id,
        company_id: companyId,
        event_type: "clock_in",
      });

      if (eventError) throw eventError;

      const { error: sessionError } = await supabase.from("work_sessions").insert({
        user_id: user?.id,
        company_id: companyId,
        clock_in_time: new Date().toISOString(),
      });

      if (sessionError) throw sessionError;

      await fetchStatus();
      toast.success("✓ Entrada registrada", {
        description: new Date().toLocaleTimeString("es-ES"),
      });
    } catch (error: any) {
      toast.error(error.message || "Error al registrar entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const { error: eventError } = await supabase.from("time_events").insert({
        user_id: user?.id,
        company_id: companyId,
        event_type: "clock_out",
      });

      if (eventError) throw eventError;

      if (activeSession) {
        const { error: updateError } = await supabase
          .from("work_sessions")
          .update({
            clock_out_time: new Date().toISOString(),
            is_active: false,
          })
          .eq("id", activeSession.id);

        if (updateError) throw updateError;
      }

      await fetchStatus();
      toast.success("✓ Salida registrada", {
        description: new Date().toLocaleTimeString("es-ES"),
      });
    } catch (error: any) {
      toast.error(error.message || "Error al registrar salida");
    } finally {
      setLoading(false);
    }
  };

  const handleBreakStart = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("time_events").insert({
        user_id: user?.id,
        company_id: companyId,
        event_type: "pause_start",
      });

      if (error) throw error;

      await fetchStatus();
      toast.success("☕ Pausa iniciada");
    } catch (error: any) {
      toast.error(error.message || "Error al iniciar pausa");
    } finally {
      setLoading(false);
    }
  };

  const handleBreakEnd = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("time_events").insert({
        user_id: user?.id,
        company_id: companyId,
        event_type: "pause_end",
      });

      if (error) throw error;

      await fetchStatus();
      toast.success("✓ Pausa finalizada");
    } catch (error: any) {
      toast.error(error.message || "Error al finalizar pausa");
    } finally {
      setLoading(false);
    }
  };

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
                <div
                  className={`w-3 h-3 rounded-full ${
                    status === "in"
                      ? "bg-primary animate-pulse"
                      : status === "on_break"
                      ? "bg-amber-500 animate-pulse"
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
