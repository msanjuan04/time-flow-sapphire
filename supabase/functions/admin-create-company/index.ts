import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").toString().trim();

    if (!name) {
      return createErrorResponse("Company name is required", 400);
    }

    const { data: company, error } = await supabase
      .from("companies")
      .insert({ name, status: "active", plan: "enterprise" })
      .select()
      .single();

    if (error) {
      console.error("Create company error:", error);
      return createErrorResponse("Failed to create company", 500);
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
  } catch (error: any) {
    console.error("Admin create company error:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
      return createErrorResponse(error.message, 403);
    }
    return createErrorResponse("Failed to create company", 500);
  }
});

