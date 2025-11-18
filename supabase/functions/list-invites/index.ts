import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let status: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      status = typeof body?.status === "string" ? body.status : null;
    } else {
      const url = new URL(req.url);
      status = url.searchParams.get("status");
    }

    // Build query
    let query = supabase
      .from("invites")
      .select(`
        id,
        email,
        role,
        status,
        center_id,
        team_id,
        created_at,
        expires_at,
        accepted_at,
        centers(name),
        teams(name)
      `)
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && ["pending", "accepted", "revoked", "expired"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: invites, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching invites:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invitations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetched ${invites?.length || 0} invites for company ${membership.company_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        invites: invites || [],
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
