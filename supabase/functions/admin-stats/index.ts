import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase } = await requireSuperadmin(req);

    // Get company stats by status
    const { data: companyStats, error: companyError } = await supabase
      .from("companies")
      .select("status");

    if (companyError) {
      console.error("Error fetching company stats:", companyError);
      return createErrorResponse("Failed to fetch company stats", 500);
    }

    const companies = {
      total: companyStats.length,
      active: companyStats.filter((c) => c.status === "active").length,
      grace: companyStats.filter((c) => c.status === "grace").length,
      suspended: companyStats.filter((c) => c.status === "suspended").length,
    };

    // Get total users count
    const { count: usersCount, error: usersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      console.error("Error counting users:", usersError);
    }

    // Get today's time events count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayEventsCount, error: eventsError } = await supabase
      .from("time_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    if (eventsError) {
      console.error("Error counting today's events:", eventsError);
    }

    // Get recent audit logs
    const { data: recentLogs, error: logsError } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        entity_type,
        created_at,
        actor_user_id,
        company_id,
        companies(name)
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (logsError) {
      console.error("Error fetching recent logs:", logsError);
    }

    return createJsonResponse({
      success: true,
      data: {
        companies,
        users_total: usersCount || 0,
        events_today: todayEventsCount || 0,
        recent_logs: recentLogs || [],
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch admin stats";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to fetch admin stats", 500);
  }
});
