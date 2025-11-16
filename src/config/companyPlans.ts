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

export const COMPANY_PLANS: Record<CompanyPlanId, CompanyPlanDefinition> = {
  basic: {
    id: "basic",
    label: "Básico",
    price: "€119/año",
    maxEmployees: 5,
    description: "Hasta 5 empleados",
    features: ["Geolocalización", "Informes básicos", "App móvil", "Soporte por email"],
  },
  empresa: {
    id: "empresa",
    label: "Empresa",
    price: "€189/año",
    maxEmployees: 10,
    description: "Hasta 10 empleados",
    features: [
      "Todo lo de Básico",
      "Informes avanzados",
      "Gestión de vacaciones",
      "Soporte prioritario",
    ],
    highlight: true,
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "€289/año",
    maxEmployees: 20,
    description: "Hasta 20 empleados",
    features: [
      "Todo lo de Empresa",
      "API personalizada",
      "Integraciones avanzadas",
      "Soporte 24/7",
    ],
  },
  advanced: {
    id: "advanced",
    label: "Avanzado",
    price: "€499/año",
    maxEmployees: 50,
    description: "Hasta 50 empleados",
    features: [
      "Todo lo de Pro",
      "Múltiples ubicaciones",
      "Dashboard personalizado",
      "Gestor de cuenta",
    ],
  },
  custom: {
    id: "custom",
    label: "Plan Custom",
    price: "Contactar",
    maxEmployees: null,
    description: "Más de 50 empleados",
    features: [
      "Todo lo de Avanzado",
      "Planes a medida",
      "Formación personalizada",
      "Condiciones especiales",
    ],
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
