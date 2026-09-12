import { serve } from "https://deno.land/std/http/server.ts";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

interface GenerateMonthlyPayload {
  company_id?: string;
  center_id?: string;
  year?: number;
  month?: number;
}

function buildHash(reference: string): string {
  const salt = crypto.randomUUID().replace(/-/g, "");
  return `${reference}-${salt}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const body: GenerateMonthlyPayload = await req.json().catch(() => ({}));
    const { company_id, center_id, year, month } = body;

    if (!company_id || !year || !month) {
      return createErrorResponse("company_id, year y month son obligatorios", 400);
    }

    const reference = `${year}-${String(month).padStart(2, "0")}`;
    const hash = buildHash(reference);
    const fileBase = `exports/${company_id}/${reference}`;

    return createJsonResponse({
      ok: true,
      csv_url: `supabase://storage/v1/object/${fileBase}.csv`,
      pdf_url: `supabase://storage/v1/object/${fileBase}.pdf`,
      hash,
      center_id: center_id ?? null,
      message: "Stub temporal: no se ha generado ningún archivo real todavía.",
    });
  } catch (error) {
    console.error("generate-monthly-package error:", error);
    return createErrorResponse("Error inesperado generando paquete mensual", 500);
  }
});
