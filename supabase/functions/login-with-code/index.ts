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
    
    if (authError || !authUser?.user) {
      console.error("User not found in auth.users:", authError);
      return createErrorResponse("User authentication failed", 500);
    }

    console.log("Auth user found, generating magic link tokens");

    // Generate authentication tokens using magic link
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        data: {
          full_name: profile.full_name
        }
      }
    });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return createErrorResponse("Failed to create session", 500);
    }

    console.log("Link generated successfully");

    // Extract the hashed token for verification
    const hashedToken = linkData.properties?.hashed_token;
    const verificationUrl = linkData.properties?.action_link;

    if (!hashedToken || !verificationUrl) {
      console.error("No hashed token in magic link response");
      return createErrorResponse("Failed to create session", 500);
    }

    console.log("Token generated for verification");

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

    console.log("Returning success response with verification token");

    return createJsonResponse({
      success: true,
      user: { ...profile, is_superadmin },
      memberships: memberships || [],
      company: primaryCompany,
      token_hash: hashedToken,
      hashed_token: hashedToken,
      verification_type: "magiclink",
    });
  } catch (err) {
    console.error("login-with-code error:", err);
    return createErrorResponse("Internal server error", 500);
  }
});
