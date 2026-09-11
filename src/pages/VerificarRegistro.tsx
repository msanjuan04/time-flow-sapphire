import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CircleCheck, CircleX, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { extractFunctionErrorMessage } from "@/lib/offlineClockQueue";

/**
 * Confirmación del email de una solicitud de alta de empresa.
 * Llama a `verify-company-signup` con el token del enlace. Si la solicitud
 * ya estaba aprobada, muestra la empresa activa; si no, queda pendiente de
 * aprobación por un superadmin.
 *
 * Reconstruida el 2026-09-11 a partir del código desplegado en producción.
 */

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "verified"; companyName: string }
  | { kind: "approved"; companyName: string };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center p-5">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div
        className="relative rounded-3xl p-[1px] overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--border) / 0.4) 40%, hsl(var(--border) / 0.2))",
        }}
      >
        <div className="relative rounded-[calc(1.5rem-1px)] bg-background/85 backdrop-blur-xl p-8 text-center space-y-4">
          {children}
        </div>
      </div>
    </motion.div>
  </div>
);

const VerificarRegistroPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useDocumentTitle("Verificar email • GTiQ");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState({ kind: "error", message: "Falta el token de verificación." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-company-signup", {
          body: { token },
        });
        if (cancelled) return;
        if (error) {
          const message = await extractFunctionErrorMessage(error, data);
          setState({ kind: "error", message: message || "El enlace no es válido o ha caducado." });
          return;
        }
        const payload = (data || {}) as { status?: string; company_name?: string };
        const companyName = payload.company_name || "tu empresa";
        setState(
          payload.status === "approved"
            ? { kind: "approved", companyName }
            : { kind: "verified", companyName }
        );
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Error al verificar." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (state.kind === "loading") {
    return (
      <Shell>
        <Loader2 className="mx-auto w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando tu email…</p>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <CircleX className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Enlace no válido</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button variant="ghost" onClick={() => navigate("/registro")}>
          Registrar de nuevo
        </Button>
      </Shell>
    );
  }

  if (state.kind === "approved") {
    return (
      <Shell>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CircleCheck className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Empresa activa</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{state.companyName}</span> ya está activa. Revisa tu
          email: te hemos enviado tu código de acceso.
        </p>
        <Button onClick={() => navigate("/auth")}>Entrar con mi código</Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Clock className="w-6 h-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Email confirmado</h1>
      <p className="text-sm text-muted-foreground">
        Tu solicitud para <span className="font-medium text-foreground">{state.companyName}</span> está
        pendiente de aprobación. Te avisaremos por email en cuanto esté activa.
      </p>
      <Button variant="ghost" onClick={() => navigate("/auth")}>
        Volver al inicio
      </Button>
    </Shell>
  );
};

export default VerificarRegistroPage;
