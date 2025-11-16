export type CompanyPlanId = "basic" | "empresa" | "pro" | "advanced" | "custom";

export interface CompanyPlanDefinition {
  id: CompanyPlanId;
  label: string;
  price: string;
  maxEmployees: number | null; // null = sin límite
  description: string;
  features: string[];
  highlight?: boolean;
}

export const UNIVERSAL_PLAN_FEATURES: string[] = [
  "Geolocalización y fichaje en tiempo real",
  "Informes y reportes completos",
  "App móvil y accesos web",
  "Soporte incluido",
];

export const COMPANY_PLANS: Record<CompanyPlanId, CompanyPlanDefinition> = {
  basic: {
    id: "basic",
    label: "Básico",
    price: "€119/año",
    maxEmployees: 5,
    description: "Incluye todas las funcionalidades para equipos de hasta 5 empleados.",
    features: UNIVERSAL_PLAN_FEATURES,
  },
  empresa: {
    id: "empresa",
    label: "Empresa",
    price: "€189/año",
    maxEmployees: 10,
    description: "Todas las funcionalidades con un límite de hasta 10 empleados.",
    features: UNIVERSAL_PLAN_FEATURES,
    highlight: true,
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "€289/año",
    maxEmployees: 20,
    description: "Pensado para equipos medianos de hasta 20 empleados.",
    features: UNIVERSAL_PLAN_FEATURES,
  },
  advanced: {
    id: "advanced",
    label: "Avanzado",
    price: "€499/año",
    maxEmployees: 50,
    description: "Para organizaciones que necesitan hasta 50 empleados.",
    features: UNIVERSAL_PLAN_FEATURES,
  },
  custom: {
    id: "custom",
    label: "Plan Custom",
    price: "Contactar",
    maxEmployees: null,
    description: "Solución personalizada para más de 50 empleados.",
    features: UNIVERSAL_PLAN_FEATURES,
  },
};

const LEGACY_PLAN_MAP: Record<string, CompanyPlanId> = {
  free: "basic",
  enterprise: "advanced",
};

export const normalizeCompanyPlan = (plan?: string | null): CompanyPlanId => {
  if (!plan) return "empresa";
  const normalized = plan.toLowerCase() as CompanyPlanId;
  if (COMPANY_PLANS[normalized]) {
    return normalized;
  }
  return LEGACY_PLAN_MAP[plan.toLowerCase()] || "empresa";
};

export const getCompanyPlanDefinition = (plan?: string | null) =>
  COMPANY_PLANS[normalizeCompanyPlan(plan)];

export const getCompanyPlanLimit = (plan?: string | null) =>
  getCompanyPlanDefinition(plan).maxEmployees;
