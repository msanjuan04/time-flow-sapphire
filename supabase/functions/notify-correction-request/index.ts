import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

interface NotifyRequestBody {
  company_id: string;
  request_id: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const body: NotifyRequestBody = await req.json().catch(() => ({} as NotifyRequestBody));

    if (!body.company_id || !body.request_id) {
      return createErrorResponse("company_id and request_id are required", 400);
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from("correction_requests")
      .select(`
        id,
        company_id,
        created_at,
        payload,
        profiles:profiles!correction_requests_user_id_fkey(
          full_name,
          email
        )
      `)
      .eq("id", body.request_id)
      .eq("company_id", body.company_id)
      .single();

    if (requestError || !request) {
      console.error("Correction request not found:", requestError);
      return createErrorResponse("Correction request not found", 404);
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("name, owner_user_id")
      .eq("id", body.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return createErrorResponse("Company not found", 404);
    }

    let recipientEmail: string | null = null;
    let recipientName: string | null = null;

    if (company.owner_user_id) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", company.owner_user_id)
        .maybeSingle();

      recipientEmail = ownerProfile?.email ?? null;
      recipientName = ownerProfile?.full_name ?? null;
    }

    if (!recipientEmail) {
      const { data: ownerMembership } = await supabaseAdmin
        .from("memberships")
        .select("role, profiles(email, full_name)")
        .eq("company_id", body.company_id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      recipientEmail = (ownerMembership?.profiles as any)?.[0]?.email ?? null;
      recipientName = (ownerMembership?.profiles as any)?.[0]?.full_name ?? null;
    }

    if (!recipientEmail) {
      console.warn("No owner email found for company", body.company_id);
      return createJsonResponse({ success: false, message: "Owner email not found" });
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured; skipping email send.");
      return createJsonResponse({ success: true, skipped: true, reason: "Resend API key missing" });
    }

    const workerName = (request.profiles as any)?.[0]?.full_name || (request.profiles as any)?.[0]?.email || "Trabajador";
    const workerEmail = (request.profiles as any)?.[0]?.email || "sin correo";
    const payload = request.payload as Record<string, string>;
    const eventTime = payload?.event_time ? new Date(payload.event_time).toLocaleString("es-ES") : "Sin fecha";
    const eventType = payload?.event_type ?? "evento";
    const reason = payload?.reason ?? "Sin motivo especificado";

    const emailHtml = `
      <p>Hola ${recipientName ?? "equipo"},</p>
      <p>El trabajador <strong>${workerName}</strong> (${workerEmail}) ha enviado una nueva solicitud de corrección.</p>
      <ul>
        <li><strong>Tipo:</strong> ${eventType}</li>
        <li><strong>Fecha/Hora:</strong> ${eventTime}</li>
        <li><strong>Motivo:</strong> ${reason}</li>
      </ul>
      <p>Puedes gestionar la solicitud desde el panel de Correcciones.</p>
      <p>— GTiQ</p>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "GTiQ <notificaciones@gtiq.app>",
        to: [recipientEmail],
        subject: `Nueva solicitud de corrección - ${workerName}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      console.error("Resend email failed:", await response.text());
      return createErrorResponse("Failed to send notification email", 500);
    }

    return createJsonResponse({ success: true });
  } catch (error) {
    console.error("Notify correction request error:", error);
    return createErrorResponse("Failed to notify correction request", 500);
  }
});
