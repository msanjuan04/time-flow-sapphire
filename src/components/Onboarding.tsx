import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ 
          name: companyName,
          owner_user_id: user?.id,
          status: 'active'
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create membership as owner
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: user?.id,
          company_id: company.id,
          role: "owner",
        });

      if (membershipError) throw membershipError;

      toast.success("¡Empresa creada con éxito!");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Error al crear empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="glass-card p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">¡Bienvenido a TimeTrack!</h1>
          <p className="text-muted-foreground">
            Crea tu empresa para comenzar a gestionar el control horario
          </p>
        </div>

        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de la empresa</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Mi Empresa S.L."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="glass-card"
            />
          </div>

          <Button
            type="submit"
            className="w-full smooth-transition"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear empresa
          </Button>
        </form>

        <div className="text-xs text-center text-muted-foreground">
          Serás asignado como propietario (Owner) de la empresa
        </div>
      </Card>
    </div>
  );
};

export default Onboarding;
