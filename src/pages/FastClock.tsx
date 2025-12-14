import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ClockAction = "in" | "out" | "break_start" | "break_end";
type WorkerStatus = "loading" | "out" | "in" | "on_break";

const actionCopy: Record<ClockAction, { label: string; tone: string }> = {
  in: { label: "Entrar", tone: "bg-emerald-600 hover:bg-emerald-500" },
  out: { label: "Salir", tone: "bg-rose-600 hover:bg-rose-500" },
  break_start: { label: "Pausa", tone: "bg-amber-500 hover:bg-amber-400" },
  break_end: { label: "Reanudar", tone: "bg-blue-600 hover:bg-blue-500" },
};

const FastClockPage = () => {
  const { pointId } = useParams<{ pointId: string }>();
  const { user, loading: authLoading, signInWithCode } = useAuth();
  const { companyId, membership, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();
  const [status, setStatus] = useState<WorkerStatus>("loading");
  const [actionPending, setActionPending] = useState<ClockAction | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Bienvenido";
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user?.id || !companyId) {
      setStatus("loading");
      return;
    }
    try {
      const { data: session } = await supabase
        .from("work_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();

      if (!session) {
        setStatus("out");
        return;
      }

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
    } catch (err) {
      console.error("Estado de fichaje no disponible:", err);
      setStatus("out");
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsReady(true);
      },
      (err) => {
        console.warn("GPS no disponible en fastclock:", err);
        setGpsReady(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const availableActions: ClockAction[] = useMemo(() => {
    if (status === "in") return ["break_start", "out"];
    if (status === "on_break") return ["break_end", "out"];
    if (status === "out") return ["in"];
    return [];
  }, [status]);

  const clockAction = async (action: ClockAction) => {
    if (!pointId) {
      throw new Error("Falta el punto de fichaje");
    }
    // Conecta aquí con la Edge Function de fichaje existente (no enviamos user_id ni company_id, se toma de la sesión).
    const response = await supabase.functions.invoke("clock", {
      body: {
        action,
        source: "fastclock",
        point_id: pointId,
        latitude: coords?.lat,
        longitude: coords?.lng,
      },
    });
    if (response.error) {
      throw response.error;
    }
    return response.data;
  };

  const handleAction = async (action: ClockAction) => {
    if (actionPending) return;
    setActionPending(action);
    try {
      await clockAction(action);
      toast.success(`✓ ${actionCopy[action].label} registrada`);
      await fetchStatus();
    } catch (err: any) {
      const message = err?.message || "No se pudo registrar el fichaje.";
      toast.error(message);
    } finally {
      setActionPending(null);
    }
  };

  const workerIdLabel = user?.email || user?.id || "Trabajador";
  const pointLabel = pointId ? `Punto: ${pointId}` : "Punto de fichaje";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      toast.error("Introduce el código de acceso");
      return;
    }
    setLoginLoading(true);
    const { error } = await signInWithCode(loginCode.trim(), { redirect: `/fastclock/${pointId ?? ""}` });
    setLoginLoading(false);
    if (error) {
      toast.error("Código inválido o caducado");
      return;
    }
    // Recarga la misma ruta para que se hidrate la sesión y memberships
    navigate(0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4">
          <div>
            <p className="text-sm text-slate-300">{greeting}</p>
            <h1 className="text-2xl font-semibold mt-1">Fichaje rápido</h1>
            <p className="text-sm text-slate-300 mt-2">{pointLabel}</p>
          </div>
          <p className="text-sm text-slate-300">
            Inicia sesión con tu código para fichar de forma rápida y segura. Este acceso está vinculado a tu cuenta y evita fichajes no autorizados.
          </p>
          <form className="space-y-3" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-sm font-medium">Código de acceso</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                placeholder="Introduce tu código"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
            >
              {loginLoading ? "Accediendo..." : "Acceder y fichar"}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center">Fichaje rápido · GTiQ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-300">{greeting}</p>
              <h1 className="text-2xl font-semibold mt-1">Fichaje rápido</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">ID trabajador</p>
              <p className="text-base font-medium">{workerIdLabel}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {pointLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className={cn("w-2 h-2 rounded-full", gpsReady ? "bg-emerald-400" : "bg-amber-300")} />
              {gpsReady ? "GPS listo" : "GPS no disponible"}
            </span>
            {membership?.company?.name ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {membership.company.name}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  status === "loading" ? "bg-amber-300" : status === "in" ? "bg-emerald-400" : status === "on_break" ? "bg-amber-400" : "bg-slate-400"
                )}
              />
              {status === "loading" ? "Cargando estado..." : status === "in" ? "Trabajando" : status === "on_break" ? "En pausa" : "Fuera"}
            </span>
          </div>
        </header>

        <main>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableActions.map((action) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={actionPending !== null || membershipLoading || status === "loading"}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-6 text-left shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-white/40",
                  actionCopy[action].tone,
                  actionPending === action ? "opacity-70" : "opacity-100"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80">Acción</p>
                    <p className="text-2xl font-semibold">{actionCopy[action].label}</p>
                  </div>
                  <div className="text-4xl">↗</div>
                </div>
                <p className="mt-3 text-sm text-white/80">Toca para registrar al instante.</p>
              </button>
            ))}
          </div>

          {availableActions.length === 0 && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              {membershipLoading || status === "loading"
                ? "Cargando estado..."
                : "No hay acciones disponibles ahora mismo."}
            </div>
          )}
        </main>

        <footer className="pt-4 text-center text-sm text-slate-400">
          Fichaje rápido · GTiQ
        </footer>
      </div>
    </div>
  );
};

export default FastClockPage;
