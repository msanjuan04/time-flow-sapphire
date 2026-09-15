import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Nfc, WifiOff, RefreshCw } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import { invokeNfcWithQueue } from "@/lib/offlineNfcQueue";
import { useOfflineNfcSync } from "@/hooks/useOfflineNfcSync";
import { playKioskSound, primeKioskAudio } from "@/lib/kioskSounds";
import { normalizeUid } from "../../supabase/functions/_shared/nfcCards";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScreenState =
  | { phase: "loading" }
  | { phase: "invalid_company" }
  | { phase: "invalid_uuid" }
  | { phase: "waiting" }
  | { phase: "processing" }
  | { phase: "success"; name: string; action: "clock_in" | "clock_out" }
  | { phase: "queued" }
  | { phase: "sick_leave"; name: string; message: string }
  // Cada rechazo dice qué ha pasado de verdad: el cartel genérico de
  // "tarjeta no reconocida" tapaba desde un trabajador de baja hasta un
  // error del servidor, y sin el UID leído no hay forma de darla de alta.
  | { phase: "rejected"; title: string; detail?: string }
  | { phase: "error_rpc"; message: string };

const RESULT_MS = 3000;
/**
 * Dos lecturas de la MISMA tarjeta seguidas son un rebote del lector, no
 * una entrada y una salida. Sin esto salen pares entrada/salida en el
 * mismo minuto, como pasó el 15/09 en Santa Marta.
 */
const MISMA_TARJETA_MS = 5000;
/** Últimos fichajes en pantalla, para poder mirar de reojo al terminar. */
const MAX_RECIENTES = 8;

type Reciente = { id: number; nombre: string; accion: "clock_in" | "clock_out"; hora: string };

const ClockCompanyNfcPage = () => {
  useDocumentTitle("Fichaje NFC");
  const { companyId: companyIdParam } = useParams<{ companyId: string }>();
  const companyId = useMemo(() => (companyIdParam ?? "").trim(), [companyIdParam]);
  const companyIdValid = useMemo(() => UUID_REGEX.test(companyId), [companyId]);

  const [screen, setScreen] = useState<ScreenState>({ phase: "loading" });
  const screenRef = useRef<ScreenState>(screen);
  const inputRef = useRef<HTMLInputElement>(null);
  // Una petición cada vez, pero sin perder ninguna pasada: las que
  // llegan mientras tanto esperan en la cola. El jefe pasa las tarjetas
  // de todo el equipo seguidas y no mira la pantalla.
  const enVueloRef = useRef(false);
  const colaRef = useRef<string[]>([]);
  const ultimaLecturaRef = useRef<Map<string, number>>(new Map());
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recientes, setRecientes] = useState<Reciente[]>([]);

  const { pending, online, flushing, flushNow } = useOfflineNfcSync();

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const scheduleBackToWaiting = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      setScreen({ phase: "waiting" });
      resetTimerRef.current = null;
      queueMicrotask(() => inputRef.current?.focus());
    }, RESULT_MS);
  }, []);

  const verifyCompany = useCallback(async () => {
    if (!companyIdValid) {
      setScreen({ phase: "invalid_uuid" });
      return;
    }
    setScreen({ phase: "loading" });
    const { data, error } = await supabase.rpc("nfc_kiosk_clock" as any, {
      p_company_id: companyId,
      p_raw_uid: "",
    });
    if (error) {
      setScreen({
        phase: "error_rpc",
        message: error.message || "No se pudo comprobar la empresa.",
      });
      return;
    }
    const payload = (data || {}) as { ok?: boolean; error?: string };
    if (payload.error === "company_not_found") {
      setScreen({ phase: "invalid_company" });
      return;
    }
    if (payload.error === "empty_uid" || payload.ok === false || payload.ok === true) {
      setScreen({ phase: "waiting" });
      return;
    }
    setScreen({ phase: "waiting" });
  }, [companyId, companyIdValid]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    void verifyCompany();
  }, [verifyCompany]);

  useEffect(() => {
    return () => clearResetTimer();
  }, []);

  const submitUid = useCallback(
    async (raw: string) => {
      if (!companyIdValid) return;
      const trimmed = raw.trim();
      if (!trimmed) return;

      clearResetTimer();
      setScreen({ phase: "processing" });

      const result = await invokeNfcWithQueue(companyId, trimmed);

      // Caso 1: se ha encolado por falta de conexión
      if (result.queued) {
        playKioskSound("queued");
        setScreen({ phase: "queued" });
        scheduleBackToWaiting();
        return;
      }

      // Caso 2: error de servidor (no de red)
      if (!result.ok) {
        const msg =
          (result.error as any)?.message ||
          String(result.error || "Error de conexión.");
        playKioskSound("error");
        setScreen({ phase: "error_rpc", message: msg });
        return;
      }

      const payload = (result.data || {}) as {
        ok?: boolean;
        error?: string;
        nombre_completo?: string | null;
        action?: string;
        message?: string;
      };

      if (payload.error === "company_not_found") {
        setScreen({ phase: "invalid_company" });
        playKioskSound("error");
        return;
      }

      if (payload.error === "unknown_card") {
        playKioskSound("error");
        setScreen({
          phase: "rejected",
          title: "Tarjeta no reconocida",
          detail: payload.message || "No está dada de alta en esta empresa.",
        });
        scheduleBackToWaiting();
        return;
      }

      if (payload.error === "employee_inactive") {
        playKioskSound("error");
        setScreen({
          phase: "rejected",
          title: "Trabajador dado de baja",
          detail: payload.message || "Avisa a tu responsable.",
        });
        scheduleBackToWaiting();
        return;
      }

      if (payload.error === "on_sick_leave") {
        playKioskSound("error");
        setScreen({
          phase: "sick_leave",
          name: payload.nombre_completo?.trim() || "Trabajador",
          message: payload.message || "Estás de baja médica aprobada.",
        });
        scheduleBackToWaiting();
        return;
      }

      // Regla de la empresa (horario, festivo, límite de horas...): el
      // servidor explica el motivo; lo mostramos tal cual y volvemos a esperar.
      if (payload.ok === false && payload.error === "server_error") {
        playKioskSound("error");
        setScreen({ phase: "error_rpc", message: payload.message || "No se pudo registrar el fichaje." });
        scheduleBackToWaiting();
        return;
      }

      if (payload.ok === true) {
        const action: "clock_in" | "clock_out" = payload.action === "clock_out" ? "clock_out" : "clock_in";
        const nombre = payload.nombre_completo?.trim() || "Trabajador";
        playKioskSound(action === "clock_out" ? "success_out" : "success_in");
        setScreen({ phase: "success", name: nombre, action });
        setRecientes((prev) =>
          [
            {
              id: Date.now() + Math.random(),
              nombre,
              accion: action,
              hora: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
            },
            ...prev,
          ].slice(0, MAX_RECIENTES)
        );
        scheduleBackToWaiting();
        return;
      }

      playKioskSound("error");
      setScreen({
        phase: "rejected",
        title: "No se ha podido fichar",
        detail: payload.message || payload.error || "Respuesta inesperada del servidor.",
      });
      scheduleBackToWaiting();
    },
    [companyId, companyIdValid, scheduleBackToWaiting]
  );

  /**
   * Acepta la pasada pase lo que pase haya en pantalla. Si hay una
   * petición en curso, espera turno: antes se descartaban las tarjetas
   * que llegaban durante los tres segundos del resultado anterior.
   */
  const encolar = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const uid = normalizeUid(trimmed);
      const ahora = Date.now();
      const anterior = ultimaLecturaRef.current.get(uid);
      if (anterior && ahora - anterior < MISMA_TARJETA_MS) {
        // Rebote del lector: la misma tarjeta dos veces en un instante.
        return;
      }
      ultimaLecturaRef.current.set(uid, ahora);

      colaRef.current.push(trimmed);
      if (enVueloRef.current) return;

      void (async () => {
        enVueloRef.current = true;
        try {
          while (colaRef.current.length > 0) {
            const siguiente = colaRef.current.shift();
            if (siguiente) await submitUid(siguiente);
          }
        } finally {
          enVueloRef.current = false;
        }
      })();
    },
    [submitUid]
  );

  const keepFocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = window.setInterval(keepFocus, 800);
    return () => clearInterval(id);
  }, [keepFocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = e.currentTarget.value;
    e.currentTarget.value = "";
    encolar(raw);
  };

  const pendingCount = pending.length;

  const kioskShell = (children: React.ReactNode) => (
    <div
      className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center px-4 py-8 relative"
      onPointerDown={() => {
        primeKioskAudio();
        keepFocus();
      }}
    >
      {/* Indicador de estado offline / cola pendiente — esquina superior derecha */}
      {(!online || pendingCount > 0) && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {!online && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              <WifiOff className="w-3.5 h-3.5" />
              Sin conexión
            </div>
          )}
          {pendingCount > 0 && (
            <button
              onClick={() => void flushNow()}
              disabled={flushing || !online}
              className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
              title={`${pendingCount} fichaje${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"} de sincronizar`}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", flushing && "animate-spin")} />
              {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {children}
      {/* Siempre montado: el lector escribe como un teclado y si el campo
          desaparece mientras se ve un resultado, esa pasada se pierde. */}
      {screen.phase !== "invalid_company" && screen.phase !== "invalid_uuid" && (
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-hidden
          className="fixed left-0 top-0 h-px w-px opacity-0 pointer-events-none"
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );

  if (screen.phase === "invalid_uuid") {
    return kioskShell(
      <div className="text-center max-w-lg space-y-4">
        <p className="text-6xl">⚠️</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-200">Enlace no válido</h1>
        <p className="text-lg text-slate-300">El identificador de empresa en la URL no es un UUID válido.</p>
      </div>
    );
  }

  if (screen.phase === "invalid_company") {
    return kioskShell(
      <div className="text-center max-w-lg space-y-4">
        <p className="text-6xl">🏢</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-rose-200">Empresa no encontrada</h1>
        <p className="text-lg text-slate-300">Comprueba la URL o contacta con tu administrador.</p>
      </div>
    );
  }

  if (screen.phase === "error_rpc") {
    return kioskShell(
      <div className="text-center max-w-lg space-y-4">
        <p className="text-6xl">⚠️</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-200">No se ha registrado</h1>
        <p className="text-lg text-slate-300">{screen.message}</p>
        <p className="text-sm text-slate-500">Si crees que es un error, avisa a tu responsable.</p>
      </div>
    );
  }

  return kioskShell(
    <div className="flex flex-col items-center justify-center text-center max-w-3xl gap-8">
      {screen.phase === "loading" && (
        <>
          <div className="h-20 w-20 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-2xl text-slate-300">Comprobando empresa…</p>
        </>
      )}

      {screen.phase === "waiting" && (
        <>
          <Nfc className="w-32 h-32 sm:w-40 sm:h-40 text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]" strokeWidth={1.25} />
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">Pasa tu tarjeta para fichar</h1>
          <p className="text-lg sm:text-2xl text-slate-400">Acerca la tarjeta al lector USB</p>
        </>
      )}

      {screen.phase === "processing" && (
        <>
          <div className="h-24 w-24 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className={cn("text-2xl sm:text-4xl font-semibold text-cyan-200")}>Registrando…</p>
        </>
      )}

      {screen.phase === "success" && (
        <>
          <p className="text-7xl sm:text-8xl">
            {screen.action === "clock_out" ? "👋" : "✅"}
          </p>
          <p
            className={cn(
              "text-2xl sm:text-4xl font-bold leading-tight",
              screen.action === "clock_out" ? "text-rose-300" : "text-emerald-400"
            )}
          >
            {screen.action === "clock_out"
              ? `Hasta pronto, ${screen.name}`
              : `Bienvenido, ${screen.name}`}
          </p>
          <p className="text-sm sm:text-lg text-slate-400">
            {screen.action === "clock_out"
              ? "Salida registrada correctamente"
              : "Entrada registrada correctamente"}
          </p>
        </>
      )}

      {screen.phase === "sick_leave" && (
        <>
          <p className="text-7xl sm:text-8xl">🩺</p>
          <p className="text-2xl sm:text-4xl font-bold text-amber-300 leading-tight">
            {screen.name}, estás de baja
          </p>
          <p className="text-base sm:text-xl text-amber-200/80 max-w-xl mx-auto">
            {screen.message}
          </p>
        </>
      )}

      {screen.phase === "queued" && (
        <>
          <p className="text-7xl sm:text-8xl">📡</p>
          <p className="text-2xl sm:text-4xl font-bold text-amber-300 leading-tight">
            Guardado sin conexión
          </p>
          <p className="text-base sm:text-xl text-amber-200/80">
            Se sincronizará automáticamente cuando vuelva internet.
          </p>
        </>
      )}

      {recientes.length > 0 && (screen.phase === "waiting" || screen.phase === "processing") && (
        <div className="absolute bottom-4 inset-x-0 px-4">
          <p className="text-center text-xs uppercase tracking-widest text-slate-500 mb-2">
            Últimos fichajes
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {recientes.map((r) => (
              <span
                key={r.id}
                className={cn(
                  "text-xs sm:text-sm rounded-full border px-3 py-1",
                  r.accion === "clock_in"
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-slate-500/40 text-slate-300"
                )}
              >
                {r.accion === "clock_in" ? "↓" : "↑"} {r.nombre}
                <span className="text-slate-500 ml-1.5 tabular-nums">{r.hora}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {screen.phase === "rejected" && (
        <>
          <p className="text-7xl sm:text-8xl">❌</p>
          <p className="text-2xl sm:text-4xl font-bold text-rose-400">{screen.title}</p>
          {screen.detail && (
            <p className="text-base sm:text-xl text-slate-300 max-w-2xl px-4">{screen.detail}</p>
          )}
        </>
      )}
    </div>
  );
};

export default ClockCompanyNfcPage;
