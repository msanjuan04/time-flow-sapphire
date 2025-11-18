import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { corsHeaders, handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

type AllowedRole = "owner" | "admin" | "manager" | "worker";

interface UpdateEmployeePayload {
  company_id: string;
  user_id: string;
  full_name: string;
  role: AllowedRole;
  center_id?: string | null;
  team_id?: string | null;
}

const MANAGERIAL_ROLES: AllowedRole[] = ["owner", "admin", "manager"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("Unauthorized", 401);
    }

    const payload = (await req.json().catch(() => ({}))) as Partial<UpdateEmployeePayload>;
    const { company_id, user_id, full_name, role, center_id, team_id } = payload;

    if (!company_id || !user_id || !full_name || !role) {
      return createErrorResponse("company_id, user_id, full_name y role son obligatorios", 400);
    }

    if (!["owner", "admin", "manager", "worker"].includes(role)) {
      return createErrorResponse("Role inválido", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return createErrorResponse("Misconfigured server", 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return createErrorResponse("Unauthorized", 401);
    }

    const { data: requesterMembership, error: membershipError } = await authClient
      .from("memberships")
      .select("role")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Failed to fetch requester membership:", membershipError);
      return createErrorResponse("No se pudo validar tu membresía", 500);
    }

    const isSelf = user.id === user_id;
    const canManage = requesterMembership ? MANAGERIAL_ROLES.includes(requesterMembership.role as AllowedRole) : false;

    if (!isSelf && !canManage) {
      return createErrorResponse("No tienes permisos para modificar este usuario", 403);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        full_name,
        center_id: center_id || null,
        team_id: team_id || null,
      })
      .eq("id", user_id);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
      return createErrorResponse("No se pudo actualizar el perfil", 500);
    }

    if (canManage && role) {
      const { error: membershipUpdateError } = await serviceClient
        .from("memberships")
        .update({ role })
        .eq("user_id", user_id)
        .eq("company_id", company_id);

      if (membershipUpdateError) {
        console.error("Failed to update membership role:", membershipUpdateError);
        return createErrorResponse("Perfil actualizado, pero falló el cambio de rol", 500);
      }
    }

    return createJsonResponse({ success: true });
  } catch (error) {
    console.error("update-employee error:", error);
    return createErrorResponse("Error interno del servidor", 500);
  }
}, { cors: corsHeaders });

