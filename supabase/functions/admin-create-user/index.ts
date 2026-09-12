// @ts-nocheck
// Recuperada de producción el 12/09/2026: estaba desplegada pero su
// código no existía en ningún repositorio. Hoy no la llama nadie desde la
// web. Se guarda aquí para que sea auditable mientras se decide si se
// borra del proyecto de Supabase.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "./_shared/cors.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "./_shared/admin.ts";
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
function randomPassword() {
  // 24 chars strong password
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let out = "";
  for(let i = 0; i < 24; i++){
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}
async function generateUniqueCode(db) {
  for(let i = 0; i < 20; i++){
    const code = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
    const { data, error } = await db.from("profiles").select("id").eq("access_code", code).maybeSingle();
    if (!error && !data) return code;
  }
  throw new Error("Could not generate a unique 6-digit code");
}
serve(async (req)=>{
  if (req.method === "OPTIONS") return handleCorsOptions();
  try {
    const { supabase: service, user: superUser } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);
    const raw = await req.json().catch(()=>({}));
    const email = (raw.email || "").toLowerCase().trim();
    const role = raw.role;
    const companyId = raw.company_id;
    const fullName = (raw.full_name || "").trim();
    if (!email || !companyId || !role) {
      return createErrorResponse("company_id, email and role are required", 400);
    }
    if (!isValidEmail(email)) {
      return createErrorResponse("Invalid email format", 400);
    }
    if (!role || ![
      "owner",
      "admin",
      "manager",
      "worker"
    ].includes(role)) {
      return createErrorResponse("Invalid role", 400);
    }
    const ensuredCompanyId = companyId;
    const ensuredRole = role;
    // Verify company exists
    const { data: company, error: companyErr } = await service.from("companies").select("id, owner_user_id").eq("id", ensuredCompanyId).maybeSingle();
    if (companyErr || !company) {
      return createErrorResponse("Company not found", 404);
    }
    // Admin auth client for creating/fetching auth users
    const adminAuth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Check existing membership to avoid duplicates in same company
    const { data: existingMembership } = await service.from("memberships").select("id").eq("company_id", ensuredCompanyId).eq("profiles.email", email).maybeSingle();
    if (existingMembership) {
      return createErrorResponse("User already belongs to this company", 409);
    }
    // Try to create auth user; if already exists, fetch profile by email
    let userId = null;
    let createdAuthUser = false;
    let createAuthErr = null;
    const { data: byProfile } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
    if (byProfile?.id) {
      userId = byProfile.id;
    } else {
      const { data: created, error: createErr } = await adminAuth.auth.admin.createUser({
        email,
        email_confirm: true,
        password: randomPassword(),
        user_metadata: {
          full_name: fullName || email.split("@")[0]
        }
      });
      if (createErr) {
        createAuthErr = createErr;
      } else if (created?.user?.id) {
        createdAuthUser = true;
        userId = created.user.id;
      }
    }
    if (!userId) {
      // Last attempt to find by profiles (if created triggers are slightly delayed)
      const { data: prof2 } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
      if (prof2?.id) userId = prof2.id;
    }
    if (!userId) {
      console.error("Create/fetch auth user failed:", createAuthErr);
      return createErrorResponse("Failed to create or fetch auth user", 500);
    }
    // Generate unique 6-digit code
    const accessCode = await generateUniqueCode(service);
    // Update profile with provided details + access_code
    const updates = {
      access_code: accessCode
    };
    if (fullName) updates.full_name = fullName;
    if (typeof raw.center_id !== "undefined") updates.center_id = raw.center_id || null;
    if (typeof raw.team_id !== "undefined") updates.team_id = raw.team_id || null;
    const { error: updateProfileErr } = await service.from("profiles").update(updates).eq("id", userId);
    if (updateProfileErr) {
      console.error("Profile update error:", updateProfileErr);
      return createErrorResponse("Failed to update profile", 500);
    }
    // Create membership
    const { error: membershipErr } = await service.from("memberships").insert({
      user_id: userId,
      company_id: ensuredCompanyId,
      role: ensuredRole
    });
    if (membershipErr) {
      console.error("Membership create error:", membershipErr);
      return createErrorResponse("Failed to create membership", 500);
    }
    // If role is owner, set company owner_user_id if not already set
    if (ensuredRole === "owner") {
      const { error: ownerErr } = await service.from("companies").update({
        owner_user_id: userId
      }).eq("id", ensuredCompanyId);
      if (ownerErr) {
        console.error("Owner assignment error:", ownerErr);
      }
    }
    // Send email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:8080";
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      if (resendApiKey) {
        const html = `
          <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
            <p>Hola,</p>
            <p>Se ha creado tu acceso a la aplicación de fichaje GTiQ.</p>
            <p><strong>Tu código de acceso es: ${accessCode}</strong></p>
            <p>Puedes entrar aquí:<br/>
              <a href="${siteUrl}" style="color:#1d4ed8">${siteUrl}</a>
            </p>
            <p style="color:#6b7280">No compartas este código con nadie.</p>
          </div>
        `;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject: "Tu código de acceso a GTiQ",
            html
          })
        });
        if (!res.ok) {
          emailError = await res.text();
        } else {
          emailSent = true;
        }
      } else {
        emailError = "RESEND_API_KEY not configured";
      }
    } catch (e) {
      console.error("Resend email error:", e);
      emailError = e instanceof Error ? e.message : "Unknown email error";
    }
    await writeAudit(service, {
      actor_user_id: superUser.id,
      company_id: ensuredCompanyId,
      action: "admin_create_user",
      entity_type: "user",
      entity_id: userId,
      diff: {
        email,
        role: ensuredRole,
        createdAuthUser,
        access_code: accessCode
      },
      ip,
      user_agent
    });
    return createJsonResponse({
      success: true,
      user_id: userId,
      email,
      access_code: accessCode,
      email_sent: emailSent,
      email_error: emailError
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse(message, 500);
  }
});
