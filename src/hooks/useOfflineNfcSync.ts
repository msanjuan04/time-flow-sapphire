import { useEffect, useState, useCallback } from "react";
import {
  flushNfcQueue,
  isNfcOnline,
  readNfcQueue,
  type QueuedNfcEvent,
} from "@/lib/offlineNfcQueue";

interface UseOfflineNfcSyncResult {
  pending: QueuedNfcEvent[];
  online: boolean;
  flushing: boolean;
  /** Manually trigger a flush (e.g. from a "Sync now" button) */
  flushNow: () => Promise<void>;
}

/**
 * Reactive hook that:
 *  - Tracks the current offline NFC queue (pending events)
 *  - Listens to `online`/`offline` browser events
 *  - Auto-flushes the queue when connection returns
 *  - Periodically retries every 30s while online if queue is non-empty
 */
export function useOfflineNfcSync(): UseOfflineNfcSyncResult {
  const [pending, setPending] = useState<QueuedNfcEvent[]>(() => readNfcQueue());
  const [online, setOnline] = useState<boolean>(() => isNfcOnline());
  const [flushing, setFlushing] = useState(false);

  const refreshQueue = useCallback(() => {
    setPending(readNfcQueue());
  }, []);

  const flushNow = useCallback(async () => {
    if (flushing) return;
    if (!isNfcOnline()) return;
    setFlushing(true);
    try {
      await flushNfcQueue();
    } finally {
      refreshQueue();
      setFlushing(false);
    }
  }, [flushing, refreshQueue]);

  // Listen to online/offline state
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flushNow();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushNow]);

  // Listen to in-app changes (enqueues/removals)
  useEffect(() => {
    const onChange = () => refreshQueue();
    window.addEventListener("offline-nfc-queue-changed", onChange as EventListener);
    return () =>
      window.removeEventListener(
        "offline-nfc-queue-changed",
        onChange as EventListener
      );
  }, [refreshQueue]);

  // Initial flush on mount + retry every 30s if items pending
  useEffect(() => {
    void flushNow();
    const interval = window.setInterval(() => {
      if (readNfcQueue().length > 0 && isNfcOnline()) {
        void flushNow();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [flushNow]);

  return { pending, online, flushing, flushNow };
}
