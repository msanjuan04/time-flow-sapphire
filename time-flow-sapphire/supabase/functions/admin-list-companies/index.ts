import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const { supabase } = await requireSuperadmin(req);

    // Get all companies with aggregated data
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        status,
        plan,
        owner_user_id,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      return createErrorResponse("Failed to fetch companies", 500);
    }

    // Enhance with aggregated data
    const enhancedCompanies = await Promise.all(
      (companies || []).map(async (company) => {
        // Count users
        const { count: usersCount } = await supabase
          .from("memberships")
          .select("*", { count: "exact", head: true })
          .eq("company_id", company.id);

        // Get last time event
        const { data: lastEvent } = await supabase
          .from("time_events")
          .select("event_time")
          .eq("company_id", company.id)
          .order("event_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get owner profile
        let ownerEmail = null;
        if (company.owner_user_id) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", company.owner_user_id)
            .maybeSingle();
          
          ownerEmail = ownerProfile?.email;
        }

        return {
          ...company,
          users_count: usersCount || 0,
          last_event_at: lastEvent?.event_time || null,
          owner_email: ownerEmail,
        };
      })
    );

    return createJsonResponse({
      success: true,
      data: enhancedCompanies,
    });
  } catch (error) {
    console.error("Admin list companies error:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch companies";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to fetch companies", 500);
  }
});
