import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Integridad del registro.
 *
 * Cada corrección o borrado de un fichaje queda en un histórico encadenado:
 * cada movimiento lleva la huella del anterior. Si alguien alterase una
 * fila, la cadena se rompe a partir de ahí. Esto lo comprueba y lo enseña,
 * que es lo que hay que poder demostrar ante una inspección.
 */

interface ChainStatus {
  ok: boolean;
  checked: number;
  total: number;
  first_broken_seq: number | null;
  verified_at: string;
}

const RegistryIntegrityCard = () => {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("verify_event_revisions_chain" as never);
    if (error) {
      // La migración de la cadena todavía no está aplicada.
      setUnavailable(true);
      setStatus(null);
    } else {
      setUnavailable(false);
      setStatus(data as unknown as ChainStatus);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (unavailable) return null;

  const ok = status?.ok === true;

  return (
    <Card className="glass-card p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {loading ? (
          <Loader2 className="w-5 h-5 mt-0.5 animate-spin text-muted-foreground shrink-0" />
        ) : ok ? (
          <ShieldCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" />
        ) : (
          <ShieldAlert className="w-5 h-5 mt-0.5 text-destructive shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-medium">Integridad del registro</p>
          {loading && <p className="text-sm text-muted-foreground">Comprobando la cadena de cambios…</p>}
          {!loading && status && ok && (
            <p className="text-sm text-muted-foreground">
              {status.total.toLocaleString("es-ES")} cambios encadenados y sin alteraciones. Cada corrección de un
              fichaje queda registrada con su autor y su motivo.
            </p>
          )}
          {!loading && status && !ok && (
            <p className="text-sm text-destructive">
              La cadena se rompe en el movimiento {status.first_broken_seq}. Alguien ha modificado el histórico fuera
              de la aplicación. Avisa antes de seguir.
            </p>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => void check()} disabled={loading} aria-label="Comprobar">
        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
      </Button>
    </Card>
  );
};

export default RegistryIntegrityCard;
