import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireSuperadmin, writeAudit, extractRequestMetadata } from "../_shared/admin.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { getPlanLimit } from "../_shared/company-plan.ts";
serve(async (req)=>{
  if (req.method === "OPTIONS") return handleCorsOptions();
  try {
    const { supabase, user } = await requireSuperadmin(req);
    const { ip, user_agent } = extractRequestMetadata(req);
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    const companyId = body.company_id;
    if (!email || !companyId || !body.role) {
      console.error("admin-create-invite missing required fields", {
        hasEmail: !!email,
        hasCompanyId: !!companyId,
        role: body.role
      });
      return createErrorResponse("company_id, email and role are required", 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("admin-create-invite invalid email format", {
        email
      });
      return createErrorResponse("Invalid email format", 400);
    }
    if (![
      "owner",
      "manager",
      "worker"
    ].includes(body.role)) {
      console.error("admin-create-invite invalid role", {
        role: body.role
      });
      return createErrorResponse("Invalid role", 400);
    }
    // Ensure company exists
    const { data: company, error: companyErr } = await supabase.from("companies").select("id, plan").eq("id", companyId).maybeSingle();
    if (companyErr || !company) {
      console.error("admin-create-invite company not found", {
        companyId,
        companyErr
      });
      return createErrorResponse("Company not found", 404);
    }
    const planLimit = getPlanLimit(company.plan);
    if (planLimit !== null) {
      const { count: memberCount } = await supabase.from("memberships").select("*", {
        count: "exact",
        head: true
      }).eq("company_id", companyId);
      if ((memberCount || 0) >= planLimit) {
        console.error("admin-create-invite plan limit reached", {
          companyId,
          memberCount,
          planLimit
        });
        return createErrorResponse("Plan limit reached for this company", 409);
      }
    }
    // Check existing membership
    const { data: existingMembership } = await supabase.from("memberships").select("profiles!inner(email)").eq("company_id", companyId).eq("profiles.email", email).maybeSingle();
    if (existingMembership) {
      console.error("admin-create-invite membership already exists", {
        companyId,
        email
      });
      return createErrorResponse("Email already registered in this company", 409);
    }
    // Check existing invite
    const { data: existingInvite } = await supabase.from("invites").select("id").eq("company_id", companyId).eq("email", email).eq("status", "pending").maybeSingle();
    if (existingInvite) {
      console.error("admin-create-invite pending invite already exists", {
        companyId,
        email
      });
      return createErrorResponse("Pending invitation already exists", 409);
    }
    // Create token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    // Insert invite
    const { data: invite, error: inviteErr } = await supabase.from("invites").insert({
      company_id: companyId,
      email,
      role: body.role,
      center_id: body.center_id || null,
      team_id: body.team_id || null,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
      status: "pending"
    }).select().single();
    if (inviteErr) {
      console.error("Create invite error:", inviteErr);
      return createErrorResponse("Failed to create invite", 500);
    }
    // Send email via Resend
    try {
      const siteUrl = Deno.env.get("SITE_URL") || "https://gneraitiq.com";
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("EMAIL_FROM") || "GTiQ <no-reply@gtiq.local>";
      const inviteUrl = `${siteUrl}/accept-invite?token=${token}`;
      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject: "Invitación a GTiQ",
            html: `
              <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111827">
                <h2 style="margin:0 0 12px">Has sido invitado a GTiQ</h2>
                <p>Te han invitado a unirte a la empresa con el rol <strong>${invite.role}</strong>.</p>
                <p>Puedes aceptar la invitación usando este enlace:</p>
                <p><a href="${inviteUrl}" style="color:#1d4ed8">Aceptar invitación</a></p>
                <p>Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
                <code style="display:block;padding:8px;background:#f3f4f6;border-radius:6px">${inviteUrl}</code>
              </div>
            `
          })
        });
        if (!res.ok) {
          console.error("Resend send failed:", await res.text());
        }
      }
    } catch (e) {
      console.error("Email send error:", e);
    }
    await writeAudit(supabase, {
      actor_user_id: user.id,
      company_id: companyId,
      action: "admin_create_invite",
      entity_type: "invite",
      entity_id: invite.id,
      diff: {
        email: invite.email,
        role: invite.role
      },
      ip,
      user_agent
    });
    return createJsonResponse({
      success: true,
      invite
    });
  } catch (error) {
    console.error("Admin create invite error:", error);
    const message = error instanceof Error ? error.message : "Failed to create invite";
    if (message.includes("Unauthorized") || message.includes("Forbidden")) {
      return createErrorResponse(message, 403);
    }
    return createErrorResponse("Failed to create invite", 500);
  }
});
