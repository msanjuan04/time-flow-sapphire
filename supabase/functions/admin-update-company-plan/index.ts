import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsOptions, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";

const planDefinitions = {
  basic: { maxEmployees: 10 },
  empresa: { maxEmployees: 30 },
  pro: { maxEmployees: 100 },
  advanced: { maxEmployees: null },
  custom: { maxEmployees: null },
};

type PlanKey = keyof typeof planDefinitions;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const { supabase } = await requireSuperadmin(req);
    const body = await req.json().catch(() => null);

    if (!body || typeof body.company_id !== "string" || typeof body.plan !== "string") {
      return createErrorResponse("company_id and plan are required", 400);
    }

    const companyId: string = body.company_id;
    const planKey = body.plan as PlanKey;
    const planDefinition = planDefinitions[planKey];

    if (!planDefinition) {
      return createErrorResponse("Invalid plan", 400);
    }

    if (planDefinition.maxEmployees !== null) {
      const { count, error: countError } = await supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      if (countError) {
        console.error("Failed to count members", countError);
        return createErrorResponse("No se pudo validar el número de usuarios", 500);
      }

      if ((count ?? 0) > planDefinition.maxEmployees) {
        return createErrorResponse(
          `El plan seleccionado permite hasta ${planDefinition.maxEmployees} usuarios. Actualmente hay ${count ?? 0}.`,
          400
        );
      }
    }

    const { error: updateError } = await supabase.from("companies").update({ plan: planKey }).eq("id", companyId);

    if (updateError) {
      console.error("Failed to update company plan", updateError);
      return createErrorResponse("No se pudo actualizar el plan", 500);
    }

    return createJsonResponse({ success: true });
  } catch (error) {
    console.error("admin-update-company-plan error", error);
    const message = error instanceof Error ? error.message : "Error inesperado";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse("No se pudo actualizar el plan", 500);
  }
});
