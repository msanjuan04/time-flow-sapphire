import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get invite ID from request body
    const body = await req.json();
    const inviteId = body.invite_id;

    if (!inviteId) {
      console.error("No invite_id provided in request body");
      return new Response(
        JSON.stringify({ error: "Invite ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resending invite with ID:", inviteId);

    // Get user's company and role
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .single();

    if (membershipError) {
      console.error("Error fetching membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user membership" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      console.error("Insufficient permissions. Role:", membership?.role);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User membership verified. Company ID:", membership.company_id);

    // Get the invite
    const { data: invite, error: fetchError } = await supabase
      .from("invites")
      .select("*")
      .eq("id", inviteId)
      .eq("company_id", membership.company_id)
      .single();

    if (fetchError) {
      console.error("Error fetching invite:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invitation not found", details: fetchError.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invite) {
      console.error("Invite not found for ID:", inviteId);
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invite found:", invite.email, "status:", invite.status);

    // Generate new token and expiration
    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log("Updating invite with new token and expiration:", expiresAt.toISOString());

    // Update invite with new token and reset to pending
    const { data: updatedInvite, error: updateError } = await supabase
      .from("invites")
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invite:", updateError);
      console.error("Update error details:", JSON.stringify(updateError));
      return new Response(
        JSON.stringify({ 
          error: "Failed to resend invitation",
          details: updateError.message,
          code: updateError.code 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updatedInvite) {
      console.error("No updated invite returned after update");
      return new Response(
        JSON.stringify({ error: "Failed to update invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invite resent successfully:", inviteId);
    // Send email with new invite link via Resend (if configured)
    try {
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:8080";
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      const inviteUrl = `${siteUrl}/accept-invite?token=${newToken}`;

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: updatedInvite.email,
            subject: "Reenvío de invitación a GTiQ",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Tu invitación a GTiQ</h2>
                <p>Te reenviamos el enlace para unirte a la empresa con el rol <strong>${updatedInvite.role}</strong>.</p>
                <p>Usa este enlace para aceptar la invitación:</p>
                <p><a href="${inviteUrl}" style="color:#1d4ed8">Aceptar invitación</a></p>
                <p>Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
                <code style="display:block;padding:8px;background:#f3f4f6;border-radius:6px">${inviteUrl}</code>
              </div>
            `,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Resend email failed (resend-invite):", errText);
        } else {
          console.log("Resent invite email via Resend to:", updatedInvite.email);
        }
      } else {
        console.warn("RESEND_API_KEY not set; skipping resend invite email.");
      }
    } catch (emailErr) {
      console.error("Error sending resend invite email:", emailErr);
      // Do not fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite: updatedInvite,
        message: "Invitation resent successfully",
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
