import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";
import { validateUUID, ValidationError, createValidationErrorResponse } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase } = await requireSuperadmin(req);

    // Get company_id from URL or request body for flexibility
    const url = new URL(req.url);
    let companyId = url.searchParams.get("company_id");

    if (!companyId) {
      const body = await req.json().catch(() => null);
      if (body && typeof body.company_id === "string") {
        companyId = body.company_id;
      }
    }

    const errors: ValidationError[] = [];
    validateUUID(companyId, "company_id", errors, true);

    if (errors.length > 0) {
      return createValidationErrorResponse(errors, corsHeaders);
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        status,
        plan,
        owner_user_id,
        policies,
        created_at,
        updated_at
      `)
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return createErrorResponse("Company not found", 404);
    }

    // Count centers
    const { count: centersCount } = await supabase
      .from("centers")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

    // Count devices
    const { count: devicesCount } = await supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

    // Count users
    const { count: usersCount } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("role", "worker");

    // Count events this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: eventsThisWeek } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", weekAgo.toISOString());

    // Count open work sessions
    const { count: openSessions } = await supabase
      .from("work_sessions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "open");

    // Get owner profile
    let ownerProfile = null;
    if (company.owner_user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", company.owner_user_id)
        .maybeSingle();
      
      ownerProfile = profile;
    }

    // Get recent audit logs for this company
    const { data: recentLogs } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        created_at,
        actor_user_id,
        reason
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    return createJsonResponse({
      success: true,
      data: {
        ...company,
        owner: ownerProfile,
        stats: {
          centers_count: centersCount || 0,
          devices_count: devicesCount || 0,
          users_count: usersCount || 0,
          events_this_week: eventsThisWeek || 0,
          open_sessions: openSessions || 0,
        },
        recent_logs: recentLogs || [],
      },
    });
  } catch (error) {
    console.error("Admin get company error:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch company details";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to fetch company details", 500);
  }
});
