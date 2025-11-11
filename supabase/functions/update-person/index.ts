import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdatePersonRequest {
  full_name?: string;
  role?: "owner" | "admin" | "manager" | "worker";
  center_id?: string | null;
  team_id?: string | null;
  is_active?: boolean;
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

    // Get user ID from URL
    const url = new URL(req.url);
    const targetUserId = url.pathname.split("/").pop();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Verify target user is in same company
    const { data: targetMembership } = await supabase
      .from("memberships")
      .select("id, role")
      .eq("user_id", targetUserId)
      .eq("company_id", membership.company_id)
      .single();

    if (!targetMembership) {
      return new Response(
        JSON.stringify({ error: "User not found in company" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: UpdatePersonRequest = await req.json();

    // Validate inputs
    if (body.role && !["owner", "admin", "manager", "worker"].includes(body.role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.full_name !== undefined && body.full_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Full name cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent changing owner role unless requester is owner
    if (targetMembership.role === "owner" && membership.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only owners can modify other owners" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile if needed
    if (
      body.full_name !== undefined ||
      body.center_id !== undefined ||
      body.team_id !== undefined ||
      body.is_active !== undefined
    ) {
      const profileUpdates: any = {};
      
      if (body.full_name !== undefined) {
        profileUpdates.full_name = body.full_name.trim();
      }
      if (body.center_id !== undefined) {
        profileUpdates.center_id = body.center_id;
      }
      if (body.team_id !== undefined) {
        profileUpdates.team_id = body.team_id;
      }
      if (body.is_active !== undefined) {
        profileUpdates.is_active = body.is_active;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", targetUserId);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update membership role if needed
    if (body.role !== undefined) {
      const { error: membershipError } = await supabase
        .from("memberships")
        .update({ role: body.role })
        .eq("user_id", targetUserId)
        .eq("company_id", membership.company_id);

      if (membershipError) {
        console.error("Error updating membership:", membershipError);
        return new Response(
          JSON.stringify({ error: "Failed to update role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("User updated successfully:", targetUserId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User updated successfully",
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
