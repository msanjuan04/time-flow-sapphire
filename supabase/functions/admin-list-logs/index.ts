import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase } = await requireSuperadmin(req);

    // Get query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");
    const actorUserId = url.searchParams.get("actor");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const action = url.searchParams.get("action");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    // Build query
    let query = supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        created_at,
        actor_user_id,
        company_id,
        ip,
        user_agent,
        reason,
        diff,
        companies(name)
      `)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 500)); // Max 500 records

    // Apply filters
    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    if (actorUserId) {
      query = query.eq("actor_user_id", actorUserId);
    }

    if (action) {
      query = query.ilike("action", `%${action}%`);
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", to);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      return createErrorResponse("Failed to fetch logs", 500);
    }

    return createJsonResponse({
      success: true,
      data: logs || [],
      filters: {
        company_id: companyId,
        actor_user_id: actorUserId,
        action,
        from,
        to,
        limit,
      },
    });
  } catch (error) {
    console.error("Admin list logs error:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch logs";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to fetch logs", 500);
  }
});
