import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IMPERSONATION_KEY = "superadmin_impersonation";

interface ImpersonationData {
  superadmin_id: string;
  company_id: string;
  company_name: string;
  as_role: "admin" | "manager" | "worker" | null;
  started_at: string;
}

interface UseImpersonationReturn {
  isImpersonating: boolean;
  impersonationData: ImpersonationData | null;
  startImpersonation: (companyId: string, asRole?: "admin" | "manager" | "worker") => Promise<void>;
  stopImpersonation: () => Promise<void>;
  loading: boolean;
}

export const useImpersonation = (): UseImpersonationReturn => {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load impersonation state on mount
  useEffect(() => {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setImpersonationData(data);
      } catch (error) {
        console.error("Failed to parse impersonation data:", error);
        localStorage.removeItem(IMPERSONATION_KEY);
      }
    }
  }, []);

  const startImpersonation = useCallback(
    async (companyId: string, asRole?: "admin" | "manager" | "worker") => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-impersonate", {
          body: {
            company_id: companyId,
            as_role: asRole || null,
          },
        });

        if (error) {
          console.error("Impersonation error:", error);
          toast.error("Error al iniciar impersonación");
          return;
        }

        // Store impersonation data
        const impData = data.data;
        localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(impData));
        setImpersonationData(impData);

        toast.success(`Impersonando ${impData.company_name}`, {
          description: asRole ? `Como ${asRole}` : "Con acceso completo",
        });

        // Reload to apply impersonation
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      } catch (error) {
        console.error("Failed to start impersonation:", error);
        toast.error("Error al iniciar impersonación");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const stopImpersonation = useCallback(async () => {
    setLoading(true);
    try {
      const currentData = impersonationData;

      const { error } = await supabase.functions.invoke("admin-stop-impersonate", {
        body: {
          company_id: currentData?.company_id || null,
        },
      });

      if (error) {
        console.error("Stop impersonation error:", error);
        toast.error("Error al detener impersonación");
        return;
      }

      // Clear impersonation data
      localStorage.removeItem(IMPERSONATION_KEY);
      setImpersonationData(null);

      toast.success("Impersonación detenida");

      // Reload to restore normal view
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
      toast.error("Error al detener impersonación");
    } finally {
      setLoading(false);
    }
  }, [impersonationData]);

  return {
    isImpersonating: !!impersonationData,
    impersonationData,
    startImpersonation,
    stopImpersonation,
    loading,
  };
};
