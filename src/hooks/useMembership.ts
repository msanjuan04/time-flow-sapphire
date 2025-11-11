import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "owner" | "admin" | "manager" | "worker";

interface Membership {
  id: string;
  role: UserRole;
  company_id: string;
  company: {
    id: string;
    name: string;
  };
}

export const useMembership = () => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembership = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("memberships")
        .select(`
          id,
          role,
          company_id,
          company:companies(id, name)
        `)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching membership:", error);
      } else {
        setMembership(data as any);
      }
      
      setLoading(false);
    };

    fetchMembership();
  }, [user]);

  return { membership, role: membership?.role, companyId: membership?.company_id, loading };
};
