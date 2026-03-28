import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DisplayState =
  | { kind: "waiting" }
  | { kind: "scanning" }
  | { kind: "success_in"; name: string }
  | { kind: "success_out"; name: string }
  | { kind: "error"; message: string };

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
    console.error("No se pudo leer el error de nfc-clock:", err);
    return null;
  }
};

const pickEmployeeName = (data: Record<string, unknown>): string => {
  const n = data.employee_name ?? data.full_name ?? data.name ?? data.worker_name;
  return typeof n === "string" && n.trim() ? n.trim() : "Empleado";
};

const pickActionOut = (data: Record<string, unknown>): boolean => {
  const a = data.action ?? data.clock_action ?? data.direction ?? data.event;
  const s = typeof a === "string" ? a.toLowerCase() : "";
  return s === "out" || s === "exit" || s === "salida" || s === "clock_out";
};

const NfcClockPage = () => {
  const { pointId } = useParams<{ pointId: string }>();
  const normalizedPointId = useMemo(() => (pointId ?? "").trim(), [pointId]);
  const isPointIdValid = useMemo(() => UUID_REGEX.test(normalizedPointId), [normalizedPointId]);

  const [now, setNow] = useState(() => new Date());
  const [display, setDisplay] = useState<DisplayState>({ kind: "waiting" });
  const displayRef = useRef<DisplayState>(display);
  const bufferRef = useRef("");
  const inFlightRef = useRef(false);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const kind = display.kind;
    if (kind === "waiting" || kind === "scanning") return;
    const t = window.setTimeout(() => {
      setDisplay({ kind: "waiting" });
    }, 4000);
    return () => clearTimeout(t);
  }, [display.kind]);

  const submitUid = useCallback(
    async (rawUidInput: string) => {
      if (!normalizedPointId || !isPointIdValid) return;
      const rawUid = rawUidInput.trim();
      if (!rawUid) return;
      inFlightRef.current = true;
      setDisplay({ kind: "scanning" });
      try {
        const response = await supabase.functions.invoke("nfc-clock", {
          body: { card_uid: rawUid, point_id: normalizedPointId },
        });
        if (response.error) {
          const errorResponse = response.response ?? (response.error as any)?.context;
          const parsed = await parseFunctionError(errorResponse);
          const serverMessage =
            (response.data as any)?.error ||
            parsed ||
            response.error.message ||
            "Error en nfc-clock";
          throw new Error(typeof serverMessage === "string" ? serverMessage : String(serverMessage));
        }
        const data = (response.data || {}) as Record<string, unknown>;
        if (data.error && typeof data.error === "string") {
          throw new Error(data.error);
        }
        if (data.ok === false && typeof data.message === "string") {
          throw new Error(data.message);
        }
        const name = pickEmployeeName(data);
        if (pickActionOut(data)) {
          setDisplay({ kind: "success_out", name });
        } else {
          setDisplay({ kind: "success_in", name });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : typeof err === "string" ? err : "No se pudo registrar el fichaje.";
        setDisplay({ kind: "error", message: msg });
      } finally {
        inFlightRef.current = false;
      }
    },
    [isPointIdValid, normalizedPointId]
  );

  useEffect(() => {
    if (!isPointIdValid) return;

    const handler = (e: KeyboardEvent) => {
      const phase = displayRef.current.kind;
      if (phase === "success_in" || phase === "success_out" || phase === "error") return;
      if (inFlightRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        const raw = bufferRef.current;
        bufferRef.current = "";
        if (!raw.trim()) return;
        void submitUid(raw);
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        bufferRef.current += e.key;
        setDisplay((prev) => (prev.kind === "waiting" ? { kind: "scanning" } : prev));
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isPointIdValid, submitUid]);

  const timeLabel = useMemo(
    () =>
      now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  );
  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [now]
  );

  if (!isPointIdValid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center shadow-xl">
          <p className="text-4xl mb-3">⚠️</p>
          <h1 className="text-xl font-semibold text-amber-50">Enlace no válido</h1>
          <p className="text-sm text-amber-100/90 mt-2">
            El identificador del terminal NFC no es un UUID válido. Comprueba la URL o escanea de nuevo el código del
            punto de fichaje.
          </p>
        </div>
      </div>
    );
  }

  const renderBody = () => {
    switch (display.kind) {
      case "waiting":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-6xl" aria-hidden>
              📡
            </span>
            <p className="text-xl sm:text-2xl font-medium text-slate-100">Acerca la tarjeta</p>
            <p className="text-sm text-slate-400 max-w-md">El lector USB enviará el código de la tarjeta automáticamente.</p>
          </div>
        );
      case "scanning":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-6xl animate-pulse" aria-hidden>
              ⏳
            </span>
            <p className="text-xl sm:text-2xl font-medium text-slate-100">Procesando…</p>
          </div>
        );
      case "success_in":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-6xl" aria-hidden>
              ✅
            </span>
            <p className="text-2xl sm:text-3xl font-semibold text-emerald-400">{display.name}</p>
            <p className="text-lg text-emerald-300/90">Entrada registrada</p>
          </div>
        );
      case "success_out":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-6xl" aria-hidden>
              👋
            </span>
            <p className="text-2xl sm:text-3xl font-semibold text-rose-400">{display.name}</p>
            <p className="text-lg text-rose-300/90">Salida registrada</p>
          </div>
        );
      case "error":
        return (
          <div className="flex flex-col items-center gap-4 text-center px-2">
            <span className="text-6xl" aria-hidden>
              ⚠️
            </span>
            <p className="text-lg text-amber-100 max-w-md">{display.message}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div
          className={cn(
            "w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur min-h-[280px] flex flex-col items-center justify-center transition-all",
            display.kind === "scanning" && "ring-2 ring-white/20"
          )}
        >
          {renderBody()}
        </div>
      </div>
      <footer className="pb-10 text-center space-y-1">
        <p className="text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight">{timeLabel}</p>
        <p className="text-sm text-slate-400 capitalize">{dateLabel}</p>
        <p className="text-xs text-slate-500 pt-4">Fichaje NFC · GTiQ</p>
      </footer>
    </div>
  );
};

export default NfcClockPage;
