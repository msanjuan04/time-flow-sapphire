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

    // Get all open work sessions to evaluate against the company limit (or 24h fallback)
    const { data: openSessions, error: sessionsError } = await supabase
      .from("work_sessions")
      .select("id, user_id, company_id, clock_in_time, companies!inner(max_shift_hours)")
      .eq("status", "open");

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

    const now = new Date();
    let closedCount = 0;

    for (const session of openSessions) {
      const limitHours =
        typeof (session as any).companies?.max_shift_hours === "number" &&
        !Number.isNaN((session as any).companies?.max_shift_hours)
          ? Number((session as any).companies.max_shift_hours)
          : 24; // fallback to 24h if no limit configured

      const allowedMs = limitHours * 60 * 60 * 1000;
      const startedAt = new Date(session.clock_in_time);
      const elapsedMs = now.getTime() - startedAt.getTime();

      if (elapsedMs <= allowedMs) continue;

      const cappedOut = new Date(startedAt.getTime() + allowedMs).toISOString();
      const { error: updateError } = await supabase
        .from("work_sessions")
        .update({
          clock_out_time: cappedOut,
          status: "auto_closed",
          is_active: false,
          review_status: "exceeded_limit",
        })
        .eq("id", session.id);

      if (updateError) {
        console.error(`Error closing session ${session.id}:`, updateError);
        continue;
      }
      closedCount += 1;
    }

    // Write audit log
    await writeAudit(supabase, {
      actor_user_id: user.id,
      action: "admin.jobs.autoclose_sessions",
      entity_type: "work_session",
      diff: { closed_count: closedCount },
      ip,
      user_agent,
      reason: `Manually triggered auto-close for ${closedCount} sessions`,
    });

    console.log(`Superadmin ${user.id} closed ${closedCount} work sessions`);

    return createJsonResponse({
      success: true,
      message: `Closed ${closedCount} work sessions`,
      closed_count: closedCount,
    });
  } catch (error) {
    console.error("Admin autoclose sessions error:", error);

    const message = error instanceof Error ? error.message : "Failed to close sessions";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to close sessions", 500);
  }
});
