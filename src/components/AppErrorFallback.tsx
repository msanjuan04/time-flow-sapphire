import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error?: unknown;
  resetError?: () => void;
  eventId?: string | null;
}

/**
 * Pantalla que ve el usuario cuando algo rompe el render. Sustituye la
 * pantalla en blanco. Ofrece recargar o volver al inicio y muestra un
 * identificador de incidencia si hay monitorización activa.
 */
const AppErrorFallback = ({ error, resetError, eventId }: Props) => {
  const message = error instanceof Error ? error.message : null;

  const reload = () => {
    if (resetError) resetError();
    window.location.reload();
  };

  const goHome = () => {
    if (resetError) resetError();
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Algo ha fallado</h1>
          <p className="text-sm text-muted-foreground">
            No se ha perdido ningún fichaje ya registrado. Recarga la página para continuar. Si vuelve a
            pasar, avisa a tu responsable.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={reload} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </Button>
          <Button onClick={goHome} variant="outline" className="w-full">
            <Home className="w-4 h-4 mr-2" />
            Ir al inicio
          </Button>
        </div>
        {(eventId || message) && (
          <p className="text-[11px] text-muted-foreground break-all">
            {eventId ? `Incidencia ${eventId}` : message}
          </p>
        )}
      </div>
    </div>
  );
};

export default AppErrorFallback;
