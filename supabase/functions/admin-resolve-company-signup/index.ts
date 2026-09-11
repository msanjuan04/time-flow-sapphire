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

interface ValidationError { field: string; message: string; }
const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const validateUUID = (value: string | undefined | null, field: string, errors: ValidationError[]) => {
  if (!value) { errors.push({ field, message: `${field} is required` }); return; }
  if (!isValidUUID(value)) errors.push({ field, message: `${field} must be a valid UUID` });
};
const validateEnum = <T extends string>(value: T | undefined | null, field: string, allowed: readonly T[], errors: ValidationError[]) => {
  if (!value) { errors.push({ field, message: `${field} is required` }); return; }
  if (!allowed.includes(value)) errors.push({ field, message: `${field} must be one of: ${allowed.join(", ")}` });
};
const createValidationErrorResponse = (errors: ValidationError[]) =>
  new Response(JSON.stringify({ error: "Validation failed", details: errors }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const extractRequestMetadata = (req: Request) => {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd ? fwd.split(",")[0]?.trim() || null : null;
  return { ip: first || req.headers.get("x-real-ip") || null, user_agent: req.headers.get("user-agent") || null };
};

// deno-lint-ignore no-explicit-any
async function requireSuperadmin(req: Request): Promise<{ supabase: any; user: any }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header");

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized: No valid session");

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const serviceClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } });

  let isSuperadmin = false;
  const { data: profile } = await serviceClient.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (profile?.is_superadmin) {
    isSuperadmin = true;
  } else {
    const { data: legacy } = await serviceClient.from("superadmins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (legacy) { isSuperadmin = true; await serviceClient.from("profiles").update({ is_superadmin: true }).eq("id", user.id); }
  }
  if (!isSuperadmin) throw new Error("Forbidden: Superadmin access required");
  return { supabase: serviceClient, user };
}

// deno-lint-ignore no-explicit-any
async function writeAudit(supabase: any, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    company_id: payload.company_id || null,
    actor_user_id: payload.actor_user_id,
    acting_as_user_id: payload.acting_as_user_id || null,
    action: payload.action,
    entity_type: payload.entity_type || null,
    entity_id: payload.entity_id || null,
    diff: payload.diff || null,
    ip: payload.ip || null,
    user_agent: payload.user_agent || null,
    reason: payload.reason || null,
  });
  if (error) console.error("Failed to write audit log:", error);
}
// ─────────────────────────────────────────────────────

const VALID_ACTIONS = ["approve", "reject"] as const;
interface ResolveBody { signup_id: string; action: typeof VALID_ACTIONS[number]; }

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendOwnerCodeEmail(email: string, companyName: string, code: string): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
  if (!resendApiKey) { console.warn("RESEND_API_KEY not configured; skipping owner code email."); return false; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        from: fromEmail, to: email,
        subject: `${companyName} ya está activa en GTiQ`,
        html: `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 12px">¡Tu empresa está activa!</h2>
          <p>Hemos aprobado el alta de <strong>${companyName}</strong>. Accede a GTiQ con este código de 6 dígitos:</p>
          <p style="font-size:28px;font-weight:600;letter-spacing:4px;background:#f3f4f6;padding:12px 16px;border-radius:10px;display:inline-block;margin:16px 0;color:#0f172a;">${code}</p>
          <p>Desde tu panel podrás invitar a tu equipo.</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to send owner code email:", err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);

    const body: ResolveBody = await req.json();
    const errors: ValidationError[] = [];
    validateUUID(body.signup_id, "signup_id", errors);
    validateEnum(body.action, "action", VALID_ACTIONS, errors);
    if (errors.length > 0) return createValidationErrorResponse(errors);

    const { data: signup, error: lookupError } = await supabase
      .from("company_signups")
      .select("id, email, full_name, status, company_payload")
      .eq("id", body.signup_id)
      .maybeSingle();
    if (lookupError) return createErrorResponse("No pudimos cargar la solicitud", 500);
    if (!signup) return createErrorResponse("Solicitud no encontrada", 404);

    const companyName = (signup.company_payload as { name?: string } | null)?.name || "Empresa";

    // ---- RECHAZAR ----
    if (body.action === "reject") {
      if (signup.status === "approved") return createErrorResponse("Esta solicitud ya fue aprobada; no se puede rechazar.", 409);
      const { error: rejErr } = await supabase.from("company_signups").update({ status: "rejected" }).eq("id", signup.id);
      if (rejErr) return createErrorResponse("No pudimos rechazar la solicitud", 500);
      await writeAudit(supabase, {
        actor_user_id: user.id, action: "company_signup_rejected",
        entity_type: "company_signup", entity_id: signup.id,
        diff: { email: signup.email, company_name: companyName }, ip, user_agent,
      });
      return createJsonResponse({ success: true, status: "rejected" });
    }

    // ---- APROBAR ----
    if (signup.status === "approved") return createJsonResponse({ success: true, status: "approved", already: true });
    if (signup.status !== "verified") return createErrorResponse("La solicitud aún no ha verificado su email.", 409);

    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: signup.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: signup.full_name || signup.email.split("@")[0] },
    });
    if (createError || !userData?.user) return createErrorResponse(createError?.message || "No pudimos crear el usuario del dueño", 400);
    const ownerUserId = userData.user.id;

    const { data: rpcData, error: rpcError } = await supabase.rpc("approve_company_signup", {
      p_signup_id: signup.id, p_user_id: ownerUserId,
    });
    if (rpcError || !rpcData) {
      console.error("approve_company_signup RPC failed, cleaning up auth user:", rpcError);
      const { error: delErr } = await supabase.auth.admin.deleteUser(ownerUserId);
      if (delErr) console.error("Cleanup deleteUser failed (orphan auth user):", delErr);
      return createErrorResponse("No pudimos aprobar la empresa. Inténtalo de nuevo.", 500);
    }

    const loginCode = (rpcData as { login_code?: string }).login_code || "";
    const companyId = (rpcData as { company_id?: string }).company_id;
    const emailSent = await sendOwnerCodeEmail(signup.email, companyName, loginCode);

    await writeAudit(supabase, {
      company_id: companyId, actor_user_id: user.id, action: "company_signup_approved",
      entity_type: "company", entity_id: companyId || signup.id,
      diff: { email: signup.email, company_name: companyName, email_sent: emailSent }, ip, user_agent,
    });

    return createJsonResponse({
      success: true, status: "approved", company_id: companyId,
      email_sent: emailSent, login_code: loginCode,
    });
  } catch (error) {
    console.error("admin-resolve-company-signup unexpected error:", error);
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return createErrorResponse(message, 500);
  }
});