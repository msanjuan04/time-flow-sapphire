import { serve } from "https://deno.land/std/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

interface RequestPayload {
  company_id?: string;
  year?: number;
  month?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const body: RequestPayload = await req.json().catch(() => ({}));
    const { company_id, year, month } = body;

    if (!company_id || !year || !month) {
      return createErrorResponse("company_id, year y month son obligatorios", 400);
    }

    return createJsonResponse({
      ok: true,
      created: 1,
      message: "Stub temporal: no se envió ninguna notificación real.",
    });
  } catch (error) {
    console.error("request-monthly-signoff error:", error);
    return createErrorResponse("Error inesperado al solicitar firma mensual", 500);
  }
});
