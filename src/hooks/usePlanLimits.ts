import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "./useMembership";

interface PlanLimits {
  plan: "free" | "pro" | "enterprise";
  maxEmployees: number;
  currentEmployees: number;
  canInviteMore: boolean;
  isLoading: boolean;
}

const PLAN_LIMITS = {
  free: 5,
  pro: 50,
  enterprise: Infinity,
};

export const usePlanLimits = () => {
  const { companyId } = useMembership();
  const [limits, setLimits] = useState<PlanLimits>({
    plan: "free",
    maxEmployees: 5,
    currentEmployees: 0,
    canInviteMore: true,
    isLoading: true,
  });

  useEffect(() => {
    if (companyId) {
      fetchPlanLimits();
    }
  }, [companyId]);

  const fetchPlanLimits = async () => {
    try {
      // Get company plan
      const { data: company } = await supabase
        .from("companies")
        .select("plan")
        .eq("id", companyId)
        .single();

      const plan = (company?.plan as "free" | "pro" | "enterprise") || "free";
      const maxEmployees = PLAN_LIMITS[plan];

      // Count current active employees
      const { count: currentCount } = await supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "worker");

      const currentEmployees = currentCount || 0;
      const canInviteMore = currentEmployees < maxEmployees;

      setLimits({
        plan,
        maxEmployees,
        currentEmployees,
        canInviteMore,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching plan limits:", error);
      setLimits((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return { ...limits, refetch: fetchPlanLimits };
};
