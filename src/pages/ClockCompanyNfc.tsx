import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Nfc, WifiOff, RefreshCw } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import { invokeNfcWithQueue } from "@/lib/offlineNfcQueue";
import { useOfflineNfcSync } from "@/hooks/useOfflineNfcSync";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScreenState =
  | { phase: "loading" }
  | { phase: "invalid_company" }
  | { phase: "invalid_uuid" }
  | { phase: "waiting" }
  | { phase: "processing" }
  | { phase: "success"; name: string }
  | { phase: "queued" }
  | { phase: "error_unknown" }
  | { phase: "error_rpc"; message: string };

const RESULT_MS = 3000;

const ClockCompanyNfcPage = () => {
  useDocumentTitle("Fichaje NFC");
  const { companyId: companyIdParam } = useParams<{ companyId: string }>();
  const companyId = useMemo(() => (companyIdParam ?? "").trim(), [companyIdParam]);
  const companyIdValid = useMemo(() => UUID_REGEX.test(companyId), [companyId]);

  const [screen, setScreen] = useState<ScreenState>({ phase: "loading" });
  const screenRef = useRef<ScreenState>(screen);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      busyRef.current = false;
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
      if (!companyIdValid || busyRef.current) return;
      const trimmed = raw.trim();
      if (!trimmed) return;

      busyRef.current = true;
      setScreen({ phase: "processing" });

      const result = await invokeNfcWithQueue(companyId, trimmed);

      // Caso 1: se ha encolado por falta de conexión
      if (result.queued) {
        setScreen({ phase: "queued" });
        scheduleBackToWaiting();
        return;
      }

      // Caso 2: error de servidor (no de red)
      if (!result.ok) {
        const msg =
          (result.error as any)?.message ||
          String(result.error || "Error de conexión.");
        busyRef.current = false;
        setScreen({ phase: "error_rpc", message: msg });
        return;
      }

      const payload = (result.data || {}) as {
        ok?: boolean;
        error?: string;
        nombre_completo?: string;
      };

      if (payload.error === "company_not_found") {
        setScreen({ phase: "invalid_company" });
        busyRef.current = false;
        return;
      }

      if (payload.ok === true) {
        setScreen({ phase: "success", name: payload.nombre_completo?.trim() || "Trabajador" });
        scheduleBackToWaiting();
        return;
      }

      setScreen({ phase: "error_unknown" });
      scheduleBackToWaiting();
    },
    [companyId, companyIdValid, scheduleBackToWaiting]
  );

  const keepFocus = useCallback(() => {
    if (screen.phase === "waiting" || screen.phase === "loading") {
      inputRef.current?.focus();
    }
  }, [screen.phase]);

  useEffect(() => {
    const id = window.setInterval(keepFocus, 800);
    return () => clearInterval(id);
  }, [keepFocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = e.currentTarget.value;
    e.currentTarget.value = "";
    if (screenRef.current.phase === "waiting" && raw.trim()) {
      void submitUid(raw);
    }
  };

  const pendingCount = pending.length;

  const kioskShell = (children: React.ReactNode) => (
    <div
      className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center px-4 py-8 relative"
      onPointerDown={() => keepFocus()}
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
      {(screen.phase === "waiting" || screen.phase === "loading") && (
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
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-200">Error</h1>
        <p className="text-lg text-slate-300">{screen.message}</p>
        <p className="text-sm text-slate-500">
          Si acabas de desplegar la app, aplica la migración SQL `nfc_kiosk_clock` en Supabase y concede EXECUTE a `anon`.
        </p>
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
          <p className="text-7xl sm:text-8xl">✅</p>
          <p className="text-2xl sm:text-4xl font-bold text-emerald-400 leading-tight">
            Bienvenido, {screen.name}
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

      {screen.phase === "error_unknown" && (
        <>
          <p className="text-7xl sm:text-8xl">❌</p>
          <p className="text-2xl sm:text-4xl font-bold text-rose-400">Tarjeta no reconocida</p>
        </>
      )}
    </div>
  );
};

export default ClockCompanyNfcPage;
