import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

/**
 * Example admin endpoint that requires superadmin privileges
 * 
 * This demonstrates how to:
 * 1. Validate superadmin access
 * 2. Write audit logs
 * 3. Handle errors properly
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    // Require superadmin access (throws if not authorized)
    const { supabase, user } = await requireSuperadmin(req);

    // Extract request metadata for audit logging
    const { ip, user_agent } = extractRequestMetadata(req);

    // Example: Get all companies (superadmin only)
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, status, plan, created_at")
      .order("created_at", { ascending: false });

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      return createErrorResponse("Failed to fetch companies", 500);
    }

    // Write audit log
    await writeAudit(supabase, {
      actor_user_id: user.id,
      action: "admin.list_companies",
      entity_type: "company",
      ip,
      user_agent,
    });

    return createJsonResponse({
      success: true,
      data: companies,
      message: "Companies retrieved successfully",
    });
  } catch (error) {
    console.error("Admin endpoint error:", error);

    const message = error instanceof Error ? error.message : "Internal server error";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Internal server error", 500);
  }
});
