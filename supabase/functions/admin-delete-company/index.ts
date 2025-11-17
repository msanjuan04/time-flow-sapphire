import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsOptions, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const url = new URL(req.url);
    let companyId = url.searchParams.get("company_id") ?? undefined;

    if (!companyId) {
      const body = await req.json().catch(() => null);
      if (body && typeof body.company_id === "string") {
        companyId = body.company_id;
      }
    }

    if (!companyId) {
      return createErrorResponse("company_id is required", 400);
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error("Failed to load company before deletion:", companyError);
      return createErrorResponse("Failed to load company", 500);
    }

    if (!company) {
      return createErrorResponse("Company not found", 404);
    }

    const { error: deleteCompanyError } = await supabase.from("companies").delete().eq("id", companyId);
    if (deleteCompanyError) {
      console.error("Failed to delete company:", deleteCompanyError);
      return createErrorResponse("Failed to delete company", 500);
    }

    await writeAudit(supabase, {
      actor_user_id: user.id,
      company_id: companyId,
      action: "admin_delete_company",
      entity_type: "company",
      entity_id: companyId,
      diff: { name: company.name },
      ip,
      user_agent,
    });

    return createJsonResponse({ success: true });
  } catch (error) {
    console.error("Admin delete company error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete company";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse("Failed to delete company", 500);
  }
});
