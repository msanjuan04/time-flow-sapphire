import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side helpers for admin operations
 */

export interface AdminCallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
}

/**
 * Makes an authenticated call to an admin edge function
 * @param functionName - Name of the edge function (without /functions/ prefix)
 * @param options - Request options
 */
export async function callAdminFunction<T = unknown>(
  functionName: string,
  options: AdminCallOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body,
      method: options.method,
    });

    if (error) {
      throw error;
    }

    return { data: data as T, error: null };
  } catch (error) {
    console.error(`Failed to call admin function ${functionName}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to call admin function"),
    };
  }
}

/**
 * Checks if the current user is a superadmin
 */
export async function checkSuperadmin(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc("is_superadmin");
    return Boolean(data);
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
}): Promise<{ success: boolean; error?: unknown }> {
  console.warn("Client-side audit logging is disabled in the code-based login flow", payload);
  return { success: false, error: "audit_logging_disabled" };
}
