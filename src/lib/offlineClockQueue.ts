import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "offline_clock_queue_v1";

export interface QueuedClockAction {
  id: string;
  enqueuedAt: string;
  clientEventTime: string;
  payload: {
    action: "in" | "out" | "break_start" | "break_end";
    user_id?: string;
    /** Kiosco por PIN: credencial del dispositivo, validada en servidor */
    device_pin?: string;
    device_id?: string;
    company_id?: string | null;
    source: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
  attempts: number;
  lastError?: string;
}

const safeParse = (raw: string | null): QueuedClockAction[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readQueue = (): QueuedClockAction[] => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeQueue = (queue: QueuedClockAction[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("offline-clock-queue-changed"));
};

export const enqueueClockAction = (
  payload: QueuedClockAction["payload"]
): QueuedClockAction => {
  const item: QueuedClockAction = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    enqueuedAt: new Date().toISOString(),
    clientEventTime: new Date().toISOString(),
    payload,
    attempts: 0,
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
};

const removeFromQueue = (id: string) => {
  writeQueue(readQueue().filter((item) => item.id !== id));
};

const updateInQueue = (id: string, patch: Partial<QueuedClockAction>) => {
  writeQueue(
    readQueue().map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
};

export const isOnline = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
};

export interface ClockInvokeOptions {
  payload: QueuedClockAction["payload"];
  /**
   * If true and the request fails (network down or fetch error), the action
   * gets enqueued for later sync instead of throwing. Defaults to true.
   */
  queueOnFailure?: boolean;
}

export interface ClockInvokeResult {
  ok: boolean;
  queued: boolean;
  data?: any;
  error?: any;
  queuedItem?: QueuedClockAction;
}

const invokeClockOnce = async (
  payload: QueuedClockAction["payload"] & { client_event_time?: string }
) => {
  return supabase.functions.invoke("clock", { body: payload });
};

/**
 * Extracts a human-readable message from a failed `functions.invoke` call.
 * Checks, in order: the parsed `data` body, the raw response attached to the
 * error (`error.context`), and finally the error message itself (ignoring the
 * generic "non-2xx status code" text). Returns null if nothing useful.
 */
export const extractFunctionErrorMessage = async (
  error: unknown,
  data?: unknown
): Promise<string | null> => {
  if (data && typeof data === "object") {
    const body = data as { error?: unknown; message?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (typeof body.message === "string" && body.message.trim()) return body.message;
  }
  if (typeof data === "string" && data.trim()) return data;

  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: unknown; message?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
      if (typeof body?.message === "string" && body.message.trim()) return body.message;
    } catch {
      // cuerpo no JSON: seguimos con el mensaje del error
    }
  }

  if (error instanceof Error && error.message && !/non-2xx/i.test(error.message)) {
    return error.message;
  }
  return null;
};

/**
 * Tries to call the `clock` edge function. If we are offline or the request
 * fails with a network error, the action is enqueued locally and will be
 * synced later by useOfflineClockSync.
 */
export const invokeClockWithQueue = async (
  options: ClockInvokeOptions
): Promise<ClockInvokeResult> => {
  const { payload, queueOnFailure = true } = options;

  if (!isOnline()) {
    const item = enqueueClockAction(payload);
    return { ok: true, queued: true, queuedItem: item };
  }

  try {
    const response = await invokeClockOnce({
      ...payload,
      client_event_time: new Date().toISOString(),
    });
    if (response.error) {
      // Server-side validation errors should bubble up — only queue on network failures
      return { ok: false, queued: false, error: response.error, data: response.data };
    }
    return { ok: true, queued: false, data: response.data };
  } catch (err) {
    if (queueOnFailure) {
      const item = enqueueClockAction(payload);
      return { ok: true, queued: true, queuedItem: item, error: err };
    }
    return { ok: false, queued: false, error: err };
  }
};

/**
 * Tries to flush the offline queue. Items that fail with a network error stay
 * in the queue. Items that fail with a server validation error are dropped
 * after 5 attempts to avoid infinite loops.
 */
export const flushClockQueue = async (): Promise<{
  flushed: number;
  remaining: number;
}> => {
  if (!isOnline()) return { flushed: 0, remaining: readQueue().length };

  const queue = readQueue();
  let flushed = 0;

  for (const item of queue) {
    try {
      const response = await invokeClockOnce({
        ...item.payload,
        client_event_time: item.clientEventTime,
      });
      if (response.error) {
        const attempts = item.attempts + 1;
        if (attempts >= 5) {
          removeFromQueue(item.id);
        } else {
          updateInQueue(item.id, {
            attempts,
            lastError: String(response.error?.message || response.error),
          });
        }
        continue;
      }
      removeFromQueue(item.id);
      flushed += 1;
    } catch (err) {
      // Network error — stop flushing, keep items for next attempt
      break;
    }
  }

  return { flushed, remaining: readQueue().length };
};
