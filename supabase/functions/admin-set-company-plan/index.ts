import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsOptions,
  createJsonResponse,
  createErrorResponse,
} from "../_shared/cors.ts";
import {
  requireSuperadmin,
  writeAudit,
  extractRequestMetadata,
} from "../_shared/admin.ts";
import { normalizeCompanyPlan } from "../_shared/company-plan.ts";
import {
  createValidationErrorResponse,
  validateUUID,
  ValidationError,
} from "../_shared/validation.ts";

interface SetPlanRequest {
  company_id?: string;
  plan?: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);
    const body: SetPlanRequest = await req.json().catch(() => ({}));

    const errors: ValidationError[] = [];
    validateUUID(body.company_id, "company_id", errors, true);

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    if (!body.plan) {
      return createErrorResponse("Plan is required", 400);
    }

    const normalizedPlan = normalizeCompanyPlan(body.plan);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, plan")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      return createErrorResponse("Company not found", 404);
    }

    if (company.plan === normalizedPlan) {
      return createJsonResponse({
        success: true,
        plan: normalizedPlan,
        message: "Plan already set",
      });
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({ plan: normalizedPlan })
      .eq("id", body.company_id);

    if (updateError) {
      console.error("Error updating company plan:", updateError);
      return createErrorResponse("Failed to update company plan", 500);
    }

    await writeAudit(supabase, {
      company_id: company.id,
      actor_user_id: user.id,
      action: "admin.company.set_plan",
      entity_type: "company",
      entity_id: company.id,
      diff: {
        old_plan: company.plan,
        new_plan: normalizedPlan,
      },
      ip,
      user_agent,
      reason:
        body.reason ||
        `Plan changed from ${company.plan} to ${normalizedPlan}`,
    });

    return createJsonResponse({
      success: true,
      plan: normalizedPlan,
    });
  } catch (error) {
    console.error("Set company plan error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update company plan";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to update company plan", 500);
  }
});
