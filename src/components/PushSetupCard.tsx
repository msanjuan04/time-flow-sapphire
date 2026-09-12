import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Download, Loader2, Share } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  disablePush,
  enablePush,
  getPushState,
  isIos,
  isStandalone,
  onInstallAvailability,
  promptInstall,
  sendTestPush,
  type PushState,
} from "@/lib/pwa";

/**
 * Avisos de fichaje e instalación de la app.
 *
 * El aviso que importa es el de "te falta fichar la salida": evita la mayor
 * parte de las correcciones manuales. En iPhone, el navegador solo permite
 * avisos si la app está añadida a la pantalla de inicio, así que ahí se
 * explica cómo hacerlo.
 */

interface Props {
  companyId?: string | null;
}

const PushSetupCard = ({ companyId }: Props) => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    void refresh();
    return onInstallAvailability(setInstallAvailable);
  }, [refresh]);

  if (state === null || state === "unsupported" || state === "unconfigured") return null;

  const needsInstallOnIos = isIos() && !isStandalone();

  const activar = async () => {
    setBusy(true);
    try {
      const next = await enablePush(companyId);
      setState(next);
      if (next === "on") {
        toast.success("Avisos activados en este dispositivo");
      } else if (next === "denied") {
        toast.error("Has bloqueado los avisos", {
          description: "Actívalos en los ajustes del navegador para este sitio.",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron activar los avisos");
    } finally {
      setBusy(false);
    }
  };

  const desactivar = async () => {
    setBusy(true);
    try {
      setState(await disablePush());
      toast.success("Avisos desactivados en este dispositivo");
    } finally {
      setBusy(false);
    }
  };

  const probar = async () => {
    setBusy(true);
    try {
      await sendTestPush();
      toast.success("Aviso enviado", { description: "Debería aparecerte en unos segundos." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {state === "on" ? (
          <Bell className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">Avisos de fichaje</p>
          <p className="text-sm text-muted-foreground">
            {state === "on"
              ? "Este dispositivo te avisará si acaba tu turno y no has fichado la salida."
              : state === "denied"
                ? "Has bloqueado los avisos para este sitio. Actívalos desde los ajustes del navegador."
                : "Recibe un aviso si olvidas fichar la entrada o la salida."}
          </p>
        </div>
      </div>

      {needsInstallOnIos && state !== "on" && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Share className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          En iPhone, primero añade GTiQ a la pantalla de inicio: pulsa Compartir y luego "Añadir a pantalla de inicio".
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {state === "on" ? (
          <>
            <Button variant="outline" size="sm" onClick={probar} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar prueba
            </Button>
            <Button variant="ghost" size="sm" onClick={desactivar} disabled={busy}>
              Desactivar
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={activar} disabled={busy || state === "denied"}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Activar avisos
          </Button>
        )}

        {installAvailable && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const installed = await promptInstall();
              if (installed) toast.success("GTiQ instalada");
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Instalar la app
          </Button>
        )}
      </div>
    </Card>
  );
};

export default PushSetupCard;
