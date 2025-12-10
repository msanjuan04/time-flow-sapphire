import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { extractRequestMetadata } from "../_shared/admin.ts";

interface RecoverRequestBody {
  email: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const body: RecoverRequestBody | null = await req.json().catch(() => null);
    const email = (body?.email || "").toLowerCase().trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return createErrorResponse("Email inválido", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables", {
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return createErrorResponse("Misconfigured server", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_active")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to fetch profile:", profileError);
      return createErrorResponse("No pudimos verificar tu cuenta en este momento", 500);
    }

    if (!profile) {
      return createErrorResponse("No encontramos ninguna cuenta con este correo", 404);
    }

    if (profile.is_active === false) {
      return createErrorResponse("Tu cuenta está desactivada. Contacta con un administrador.", 403);
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
    const { count: recentCount, error: recentError } = await supabase
      .from("login_code_requests")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("requested_at", windowStart);

    if (recentError) {
      console.error("Failed to fetch recent requests:", recentError);
    } else if ((recentCount ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      return createErrorResponse("Has solicitado demasiados códigos. Intenta de nuevo en unos minutos.", 429);
    }

    const { data: newCode, error: codeError } = await supabase.rpc("generate_login_code");
    if (codeError || !newCode) {
      console.error("generate_login_code failed:", codeError);
      return createErrorResponse("No pudimos generar un nuevo código", 500);
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ login_code: newCode })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Failed to update profile with new code:", updateError);
      return createErrorResponse("No pudimos actualizar tu código. Intenta nuevamente.", 500);
    }

    const { ip, user_agent } = extractRequestMetadata(req);
    await supabase.from("login_code_requests").insert({
      profile_id: profile.id,
      email: profile.email,
      ip,
      user_agent,
    });

    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      if (resendApiKey) {
        // Evita bloqueos si el proveedor de email tarda demasiado
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            from: fromEmail,
            to: profile.email,
            subject: "Tu código de acceso renovado",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Aquí tienes tu nuevo código</h2>
                <p>Utiliza este código temporal de 6 dígitos para acceder a GTiQ:</p>
                <p style="font-size:28px;font-weight:600;letter-spacing:4px;background:#f3f4f6;padding:12px 16px;border-radius:10px;display:inline-block;margin:16px 0;color:#0f172a;">${newCode}</p>
                <p>Por motivos de seguridad el código puede cambiar cuando lo solicites de nuevo.</p>
              </div>
            `,
          }),
        }).catch((err) => {
          if (err?.name === "AbortError") {
            console.warn("Email send aborted due to timeout");
          } else {
            throw err;
          }
        }).finally(() => clearTimeout(timeout));
      } else {
        console.warn("RESEND_API_KEY not configured; skipping email send.");
      }
    } catch (emailError) {
      console.error("Failed to send recovery email:", emailError);
      // Continue without failing the request
    }

    return createJsonResponse({
      success: true,
      message: "Si el correo existe en GTiQ hemos enviado un código nuevo.",
    });
  } catch (error) {
    console.error("request-login-code unexpected error:", error);
    return createErrorResponse("Error interno del servidor", 500);
  }
});
