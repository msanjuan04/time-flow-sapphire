import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const Auth = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithCode, user } = useAuth();
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

    setLoading(true);

    try {
      const { error } = await signInWithCode(code);
      if (error) {
        toast.error(error.message || "Código incorrecto o usuario no encontrado");
        return;
      }
      toast.success("¡Bienvenido de nuevo!");
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setLoading(false);
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
            <div className="space-y-2">
              <Label htmlFor="code">Código de acceso</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="glass-card"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full smooth-transition"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            Al iniciar sesión aceptas nuestras políticas. Más info en
            <a href="/legal" className="ml-1 underline hover:text-primary">Legal y privacidad</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
