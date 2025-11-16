import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { normalizeCompanyPlan } from "../_shared/company-plan.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").toString().trim();
    const planInput = typeof body.plan === "string" ? body.plan : null;
    const plan = normalizeCompanyPlan(planInput);

    if (!name) {
      return createErrorResponse("Company name is required", 400);
    }

    // Service role client bypasses RLS but we need to set owner_user_id
    // We'll set it to null initially and let the superadmin assign an owner later
    const { data: company, error } = await supabase
      .from("companies")
      .insert({
        name,
        status: "active",
        plan,
        owner_user_id: null 
      })
      .select()
      .single();

    if (error) {
      console.error("Create company error:", error);
      return createErrorResponse("Failed to create company", 500);
    }

    if (company.plan !== plan) {
      const { error: planUpdateError } = await supabase
        .from("companies")
        .update({ plan })
        .eq("id", company.id);

      if (planUpdateError) {
        console.error("Failed to enforce selected plan:", planUpdateError);
      } else {
        company.plan = plan;
      }
    }

    await writeAudit(supabase, {
      actor_user_id: user.id,
      action: "admin_create_company",
      entity_type: "company",
      entity_id: company.id,
      diff: { name },
      ip,
      user_agent,
    });

    return createJsonResponse({ success: true, company });
  } catch (error) {
    console.error("Admin create company error:", error);
    const message = error instanceof Error ? error.message : "Failed to create company";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse("Failed to create company", 500);
  }
});
