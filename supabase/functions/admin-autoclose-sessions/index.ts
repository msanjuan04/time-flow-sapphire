import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

/**
 * Manual trigger for auto-closing work sessions
 * This would typically run as a cron job
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    // Get all open work sessions older than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: openSessions, error: sessionsError } = await supabase
      .from("work_sessions")
      .select("id, user_id, company_id, clock_in_time")
      .eq("status", "open")
      .lt("clock_in_time", twentyFourHoursAgo.toISOString());

    if (sessionsError) {
      console.error("Error fetching open sessions:", sessionsError);
      return createErrorResponse("Failed to fetch open sessions", 500);
    }

    if (!openSessions || openSessions.length === 0) {
      return createJsonResponse({
        success: true,
        message: "No sessions to close",
        closed_count: 0,
      });
    }

    // Close each session
    const now = new Date().toISOString();
    const sessionIds = openSessions.map((s) => s.id);

    const { error: updateError } = await supabase
      .from("work_sessions")
      .update({
        clock_out_time: now,
        status: "closed",
      })
      .in("id", sessionIds);

    if (updateError) {
      console.error("Error closing sessions:", updateError);
      return createErrorResponse("Failed to close sessions", 500);
    }

    // Write audit log
    await writeAudit(supabase, {
      actor_user_id: user.id,
      action: "admin.jobs.autoclose_sessions",
      entity_type: "work_session",
      diff: { closed_count: sessionIds.length },
      ip,
      user_agent,
      reason: `Manually triggered auto-close for ${sessionIds.length} sessions`,
    });

    console.log(`Superadmin ${user.id} closed ${sessionIds.length} work sessions`);

    return createJsonResponse({
      success: true,
      message: `Closed ${sessionIds.length} work sessions`,
      closed_count: sessionIds.length,
      session_ids: sessionIds,
    });
  } catch (error: any) {
    console.error("Admin autoclose sessions error:", error);

    if (error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
      return createErrorResponse(error.message, 403);
    }

    return createErrorResponse("Failed to close sessions", 500);
  }
});
