import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { requireSuperadmin } from "../_shared/admin.ts";

interface MembershipRow {
  user_id: string;
  role: string;
  profiles: {
    email: string;
    full_name: string | null;
    is_active: boolean;
    centers?: { name: string | null } | null;
    teams?: { name: string | null } | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const { supabase } = await requireSuperadmin(req);

    const body = await req.json().catch(() => ({}));
    const companyId: string | undefined = body.company_id || undefined;

    if (!companyId) {
      return createErrorResponse("company_id is required", 400);
    }

    const { data, error } = await supabase
      .from("memberships")
      .select(`
        user_id,
        role,
        profiles!inner(
          id,
          email,
          full_name,
          is_active,
          center_id,
          team_id,
          centers(name),
          teams(name)
        )
      `)
      .eq("company_id", companyId);

    if (error) {
      console.error("Admin list users error:", error);
      return createErrorResponse("Failed to fetch users", 500);
    }

    const memberRows = (data || []) as any[];
    const members = memberRows.map((m: any) => ({
      id: m.user_id,
      email: m.profiles?.email || '',
      full_name: m.profiles?.full_name || null,
      role: m.role,
      is_active: m.profiles?.is_active || false,
      center_name: m.profiles?.centers?.name || null,
      team_name: m.profiles?.teams?.name || null,
    }));

    return createJsonResponse({ success: true, members });
  } catch (error) {
    console.error("Admin list users unexpected error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse("Failed to fetch users", 500);
  }
});
