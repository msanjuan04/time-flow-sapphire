// Recuperada de producción el 12/09/2026: estaba desplegada pero su
// código no existía en ningún repositorio. Hoy no la llama nadie desde la
// web. Se guarda aquí para que sea auditable mientras se decide si se
// borra del proyecto de Supabase.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InviteResponse {
  invite: {
    id: string;
    email: string;
    role: string;
    company_id: string;
    center_id: string | null;
    team_id: string | null;
    expires_at: string;
    status: string;
    company_name: string;
  };
  userExists: boolean;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  const corsHeaders = {
    ...baseCorsHeaders,
    "Access-Control-Allow-Origin": origin,
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select(
        `
        id,
        email,
        role,
        company_id,
        center_id,
        team_id,
        expires_at,
        status,
        companies(name)
      `
      )
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Error fetching invite:", inviteError);
      return new Response(JSON.stringify({ error: "No pudimos validar la invitación" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite) {
      return new Response(JSON.stringify({ error: "Invitación no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({
          error:
            invite.status === "accepted"
              ? "Esta invitación ya ha sido aceptada"
              : "Esta invitación no está disponible",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Esta invitación ha expirado" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", invite.email.toLowerCase())
      .maybeSingle();

    const payload: InviteResponse = {
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        company_id: invite.company_id,
        center_id: invite.center_id,
        team_id: invite.team_id,
        expires_at: invite.expires_at,
        status: invite.status,
        company_name: invite.companies?.name ?? "Empresa",
      },
      userExists: Boolean(profile),
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-invite unexpected error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});