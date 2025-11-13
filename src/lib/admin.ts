const FUNCTIONS_BASE = (import.meta.env.VITE_SUPABASE_URL || "https://fyyhkdishlythkdnojdh.supabase.co").replace(/\/$/, "");
const STORAGE_KEY = "gtiq_auth";

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
    const response = await fetch(`${FUNCTIONS_BASE}/functions/v1/${functionName}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Admin function ${functionName} failed`);
    }

    const data = (await response.json().catch(() => null)) as T | null;
    return { data, error: null };
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
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return false;
    const parsed = JSON.parse(cached);
    return Boolean(parsed?.user?.is_superadmin);
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
