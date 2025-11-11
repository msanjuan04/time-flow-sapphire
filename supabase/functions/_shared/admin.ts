import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

interface SuperadminContext {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Validates that the current request is from an authenticated superadmin
 * @throws Error if user is not authenticated or not a superadmin
 */
export async function requireSuperadmin(req: Request): Promise<SuperadminContext> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Auth error:", authError);
    throw new Error("Unauthorized: No valid session");
  }

  // Check if user is superadmin
  const { data: isSuperadmin, error: superadminError } = await supabase.rpc("is_superadmin");

  if (superadminError) {
    console.error("Superadmin check error:", superadminError);
    throw new Error("Failed to verify superadmin status");
  }

  if (!isSuperadmin) {
    console.warn(`User ${user.id} attempted to access superadmin endpoint`);
    throw new Error("Forbidden: Superadmin access required");
  }

  return { supabase, user };
}

interface AuditLogPayload {
  company_id?: string | null;
  actor_user_id: string;
  acting_as_user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  diff?: Record<string, any> | null;
  ip?: string | null;
  user_agent?: string | null;
  reason?: string | null;
}

/**
 * Writes an audit log entry to the database
 * @param supabase - Authenticated Supabase client
 * @param payload - Audit log data
 */
export async function writeAudit(
  supabase: SupabaseClient,
  payload: AuditLogPayload
): Promise<void> {
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

  if (error) {
    console.error("Failed to write audit log:", error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Extracts IP and User-Agent from request headers
 */
export function extractRequestMetadata(req: Request): {
  ip: string | null;
  user_agent: string | null;
} {
  return {
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    user_agent: req.headers.get("user-agent") || null,
  };
}
