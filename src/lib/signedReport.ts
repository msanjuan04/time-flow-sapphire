import { supabase } from "@/integrations/supabase/client";

export interface SignReportRequest {
  company_id: string;
  scope?: "company" | "user";
  user_id?: string | null;
  report_type?: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  payload: any;
  notes?: string;
}

export interface SignReportResponse {
  id: string;
  generated_at: string;
  verification_token: string;
  content_hash: string;
  signature: string;
  signed_by_email: string;
}

export async function signReport(req: SignReportRequest): Promise<SignReportResponse> {
  const { data, error } = await supabase.functions.invoke("sign-report", {
    body: req,
  });
  if (error) {
    const msg = (error as any)?.message || String(error);
    throw new Error(msg);
  }
  if (!data || data.error) {
    throw new Error(data?.error || "sign-report: respuesta vacía");
  }
  return data as SignReportResponse;
}

/**
 * Public verification URL embedded in the QR. Points to the customer-facing
 * verification page (deployed in /verify/:token).
 */
export function buildVerifyUrl(token: string): string {
  // Use current origin so it works in dev and prod.
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://gneraitiq.com";
  return `${origin}/verify/${token}`;
}
