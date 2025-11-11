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

const ACTIVE_COMPANY_KEY = "active_company_id";

export const useMembership = () => {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
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
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching memberships:", error);
        setLoading(false);
        return;
      }

      const membershipsList = (data || []) as any[];
      setMemberships(membershipsList);

      // Get stored company or use first one
      const storedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
      let active = membershipsList.find(m => m.company_id === storedCompanyId);
      
      if (!active && membershipsList.length > 0) {
        active = membershipsList[0];
        localStorage.setItem(ACTIVE_COMPANY_KEY, active.company_id);
      }

      setActiveMembership(active || null);
      setLoading(false);
    };

    fetchMemberships();
  }, [user]);

  const switchCompany = (companyId: string) => {
    const newMembership = memberships.find(m => m.company_id === companyId);
    if (newMembership) {
      setActiveMembership(newMembership);
      localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    }
  };

  return {
    membership: activeMembership,
    memberships,
    role: activeMembership?.role,
    companyId: activeMembership?.company_id,
    loading,
    switchCompany,
    hasMultipleCompanies: memberships.length > 1,
  };
};
