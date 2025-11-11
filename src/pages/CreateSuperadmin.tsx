import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSuperadminAccount } from "@/lib/createSuperadmin";
import { useToast } from "@/hooks/use-toast";

export default function CreateSuperadmin() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { error } = await createSuperadminAccount(
        "gnerai@gneraitiq.com",
        "Gnerai241297",
        "Gnerai Admin"
      );

      if (error) {
        toast({
          title: "Error",
          description: error.message || "No se pudo crear la cuenta",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cuenta creada",
          description: "La cuenta de superadmin ha sido creada exitosamente",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Ocurrió un error al crear la cuenta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Crear Cuenta Superadmin</h1>
        <p className="text-muted-foreground">
          Email: gnerai@gneraitiq.com
        </p>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Creando..." : "Crear Superadmin"}
        </Button>
      </div>
    </div>
  );
}
