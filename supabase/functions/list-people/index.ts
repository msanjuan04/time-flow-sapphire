import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MemberRow {
  user_id: string;
  role: string;
  profiles: {
    email: string;
    full_name: string | null;
    center_id: string | null;
    team_id: string | null;
    is_active: boolean;
    centers?: { name: string | null } | null;
    teams?: { name: string | null } | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company and role
    const { data: membership } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const roleFilter = url.searchParams.get("role");
    const activeOnly = url.searchParams.get("active") === "true";

    // Fetch members
    let query = supabase
      .from("memberships")
      .select(`
        user_id,
        role,
        profiles!inner(
          id,
          email,
          full_name,
          center_id,
          team_id,
          is_active,
          centers(name),
          teams(name)
        )
      `)
      .eq("company_id", membership.company_id);

    // Apply filters
    if (roleFilter && ["owner", "admin", "manager", "worker"].includes(roleFilter)) {
      query = query.eq("role", roleFilter);
    }

    if (activeOnly) {
      query = query.eq("profiles.is_active", true);
    }

    const { data: members, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching members:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch members" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format response
    const formattedMembers = (members as MemberRow[] | null)?.map((m) => ({
      id: m.user_id,
      email: m.profiles.email,
      full_name: m.profiles.full_name,
      role: m.role,
      center_id: m.profiles.center_id,
      team_id: m.profiles.team_id,
      center_name: m.profiles.centers?.name || null,
      team_name: m.profiles.teams?.name || null,
      is_active: m.profiles.is_active,
    })) || [];

    console.log(`Fetched ${formattedMembers.length} members for company ${membership.company_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        members: formattedMembers,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
