import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, PlayCircle, PauseCircle, StopCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMembership } from "@/hooks/useMembership";

type EventType = "clock_in" | "clock_out" | "pause_start" | "pause_end";

const WorkerView = () => {
  const { user, signOut } = useAuth();
  const { companyId } = useMembership();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && companyId) {
      fetchActiveSession();
    }
  }, [user, companyId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && !isPaused) {
      interval = setInterval(() => {
        const startTime = new Date(activeSession.clock_in_time).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession, isPaused]);

  const fetchActiveSession = async () => {
    const { data } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user?.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      setActiveSession(data);
      
      const { data: lastEvent } = await supabase
        .from("time_events")
        .select("event_type")
        .eq("user_id", user?.id)
        .eq("company_id", companyId)
        .order("event_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      setIsPaused(lastEvent?.event_type === "pause_start");
    }
  };

  const createEvent = async (eventType: EventType) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("time_events").insert({
        user_id: user?.id,
        company_id: companyId,
        event_type: eventType,
      });

      if (error) throw error;

      if (eventType === "clock_in") {
        const { error: sessionError } = await supabase.from("work_sessions").insert({
          user_id: user?.id,
          company_id: companyId,
          clock_in_time: new Date().toISOString(),
        });
        if (sessionError) throw sessionError;
      } else if (eventType === "clock_out" && activeSession) {
        const { error: updateError } = await supabase
          .from("work_sessions")
          .update({
            clock_out_time: new Date().toISOString(),
            is_active: false,
          })
          .eq("id", activeSession.id);
        if (updateError) throw updateError;
      }

      await fetchActiveSession();
      toast.success(getSuccessMessage(eventType));
    } catch (error: any) {
      toast.error(error.message || "Error al registrar evento");
    } finally {
      setLoading(false);
    }
  };

  const getSuccessMessage = (eventType: EventType) => {
    const messages = {
      clock_in: "¡Entrada registrada!",
      clock_out: "¡Salida registrada!",
      pause_start: "Pausa iniciada",
      pause_end: "Pausa finalizada",
    };
    return messages[eventType];
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">TimeTrack</h1>
              <p className="text-sm text-muted-foreground">Control horario</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <Card className="glass-card p-8 space-y-8">
          {activeSession && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm font-medium">Sesión activa</span>
              </div>
              <div className="text-6xl font-bold tabular-nums">
                {formatTime(elapsedTime)}
              </div>
              {isPaused && (
                <div className="text-amber-600 font-medium">En pausa</div>
              )}
            </div>
          )}

          {!activeSession && (
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">¡Bienvenido!</h2>
              <p className="text-muted-foreground">
                Presiona el botón para fichar tu entrada
              </p>
            </div>
          )}

          <div className="space-y-3">
            {!activeSession ? (
              <Button
                onClick={() => createEvent("clock_in")}
                disabled={loading}
                className="w-full h-16 text-lg smooth-transition"
              >
                <PlayCircle className="w-6 h-6 mr-2" />
                Fichar entrada
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button
                    onClick={() => createEvent("pause_start")}
                    disabled={loading}
                    variant="secondary"
                    className="w-full h-14 text-lg smooth-transition"
                  >
                    <PauseCircle className="w-5 h-5 mr-2" />
                    Iniciar pausa
                  </Button>
                ) : (
                  <Button
                    onClick={() => createEvent("pause_end")}
                    disabled={loading}
                    variant="secondary"
                    className="w-full h-14 text-lg smooth-transition"
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Finalizar pausa
                  </Button>
                )}

                <Button
                  onClick={() => createEvent("clock_out")}
                  disabled={loading}
                  variant="destructive"
                  className="w-full h-14 text-lg smooth-transition"
                >
                  <StopCircle className="w-5 h-5 mr-2" />
                  Fichar salida
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WorkerView;
