import { serve } from "https://deno.land/std/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

type Decision = "signed" | "disputed";

interface SignPayload {
  company_id?: string;
  user_id?: string;
  year?: number;
  month?: number;
  decision?: Decision;
  signature?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const body: SignPayload = await req.json().catch(() => ({}));
    const { company_id, user_id, year, month, decision = "signed", signature } = body;

    if (!company_id || !user_id || !year || !month) {
      return createErrorResponse("company_id, user_id, year y month son obligatorios", 400);
    }

    if (decision !== "signed" && decision !== "disputed") {
      return createErrorResponse("decision debe ser 'signed' o 'disputed'", 400);
    }

    const signed_at = new Date().toISOString();

    return createJsonResponse({
      ok: true,
      status: decision,
      signed_at,
      signature: signature ?? null,
      message: "Stub temporal: no se registró ninguna firma legal.",
    });
  } catch (error) {
    console.error("sign-month error:", error);
    return createErrorResponse("Error inesperado al firmar mes", 500);
  }
});
