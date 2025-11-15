import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Introduce un correo válido"),
});

interface RecoverAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecoverAccessDialog = ({ open, onOpenChange }: RecoverAccessDialogProps) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setEmail("");
      setSubmitting(false);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      schema.parse({ email });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        setError(validationError.issues[0]?.message || "Correo inválido");
      }
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("request-login-code", {
        body: { email },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setSuccessMessage(data?.message ?? "Si el correo existe te enviaremos un código nuevo.");
    } catch (fnErr) {
      const message =
        fnErr instanceof Error ? fnErr.message : "No pudimos solicitar un nuevo código";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Recuperar acceso</DialogTitle>
          <DialogDescription>
            Te enviaremos un nuevo código temporal a tu correo corporativo.
          </DialogDescription>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4">
            <Alert className="border-primary/40 bg-primary/5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <AlertTitle>Solicitud recibida</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
            <Button onClick={() => handleClose(false)} className="w-full">
              Volver al login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recover-email">Correo registrado</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="recover-email"
                  type="email"
                  className="pl-9"
                  placeholder="empleado@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Utiliza el mismo correo que te proporcionó tu empresa.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>No pudimos enviar tu código</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Solicitar nuevo código
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
