import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side helpers for admin operations
 */

export interface AdminCallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
}

/**
 * Makes an authenticated call to an admin edge function
 * @param functionName - Name of the edge function (without /functions/ prefix)
 * @param options - Request options
 */
export async function callAdminFunction<T = any>(
  functionName: string,
  options: AdminCallOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { data: null, error: new Error("No active session") };
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body,
      method: options.method,
    });

    if (error) {
      console.error(`Admin function ${functionName} error:`, error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error(`Failed to call admin function ${functionName}:`, error);
    return { data: null, error };
  }
}

/**
 * Checks if the current user is a superadmin
 */
export async function checkSuperadmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_superadmin");
    
    if (error) {
      console.error("Error checking superadmin status:", error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error("Failed to check superadmin status:", error);
    return false;
  }
}

/**
 * Creates an audit log entry (client-side wrapper)
 * Note: This should typically be called from edge functions, not client-side
 */
export async function logAuditEvent(payload: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  company_id?: string;
}): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "No authenticated user" };
    }

    const { error } = await supabase.from("audit_logs").insert({
      company_id: payload.company_id || null,
      actor_user_id: user.id,
      action: payload.action,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      reason: payload.reason || null,
    } as any);

    if (error) {
      console.error("Failed to log audit event:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Audit logging error:", error);
    return { success: false, error };
  }
}
