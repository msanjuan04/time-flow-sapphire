import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SuperadminStatus {
  isSuperadmin: boolean;
  loading: boolean;
}

export const useSuperadmin = (): SuperadminStatus => {
  const { user } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSuperadmin = async () => {
      if (!user) {
        setIsSuperadmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_superadmin");

        if (error) {
          console.error("Error checking superadmin status:", error);
          setIsSuperadmin(false);
        } else {
          setIsSuperadmin(data || false);
        }
      } catch (error) {
        console.error("Error checking superadmin status:", error);
        setIsSuperadmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkSuperadmin();
  }, [user]);

  return { isSuperadmin, loading };
};
