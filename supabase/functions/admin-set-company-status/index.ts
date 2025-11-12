import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { validateUUID, validateEnum, ValidationError, createValidationErrorResponse } from "../_shared/validation.ts";

const VALID_STATUSES = ["active", "grace", "suspended"] as const;

interface SetStatusRequest {
  company_id: string;
  status: typeof VALID_STATUSES[number];
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const body: SetStatusRequest = await req.json();
    const errors: ValidationError[] = [];

    validateUUID(body.company_id, "company_id", errors, true);
    validateEnum(body.status, "status", VALID_STATUSES, errors, true);

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    // Get current company status
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      return createErrorResponse("Company not found", 404);
    }

    const oldStatus = company.status;

    // Update status
    const { error: updateError } = await supabase
      .from("companies")
      .update({ status: body.status })
      .eq("id", body.company_id);

    if (updateError) {
      console.error("Error updating company status:", updateError);
      return createErrorResponse("Failed to update company status", 500);
    }

    // Write audit log
    await writeAudit(supabase, {
      company_id: body.company_id,
      actor_user_id: user.id,
      action: "admin.company.set_status",
      entity_type: "company",
      entity_id: body.company_id,
      diff: { old_status: oldStatus, new_status: body.status },
      ip,
      user_agent,
      reason: body.reason || `Status changed from ${oldStatus} to ${body.status}`,
    });

    console.log(`Superadmin ${user.id} changed company ${body.company_id} status: ${oldStatus} -> ${body.status}`);

    return createJsonResponse({
      success: true,
      message: `Company status updated to ${body.status}`,
    });
  } catch (error) {
    console.error("Set company status error:", error);

    const message = error instanceof Error ? error.message : "Failed to update company status";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to update company status", 500);
  }
});
