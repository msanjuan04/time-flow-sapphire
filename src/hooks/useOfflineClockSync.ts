import { useEffect, useState } from "react";
import { flushClockQueue, isOnline, readQueue } from "@/lib/offlineClockQueue";

interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastFlushedAt: string | null;
}

const SYNC_INTERVAL_MS = 30_000;

export const useOfflineClockSync = (): SyncState => {
  const [state, setState] = useState<SyncState>(() => ({
    online: isOnline(),
    pending: readQueue().length,
    syncing: false,
    lastFlushedAt: null,
  }));

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const refreshPending = () => {
      setState((prev) => ({ ...prev, pending: readQueue().length }));
    };

    const tryFlush = async () => {
      if (cancelled) return;
      if (!isOnline()) return;
      if (readQueue().length === 0) return;
      setState((prev) => ({ ...prev, syncing: true }));
      try {
        await flushClockQueue();
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            syncing: false,
            pending: readQueue().length,
            lastFlushedAt: new Date().toISOString(),
          }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, syncing: false }));
        }
      }
    };

    const handleOnline = () => {
      setState((prev) => ({ ...prev, online: true }));
      void tryFlush();
    };
    const handleOffline = () => {
      setState((prev) => ({ ...prev, online: false }));
    };
    const handleQueueChanged = () => {
      refreshPending();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(
      "offline-clock-queue-changed",
      handleQueueChanged as EventListener
    );

    // Try to flush right away on mount and then on a slow interval
    void tryFlush();
    intervalId = window.setInterval(tryFlush, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "offline-clock-queue-changed",
        handleQueueChanged as EventListener
      );
    };
  }, []);

  return state;
};
