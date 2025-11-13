import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    // Require superadmin access
    const { supabase, user } = await requireSuperadmin(req);

    // Extract request metadata
    const { ip, user_agent } = extractRequestMetadata(req);

    // Get current impersonation data from request body (sent from frontend)
    const body = await req.json();
    const company_id = body.company_id || null;

    // Write audit log
    await writeAudit(supabase, {
      company_id,
      actor_user_id: user.id,
      action: "admin.impersonate.stop",
      entity_type: "company",
      entity_id: company_id,
      ip,
      user_agent,
      reason: "Superadmin stopped impersonation",
    });

    console.log(`Superadmin ${user.id} stopped impersonating${company_id ? ` company ${company_id}` : ""}`);

    return createJsonResponse({
      success: true,
      message: "Impersonation stopped",
    });
  } catch (error) {
    console.error("Stop impersonate error:", error);

    const message = error instanceof Error ? error.message : "Failed to stop impersonation";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to stop impersonation", 500);
  }
});
