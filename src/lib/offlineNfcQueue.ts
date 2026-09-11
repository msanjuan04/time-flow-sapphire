import { supabase } from "@/integrations/supabase/client";

/**
 * Fichaje NFC del kiosco por empresa.
 *
 * Desde 2026-09-11 el kiosco NFC pasa por la MISMA función de servidor que
 * el móvil, la web y el kiosco por PIN (`clock`), enviando la tarjeta como
 * credencial. Así todas las reglas (bajas, horario, festivos, límites de
 * horas, auto-cierre, incidencias) se aplican igual por cualquier vía.
 * La antigua RPC `nfc_kiosk_clock` queda solo para comprobar la empresa.
 *
 * Si no hay conexión, la pasada se guarda con su hora real y se reenvía
 * cuando vuelve la red.
 */

const STORAGE_KEY = "offline_nfc_queue_v1";

export interface QueuedNfcEvent {
  id: string;
  enqueuedAt: string;
  clientEventTime: string;
  companyId: string;
  rawUid: string;
  attempts: number;
  lastError?: string;
}

/** Respuesta normalizada que consume la pantalla del kiosco. */
export interface NfcClockPayload {
  ok: boolean;
  action?: "clock_in" | "clock_out";
  nombre_completo?: string | null;
  /** Códigos conocidos: unknown_card | on_sick_leave | company_not_found | server_error */
  error?: string;
  message?: string;
}

const safeParse = (raw: string | null): QueuedNfcEvent[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readNfcQueue = (): QueuedNfcEvent[] => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeQueue = (queue: QueuedNfcEvent[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("offline-nfc-queue-changed"));
};

export const enqueueNfcEvent = (
  companyId: string,
  rawUid: string
): QueuedNfcEvent => {
  const item: QueuedNfcEvent = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    enqueuedAt: new Date().toISOString(),
    clientEventTime: new Date().toISOString(),
    companyId,
    rawUid,
    attempts: 0,
  };
  const queue = readNfcQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
};

const removeFromQueue = (id: string) => {
  writeQueue(readNfcQueue().filter((item) => item.id !== id));
};

const updateInQueue = (id: string, patch: Partial<QueuedNfcEvent>) => {
  writeQueue(
    readNfcQueue().map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
};

export const isNfcOnline = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
};

export interface NfcInvokeResult {
  ok: boolean;
  queued: boolean;
  /** Server response (normalized) when ok=true and not queued */
  data?: NfcClockPayload;
  error?: unknown;
  queuedItem?: QueuedNfcEvent;
}

/** Mapa de códigos de la función `clock` a los que entiende el kiosco. */
const mapServerError = (code: string | undefined): string => {
  switch (code) {
    case "CARD_NOT_REGISTERED":
    case "CARD_INVALID":
    case "EMPLOYEE_INACTIVE":
    case "Usuario sin empresa asignada":
      return "unknown_card";
    case "ON_SICK_LEAVE":
      return "on_sick_leave";
    case "COMPANY_REQUIRED":
    case "Empresa suspendida. Contacta con administración.":
      return "company_not_found";
    default:
      return "server_error";
  }
};

const readErrorBody = async (
  error: unknown
): Promise<{ error?: string; message?: string; employee_name?: string | null } | null> => {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.clone !== "function") return null;
  try {
    return (await context.clone().json()) as { error?: string; message?: string; employee_name?: string | null };
  } catch {
    return null;
  }
};

const looksLikeNetworkError = (error: unknown): boolean => {
  const name = (error as { name?: string } | null)?.name || "";
  const message = (error as { message?: string } | null)?.message || "";
  return (
    name === "FunctionsFetchError" ||
    /Failed to fetch|NetworkError|network|Load failed/i.test(message)
  );
};

/**
 * Llama a `clock` con la tarjeta como credencial. Devuelve la respuesta ya
 * normalizada, o lanza un error de red (para que quien llama decida encolar).
 */
const invokeNfcClock = async (
  companyId: string,
  rawUid: string,
  clientEventTime?: string
): Promise<NfcClockPayload> => {
  const { data, error } = await supabase.functions.invoke("clock", {
    body: {
      action: "auto",
      source: "nfc",
      company_id: companyId,
      card_uid: rawUid,
      client_event_time: clientEventTime ?? new Date().toISOString(),
    },
  });

  if (error) {
    const body =
      (data as { error?: string; message?: string; employee_name?: string | null } | null) ||
      (await readErrorBody(error));
    if (!body && looksLikeNetworkError(error)) throw error;
    const code = body?.error;
    return {
      ok: false,
      error: mapServerError(code),
      message: body?.message || (typeof code === "string" ? code : undefined),
      nombre_completo: body?.employee_name ?? null,
    };
  }

  const payload = (data || {}) as {
    success?: boolean;
    action?: string;
    employee_name?: string | null;
    error?: string;
    message?: string;
  };
  if (payload.success === false) {
    return { ok: false, error: mapServerError(payload.error), message: payload.message || payload.error };
  }
  return {
    ok: true,
    action: payload.action === "out" ? "clock_out" : "clock_in",
    nombre_completo: payload.employee_name ?? null,
  };
};

/**
 * Tries to register an NFC clock event. If we are offline or the request
 * fails with a network error, the event is enqueued locally and will be
 * synced later by flushNfcQueue.
 *
 * Note: validation errors from the server (unknown_card, etc.) are NOT
 * queued — they bubble up immediately so the kiosko shows the right error.
 */
export const invokeNfcWithQueue = async (
  companyId: string,
  rawUid: string
): Promise<NfcInvokeResult> => {
  if (!isNfcOnline()) {
    const item = enqueueNfcEvent(companyId, rawUid);
    return { ok: true, queued: true, queuedItem: item };
  }

  try {
    const data = await invokeNfcClock(companyId, rawUid, new Date().toISOString());
    return { ok: true, queued: false, data };
  } catch (err) {
    // Excepción de red: guardamos la pasada para reenviarla
    const item = enqueueNfcEvent(companyId, rawUid);
    return { ok: true, queued: true, queuedItem: item, error: err };
  }
};

/**
 * Tries to flush the offline queue. Items that fail with a network error stay
 * in the queue. Items rejected by the server are dropped after 3 attempts to
 * avoid infinite loops.
 */
export const flushNfcQueue = async (): Promise<{
  flushed: number;
  remaining: number;
}> => {
  if (!isNfcOnline()) return { flushed: 0, remaining: readNfcQueue().length };

  const queue = readNfcQueue();
  let flushed = 0;

  for (const item of queue) {
    try {
      const data = await invokeNfcClock(item.companyId, item.rawUid, item.clientEventTime);
      if (!data.ok) {
        const attempts = item.attempts + 1;
        if (attempts >= 3) {
          removeFromQueue(item.id);
        } else {
          updateInQueue(item.id, { attempts, lastError: data.error || "rejected" });
        }
        continue;
      }
      removeFromQueue(item.id);
      flushed += 1;
    } catch {
      // Network error — stop flushing, keep items for next attempt
      break;
    }
  }

  return { flushed, remaining: readNfcQueue().length };
};
