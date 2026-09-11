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
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const extractRequestMetadata = (req: Request) => {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd ? fwd.split(",")[0]?.trim() || null : null;
  return { ip: first || req.headers.get("x-real-ip") || null, user_agent: req.headers.get("user-agent") || null };
};
const resolveSiteUrl = (req?: Request) => {
  const norm = (v?: string | null) => {
    if (!v) return null;
    const t = v.trim();
    if (!t) return null;
    return (t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`).replace(/\/$/, "");
  };
  const usable = (v?: string | null) => {
    const n = norm(v);
    if (!n || n.includes("localhost")) return null;
    return n;
  };
  const cands = [
    Deno.env.get("SITE_URL"), Deno.env.get("PUBLIC_SITE_URL"), Deno.env.get("FRONTEND_URL"),
    Deno.env.get("APP_URL"), Deno.env.get("DEFAULT_SITE_URL"), req?.headers.get("origin"),
  ];
  for (const c of cands) { const u = usable(c); if (u) return u; }
  return "https://gneraitiq.com";
};
// ─────────────────────────────────────────────────────

interface CompanyPayload {
  name?: string; tax_id?: string; phone?: string; sector?: string; employee_count?: number; address?: string;
}
interface SignupBody { email?: string; full_name?: string; company?: CompanyPayload; }

const RATE_LIMIT_MINUTES = 60;
const MAX_SIGNUPS_PER_EMAIL = 3;
const MAX_SIGNUPS_PER_IP = 8;
const TOKEN_TTL_HOURS = 24;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const body: SignupBody | null = await req.json().catch(() => null);
    const email = (body?.email || "").toLowerCase().trim();
    const fullName = (body?.full_name || "").trim();
    const company = body?.company || {};
    const companyName = (company.name || "").trim();

    if (!email || !isValidEmail(email)) return createErrorResponse("Email inválido", 400);
    if (!fullName) return createErrorResponse("Falta el nombre del responsable", 400);
    if (!companyName) return createErrorResponse("Falta el nombre de la empresa", 400);
    if (company.employee_count !== undefined && company.employee_count !== null &&
        (typeof company.employee_count !== "number" || company.employee_count < 0))
      return createErrorResponse("Número de empleados inválido", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return createErrorResponse("Misconfigured server", 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { ip } = extractRequestMetadata(req);

    // No permitir alta si el email ya es una cuenta existente.
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (profileError) return createErrorResponse("No pudimos procesar tu solicitud ahora mismo", 500);
    if (existingProfile)
      return createErrorResponse("Ya existe una cuenta con este email. Si es tuya, accede con tu código.", 409);

    // Rate-limit por email y por IP.
    const windowStart = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
    const { count: emailCount } = await supabase
      .from("company_signups").select("id", { count: "exact", head: true })
      .eq("email", email).gte("created_at", windowStart);
    if ((emailCount ?? 0) >= MAX_SIGNUPS_PER_EMAIL)
      return createErrorResponse("Has enviado demasiadas solicitudes. Inténtalo más tarde.", 429);
    if (ip) {
      const { count: ipCount } = await supabase
        .from("company_signups").select("id", { count: "exact", head: true })
        .eq("ip", ip).gte("created_at", windowStart);
      if ((ipCount ?? 0) >= MAX_SIGNUPS_PER_IP)
        return createErrorResponse("Demasiadas solicitudes desde esta red. Inténtalo más tarde.", 429);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const companyPayload: CompanyPayload = {
      name: companyName,
      tax_id: (company.tax_id || "").trim() || undefined,
      phone: (company.phone || "").trim() || undefined,
      sector: (company.sector || "").trim() || undefined,
      employee_count: company.employee_count ?? undefined,
      address: (company.address || "").trim() || undefined,
    };

    const { error: insertError } = await supabase.from("company_signups").insert({
      email, full_name: fullName, company_payload: companyPayload,
      email_verify_token: token, status: "pending", ip, expires_at: expiresAt,
    });
    if (insertError) return createErrorResponse("No pudimos registrar tu solicitud. Inténtalo de nuevo.", 500);

    // Email de verificación (no rompe la solicitud si falla).
    const siteUrl = resolveSiteUrl(req);
    const verifyUrl = `${siteUrl}/registro/verificar?token=${token}`;
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      if (resendApiKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            from: fromEmail, to: email,
            subject: "Confirma tu email para registrar tu empresa en GTiQ",
            html: `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin:0 0 12px">Confirma tu email</h2>
              <p>Hola ${fullName}, recibimos la solicitud de alta de <strong>${companyName}</strong>.</p>
              <p>Confirma tu email para enviar la solicitud a revisión:</p>
              <p style="margin:20px 0"><a href="${verifyUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Confirmar mi email</a></p>
              <p style="color:#6b7280;font-size:13px">El enlace caduca en ${TOKEN_TTL_HOURS} horas. Si no fuiste tú, ignora este correo.</p>
            </div>`,
          }),
        }).catch((err) => { if (err?.name !== "AbortError") throw err; }).finally(() => clearTimeout(timeout));
      }
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    return createJsonResponse({ success: true, message: "Te hemos enviado un email para confirmar tu solicitud." });
  } catch (error) {
    console.error("signup-company unexpected error:", error);
    return createErrorResponse("Error interno del servidor", 500);
  }
});