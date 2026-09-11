import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ───────── helpers (incrustados de _shared) ─────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const handleCorsOptions = () => new Response(null, { headers: corsHeaders });
const createJsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const createErrorResponse = (error: string, status = 500) =>
  new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
// ─────────────────────────────────────────────────────

interface VerifyBody { token?: string; }

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const body: VerifyBody | null = await req.json().catch(() => null);
    const token = (body?.token || "").trim();
    if (!token) return createErrorResponse("Token no proporcionado", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return createErrorResponse("Misconfigured server", 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signup, error: lookupError } = await supabase
      .from("company_signups")
      .select("id, status, expires_at, company_payload")
      .eq("email_verify_token", token)
      .maybeSingle();

    if (lookupError) return createErrorResponse("No pudimos verificar tu solicitud ahora mismo", 500);
    if (!signup) return createErrorResponse("Enlace de verificación no válido", 404);

    const companyName = (signup.company_payload as { name?: string } | null)?.name ?? "tu empresa";

    if (signup.status === "verified") {
      return createJsonResponse({
        success: true, already: true, status: "verified", company_name: companyName,
        message: "Tu email ya estaba confirmado. Tu solicitud está pendiente de aprobación.",
      });
    }
    if (signup.status === "approved") {
      return createJsonResponse({
        success: true, status: "approved", company_name: companyName,
        message: "Tu empresa ya fue aprobada. Revisa tu email para acceder.",
      });
    }
    if (signup.status === "rejected") {
      return createErrorResponse("Esta solicitud fue rechazada.", 410);
    }

    // status === 'pending'
    if (signup.expires_at && new Date(signup.expires_at).getTime() < Date.now()) {
      return createErrorResponse("El enlace de verificación ha caducado. Vuelve a registrar tu empresa.", 410);
    }

    const { error: updateError } = await supabase
      .from("company_signups")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", signup.id)
      .eq("status", "pending");

    if (updateError) return createErrorResponse("No pudimos confirmar tu email. Inténtalo de nuevo.", 500);

    return createJsonResponse({
      success: true, status: "verified", company_name: companyName,
      message: "Email confirmado. Tu solicitud está pendiente de aprobación; te avisaremos por email.",
    });
  } catch (error) {
    console.error("verify-company-signup unexpected error:", error);
    return createErrorResponse("Error interno del servidor", 500);
  }
});