import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useOfflineClockSync } from "@/hooks/useOfflineClockSync";

interface OfflineClockIndicatorProps {
  className?: string;
}

export const OfflineClockIndicator = ({ className }: OfflineClockIndicatorProps) => {
  const { online, pending, syncing } = useOfflineClockSync();

  if (online && pending === 0 && !syncing) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${
          className ?? ""
        }`}
      >
        <Wifi className="w-3.5 h-3.5" />
        En línea
      </div>
    );
  }

  if (!online) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-900 ${
          className ?? ""
        }`}
      >
        <WifiOff className="w-3.5 h-3.5" />
        Sin conexión · {pending} fichaje{pending === 1 ? "" : "s"} en cola
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-blue-100 text-blue-900 ${
        className ?? ""
      }`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
      Sincronizando · {pending} pendiente{pending === 1 ? "" : "s"}
    </div>
  );
};
