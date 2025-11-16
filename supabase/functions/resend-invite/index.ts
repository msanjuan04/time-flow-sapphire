import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureWorkerProfile } from "../_shared/invite-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      console.error("Missing service role key");
      return new Response(
        JSON.stringify({ error: "Misconfigured server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const body = await req.json().catch(() => ({}));
    const inviteId = body?.invite_id as string | undefined;

    if (!inviteId) {
      return new Response(
        JSON.stringify({ error: "Invite ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();
    const isSuperadmin = profile?.is_superadmin === true;

    const { data: membership } = await supabase
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isCompanyAdmin = membership && ["owner", "admin"].includes(membership.role);

    if (!isSuperadmin && !isCompanyAdmin) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isSuperadmin && invite.company_id !== membership!.company_id) {
      return new Response(
        JSON.stringify({ error: "Cannot manage invitations from another company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", invite.company_id)
      .maybeSingle();
    const companyName = company?.name || "tu empresa";

    let loginCode: string | null = null;
    try {
      const ensured = await ensureWorkerProfile(supabase, {
        email: invite.email,
        centerId: invite.center_id ?? undefined,
        teamId: invite.team_id ?? undefined,
      });
      loginCode = ensured.loginCode;
    } catch (profileError) {
      console.error("Failed to ensure worker profile for resend:", profileError);
      return new Response(
        JSON.stringify({ error: "No pudimos preparar el usuario invitado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

    if (updateError || !updatedInvite) {
      console.error("Failed to update invite:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to resend invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:8080";
      const authUrl = `${siteUrl}/auth`;
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      const inviteUrl = `${siteUrl}/accept-invite?token=${newToken}`;

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: updatedInvite.email,
            subject: "Reenvío de invitación a GTiQ",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Seguimos esperando por ti en ${companyName}</h2>
                <p>Reactivamos tu invitación para unirte como <strong>${updatedInvite.role}</strong>.</p>
                <ol style="padding-left:20px;margin:16px 0;">
                  <li>Confirma la invitación desde el siguiente botón.</li>
                  <li>Accede a <a href="${authUrl}" style="color:#1d4ed8;">GTiQ</a> e introduce tu código personal.</li>
                </ol>
                <div style="margin:16px 0;">
                  <p style="margin:0 0 8px;font-weight:600;">Tu código personal de acceso:</p>
                  <p style="font-size:28px;font-weight:600;letter-spacing:4px;background:#f3f4f6;padding:12px 16px;border-radius:10px;display:inline-block;margin:0;color:#0f172a;">
                    ${loginCode ?? "Disponible con tu administrador"}
                  </p>
                </div>
                <p style="margin:16px 0;">
                  <a href="${inviteUrl}" style="color:#fff;background:#1d4ed8;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Aceptar invitación</a>
                </p>
                <p style="font-size:13px;color:#64748b;">Si el botón no funciona, copia esta URL:</p>
                <code style="display:block;padding:8px;background:#f3f4f6;border-radius:6px">${inviteUrl}</code>
                <p style="font-size:13px;color:#64748b;margin-top:12px;">
                  En cuanto confirmes la invitación, tu administrador verá que ya formas parte del equipo.
                </p>
              </div>
            `,
          }),
        });

        if (!res.ok) {
          console.error("Resend email failed (resend-invite):", await res.text());
        }
      }
    } catch (emailErr) {
      console.error("Error sending resend invite email:", emailErr);
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
