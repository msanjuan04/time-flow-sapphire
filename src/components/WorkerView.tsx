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
import { calculateDistanceMeters } from "@/utils/distance";
import { GEOFENCE_RADIUS_METERS } from "@/config/geofence";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import WorkerScheduleSection from "@/components/WorkerScheduleSection";

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
  review_status?: string | null;
  status?: string | null;
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
  const companyLogo = membership?.company?.logo_url ?? authCompany?.logo_url ?? null;
  const [logoUrl, setLogoUrl] = useState<string | null>(companyLogo ?? null);
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
  const [companyLocation, setCompanyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [outsideConfirm, setOutsideConfirm] = useState<{
    action: ClockAction;
    distance: number;
    location: { latitude: number; longitude: number };
  } | null>(null);
  const [outsideNote, setOutsideNote] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [showHolidayReason, setShowHolidayReason] = useState(false);
  const [holidayAction, setHolidayAction] = useState<ClockAction | null>(null);
  const [maxShiftHours, setMaxShiftHours] = useState<number | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchTodaySchedule() {
    if (!user?.id || !companyId) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("scheduled_hours")
      .select("start_time, end_time, expected_hours")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("date", today)
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
  }

  const fetchStatus = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const { data: session } = await supabase
      .from("work_sessions")
      .select("id, clock_in_time, clock_out_time, is_active, review_status, status")
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

  // Fallback para logo si no vino en el membership
  useEffect(() => {
    if (companyLogo) {
      setLogoUrl(companyLogo);
      return;
    }
    const fetchLogo = async () => {
      if (!companyId) return;
      const { data, error } = await supabase.from("companies").select("logo_url").eq("id", companyId).maybeSingle();
      if (!error && data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    };
    fetchLogo();
  }, [companyId, companyLogo]);

  const toNumberOrNull = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    if (user && companyId) {
      fetchStatus();
      fetchTodaySchedule();
    }
  }, [user, companyId, fetchStatus]);

  useEffect(() => {
    const fetchCompanyLocation = async () => {
      if (!companyId) return;
      const { data, error } = await supabase
        .from("companies")
        .select("hq_lat, hq_lng, max_shift_hours")
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Error loading company location", error);
        return;
      }

      if (typeof data?.max_shift_hours === "number" && !Number.isNaN(data.max_shift_hours)) {
        setMaxShiftHours(Number(data.max_shift_hours));
      } else {
        setMaxShiftHours(null);
      }

      if (data?.hq_lat !== null && data?.hq_lng !== null) {
        const lat = toNumberOrNull(data.hq_lat);
        const lng = toNumberOrNull(data.hq_lng);
        if (lat !== null && lng !== null) {
          setCompanyLocation({ lat, lng });
        } else {
          setCompanyLocation(null);
        }
      } else {
        setCompanyLocation(null);
      }
    };

    fetchCompanyLocation();
  }, [companyId]);

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
  }, [user?.id, companyId]);

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

  const parseFunctionError = async (response: Response | null | undefined) => {
    if (!response) return null;
    try {
      const contentType = response.headers.get("content-type") || "";
      const clone = typeof response.clone === "function" ? response.clone() : response;
      if (contentType.includes("application/json")) {
        const json = await clone.json();
        if (json?.error) {
          const baseError =
            typeof json.error === "string"
              ? json.error
              : typeof json.error?.message === "string"
              ? json.error.message
              : null;
          if (baseError) {
            const reason = json?.reason ? `:${json.reason}` : "";
            return `${baseError}${reason}`;
          }
        }
        if (json?.message) return json.message as string;
        return JSON.stringify(json);
      }
      const text = await clone.text();
      return text || null;
    } catch (err) {
      console.error("No se pudo leer el error del clock:", err);
      return null;
    }
  };

  const callClockAPI = async (
    action: ClockAction,
    options?: {
      locationOverride?: { latitude: number; longitude: number };
      note?: string;
    }
  ) => {
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
      let loc = options?.locationOverride ?? location;
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
          notes: options?.note || undefined,
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

      const result = response.data as {
        timestamp?: string;
        is_within_geofence?: boolean | null;
        distance_meters?: number | null;
      };
      
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

      if (result?.is_within_geofence === false) {
        const distanceLabel =
          typeof result.distance_meters === "number" ? `${Math.round(result.distance_meters)} m` : "fuera de zona";
        toast.warning("Estás fichando fuera de la zona habitual", {
          description:
            "Se registrará como fichaje fuera de zona. Si es un error, contacta con tu empresa. " + distanceLabel,
        });
      }
    } catch (error) {
      console.error("Clock API error:", error);
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
          ? error
          : "Error al registrar fichaje";
      const lower = rawMessage.toLowerCase();
      if (lower.includes("holiday_requires_reason")) {
        setHolidayAction(action);
        setShowHolidayReason(true);
        toast.warning("Añade un motivo para fichar en festivo");
      } else {
        const friendlyMessage = normalizeErrorMessage(rawMessage);
        console.error("Clock raw message:", rawMessage);
        toast.error(friendlyMessage, {
          action: {
            label: "Reintentar",
            onClick: () => callClockAPI(action),
          },
        });
      }
    } finally {
      setLoading(false);
      setActionPending(null);
    }
  };

  const handleClockIn = () => attemptAction('in');
  const handleClockOut = () => attemptAction('out');
  const handleBreakStart = () => attemptAction('break_start');
  const handleBreakEnd = () => attemptAction('break_end');

  const submitHolidayReason = async () => {
    const reason = holidayReason.trim();
    if (!holidayAction) return;
    if (reason.length < 3) {
      toast.error("Añade un motivo más detallado (mín. 3 caracteres)");
      return;
    }
    setShowHolidayReason(false);
    const actionToRetry = holidayAction;
    setHolidayAction(null);
    setHolidayReason("");
    await callClockAPI(actionToRetry, { note: reason });
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

  const maxLimitExceeded =
    Boolean(maxShiftHours) &&
    Boolean(activeSession?.clock_in_time) &&
    (Date.now() - new Date(activeSession!.clock_in_time).getTime()) / (1000 * 60 * 60) >
      Number(maxShiftHours);
  const reviewBlocked =
    activeSession?.review_status === "exceeded_limit" || activeSession?.review_status === "pending_review";
  // Solo bloqueamos el cierre; permitimos nuevas entradas y pausas
  const blockClockOut = reviewBlocked || maxLimitExceeded;
  const forceNewEntry = blockClockOut && status === "in";

  const isActionDisabled = loading || isOffline;

  const attemptAction = async (action: ClockAction) => {
    if (blockClockOut && action === "out") {
      toast.error("No puedes cerrar esta fichada", {
        description:
          "La fichada superó el límite de horas y debe ser revisada por un responsable. Solo puedes iniciar una nueva fichada.",
      });
      return;
    }

    let loc = location;
    if (!loc?.latitude || !loc?.longitude) {
      const fresh = await getFreshLocation();
      if (fresh.latitude && fresh.longitude) {
        loc = { latitude: fresh.latitude, longitude: fresh.longitude };
        setLocation(loc);
        setGpsEnabled(true);
        setGpsWarningShown(false);
      } else {
        toast.warning("No pudimos obtener tu ubicación", {
          description: "El fichaje se enviará sin verificar geovalla.",
        });
      }
    }

    const hasCompanyLoc =
      companyLocation &&
      Number.isFinite(companyLocation.lat) &&
      Number.isFinite(companyLocation.lng);

    if (!hasCompanyLoc) {
      toast.warning("Tu empresa no tiene punto de control configurado", {
        description: "No se puede validar la distancia. Configura la ubicación en ajustes.",
      });
    }

    if (loc && hasCompanyLoc) {
      const distance = calculateDistanceMeters(
        Number(loc.latitude),
        Number(loc.longitude),
        Number(companyLocation!.lat),
        Number(companyLocation!.lng)
      );
      if (Number.isFinite(distance) && distance > GEOFENCE_RADIUS_METERS) {
        setOutsideConfirm({ action, distance, location: loc });
        return;
      }
    }

    await callClockAPI(action, { locationOverride: loc ?? undefined });
  };

  const confirmOutsideClock = async () => {
    if (!outsideConfirm) return;
    const note = outsideNote.trim() || undefined;
    await callClockAPI(outsideConfirm.action, {
      locationOverride: outsideConfirm.location,
      note,
    });
    setOutsideConfirm(null);
    setOutsideNote("");
  };

  const cancelOutsideClock = () => {
    setOutsideConfirm(null);
    setOutsideNote("");
  };

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

        {blockClockOut && (
          <Card className="border-destructive bg-destructive/10 text-destructive p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Fichada pendiente de revisión</p>
                <p className="text-sm">
                  La fichada anterior superó el límite de horas configurado. El responsable debe revisarla.
                  Solo puedes iniciar una nueva fichada.
                </p>
              </div>
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
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${companyName}`}
                    className="h-10 w-10 rounded object-contain border border-border/50 bg-white"
                  />
                ) : null}
                <h1 className="text-xl font-bold">
                  {companyName}
                </h1>
              </div>
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
              {(status === "out" || forceNewEntry) && (
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

              {status === "in" && !forceNewEntry && (
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
                    disabled={isActionDisabled || blockClockOut}
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
                    disabled={isActionDisabled || blockClockOut}
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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <WorkerScheduleSection
            userId={user.id}
            companyId={companyId}
            workerName={user.full_name || user.email}
          />
        </motion.div>
      </div>

      <Dialog open={!!outsideConfirm} onOpenChange={(open) => !open && cancelOutsideClock()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fichaje fuera de la zona definida</DialogTitle>
            <DialogDescription>
              Estás a más de {GEOFENCE_RADIUS_METERS} m del punto configurado por tu empresa.
              Si continúas, el fichaje quedará marcado como “fuera de zona”.
            </DialogDescription>
          </DialogHeader>
          {outsideConfirm && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Distancia estimada: <strong>{Math.round(outsideConfirm.distance)} m</strong>
              </p>
              <div className="space-y-1">
                <label className="text-sm font-medium">Motivo (opcional)</label>
                <Textarea
                  value={outsideNote}
                  onChange={(e) => setOutsideNote(e.target.value)}
                  placeholder="Ej. Estoy en cliente, incidencia, teletrabajo puntual..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="outline" onClick={cancelOutsideClock}>
              Cancelar
            </Button>
            <Button onClick={confirmOutsideClock} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sí, fichar fuera de zona
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHolidayReason}
        onOpenChange={(open) => {
          if (!open) {
            setShowHolidayReason(false);
            setHolidayAction(null);
            setHolidayReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fichaje en festivo</DialogTitle>
            <DialogDescription>
              Tu empresa solicita un motivo para fichar en festivo. Añádelo para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo</label>
            <Textarea
              value={holidayReason}
              onChange={(e) => setHolidayReason(e.target.value)}
              placeholder="Ej. Guardia programada, incidencia urgente, turno pactado..."
            />
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowHolidayReason(false);
                setHolidayAction(null);
                setHolidayReason("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={submitHolidayReason} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enviar motivo y fichar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerView;
