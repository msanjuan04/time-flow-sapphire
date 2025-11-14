// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { writeAudit, extractRequestMetadata } from "../_shared/admin.ts";

function cleanCode(raw: unknown): string {
  if (typeof raw === "number") return raw.toString().padStart(6, "0");
  if (typeof raw === "string") return raw.replace(/\D/g, "");
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const body = await req.json().catch(() => ({}));
    const normalized = cleanCode(body.code);

    if (!/^\d{6}$/.test(normalized)) {
      return createJsonResponse({ success: false, error: "INVALID_CODE_FORMAT" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, is_superadmin")
      .eq("access_code", normalized)
      .maybeSingle();

    if (!profile) {
      return createJsonResponse({ success: false, error: "INVALID_CODE" }, 401);
    }

    const { data: memberships } = await db
      .from("memberships")
      .select("id, company_id, role")
      .eq("user_id", profile.id);

    let company = null;
    if (memberships?.length > 0) {
      const { data: c } = await db
        .from("companies")
        .select("id, name, status, plan")
        .eq("id", memberships[0].company_id)
        .maybeSingle();

      company = c ?? null;
    }

    try {
      const { ip, user_agent } = extractRequestMetadata(req);
      await writeAudit(db, {
        actor_user_id: profile.id,
        company_id: memberships?.[0]?.company_id,
        action: "login_with_code",
        diff: { code: normalized },
        ip,
        user_agent,
      });
    } catch {}

    return createJsonResponse({
      success: true,
      user: profile,
      memberships: memberships || [],
      company,
    });
  } catch (err) {
    console.error("login-with-code error:", err);
    return createErrorResponse("Internal server error", 500);
  }
});
