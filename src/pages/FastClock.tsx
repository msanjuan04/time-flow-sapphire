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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseFunctionError = async (response: Response | null | undefined) => {
  if (!response) return null;
  try {
    const contentType = response.headers.get("content-type") || "";
    const clone = typeof response.clone === "function" ? response.clone() : response;
    if (contentType.includes("application/json")) {
      const json = await clone.json();
      if (json?.error) {
        const reason = json?.reason ? `:${json.reason}` : "";
        const message =
          typeof json?.message === "string" && json.message.trim() ? json.message.trim() : null;
        const baseError =
          typeof json.error === "string"
            ? json.error
            : typeof json.error?.message === "string"
            ? json.error.message
            : null;
        if (message) return `${message}${reason}`;
        if (baseError) return `${baseError}${reason}`;
      }
      if (typeof json?.message === "string" && json.message.trim()) return json.message as string;
      return JSON.stringify(json);
    }
    const text = await clone.text();
    return text || null;
  } catch (err) {
    console.error("No se pudo leer el error del clock:", err);
    return null;
  }
};

const normalizeErrorMessage = (raw: string) => {
  const lower = raw.toLowerCase();
  if (lower.includes("ya no puedes fichar") || lower.includes("no puedes fichar todavía")) {
    return "Estás fuera del horario configurado para hoy. Pide a tu empresa que amplíe la tolerancia o desactive la restricción.";
  }
  if (lower.includes("legal_restriction")) {
    if (lower.includes("outside_allowed_hours")) {
      return "No puedes fichar fuera del horario permitido por tu empresa.";
    }
    if (lower.includes("too_soon_between_shifts")) {
      return "No han pasado las horas mínimas entre turnos. Intenta más tarde.";
    }
    if (lower.includes("exceeded_week_hours")) {
      return "Has alcanzado el máximo de horas semanales permitidas.";
    }
    if (lower.includes("exceeded_month_hours")) {
      return "Has alcanzado el máximo de horas mensuales permitidas.";
    }
    return "No puedes fichar por una restricción de horario configurada.";
  }
  if (lower.includes("day_policy_violation")) {
    if (lower.includes("sunday_blocked")) return "Tu empresa no permite fichar los domingos.";
    if (lower.includes("holiday_requires_reason")) return "Debes añadir un motivo para fichar en festivo.";
    if (lower.includes("holiday_blocked")) return "No se permiten fichajes en festivos.";
    if (lower.includes("special_day_restricted")) return "Hoy es un día especial restringido. Contacta con tu empresa.";
    return "No puedes fichar por la política del día configurada por tu empresa.";
  }
  if (lower.includes("point_invalid")) {
    return "El enlace de fichaje es inválido o está incompleto. Vuelve a escanear el QR correcto.";
  }
  if (lower.includes("point_not_found")) {
    return "Este punto de fichaje ya no existe o está inactivo. Solicita o escanea un QR actualizado.";
  }
  if (lower.includes("device_not_registered")) {
    return "Este dispositivo no está autorizado para este punto. Pide que registren el tag en la empresa.";
  }
  if (lower.includes("device_point_mismatch")) {
    return "Estás usando un dispositivo de otro punto. Usa el QR correcto o solicita el alta del tag.";
  }
  if (lower.includes("shift_exceeded_max_hours")) {
    return "Tu fichada superó el límite de horas configurado. El responsable debe revisarla. Solo puedes iniciar una nueva fichada.";
  }
  if (lower.includes("exceeded_limit")) {
    return "Tu fichada anterior está pendiente de revisión. Solo puedes iniciar una nueva entrada.";
  }
  if (lower.includes("sesión activa")) {
    return "Ya tienes una sesión activa. Finalízala antes de volver a fichar.";
  }
  if (lower.includes("ninguna sesión activa")) {
    return "No tienes una sesión abierta. Registra una entrada antes de salir.";
  }
  if (lower.includes("suspendida")) {
    return "Tu empresa está suspendida. Contacta con un administrador.";
  }
  return raw || "No pudimos registrar el fichaje. Intenta nuevamente.";
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
  const [deviceId] = useState(() => {
    const key = "gtiq_device_id";
    const existing = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(key, generated);
    } catch (err) {
      console.warn("No se pudo persistir device_id", err);
    }
    return generated;
  });

  const normalizedPointId = useMemo(() => (pointId ?? "").trim(), [pointId]);
  const isPointIdValid = useMemo(() => UUID_REGEX.test(normalizedPointId), [normalizedPointId]);

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
    if (!isPointIdValid) return [];
    if (status === "in") return ["break_start", "out"];
    if (status === "on_break") return ["break_end", "out"];
    if (status === "out") return ["in"];
    return [];
  }, [isPointIdValid, status]);

  const clockAction = async (action: ClockAction) => {
    if (!normalizedPointId || !isPointIdValid) {
      throw new Error("El enlace de fichaje es inválido. Reescanea el QR o solicita uno nuevo.");
    }
    if (!companyId) {
      throw new Error("No se pudo determinar tu empresa. Asegúrate de estar asociado a una empresa.");
    }
    // Conecta aquí con la Edge Function de fichaje existente (no enviamos user_id; company_id ayuda si hay varias empresas).
    const response = await supabase.functions.invoke("clock", {
      body: {
        action,
        source: "fastclock",
        point_id: normalizedPointId,
        company_id: companyId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        device_id: deviceId,
      },
    });
    if (response.error) {
      const errorResponse = response.response ?? (response.error as any)?.context;
      const parsedError = await parseFunctionError(errorResponse);
      const serverMessage =
        (response.data as any)?.error ||
        parsedError ||
        response.error.message ||
        "Error en clock";
      throw new Error(serverMessage);
    }
    return response.data;
  };

  const handleAction = async (action: ClockAction) => {
    if (actionPending) return;
    if (!isPointIdValid) {
      toast.error("Este enlace de fichaje no es válido. Usa el QR correcto o solicita uno nuevo.");
      return;
    }
    setActionPending(action);
    try {
      await clockAction(action);
      toast.success(`✓ ${actionCopy[action].label} registrada`);
      await fetchStatus();
    } catch (err: any) {
      const rawMessage =
        err instanceof Error ? err.message : typeof err === "string" ? err : "No se pudo registrar el fichaje.";
      const friendlyMessage = normalizeErrorMessage(rawMessage);
      toast.error(friendlyMessage);
    } finally {
      setActionPending(null);
    }
  };

  const workerIdLabel = user?.email || user?.id || "Trabajador";
  const pointLabel = normalizedPointId ? (isPointIdValid ? "Punto configurado" : "Punto inválido") : "Punto de fichaje"; // UI: avoid mostrar UUID cruda

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      toast.error("Introduce el código de acceso");
      return;
    }
    setLoginLoading(true);
    const { error } = await signInWithCode(loginCode.trim(), { redirect: `/fastclock/${normalizedPointId ?? ""}` });
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
          {normalizedPointId && !isPointIdValid && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-50">
              El enlace de este punto no es válido o está incompleto. Reescanea el QR correcto o solicita uno nuevo.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableActions.map((action) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={actionPending !== null || membershipLoading || status === "loading" || !isPointIdValid}
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
              {normalizedPointId && !isPointIdValid
                ? "No puedes fichar con este enlace. Escanea el QR correcto para continuar."
                : membershipLoading || status === "loading"
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
