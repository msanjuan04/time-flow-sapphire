import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInviteRequest {
  email: string;
  role: "admin" | "manager" | "worker";
  center_id?: string | null;
  team_id?: string | null;
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
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company and role
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership error:", membershipError);
      return new Response(
        JSON.stringify({ error: "User not associated with any company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is owner or admin
    if (!["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body: CreateInviteRequest = await req.json();

    if (!body.email || !body.role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    if (!["admin", "manager", "worker"].includes(body.role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Check plan limits
    const { data: company } = await supabase
      .from("companies")
      .select("plan")
      .eq("id", membership.company_id)
      .single();

    const plan = company?.plan || "free";
    const planLimits: Record<string, number> = {
      free: 5,
      pro: 50,
      enterprise: Infinity,
    };

    const maxEmployees = planLimits[plan];

    // Count current employees
    const { count: currentCount } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", membership.company_id);

    const currentEmployees = currentCount || 0;

    if (currentEmployees >= maxEmployees) {
      return new Response(
        JSON.stringify({ 
          error: "Plan limit reached",
          message: `Has alcanzado el límite de ${maxEmployees} miembros del plan ${plan.toUpperCase()}`,
          plan,
          maxEmployees,
          currentEmployees,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists in this company
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("profiles!inner(email)")
      .eq("company_id", membership.company_id)
      .eq("profiles.email", email)
      .maybeSingle();

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: "Email already registered in this company" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's already a pending invite for this company
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id")
      .eq("company_id", membership.company_id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "Pending invitation already exists for this email in this company" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique token and expiration (7 days)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({
        company_id: membership.company_id,
        email,
        role: body.role,
        center_id: body.center_id || null,
        team_id: body.team_id || null,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invite created successfully:", invite.id);

    // Send email with invite link via Resend (if configured)
    try {
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:8080";
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      const inviteUrl = `${siteUrl}/accept-invite?token=${token}`;

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: invite.email,
            subject: "Invitación a GTiQ",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Has sido invitado a GTiQ</h2>
                <p>Te han invitado a unirte a la empresa en GTiQ con el rol <strong>${invite.role}</strong>.</p>
                <p>Puedes aceptar la invitación usando este enlace:</p>
                <p><a href="${inviteUrl}" style="color:#1d4ed8">Aceptar invitación</a></p>
                <p>Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
                <code style="display:block;padding:8px;background:#f3f4f6;border-radius:6px">${inviteUrl}</code>
              </div>
            `,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Resend email failed:", errText);
        } else {
          console.log("Invite email sent via Resend to:", invite.email);
        }
      } else {
        console.warn("RESEND_API_KEY not set; skipping invite email send.");
      }
    } catch (emailErr) {
      console.error("Error sending invite email:", emailErr);
      // Do not fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite,
        message: "Invitation created successfully",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
