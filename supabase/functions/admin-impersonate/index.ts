import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { validateUUID, ValidationError, createValidationErrorResponse } from "../_shared/validation.ts";

interface ImpersonateRequest {
  company_id: string;
  as_role?: "admin" | "manager" | "worker";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    // Require superadmin access
    const { supabase, user } = await requireSuperadmin(req);

    // Extract request metadata
    const { ip, user_agent } = extractRequestMetadata(req);

    // Parse and validate request body
    const body: ImpersonateRequest = await req.json();
    const errors: ValidationError[] = [];

    validateUUID(body.company_id, "company_id", errors, true);

    if (body.as_role) {
      const validRoles = ["admin", "manager", "worker"] as const;
      if (!validRoles.includes(body.as_role)) {
        errors.push({
          field: "as_role",
          message: "as_role must be one of: admin, manager, worker",
        });
      }
    }

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return createErrorResponse("Company not found", 404);
    }

    // Create impersonation token (store in frontend)
    const impersonationData = {
      superadmin_id: user.id,
      company_id: body.company_id,
      company_name: company.name,
      as_role: body.as_role || null,
      started_at: new Date().toISOString(),
    };

    // Write audit log
    await writeAudit(supabase, {
      company_id: body.company_id,
      actor_user_id: user.id,
      action: "admin.impersonate.start",
      entity_type: "company",
      entity_id: body.company_id,
      diff: { as_role: body.as_role || null },
      ip,
      user_agent,
      reason: "Superadmin impersonation",
    });

    console.log(`Superadmin ${user.id} started impersonating company ${body.company_id}`);

    return createJsonResponse({
      success: true,
      data: impersonationData,
      message: `Impersonating ${company.name}`,
    });
  } catch (error) {
    console.error("Impersonate error:", error);

    const message = error instanceof Error ? error.message : "Failed to start impersonation";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to start impersonation", 500);
  }
});
