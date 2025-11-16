export type CompanyPlanId = "basic" | "empresa" | "pro" | "advanced" | "custom";

const PLAN_LIMITS: Record<CompanyPlanId, number | null> = {
  basic: 5,
  empresa: 10,
  pro: 20,
  advanced: 50,
  custom: null,
};

const LEGACY_MAP: Record<string, CompanyPlanId> = {
  free: "basic",
  enterprise: "advanced",
  pro: "pro",
};

export const normalizeCompanyPlan = (plan?: string | null): CompanyPlanId => {
  if (!plan) return "empresa";
  const normalized = plan.toLowerCase() as CompanyPlanId;
  if (PLAN_LIMITS[normalized] !== undefined) {
    return normalized;
  }
  return LEGACY_MAP[plan.toLowerCase()] || "empresa";
};

export const getPlanLimit = (plan?: string | null): number | null => {
  const normalized = normalizeCompanyPlan(plan);
  return PLAN_LIMITS[normalized];
};
