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

// Validation helper
const validateUpdateRequest = (body: UpdatePersonRequest): { valid: boolean; error?: string } => {
  // Validate role
  if (body.role && !["owner", "admin", "manager", "worker"].includes(body.role)) {
    return { valid: false, error: "Invalid role. Must be: owner, admin, manager, or worker" };
  }

  // Validate full_name
  if (body.full_name !== undefined) {
    const trimmedName = body.full_name.trim();
    if (trimmedName.length === 0) {
      return { valid: false, error: "Full name cannot be empty" };
    }
    if (trimmedName.length > 100) {
      return { valid: false, error: "Full name must be less than 100 characters" };
    }
  }

  // Validate UUIDs if provided
  if (body.center_id && body.center_id !== null) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.center_id)) {
      return { valid: false, error: "Invalid center_id format" };
    }
  }

  if (body.team_id && body.team_id !== null) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.team_id)) {
      return { valid: false, error: "Invalid team_id format" };
    }
  }

  return { valid: true };
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
      console.error("Auth error:", authError);
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return new Response(
        JSON.stringify({ error: "Invalid user ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company and role
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Membership error:", membershipError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch membership" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only owners and admins can update users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user is in same company
    const { data: targetMembership, error: targetError } = await supabase
      .from("memberships")
      .select("id, role")
      .eq("user_id", targetUserId)
      .eq("company_id", membership.company_id)
      .maybeSingle();

    if (targetError) {
      console.error("Target membership error:", targetError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch target user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetMembership) {
      return new Response(
        JSON.stringify({ error: "User not found in your company" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: UpdatePersonRequest = await req.json();

    // Validate request body
    const validation = validateUpdateRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
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

    // Prevent removing last owner
    if (body.role && body.role !== "owner" && targetMembership.role === "owner") {
      const { count: ownerCount } = await supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("company_id", membership.company_id)
        .eq("role", "owner");

      if (ownerCount && ownerCount <= 1) {
        return new Response(
          JSON.stringify({ error: "Cannot change role of the last owner. Assign another owner first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
