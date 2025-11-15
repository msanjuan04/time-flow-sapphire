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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

    const body: CreateInviteRequest = await req.json().catch(() => ({
      email: "",
      role: "worker",
    }));

    const email = (body.email || "").toLowerCase().trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "manager", "worker"].includes(body.role)) {
      return new Response(
        JSON.stringify({ error: "Rol no soportado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = membership.company_id;

    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("profiles!inner(email)")
      .eq("company_id", companyId)
      .eq("profiles.email", email)
      .maybeSingle();
    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: "Este correo ya pertenece a tu empresa" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "Ya existe una invitación pendiente para este correo" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({
        company_id: companyId,
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

    if (inviteError || !invite) {
      console.error("Failed to create invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "No se pudo crear la invitación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:8080";
      const inviteUrl = `${siteUrl}/accept-invite?token=${token}`;

      if (resendApiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject: "Invitación a GTiQ",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Has sido invitado a GTiQ</h2>
                <p>Te han invitado a unirte a la empresa con el rol <strong>${invite.role}</strong>.</p>
                <p>Puedes aceptar la invitación usando este enlace:</p>
                <p><a href="${inviteUrl}" style="color:#1d4ed8">Aceptar invitación</a></p>
                <p>Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
                <code style="display:block;padding:8px;background:#f3f4f6;border-radius:6px">${inviteUrl}</code>
              </div>
            `,
          }),
        });
      }
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, invite }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-invite unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
