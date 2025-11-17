import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireSuperadmin } from "../_shared/admin.ts";
import { handleCorsOptions, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const { supabase } = await requireSuperadmin(req);
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    let profilesQuery = supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (query) {
      const pattern = `%${query}%`;
      profilesQuery = profilesQuery.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) {
      console.error("admin-search-users profiles error:", profilesError);
      return createErrorResponse("Failed to fetch users", 500);
    }

    const users = profiles || [];
    const ids = users.map((profile) => profile.id);

    const membershipsByUser: Record<string, Array<{ role: string; company: { name: string | null } | null }>> = {};

    if (ids.length > 0) {
      const { data: membershipRows, error: membershipError } = await supabase
        .from("memberships")
        .select("user_id, role, companies(name)")
        .in("user_id", ids);

      if (membershipError) {
        console.error("admin-search-users memberships error:", membershipError);
        return createErrorResponse("Failed to fetch memberships", 500);
      }

      (membershipRows || []).forEach((row: any) => {
        if (!membershipsByUser[row.user_id]) {
          membershipsByUser[row.user_id] = [];
        }
        membershipsByUser[row.user_id].push({
          role: row.role,
          company: row.companies ? { name: row.companies.name ?? null } : null,
        });
      });
    }

    const enrichedUsers = users.map((user) => ({
      ...user,
      memberships: membershipsByUser[user.id] || [],
    }));

    return createJsonResponse({ users: enrichedUsers });
  } catch (error) {
    console.error("admin-search-users unexpected error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch users";

    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }

    return createErrorResponse("Failed to fetch users", 500);
  }
});
