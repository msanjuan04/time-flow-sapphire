import { supabase } from "@/integrations/supabase/client";

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
  /** Server response data when ok=true and not queued */
  data?: any;
  error?: any;
  queuedItem?: QueuedNfcEvent;
}

const invokeNfcRpc = async (
  companyId: string,
  rawUid: string,
  clientEventTime?: string
): Promise<{ data: any; error: any }> => {
  return supabase.rpc("nfc_kiosk_clock" as any, {
    p_company_id: companyId,
    p_raw_uid: rawUid,
    p_event_time: clientEventTime ?? null,
  } as any);
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
    const { data, error } = await invokeNfcRpc(
      companyId,
      rawUid,
      new Date().toISOString()
    );
    if (error) {
      // Distinguir errores de red (sin status) de errores de validación.
      const looksLikeNetwork =
        !error?.code &&
        (error?.message?.includes("Failed to fetch") ||
          error?.message?.includes("NetworkError") ||
          error?.message?.includes("network"));
      if (looksLikeNetwork) {
        const item = enqueueNfcEvent(companyId, rawUid);
        return { ok: true, queued: true, queuedItem: item, error };
      }
      return { ok: false, queued: false, error };
    }
    return { ok: true, queued: false, data };
  } catch (err) {
    // Excepción de red (fetch directo)
    const item = enqueueNfcEvent(companyId, rawUid);
    return { ok: true, queued: true, queuedItem: item, error: err };
  }
};

/**
 * Tries to flush the offline queue. Items that fail with a network error stay
 * in the queue. Items that fail with a server validation error are dropped
 * after 5 attempts to avoid infinite loops.
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
      const { data, error } = await invokeNfcRpc(
        item.companyId,
        item.rawUid,
        item.clientEventTime
      );
      if (error) {
        const attempts = item.attempts + 1;
        if (attempts >= 5) {
          removeFromQueue(item.id);
        } else {
          updateInQueue(item.id, {
            attempts,
            lastError: String(error?.message || error),
          });
        }
        continue;
      }
      // Even if RPC returned ok=false (e.g. unknown card), drop it after a
      // few attempts so it doesn't block the queue forever.
      if (data?.ok === false) {
        const attempts = item.attempts + 1;
        if (attempts >= 3) {
          removeFromQueue(item.id);
        } else {
          updateInQueue(item.id, {
            attempts,
            lastError: data?.error || "rpc_returned_false",
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

  return { flushed, remaining: readNfcQueue().length };
};
