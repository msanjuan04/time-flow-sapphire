// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { resolveSiteUrl } from "../_shared/site-url.ts";

function cleanCode(raw: unknown): string {
  if (typeof raw === "number") return raw.toString().padStart(6, "0");
  if (typeof raw === "string") return raw.replace(/\D/g, "");
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const body = await req.json().catch(() => null);
    const rawCode = body?.code;
    if (rawCode === undefined || rawCode === null) {
      return createJsonResponse({ success: false, error: "MISSING_CODE" }, 400);
    }

    const normalized = cleanCode(rawCode);

    console.log("Login attempt with code:", normalized);

    if (!/^\d{6}$/.test(normalized)) {
      console.log("Invalid code format");
      return createJsonResponse({ success: false, error: "INVALID_CODE_FORMAT" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!url || !key || !anonKey) {
      console.error("Missing Supabase environment variables", {
        hasUrl: !!url,
        hasServiceRoleKey: !!key,
        hasAnonKey: !!anonKey,
      });
      return createJsonResponse(
        {
          success: false,
          error: "MISSING_SUPABASE_CONFIG",
          details: { hasUrl: !!url, hasServiceRoleKey: !!key, hasAnonKey: !!anonKey },
        },
        500,
      );
    }

    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, is_superadmin")
      .eq("login_code", normalized)
      .maybeSingle();

    if (!profile) {
      console.log("No profile found with code:", normalized);
      return createJsonResponse({ success: false, error: "INVALID_CODE" }, 401);
    }

    console.log("Profile found:", profile.id, profile.email);

    // Ensure the user exists in auth.users
    const { data: authUser, error: authError } = await db.auth.admin.getUserById(profile.id);
    
    if (authError) {
      console.error("User lookup failed in auth.users:", authError);
      return createJsonResponse(
        { success: false, error: "USER_LOOKUP_FAILED", message: authError.message },
        500,
      );
    }

    if (!authUser?.user) {
      console.error("User not found in auth.users for id:", profile.id);
      return createJsonResponse({ success: false, error: "USER_NOT_FOUND" }, 404);
    }

    console.log("Auth user found, creating session directly");

    // Generate a magic link internally (user never sees it) to get session tokens
    // This is the simplest way to create a valid session in Supabase
    // Allow localhost for local development
    const siteUrl = resolveSiteUrl(req, true);
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        // Use a valid redirect URL (even if localhost) - this is only used internally
        redirectTo: `${siteUrl}/auth`,
      },
    });

    if (linkError || !linkData) {
      const errorCode = linkError?.message?.toLowerCase().includes("site url")
        ? "SITE_URL_NOT_CONFIGURED"
        : "SESSION_LINK_FAILED";
      console.error("Failed to generate session link:", linkError);
      return createJsonResponse({ success: false, error: errorCode }, 500);
    }

    // Extract tokens from generateLink response. Prefer hashed_token to avoid
    // otp_expired issues with the raw token from action_link.
    const actionLink = linkData.properties?.action_link;
    const hashedToken = linkData.properties?.hashed_token;

    if (!actionLink && !hashedToken) {
      console.error("No token returned by generateLink");
      return createJsonResponse({ success: false, error: "SESSION_LINK_FAILED" }, 500);
    }

    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    // 1) Try verifyOtp with token_hash (no email required)
    if (hashedToken) {
      try {
        const { data: verifyData, error: verifyError } = await db.auth.verifyOtp({
          type: "magiclink",
          token_hash: hashedToken,
        });
        if (verifyError || !verifyData?.session) {
          console.error("verifyOtp with token_hash failed:", verifyError);
        } else {
          accessToken = verifyData.session.access_token;
          refreshToken = verifyData.session.refresh_token;
        }
      } catch (hashErr) {
        console.error("Error verifying hashed token:", hashErr);
      }
    }

    // 2) Fallback: use raw token from action_link via /auth/v1/verify
    if (!accessToken || !refreshToken) {
      if (!actionLink) {
        console.error("No action_link available for fallback verification");
        return createJsonResponse({ success: false, error: "SESSION_CREATION_FAILED" }, 500);
      }

      const urlObj = new URL(actionLink);
      const token = urlObj.searchParams.get("token");
      
      if (!token) {
        console.error("No token in action_link");
        return createJsonResponse({ success: false, error: "SESSION_CREATION_FAILED" }, 500);
      }

      const verifyUrl = `${url}/auth/v1/verify`;
      const verifyResponse = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          type: "magiclink",
          email: profile.email,
        }),
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error("Failed to verify token:", verifyResponse.status, errorText);
        return createJsonResponse({ success: false, error: "SESSION_CREATION_FAILED" }, 500);
      }

      const verifyData = await verifyResponse.json().catch(() => ({}));
      
      if (!verifyData.access_token || !verifyData.refresh_token) {
        console.error("No tokens in verify response:", verifyData);
        return createJsonResponse({ success: false, error: "SESSION_CREATION_FAILED" }, 500);
      }

      accessToken = verifyData.access_token;
      refreshToken = verifyData.refresh_token;
    }

    console.log("Session created successfully");

    // Check if user is superadmin - prioritize flag in profiles, fallback to superadmins table
    let is_superadmin = profile.is_superadmin === true;
    
    // If flag is not set but user is in superadmins table, update the flag
    if (!is_superadmin) {
      const { data: superadminCheck } = await db
        .from("superadmins")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (superadminCheck) {
        // User is in superadmins table but flag is not set, update it
        await db
          .from("profiles")
          .update({ is_superadmin: true })
          .eq("id", profile.id);
        is_superadmin = true;
        profile.is_superadmin = true;
        console.log("Updated is_superadmin flag for user in superadmins table");
      }
    }
    
    console.log("Is superadmin:", is_superadmin);

    const { data: memberships } = await db
      .from("memberships")
      .select(`
        id,
        company_id,
        role,
        company:companies(id, name, status, plan)
      `)
      .eq("user_id", profile.id);

    const primaryCompany = memberships?.[0]?.company ?? null;

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

    console.log("Returning success response with direct session tokens");

    return createJsonResponse({
      success: true,
      user: { ...profile, is_superadmin },
      memberships: memberships || [],
      company: primaryCompany,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    console.error("login-with-code error:", err);
    return createJsonResponse({ success: false, error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
