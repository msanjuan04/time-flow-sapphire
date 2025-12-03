import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "owner" | "admin" | "manager" | "worker";

interface Membership {
  id: string;
  role: UserRole;
  company_id: string;
  company?: {
    id: string;
    name: string;
    status?: string | null;
    plan?: string | null;
    logo_url?: string | null;
  } | null;
}

const ACTIVE_COMPANY_KEY = "active_company_id";
const IMPERSONATION_KEY = "superadmin_impersonation";

export const useMembership = () => {
  const { user, memberships: cachedMemberships } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateActiveMembership = (list: Membership[]) => {
    const storedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
    let active = list.find((m) => m.company_id === storedCompanyId);

    if (!active && list.length > 0) {
      active = list[0];
      localStorage.setItem(ACTIVE_COMPANY_KEY, active.company_id);
    }

    setActiveMembership(active || null);
  };

  const fetchMembershipsFromSupabase = async (userId: string) => {
    const { data, error } = await supabase
      .from("memberships")
      .select(`
        id,
        role,
        company_id,
        company:companies(id, name, status, plan, logo_url)
      `)
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching memberships:", error);
      setMemberships([]);
      setActiveMembership(null);
      setLoading(false);
      return;
    }

    const membershipsList = (data || []) as Membership[];
    setMemberships(membershipsList);
    hydrateActiveMembership(membershipsList);
    setLoading(false);
  };

  useEffect(() => {
    const resolveMemberships = async () => {
      if (!user) {
        setMemberships([]);
        setActiveMembership(null);
        setLoading(false);
        return;
      }

      const cachedList = (cachedMemberships as Membership[]) || [];
      const hasCachedMemberships = cachedList.length > 0;
      // Si la compañía viene sin logo_url u otras props, forzamos refetch
      const cachedHasCompanyInfo = cachedList.every(
        (m) => !!m.company && Object.prototype.hasOwnProperty.call(m.company, "logo_url")
      );

      // First, try to use the memberships we already have in AuthContext
      if (hasCachedMemberships) {
        setMemberships(cachedList);
        hydrateActiveMembership(cachedList);
        setLoading(false);
        if (cachedHasCompanyInfo) {
          return;
        }
      }

      // Check for impersonation mode
      const impersonationStr = localStorage.getItem(IMPERSONATION_KEY);
      if (impersonationStr) {
        try {
          const impersonation = JSON.parse(impersonationStr);
          
          // Fetch company data for impersonated company
          const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("id, name")
            .eq("id", impersonation.company_id)
            .single();

          if (!companyError && companyData) {
            // Create a virtual membership for impersonation
            const virtualMembership: Membership = {
              id: `impersonate_${impersonation.company_id}`,
              role: impersonation.as_role || "admin",
              company_id: impersonation.company_id,
              company: {
                id: companyData.id,
                name: companyData.name,
              },
            };

            setMemberships([virtualMembership]);
            setActiveMembership(virtualMembership);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error loading impersonation:", error);
          localStorage.removeItem(IMPERSONATION_KEY);
        }
      }

      await fetchMembershipsFromSupabase(user.id);
    };

    resolveMemberships();
  }, [user, cachedMemberships]);

  // Rellena logo_url/otros campos si faltan en el membership activo
  useEffect(() => {
    const hydrateCompanyInfo = async () => {
      const active = activeMembership;
      if (!active || active.company?.logo_url) return;
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, status, plan, logo_url")
          .eq("id", active.company_id)
          .maybeSingle();
        if (error || !data) return;
        const updated = memberships.map((m) =>
          m.company_id === active.company_id
            ? { ...m, company: { ...(m.company ?? {}), ...data } }
            : m
        );
        setMemberships(updated);
        const refreshedActive = updated.find((m) => m.company_id === active.company_id) ?? null;
        setActiveMembership(refreshedActive);
      } catch (err) {
        console.error("hydrateCompanyInfo error", err);
      }
    };
    hydrateCompanyInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company_id, activeMembership?.company?.logo_url]);

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
