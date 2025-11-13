import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReactivateOptions {
  send_invite?: boolean; // If true, creates a new invite for password reset
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

    // Get target user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, is_active")
      .eq("id", targetUserId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already active
    if (profile.is_active) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "User is already active",
          already_active: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse options
    const body: ReactivateOptions = await req.json().catch(() => ({}));

    // Reactivate user
    const { error: reactivateError } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("id", targetUserId);

    if (reactivateError) {
      console.error("Error reactivating user:", reactivateError);
      return new Response(
        JSON.stringify({ error: "Failed to reactivate user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User reactivated successfully:", targetUserId);

    let inviteCreated = false;
    let inviteToken = null;

    // Optionally send a new invite for password reset
    if (body.send_invite) {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invite, error: inviteError } = await supabase
        .from("invites")
        .insert({
          company_id: membership.company_id,
          email: profile.email.toLowerCase(),
          role: targetMembership.role,
          token,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (!inviteError && invite) {
        inviteCreated = true;
        inviteToken = token;
        console.log("Reactivation invite created:", invite.id);
      } else {
        console.error("Error creating invite:", inviteError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User reactivated successfully",
        invite_created: inviteCreated,
        invite_token: inviteToken,
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
