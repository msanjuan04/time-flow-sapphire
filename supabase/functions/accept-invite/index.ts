import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureWorkerProfile } from "../_shared/invite-helpers.ts";
import { getPlanLimit } from "../_shared/company-plan.ts";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AcceptInviteResponse {
  invite: {
    id: string;
    email: string;
    role: string;
    company_id: string;
    company_name: string;
    center_id: string | null;
    team_id: string | null;
    expires_at: string;
    status: string;
  };
  login_code: string | null;
  user_created: boolean;
  membership_created: boolean;
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

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return new Response(JSON.stringify({ error: "Misconfigured server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
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
        status,
        expires_at,
        companies(name, plan)
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

    if (invite.status === "revoked") {
      return new Response(JSON.stringify({ error: "Esta invitación ha sido revocada" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status === "accepted") {
      return new Response(JSON.stringify({ error: "Esta invitación ya ha sido aceptada" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Esta invitación ha expirado" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ensureResult;
    try {
      ensureResult = await ensureWorkerProfile(supabaseAdmin, {
        email: invite.email,
        centerId: invite.center_id ?? undefined,
        teamId: invite.team_id ?? undefined,
      });
    } catch (profileError) {
      console.error("Failed to ensure profile during acceptance:", profileError);
      return new Response(JSON.stringify({ error: "No pudimos preparar tu usuario" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profileId, loginCode, userExisted } = ensureResult;

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("id, role")
      .eq("user_id", profileId)
      .eq("company_id", invite.company_id)
      .maybeSingle();

    let membershipCreated = false;

    if (!membership) {
      const planLimit = getPlanLimit(invite.companies?.plan);
      if (planLimit !== null) {
        const { count: activeMembers } = await supabaseAdmin
          .from("memberships")
          .select("*", { count: "exact", head: true })
          .eq("company_id", invite.company_id);
        if ((activeMembers || 0) >= planLimit) {
          return new Response(JSON.stringify({ error: "No quedan plazas disponibles en el plan actual" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: membershipError } = await supabaseAdmin
        .from("memberships")
        .insert({
          user_id: profileId,
          company_id: invite.company_id,
          role: invite.role,
        });

      if (membershipError) {
        console.error("Failed to create membership from invite:", membershipError);
        return new Response(JSON.stringify({ error: "No pudimos unir al trabajador a la empresa" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      membershipCreated = true;
    } else if (membership.role !== invite.role) {
      await supabaseAdmin
        .from("memberships")
        .update({ role: invite.role })
        .eq("id", membership.id);
    }

    const { error: updateInviteError } = await supabaseAdmin
      .from("invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateInviteError) {
      console.error("Failed to update invite status:", updateInviteError);
      return new Response(JSON.stringify({ error: "No pudimos actualizar el estado de la invitación" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: AcceptInviteResponse = {
      invite: {
        id: invite.id,
        email: invite.email.toLowerCase(),
        role: invite.role,
        company_id: invite.company_id,
        company_name: invite.companies?.name ?? "Tu empresa",
        center_id: invite.center_id ?? null,
        team_id: invite.team_id ?? null,
        expires_at: invite.expires_at,
        status: "accepted",
      },
      login_code: loginCode,
      user_created: !userExisted,
      membership_created: membershipCreated,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("accept-invite unexpected error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
