import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { RecoverAccessDialog } from "@/components/RecoverAccessDialog";

const Auth = () => {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const { signInWithCode, user, loading } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Iniciar sesión • GTiQ");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      toast.error("Introduce un código de 6 dígitos");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await signInWithCode(code);
      if (error) {
        const message = error === "INVALID_CODE"
          ? "Código incorrecto o expirado"
          : error === "INVALID_CODE_FORMAT"
            ? "El código debe tener 6 dígitos"
            : error === "SESSION_VERIFICATION_FAILED"
              ? "No se pudo verificar la sesión. Intenta de nuevo."
            : error === "SESSION_SET_FAILED"
              ? "No se pudo establecer la sesión. Intenta de nuevo."
            : error === "NO_SESSION_TOKENS"
              ? "No se recibieron tokens de sesión. Intenta de nuevo."
            : error === "NETWORK_ERROR"
              ? "Error de conexión. Verifica tu internet e intenta de nuevo."
            : "No se pudo crear la sesión. Intenta de nuevo.";
        toast.error(message);
        setSubmitting(false);
        return;
      }

      toast.success("¡Bienvenido de nuevo!");
      // La navegación se maneja en AuthContext
    } catch (error) {
      console.error("Error inesperado en login:", error);
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <img 
                src="/logo.png" 
                alt="GTiQ Logo" 
                className="w-24 h-24 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold">GTiQ</h1>
            <p className="text-muted-foreground">
              Introduce tu código personal de 6 dígitos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Código de acceso</p>
              <InputOTP
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, ""))}
                maxLength={6}
                autoFocus
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, index) => (
                    <InputOTPSlot key={index} index={index} className="text-xl" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full smooth-transition"
              disabled={submitting || code.length !== 6}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setRecoverOpen(true)}
            >
              ¿No tienes tu código? Recuperar acceso
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Al iniciar sesión aceptas nuestras políticas. Más info en
            <a href="/legal" className="ml-1 underline hover:text-primary">Legal y privacidad</a>.
          </p>
        </div>
      </div>
      <RecoverAccessDialog open={recoverOpen} onOpenChange={setRecoverOpen} />
    </div>
  );
};

export default Auth;
