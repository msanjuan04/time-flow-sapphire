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

    console.log("Login attempt with code:", normalized);

    if (!/^\d{6}$/.test(normalized)) {
      console.log("Invalid code format");
      return createJsonResponse({ success: false, error: "INVALID_CODE_FORMAT" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("login_code", normalized)
      .maybeSingle();

    if (!profile) {
      console.log("No profile found with code:", normalized);
      return createJsonResponse({ success: false, error: "INVALID_CODE" }, 401);
    }

    console.log("Profile found:", profile.id, profile.email);

    // Ensure the user exists in auth.users
    const { data: authUser, error: authError } = await db.auth.admin.getUserById(profile.id);
    
    if (authError || !authUser?.user) {
      console.error("User not found in auth.users:", authError);
      return createErrorResponse("User authentication failed", 500);
    }

    console.log("Auth user found, gathering user data");

    // Check if user is superadmin
    const { data: superadminCheck } = await db
      .from("superadmins")
      .select("user_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const is_superadmin = !!superadminCheck;
    console.log("Is superadmin:", is_superadmin);

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

    console.log("Generating magic link for user");

    // Generate magic link and extract token for frontend verification
    try {
      const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: {
          redirectTo: "http://localhost:8080/auth/callback",
        },
      });

      if (linkError || !linkData) {
        console.error("Failed to generate magic link:", linkError);
        return createErrorResponse("Failed to generate login link: " + (linkError?.message || "Unknown error"), 500);
      }

      console.log("Magic link generated successfully");

      // Extract hashed_token (preferred) and regular token (fallback)
      const hashedToken = linkData.properties?.hashed_token;
      const actionLink = linkData.properties?.action_link;
      
      let token = null;
      let type = "magiclink";
      
      if (actionLink) {
        // Extract token from URL (format: .../verify?token=...&type=...)
        const urlObj = new URL(actionLink);
        token = urlObj.searchParams.get("token");
        type = urlObj.searchParams.get("type") || "magiclink";
      }

      // Prefer hashed_token over regular token for more reliable verification
      if (!hashedToken && !token) {
        console.error("No token or hashed_token in response");
        return createErrorResponse("No token in response", 500);
      }

      console.log("Token extracted from magic link", { hasHashedToken: !!hashedToken, hasToken: !!token });

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
        user: { ...profile, is_superadmin },
        memberships: memberships || [],
        company,
        // Prioritize token_hash for more reliable verification (no expiration issues)
        token_hash: hashedToken || null,
        // Include token as fallback if token_hash is not available
        token: hashedToken ? null : token,
        verification_type: type,
      });
    } catch (sessionError) {
      console.error("Error generating magic link:", sessionError);
      return createErrorResponse("Failed to generate login link: " + (sessionError?.message || "Unknown error"), 500);
    }
  } catch (err) {
    console.error("login-with-code error:", err);
    return createErrorResponse("Internal server error", 500);
  }
});
