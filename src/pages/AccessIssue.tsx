import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const messages: Record<string, { title: string; description: string }> = {
  "no-membership": {
    title: "Sin empresa asignada",
    description: "Tu cuenta no está vinculada a ninguna empresa. Contacta con el administrador para que te añada.",
  },
  "no-company": {
    title: "Empresa no disponible",
    description: "No pudimos recuperar los datos de tu empresa. Intenta de nuevo o contacta con soporte.",
  },
  "no-role": {
    title: "Rol no configurado",
    description: "Tu rol no tiene una vista asignada todavía. Contacta con el administrador.",
  },
  "invalid-session": {
    title: "Sesión inválida",
    description: "No pudimos restaurar tu sesión. Vuelve a iniciar sesión.",
  },
};

const AccessIssue = () => {
  const [params] = useSearchParams();
  const reason = params.get("reason") || "invalid-session";
  const navigate = useNavigate();

  const content = useMemo(() => {
    return messages[reason] ?? messages["invalid-session"];
  }, [reason]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-md w-full glass-card rounded-2xl p-8 space-y-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-muted-foreground">{content.description}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate("/auth")} className="w-full">
            Volver a iniciar sesión
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessIssue;
